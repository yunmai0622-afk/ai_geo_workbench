export type AiTestRunMetricRow = {
  mentionedCompany: boolean;
  recommendedCompany: boolean;
};

export type T0AiTestRunMetricsResult = {
  totalRuns: number;
  mentionedCount: number;
  recommendedCount: number;
  mentionRate: number;
  recommendRate: number;
};

/** 基于 ai_test_runs 聚合 T0 品牌提及率与推荐率。 */
export function aggregateT0AiTestRunMetrics(
  runs: AiTestRunMetricRow[],
): T0AiTestRunMetricsResult | null {
  if (runs.length === 0) return null;

  const mentionedCount = runs.filter(run => run.mentionedCompany).length;
  const recommendedCount = runs.filter(run => run.recommendedCompany).length;
  const totalRuns = runs.length;

  return {
    totalRuns,
    mentionedCount,
    recommendedCount,
    mentionRate: mentionedCount / totalRuns,
    recommendRate: recommendedCount / totalRuns,
  };
}
