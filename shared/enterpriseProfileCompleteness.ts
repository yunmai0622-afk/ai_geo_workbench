/**
 * GEO-V1.1-Profile-Completeness：企业资料 8 项核心字段完整度（0–100%）
 * 与 evaluateGeoProfileP0Readiness / AssetCenter 建档页口径一致。
 */

import { evaluateGeoProfileP0Readiness } from "./geoProfileP0Readiness";

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

const LABEL_TO_KEY: Record<string, ProfileCompletenessFieldKey> = {
  企业名称: "brandName",
  所属行业: "industry",
  一句话介绍: "oneLiner",
  "核心产品/服务": "productDesc",
  目标客户: "targetCustomer",
  主要解决的问题: "primaryPain",
  核心优势: "coreAdvantage",
  关键词: "keywords",
};

export const PROFILE_COMPLETENESS_FIELD_LABELS: Record<ProfileCompletenessFieldKey, string> = {
  brandName: "企业名称",
  industry: "所属行业",
  oneLiner: "一句话介绍",
  productDesc: "核心产品/服务",
  targetCustomer: "目标客户",
  primaryPain: "主要解决的问题",
  coreAdvantage: "核心优势",
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

function labelsToMissingKeys(labels: string[]): ProfileCompletenessFieldKey[] {
  return labels
    .map(label => LABEL_TO_KEY[label])
    .filter((k): k is ProfileCompletenessFieldKey => Boolean(k));
}

export function evaluateEnterpriseProfileCompletenessFromProfile(
  profile: Record<string, unknown> | null | undefined,
): EnterpriseProfileCompleteness {
  const { complete, missingLabels } = evaluateGeoProfileP0Readiness(profile);
  const missingKeys = labelsToMissingKeys(missingLabels);
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
  "/tasks",
  "/projects",
  "/flow",
];

export function isEnterpriseProfileFeaturePath(pathname: string): boolean {
  const path = pathname.split("?")[0] || pathname;
  if (path === "/enterprise-profile" || path === "/assets") return false;
  if (PATHS_WITHOUT_PROFILE_HINT.has(path)) return false;
  return GEO_FEATURE_PATH_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}
