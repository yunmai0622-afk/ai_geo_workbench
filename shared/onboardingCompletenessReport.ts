/**
 * GEO-V2.0-P0-D：8 步建档完整度标准报告（工作台 / 诊断 / 报告统一接口）
 */

import {
  countQuestionGuideExamples,
  evaluateBrandIdentityScore,
  evaluateCategoryPositioningScore,
  evaluateCompetitorScore,
  evaluateGoalClarityScore,
  evaluateOnboardingWizardCompleteness,
  evaluateQuestionCoverageScore,
  evaluateSourceGraphScore,
  evaluateTargetCustomerScore,
  evaluateTrustEvidenceScore,
  ONBOARDING_WIZARD_TARGET_QUESTION_COUNT,
  type OnboardingWizardCompleteness,
} from "./onboardingWizardCompleteness";
import { parseGeoGoalNotesPayload, type QuestionGuideExamples } from "./onboardingWizardGeoGoalNotes";
import { ONBOARDING_WIZARD_STEPS } from "./onboardingWizardSteps";

/** 建档向导 checklist 维度标签前缀，与 AI 品牌成熟度 6 维评分区分 */
export const PROFILE_COMPLETENESS_DIMENSION_LABEL_PREFIX = "资料-";

export function formatProfileCompletenessDimensionLabel(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith(PROFILE_COMPLETENESS_DIMENSION_LABEL_PREFIX)) return trimmed;
  return `${PROFILE_COMPLETENESS_DIMENSION_LABEL_PREFIX}${trimmed}`;
}

/** 建档完整度 checklist 旁说明：与成熟度评分是不同维度 */
export const PROFILE_COMPLETENESS_VS_MATURITY_HINT =
  "这里衡量的是资料填写情况，AI 是否真正理解和推荐你，见「AI 品牌成熟度」";

/** 成熟度总览说明：与建档资料完整度区分 */
export const MATURITY_VS_PROFILE_COMPLETENESS_HINT =
  "此评分基于 AI 实际表现和公开数据质量，与建档资料填写完整度是两个不同维度";

export type CompletenessDimensionStatus = "complete" | "partial" | "empty";

export type CompletenessDimensionBase = {
  score: number;
  filledFields: string[];
  missingFields: string[];
  suggestion: string;
  step: number;
  title: string;
};

export type OnboardingCompletenessDimensions = {
  brandIdentity: CompletenessDimensionBase;
  categoryPositioning: CompletenessDimensionBase;
  targetCustomer: CompletenessDimensionBase;
  questionCoverage: CompletenessDimensionBase & {
    totalQuestions: number;
    targetQuestions: number;
  };
  competitorInfo: CompletenessDimensionBase;
  trustEvidence: CompletenessDimensionBase & {
    verifiedCount: number;
    totalCount: number;
    customerCasesCount: number;
  };
  sourceGraph: CompletenessDimensionBase & {
    sourceCount: number;
    platformsCovered: string[];
  };
  geoGoal: CompletenessDimensionBase;
};

export type OnboardingCompletenessReport = {
  totalScore: number;
  dimensions: OnboardingCompletenessDimensions;
  topMissingItems: string[];
  nextStepSuggestion: string;
  wizardStep: number;
  lastUpdatedAt: string | null;
};

type ProfileLike = Record<string, unknown> | null | undefined;

function trim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(v => String(v).trim()).filter(Boolean);
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

function splitFilledMissing(
  checks: Array<{ label: string; filled: boolean }>,
): Pick<CompletenessDimensionBase, "filledFields" | "missingFields"> {
  const filledFields = checks.filter(c => c.filled).map(c => c.label);
  const missingFields = checks.filter(c => !c.filled).map(c => c.label);
  return { filledFields, missingFields };
}

function suggestionFromMissing(title: string, missingFields: string[], fallback: string): string {
  if (missingFields.length === 0) return `${title}已较完整，可继续优化细节。`;
  const preview = missingFields.slice(0, 2).join("、");
  return `建议补充${title}中的「${preview}」${missingFields.length > 2 ? "等字段" : ""}。`;
}

export function resolveCompletenessDimensionStatus(score: number): CompletenessDimensionStatus {
  if (score >= 80) return "complete";
  if (score >= 40) return "partial";
  return "empty";
}

