import type { SearchPoolQuestionRow } from "./questionSearchPool";
import { resolveSourceTypeLabel } from "./questionSearchPool";

export const BRAND_SOURCE_PLATFORMS = [
  { value: "official_site", label: "官网" },
  { value: "wechat", label: "微信公众号" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "zhihu", label: "知乎" },
  { value: "sohu", label: "搜狐号" },
  { value: "netease", label: "网易号" },
  { value: "baijiahao", label: "百家号" },
  { value: "toutiao", label: "头条" },
  { value: "media", label: "媒体稿" },
  { value: "case_page", label: "客户案例" },
  { value: "third_party", label: "第三方评测" },
  { value: "other", label: "其他" },
] as const;

export type BrandSourcePlatform = (typeof BRAND_SOURCE_PLATFORMS)[number]["value"];

export const BRAND_SOURCE_PLATFORM_GROUPS = [
  { key: "official", label: "官网", platforms: ["official_site"] as const },
  { key: "knowledge", label: "知识平台", platforms: ["zhihu", "xiaohongshu"] as const },
  {
    key: "content",
    label: "内容平台",
    platforms: ["sohu", "netease", "baijiahao", "toutiao", "wechat"] as const,
  },
  { key: "media", label: "媒体与案例", platforms: ["media", "case_page"] as const },
  { key: "other", label: "其他", platforms: ["third_party", "other"] as const },
] as const;

/** 信源六项客户可理解指标（P1-B） */
export const BRAND_SOURCE_INDICATORS = [
  { key: "isPubliclyAccessible", label: "可访问" },
  { key: "containsBrandName", label: "有品牌名" },
  { key: "containsBusinessDescription", label: "有业务描述" },
  { key: "containsOfficialSite", label: "有官网链接/公司信息" },
  { key: "containsCoreKeywords", label: "有目标关键词" },
  { key: "aiCitationConfirmed", label: "被 AI 引用" },
] as const;

export type BrandSourceIndicatorKey = (typeof BRAND_SOURCE_INDICATORS)[number]["key"];

export const ENTITY_ANCHOR_TYPES = [
  { value: "brand_name", label: "品牌名称" },
  { value: "company_name", label: "公司名称" },
  { value: "main_business", label: "主营业务" },
  { value: "target_customer", label: "目标客户" },
  { value: "core_product", label: "核心产品/服务" },
  { value: "official_url", label: "官网链接" },
  { value: "target_keywords", label: "核心关键词" },
  { value: "customer_proof", label: "客户案例/背书" },
] as const;

export type EntityAnchorType = (typeof ENTITY_ANCHOR_TYPES)[number]["value"];

export type EntityConsistencyStatus = "consistent" | "partial" | "missing" | "conflict";

export const ENTITY_CONSISTENCY_STATUS_SCORE: Record<EntityConsistencyStatus, number> = {
  consistent: 100,
  partial: 70,
  missing: 30,
  conflict: 10,
};

