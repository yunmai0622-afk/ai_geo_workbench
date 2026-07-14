export const BRAND_TRUTH_VERIFICATION_STATUSES = [
  "provided_unverified",
  "official_verified",
  "third_party_verified",
  "multi_source_verified",
  "conflicting",
  "outdated",
  "deprecated",
  "unknown",
] as const;

export type BrandTruthVerificationStatus = (typeof BRAND_TRUTH_VERIFICATION_STATUSES)[number];

export const BRAND_TRUTH_STATUS_LABELS: Record<BrandTruthVerificationStatus, string> = {
  provided_unverified: "待核验",
  official_verified: "官方已确认",
  third_party_verified: "第三方已确认",
  multi_source_verified: "多来源一致",
  conflicting: "来源冲突",
  outdated: "信息过时",
  deprecated: "已停用",
  unknown: "暂无法确认",
};

export const BRAND_TRUTH_CATEGORIES = [
  { id: "identity", label: "品牌身份事实", question: "AI 是否知道品牌是谁？" },
  { id: "business", label: "业务定义事实", question: "AI 是否准确理解品牌做什么？" },
  { id: "capability_boundary", label: "能力与边界事实", question: "AI 是否理解品牌能做和不能做什么？" },
  { id: "temporal", label: "时效事实", question: "AI 使用的信息是否仍然有效？" },
] as const;

export const BRAND_TRUTH_FACT_DEFINITIONS = [
  ["identity", "brand_name", "标准品牌名", "critical"],
  ["identity", "company_name", "公司主体", "critical"],
  ["identity", "official_website", "官网", "critical"],
  ["identity", "brand_aliases", "品牌别名", "medium"],
  ["identity", "former_names", "曾用名", "medium"],
  ["identity", "product_names", "产品名称", "high"],
  ["identity", "industry", "所属行业", "high"],
  ["identity", "category", "所属品类", "high"],
  ["identity", "brand_company_relation", "品牌与公司主体关系", "high"],
  ["identity", "brand_product_relation", "品牌与产品关系", "medium"],
  ["identity", "official_accounts", "官方公开账号", "medium"],
  ["business", "one_line_definition", "一句话标准定义", "critical"],
  ["business", "core_business", "核心业务", "critical"],
  ["business", "main_products", "主要产品", "high"],
  ["business", "main_services", "主要服务", "high"],
  ["business", "problems_solved", "解决的问题", "critical"],
  ["business", "target_customers", "目标客户", "critical"],
  ["business", "non_target_customers", "不适用客户", "high"],
  ["business", "use_cases", "典型使用场景", "high"],
  ["business", "core_capabilities", "核心能力", "critical"],
  ["business", "differentiators", "差异化", "high"],
  ["business", "business_model", "商业模式", "medium"],
  ["business", "service_model", "服务方式", "medium"],
  ["capability_boundary", "confirmed_capabilities", "明确具备的能力", "critical"],
  ["capability_boundary", "unsupported_capabilities", "明确不具备的能力", "critical"],
  ["capability_boundary", "prohibited_promises", "不应对外承诺的能力", "critical"],
  ["capability_boundary", "exaggeration_risks", "容易被夸大的能力", "high"],
  ["capability_boundary", "misunderstood_business", "容易被误解的业务", "high"],
  ["capability_boundary", "competitor_confusion", "与竞品容易混淆的能力", "high"],
  ["capability_boundary", "current_limitations", "当前限制条件", "high"],
  ["capability_boundary", "applicable_boundaries", "适用边界", "high"],
  ["capability_boundary", "non_applicable_boundaries", "不适用边界", "high"],
  ["temporal", "active_business", "当前有效业务", "critical"],
  ["temporal", "active_products", "当前有效产品", "high"],
  ["temporal", "discontinued_business", "已停止业务", "high"],
  ["temporal", "discontinued_products", "已停止产品", "high"],
  ["temporal", "historical_names", "历史名称", "medium"],
  ["temporal", "historical_positioning", "历史定位", "medium"],
  ["temporal", "outdated_data", "已过时数据", "high"],
  ["temporal", "effective_at", "生效时间", "medium"],
  ["temporal", "expires_at", "失效时间", "medium"],
  ["temporal", "last_confirmed_at", "最近确认时间", "high"],
] as const;

export type BrandTruthFactDefinition = {
  category: (typeof BRAND_TRUTH_CATEGORIES)[number]["id"];
  key: string;
  label: string;
  importance: "critical" | "high" | "medium" | "low";
};

export function listBrandTruthFactDefinitions(): BrandTruthFactDefinition[] {
  return BRAND_TRUTH_FACT_DEFINITIONS.map(([category, key, label, importance]) => ({
    category,
    key,
    label,
    importance,
  }));
}

export function isVerifiedTruthStatus(status: BrandTruthVerificationStatus): boolean {
  return status === "official_verified" || status === "third_party_verified" || status === "multi_source_verified";
}

export function canUseFactAsConfirmedTruth(input: {
  verificationStatus: BrandTruthVerificationStatus;
  sourceCount?: number;
}): boolean {
  return isVerifiedTruthStatus(input.verificationStatus) && (input.sourceCount ?? 0) > 0;
}

export function normalizeTruthValue(value: string): string {
  return value.trim().replace(/\s+/g, " ").replace(/[，。；：、]/g, "").toLocaleLowerCase("zh-CN");
}

export function calculateTruthProfileStats(facts: Array<{
  factKey: string;
  verificationStatus: BrandTruthVerificationStatus;
}>): {
  completenessScore: number;
  verifiedFactRate: number;
  conflictCount: number;
  outdatedFactCount: number;
} {
  const definitions = listBrandTruthFactDefinitions();
  const active = facts.filter(fact => fact.verificationStatus !== "deprecated");
  const presentKeys = new Set(active.map(fact => fact.factKey));
  const verified = active.filter(fact => isVerifiedTruthStatus(fact.verificationStatus));
  return {
    completenessScore: Math.round((presentKeys.size / definitions.length) * 100),
    verifiedFactRate: active.length ? Math.round((verified.length / active.length) * 100) : 0,
    conflictCount: active.filter(fact => fact.verificationStatus === "conflicting").length,
    outdatedFactCount: active.filter(fact => fact.verificationStatus === "outdated").length,
  };
}

export const BRAND_TRUTH_EVIDENCE_TYPES = [
  "官网首页", "品牌定义页", "产品服务页", "FAQ", "帮助中心", "Schema / JSON-LD", "企业主体资料",
  "客户案例", "客户评价", "数据报告", "认证与荣誉", "媒体报道", "行业资料", "第三方平台",
  "合作伙伴页面", "知乎文章", "公众号文章", "其他公开内容",
] as const;
