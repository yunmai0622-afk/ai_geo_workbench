import {
  buildOverallChangeSummary,
  filterComparisonsForRoundPair,
  findLatestCompletedRound,
  type RetestComparisonRow,
  type TestRoundSummary,
} from "./retestComparisonDisplay";

export const DELIVERY_REPORT_UNCERTAINTY_DISCLAIMER =
  "本报告不承诺单次优化必然带来推荐率提升，当前结论基于指定问题集、指定平台和指定测试轮次，建议结合连续复测判断长期趋势。";

export type DetectionScopeDisplay = {
  questionCount: string;
  platformCount: string;
  detectionRounds: string;
  hasData: boolean;
};

export type T0BaselineSummary = {
  hasData: boolean;
  roundName: string;
  finishedAtLabel: string;
  summaryLines: string[];
};

function formatCount(value: number | null | undefined): string {
  if (value == null || value <= 0) return "—";
  return String(value);
}

function formatFinishedAt(finishedAt: Date | string | null | undefined): string {
  if (!finishedAt) return "—";
  const date = finishedAt instanceof Date ? finishedAt : new Date(finishedAt);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function buildDetectionScopeDisplay(params: {
  baseRound: TestRoundSummary | null;
  compareRound: TestRoundSummary | null;
  fallbackQuestionCount?: number;
  fallbackPlatformCount?: number;
}): DetectionScopeDisplay {
  const { baseRound, compareRound, fallbackQuestionCount = 0, fallbackPlatformCount = 0 } = params;

  const questionCount =
    baseRound?.questionsCount && baseRound.questionsCount > 0
      ? baseRound.questionsCount
      : fallbackQuestionCount > 0
        ? fallbackQuestionCount
        : null;

  const platformSet = new Set<string>();
  for (const round of [baseRound, compareRound]) {
    if (!round) continue;
    for (const platform of round.platforms ?? []) {
      const trimmed = platform.trim();
      if (trimmed) platformSet.add(trimmed);
    }
  }
  const platformCount =
    platformSet.size > 0 ? platformSet.size : fallbackPlatformCount > 0 ? fallbackPlatformCount : null;

  const detectionRounds =
    baseRound?.runsPerQuestion && baseRound.runsPerQuestion > 0
      ? baseRound.runsPerQuestion
      : compareRound?.runsPerQuestion && compareRound.runsPerQuestion > 0
        ? compareRound.runsPerQuestion
        : null;

  const hasData = questionCount != null || platformCount != null || detectionRounds != null;

  return {
    questionCount: formatCount(questionCount),
    platformCount: formatCount(platformCount),
    detectionRounds: formatCount(detectionRounds),
    hasData,
  };
}

function formatRate(rate: number | null): string {
  if (rate == null || Number.isNaN(rate)) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function buildT0BaselineSummary(
  rounds: TestRoundSummary[],
  comparisons: RetestComparisonRow[],
): T0BaselineSummary {
  const baseRound = findLatestCompletedRound(rounds, "T0_BASELINE");
  if (!baseRound) {
    return { hasData: false, roundName: "—", finishedAtLabel: "—", summaryLines: [] };
  }

  const compareRound = findLatestCompletedRound(rounds, "T1_RETEST");
  const rows = compareRound
    ? filterComparisonsForRoundPair(comparisons, baseRound.id, compareRound.id)
    : [];

  const summary = buildOverallChangeSummary(rows, baseRound, compareRound);

  const summaryLines: string[] = [
    `检测问题 ${formatCount(baseRound.questionsCount)} 个，覆盖 ${formatCount(baseRound.platforms.length)} 个 AI 平台，每题检测 ${formatCount(baseRound.runsPerQuestion)} 轮`,
  ];

  if (rows.length > 0) {
    summaryLines.push(
      `品牌提及率（T0）：${formatRate(summary.mentionRateT0)}`,
      `推荐率（T0）：${formatRate(summary.recommendRateT0)}`,
      `竞品出现（T0）：${summary.competitorCountT0} 次`,
    );
  } else {
    summaryLines.push("T0 基线检测已完成，分项对比结果将在 T1 复测后生成。");
  }

  return {
    hasData: true,
    roundName: baseRound.roundName,
    finishedAtLabel: formatFinishedAt(baseRound.finishedAt),
    summaryLines,
  };
}
