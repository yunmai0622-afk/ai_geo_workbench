/**
 * GEO-V2.0-P0-B：8 步建档向导完整度（8 维均等加权）
 */

import type { QuestionGuideExamples } from "./onboardingWizardGeoGoalNotes";

export const ONBOARDING_WIZARD_TARGET_QUESTION_COUNT = 30;

export type OnboardingWizardDimensionScores = {
  brandIdentityScore: number;
  categoryPositioningScore: number;
  targetCustomerScore: number;
  questionCoverageScore: number;
  competitorScore: number;
  trustEvidenceScore: number;
  sourceGraphScore: number;
  goalClarityScore: number;
};

export type OnboardingWizardCompleteness = OnboardingWizardDimensionScores & {
  completionScore: number;
};

type ProfileLike = Record<string, unknown> | null | undefined;

function trim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(v => String(v).trim()).filter(Boolean);
}

function fillRate(fields: boolean[]): number {
  if (fields.length === 0) return 0;
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

function resolveBrandName(profile: ProfileLike): string {
  return trim(profile?.brandName) || trim(profile?.enterpriseName);
}

function resolveEnterpriseName(profile: ProfileLike): string {
  return trim(profile?.enterpriseName) || trim(profile?.brandName);
}

function resolveProductDesc(profile: ProfileLike): string {
  return trim(profile?.productDesc) || trim(profile?.productServiceIntro) || trim(profile?.productIntro);
}

function resolveTargetCustomer(profile: ProfileLike): string {
  return trim(profile?.targetCustomer) || trim(profile?.targetCustomers);
}

function resolveIndustry(profile: ProfileLike): string {
  return trim(profile?.industryTag) || trim(profile?.industry);
}

export function evaluateBrandIdentityScore(profile: ProfileLike): number {
  return fillRate([
    Boolean(resolveBrandName(profile)),
    Boolean(resolveEnterpriseName(profile)),
    Boolean(trim(profile?.oneLiner)),
    Boolean(trim(profile?.officialWebsite)),
    Boolean(trim(profile?.region)),
    Boolean(trim(profile?.shortName)),
  ]);
}

export function evaluateCategoryPositioningScore(profile: ProfileLike): number {
  const keyPoints = stringArray(profile?.keyPoints);
  const coreSelling = trim(profile?.coreSellingPoints);
  const sellingPoints = keyPoints.length > 0 || Boolean(coreSelling);
  return fillRate([
    Boolean(resolveIndustry(profile)),
    Boolean(resolveProductDesc(profile)),
    sellingPoints,
    stringArray(profile?.keywords).length > 0,
  ]);
}

export function evaluateTargetCustomerScore(profile: ProfileLike): number {
  return fillRate([
    Boolean(resolveTargetCustomer(profile)),
    stringArray(profile?.customerPains).length > 0,
    Boolean(trim(profile?.fitCustomers)),
    Boolean(trim(profile?.unfitCustomers)),
  ]);
}

export function evaluateQuestionCoverageScore(questionCount: number): number {
  const count = Math.max(0, questionCount);
  return Math.min(100, Math.round((count / ONBOARDING_WIZARD_TARGET_QUESTION_COUNT) * 100));
}

export function evaluateCompetitorScore(profile: ProfileLike): number {
  const competitors = stringArray(profile?.competitors);
  if (competitors.length >= 1) return 100;
  return 0;
}

export function evaluateTrustEvidenceScore(customerCaseCount: number, trustEvidenceCount = 0): number {
  const total = Math.max(0, customerCaseCount) + Math.max(0, trustEvidenceCount);
  if (total >= 5) return 100;
  if (total >= 3) return 75;
  if (total >= 1) return 50;
  return 0;
}

export function evaluateSourceGraphScore(sourceCount: number, platformCount: number): number {
  const countScore = Math.min(100, Math.round((Math.max(0, sourceCount) / 10) * 100));
  const platformScore = Math.min(100, Math.round((Math.max(0, platformCount) / 5) * 100));
  return Math.round((countScore + platformScore) / 2);
}

export function evaluateGoalClarityScore(profile: ProfileLike): number {
  return fillRate([
    typeof profile?.targetMentionRate === "number" && profile.targetMentionRate > 0,
    typeof profile?.targetRecommendationRate === "number" && profile.targetRecommendationRate > 0,
    stringArray(profile?.targetPlatforms).length > 0,
    stringArray(profile?.targetCompetitorsToBeat).length > 0,
    typeof profile?.monthlyContentCapacity === "number",
  ]);
}

export function evaluateOnboardingWizardCompleteness(input: {
  profile: ProfileLike;
  questionCount?: number;
  customerCaseCount?: number;
  trustEvidenceCount?: number;
  brandSourceCount?: number;
  brandSourcePlatformCount?: number;
}): OnboardingWizardCompleteness {
  const profile = input.profile ?? {};
  const dimensions: OnboardingWizardDimensionScores = {
    brandIdentityScore: evaluateBrandIdentityScore(profile),
    categoryPositioningScore: evaluateCategoryPositioningScore(profile),
    targetCustomerScore: evaluateTargetCustomerScore(profile),
    questionCoverageScore: evaluateQuestionCoverageScore(input.questionCount ?? 0),
    competitorScore: evaluateCompetitorScore(profile),
    trustEvidenceScore: evaluateTrustEvidenceScore(
      input.customerCaseCount ?? 0,
      input.trustEvidenceCount ?? 0,
    ),
    sourceGraphScore: evaluateSourceGraphScore(input.brandSourceCount ?? 0, input.brandSourcePlatformCount ?? 0),
    goalClarityScore: evaluateGoalClarityScore(profile),
  };
  const values = Object.values(dimensions);
  const completionScore = Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
  return { ...dimensions, completionScore };
}

export function countQuestionGuideExamples(guide: QuestionGuideExamples | undefined): number {
  if (!guide) return 0;
  return (
    guide.brandSearch.length +
    guide.categoryRecommend.length +
    guide.sceneNeed.length +
    guide.comparison.length +
    guide.longTail.length
  );
}

export function isWizardStepComplete(
  step: number,
  profile: ProfileLike,
  context: {
    questionCount?: number;
    customerCaseCount?: number;
    brandSourceCount?: number;
    questionGuide?: QuestionGuideExamples;
  },
): boolean {
  switch (step) {
    case 1:
      return evaluateBrandIdentityScore(profile) >= 67;
    case 2:
      return evaluateCategoryPositioningScore(profile) >= 75;
    case 3:
      return evaluateTargetCustomerScore(profile) >= 50;
    case 4:
      const guideCount = countQuestionGuideExamples(context.questionGuide);
      return guideCount > 0 || (context.questionCount ?? 0) > 0;
    case 5:
      return evaluateCompetitorScore(profile) >= 100;
    case 6:
      return (context.customerCaseCount ?? 0) > 0;
    case 7:
      return (context.brandSourceCount ?? 0) > 0;
    case 8:
      return evaluateGoalClarityScore(profile) >= 40;
    default:
      return false;
  }
}
