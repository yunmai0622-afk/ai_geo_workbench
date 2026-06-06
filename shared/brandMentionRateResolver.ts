/** GEO 评分中的 aiVisibilityScore / aiRecommendationScore 为 0–100 的百分比，转为 0–1 比率 */
export function geoScorePercentToRate(percent: number | null | undefined): number | null {
  if (percent == null || Number.isNaN(percent)) return null;
  return Math.max(0, Math.min(1, percent / 100));
}

/**
 * 与 AI 诊断页一致：T0 实测 > 收录监测 > 最近一次 GEO 诊断分 > 分析结果汇总
 */
export function resolveBrandMentionRate(input: {
  t0MentionRate?: number | null;
  monitoringMentionRate?: number | null;
  monitoringQuestionCount: number;
  geoScoreMentionRate?: number | null;
  analysisMentionRate?: number | null;
}): number | null {
  if (input.t0MentionRate != null && !Number.isNaN(input.t0MentionRate)) {
    return input.t0MentionRate;
  }
  if (input.monitoringQuestionCount > 0 && input.monitoringMentionRate != null) {
    return input.monitoringMentionRate;
  }
  if (input.geoScoreMentionRate != null) {
    return input.geoScoreMentionRate;
  }
  if (input.analysisMentionRate != null) {
    return input.analysisMentionRate;
  }
  return null;
}

export function resolveRecommendRate(input: {
  t0RecommendRate?: number | null;
  monitoringRecommendRate?: number | null;
  monitoringQuestionCount: number;
  geoScoreRecommendRate?: number | null;
  analysisRecommendRate?: number | null;
}): number | null {
  if (input.t0RecommendRate != null && !Number.isNaN(input.t0RecommendRate)) {
    return input.t0RecommendRate;
  }
  if (input.monitoringQuestionCount > 0 && input.monitoringRecommendRate != null) {
    return input.monitoringRecommendRate;
  }
  if (input.geoScoreRecommendRate != null) {
    return input.geoScoreRecommendRate;
  }
  if (input.analysisRecommendRate != null) {
    return input.analysisRecommendRate;
  }
  return null;
}
