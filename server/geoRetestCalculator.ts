import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import {
  aiTestRuns,
  questions,
  retestComparisons,
  testRounds,
  type InsertRetestComparison,
  type RetestComparison,
} from "../drizzle/schema";
import { getDb } from "./db";
import { getAiEngineDisplayName, normalizePlatformToAiEngine } from "./geoAiMentionCheck";

function isCompareRetestRound(roundType: string): boolean {
  return roundType === "T1_RETEST" || roundType === "T2_RETEST" || roundType === "T3_RETEST";
}

type ChangeDirection = InsertRetestComparison["changeDirection"];
type ConfidenceLevel = InsertRetestComparison["confidenceLevel"];

type GroupKey = `${string}\0${string}`;

type GroupStats = {
  questionType: string;
  platform: string;
  baseMentionCount: number;
  compareMentionCount: number;
  baseRecommendCount: number;
  compareRecommendCount: number;
  baseCompetitorCount: number;
  compareCompetitorCount: number;
  baseRunCount: number;
  compareRunCount: number;
};

const QUESTION_TYPE_CUSTOMER_LABELS: Record<string, string> = {
  品牌认知: "品牌识别类问题",
  行业推荐: "行业推荐类问题",
  竞品对比: "竞品对比类问题",
  痛点解决: "痛点解决类问题",
  价格选型: "价格选型类问题",
  高意向成交: "高意向成交类问题",
  指定问题: "指定测试问题",
  scenario_need: "场景需求类问题",
  long_tail_conversion: "长尾转化类问题",
};

function toGroupKey(questionType: string, platform: string): GroupKey {
  return `${questionType}\0${platform}`;
}

function resolveQuestionTypeLabel(questionType: string): string {
  return QUESTION_TYPE_CUSTOMER_LABELS[questionType] ?? `${questionType}类问题`;
}

function resolvePlatformLabel(platform: string): string {
  const engine = normalizePlatformToAiEngine(platform);
  return engine ? getAiEngineDisplayName(engine) : platform;
}

export function resolveChangeDirection(
  baseMentionCount: number,
  compareMentionCount: number,
): ChangeDirection {
  if (baseMentionCount < 3 || compareMentionCount < 3) {
    return "unknown";
  }
  if (compareMentionCount > baseMentionCount) return "up";
  if (compareMentionCount < baseMentionCount) return "down";
  return "flat";
}

export function resolveConfidenceLevel(
  baseRunCount: number,
  compareRunCount: number,
  changeDirection: ChangeDirection,
): ConfidenceLevel {
  const testCount = Math.min(baseRunCount, compareRunCount);
  if (testCount >= 15) return "high";
  if (testCount >= 9 && changeDirection !== "unknown") return "medium";
  return "observe_more";
}

export function buildSystemConclusion(input: {
  questionType: string;
  platform: string;
  baseMentionCount: number;
  compareMentionCount: number;
  changeDirection: ChangeDirection;
}): string {
  const questionLabel = resolveQuestionTypeLabel(input.questionType);
  const platformLabel = resolvePlatformLabel(input.platform);
  const { baseMentionCount, compareMentionCount, changeDirection } = input;

  if (changeDirection === "unknown") {
    return `在${platformLabel}，${questionLabel}当前提及样本偏少（基线 ${baseMentionCount} 次、复测 ${compareMentionCount} 次），暂无法判断频次趋势，建议补足同条件测试后继续复测。`;
  }

  if (changeDirection === "flat") {
    return `在${platformLabel}，${questionLabel}出现频次维持在 ${baseMentionCount} 次，建议继续复测确认趋势。`;
  }

  if (changeDirection === "up") {
    return `在${platformLabel}，${questionLabel}出现频次从 ${baseMentionCount} 次上升至 ${compareMentionCount} 次，建议继续复测确认趋势。`;
  }

  return `在${platformLabel}，${questionLabel}出现频次从 ${baseMentionCount} 次下降至 ${compareMentionCount} 次，建议继续复测确认趋势。`;
}

function emptyGroup(questionType: string, platform: string): GroupStats {
  return {
    questionType,
    platform,
    baseMentionCount: 0,
    compareMentionCount: 0,
    baseRecommendCount: 0,
    compareRecommendCount: 0,
    baseCompetitorCount: 0,
    compareCompetitorCount: 0,
    baseRunCount: 0,
    compareRunCount: 0,
  };
}

