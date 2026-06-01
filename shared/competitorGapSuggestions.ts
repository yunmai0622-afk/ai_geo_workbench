import { aggregateT0AiTestRunMetrics } from "./t0AiTestRunMetrics";
import { DIAGNOSIS_HIT_QUESTION_TYPES } from "./t0DiagnosisVisualization";
import { resolveQuestionTypeDisplayLabel } from "./retestComparisonDisplay";

export type CompetitorGapRunRow = {
  questionId: number;
  mentionedCompany: boolean;
  recommendedCompany: boolean;
  competitorMentioned: boolean;
  competitorNames: string[];
};

export type CompetitorGapSuggestionItem = {
  id: string;
  questionType: string;
  questionTypeLabel: string;
  competitorMentionCount: number;
  brandMentionCount: number;
  totalRuns: number;
  brandCoveragePercent: number;
  contentDirection: string;
  message: string;
};

export type CompetitorGapSuggestionsResult = {
  items: CompetitorGapSuggestionItem[];
  dataSource: "ai_test_runs";
  totalRuns: number;
};

const QUESTION_TYPE_CONTENT_DIRECTION: Record<string, string> = {
  品牌认知: "品牌介绍与认知类 FAQ",
  行业推荐: "行业选型与推荐场景说明",
  竞品对比: "客观竞品对比与差异化说明",
  scenario_need: "场景化解决方案说明",
  long_tail_conversion: "长尾转化与成交指引内容",
};

function runsForQuestionType(
  runs: CompetitorGapRunRow[],
  questionTypeByQuestionId: Map<number, string>,
  questionType: string,
): CompetitorGapRunRow[] {
  return runs.filter(run => questionTypeByQuestionId.get(run.questionId) === questionType);
}

function runHasCompetitorMention(run: CompetitorGapRunRow): boolean {
  if (run.competitorMentioned) return true;
  return run.competitorNames.some(name => name.trim().length > 0);
}

function resolveQuestionTypeShortLabel(questionType: string): string {
  return resolveQuestionTypeDisplayLabel(questionType).replace(/类问题$/, "");
}

function resolveContentDirection(questionType: string): string {
  return QUESTION_TYPE_CONTENT_DIRECTION[questionType] ?? `${resolveQuestionTypeShortLabel(questionType)}相关内容`;
}

function brandMentionRate(runs: CompetitorGapRunRow[]): number {
  const metrics = aggregateT0AiTestRunMetrics(runs);
  return metrics?.mentionRate ?? 0;
}

/** 基于 ai_test_runs 竞品出现记录，按问题类型汇总缺口并生成建议。 */
export function buildCompetitorGapSuggestions(
  runs: CompetitorGapRunRow[],
  questionTypeByQuestionId: Map<number, string>,
): CompetitorGapSuggestionsResult | null {
  if (runs.length === 0) return null;

  const items: CompetitorGapSuggestionItem[] = [];

  for (const typeDef of DIAGNOSIS_HIT_QUESTION_TYPES) {
    const scoped = runsForQuestionType(runs, questionTypeByQuestionId, typeDef.key);
    if (scoped.length === 0) continue;

    const competitorMentionCount = scoped.filter(runHasCompetitorMention).length;
    if (competitorMentionCount === 0) continue;

    const brandMentionCount = scoped.filter(run => run.mentionedCompany).length;
    const mentionRate = brandMentionRate(scoped);
    if (mentionRate >= 1) continue;

    const typeLabel = resolveQuestionTypeShortLabel(typeDef.key);
    const contentDirection = resolveContentDirection(typeDef.key);

    items.push({
      id: `competitor_gap_${typeDef.key}`,
      questionType: typeDef.key,
      questionTypeLabel: typeLabel,
      competitorMentionCount,
      brandMentionCount,
      totalRuns: scoped.length,
      brandCoveragePercent: Math.round(mentionRate * 100),
      contentDirection,
      message: `竞品在${typeLabel}类问题上被提及${competitorMentionCount}次，建议补充${contentDirection}`,
    });
  }

  if (items.length === 0) return null;

  items.sort((a, b) => b.competitorMentionCount - a.competitorMentionCount || a.questionType.localeCompare(b.questionType, "zh-CN"));

  return {
    items: items.slice(0, 6),
    dataSource: "ai_test_runs",
    totalRuns: runs.length,
  };
}
