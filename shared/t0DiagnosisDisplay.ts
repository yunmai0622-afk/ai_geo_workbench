import { countEnabledQuestionsForT0 } from "./aiDiagnosisManualT0Gate";
import { aggregateT0AiTestRunMetrics, type AiTestRunMetricRow } from "./t0AiTestRunMetrics";

export const T0_DEFAULT_PLATFORMS = ["doubao", "deepseek", "kimi"] as const;

/** AI 实测诊断页可选引擎（AI 现状检测 / 平台多选） */
export const T0_AI_ENGINE_OPTIONS = [
  { id: "doubao", label: "豆包" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "kimi", label: "Kimi" },
  { id: "qwen", label: "通义千问" },
  { id: "wenxin", label: "文心一言" },
] as const;

export type T0AiEngineId = (typeof T0_AI_ENGINE_OPTIONS)[number]["id"];

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

export type T0DiagnosisRunRow = AiTestRunMetricRow & {
  questionId: number;
  platform?: string;
  competitorMentioned?: boolean;
  competitorNames?: string[];
};

export type T0QuestionTypeGroup = {
  questionType: string;
  label: string;
  totalRuns: number;
  mentionedCount: number;
  recommendedCount: number;
  mentionRate: number;
  recommendRate: number;
  competitorAppearances: number;
};

export type T0DiagnosisResultsDisplay = {
  totalRuns: number;
  mentionedCount: number;
  recommendedCount: number;
  mentionRate: number;
  recommendRate: number;
  competitorAppearances: number;
  competitorNames: string[];
  byQuestionType: T0QuestionTypeGroup[];
  byPlatform: T0PlatformResultGroup[];
};

export const T0_DIAGNOSIS_PLATFORM_ORDER = ["doubao", "kimi", "deepseek", "qwen", "wenxin"] as const;

export type T0PlatformResultGroup = {
  platform: string;
  label: string;
  totalRuns: number;
  mentionedCount: number;
  recommendedCount: number;
  mentionRate: number;
  recommendRate: number;
};

export function normalizeT0Platform(platform: string): string {
  const key = platform.trim().toLowerCase();
  if (key === "doubao" || key === "豆包") return "doubao";
  if (key === "kimi") return "kimi";
  if (key === "deepseek") return "deepseek";
  if (key === "qwen" || key === "通义千问" || key === "通义") return "qwen";
  if (key === "wenxin" || key === "文心一言" || key === "文心") return "wenxin";
  return key;
}

export function buildT0PlatformResultGroups(
  runs: Array<{
    platform: string;
    mentionedCompany: boolean;
    recommendedCompany: boolean;
  }>,
): T0PlatformResultGroup[] {
  const labelByPlatform = new Map(T0_AI_ENGINE_OPTIONS.map(option => [option.id, option.label]));
  const buckets = new Map<string, typeof runs>();
  for (const run of runs) {
    const platform = normalizeT0Platform(run.platform);
    const bucket = buckets.get(platform) ?? [];
    bucket.push(run);
    buckets.set(platform, bucket);
  }

  return T0_DIAGNOSIS_PLATFORM_ORDER.map(platform => {
    const groupRuns = buckets.get(platform) ?? [];
    const metrics = aggregateT0AiTestRunMetrics(groupRuns);
    return {
      platform,
      label: labelByPlatform.get(platform as T0AiEngineId) ?? platform,
      totalRuns: metrics?.totalRuns ?? 0,
      mentionedCount: metrics?.mentionedCount ?? 0,
      recommendedCount: metrics?.recommendedCount ?? 0,
      mentionRate: metrics?.mentionRate ?? 0,
      recommendRate: metrics?.recommendRate ?? 0,
    };
  });
}

export type T0QuestionProgress = {
  currentQuestion: number;
  totalQuestions: number;
};

