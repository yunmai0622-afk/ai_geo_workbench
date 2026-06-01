import { aggregateT0AiTestRunMetrics } from "./t0AiTestRunMetrics";
import { DIAGNOSIS_HIT_QUESTION_TYPES } from "./t0DiagnosisVisualization";

/** T0 完成后自动写入问题库的内容缺口标签（客户可读文案） */
export const T0_QUESTION_GAP_TAGS = {
  highPriorityGap: "高优先级缺口",
  competitorSuppression: "竞品压制",
  lowRecommendRate: "推荐率不足",
} as const;

export type T0QuestionGapTagLabel = (typeof T0_QUESTION_GAP_TAGS)[keyof typeof T0_QUESTION_GAP_TAGS];

export const T0_QUESTION_GAP_TAG_DISPLAY_ORDER: T0QuestionGapTagLabel[] = [
  T0_QUESTION_GAP_TAGS.highPriorityGap,
  T0_QUESTION_GAP_TAGS.competitorSuppression,
  T0_QUESTION_GAP_TAGS.lowRecommendRate,
];

/** 推荐率低于该阈值时标注「推荐率不足」 */
export const T0_LOW_RECOMMEND_RATE_THRESHOLD = 0.2;

export type T0QuestionGapTagRunRow = {
  questionId: number;
  mentionedCompany: boolean;
  recommendedCompany: boolean;
  competitorMentioned: boolean;
};

function questionTypesWithZeroMentionRate(
  runs: T0QuestionGapTagRunRow[],
  questionTypeByQuestionId: Map<number, string>,
): Set<string> {
  const zeroTypes = new Set<string>();
  for (const typeDef of DIAGNOSIS_HIT_QUESTION_TYPES) {
    const scoped = runs.filter(run => questionTypeByQuestionId.get(run.questionId) === typeDef.key);
    if (scoped.length === 0) continue;
    const metrics = aggregateT0AiTestRunMetrics(scoped);
    if (metrics && metrics.mentionRate === 0) {
      zeroTypes.add(typeDef.key);
    }
  }
  return zeroTypes;
}

function runsByQuestionId(runs: T0QuestionGapTagRunRow[]): Map<number, T0QuestionGapTagRunRow[]> {
  const map = new Map<number, T0QuestionGapTagRunRow[]>();
  for (const run of runs) {
    const bucket = map.get(run.questionId) ?? [];
    bucket.push(run);
    map.set(run.questionId, bucket);
  }
  return map;
}

function sortGapTags(tags: T0QuestionGapTagLabel[]): T0QuestionGapTagLabel[] {
  const order = new Map(T0_QUESTION_GAP_TAG_DISPLAY_ORDER.map((label, index) => [label, index]));
  return [...tags].sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
}

/** 基于单次 T0 轮次 ai_test_runs，为项目内各问题计算缺口标签。 */
export function buildT0QuestionGapTagsByQuestionId(
  runs: T0QuestionGapTagRunRow[],
  questionTypeByQuestionId: Map<number, string>,
  projectQuestionIds: number[],
): Map<number, T0QuestionGapTagLabel[]> {
  const result = new Map<number, T0QuestionGapTagLabel[]>();
  if (runs.length === 0 || projectQuestionIds.length === 0) return result;

  const zeroMentionTypes = questionTypesWithZeroMentionRate(runs, questionTypeByQuestionId);
  const groupedRuns = runsByQuestionId(runs);

  for (const questionId of projectQuestionIds) {
    const tags: T0QuestionGapTagLabel[] = [];
    const questionType = questionTypeByQuestionId.get(questionId);

    if (questionType && zeroMentionTypes.has(questionType)) {
      tags.push(T0_QUESTION_GAP_TAGS.highPriorityGap);
    }

    const scopedRuns = groupedRuns.get(questionId) ?? [];
    if (scopedRuns.length > 0) {
      if (scopedRuns.some(run => run.competitorMentioned && !run.mentionedCompany)) {
        tags.push(T0_QUESTION_GAP_TAGS.competitorSuppression);
      }
      const metrics = aggregateT0AiTestRunMetrics(scopedRuns);
      if (metrics && metrics.recommendRate < T0_LOW_RECOMMEND_RATE_THRESHOLD) {
        tags.push(T0_QUESTION_GAP_TAGS.lowRecommendRate);
      }
    }

    if (tags.length > 0) {
      result.set(questionId, sortGapTags(tags));
    }
  }

  return result;
}
