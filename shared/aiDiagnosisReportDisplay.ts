/** AI 实测页「AI 当前怎么看你」业务报告：首屏结论与建议文案 */

export type AiDiagnosisFirstScreenState = "before" | "running" | "completed";

export type AiRecognitionStatus = "是" | "否" | "部分认识";
export type AiRecommendStatus = "是" | "否" | "偶尔";

export function resolveAiDiagnosisFirstScreenState(input: {
  isT0Running: boolean;
  t0Starting: boolean;
  hasT0BaselineResult: boolean;
  hasAiTestMetrics: boolean;
}): AiDiagnosisFirstScreenState {
  if (input.isT0Running || input.t0Starting) return "running";
  if (input.hasT0BaselineResult && input.hasAiTestMetrics) return "completed";
  return "before";
}

export function resolveAiRecognitionStatus(mentionPct: number | null): AiRecognitionStatus {
  if (mentionPct == null) return "否";
  if (mentionPct === 0) return "否";
  if (mentionPct > 50) return "是";
  return "部分认识";
}

export function resolveAiRecommendStatus(recommendPct: number | null): AiRecommendStatus {
  if (recommendPct == null) return "否";
  if (recommendPct === 0) return "否";
  if (recommendPct > 20) return "是";
  return "偶尔";
}

export function buildAiDiagnosisReportConclusion(
  mentionPct: number | null,
  recommendPct: number | null,
): string {
  const mention = mentionPct ?? 0;
  const recommend = recommendPct ?? 0;
  if (mention > 50 && recommend > 20) {
    return "AI 已能稳定识别并推荐你的品牌，建议继续扩大覆盖面。";
  }
  if (mention > 50 && recommend <= 20) {
    return "AI 能识别你的品牌，但推荐理由不足。建议补充信任证据和案例。";
  }
  return "AI 对你的品牌认知不稳定，建议优先补充公开信源和品牌基础内容。";
}

export function buildAiDiagnosisReportActionSuggestions(
  mentionPct: number | null,
  recommendPct: number | null,
): string[] {
  const mention = mentionPct ?? 0;
  const recommend = recommendPct ?? 0;
  const suggestions: string[] = [];

  if (mention <= 50) {
    suggestions.push("优先完善品牌基础资料与公开信源，提升 AI 对品牌的识别稳定性。");
  }
  if (mention > 50 && recommend <= 20) {
    suggestions.push("补充客户案例、信任证据与竞品对比内容，强化 AI 推荐理由。");
  }
  if (mention > 50 && recommend > 20) {
    suggestions.push("围绕尚未覆盖的高意向问题扩展内容，继续提升提及与推荐覆盖面。");
  }
  if (suggestions.length === 0) {
    suggestions.push("按本月优化计划推进内容补齐，7–14 天后复测验证成效。");
  }
  if (suggestions.length === 1 && mention <= 50 && recommend <= 20) {
    suggestions.push("启用问题池中的行业推荐类问题，针对性产出可引用内容。");
  }
  return suggestions.slice(0, 2);
}