export type BrandSourceRecordRow = {
  id: number;
  projectId: number;
  platform: string;
  sourceName?: string | null;
  platformName?: string | null;
  url?: string | null;
  isPubliclyAccessible: boolean;
  containsBrandName: boolean;
  containsBusinessDescription: boolean;
  containsOfficialSite: boolean;
  containsCoreKeywords: boolean;
  aiCitationConfirmed: boolean;
  isCrossSourceConsistent?: boolean;
  riskLevel?: "low" | "medium" | "high" | null;
  riskNotes?: string | null;
  notes?: string | null;
  lastVerifiedAt?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export type EntityAnchorRow = {
  id?: number;
  projectId: number;
  brandName?: string | null;
  companyName?: string | null;
  coreBusiness?: string | null;
  targetCustomer?: string | null;
  coreKeywords: string[];
  officialSite?: string | null;
  founderName?: string | null;
  typicalCases?: string | null;
};

export type EnterpriseProfileStandard = {
  brandName: string;
  companyName: string;
  mainBusiness: string;
  targetCustomer: string;
  coreProduct: string;
  officialUrl: string;
  targetKeywords: string[];
  customerProof: string;
};

export type EntityConsistencyCheckResult = {
  anchorType: EntityAnchorType;
  anchorLabel: string;
  standardValue: string;
  observedValues: string[];
  status: EntityConsistencyStatus;
  score: number;
  issueSummary: string;
  suggestion: string;
};

export type PageTopMetrics = {
  sourceCompleteness: number;
  entityConsistency: number;
  aiIdentifiability: number;
  priorityFixCount: number;
};

export type PersistedEnhancementSuggestionDraft = {
  suggestionKey: string;
  suggestionTitle: string;
  gapType: string;
  targetPlatform: string | null;
  targetKeywords: string[];
  contentDirection: string;
  priority: "P0" | "P1" | "P2";
  relatedQuestions: string[];
};

const PLATFORM_LABEL = Object.fromEntries(BRAND_SOURCE_PLATFORMS.map(p => [p.value, p.label])) as Record<
  string,
  string
>;

const CONSISTENCY_WEIGHTS: Record<BrandSourceIndicatorKey, number> = {
  isPubliclyAccessible: 18,
  containsBrandName: 18,
  containsBusinessDescription: 16,
  containsOfficialSite: 16,
  containsCoreKeywords: 16,
  aiCitationConfirmed: 16,
};

const AI_IDENTIFIABILITY_KEYS: BrandSourceIndicatorKey[] = [
  "containsBrandName",
  "containsBusinessDescription",
  "containsOfficialSite",
  "containsCoreKeywords",
  "aiCitationConfirmed",
];

const LOW_PASS_RATE_THRESHOLD = 50;

const ANCHOR_INDICATOR_MAP: Partial<Record<EntityAnchorType, BrandSourceIndicatorKey>> = {
  brand_name: "containsBrandName",
  company_name: "containsOfficialSite",
  main_business: "containsBusinessDescription",
  target_customer: "containsBusinessDescription",
  core_product: "containsBusinessDescription",
  official_url: "containsOfficialSite",
  target_keywords: "containsCoreKeywords",
  customer_proof: "containsBrandName",
};

const GAP_SUGGESTION_COPY: Record<
  string,
  { title: string; direction: string; taskType: "官网首页" | "产品页" | "行业文章" | "客户案例" | "社媒内容" }
> = {
  brand_name: {
    title: "补充品牌介绍类内容",
    direction: "在主要信源中明确写出品牌名称，并与企业档案保持一致。",
    taskType: "社媒内容",
  },
  main_business: {
    title: "补充业务说明类内容",
    direction: "用客户能听懂的语言说明主营业务与核心价值。",
    taskType: "产品页",
  },
  target_customer: {
    title: "补充客户场景类内容",
    direction: "描述典型客户画像与适用场景，帮助 AI 理解服务对象。",
    taskType: "行业文章",
  },
  official_url: {
    title: "补充带官网和公司信息的第三方内容",
    direction: "在第三方内容中附上官网链接与公司名称。",
    taskType: "官网首页",
  },
  target_keywords: {
    title: "补充品类关键词内容",
    direction: "围绕核心品类关键词撰写可被 AI 引用的说明内容。",
    taskType: "行业文章",
  },
  customer_proof: {
    title: "补充客户案例 / 成功案例内容",
    direction: "发布可验证的客户案例或第三方背书，增强 AI 信任度。",
    taskType: "客户案例",
  },
  core_product: {
    title: "补充核心产品/服务说明",
    direction: "清晰描述核心产品或服务，避免 AI 误解业务范围。",
    taskType: "产品页",
  },
  company_name: {
    title: "统一公司名称表达",
    direction: "确保各信源使用与企业档案一致的公司全称。",
    taskType: "官网首页",
  },
};

export function resolveBrandSourcePlatformLabel(platform: string, platformName?: string | null): string {
  if (platform === "other" && platformName?.trim()) return platformName.trim();
  return PLATFORM_LABEL[platform] ?? platformName?.trim() ?? platform;
}

export function resolveBrandSourceDisplayName(record: BrandSourceRecordRow): string {
  if (record.sourceName?.trim()) return record.sourceName.trim();
  return resolveBrandSourcePlatformLabel(record.platform, record.platformName);
}

export function parseCoreKeywordsInput(raw: string): string[] {
  return raw
    .split(/[,，、\n]/)
    .map(part => part.trim())
    .filter(Boolean);
}

export function formatCoreKeywordsInput(keywords?: string[] | null): string {
  return (keywords ?? []).join("、");
}

export function normalizeBrandSourceRecord(record: BrandSourceRecordRow): BrandSourceRecordRow {
  return {
    ...record,
    containsBusinessDescription: record.containsBusinessDescription ?? false,
    riskLevel: record.riskLevel ?? "low",
  };
}

export function isBrandSourceIncomplete(record: BrandSourceRecordRow): boolean {
  const normalized = normalizeBrandSourceRecord(record);
  return !normalized.isPubliclyAccessible || !normalized.containsBrandName;
}

export function deriveBrandSourceRisk(record: BrandSourceRecordRow): {
  riskLevel: "low" | "medium" | "high";
  riskNotes: string | null;
} {
  const normalized = normalizeBrandSourceRecord(record);
  const failedIndicators = BRAND_SOURCE_INDICATORS.filter(item => !normalized[item.key]).map(item => item.label);
  if (!normalized.isPubliclyAccessible || !normalized.containsBrandName) {
    return {
      riskLevel: "high",
      riskNotes: `缺少关键项：${failedIndicators.slice(0, 3).join("、") || "可访问/品牌名"}`,
    };
  }
  if (failedIndicators.length >= 3) {
    return { riskLevel: "medium", riskNotes: `待完善：${failedIndicators.join("、")}` };
  }
  if (failedIndicators.length > 0) {
    return { riskLevel: "low", riskNotes: `可优化：${failedIndicators.join("、")}` };
  }
  return { riskLevel: "low", riskNotes: null };
}

function metricPassRate(records: BrandSourceRecordRow[], key: BrandSourceIndicatorKey): number {
  if (records.length === 0) return 0;
  const passed = records.filter(r => Boolean(normalizeBrandSourceRecord(r)[key])).length;
  return Math.round((passed / records.length) * 100);
}

export function computeSourceCompleteness(records: BrandSourceRecordRow[]): number {
  if (records.length === 0) return 0;
  const indicatorAvg =
    BRAND_SOURCE_INDICATORS.reduce((sum, item) => sum + metricPassRate(records, item.key), 0) /
    BRAND_SOURCE_INDICATORS.length;
  const countFactor = Math.min(100, Math.round((Math.min(records.length, 8) / 8) * 100));
  return Math.round(indicatorAvg * 0.75 + countFactor * 0.25);
}

export function computeAiIdentifiability(records: BrandSourceRecordRow[]): number {
  if (records.length === 0) return 0;
  const rates = AI_IDENTIFIABILITY_KEYS.map(key => metricPassRate(records, key));
  return Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length);
}

