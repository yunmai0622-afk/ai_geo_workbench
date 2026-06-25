import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  buildSourceDiscoveryQueries,
  buildTrustEvidenceDiscoveryQueries,
  classifySourceRecordType,
  classifyTrustEvidenceRecordType,
  detectDiscoverySignals,
  extractSourceDomain,
  mapSourceSuggestedTypeToPlatform,
  mapTrustEvidenceSuggestedTypeToEvidenceType,
  resolveDiscoveryBrandName,
  resolveDiscoveryConfidence,
  type DiscoveryCandidateType,
  type DiscoveryDetectedSignals,
} from "@shared/discoveryLogic";
import { buildBrandSourceTrustSummary, type BrandSourceRecordRow } from "@shared/brandSourceGraph";
import {
  brandSourceRecords,
  discoveryCandidates,
  enterpriseGeoProfiles,
  trustEvidenceItems,
  type DiscoveryCandidate,
} from "../drizzle/schema";
import { syncSourceGraphDerivedData } from "./brandSourceGraphService";
import type { DbConn } from "./projectAccess";
import {
  isWebSearchConfigured,
  searchWeb,
  SEARCH_PROVIDER_NOT_CONFIGURED,
  WebSearchNotConfiguredError,
  type WebSearchResult,
} from "./services/webSearchService";

const DISCOVERY_NOT_CONFIGURED_MESSAGES: Record<DiscoveryCandidateType, string> = {
  source: "自动发现服务暂未配置，你可以先手动添加已知信源",
  trust_evidence: "自动发现服务暂未配置，你可以先手动添加信任证据",
};

function resolveDiscoveryNotConfiguredMessage(candidateType?: DiscoveryCandidateType): string {
  if (candidateType) {
    return DISCOVERY_NOT_CONFIGURED_MESSAGES[candidateType];
  }
  return DISCOVERY_NOT_CONFIGURED_MESSAGES.source;
}

export type DiscoveryRunResult = {
  configured: boolean;
  candidates: DiscoveryCandidate[];
  newCount: number;
  message?: string;
};

async function loadDiscoveryProfileContext(db: DbConn, projectId: number) {
  const rows = await db
    .select()
    .from(enterpriseGeoProfiles)
    .where(eq(enterpriseGeoProfiles.projectId, projectId))
    .orderBy(desc(enterpriseGeoProfiles.updatedAt))
    .limit(1);
  const profile = rows[0];
  if (!profile) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "请先完善企业档案后再使用自动发现" });
  }

  const brandName = resolveDiscoveryBrandName(profile);
  if (!brandName) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "请先填写品牌名称后再使用自动发现" });
  }

  const competitors = [
    ...(profile.competitors ?? []),
    ...(profile.targetCompetitorsToBeat ?? []),
  ].filter((name): name is string => typeof name === "string" && name.trim().length > 0);

  return {
    brandName,
    officialWebsite: profile.officialWebsite,
    competitors: [...new Set(competitors.map(name => name.trim()))],
  };
}

function buildCandidateRow(input: {
  projectId: number;
  candidateType: DiscoveryCandidateType;
  result: WebSearchResult;
  brandName: string;
  officialWebsite?: string | null;
  competitors: string[];
}) {
  const suggestedRecordType =
    input.candidateType === "source"
      ? classifySourceRecordType(input.result.url, input.result.title, input.officialWebsite)
      : classifyTrustEvidenceRecordType(input.result.title);

  const detectedSignals = detectDiscoverySignals({
    brandName: input.brandName,
    title: input.result.title,
    snippet: input.result.snippet,
    url: input.result.url,
    officialWebsite: input.officialWebsite,
    competitors: input.competitors,
    candidateType: input.candidateType,
  });

  const confidence = resolveDiscoveryConfidence(detectedSignals);

  return {
    projectId: input.projectId,
    candidateType: input.candidateType,
    title: input.result.title.slice(0, 500),
    url: input.result.url.slice(0, 2000),
    snippet: input.result.snippet || null,
    sourceDomain: extractSourceDomain(input.result.url) || null,
    suggestedRecordType,
    confidence,
    detectedSignals: detectedSignals as DiscoveryDetectedSignals,
    status: "pending" as const,
  };
}

