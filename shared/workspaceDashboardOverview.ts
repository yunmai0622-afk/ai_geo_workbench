import type { WorkspaceSummaryMetrics } from "./workspaceStateMachine";

export function formatWorkspaceAiMentionRate(metrics: WorkspaceSummaryMetrics): string {
  if (metrics.brandMentionRate == null || metrics.aiTestResultCount <= 0) return "--";
  return `${Math.round(metrics.brandMentionRate * 100)}%`;
}

export function formatWorkspaceOverviewValues(metrics: WorkspaceSummaryMetrics) {
  const geoScore =
    metrics.geoScore != null && !Number.isNaN(metrics.geoScore) ? Math.round(metrics.geoScore) : null;
  return {
    articleCountText: `${metrics.articleCount}篇`,
    publishCountText: `${metrics.publishRecordCount}次`,
    aiMentionRateText: formatWorkspaceAiMentionRate(metrics),
    geoScoreText: geoScore == null ? "--" : `${geoScore}分`,
  };
}
