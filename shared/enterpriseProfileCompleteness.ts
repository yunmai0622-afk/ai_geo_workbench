/**
 * GEO-V1.1-Profile-Completeness：企业资料 8 项核心字段完整度（0–100%）
 * 与 evaluateGeoProfileP0Readiness / AssetCenter 建档页口径一致。
 */

import {
  evaluateGeoProfileP0Readiness,
  isProfileCoreAdvantageFilled,
  isProfilePrimaryPainFilled,
} from "./geoProfileP0Readiness";

export const PROFILE_COMPLETENESS_LOW_THRESHOLD = 60;

export const PROFILE_COMPLETENESS_LOW_HINT =
  "建议先完善企业资料，提升AI检测准确性";

export const PROFILE_COMPLETENESS_COMPLETE_BADGE = "资料完整";

export type ProfileCompletenessFieldKey =
  | "brandName"
  | "industry"
  | "oneLiner"
  | "productDesc"
  | "targetCustomer"
  | "primaryPain"
  | "coreAdvantage"
  | "keywords";

export const PROFILE_COMPLETENESS_FIELD_COUNT = 8;

export const PROFILE_COMPLETENESS_FIELD_LABELS: Record<ProfileCompletenessFieldKey, string> = {
  brandName: "企业名称",
  industry: "所属行业",
  oneLiner: "一句话介绍",
  productDesc: "核心产品/服务",
  targetCustomer: "目标客户",
  primaryPain: "你的产品主要解决什么问题？",
  coreAdvantage: "你的核心优势是什么？",
  keywords: "关键词",
};

export type EnterpriseProfileCompleteness = {
  percent: number;
  filledCount: number;
  totalCount: number;
  missingKeys: ProfileCompletenessFieldKey[];
  missingLabels: string[];
  isComplete: boolean;
  showLowCompletenessHint: boolean;
};


export function evaluateProfileFieldFilled(
  key: ProfileCompletenessFieldKey,
  profile: Record<string, unknown> | null | undefined,
): boolean {
  if (!profile) return false;
  switch (key) {
    case "brandName":
      return Boolean(
        (typeof profile.brandName === "string" && profile.brandName.trim()) ||
          (typeof profile.enterpriseName === "string" && profile.enterpriseName.trim()),
      );
    case "industry":
      return Boolean(
        (typeof profile.industryTag === "string" && profile.industryTag.trim()) ||
          (typeof profile.industry === "string" && profile.industry.trim()),
      );
    case "oneLiner":
      return Boolean(
        (typeof profile.oneLiner === "string" && profile.oneLiner.trim()) ||
          (typeof profile.companyIntro === "string" && profile.companyIntro.trim()),
      );
    case "productDesc":
      return Boolean(
        (typeof profile.productDesc === "string" && profile.productDesc.trim()) ||
          (typeof profile.productServiceIntro === "string" && profile.productServiceIntro.trim()) ||
          (typeof profile.productIntro === "string" && profile.productIntro.trim()) ||
          (typeof profile.coreSellingPoints === "string" && profile.coreSellingPoints.trim()),
      );
    case "targetCustomer":
      return Boolean(
        (typeof profile.targetCustomer === "string" && profile.targetCustomer.trim()) ||
          (typeof profile.targetCustomers === "string" && profile.targetCustomers.trim()),
      );
    case "primaryPain":
      return isProfilePrimaryPainFilled(profile);
    case "coreAdvantage":
      return isProfileCoreAdvantageFilled(profile);
    case "keywords": {
      const keywords = [
        ...(Array.isArray(profile.keywords) ? profile.keywords : []),
        ...(Array.isArray(profile.coreKeywords) ? profile.coreKeywords : []),
      ].filter(v => typeof v === "string" && v.trim());
      return keywords.length > 0;
    }
    default:
      return false;
  }
}

export function evaluateEnterpriseProfileCompletenessFromProfile(
  profile: Record<string, unknown> | null | undefined,
): EnterpriseProfileCompleteness {
  const { complete } = evaluateGeoProfileP0Readiness(profile);
  const allKeys = Object.keys(PROFILE_COMPLETENESS_FIELD_LABELS) as ProfileCompletenessFieldKey[];
  const missingKeys = allKeys.filter(key => !evaluateProfileFieldFilled(key, profile));
  const missingLabels = missingKeys.map(key => PROFILE_COMPLETENESS_FIELD_LABELS[key]);
  const filledCount = PROFILE_COMPLETENESS_FIELD_COUNT - missingKeys.length;
  const percent = Math.round((filledCount / PROFILE_COMPLETENESS_FIELD_COUNT) * 100);
  return {
    percent,
    filledCount,
    totalCount: PROFILE_COMPLETENESS_FIELD_COUNT,
    missingKeys,
    missingLabels,
    isComplete: complete,
    showLowCompletenessHint: percent < PROFILE_COMPLETENESS_LOW_THRESHOLD,
  };
}

/** 建档页实时表单（与 AssetCenter 本地 state 对齐） */
export function evaluateEnterpriseProfileCompletenessFromForm(input: {
  brandName: string;
  industryTagValue: string;
  oneLiner: string;
  productDesc: string;
  targetCustomer: string;
  customerPains: string[];
  keyPoints: string[];
  keywords: string[];
}): EnterpriseProfileCompleteness {
  return evaluateEnterpriseProfileCompletenessFromProfile({
    brandName: input.brandName,
    industryTag: input.industryTagValue,
    industry: input.industryTagValue,
    oneLiner: input.oneLiner,
    productDesc: input.productDesc,
    targetCustomer: input.targetCustomer,
    customerPains: input.customerPains,
    keyPoints: input.keyPoints,
    keywords: input.keywords,
  });
}

const PATHS_WITHOUT_PROFILE_HINT = new Set([
  "/clients",
  "/knowledge",
  "/settings",
  "/admin/config",
  "/admin/stats",
  "/admin/subscription",
]);

const GEO_FEATURE_PATH_PREFIXES = [
  "/workspace",
  "/ai-diagnosis",
  "/diagnosis",
  "/questions",
  "/weekly",
  "/content-generation",
  "/articles",
  "/templates",
  "/content-publishing",
  "/publish",
  "/inclusion-monitoring",
  "/monitoring",
  "/delivery-reports",
  "/reports",
  "/effective-actions",
  "/progress",
  "/responses",
  "/analysis",
  "/scores",
  "/projects",
  "/flow",
];

export function isEnterpriseProfileFeaturePath(pathname: string): boolean {
  const path = pathname.split("?")[0] || pathname;
  if (path === "/enterprise-profile" || path === "/assets") return false;
  if (PATHS_WITHOUT_PROFILE_HINT.has(path)) return false;
  return GEO_FEATURE_PATH_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}