async function loadExistingUrls(
  db: DbConn,
  projectId: number,
  candidateType: DiscoveryCandidateType,
): Promise<Set<string>> {
  const rows = await db
    .select({ url: discoveryCandidates.url })
    .from(discoveryCandidates)
    .where(
      and(
        eq(discoveryCandidates.projectId, projectId),
        eq(discoveryCandidates.candidateType, candidateType),
        inArray(discoveryCandidates.status, ["pending", "accepted"]),
      ),
    );
  return new Set(rows.map(row => row.url.trim().toLowerCase()));
}

async function runDiscovery(
  db: DbConn,
  projectId: number,
  candidateType: DiscoveryCandidateType,
  queries: string[],
): Promise<DiscoveryRunResult> {
  if (!isWebSearchConfigured()) {
    const existing = await listDiscoveryCandidates(db, projectId, candidateType);
    return {
      configured: false,
      candidates: existing,
      newCount: 0,
      message: resolveDiscoveryNotConfiguredMessage(candidateType),
    };
  }

  const context = await loadDiscoveryProfileContext(db, projectId);
  const existingUrls = await loadExistingUrls(db, projectId, candidateType);
  const seenInRun = new Set<string>();
  const toInsert: ReturnType<typeof buildCandidateRow>[] = [];

  for (const query of queries) {
    let results: WebSearchResult[];
    try {
      results = await searchWeb(query, 3);
    } catch (error) {
      if (error instanceof WebSearchNotConfiguredError) {
        const existing = await listDiscoveryCandidates(db, projectId, candidateType);
        return {
          configured: false,
          candidates: existing,
          newCount: 0,
          message: resolveDiscoveryNotConfiguredMessage(candidateType),
        };
      }
      throw error;
    }

    for (const result of results) {
      const normalizedUrl = result.url.trim().toLowerCase();
      if (!normalizedUrl || existingUrls.has(normalizedUrl) || seenInRun.has(normalizedUrl)) continue;
      seenInRun.add(normalizedUrl);
      toInsert.push(
        buildCandidateRow({
          projectId,
          candidateType,
          result,
          brandName: context.brandName,
          officialWebsite: context.officialWebsite,
          competitors: context.competitors,
        }),
      );
    }
  }

  if (toInsert.length > 0) {
    await db.insert(discoveryCandidates).values(toInsert);
  }

  const candidates = await listDiscoveryCandidates(db, projectId, candidateType);
  return {
    configured: true,
    candidates,
    newCount: toInsert.length,
    message: toInsert.length > 0 ? `已发现 ${toInsert.length} 条新候选` : "未发现新的候选，可稍后再试或手动添加",
  };
}

export async function discoverSources(db: DbConn, projectId: number): Promise<DiscoveryRunResult> {
  const context = await loadDiscoveryProfileContext(db, projectId);
  const queries = buildSourceDiscoveryQueries(context.brandName);
  return runDiscovery(db, projectId, "source", queries);
}

export async function discoverTrustEvidence(db: DbConn, projectId: number): Promise<DiscoveryRunResult> {
  const context = await loadDiscoveryProfileContext(db, projectId);
  const queries = buildTrustEvidenceDiscoveryQueries(context.brandName);
  return runDiscovery(db, projectId, "trust_evidence", queries);
}

export async function listDiscoveryCandidates(
  db: DbConn,
  projectId: number,
  candidateType: DiscoveryCandidateType,
  status?: "pending" | "accepted" | "ignored",
): Promise<DiscoveryCandidate[]> {
  const conditions = [
    eq(discoveryCandidates.projectId, projectId),
    eq(discoveryCandidates.candidateType, candidateType),
  ];
  if (status) {
    conditions.push(eq(discoveryCandidates.status, status));
  }

  return db
    .select()
    .from(discoveryCandidates)
    .where(and(...conditions))
    .orderBy(desc(discoveryCandidates.createdAt));
}

