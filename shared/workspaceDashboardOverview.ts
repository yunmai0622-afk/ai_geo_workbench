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

function formatSignedDelta(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}

export function buildGeoScoreAttributionLines(metrics: WorkspaceSummaryMetrics): string[] {
  const lines: string[] = [];
  if (metrics.brandMentionRate != null && metrics.aiTestResultCount > 0 && metrics.brandMentionRate < 0.3) {
    lines.push("品牌提及率低：影响分数");
  }
  if (metrics.recommendRate != null && metrics.aiTestResultCount > 0 && Math.round(metrics.recommendRate * 100) === 0) {
    lines.push("推荐率为 0：影响分数");
  }
  if (metrics.articleCount <= 0 || metrics.lowQualityArticleCount > 0) {
    lines.push("内容覆盖不足：影响分数");
  }
  lines.push("数据来源：真实诊断数据");
  return lines;
}

export function formatGeoScoreChangeBadge(input: {
  latestScore: number | null;
  previousScore: number | null;
}): string | null {
  if (input.latestScore == null || input.previousScore == null) return null;
  const delta = Math.round(input.latestScore - input.previousScore);
  return `${formatSignedDelta(delta)}（较上次）`;
}

export function buildGeoScoreChangeReason(metrics: WorkspaceSummaryMetrics): string {
  const reasons: string[] = [];
  if (metrics.brandMentionRate != null && metrics.aiTestResultCount > 0 && metrics.brandMentionRate < 0.3) {
    reasons.push("品牌提及率偏低");
  }
  if (metrics.recommendRate != null && metrics.aiTestResultCount > 0 && Math.round(metrics.recommendRate * 100) === 0) {
    reasons.push("推荐率为 0");
  }
  if (metrics.articleCount <= 0 || metrics.lowQualityArticleCount > 0) {
    reasons.push("内容覆盖不足");
  }
  if (reasons.length === 0) return "主要由诊断样本更新带来变化";
  return `原因：${reasons.join("；")}`;
}
