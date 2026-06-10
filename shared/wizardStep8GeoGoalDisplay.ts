/**
 * GEO-V2.0-Fix-Wizard-Step8：90 天目标提及率/推荐率系统建议（客户只读）
 */

export const WIZARD_STEP8_MENTION_INDUSTRY_REFERENCE = "30-50%";
export const WIZARD_STEP8_RECOMMEND_INDUSTRY_REFERENCE = "20-40%";

export const WIZARD_STEP8_RATE_EMPTY_HINT =
  "完成 AI 现状检测后，系统会根据当前表现自动建议合理目标。";

export type WizardStep8RateSuggestion = {
  hasMeasuredData: boolean;
  currentRatePercent: number | null;
  industryReferenceLabel: string;
  suggestedTargetPercent: number | null;
  emptyHint: string;
};

export type WizardStep8GeoGoalSuggestions = {
  mention: WizardStep8RateSuggestion;
  recommend: WizardStep8RateSuggestion;
};

export function rateToPercent(rate: number | null | undefined): number | null {
  if (rate == null || Number.isNaN(rate)) return null;
  return Math.round(rate * 100);
}

export function suggestWizardStep8TargetPercent(
  currentPercent: number,
  industryMin: number,
  industryMax: number,
): number {
  if (currentPercent >= industryMax) return Math.min(100, currentPercent + 10);
  if (currentPercent >= industryMin) return industryMax;
  return industryMin;
}

export function resolveWizardStep8HasAiTestData(input: {
  hasCompletedT0Baseline?: boolean;
  aiTestResultCount?: number;
  brandMentionRate?: number | null;
  recommendRate?: number | null;
}): boolean {
  if (input.hasCompletedT0Baseline) return true;
  if ((input.aiTestResultCount ?? 0) > 0) {
    return input.brandMentionRate != null || input.recommendRate != null;
  }
  return false;
}

function buildRateSuggestion(input: {
  hasAiTestData: boolean;
  currentRate: number | null | undefined;
  industryReferenceLabel: string;
  industryMin: number;
  industryMax: number;
}): WizardStep8RateSuggestion {
  const currentRatePercent = input.hasAiTestData ? rateToPercent(input.currentRate) : null;
  const hasMeasuredData = input.hasAiTestData && currentRatePercent != null;

  return {
    hasMeasuredData,
    currentRatePercent,
    industryReferenceLabel: input.industryReferenceLabel,
    suggestedTargetPercent:
      currentRatePercent != null
        ? suggestWizardStep8TargetPercent(currentRatePercent, input.industryMin, input.industryMax)
        : null,
    emptyHint: WIZARD_STEP8_RATE_EMPTY_HINT,
  };
}

export function buildWizardStep8GeoGoalSuggestions(input: {
  brandMentionRate: number | null;
  recommendRate: number | null;
  hasAiTestData: boolean;
}): WizardStep8GeoGoalSuggestions {
  return {
    mention: buildRateSuggestion({
      hasAiTestData: input.hasAiTestData,
      currentRate: input.brandMentionRate,
      industryReferenceLabel: WIZARD_STEP8_MENTION_INDUSTRY_REFERENCE,
      industryMin: 30,
      industryMax: 50,
    }),
    recommend: buildRateSuggestion({
      hasAiTestData: input.hasAiTestData,
      currentRate: input.recommendRate,
      industryReferenceLabel: WIZARD_STEP8_RECOMMEND_INDUSTRY_REFERENCE,
      industryMin: 20,
      industryMax: 40,
    }),
  };
}