export async function acceptDiscoveryCandidate(
  db: DbConn,
  projectId: number,
  candidateId: number,
  targetType: "source" | "trust_evidence",
  options?: { markValid?: boolean },
): Promise<{ acceptedRecordId: number }> {
  const rows = await db
    .select()
    .from(discoveryCandidates)
    .where(and(eq(discoveryCandidates.id, candidateId), eq(discoveryCandidates.projectId, projectId)))
    .limit(1);
  const candidate = rows[0];
  if (!candidate) {
    throw new TRPCError({ code: "NOT_FOUND", message: "候选记录不存在" });
  }
  if (candidate.status === "accepted") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "该候选已采纳" });
  }
  if (candidate.candidateType !== targetType) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "候选类型与采纳目标不一致" });
  }

  const signals = (candidate.detectedSignals ?? {}) as DiscoveryDetectedSignals;

  if (targetType === "source") {
    const platform = mapSourceSuggestedTypeToPlatform(candidate.suggestedRecordType);
    const inserted = await db
      .insert(brandSourceRecords)
      .values({
        projectId,
        platform,
        sourceName: candidate.title,
        platformName: candidate.suggestedRecordType === "媒体平台" ? candidate.sourceDomain : null,
        url: candidate.url,
        isPubliclyAccessible: options?.markValid ? true : Boolean(signals.hasBrandName || signals.likelyOfficial),
        containsBrandName: Boolean(signals.hasBrandName),
        containsBusinessDescription: false,
        containsOfficialSite: Boolean(signals.likelyOfficial),
        containsCoreKeywords: false,
        aiCitationConfirmed: false,
        isCrossSourceConsistent: false,
        notes: candidate.snippet,
        lastVerifiedAt: options?.markValid ? new Date() : null,
      })
      .$returningId();
    const acceptedRecordId = inserted[0]?.id;
    if (!acceptedRecordId) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "采纳信源失败" });
    }
    await db
      .update(discoveryCandidates)
      .set({ status: "accepted", acceptedRecordId })
      .where(and(eq(discoveryCandidates.id, candidateId), eq(discoveryCandidates.projectId, projectId)));
    await syncSourceGraphDerivedData(db, projectId);
    return { acceptedRecordId };
  }

  const evidenceType = mapTrustEvidenceSuggestedTypeToEvidenceType(candidate.suggestedRecordType);
  const inserted = await db
    .insert(trustEvidenceItems)
    .values({
      projectId,
      evidenceType: evidenceType as (typeof trustEvidenceItems.$inferInsert)["evidenceType"],
      title: candidate.title.slice(0, 255),
      summary: candidate.snippet,
      content: null,
      sourceUrl: candidate.url,
      isPublic: true,
      verificationStatus: "draft",
      displayOrder: 0,
      metadata: { discoveryCandidateId: candidateId, detectedSignals: signals },
    })
    .$returningId();
  const acceptedRecordId = inserted[0]?.id;
  if (!acceptedRecordId) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "采纳信任证据失败" });
  }
  await db
    .update(discoveryCandidates)
    .set({ status: "accepted", acceptedRecordId })
    .where(and(eq(discoveryCandidates.id, candidateId), eq(discoveryCandidates.projectId, projectId)));
  return { acceptedRecordId };
}

export async function ignoreDiscoveryCandidate(
  db: DbConn,
  projectId: number,
  candidateId: number,
): Promise<void> {
  const rows = await db
    .select({ id: discoveryCandidates.id })
    .from(discoveryCandidates)
    .where(and(eq(discoveryCandidates.id, candidateId), eq(discoveryCandidates.projectId, projectId)))
    .limit(1);
  if (!rows[0]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "候选记录不存在" });
  }
  await db
    .update(discoveryCandidates)
    .set({ status: "ignored" })
    .where(and(eq(discoveryCandidates.id, candidateId), eq(discoveryCandidates.projectId, projectId)));
}

export function getDiscoveryProviderStatus(candidateType?: DiscoveryCandidateType) {
  const configured = isWebSearchConfigured();
  return {
    configured,
    code: configured ? null : SEARCH_PROVIDER_NOT_CONFIGURED,
    message: configured ? null : resolveDiscoveryNotConfiguredMessage(candidateType),
  };
}

export async function getSourceDiscoverySummary(db: DbConn, projectId: number) {
  const [pendingCandidates, latestCandidateRows, sourceRows] = await Promise.all([
    listDiscoveryCandidates(db, projectId, "source", "pending"),
    db
      .select({ createdAt: discoveryCandidates.createdAt })
      .from(discoveryCandidates)
      .where(and(eq(discoveryCandidates.projectId, projectId), eq(discoveryCandidates.candidateType, "source")))
      .orderBy(desc(discoveryCandidates.createdAt))
      .limit(1),
    db.select().from(brandSourceRecords).where(eq(brandSourceRecords.projectId, projectId)),
  ]);

  const trustSummary = buildBrandSourceTrustSummary(sourceRows as BrandSourceRecordRow[]);

  return {
    lastDiscoveryAt: latestCandidateRows[0]?.createdAt ?? null,
    newDiscoveryCount: pendingCandidates.length,
    verifiedSourceCount: trustSummary.verifiedCount,
    pendingVerificationCount: trustSummary.pendingVerificationCount,
  };
}
