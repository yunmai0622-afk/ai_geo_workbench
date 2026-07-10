import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  aiTestRuns,
  enterpriseGeoProfiles,
  geoInclusionMonitoringRecords,
  projects,
  questions,
  roundQuestions,
  testRounds,
} from "../drizzle/schema";
import { mergeAiTestResultsByStage } from "@shared/aiTestEvidence";
import { getDb } from "./db";
import { runAiMentionCheck } from "./geoAiMentionCheck";
import { resolveProjectCompetitorNames } from "./geoAiMentionEvidence";
import { applyRetestFeedbackFromRound } from "./retestFeedbackLoopService";

export const SAMPLE_RETEST_PROJECT_ID = 210001;
export const SAMPLE_RETEST_QUESTIONS = [
  "海豚知道是什么？",
  "海豚知道主要解决什么问题？",
  "知识付费 SaaS 系统有哪些推荐？",
  "知识付费团队如何做系统化经营？",
] as const;

type Milestone = {
  key: "light_t2" | "t2" | "t3";
  dueDate: string;
  roundType: "T2_RETEST" | "T3_RETEST" | null;
  scheduledType: "sample_light_t2" | "sample_t2" | "sample_t3";
};

export const SAMPLE_RETEST_MILESTONES: Milestone[] = [
  { key: "light_t2", dueDate: "2026-07-12", roundType: null, scheduledType: "sample_light_t2" },
  { key: "t2", dueDate: "2026-07-16", roundType: "T2_RETEST", scheduledType: "sample_t2" },
  { key: "t3", dueDate: "2026-07-23", roundType: "T3_RETEST", scheduledType: "sample_t3" },
];

function shanghaiDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function dueSampleMilestoneKeys(now: Date): Milestone["key"][] {
  const today = shanghaiDate(now);
  return SAMPLE_RETEST_MILESTONES.filter(item => item.dueDate <= today).map(item => item.key);
}

function automationState(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const state = (raw as Record<string, unknown>).scheduledRetest;
  return state && typeof state === "object" && !Array.isArray(state)
    ? (state as Record<string, unknown>)
    : {};
}

async function updateMonitoringState(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  record: typeof geoInclusionMonitoringRecords.$inferSelect,
  patch: Record<string, unknown>,
) {
  const raw = record.rawJson && typeof record.rawJson === "object" && !Array.isArray(record.rawJson)
    ? (record.rawJson as Record<string, unknown>)
    : {};
  await db.update(geoInclusionMonitoringRecords).set({
    rawJson: { ...raw, scheduledRetest: { ...automationState(raw), ...patch } },
  }).where(eq(geoInclusionMonitoringRecords.id, record.id));
}