/** 诊断页与问题池统一口径：当前启用且纳入实测的问题数（不用轮次快照 questionsCount，避免禁用后数字不一致） */
export function resolveT0ActiveQuestionCount(
  questions: Array<{ enabled?: number | boolean | null }>,
): number {
  return countEnabledQuestionsForT0(questions);
}

function resolveQuestionTypeLabel(questionType: string): string {
  return QUESTION_TYPE_CUSTOMER_LABELS[questionType] ?? `${questionType}类问题`;
}

export function formatT0Rate(rate: number): string {
  if (!Number.isFinite(rate)) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function computeT0QuestionProgress(
  runs: Array<{ questionId: number }>,
  totalQuestions: number,
  expectedRunsPerQuestion: number,
): T0QuestionProgress {
  const safeTotal = Math.max(1, totalQuestions);
  if (runs.length === 0) {
    return { currentQuestion: 1, totalQuestions: safeTotal };
  }

  const runsByQuestion = new Map<number, number>();
  for (const run of runs) {
    runsByQuestion.set(run.questionId, (runsByQuestion.get(run.questionId) ?? 0) + 1);
  }

  let completedQuestions = 0;
  let partialQuestions = 0;
  for (const count of Array.from(runsByQuestion.values())) {
    if (count >= expectedRunsPerQuestion) {
      completedQuestions += 1;
    } else if (count > 0) {
      partialQuestions += 1;
    }
  }

  const currentQuestion =
    partialQuestions > 0 || completedQuestions < safeTotal
      ? Math.min(safeTotal, completedQuestions + 1)
      : safeTotal;

  return {
    currentQuestion: Math.max(1, currentQuestion),
    totalQuestions: safeTotal,
  };
}

export function buildT0DiagnosisResultsDisplay(
  runs: T0DiagnosisRunRow[],
  questionTypeByQuestionId: Map<number, string>,
): T0DiagnosisResultsDisplay | null {
  const overall = aggregateT0AiTestRunMetrics(runs);
  if (!overall) return null;

  const competitorNameCounts = new Map<string, number>();
  let competitorAppearances = 0;
  for (const run of runs) {
    if (run.competitorMentioned) {
      competitorAppearances += 1;
    }
    for (const name of run.competitorNames ?? []) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      competitorNameCounts.set(trimmed, (competitorNameCounts.get(trimmed) ?? 0) + 1);
    }
  }

  const competitorNames = Array.from(competitorNameCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
    .slice(0, 8)
    .map(([name]) => name);

  const groupMap = new Map<string, T0DiagnosisRunRow[]>();
  for (const run of runs) {
    const questionType = questionTypeByQuestionId.get(run.questionId) ?? "未分类";
    const bucket = groupMap.get(questionType) ?? [];
    bucket.push(run);
    groupMap.set(questionType, bucket);
  }

  const byQuestionType = Array.from(groupMap.entries())
    .map(([questionType, groupRuns]) => {
      const metrics = aggregateT0AiTestRunMetrics(groupRuns)!;
      const groupCompetitorAppearances = groupRuns.filter((run: T0DiagnosisRunRow) => run.competitorMentioned).length;
      return {
        questionType,
        label: resolveQuestionTypeLabel(questionType),
        totalRuns: metrics.totalRuns,
        mentionedCount: metrics.mentionedCount,
        recommendedCount: metrics.recommendedCount,
        mentionRate: metrics.mentionRate,
        recommendRate: metrics.recommendRate,
        competitorAppearances: groupCompetitorAppearances,
      };
    })
    .sort((a, b) => b.totalRuns - a.totalRuns || a.label.localeCompare(b.label, "zh-CN"));

  const byPlatform = buildT0PlatformResultGroups(
    runs.map(run => ({
      platform: run.platform ?? "",
      mentionedCompany: run.mentionedCompany,
      recommendedCompany: run.recommendedCompany,
    })),
  );

  return {
    ...overall,
    competitorAppearances,
    competitorNames,
    byQuestionType,
    byPlatform,
  };
}
