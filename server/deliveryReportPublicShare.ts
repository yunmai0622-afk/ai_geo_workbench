import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  analysisResults,
  deliveryReportShareTokens,
  enterpriseGeoProfiles,
  geoArticles,
  geoInclusionMonitoringRecords,
  geoPublishRecords,
  geoScores,
  projects,
  reports,
} from "../drizzle/schema";
import { aggregateAiTestEvidence, normalizeAiTestResult, type AiTestEvidenceAggregate } from "@shared/aiTestEvidence";
import { buildDeliveryReportConclusionLine, resolveDeliveryReportVisibilityScore } from "@shared/deliveryReportScore";
import {
  computeDeliveryReportShareExpiresAt,
  DELIVERY_REPORT_EVIDENCE_INVALID_MESSAGE,
  DELIVERY_REPORT_SHARE_INVALID_MESSAGE,
  mapItemToPublicEvidence,
  mapRecordsToPublicPublishedContent,
  type DeliveryReportPublicEvidencePayload,
  type DeliveryReportPublicSharePayload,
  type DeliveryReportShareLinkStatus,
} from "@shared/deliveryReportPublicShare";
import { buildDeliveryReportPublicPath } from "@shared/deliveryReportPublicShare";
import { resolveProjectCompetitorNames } from "./geoAiMentionEvidence";
import { getDb } from "./db";

type DbConn = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export const SHARE_TOKEN_INVALID = DELIVERY_REPORT_SHARE_INVALID_MESSAGE;
export const SHARE_EVIDENCE_INVALID = DELIVERY_REPORT_EVIDENCE_INVALID_MESSAGE;

export function assertMonitoringRecordForShareProject(recordProjectId: number, tokenProjectId: number) {
  if (recordProjectId !== tokenProjectId) {
    throw new TRPCError({ code: "NOT_FOUND", message: SHARE_EVIDENCE_INVALID });
  }
}

export function generateDeliveryReportShareToken() {
  return randomBytes(32).toString("base64url");
}

export function toPublicAiTestAggregate(
  aggregate: AiTestEvidenceAggregate & { items?: unknown },
): AiTestEvidenceAggregate {
  const { items: _items, ...publicAggregate } = aggregate as AiTestEvidenceAggregate & { items?: unknown };
  return publicAggregate;
}

export function isShareTokenRowActive(row: { isEnabled: boolean; expiresAt: Date | null } | undefined): boolean {
  if (!row) return false;
  if (!row.isEnabled) return false;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return false;
  return true;
}

export async function findShareTokenRow(db: DbConn, token: string) {
  const rows = await db
    .select()
    .from(deliveryReportShareTokens)
    .where(eq(deliveryReportShareTokens.token, token))
    .limit(1);
  return rows[0];
}

export async function resolveShareTokenProjectId(db: DbConn, token: string): Promise<number> {
  const row = await findShareTokenRow(db, token);
  if (!isShareTokenRowActive(row)) {
    throw new TRPCError({ code: "NOT_FOUND", message: SHARE_TOKEN_INVALID });
  }
  return row!.projectId;
}

export async function getActiveShareTokenForProject(
  db: DbConn,
  projectId: number,
): Promise<{ token: string; expiresAt: Date | null } | null> {
  const existing = await db
    .select()
    .from(deliveryReportShareTokens)
    .where(and(eq(deliveryReportShareTokens.projectId, projectId), eq(deliveryReportShareTokens.isEnabled, true)))
    .orderBy(desc(deliveryReportShareTokens.createdAt))
    .limit(1);
  const row = existing[0];
  if (!row || !isShareTokenRowActive(row)) return null;
  return { token: row.token, expiresAt: row.expiresAt ?? null };
}

export async function getShareLinkStatusForProject(db: DbConn, projectId: number): Promise<DeliveryReportShareLinkStatus> {
  const active = await getActiveShareTokenForProject(db, projectId);
  if (!active) {
    return { hasActiveLink: false, sharePath: null, shareExpiresAt: null };
  }
  return {
    hasActiveLink: true,
    sharePath: buildDeliveryReportPublicPath(active.token),
    shareExpiresAt: active.expiresAt ? active.expiresAt.toISOString() : null,
  };
}