function mergeGroupStats(
  groups: Map<GroupKey, GroupStats>,
  questionType: string,
  platform: string,
  side: "base" | "compare",
  run: {
    mentionedCompany: boolean;
    recommendedCompany: boolean;
    competitorMentioned: boolean;
  },
): void {
  const key = toGroupKey(questionType, platform);
  const group = groups.get(key) ?? emptyGroup(questionType, platform);

  if (side === "base") {
    group.baseRunCount += 1;
    if (run.mentionedCompany) group.baseMentionCount += 1;
    if (run.recommendedCompany) group.baseRecommendCount += 1;
    if (run.competitorMentioned) group.baseCompetitorCount += 1;
  } else {
    group.compareRunCount += 1;
    if (run.mentionedCompany) group.compareMentionCount += 1;
    if (run.recommendedCompany) group.compareRecommendCount += 1;
    if (run.competitorMentioned) group.compareCompetitorCount += 1;
  }

  groups.set(key, group);
}

/**
 * 基于 T0 与 T1–T3 实测记录聚合对比，并写入 retest_comparisons。
 */
export async function calculateRetestComparison(
  baseRoundId: string,
  compareRoundId: string,
  projectId: number,
): Promise<RetestComparison[]> {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
  }

  const roundRows = await db
    .select()
    .from(testRounds)
    .where(inArray(testRounds.id, [baseRoundId, compareRoundId]));

  const baseRound = roundRows.find(r => r.id === baseRoundId);
  const compareRound = roundRows.find(r => r.id === compareRoundId);

  if (!baseRound || !compareRound) {
    throw new TRPCError({ code: "NOT_FOUND", message: "对比轮次不存在" });
  }
  if (baseRound.projectId !== projectId || compareRound.projectId !== projectId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "对比轮次不属于当前项目" });
  }
  if (baseRound.roundType !== "T0_BASELINE") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "基线轮次须为 T0 基线检测" });
  }
  if (!isCompareRetestRound(compareRound.roundType)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "对比轮次须为 T1/T2/T3 复测" });
  }

  const [baseRuns, compareRuns] = await Promise.all([
    db
      .select()
      .from(aiTestRuns)
      .where(and(eq(aiTestRuns.roundId, baseRoundId), eq(aiTestRuns.projectId, projectId))),
    db
      .select()
      .from(aiTestRuns)
      .where(and(eq(aiTestRuns.roundId, compareRoundId), eq(aiTestRuns.projectId, projectId))),
  ]);

  const questionIds = Array.from(new Set([...baseRuns, ...compareRuns].map(r => r.questionId)));
  const questionTypeById = new Map<number, string>();
  if (questionIds.length > 0) {
    const questionRows = await db
      .select({ id: questions.id, questionType: questions.questionType })
      .from(questions)
      .where(and(eq(questions.projectId, projectId), inArray(questions.id, questionIds)));
    for (const row of questionRows) {
      questionTypeById.set(row.id, row.questionType);
    }
  }

  const groups = new Map<GroupKey, GroupStats>();

  for (const run of baseRuns) {
    const questionType = questionTypeById.get(run.questionId) ?? "未分类";
    mergeGroupStats(groups, questionType, run.platform, "base", run);
  }
  for (const run of compareRuns) {
    const questionType = questionTypeById.get(run.questionId) ?? "未分类";
    mergeGroupStats(groups, questionType, run.platform, "compare", run);
  }

  if (groups.size === 0) {
    return [];
  }

  const rowsToInsert: InsertRetestComparison[] = [];
  for (const group of Array.from(groups.values())) {
    const changeDirection = resolveChangeDirection(group.baseMentionCount, group.compareMentionCount);
    const confidenceLevel = resolveConfidenceLevel(
      group.baseRunCount,
      group.compareRunCount,
      changeDirection,
    );
    rowsToInsert.push({
      id: randomUUID(),
      projectId,
      baseRoundId,
      compareRoundId,
      questionType: group.questionType,
      platform: group.platform,
      baseMentionCount: group.baseMentionCount,
      compareMentionCount: group.compareMentionCount,
      baseRecommendCount: group.baseRecommendCount,
      compareRecommendCount: group.compareRecommendCount,
      baseCompetitorCount: group.baseCompetitorCount,
      compareCompetitorCount: group.compareCompetitorCount,
      changeDirection,
      systemConclusion: buildSystemConclusion({
        questionType: group.questionType,
        platform: group.platform,
        baseMentionCount: group.baseMentionCount,
        compareMentionCount: group.compareMentionCount,
        changeDirection,
      }),
      confidenceLevel,
    });
  }

  await db
    .delete(retestComparisons)
    .where(
      and(
        eq(retestComparisons.projectId, projectId),
        eq(retestComparisons.baseRoundId, baseRoundId),
        eq(retestComparisons.compareRoundId, compareRoundId),
      ),
    );

  await db.insert(retestComparisons).values(rowsToInsert);

  return db
    .select()
    .from(retestComparisons)
    .where(
      and(
        eq(retestComparisons.projectId, projectId),
        eq(retestComparisons.baseRoundId, baseRoundId),
        eq(retestComparisons.compareRoundId, compareRoundId),
      ),
    );
}
