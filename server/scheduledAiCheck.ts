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
  console.log(`[定时实测] 开始执行 ${new Date().toISOString()}`);
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

  console.log(`[定时实测] 找到 ${records.length} 条需要检测的记录`);

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
        console.log(`[定时实测] 项目 ${record.projectId} 无问题数据，跳过`);
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
        console.log(`[定时实测] 记录 ${record.id} 未获得 AI 回答，跳过`);
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

      console.log(`[定时实测] 记录 ${record.id} 完成：提及=${mentionStatus}`);

      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.error(`[定时实测] 记录 ${record.id} 失败:`, e);
    }
  }

  console.log(`[定时实测] 本次执行完成 ${new Date().toISOString()}`);
}

export function startDailyAiCheckScheduler() {
  setTimeout(() => {
    runDailyAiCheck();
    setInterval(runDailyAiCheck, 24 * 60 * 60 * 1000);
  }, 5 * 60 * 1000);

  console.log("[定时实测] 调度器已启动，将在 5 分钟后首次执行，之后每 24 小时执行一次");
}
