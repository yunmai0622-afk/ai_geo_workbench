/**
 * 每日定时 AI 可见度检测
 * 每天自动对所有「未检测」或「距上次检测超过 23 小时」的监测记录执行实测
 */
import { eq, isNull, lt, or } from "drizzle-orm";
import { enterpriseGeoProfiles, geoInclusionMonitoringRecords, projects, questions } from "../drizzle/schema";
import { getDb } from "./db";
import { mergeAiTestResultsByStage } from "@shared/aiTestEvidence";
import { runAiMentionCheck } from "./geoAiMentionCheck";
import { resolveProjectCompetitorNames } from "./geoAiMentionEvidence";

export async function runDailyAiCheck() {
  const db = await getDb();
  if (!db) {
    console.error("[定时实测] 数据库不可用，跳过");
    return;
  }

  const threshold = new Date(Date.now() - 23 * 60 * 60 * 1000);
  const records = await db
    .select()
    .from(geoInclusionMonitoringRecords)
    .where(
      or(
        eq(geoInclusionMonitoringRecords.aiMentionMonitorStatus, "未检测"),
        isNull(geoInclusionMonitoringRecords.lastAiTestedAt),
        lt(geoInclusionMonitoringRecords.lastAiTestedAt, threshold),
      ),
    )
    .limit(50);

  for (const record of records) {
    try {
      const projectRows = await db.select().from(projects).where(eq(projects.id, record.projectId)).limit(1);
      const project = projectRows[0];
      if (!project) continue;

      const profileRows = await db
        .select()
        .from(enterpriseGeoProfiles)
        .where(eq(enterpriseGeoProfiles.projectId, record.projectId))
        .limit(1);
      const profile = profileRows[0];

      const questionRows = await db
        .select({ questionText: questions.questionText })
        .from(questions)
        .where(eq(questions.projectId, record.projectId))
        .limit(5);

      if (questionRows.length === 0) {
        continue;
      }

      const competitorNames = await resolveProjectCompetitorNames(db, record.projectId);

      const result = await runAiMentionCheck({
        enterpriseName: profile?.enterpriseName ?? project.enterpriseName,
        shortName: profile?.shortName ?? undefined,
        questions: questionRows.map(q => q.questionText),
        engines: ["doubao", "deepseek"],
        competitorNames,
        testStage: "manual_check",
      });

      if (result.results.length === 0) {
        continue;
      }

      const mentionStatus = result.mentionRate > 0 ? "已提及" : "未提及";
      const recommendStatus = result.recommendRate > 0 ? "已推荐" : "未推荐";

      const savedResults = mergeAiTestResultsByStage(record.aiTestResults ?? [], result.results, "manual_check");

      await db
        .update(geoInclusionMonitoringRecords)
        .set({
          aiMentionMonitorStatus: mentionStatus,
          aiRecommendMonitorStatus: recommendStatus,
          aiTestResults: savedResults,
          lastAiTestedAt: new Date(),
          lastCheckedAt: new Date(),
        })
        .where(eq(geoInclusionMonitoringRecords.id, record.id));

      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.error(`[定时实测] 记录 ${record.id} 失败:`, e);
    }
  }
}

export function startDailyAiCheckScheduler() {
  setTimeout(() => {
    runDailyAiCheck();
    setInterval(runDailyAiCheck, 24 * 60 * 60 * 1000);
  }, 5 * 60 * 1000);
}