/** 禁用 projectId 下所有启用中的分享链接（软禁用，不删除记录） */
export async function disableEnabledShareTokensForProject(
  db: DbConn,
  projectId: number,
): Promise<{ disabled: boolean; count: number }> {
  const enabled = await db
    .select({ id: deliveryReportShareTokens.id })
    .from(deliveryReportShareTokens)
    .where(and(eq(deliveryReportShareTokens.projectId, projectId), eq(deliveryReportShareTokens.isEnabled, true)));

  if (enabled.length === 0) {
    return { disabled: false, count: 0 };
  }

  await db
    .update(deliveryReportShareTokens)
    .set({ isEnabled: false })
    .where(and(eq(deliveryReportShareTokens.projectId, projectId), eq(deliveryReportShareTokens.isEnabled, true)));

  return { disabled: true, count: enabled.length };
}

/** 禁用旧链接并生成新的随机分享链接 */
export async function regenerateShareLinkForProject(
  db: DbConn,
  projectId: number,
): Promise<{ token: string; expiresAt: Date }> {
  await disableEnabledShareTokensForProject(db, projectId);
  const token = generateDeliveryReportShareToken();
  const expiresAt = computeDeliveryReportShareExpiresAt();
  await db.insert(deliveryReportShareTokens).values({ token, projectId, isEnabled: true, expiresAt });
  return { token, expiresAt };
}

export async function getOrCreateShareTokenForProject(
  db: DbConn,
  projectId: number,
): Promise<{ token: string; expiresAt: Date | null }> {
  const active = await getActiveShareTokenForProject(db, projectId);
  if (active) {
    return active;
  }

  const token = generateDeliveryReportShareToken();
  const expiresAt = computeDeliveryReportShareExpiresAt();
  await db.insert(deliveryReportShareTokens).values({ token, projectId, isEnabled: true, expiresAt });
  return { token, expiresAt };
}