export function resolveCompletenessDimensionStatusLabel(score: number): string {
  const status = resolveCompletenessDimensionStatus(score);
  if (status === "complete") return "已完成";
  if (status === "partial") return "待完善";
  return "未填写";
}

export function resolveCompletenessDimensionStatusIcon(score: number): string {
  const status = resolveCompletenessDimensionStatus(score);
  if (status === "complete") return "✅";
  if (status === "partial") return "🟡";
  return "❌";
}

function evaluateBrandIdentityDimension(profile: ProfileLike): CompletenessDimensionBase {
  const fields = splitFilledMissing([
    { label: "品牌名称", filled: Boolean(resolveBrandName(profile)) },
    { label: "企业全称", filled: Boolean(resolveEnterpriseName(profile)) },
    { label: "一句话介绍", filled: Boolean(trim(profile?.oneLiner)) },
    { label: "官方网站", filled: Boolean(trim(profile?.officialWebsite)) },
    { label: "所在地区", filled: Boolean(trim(profile?.region)) },
    { label: "品牌简称", filled: Boolean(trim(profile?.shortName)) },
  ]);
  const stepMeta = ONBOARDING_WIZARD_STEPS[0]!;
  return {
    step: stepMeta.step,
    title: stepMeta.title,
    score: evaluateBrandIdentityScore(profile),
    ...fields,
    suggestion: suggestionFromMissing(stepMeta.title, fields.missingFields, "完善品牌实体信息，让 AI 能识别你的企业。"),
  };
}

function evaluateCategoryPositioningDimension(profile: ProfileLike): CompletenessDimensionBase {
  const keyPoints = stringArray(profile?.keyPoints);
  const coreSelling = trim(profile?.coreSellingPoints);
  const sellingPoints = keyPoints.length > 0 || Boolean(coreSelling);
  const fields = splitFilledMissing([
    { label: "所属行业", filled: Boolean(resolveIndustry(profile)) },
    { label: "产品/服务介绍", filled: Boolean(resolveProductDesc(profile)) },
    { label: "核心卖点", filled: sellingPoints },
    { label: "关键词", filled: stringArray(profile?.keywords).length > 0 },
  ]);
  const stepMeta = ONBOARDING_WIZARD_STEPS[1]!;
  return {
    step: stepMeta.step,
    title: stepMeta.title,
    score: evaluateCategoryPositioningScore(profile),
    ...fields,
    suggestion: suggestionFromMissing(stepMeta.title, fields.missingFields, "补充品类定位，帮助 AI 在推荐场景中提及你。"),
  };
}

function evaluateTargetCustomerDimension(profile: ProfileLike): CompletenessDimensionBase {
  const fields = splitFilledMissing([
    { label: "目标客户", filled: Boolean(resolveTargetCustomer(profile)) },
    { label: "客户痛点", filled: stringArray(profile?.customerPains).length > 0 },
    { label: "适合客户", filled: Boolean(trim(profile?.fitCustomers)) },
    { label: "不适合客户", filled: Boolean(trim(profile?.unfitCustomers)) },
  ]);
  const stepMeta = ONBOARDING_WIZARD_STEPS[2]!;
  return {
    step: stepMeta.step,
    title: stepMeta.title,
    score: evaluateTargetCustomerScore(profile),
    ...fields,
    suggestion: suggestionFromMissing(stepMeta.title, fields.missingFields, "明确目标客户，让问题池更贴近真实购买场景。"),
  };
}

function evaluateQuestionCoverageDimension(
  profile: ProfileLike,
  questionCount: number,
  questionGuide?: QuestionGuideExamples,
): OnboardingCompletenessDimensions["questionCoverage"] {
  const guideCount = countQuestionGuideExamples(questionGuide);
  const fields = splitFilledMissing([
    { label: "问题池题目", filled: questionCount > 0 },
    { label: "向导示例问题", filled: guideCount > 0 },
  ]);
  const stepMeta = ONBOARDING_WIZARD_STEPS[3]!;
  const suggestion =
    questionCount >= ONBOARDING_WIZARD_TARGET_QUESTION_COUNT
      ? "问题池已较充足，可定期补充长尾问题。"
      : questionCount > 0 || guideCount > 0
        ? `当前 ${questionCount} 题，建议补充至 ${ONBOARDING_WIZARD_TARGET_QUESTION_COUNT} 题以覆盖更多 AI 搜索场景。`
        : "请填写 AI 搜索问题引导，系统将自动生成问题池。";
  return {
    step: stepMeta.step,
    title: stepMeta.title,
    score: evaluateQuestionCoverageScore(questionCount),
    totalQuestions: questionCount,
    targetQuestions: ONBOARDING_WIZARD_TARGET_QUESTION_COUNT,
    ...fields,
    suggestion,
  };
}

