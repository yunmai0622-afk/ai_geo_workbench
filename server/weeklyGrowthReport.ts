import { and, eq, isNull } from "drizzle-orm";
import { aggregateAiTestEvidence } from "@shared/aiTestEvidence";
import {
  geoArticles,
  geoInclusionMonitoringRecords,
  geoPublishRecords,
  projects,
  systemNotifications,
  testRounds,
} from "../drizzle/schema";
import {
  buildWeeklyGrowthReportFromMetrics,
  buildWeeklyGrowthReportTitle,
  getPreviousCalendarWeekRange,
} from "@shared/weeklyGrowthReport";
import type { TestRoundSummary } from "@shared/retestComparisonDisplay";
import { getDb } from "./db";
import { createSystemNotification } from "./systemNotifications";
import { resolveLatestT0AiTestRunMetrics } from "./t0AiTestRunMetrics";
import { resolveT0ContentGapSuggestions } from "./t0ContentGapSuggestions";
import type { DbConn } from "./projectAccess";

async function hasWeeklyGrowthReportForWeek(
  db: DbConn,
  userId: number,
  projectId: number,
  reportWeekLabel: string,
): Promise<boolean> {
  const title = buildWeeklyGrowthReportTitle({
    start: new Date(),
    end: new Date(),
    label: reportWeekLabel,
  });
  const rows = await db
    .select({ id: systemNotifications.id })
    .from(systemNotifications)
    .where(
      and(
        eq(systemNotifications.userId, userId),
        eq(systemNotifications.projectId, projectId),
        eq(systemNotifications.type, "weekly_growth_report"),
        eq(systemNotifications.title, title),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function emitWeeklyGrowthReportForProject(
  db: DbConn,
  projectId: number,
  ownerUserId: number,
  enterpriseName: string,
  now: Date = new Date(),
): Promise<"created" | "skipped"> {
  const reportWeekRange = getPreviousCalendarWeekRange(now);
  const alreadySent = await hasWeeklyGrowthReportForWeek(
    db,
    ownerUserId,
    projectId,
    reportWeekRange.label,
  );
  if (alreadySent) return "skipped";

  const [publishRecords, articleRows, monitoringRows, testRoundRows, t0Metrics, gapSuggestions] =
    await Promise.all([
      db
        .select({
          publishChannel: geoPublishRecords.publishChannel,
          publishedAt: geoPublishRecords.publishedAt,
          createdAt: geoPublishRecords.createdAt,
        })
        .from(geoPublishRecords)
        .where(eq(geoPublishRecords.projectId, projectId)),
      db
        .select({ status: geoArticles.status })
        .from(geoArticles)
        .where(eq(geoArticles.projectId, projectId)),
      db
        .select({
          inclusionMonitorStatus: geoInclusionMonitoringRecords.inclusionMonitorStatus,
          lastCheckedAt: geoInclusionMonitoringRecords.lastCheckedAt,
          aiTestResults: geoInclusionMonitoringRecords.aiTestResults,
        })
        .from(geoInclusionMonitoringRecords)
        .where(eq(geoInclusionMonitoringRecords.projectId, projectId)),
      db
        .select({
          roundType: testRounds.roundType,
          status: testRounds.status,
          finishedAt: testRounds.finishedAt,
          roundName: testRounds.roundName,
          id: testRounds.id,
          createdAt: testRounds.createdAt,
        })
        .from(testRounds)
        .where(eq(testRounds.projectId, projectId)),
      resolveLatestT0AiTestRunMetrics(db, projectId),
      resolveT0ContentGapSuggestions(db, projectId),
    ]);

  const aiAggregate = aggregateAiTestEvidence(
    monitoringRows.map((r, index) => ({
      monitoringRecordId: index + 1,
      results: Array.isArray(r.aiTestResults) ? r.aiTestResults : [],
    })),
  );

  const report = buildWeeklyGrowthReportFromMetrics({
    enterpriseName,
    now,
    publishRecords,
    articles: articleRows,
    monitoringRows,
    testRounds: testRoundRows as unknown as TestRoundSummary[],
    t0MentionRate: t0Metrics?.mentionRate ?? null,
    t0RecommendRate: t0Metrics?.recommendRate ?? null,
    monitoringMentionRate: aiAggregate.questionCount > 0 ? aiAggregate.mentionRate : null,
    monitoringRecommendRate: aiAggregate.questionCount > 0 ? aiAggregate.recommendRate : null,
    contentGapLine: gapSuggestions?.headline ?? null,
  });

  await createSystemNotification(db, {
    userId: ownerUserId,
    projectId,
    type: "weekly_growth_report",
    title: report.title,
    content: report.content,
  });

  return "created";
}

export async function runWeeklyGrowthReport(now: Date = new Date()) {
  const db = await getDb();
  if (!db) {
    console.error("[增长周报] 数据库不可用，跳过");
    return { created: 0, skipped: 0, projects: 0 };
  }

  const activeProjects = await db
    .select({
      id: projects.id,
      ownerUserId: projects.ownerUserId,
      enterpriseName: projects.enterpriseName,
    })
    .from(projects)
    .where(isNull(projects.archivedAt));

  let created = 0;
  let skipped = 0;

  for (const project of activeProjects) {
    if (!project.ownerUserId) continue;
    try {
      const result = await emitWeeklyGrowthReportForProject(
        db,
        project.id,
        project.ownerUserId,
        project.enterpriseName,
        now,
      );
      if (result === "created") created += 1;
      else skipped += 1;
    } catch (error) {
      console.error(`[增长周报] 项目 ${project.id} 生成失败:`, error);
    }
  }

  console.log(
    `[增长周报] 完成 ${now.toISOString()}：项目 ${activeProjects.length}，新建 ${created}，跳过 ${skipped}`,
  );

  return { created, skipped, projects: activeProjects.length };
}
