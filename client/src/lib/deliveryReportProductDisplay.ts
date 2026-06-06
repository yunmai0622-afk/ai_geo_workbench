import type { AiTestEvidenceAggregate } from "@shared/aiTestEvidence";
import { DELIVERY_REPORT_SCORE_MISSING_LABEL } from "@shared/deliveryReportScore";

export const DELIVERY_INSUFFICIENT_CONCLUSION =
  "当前数据不足，完成发布后复测后将生成本轮 GEO 增长结论。";

export const DELIVERY_METRIC_EMPTY_HINT = "暂无数据，完成对应步骤后展示。";

export type DeliveryCoreMetrics = {
  mentionRate: string;
  recommendRate: string;
  citationRate: string;
  inclusionSuccessCount: string;
  pendingOptimizeCount: string;
};

export type DeliveryReportMeta = {
  reportTitle: string;
  reportPeriod: string;
  reportRound: string;
  conclusionLine: string;
};

type MonitoringRow = {
  inclusionStatus?: string | null;
};

function formatPercent(rate: number, hasData: boolean): string {
  if (!hasData) return "暂无（需先完成 AI 实测）";
  return `${Math.round(rate * 100)}%`;
}

function countInclusionSuccess(rows: MonitoringRow[]): number | null {
  if (rows.length === 0) return null;
  const successLabels = ["已收录", "收录成功", "indexed", "included"];
  const count = rows.filter(r => {
    const s = (r.inclusionStatus ?? "").trim().toLowerCase();
    return successLabels.some(label => s.includes(label.toLowerCase()));
  }).length;
  return count;
}

export function computeCitationRateFromItems(items: Array<{ citedUrls?: string[] }>): number | null {
  if (items.length === 0) return null;
  const withCitation = items.filter(i => (i.citedUrls?.length ?? 0) > 0).length;
  return withCitation / items.length;
}

export function buildDeliveryReportMeta(params: {
  enterpriseName: string;
  reportGeneratedAt: Date | null;
  analysisCount: number;
  hasAiTestData: boolean;
  hasPublishWithLink: boolean;
  visibilityScore: number | null;
  mentionRate: number;
  recommendRate: number;
  maxProblemLine: string;
}): DeliveryReportMeta {
  const { enterpriseName, reportGeneratedAt, analysisCount, hasAiTestData, hasPublishWithLink, visibilityScore, mentionRate, recommendRate, maxProblemLine } =
    params;

  const reportTitle = `${enterpriseName} GEO 增长交付报告`;

  let reportPeriod = "交付周期待更新（完成首条发布或评分后自动显示）";
  if (reportGeneratedAt && !Number.isNaN(reportGeneratedAt.getTime())) {
    const end = reportGeneratedAt.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
    reportPeriod = `截至 ${end}`;
  }

  const reportRound =
    analysisCount > 0 ? `第 ${analysisCount} 轮诊断` : "首轮 GEO 增长交付（待完成 T0 基线）";

  const hasEnoughForConclusion = hasAiTestData && (hasPublishWithLink || visibilityScore != null);
  let conclusionLine = DELIVERY_INSUFFICIENT_CONCLUSION;
  if (hasEnoughForConclusion) {
    const mentionPct = Math.round(mentionRate * 100);
    const recommendPct = Math.round(recommendRate * 100);
    if (mentionPct === 0 && recommendPct === 0) {
      conclusionLine = `本轮 AI 搜索实测已完成，品牌在典型问题下提及与推荐信号仍偏弱，建议优先补齐可公开的内容证据并安排 7–14 天后复测。`;
    } else if (recommendPct === 0) {
      conclusionLine = `本轮品牌在 AI 回答中提及率约 ${mentionPct}%，尚未形成稳定推荐，建议强化差异化内容与案例引用，并持续回填公开链接。`;
    } else {
      conclusionLine = `本轮品牌在 AI 搜索中提及率约 ${mentionPct}%、推荐率约 ${recommendPct}%，已具备可对照基线，建议按下方动作持续优化并周期性复测。`;
    }
    const problem = maxProblemLine.trim();
    if (problem && !problem.startsWith("暂无")) {
      conclusionLine = `${conclusionLine} 当前优先缺口：${problem.replace(/[。；]+$/, "")}。`;
    }
  } else if (visibilityScore != null && analysisCount > 0) {
    conclusionLine = `本轮 AI 搜索可见度综合评分 ${visibilityScore} 分；完成发布登记与 AI 复测后，将形成更完整的 GEO 增长结论。`;
  }

  return { reportTitle, reportPeriod, reportRound, conclusionLine };
}

export function buildDeliveryCoreMetrics(params: {
  aggregate: AiTestEvidenceAggregate;
  monitoringRows: MonitoringRow[];
  pendingOptimizeCount: number;
  citationRate: number | null;
}): DeliveryCoreMetrics {
  const { aggregate, monitoringRows, pendingOptimizeCount, citationRate } = params;
  const hasAiTest = aggregate.questionCount > 0;
  const citation = citationRate;
  const inclusionCount = countInclusionSuccess(monitoringRows);

  return {
    mentionRate: hasAiTest ? formatPercent(aggregate.mentionRate, true) : "暂无（需先完成 AI 实测）",
    recommendRate: hasAiTest ? formatPercent(aggregate.recommendRate, true) : "暂无（需先完成 AI 实测）",
    citationRate: citation != null ? formatPercent(citation, true) : "暂无（需有引用样本）",
    inclusionSuccessCount:
      inclusionCount != null ? String(inclusionCount) : "暂无（需先进入收录监测）",
    pendingOptimizeCount:
      pendingOptimizeCount > 0 ? String(pendingOptimizeCount) : "暂无待优化项",
  };
}

export function metricHint(value: string): string | undefined {
  if (value.startsWith("暂无")) return DELIVERY_METRIC_EMPTY_HINT;
  return undefined;
}

export function formatCountOrEmpty(count: number | null): string {
  if (count == null || count === 0) return "暂无";
  return String(count);
}

export function visibilityScoreDisplay(score: number | null): string {
  return score != null ? String(score) : DELIVERY_REPORT_SCORE_MISSING_LABEL;
}

export const NO_PUBLIC_LINK_HINT = "暂无公开链接，请先完成发布并回填链接。";