function evaluateCompetitorDimension(profile: ProfileLike): CompletenessDimensionBase {
  const competitors = stringArray(profile?.competitors);
  const fields = splitFilledMissing([{ label: "竞品列表", filled: competitors.length >= 1 }]);
  const stepMeta = ONBOARDING_WIZARD_STEPS[4]!;
  return {
    step: stepMeta.step,
    title: stepMeta.title,
    score: evaluateCompetitorScore(profile),
    ...fields,
    suggestion:
      competitors.length >= 1
        ? "已填写竞品，可在对比类问题中监测胜出情况。"
        : "请至少填写 1 个主要竞品，用于对比监测与内容生成。",
  };
}

function evaluateTrustEvidenceDimension(
  customerCaseCount: number,
  trustEvidenceCount: number,
  verifiedCount: number,
): OnboardingCompletenessDimensions["trustEvidence"] {
  const fields = splitFilledMissing([
    { label: "客户案例", filled: customerCaseCount > 0 },
    { label: "信任证据", filled: trustEvidenceCount > 0 },
    { label: "已验证证据", filled: verifiedCount > 0 },
  ]);
  const stepMeta = ONBOARDING_WIZARD_STEPS[5]!;
  const totalCount = customerCaseCount + trustEvidenceCount;
  const suggestion =
    totalCount >= 5
      ? "信任证据较充分，可继续补充已验证的公开佐证。"
      : totalCount >= 1
        ? `已有 ${totalCount} 条证据，建议补充至 5 条以上并尽量完成验证。`
        : "请补充客户案例或信任证据，提升 AI 推荐时的可信度。";
  return {
    step: stepMeta.step,
    title: stepMeta.title,
    score: evaluateTrustEvidenceScore(customerCaseCount, trustEvidenceCount),
    verifiedCount,
    totalCount: trustEvidenceCount,
    customerCasesCount: customerCaseCount,
    ...fields,
    suggestion,
  };
}

function evaluateSourceGraphDimension(
  sourceCount: number,
  platformsCovered: string[],
): OnboardingCompletenessDimensions["sourceGraph"] {
  const fields = splitFilledMissing([
    { label: "公开信源", filled: sourceCount > 0 },
    { label: "覆盖平台", filled: platformsCovered.length > 0 },
  ]);
  const stepMeta = ONBOARDING_WIZARD_STEPS[6]!;
  const suggestion =
    sourceCount >= 10 && platformsCovered.length >= 5
      ? "信源图谱较完整，可定期检查跨平台一致性。"
      : sourceCount > 0
        ? `当前 ${sourceCount} 条信源、${platformsCovered.length} 个平台，建议继续补充多元公开信源。`
        : "请录入公开信源，让 AI 能在外部平台交叉验证你的企业信息。";
  return {
    step: stepMeta.step,
    title: stepMeta.title,
    score: evaluateSourceGraphScore(sourceCount, platformsCovered.length),
    sourceCount,
    platformsCovered,
    ...fields,
    suggestion,
  };
}

