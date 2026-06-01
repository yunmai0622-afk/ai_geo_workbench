export type RetestComparisonRow = {
  id: string;
  projectId: number;
  baseRoundId: string;
  compareRoundId: string;
  questionType: string;
  platform: string;
  baseMentionCount: number;
  compareMentionCount: number;
  baseRecommendCount: number;
  compareRecommendCount: number;
  baseCompetitorCount: number;
  compareCompetitorCount: number;
  changeDirection: "up" | "flat" | "down" | "unknown";
  systemConclusion: string;
  confidenceLevel: string;
  createdAt?: Date | string | null;
};

export type TestRoundSummary = {
  id: string;
  roundType: string;
  roundName: string;
  status: string;
  platforms: string[];
  questionsCount: number;
  runsPerQuestion: number;
  finishedAt?: Date | string | null;
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

const PLATFORM_DISPLAY_LABELS: Record<string, string> = {
  doubao: "豆包",
  豆包: "豆包",
  deepseek: "DeepSeek",
  kimi: "Kimi",
};

export function resolveQuestionTypeDisplayLabel(questionType: string): string {
  return QUESTION_TYPE_CUSTOMER_LABELS[questionType] ?? `${questionType}类问题`;
}

export function resolvePlatformDisplayLabel(platform: string): string {
  const key = platform.trim().toLowerCase();
  return PLATFORM_DISPLAY_LABELS[key] ?? PLATFORM_DISPLAY_LABELS[platform] ?? platform;
}

export function changeDirectionSymbol(direction: RetestComparisonRow["changeDirection"]): string {
  if (direction === "up") return "↑";
  if (direction === "down") return "↓";
  if (direction === "flat") return "→";
  return "—";
}

export function isCompletedTestRound(round: TestRoundSummary): boolean {
  return round.status === "completed" || Boolean(round.finishedAt);
}

export function findLatestCompletedRound(
  rounds: TestRoundSummary[],
  roundType: string,
): TestRoundSummary | null {
  return rounds.find(round => round.roundType === roundType && isCompletedTestRound(round)) ?? null;
}

export function filterComparisonsForRoundPair(
  comparisons: RetestComparisonRow[],
  baseRoundId: string,
  compareRoundId: string,
): RetestComparisonRow[] {
  return comparisons.filter(
    row => row.baseRoundId === baseRoundId && row.compareRoundId === compareRoundId,
  );
}

export function resolveT0T1ComparisonRows(
  comparisons: RetestComparisonRow[],
  rounds: TestRoundSummary[],
): {
  baseRound: TestRoundSummary | null;
  compareRound: TestRoundSummary | null;
  rows: RetestComparisonRow[];
} {
  const baseRound = findLatestCompletedRound(rounds, "T0_BASELINE");
  const compareRound = findLatestCompletedRound(rounds, "T1_RETEST");

  if (!baseRound || !compareRound) {
    return { baseRound, compareRound, rows: [] };
  }

  const rows = filterComparisonsForRoundPair(comparisons, baseRound.id, compareRound.id);
  return { baseRound, compareRound, rows };
}

export type OverallChangeSummary = {
  mentionRateT0: number | null;
  mentionRateT1: number | null;
  mentionRateDelta: number | null;
  recommendRateT0: number | null;
  recommendRateT1: number | null;
  recommendRateDelta: number | null;
  competitorCountT0: number;
  competitorCountT1: number;
  competitorDelta: number;
};

function estimateTotalRuns(round: TestRoundSummary | null): number {
  if (!round) return 0;
  return round.questionsCount * round.runsPerQuestion * round.platforms.length;
}

function sumField(rows: RetestComparisonRow[], field: keyof RetestComparisonRow): number {
  return rows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0);
}

function formatRate(rate: number | null): string {
  if (rate == null || Number.isNaN(rate)) return "—";
  return `${Math.round(rate * 100)}%`;
}

function formatRateDelta(delta: number | null): string {
  if (delta == null || Number.isNaN(delta)) return "—";
  const pct = Math.round(delta * 100);
  if (pct > 0) return `↑ ${pct} 个百分点`;
  if (pct < 0) return `↓ ${Math.abs(pct)} 个百分点`;
  return "→ 持平";
}

export function buildOverallChangeSummary(
  rows: RetestComparisonRow[],
  baseRound: TestRoundSummary | null,
  compareRound: TestRoundSummary | null,
): OverallChangeSummary {
  const baseTotalRuns = estimateTotalRuns(baseRound);
  const compareTotalRuns = estimateTotalRuns(compareRound);

  const baseMentions = sumField(rows, "baseMentionCount");
  const compareMentions = sumField(rows, "compareMentionCount");
  const baseRecommends = sumField(rows, "baseRecommendCount");
  const compareRecommends = sumField(rows, "compareRecommendCount");
  const competitorT0 = sumField(rows, "baseCompetitorCount");
  const competitorT1 = sumField(rows, "compareCompetitorCount");

  const mentionRateT0 = baseTotalRuns > 0 ? baseMentions / baseTotalRuns : null;
  const mentionRateT1 = compareTotalRuns > 0 ? compareMentions / compareTotalRuns : null;
  const recommendRateT0 = baseTotalRuns > 0 ? baseRecommends / baseTotalRuns : null;
  const recommendRateT1 = compareTotalRuns > 0 ? compareRecommends / compareTotalRuns : null;

  return {
    mentionRateT0,
    mentionRateT1,
    mentionRateDelta:
      mentionRateT0 != null && mentionRateT1 != null ? mentionRateT1 - mentionRateT0 : null,
    recommendRateT0,
    recommendRateT1,
    recommendRateDelta:
      recommendRateT0 != null && recommendRateT1 != null ? recommendRateT1 - recommendRateT0 : null,
    competitorCountT0: competitorT0,
    competitorCountT1: competitorT1,
    competitorDelta: competitorT1 - competitorT0,
  };
}

export function formatOverallSummaryLines(summary: OverallChangeSummary): {
  mentionLine: string;
  recommendLine: string;
  competitorLine: string;
} {
  return {
    mentionLine: `品牌提及率：T0 ${formatRate(summary.mentionRateT0)} → T1 ${formatRate(summary.mentionRateT1)}（${formatRateDelta(summary.mentionRateDelta)}）`,
    recommendLine: `推荐率：T0 ${formatRate(summary.recommendRateT0)} → T1 ${formatRate(summary.recommendRateT1)}（${formatRateDelta(summary.recommendRateDelta)}）`,
    competitorLine: `竞品出现：T0 ${summary.competitorCountT0} 次 → T1 ${summary.competitorCountT1} 次${
      summary.competitorDelta > 0
        ? `（↑ ${summary.competitorDelta} 次）`
        : summary.competitorDelta < 0
          ? `（↓ ${Math.abs(summary.competitorDelta)} 次）`
          : "（→ 持平）"
    }`,
  };
}

export const RETEST_CONSERVATIVE_HINT =
  "当前结论基于指定问题集和测试平台，建议连续3轮复测后再做最终判断。";
