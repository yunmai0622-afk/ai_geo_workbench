/** 客户交付报告：AI 搜索可见度评分展示口径（统一为内容覆盖总分 totalScore） */

export const DELIVERY_REPORT_SCORE_MISSING_LABEL = "暂无数据";

export function readGeoContentCoverageTotalScore(score?: Record<string, unknown> | null): number | null {
  if (!score) return null;
  if (typeof score.totalScore === "number" && Number.isFinite(score.totalScore)) return score.totalScore;
  if (typeof score.total_score === "number" && Number.isFinite(score.total_score)) return score.total_score;
  return null;
}

/** 客户可见的 AI 搜索可见度评分 = 内容覆盖总分，不使用 aiVisibilityScore 子分项兜底 */
export function resolveDeliveryReportVisibilityScore(score?: Record<string, unknown> | null): number | null {
  return readGeoContentCoverageTotalScore(score);
}

export function formatDeliveryReportVisibilityScore(score: number | null): string {
  return score != null ? String(score) : DELIVERY_REPORT_SCORE_MISSING_LABEL;
}

export function buildDeliveryReportConclusionLine(totalScore: number | null, hasAnalysis: boolean): string {
  if (totalScore == null) {
    return "请先完成 内容诊断与评分，以便生成本轮面向客户的结论摘要。";
  }
  if (hasAnalysis) {
    return `本轮 AI 搜索可见度综合评分 ${totalScore} 分；在典型 AI 问答场景下，品牌在 AI 回答中的提及与推荐表现存在可优化空间，建议用可公开、可引用的内容资产持续补齐证据链。`;
  }
  return `本轮 AI 搜索可见度综合评分 ${totalScore} 分；建议结合下方 AI 搜索实测结果，持续优化品牌可见度与推荐表现。`;
}