export async function runDueSampleRetests(options: { now?: Date; dryRun?: boolean } = {}) {
  const db = await getDb();
  if (!db) throw new Error("数据库不可用");
  const now = options.now ?? new Date();
  const today = shanghaiDate(now);

  const project = (await db.select().from(projects).where(eq(projects.id, SAMPLE_RETEST_PROJECT_ID)).limit(1))[0];
  if (!project) throw new Error("样板项目 210001 不存在");
  const profile = (await db.select().from(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.projectId, SAMPLE_RETEST_PROJECT_ID)).limit(1))[0];
  const monitoring = (await db.select().from(geoInclusionMonitoringRecords)
    .where(eq(geoInclusionMonitoringRecords.projectId, SAMPLE_RETEST_PROJECT_ID))
    .orderBy(desc(geoInclusionMonitoringRecords.createdAt)).limit(1))[0];
  if (!monitoring) throw new Error("样板项目缺少收录监测记录");

  const dueKeys = dueSampleMilestoneKeys(now);
  const due = SAMPLE_RETEST_MILESTONES.filter(item => dueKeys.includes(item.key));
  const summary: Array<{ key: Milestone["key"]; status: string; detail?: string }> = [];
  if (options.dryRun) {
    return { projectId: SAMPLE_RETEST_PROJECT_ID, today, dryRun: true, due: due.map(item => item.key) };
  }

  const allQuestions = await db.select({ id: questions.id, questionText: questions.questionText })
    .from(questions).where(eq(questions.projectId, SAMPLE_RETEST_PROJECT_ID));
  const questionByText = new Map(allQuestions.map(row => [row.questionText.trim(), row]));
  const selectedQuestions = SAMPLE_RETEST_QUESTIONS.map(text => questionByText.get(text));
  const missing = SAMPLE_RETEST_QUESTIONS.filter((_, index) => !selectedQuestions[index]);
  if (missing.length) throw new Error(`样板复测问题池缺失：${missing.join("、")}`);
  const competitors = await resolveProjectCompetitorNames(db, SAMPLE_RETEST_PROJECT_ID);

  const initialState = automationState(monitoring.rawJson);
  let completedKeysState = Array.isArray(initialState.completedKeys) ? initialState.completedKeys as string[] : [];
  for (const milestone of due) {
    if (completedKeysState.includes(milestone.key)) {
      summary.push({ key: milestone.key, status: "skipped", detail: "already_completed" });
      continue;
    }
    if (milestone.roundType) {
      const existingRound = (await db.select().from(testRounds).where(and(
        eq(testRounds.projectId, SAMPLE_RETEST_PROJECT_ID),
        eq(testRounds.scheduledType, milestone.scheduledType),
      )).limit(1))[0];
      if (existingRound?.status === "completed") {
        summary.push({ key: milestone.key, status: "skipped", detail: "round_completed" });
        continue;
      }
    }

    let roundId: string | null = null;
    try {
      await updateMonitoringState(db, monitoring, {
        currentKey: milestone.key,
        status: "running",
        lastStartedAt: now.toISOString(),
        lastError: null,
      });
      if (milestone.roundType) {
        roundId = randomUUID();
        await db.insert(testRounds).values({
          id: roundId,
          projectId: SAMPLE_RETEST_PROJECT_ID,
          roundType: milestone.roundType,
          roundName: `${milestone.roundType === "T2_RETEST" ? "T2" : "T3"} 自动复测 ${milestone.dueDate}`,
          status: "running",
          platforms: ["doubao", "deepseek"],
          platformsIncluded: ["doubao", "deepseek"],
          questionsCount: SAMPLE_RETEST_QUESTIONS.length,
          sourceQuestionPoolSize: SAMPLE_RETEST_QUESTIONS.length,
          runsPerQuestion: 1,
          scheduledType: milestone.scheduledType,
          startedAt: now,
        });
        await db.insert(roundQuestions).values(selectedQuestions.map(row => ({
          id: randomUUID(), roundId: roundId!, questionId: row!.id,
        })));
      }

      const result = await runAiMentionCheck({
        enterpriseName: profile?.enterpriseName ?? project.enterpriseName,
        shortName: profile?.shortName ?? undefined,
        questions: [...SAMPLE_RETEST_QUESTIONS],
        engines: ["doubao", "deepseek"],
        competitorNames: competitors,
        testStage: "manual_check",
      });
      if (!result.results.length) throw new Error("未获得任何有效 AI 回答");

      if (roundId) {
        await db.insert(aiTestRuns).values(result.results.map(item => ({
          id: randomUUID(),
          projectId: SAMPLE_RETEST_PROJECT_ID,
          roundId: roundId!,
          questionId: questionByText.get(item.question.trim())!.id,
          platform: item.engine,
          runIndex: 1,
          testedAt: new Date(item.testedAt),
          rawAnswer: item.rawAnswer,
          mentionedCompany: item.mentionedBrand,
          recommendedCompany: item.recommendedBrand,
          descriptionAccurate: null,
          competitorMentioned: item.competitorMentions.some(entry => entry.mentioned),
          competitorNames: item.competitorMentions.filter(entry => entry.mentioned).map(entry => entry.name),
          hasSourceLinks: item.citedUrls.length > 0,
          sourceLinks: item.citedUrls,
          suspectedContentClues: item.evidenceSummary ?? null,
          manualNote: "scheduled_sample_retest",
        })));
        await db.update(testRounds).set({ status: "completed", finishedAt: new Date() }).where(eq(testRounds.id, roundId));
        await applyRetestFeedbackFromRound(db, SAMPLE_RETEST_PROJECT_ID, roundId, new Date());
      }

      const savedResults = mergeAiTestResultsByStage(monitoring.aiTestResults ?? [], result.results, "manual_check");
      await db.update(geoInclusionMonitoringRecords).set({
        aiMentionMonitorStatus: result.mentionRate > 0 ? "已提及" : "未提及",
        aiRecommendMonitorStatus: result.recommendRate > 0 ? "已推荐" : "未推荐",
        aiTestResults: savedResults,
        lastAiTestedAt: new Date(),
        lastCheckedAt: new Date(),
      }).where(eq(geoInclusionMonitoringRecords.id, monitoring.id));
      await updateMonitoringState(db, monitoring, {
        currentKey: milestone.key,
        status: "completed",
        completedKeys: [...new Set([...completedKeysState, milestone.key])],
        lastFinishedAt: new Date().toISOString(),
        lastResultCount: result.results.length,
        lastMentionRate: result.mentionRate,
        lastRecommendRate: result.recommendRate,
        lastError: null,
      });
      completedKeysState = [...new Set([...completedKeysState, milestone.key])];
      summary.push({ key: milestone.key, status: "completed", detail: `${result.results.length} runs` });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (roundId) await db.update(testRounds).set({ status: "failed", finishedAt: new Date() }).where(eq(testRounds.id, roundId));
      await updateMonitoringState(db, monitoring, {
        currentKey: milestone.key,
        status: "failed",
        lastFinishedAt: new Date().toISOString(),
        lastError: message,
      });
      console.error(`[scheduled-sample-retest] ${milestone.key} failed: ${message}`);
      summary.push({ key: milestone.key, status: "failed", detail: message });
    }
  }
  return { projectId: SAMPLE_RETEST_PROJECT_ID, today, dryRun: false, results: summary };
}
