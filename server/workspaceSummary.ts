import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  analysisResults,
  enterpriseGeoProfiles,
  geoArticleQualityScores,
  geoArticles,
  geoInclusionMonitoringRecords,
  geoPublishRecords,
  geoScores,
  projectPlatformAccounts,
  publishTasks,
} from "../drizzle/schema";
import { aggregateAiTestEvidence } from "@shared/aiTestEvidence";
import { isP0GeoProfileComplete } from "@shared/workspaceStateMachine";
import { GEO_ARTICLE_MIN_PASS_SCORE } from "@shared/const";
import { listPostPublishRetestQueue, listRewritePool } from "./postPublishWorkflow";
import { calculateProfileCompletionScore } from "./assetLibrary";
import { getDb } from "./db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

function isPublishReadyAccount(row: {
  isEnabled: number | boolean;
  accountName: string;
  localProfileId: string | null;
  localAgentId: string | null;
  sessionStatus: string | null;
}): boolean {
  return (
    Boolean(row.isEnabled === true || row.isEnabled === 1) &&
    Boolean(row.accountName?.trim()) &&
    Boolean(row.localProfileId?.trim()) &&
    Boolean(row.localAgentId?.trim()) &&
    row.sessionStatus === "active"
  );
}

export async function fetchWorkspaceSummaryMetrics(db: Db, projectId: number) {
  const [
    profileRows,
    accountRows,
    articleRows,
    publishRows,
    taskCountRows,
    analysisRows,
    scoreRows,
    monitoringRows,
    retestItems,
    rewriteItems,
  ] = await Promise.all([
    db.select().from(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.projectId, projectId)).limit(1),
    db.select().from(projectPlatformAccounts).where(eq(projectPlatformAccounts.projectId, projectId)),
    db.select({ id: geoArticles.id }).from(geoArticles).where(eq(geoArticles.projectId, projectId)),
    db.select({ id: geoPublishRecords.id }).from(geoPublishRecords).where(eq(geoPublishRecords.projectId, projectId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(publishTasks)
      .where(eq(publishTasks.projectId, projectId)),
    db.select({ id: analysisResults.id }).from(analysisResults).where(eq(analysisResults.projectId, projectId)).limit(1),
    db.select({ totalScore: geoScores.totalScore }).from(geoScores).where(eq(geoScores.projectId, projectId)).orderBy(desc(geoScores.createdAt)).limit(1),
    db
      .select({
        id: geoInclusionMonitoringRecords.id,
        aiTestResults: geoInclusionMonitoringRecords.aiTestResults,
      })
      .from(geoInclusionMonitoringRecords)
      .where(eq(geoInclusionMonitoringRecords.projectId, projectId)),
    listPostPublishRetestQueue(db, projectId),
    listRewritePool(db, projectId),
  ]);

  const qualityRows =
    articleRows.length > 0
      ? await db
          .select({
            articleId: geoArticleQualityScores.articleId,
            totalScore: geoArticleQualityScores.totalScore,
          })
          .from(geoArticleQualityScores)
          .where(
            inArray(
              geoArticleQualityScores.articleId,
              articleRows.map(a => a.id),
            ),
          )
          .orderBy(desc(geoArticleQualityScores.createdAt))
      : [];

  const profile = profileRows[0] ?? null;
  const profileRecord = profile as Record<string, unknown> | null;
  const boundPublishAccountCount = accountRows.filter(row => isPublishReadyAccount(row)).length;
  const expiredSessionAccountCount = accountRows.filter(
    row => Boolean(row.isEnabled) && row.sessionStatus && row.sessionStatus !== "active",
  ).length;

  const latestScoreByArticle = new Map<number, number>();
  for (const row of qualityRows) {
    if (!latestScoreByArticle.has(row.articleId)) {
      latestScoreByArticle.set(row.articleId, row.totalScore ?? 0);
    }
  }
  let lowQualityArticleCount = 0;
  for (const article of articleRows) {
    const score = latestScoreByArticle.get(article.id);
    if (score != null && score < GEO_ARTICLE_MIN_PASS_SCORE) lowQualityArticleCount += 1;
  }

  const monitoringEvidence = monitoringRows.map(r => ({
    monitoringRecordId: r.id,
    results: Array.isArray(r.aiTestResults) ? r.aiTestResults : [],
  }));
  const aiAggregate = aggregateAiTestEvidence(monitoringEvidence);
  const retestPendingCount = retestItems.filter(
    (item: { status: string }) => item.status === "pending" || item.status === "in_progress",
  ).length;
  const rewriteOpenCount = rewriteItems.length;

  return {
    enterpriseName: profile?.enterpriseName ?? null,
    profileCompletionPercent: profile?.completionScore ?? calculateProfileCompletionScore(profile),
    boundPublishAccountCount,
    expiredSessionAccountCount,
    articleCount: articleRows.length,
    publishRecordCount: publishRows.length,
    publishTaskCount: Number(taskCountRows[0]?.count ?? 0),
    retestPendingCount,
    rewriteOpenCount,
    aiTestResultCount: aiAggregate.questionCount,
    monitoringRecordCount: monitoringRows.length,
    geoScore: scoreRows[0]?.totalScore ?? null,
    brandMentionRate: aiAggregate.questionCount > 0 ? aiAggregate.mentionRate : null,
    lowQualityArticleCount,
    hasAnalysis: analysisRows.length > 0,
    hasGeoScore: scoreRows.length > 0,
    p0ProfileComplete: isP0GeoProfileComplete(profileRecord),
  } as const;
}
