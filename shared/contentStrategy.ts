/** P1-B：内容类型 / 发布身份 / 账号组 */

export const CONTENT_ASSET_TYPES = [
  "brand_awareness",
  "problem_solution",
  "seeding",
  "competitor_compare",
  "case_story",
  "conversion_ad",
  "methodology",
  "faq",
] as const;

export type ContentAssetType = (typeof CONTENT_ASSET_TYPES)[number];

export const PUBLISH_IDENTITIES = [
  "official",
  "founder",
  "employee",
  "matrix",
  "third_party",
] as const;

export type PublishIdentity = (typeof PUBLISH_IDENTITIES)[number];

export const ACCOUNT_GROUP_TYPES = [
  "official_group",
  "employee_group",
  "matrix_group",
  "seeding_group",
  "ad_group",
] as const;

export type AccountGroupType = (typeof ACCOUNT_GROUP_TYPES)[number];

const CONTENT_ASSET_TYPE_LABELS: Record<ContentAssetType, string> = {
  brand_awareness: "品牌认知型",
  problem_solution: "问题解答型",
  seeding: "种草推荐型",
  competitor_compare: "竞品对比型",
  case_story: "案例证明型",
  conversion_ad: "广告转化型",
  methodology: "行业方法论型",
  faq: "FAQ问答型",
};

const PUBLISH_IDENTITY_LABELS: Record<PublishIdentity, string> = {
  official: "官方号",
  founder: "创始人号",
  employee: "员工号",
  matrix: "矩阵号",
  third_party: "第三方种草号",
};

const ACCOUNT_GROUP_LABELS: Record<AccountGroupType, string> = {
  official_group: "官方账号组",
  employee_group: "员工账号组",
  matrix_group: "矩阵账号组",
  seeding_group: "种草账号组",
  ad_group: "广告账号组",
};

export const CONTENT_ASSET_TYPE_OPTIONS = CONTENT_ASSET_TYPES.map(value => ({
  value,
  label: CONTENT_ASSET_TYPE_LABELS[value],
}));

export const PUBLISH_IDENTITY_OPTIONS = PUBLISH_IDENTITIES.map(value => ({
  value,
  label: PUBLISH_IDENTITY_LABELS[value],
}));

export const ACCOUNT_GROUP_OPTIONS = ACCOUNT_GROUP_TYPES.map(value => ({
  value,
  label: ACCOUNT_GROUP_LABELS[value],
}));

export function isContentAssetType(value: string | null | undefined): value is ContentAssetType {
  return Boolean(value && (CONTENT_ASSET_TYPES as readonly string[]).includes(value));
}

export function isPublishIdentity(value: string | null | undefined): value is PublishIdentity {
  return Boolean(value && (PUBLISH_IDENTITIES as readonly string[]).includes(value));
}

export function isAccountGroupType(value: string | null | undefined): value is AccountGroupType {
  return Boolean(value && (ACCOUNT_GROUP_TYPES as readonly string[]).includes(value));
}

export function getContentAssetTypeLabel(value: string | null | undefined): string {
  if (isContentAssetType(value)) return CONTENT_ASSET_TYPE_LABELS[value];
  return "";
}

export function getPublishIdentityLabel(value: string | null | undefined): string {
  if (isPublishIdentity(value)) return PUBLISH_IDENTITY_LABELS[value];
  return "";
}

export function getAccountGroupLabel(value: string | null | undefined): string {
  if (isAccountGroupType(value)) return ACCOUNT_GROUP_LABELS[value];
  return "";
}

export function defaultPublishIdentity(): PublishIdentity {
  return "official";
}

export function defaultRecommendedAccountGroup(): AccountGroupType {
  return "official_group";
}

/** 仅用于展示推断，不写库 */
export function inferContentStrategyFromArticleType(articleType?: string | null): ContentAssetType | null {
  const raw = (articleType ?? "").trim();
  if (!raw) return null;
  if (raw.includes("竞品") || raw.includes("对比")) return "competitor_compare";
  if (raw.includes("问答") || raw.includes("FAQ")) return "faq";
  if (raw.includes("案例")) return "case_story";
  if (raw.includes("选型") || raw.includes("行业")) return "methodology";
  if (raw.includes("官网") || raw.includes("品牌")) return "brand_awareness";
  return "problem_solution";
}

export function formatArticleStrategySummary(article: {
  contentStrategyType?: string | null;
  publishIdentity?: string | null;
  recommendedAccountGroup?: string | null;
  articleType?: string | null;
  contentType?: string | null;
}): string {
  const typeLabel =
    getContentAssetTypeLabel(article.contentStrategyType) ||
    getContentAssetTypeLabel(inferContentStrategyFromArticleType(article.articleType ?? article.contentType));
  const identityLabel = getPublishIdentityLabel(article.publishIdentity);
  const groupLabel = getAccountGroupLabel(article.recommendedAccountGroup);
  const parts = [typeLabel, identityLabel, groupLabel].filter(Boolean);
  if (parts.length === 0) return "未设置策略";
  return parts.join(" · ");
}

export function accountGroupsMismatch(
  recommended: string | null | undefined,
  bound: string | null | undefined,
): boolean {
  if (!isAccountGroupType(recommended)) return false;
  if (!isAccountGroupType(bound)) return false;
  return recommended !== bound;
}

export const ACCOUNT_GROUP_MISMATCH_HINT = (recommendedLabel: string, boundLabel: string) =>
  `当前文章推荐使用「${recommendedLabel}」发布，但当前绑定账号属于「${boundLabel}」。请确认是否继续发布，避免内容口吻与账号身份不匹配。`;
