import type { WorkspaceSummaryMetrics } from "./workspaceStateMachine";

export function formatWorkspaceAiMentionRate(metrics: WorkspaceSummaryMetrics): string {
  if (metrics.brandMentionRate != null) {
    if (metrics.hasGeoScore || metrics.hasAnalysis || metrics.aiTestResultCount > 0) {
      return `${Math.round(metrics.brandMentionRate * 100)}%`;
    }
  }
  if (metrics.hasAnalysis || metrics.hasGeoScore) {
    return "待实测";
  }
  return "--";
}

export function formatWorkspacePublishCount(metrics: WorkspaceSummaryMetrics): {
  text: string;
  hint?: string;
} {
  const manual = metrics.publishRecordCount;
  const agentCompleted = metrics.completedPublishTaskCount;
  const total = manual + agentCompleted;
  if (total > 0) {
    if (manual > 0 && agentCompleted > 0) {
      return {
        text: `${total}次`,
        hint: `手工登记 ${manual} 次 · Agent 完成 ${agentCompleted} 次`,
      };
    }
    if (agentCompleted > 0 && manual === 0) {
      return { text: `${agentCompleted}次`, hint: "已通过 Agent 自动发布" };
    }
    return { text: `${manual}次` };
  }
  if (metrics.publishTaskCount > 0) {
    return {
      text: "0次",
      hint: `有 ${metrics.publishTaskCount} 条发布任务，尚无任何完成记录`,
    };
  }
  return { text: "0次" };
}

export function workspaceAiMentionRateHint(metrics: WorkspaceSummaryMetrics): string | undefined {
  if (metrics.brandMentionRate == null && (metrics.hasAnalysis || metrics.hasGeoScore)) {
    return "已有内容诊断结论，提及率需完成 T0 真实平台实测后更新";
  }
  if (metrics.brandMentionRate != null && metrics.aiTestResultCount > 0 && !metrics.hasCompletedT0Baseline) {
    return "当前为内容诊断口径，完成优化前基线后将切换为真实平台实测";
  }
  return undefined;
}

export function formatWorkspaceOverviewValues(metrics: WorkspaceSummaryMetrics) {
  const geoScore =
    metrics.geoScore != null && !Number.isNaN(metrics.geoScore) ? Math.round(metrics.geoScore) : null;
  const publishCount = formatWorkspacePublishCount(metrics);
  return {
    articleCountText: `${metrics.articleCount}篇`,
    publishCountText: publishCount.text,
    publishCountHint: publishCount.hint,
    aiMentionRateText: formatWorkspaceAiMentionRate(metrics),
    aiMentionRateHint: workspaceAiMentionRateHint(metrics),
    geoScoreText: geoScore == null ? "--" : `${geoScore}分`,
  };
}

function formatSignedDelta(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}

export function buildGeoScoreAttributionLines(metrics: WorkspaceSummaryMetrics): string[] {
  const lines: string[] = [];
  if (metrics.aiTestResultCount <= 1) {
    lines.push("当前仅 1 次诊断样本：归因参考性有限");
  }
  if (metrics.brandMentionRate != null && metrics.aiTestResultCount > 0 && metrics.brandMentionRate < 0.3) {
    lines.push("品牌提及率低：影响分数");
  }
  if (metrics.recommendRate != null && metrics.aiTestResultCount > 0 && Math.round(metrics.recommendRate * 100) === 0) {
    lines.push("推荐率为 0：影响分数");
  }
  if (metrics.articleCount <= 0 || metrics.lowQualityArticleCount > 0) {
    lines.push("内容覆盖不足：影响分数");
  }
  if (!lines.some(line => line.includes("影响分数"))) {
    lines.push("当前未发现明显扣分项：分数主要由诊断样本更新驱动");
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
  return `较上次 ${formatSignedDelta(delta)}`;
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