export async function buildDeliveryReportPublicSharePayload(
  db: DbConn,
  projectId: number,
  shareExpiresAt: Date | null = null,
): Promise<DeliveryReportPublicSharePayload> {
  const projectRows = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  const project = projectRows[0];
  if (!project) {
    throw new TRPCError({ code: "NOT_FOUND", message: SHARE_TOKEN_INVALID });
  }

  const profileRows = await db
    .select()
    .from(enterpriseGeoProfiles)
    .where(eq(enterpriseGeoProfiles.projectId, projectId))
    .orderBy(desc(enterpriseGeoProfiles.updatedAt))
    .limit(1);
  const profile = profileRows[0];
  const brandName = profile?.brandName?.trim() || project.enterpriseName || "未填写品牌名称";
  const enterpriseName = project.enterpriseName || "—";

  const scoreRows = await db
    .select()
    .from(geoScores)
    .where(eq(geoScores.projectId, projectId))
    .orderBy(desc(geoScores.createdAt))
    .limit(1);
  const score = scoreRows[0];
  const visibilityScore = resolveDeliveryReportVisibilityScore(score ?? null);

  const analysisRows = await db.select().from(analysisResults).where(eq(analysisResults.projectId, projectId)).limit(1);
  const firstAnalysis = analysisRows[0];
  const conclusionLine = buildDeliveryReportConclusionLine(visibilityScore, Boolean(firstAnalysis));

  const reportRows = await db
    .select({ createdAt: reports.createdAt })
    .from(reports)
    .where(eq(reports.projectId, projectId))
    .orderBy(desc(reports.createdAt))
    .limit(1);
  const reportGeneratedAt = reportRows[0]?.createdAt ?? score?.createdAt ?? null;

  const monitoringRows = await db
    .select({
      id: geoInclusionMonitoringRecords.id,
      aiTestResults: geoInclusionMonitoringRecords.aiTestResults,
    })
    .from(geoInclusionMonitoringRecords)
    .where(eq(geoInclusionMonitoringRecords.projectId, projectId))
    .orderBy(desc(geoInclusionMonitoringRecords.createdAt));

  const aggregate = aggregateAiTestEvidence(
    monitoringRows.map(row => ({
      monitoringRecordId: row.id,
      results: Array.isArray(row.aiTestResults) ? row.aiTestResults : [],
    })),
  );

  const publishRows = await db
    .select({
      publishTitle: geoPublishRecords.publishTitle,
      publishChannel: geoPublishRecords.publishChannel,
      publishUrl: geoPublishRecords.publishUrl,
      publishedAt: geoPublishRecords.publishedAt,
      articleId: geoPublishRecords.articleId,
    })
    .from(geoPublishRecords)
    .where(eq(geoPublishRecords.projectId, projectId))
    .orderBy(desc(geoPublishRecords.publishedAt));

  const articleIds = Array.from(new Set(publishRows.map(row => row.articleId)));
  const articleTitleById = new Map<number, string>();
  if (articleIds.length > 0) {
    const articleRows = await db
      .select({ id: geoArticles.id, title: geoArticles.title })
      .from(geoArticles)
      .where(inArray(geoArticles.id, articleIds));
    for (const article of articleRows) {
      if (article.title) articleTitleById.set(article.id, article.title);
    }
  }

  const publishedContent = mapRecordsToPublicPublishedContent(
    publishRows.map(row => ({
      publishTitle: row.publishTitle,
      publishChannel: row.publishChannel,
      publishUrl: row.publishUrl,
      publishedAt: row.publishedAt,
      articleTitle: articleTitleById.get(row.articleId) ?? null,
    })),
  );

  return {
    brandName,
    enterpriseName,
    reportGeneratedAt: reportGeneratedAt ? reportGeneratedAt.toISOString() : null,
    visibilityScore,
    conclusionLine,
    shareExpiresAt: shareExpiresAt ? shareExpiresAt.toISOString() : null,
    aiTest: toPublicAiTestAggregate(aggregate),
    publishedContent,
  };
}

export async function buildDeliveryReportPublicEvidencePayload(
  db: DbConn,
  token: string,
  recordId: number,
  resultIndex: number,
): Promise<DeliveryReportPublicEvidencePayload> {
  const projectId = await resolveShareTokenProjectId(db, token);

  const rows = await db
    .select()
    .from(geoInclusionMonitoringRecords)
    .where(eq(geoInclusionMonitoringRecords.id, recordId))
    .limit(1);
  const record = rows[0];
  if (!record) {
    throw new TRPCError({ code: "NOT_FOUND", message: SHARE_EVIDENCE_INVALID });
  }

  assertMonitoringRecordForShareProject(record.projectId, projectId);

  const rawResults = Array.isArray(record.aiTestResults) ? record.aiTestResults : [];
  const raw = rawResults[resultIndex];
  if (raw == null) {
    throw new TRPCError({ code: "NOT_FOUND", message: SHARE_EVIDENCE_INVALID });
  }

  const item = normalizeAiTestResult(raw);
  if (!item) {
    throw new TRPCError({ code: "NOT_FOUND", message: SHARE_EVIDENCE_INVALID });
  }

  const projectRows = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  const project = projectRows[0];
  const profileRows = await db
    .select()
    .from(enterpriseGeoProfiles)
    .where(eq(enterpriseGeoProfiles.projectId, projectId))
    .orderBy(desc(enterpriseGeoProfiles.updatedAt))
    .limit(1);
  const profile = profileRows[0];
  const brandName = profile?.brandName?.trim() || project?.enterpriseName || "未填写品牌名称";
  const enterpriseName = project?.enterpriseName || "—";
  const competitorNames = await resolveProjectCompetitorNames(db, projectId);

  return mapItemToPublicEvidence(item, {
    brandName,
    enterpriseName,
    competitorConfigured: competitorNames.length > 0,
  });
}