function evaluateGeoGoalDimension(profile: ProfileLike): CompletenessDimensionBase {
  const payload = parseGeoGoalNotesPayload(trim(profile?.geoGoalNotes) || null);
  const fields = splitFilledMissing([
    { label: "目标提及率", filled: typeof profile?.targetMentionRate === "number" && profile.targetMentionRate > 0 },
    { label: "目标推荐率", filled: typeof profile?.targetRecommendationRate === "number" && profile.targetRecommendationRate > 0 },
    { label: "目标平台", filled: stringArray(profile?.targetPlatforms).length > 0 },
    { label: "待超越竞品", filled: stringArray(profile?.targetCompetitorsToBeat).length > 0 },
    { label: "月内容产能", filled: typeof profile?.monthlyContentCapacity === "number" },
    { label: "内部负责人（选填）", filled: Boolean(trim(profile?.internalOwnerName)) },
    { label: "其他补充说明（选填）", filled: Boolean(trim(payload.goalNotes)) },
  ]);
  const stepMeta = ONBOARDING_WIZARD_STEPS[7]!;
  return {
    step: stepMeta.step,
    title: stepMeta.title,
    score: evaluateGoalClarityScore(profile),
    ...fields,
    suggestion: suggestionFromMissing(stepMeta.title, fields.missingFields, "明确 90 天 GEO 目标，驱动后续优化与复测。"),
  };
}

function buildTopMissingItems(dimensions: OnboardingCompletenessDimensions): string[] {
  const ranked = Object.values(dimensions)
    .map(dim => ({ score: dim.score, missing: dim.missingFields }))
    .sort((a, b) => a.score - b.score);
  const items: string[] = [];
  for (const row of ranked) {
    for (const label of row.missing) {
      if (!items.includes(label)) items.push(label);
      if (items.length >= 3) return items;
    }
  }
  return items;
}

function buildNextStepSuggestion(dimensions: OnboardingCompletenessDimensions): string {
  const lowest = Object.values(dimensions).sort((a, b) => a.score - b.score)[0];
  return lowest?.suggestion ?? "继续完善品牌资产建档，提升 AI 理解准确度。";
}

export function buildOnboardingCompletenessReport(input: {
  profile: ProfileLike;
  questionCount?: number;
  customerCaseCount?: number;
  trustEvidenceCount?: number;
  verifiedTrustEvidenceCount?: number;
  brandSourceCount?: number;
  brandSourcePlatforms?: string[];
  questionGuide?: QuestionGuideExamples;
  wizardStep?: number;
  lastUpdatedAt?: Date | string | null;
}): OnboardingCompletenessReport {
  const profile = input.profile ?? {};
  const questionCount = input.questionCount ?? 0;
  const questionGuide =
    input.questionGuide ?? parseGeoGoalNotesPayload(trim(profile?.geoGoalNotes) || null).questionGuide;
  const platforms = (input.brandSourcePlatforms ?? []).filter(Boolean);

  const dimensions: OnboardingCompletenessDimensions = {
    brandIdentity: evaluateBrandIdentityDimension(profile),
    categoryPositioning: evaluateCategoryPositioningDimension(profile),
    targetCustomer: evaluateTargetCustomerDimension(profile),
    questionCoverage: evaluateQuestionCoverageDimension(profile, questionCount, questionGuide),
    competitorInfo: evaluateCompetitorDimension(profile),
    trustEvidence: evaluateTrustEvidenceDimension(
      input.customerCaseCount ?? 0,
      input.trustEvidenceCount ?? 0,
      input.verifiedTrustEvidenceCount ?? 0,
    ),
    sourceGraph: evaluateSourceGraphDimension(input.brandSourceCount ?? 0, platforms),
    geoGoal: evaluateGeoGoalDimension(profile),
  };

  const wizardScores: OnboardingWizardCompleteness = evaluateOnboardingWizardCompleteness({
    profile,
    questionCount,
    customerCaseCount: input.customerCaseCount ?? 0,
    trustEvidenceCount: input.trustEvidenceCount ?? 0,
    brandSourceCount: input.brandSourceCount ?? 0,
    brandSourcePlatformCount: platforms.length,
  });

  const wizardStep =
    typeof input.wizardStep === "number"
      ? input.wizardStep
      : typeof profile?.wizardStep === "number"
        ? profile.wizardStep
        : 0;

  const lastUpdatedAt = input.lastUpdatedAt
    ? new Date(input.lastUpdatedAt).toISOString()
    : profile?.updatedAt
      ? new Date(String(profile.updatedAt)).toISOString()
      : null;

  return {
    totalScore: wizardScores.completionScore,
    dimensions,
    topMissingItems: buildTopMissingItems(dimensions),
    nextStepSuggestion: buildNextStepSuggestion(dimensions),
    wizardStep,
    lastUpdatedAt,
  };
}