export function computeConsistencyScore(records: BrandSourceRecordRow[]) {
  const normalized = records.map(normalizeBrandSourceRecord);
  const metricScores = BRAND_SOURCE_INDICATORS.map(indicator => ({
    key: indicator.key,
    label: indicator.label,
    passRate: metricPassRate(normalized, indicator.key),
    weight: CONSISTENCY_WEIGHTS[indicator.key],
  }));

  const totalScore =
    normalized.length === 0
      ? 0
      : Math.round(metricScores.reduce((sum, item) => sum + (item.passRate * item.weight) / 100, 0));

  const mainIssues = metricScores
    .filter(item => item.passRate < LOW_PASS_RATE_THRESHOLD)
    .map(item => `${item.label}完成度偏低（${item.passRate}%）`);

  if (normalized.length === 0) {
    mainIssues.push("尚未录入任何信源");
  }

  return {
    totalScore: Math.min(100, Math.max(0, totalScore)),
    metricScores,
    mainIssues,
  };
}

export function extractEnterpriseProfileStandard(input: {
  profile?: {
    enterpriseName?: string | null;
    shortName?: string | null;
    brandName?: string | null;
    officialWebsite?: string | null;
    productServiceIntro?: string | null;
    productDesc?: string | null;
    targetCustomer?: string | null;
    targetCustomers?: string | null;
    fitCustomers?: string | null;
    keywords?: string[] | null;
    hasCases?: boolean | null;
    oneLiner?: string | null;
  } | null;
  entityAnchor?: EntityAnchorRow | null;
  customerCaseNames?: string[];
}): EnterpriseProfileStandard {
  const profile = input.profile ?? {};
  const anchor = input.entityAnchor;
  const brandName =
    anchor?.brandName?.trim() ||
    profile.brandName?.trim() ||
    profile.shortName?.trim() ||
    profile.enterpriseName?.trim() ||
    "";
  const companyName = anchor?.companyName?.trim() || profile.enterpriseName?.trim() || brandName;
  const mainBusiness =
    anchor?.coreBusiness?.trim() ||
    profile.productServiceIntro?.trim() ||
    profile.productDesc?.trim() ||
    profile.oneLiner?.trim() ||
    "";
  const targetCustomer =
    anchor?.targetCustomer?.trim() ||
    profile.targetCustomer?.trim() ||
    profile.targetCustomers?.trim() ||
    profile.fitCustomers?.trim() ||
    "";
  const coreProduct = profile.productDesc?.trim() || mainBusiness;
  const officialUrl = anchor?.officialSite?.trim() || profile.officialWebsite?.trim() || "";
  const targetKeywords =
    (anchor?.coreKeywords?.length ? anchor.coreKeywords : profile.keywords)?.filter(Boolean) ?? [];
  const customerProof =
    anchor?.typicalCases?.trim() ||
    (input.customerCaseNames?.length ? input.customerCaseNames.join("、") : "") ||
    (profile.hasCases ? "企业档案已标记有客户案例" : "");

  return {
    brandName,
    companyName,
    mainBusiness,
    targetCustomer,
    coreProduct,
    officialUrl,
    targetKeywords,
    customerProof,
  };
}

