import { aggregateT0AiTestRunMetrics, type AiTestRunMetricRow } from "./t0AiTestRunMetrics";

export const T0_DEFAULT_PLATFORMS = ["doubao", "deepseek", "kimi"] as const;

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
};

export type T0QuestionProgress = {
  currentQuestion: number;
  totalQuestions: number;
};

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

  return {
    ...overall,
    competitorAppearances,
    competitorNames,
    byQuestionType,
  };
}
