import type { QuestionContentStatus } from "./questionBankIntentMap";
import type { AiTestRunSnapshot } from "./questionSearchPoolEnrichment";
import type { SearchPoolQuestionRow } from "./questionSearchPool";

export const QUESTION_OPPORTUNITY_LABELS = [
  "高价值",
  "竞品占位",
  "已覆盖",
  "待优化",
] as const;

export type QuestionOpportunityLabel = (typeof QUESTION_OPPORTUNITY_LABELS)[number];

export const COMPETITOR_OCCUPANCY_THRESHOLD = 0.5;

export type QuestionOpportunityOverview = {
  totalQuestions: number;
  coveredContentQuestions: number;
  competitorOccupiedQuestions: number;
  monthlyFocusQuestions: number;
};

export type QuestionOpportunityGroupStats = {
  total: number;
  competitorOccupiedCount: number;
  coveredCount: number;
};

export function computeQuestionCompetitorRates(
  runs: ReadonlyArray<Pick<AiTestRunSnapshot, "questionId" | "competitorMentioned">>,
): Map<number, number> {
  const buckets = new Map<number, { total: number; competitor: number }>();
  for (const run of runs) {
    const bucket = buckets.get(run.questionId) ?? { total: 0, competitor: 0 };
    bucket.total += 1;
    if (run.competitorMentioned) bucket.competitor += 1;
    buckets.set(run.questionId, bucket);
  }
  const rates = new Map<number, number>();
  for (const [questionId, stats] of buckets) {
    rates.set(questionId, stats.total > 0 ? stats.competitor / stats.total : 0);
  }
  return rates;
}

export function isCompetitorOccupiedQuestion(rate: number | undefined): boolean {
  return (rate ?? 0) > COMPETITOR_OCCUPANCY_THRESHOLD;
}

export function isQuestionContentPublished(contentStatus: QuestionContentStatus): boolean {
  return contentStatus === "已发布";
}

export function isQuestionContentPendingOptimization(contentStatus: QuestionContentStatus): boolean {
  return contentStatus === "已生成" || contentStatus === "待复测";
}

export function resolveQuestionOpportunityLabel(input: {
  enabled: boolean;
  competitorOccupied: boolean;
  contentPublished: boolean;
  hasContentPending: boolean;
}): QuestionOpportunityLabel | null {
  if (input.competitorOccupied) return "竞品占位";
  if (input.contentPublished) return "已覆盖";
  if (input.hasContentPending) return "待优化";
  if (input.enabled) return "高价值";
  return null;
}

export function buildQuestionOpportunityOverview(input: {
  questions: Array<{
    id: number;
    enabled: number | boolean | null;
    contentStatus: QuestionContentStatus;
    competitorOccupied: boolean;
    monthlyFocus: boolean;
  }>;
}): QuestionOpportunityOverview {
  let coveredContentQuestions = 0;
  let competitorOccupiedQuestions = 0;
  let monthlyFocusQuestions = 0;

  for (const question of input.questions) {
    if (isQuestionContentPublished(question.contentStatus)) coveredContentQuestions += 1;
    if (question.competitorOccupied) competitorOccupiedQuestions += 1;
    if (question.monthlyFocus) monthlyFocusQuestions += 1;
  }

  return {
    totalQuestions: input.questions.length,
    coveredContentQuestions,
    competitorOccupiedQuestions,
    monthlyFocusQuestions,
  };
}

export function buildQuestionOpportunityGroupStats(
  questions: Array<{
    searchPoolType?: string | null;
    competitorOccupied: boolean;
    contentStatus: QuestionContentStatus;
  }>,
  poolType: string,
): QuestionOpportunityGroupStats {
  const bucket = questions.filter(question => question.searchPoolType === poolType);
  return {
    total: bucket.length,
    competitorOccupiedCount: bucket.filter(question => question.competitorOccupied).length,
    coveredCount: bucket.filter(question => isQuestionContentPublished(question.contentStatus)).length,
  };
}

export function enrichQuestionOpportunityFields(input: {
  question: SearchPoolQuestionRow;
  contentStatus: QuestionContentStatus;
  hasContentTask: boolean;
  competitorRate: number | undefined;
  monthlyFocusQuestionIds: ReadonlySet<number>;
}): {
  competitorOccupied: boolean;
  contentPublished: boolean;
  hasContentPending: boolean;
  monthlyFocus: boolean;
  opportunityLabel: QuestionOpportunityLabel | null;
} {
  const competitorOccupied = isCompetitorOccupiedQuestion(input.competitorRate);
  const contentPublished = isQuestionContentPublished(input.contentStatus);
  const hasContentPending =
    input.hasContentTask && isQuestionContentPendingOptimization(input.contentStatus);
  const monthlyFocus = input.monthlyFocusQuestionIds.has(input.question.id);
  const enabled = Number(input.question.enabled) !== 0;
  const opportunityLabel = resolveQuestionOpportunityLabel({
    enabled,
    competitorOccupied,
    contentPublished,
    hasContentPending,
  });

  return {
    competitorOccupied,
    contentPublished,
    hasContentPending,
    monthlyFocus,
    opportunityLabel,
  };
}