function standardValueForAnchor(type: EntityAnchorType, standard: EnterpriseProfileStandard): string {
  switch (type) {
    case "brand_name":
      return standard.brandName;
    case "company_name":
      return standard.companyName;
    case "main_business":
      return standard.mainBusiness;
    case "target_customer":
      return standard.targetCustomer;
    case "core_product":
      return standard.coreProduct;
    case "official_url":
      return standard.officialUrl;
    case "target_keywords":
      return formatCoreKeywordsInput(standard.targetKeywords);
    case "customer_proof":
      return standard.customerProof;
    default:
      return "";
  }
}

function observedValuesForAnchor(
  type: EntityAnchorType,
  records: BrandSourceRecordRow[],
  standard: EnterpriseProfileStandard,
): string[] {
  const indicator = ANCHOR_INDICATOR_MAP[type];
  if (!indicator) return [];
  const observed: string[] = [];
  for (const record of records) {
    const normalized = normalizeBrandSourceRecord(record);
    const label = resolveBrandSourceDisplayName(normalized);
    if (normalized[indicator]) {
      observed.push(`${label}：已覆盖`);
    } else {
      observed.push(`${label}：未覆盖`);
    }
  }
  if (type === "customer_proof") {
    const caseSources = records.filter(r => r.platform === "case_page" || r.platform === "media");
    if (caseSources.length === 0 && records.length > 0) {
      observed.push("尚未录入客户案例或媒体背书类信源");
    }
  }
  if (type === "official_url" && standard.officialUrl) {
    const officialSources = records.filter(r => r.platform === "official_site");
    if (officialSources.some(r => r.url?.includes(standard.officialUrl.replace(/^https?:\/\//, "")))) {
      observed.push("官网信源 URL 与档案一致");
    }
  }
  return observed;
}

function evaluateAnchorStatus(
  type: EntityAnchorType,
  records: BrandSourceRecordRow[],
  standard: EnterpriseProfileStandard,
): Pick<EntityConsistencyCheckResult, "status" | "issueSummary" | "suggestion"> {
  const standardValue = standardValueForAnchor(type, standard);
  const indicator = ANCHOR_INDICATOR_MAP[type];
  const passRate = indicator ? metricPassRate(records, indicator) : 0;
  const anchorMeta = ENTITY_ANCHOR_TYPES.find(item => item.value === type);

  if (!standardValue.trim()) {
    return {
      status: "missing",
      issueSummary: `企业档案尚未填写${anchorMeta?.label ?? "品牌关键信息"}`,
      suggestion: `请先在品牌资产建档中补充${anchorMeta?.label ?? "对应信息"}。`,
    };
  }
  if (records.length === 0) {
    return {
      status: "missing",
      issueSummary: "尚未录入信源，无法验证一致性",
      suggestion: "请先添加官网、内容平台或客户案例等公开信源链接。",
    };
  }

  if (passRate === 100) {
    return {
      status: "consistent",
      issueSummary: "各信源均已覆盖该品牌关键信息",
      suggestion: "保持现有表达，并在新内容中延续同一口径。",
    };
  }
  if (passRate === 0) {
    if (type === "customer_proof" && !records.some(r => r.platform === "case_page" || r.platform === "media")) {
      return {
        status: "missing",
        issueSummary: "缺少客户案例或媒体背书类信源",
        suggestion: GAP_SUGGESTION_COPY.customer_proof.direction,
      };
    }
    return {
      status: "missing",
      issueSummary: `${anchorMeta?.label ?? "品牌关键信息"}在各信源中均未体现`,
      suggestion: GAP_SUGGESTION_COPY[type]?.direction ?? "请在主要信源中补充对应信息。",
    };
  }

  const conflictTypes: EntityAnchorType[] = ["brand_name", "company_name", "official_url"];
  if (conflictTypes.includes(type) && passRate > 0 && passRate < 100) {
    return {
      status: "conflict",
      issueSummary: `${anchorMeta?.label ?? "品牌关键信息"}在不同信源中表达不一致`,
      suggestion: "统一各平台的品牌/公司/官网表述，避免 AI 识别混乱。",
    };
  }

  return {
    status: "partial",
    issueSummary: `${anchorMeta?.label ?? "品牌关键信息"}仅在部分信源中体现（${passRate}%）`,
    suggestion: GAP_SUGGESTION_COPY[type]?.direction ?? "请在更多信源中补充一致信息。",
  };
}

export function computeEntityConsistencyChecks(
  records: BrandSourceRecordRow[],
  standard: EnterpriseProfileStandard,
): EntityConsistencyCheckResult[] {
  return ENTITY_ANCHOR_TYPES.map(meta => {
    const statusResult = evaluateAnchorStatus(meta.value, records, standard);
    return {
      anchorType: meta.value,
      anchorLabel: meta.label,
      standardValue: standardValueForAnchor(meta.value, standard) || "—",
      observedValues: observedValuesForAnchor(meta.value, records, standard),
      status: statusResult.status,
      score: ENTITY_CONSISTENCY_STATUS_SCORE[statusResult.status],
      issueSummary: statusResult.issueSummary,
      suggestion: statusResult.suggestion,
    };
  });
}

export function computeEntityConsistencyAverage(checks: EntityConsistencyCheckResult[]): number {
  if (checks.length === 0) return 0;
  return Math.round(checks.reduce((sum, item) => sum + item.score, 0) / checks.length);
}

export function countPriorityFixItems(
  records: BrandSourceRecordRow[],
  checks: EntityConsistencyCheckResult[],
): number {
  const highRiskSources = records.filter(r => normalizeBrandSourceRecord(r).riskLevel === "high").length;
  const anchorIssues = checks.filter(item => item.status === "missing" || item.status === "conflict").length;
  return highRiskSources + anchorIssues;
}

export function computePageTopMetrics(
  records: BrandSourceRecordRow[],
  checks: EntityConsistencyCheckResult[],
): PageTopMetrics {
  return {
    sourceCompleteness: computeSourceCompleteness(records),
    entityConsistency: computeEntityConsistencyAverage(checks),
    aiIdentifiability: computeAiIdentifiability(records),
    priorityFixCount: countPriorityFixItems(records, checks),
  };
}

export function buildBrandSourceOverviewMetrics(records: BrandSourceRecordRow[]) {
  const normalized = records.map(normalizeBrandSourceRecord);
  const checks = computeEntityConsistencyChecks(normalized, {
    brandName: "",
    companyName: "",
    mainBusiness: "",
    targetCustomer: "",
    coreProduct: "",
    officialUrl: "",
    targetKeywords: [],
    customerProof: "",
  });
  const topMetrics = computePageTopMetrics(normalized, checks);
  const aiCited = normalized.filter(r => r.aiCitationConfirmed).length;
  const incomplete = normalized.filter(isBrandSourceIncomplete).length;
  const latestVerified = normalized
    .map(r => (r.lastVerifiedAt ? new Date(r.lastVerifiedAt).getTime() : 0))
    .reduce((max, ts) => Math.max(max, ts), 0);
  return {
    total: normalized.length,
    consistencyScore: topMetrics.entityConsistency,
    sourceCompleteness: topMetrics.sourceCompleteness,
    aiIdentifiability: topMetrics.aiIdentifiability,
    priorityFixCount: topMetrics.priorityFixCount,
    aiCitedCount: aiCited,
    aiCitedRatio: normalized.length > 0 ? `${aiCited}/${normalized.length}` : "0/0",
    incompleteCount: incomplete,
    latestVerifiedAt: latestVerified > 0 ? new Date(latestVerified) : null,
  };
}

export function groupBrandSourcesByPlatformType(records: BrandSourceRecordRow[]) {
  return BRAND_SOURCE_PLATFORM_GROUPS.map(group => ({
    ...group,
    records: records.filter(r => (group.platforms as readonly string[]).includes(r.platform)),
  }));
}

export type EnhancementSuggestion = {
  id: string;
  kind: "brand_name" | "core_keywords" | "ai_citation" | "accessibility" | "official_site" | "consistency";
  icon: "alert" | "keyword" | "citation" | "link";
  description: string;
  affectedSources: string[];
  relatedQuestions: string[];
  platform?: string;
};

function sourceDisplayName(record: BrandSourceRecordRow): string {
  return resolveBrandSourceDisplayName(record);
}

export function buildPersistedEnhancementSuggestions(input: {
  records: BrandSourceRecordRow[];
  standard: EnterpriseProfileStandard;
  checks: EntityConsistencyCheckResult[];
  questions: SearchPoolQuestionRow[];
}): PersistedEnhancementSuggestionDraft[] {
  const { records, standard, checks, questions } = input;
  if (records.length === 0) return [];

  const drafts: PersistedEnhancementSuggestionDraft[] = [];
  const gapChecks = checks.filter(item => item.status === "missing" || item.status === "partial" || item.status === "conflict");

  for (const check of gapChecks) {
    const copy = GAP_SUGGESTION_COPY[check.anchorType];
    if (!copy) continue;
    const weakPlatforms = records
      .filter(record => {
        const indicator = ANCHOR_INDICATOR_MAP[check.anchorType];
        return indicator ? !normalizeBrandSourceRecord(record)[indicator] : false;
      })
      .map(record => record.platform);
    const targetPlatform = weakPlatforms[0] ?? records[0]?.platform ?? null;
    const relatedQuestions = questions
      .filter(q => {
        if (check.anchorType === "target_keywords") return q.searchPoolType === "long_tail_pain";
        if (check.anchorType === "target_customer") return q.searchPoolType === "scenario_need";
        if (check.anchorType === "customer_proof") return q.searchPoolType === "industry_location";
        if (targetPlatform) return (q.requiredSourceTypes ?? []).includes(targetPlatform);
        return false;
      })
      .map(q => q.questionText)
      .slice(0, 3);
    drafts.push({
      suggestionKey: `${check.anchorType}:${targetPlatform ?? "all"}`,
      suggestionTitle: copy.title,
      gapType: check.anchorType,
      targetPlatform,
      targetKeywords: standard.targetKeywords.slice(0, 5),
      contentDirection: `${copy.direction}${relatedQuestions.length ? `；关联问题池：${relatedQuestions.join("；")}` : ""}`,
      priority: check.status === "missing" || check.status === "conflict" ? "P0" : "P1",
      relatedQuestions,
    });
  }

  const lowMentionTypes = ["brand_direct", "category_recommendation", "scenario_need"] as const;
  for (const poolType of lowMentionTypes) {
    const typeQuestions = questions.filter(q => q.searchPoolType === poolType);
    if (typeQuestions.length === 0) continue;
    const weakCount = typeQuestions.filter(
      q => q.lastTestResult === "not_mentioned" || q.lastTestResult === "competitor_won",
    ).length;
    if (weakCount === 0) continue;
    const ratio = weakCount / typeQuestions.length;
    if (ratio < 0.34) continue;
    drafts.push({
      suggestionKey: `question-pool:${poolType}`,
      suggestionTitle: `优先补强${resolveQuestionPoolTypeLabel(poolType)}相关信源`,
      gapType: "question_pool_gap",
      targetPlatform: typeQuestions[0]?.requiredSourceTypes?.[0] ?? null,
      targetKeywords: standard.targetKeywords.slice(0, 5),
      contentDirection: `问题池中 ${weakCount}/${typeQuestions.length} 条${resolveQuestionPoolTypeLabel(poolType)}问题提及率偏低，建议补充对应平台信源。`,
      priority: ratio >= 0.5 ? "P0" : "P1",
      relatedQuestions: typeQuestions.slice(0, 3).map(q => q.questionText),
    });
  }

  return drafts;
}

function resolveQuestionPoolTypeLabel(poolType: string): string {
  const labels: Record<string, string> = {
    brand_direct: "品牌直问",
    category_recommendation: "品类推荐",
    scenario_need: "场景需求",
    competitor_compare: "竞品对比",
    industry_location: "行业定位",
    long_tail_pain: "长尾痛点",
  };
  return labels[poolType] ?? poolType;
}

export function resolveGapTypeLabel(gapType: string): string {
  const meta = ENTITY_ANCHOR_TYPES.find(item => item.value === gapType);
  if (meta) return meta.label;
  if (gapType === "question_pool_gap") return "问题池提及率偏低";
  return gapType;
}

export function buildEnhancementSuggestions(
  records: BrandSourceRecordRow[],
  questions: SearchPoolQuestionRow[],
  anchors?: EntityAnchorRow | null,
): EnhancementSuggestion[] {
  const standard = extractEnterpriseProfileStandard({ entityAnchor: anchors ?? null });
  const checks = computeEntityConsistencyChecks(records.map(normalizeBrandSourceRecord), standard);
  const persisted = buildPersistedEnhancementSuggestions({ records, standard, checks, questions });

  return persisted.map(item => ({
    id: item.suggestionKey,
    kind:
      item.gapType === "target_keywords"
        ? "core_keywords"
        : item.gapType === "official_url"
          ? "official_site"
          : item.gapType === "brand_name"
            ? "brand_name"
            : item.gapType === "question_pool_gap"
              ? "accessibility"
              : "consistency",
    icon:
      item.gapType === "target_keywords"
        ? "keyword"
        : item.gapType === "question_pool_gap"
          ? "link"
          : "alert",
    description: item.contentDirection,
    affectedSources: records
      .filter(record => !item.targetPlatform || record.platform === item.targetPlatform)
      .map(sourceDisplayName),
    relatedQuestions: item.relatedQuestions,
    platform: item.targetPlatform ?? undefined,
  }));
}

export function resolveEnhancementTaskType(gapType: string): "官网首页" | "产品页" | "行业文章" | "客户案例" | "社媒内容" {
  return GAP_SUGGESTION_COPY[gapType]?.taskType ?? "行业文章";
}

export function pickSidebarMainGaps(mainIssues: string[], limit = 2): string[] {
  return mainIssues.slice(0, limit);
}

export function resolveEntityConsistencyStatusLabel(status: EntityConsistencyStatus): string {
  const labels: Record<EntityConsistencyStatus, string> = {
    consistent: "一致",
    partial: "部分不一致",
    missing: "缺失",
    conflict: "冲突",
  };
  return labels[status];
}
