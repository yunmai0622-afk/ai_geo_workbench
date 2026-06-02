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
  reports,
  retestComparisons,
  testRounds,
} from "../drizzle/schema";
import { aggregateAiTestEvidence } from "@shared/aiTestEvidence";
import { buildRetestPlan, resolveRetestDueReminder } from "@shared/retestPlan";
import { shouldShowT1RetestAutoTriggerReminder } from "@shared/t1RetestAutoTrigger";
import { hasCompletedT0Baseline, hasCompletedT1Retest } from "@shared/workspaceMainChain";
import { isP0GeoProfileComplete } from "@shared/workspaceStateMachine";
import { getGeoArticleMinPassScore } from "./geoArticleLogic";
import { listPostPublishRetestQueue, listRewritePool } from "./postPublishWorkflow";
import { calculateProfileCompletionScore } from "./assetLibrary";
import { getDb } from "./db";
import { resolveLatestT0AiTestRunMetrics } from "./t0AiTestRunMetrics";
import { resolveT0ContentGapSuggestions } from "./t0ContentGapSuggestions";

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
    completedTaskCountRows,
    completedPublishTaskRows,
    analysisRows,
    scoreRows,
    monitoringRows,
    retestItems,
    rewriteItems,
    testRoundRows,
    retestComparisonCountRows,
    reportCountRows,
    t0Metrics,
    t0ContentGapSuggestions,
  ] = await Promise.all([
    db.select().from(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.projectId, projectId)).limit(1),
    db.select().from(projectPlatformAccounts).where(eq(projectPlatformAccounts.projectId, projectId)),
    db.select({ id: geoArticles.id }).from(geoArticles).where(eq(geoArticles.projectId, projectId)),
    db
      .select({
        id: geoPublishRecords.id,
        publishUrl: geoPublishRecords.publishUrl,
      })
      .from(geoPublishRecords)
      .where(eq(geoPublishRecords.projectId, projectId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(publishTasks)
      .where(eq(publishTasks.projectId, projectId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(publishTasks)
      .where(and(eq(publishTasks.projectId, projectId), eq(publishTasks.status, "completed"))),
    db
      .select({
        status: publishTasks.status,
        agentFinishedAt: publishTasks.agentFinishedAt,
        updatedAt: publishTasks.updatedAt,
        createdAt: publishTasks.createdAt,
      })
      .from(publishTasks)
      .where(and(eq(publishTasks.projectId, projectId), eq(publishTasks.status, "completed"))),
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
    db
      .select({
        roundType: testRounds.roundType,
        status: testRounds.status,
        finishedAt: testRounds.finishedAt,
      })
      .from(testRounds)
      .where(eq(testRounds.projectId, projectId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(retestComparisons)
      .where(eq(retestComparisons.projectId, projectId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(reports)
      .where(eq(reports.projectId, projectId)),
    resolveLatestT0AiTestRunMetrics(db, projectId),
    resolveT0ContentGapSuggestions(db, projectId),
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
  const publishRecordWithPublicUrlCount = publishRows.filter(row => {
    const publishUrl = typeof row.publishUrl === "string" ? row.publishUrl.trim() : "";
    return Boolean(publishUrl);
  }).length;
  const waitingPublicLinkCount = Math.max(0, publishRows.length - publishRecordWithPublicUrlCount);

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
    if (score != null && score < getGeoArticleMinPassScore()) lowQualityArticleCount += 1;
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
  const monitoringQuestionCount = aiAggregate.questionCount;
  const aiTestResultCount = t0Metrics?.totalRuns ?? monitoringQuestionCount;
  const brandMentionRate =
    t0Metrics?.mentionRate ??
    (monitoringQuestionCount > 0 ? aiAggregate.mentionRate : null);
  const recommendRate =
    t0Metrics?.recommendRate ??
    (monitoringQuestionCount > 0 ? aiAggregate.recommendRate : null);

  return {
    enterpriseName: profile?.enterpriseName ?? null,
    profileCompletionPercent: profile?.completionScore ?? calculateProfileCompletionScore(profile),
    boundPublishAccountCount,
    expiredSessionAccountCount,
    articleCount: articleRows.length,
    publishRecordCount: publishRows.length,
    publishRecordWithPublicUrlCount,
    waitingPublicLinkCount,
    publishTaskCount: Number(taskCountRows[0]?.count ?? 0),
    completedPublishTaskCount: Number(completedTaskCountRows[0]?.count ?? 0),
    retestPendingCount,
    rewriteOpenCount,
    aiTestResultCount,
    monitoringRecordCount: monitoringRows.length,
    retestComparisonCount: Number(retestComparisonCountRows[0]?.count ?? 0),
    reportCount: Number(reportCountRows[0]?.count ?? 0),
    geoScore: scoreRows[0]?.totalScore ?? null,
    brandMentionRate,
    recommendRate,
    lowQualityArticleCount,
    hasAnalysis: analysisRows.length > 0,
    hasGeoScore: scoreRows.length > 0,
    hasCompletedT0Baseline: hasCompletedT0Baseline(testRoundRows),
    hasCompletedT1Retest: hasCompletedT1Retest(testRoundRows),
    ...(() => {
      const retestPlanInput = {
        completedPublishTasks: completedPublishTaskRows,
        testRounds: testRoundRows,
      };
      return {
        retestPlan: buildRetestPlan(retestPlanInput),
        retestDueReminder: resolveRetestDueReminder(retestPlanInput),
        showT1RetestAutoTriggerReminder: shouldShowT1RetestAutoTriggerReminder(retestPlanInput),
      };
    })(),
    p0ProfileComplete: isP0GeoProfileComplete(profileRecord),
    t0ContentGapSuggestions,
  } as const;
}
