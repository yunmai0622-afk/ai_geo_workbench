import { canUseFactAsConfirmedTruth, normalizeTruthValue, type BrandTruthVerificationStatus } from "./brandTruth";

export const UNDERSTANDING_FIELD_STATUSES = [
  "accurate", "mostly_accurate", "partially_accurate", "missing", "inaccurate", "outdated", "conflicting", "hallucinated", "unverifiable",
] as const;
export type UnderstandingFieldStatus = (typeof UNDERSTANDING_FIELD_STATUSES)[number];

export const UNDERSTANDING_STATUS_LABELS: Record<UnderstandingFieldStatus, string> = {
  accurate: "准确",
  mostly_accurate: "基本准确",
  partially_accurate: "部分准确",
  missing: "关键缺失",
  inaccurate: "理解错误",
  outdated: "信息过时",
  conflicting: "表达冲突",
  hallucinated: "疑似虚构",
  unverifiable: "暂无法核验",
};

export const UNDERSTANDING_DIMENSIONS = [
  { id: "brand_identity", label: "品牌身份", weight: 15, factKeys: ["brand_name", "company_name", "official_website", "brand_company_relation"] },
  { id: "category", label: "品类归属", weight: 10, factKeys: ["industry", "category"] },
  { id: "core_business", label: "核心业务", weight: 20, factKeys: ["one_line_definition", "core_business", "problems_solved"] },
  { id: "products_services", label: "产品与服务", weight: 15, factKeys: ["main_products", "main_services"] },
  { id: "target_customers", label: "目标客户", weight: 15, factKeys: ["target_customers", "non_target_customers"] },
  { id: "use_cases", label: "使用场景", weight: 10, factKeys: ["use_cases"] },
  { id: "capabilities", label: "核心能力与差异化", weight: 10, factKeys: ["core_capabilities", "differentiators"] },
  { id: "boundaries_temporal", label: "业务边界与时效", weight: 5, factKeys: ["unsupported_capabilities", "prohibited_promises", "current_limitations", "active_business", "discontinued_business", "outdated_data"] },
] as const;

export const DEFAULT_UNDERSTANDING_METHODOLOGY = {
  id: "understand-accuracy-general-v1",
  version: 1,
  industryTemplate: "general",
  ruleVersion: "understand-severity-v1",
  extractionVersion: "understand-extraction-v1",
  dimensions: UNDERSTANDING_DIMENSIONS,
} as const;

export const ASSESSMENT_STATUSES = ["not_measured", "insufficient_data", "unknown", "no_issue_detected", "issue_detected"] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export type UnderstandingDimensionId = (typeof UNDERSTANDING_DIMENSIONS)[number]["id"];

export const DEFAULT_UNDERSTANDING_QUESTION_TEMPLATES = [
  ["identity", "[品牌] 是什么？", ["brand_name", "one_line_definition"]],
  ["identity", "[品牌] 属于哪个公司？", ["company_name", "brand_company_relation"]],
  ["identity", "[品牌] 的官网是什么？", ["official_website"]],
  ["identity", "[品牌] 和 [公司主体] 是什么关系？", ["brand_company_relation"]],
  ["business", "[品牌] 主要做什么？", ["core_business"]],
  ["business", "[品牌] 主要解决什么问题？", ["problems_solved"]],
  ["business", "[品牌] 提供哪些产品或服务？", ["main_products", "main_services"]],
  ["business", "[品牌] 属于什么行业和品类？", ["industry", "category"]],
  ["target_customer", "[品牌] 适合哪些客户？", ["target_customers"]],
  ["target_customer", "哪些企业适合使用 [品牌]？", ["target_customers"]],
  ["target_customer", "[品牌] 不适合哪些客户或场景？", ["non_target_customers", "non_applicable_boundaries"]],
  ["capability", "[品牌] 的核心能力有哪些？", ["core_capabilities"]],
  ["capability", "[品牌] 与普通方案有什么区别？", ["differentiators"]],
  ["capability", "[品牌] 的主要优势是什么？", ["differentiators"]],
  ["capability", "[品牌] 有哪些限制？", ["current_limitations"]],
  ["scenario", "[品牌] 常用于哪些业务场景？", ["use_cases"]],
  ["scenario", "哪些情况下应该选择 [品牌]？", ["applicable_boundaries"]],
  ["scenario", "哪些情况下不建议使用 [品牌]？", ["non_applicable_boundaries"]],
  ["boundary", "[品牌] 与 [竞品] 有什么区别？", ["competitor_confusion", "differentiators"]],
  ["boundary", "[品牌] 是否提供 [易混淆能力]？", ["unsupported_capabilities", "misunderstood_business"]],
  ["boundary", "[品牌] 当前是否仍提供 [历史业务]？", ["discontinued_business", "active_business"]],
] as const;

export type ExtractedUnderstandingFacts = {
  detectedBrandName: string | null;
  detectedCompanyName: string | null;
  detectedOfficialWebsite: string | null;
  detectedIndustry: string | null;
  detectedCategory: string | null;
  detectedCoreBusiness: string[];
  detectedProducts: string[];
  detectedServices: string[];
  detectedProblemsSolved: string[];
  detectedTargetCustomers: string[];
  detectedNonTargetCustomers: string[];
  detectedUseCases: string[];
  detectedCapabilities: string[];
  detectedDifferentiators: string[];
  detectedLimitations: string[];
  detectedCompetitors: string[];
  detectedHistoricalInfo: string[];
  detectedClaims: string[];
  detectedCitations: string[];
  uncertainStatements: string[];
};

export type SemanticFactComparison = {
  factKey: string;
  relation: "supports" | "contradicts" | "not_mentioned" | "uncertain";
  actualStatement: string | null;
  reason: string;
};

export function emptyExtractedUnderstandingFacts(): ExtractedUnderstandingFacts {
  return {
    detectedBrandName: null, detectedCompanyName: null, detectedOfficialWebsite: null,
    detectedIndustry: null, detectedCategory: null, detectedCoreBusiness: [], detectedProducts: [],
    detectedServices: [], detectedProblemsSolved: [], detectedTargetCustomers: [], detectedNonTargetCustomers: [],
    detectedUseCases: [], detectedCapabilities: [], detectedDifferentiators: [], detectedLimitations: [],
    detectedCompetitors: [], detectedHistoricalInfo: [], detectedClaims: [], detectedCitations: [], uncertainStatements: [],
  };
}

/** 规则抽取保留确定信号；生产服务可再叠加结构化模型抽取，但不能覆盖 rawAnswer。 */
export function extractUnderstandingFactsByRule(rawAnswer: string, context: {
  brandName?: string | null;
  companyName?: string | null;
  officialWebsite?: string | null;
  competitors?: string[];
}): ExtractedUnderstandingFacts {
  const extracted = emptyExtractedUnderstandingFacts();
  const answer = rawAnswer.trim();
  if (context.brandName && answer.includes(context.brandName)) extracted.detectedBrandName = context.brandName;
  if (context.companyName && answer.includes(context.companyName)) extracted.detectedCompanyName = context.companyName;
  if (context.officialWebsite && answer.includes(context.officialWebsite.replace(/^https?:\/\//, ""))) extracted.detectedOfficialWebsite = context.officialWebsite;
  extracted.detectedCompetitors = (context.competitors ?? []).filter(name => name && answer.includes(name));
  extracted.detectedCitations = Array.from(answer.matchAll(/https?:\/\/[^\s）)\]，。]+/g), match => match[0]);
  extracted.uncertainStatements = answer
    .split(/[。！？\n]/)
    .map(value => value.trim())
    .filter(value => /可能|似乎|据称|不确定|未能确认/.test(value));
  extracted.detectedClaims = answer.split(/[。！？\n]/).map(value => value.trim()).filter(Boolean);
  return extracted;
}

export type ComparableTruthFact = {
  factKey: string;
  factValue: string;
  normalizedValue?: string | null;
  verificationStatus: BrandTruthVerificationStatus;
  sourceCount?: number;
  qualifiedOfficialSourceCount?: number;
  qualifiedIndependentThirdPartySourceCount?: number;
  officialSourceCount?: number;
  thirdPartySourceCount?: number;
};

const EXTRACTED_FACT_FIELDS: Partial<Record<string, keyof ExtractedUnderstandingFacts>> = {
  brand_name: "detectedBrandName",
  company_name: "detectedCompanyName",
  official_website: "detectedOfficialWebsite",
  industry: "detectedIndustry",
  category: "detectedCategory",
  one_line_definition: "detectedCoreBusiness",
  core_business: "detectedCoreBusiness",
  main_products: "detectedProducts",
  main_services: "detectedServices",
  problems_solved: "detectedProblemsSolved",
  target_customers: "detectedTargetCustomers",
  non_target_customers: "detectedNonTargetCustomers",
  non_applicable_boundaries: "detectedNonTargetCustomers",
  use_cases: "detectedUseCases",
  core_capabilities: "detectedCapabilities",
  differentiators: "detectedDifferentiators",
  current_limitations: "detectedLimitations",
  prohibited_promises: "detectedLimitations",
  active_business: "detectedCoreBusiness",
  misunderstood_business: "detectedCoreBusiness",
  discontinued_business: "detectedHistoricalInfo",
  outdated_data: "detectedHistoricalInfo",
};

export function actualStatementsForFact(
  factKey: string,
  extracted: ExtractedUnderstandingFacts,
  semantic?: SemanticFactComparison | null,
): string[] {
  const values: string[] = [];
  if (semantic?.actualStatement?.trim()) values.push(semantic.actualStatement.trim());
  const field = EXTRACTED_FACT_FIELDS[factKey];
  const extractedValue = field ? extracted[field] : null;
  if (typeof extractedValue === "string" && extractedValue.trim()) values.push(extractedValue.trim());
  if (Array.isArray(extractedValue)) values.push(...extractedValue.filter(Boolean));
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}

function semanticNormalize(value: string): string {
  return normalizeTruthValue(value)
    .replaceAll("软件即服务", "saas")
    .replaceAll("人工智能", "ai")
    .replaceAll("官方网站", "官网")
    .replaceAll("目标用户", "目标客户")
    .replaceAll("服务对象", "目标客户")
    .replaceAll("课程售卖", "课程销售")
    .replaceAll("知识变现", "知识内容变现")
    .replaceAll(" ", "");
}

function bigramRecall(expected: string, actual: string): number {
  const compactExpected = semanticNormalize(expected).replace(/[^a-z0-9\u3400-\u9fff]/g, "");
  const compactActual = semanticNormalize(actual).replace(/[^a-z0-9\u3400-\u9fff]/g, "");
  if (!compactExpected || !compactActual) return 0;
  if (compactActual.includes(compactExpected) || compactExpected.includes(compactActual)) return 1;
  if (compactExpected.length < 2) return compactActual.includes(compactExpected) ? 1 : 0;
  const grams = new Set(Array.from({ length: compactExpected.length - 1 }, (_, index) => compactExpected.slice(index, index + 2)));
  const matched = [...grams].filter(gram => compactActual.includes(gram)).length;
  return matched / Math.max(grams.size, 1);
}

export function compareStatementToTruth(input: {
  expectedFact: ComparableTruthFact | undefined;
  actualStatement?: string | null;
  actualStatements?: string[];
  knownOutdatedValues?: string[];
  semanticComparison?: SemanticFactComparison | null;
}): { status: UnderstandingFieldStatus; reason: string } {
  const expected = input.expectedFact;
  if (!expected || !canUseFactAsConfirmedTruth(expected)) {
    return { status: "unverifiable", reason: "事实基线尚未公开核验，不能据此断言 AI 错误或虚构。" };
  }
  const actualValues = Array.from(new Set([
    ...(input.actualStatements ?? []),
    ...(input.actualStatement?.trim() ? [input.actualStatement.trim()] : []),
  ].map(value => value.trim()).filter(Boolean)));
  if (!actualValues.length || input.semanticComparison?.relation === "not_mentioned") {
    return { status: "missing", reason: "AI 回答未覆盖该事实；缺失与错误分开记录。" };
  }
  const combinedActual = actualValues.join("；");
  if ((input.knownOutdatedValues ?? []).some(value => semanticNormalize(combinedActual).includes(semanticNormalize(value)))) {
    return { status: "outdated", reason: "AI 使用了事实基线中已标记过时或停用的信息。" };
  }
  const coverage = Math.max(...actualValues.map(value => bigramRecall(expected.factValue, value)));
  if (coverage >= 0.82) {
    return { status: "accurate", reason: "AI 表达与已核验事实一致。" };
  }
  if (input.semanticComparison?.relation === "contradicts") {
    return { status: "inaccurate", reason: `AI 表达与已核验事实存在明确矛盾；语义辅助理由：${input.semanticComparison.reason || "未提供"}。需人工复核后才能成为客户结论。` };
  }
  if (input.semanticComparison?.relation === "supports") {
    return { status: coverage >= 0.35 ? "accurate" : "mostly_accurate", reason: "AI 使用了不同措辞，但语义辅助判断与已核验事实一致；仍保留人工可追溯依据。" };
  }
  if (input.semanticComparison?.relation === "uncertain") {
    return { status: "unverifiable", reason: "AI 自身表达不确定，当前不判为错误或疑似虚构。" };
  }
  if (coverage >= 0.35) return { status: "mostly_accurate", reason: "AI 覆盖了已核验事实的主要语义，但表达不完整。" };
  if (coverage >= 0.12) return { status: "partially_accurate", reason: "AI 仅覆盖部分已核验事实；缺失部分与错误分开记录。" };
  return { status: "unverifiable", reason: "AI 有相关表达，但确定性规则无法证明一致或矛盾；不得仅因措辞不同判错，需人工核验。" };
}

export function classifyUnsupportedClaim(input: {
  claim: string;
  conflictingVerifiedFact?: ComparableTruthFact;
  hasSupportingEvidence: boolean;
}): UnderstandingFieldStatus {
  if (input.hasSupportingEvidence) return "unverifiable";
  if (input.conflictingVerifiedFact && canUseFactAsConfirmedTruth(input.conflictingVerifiedFact)) return "hallucinated";
  return "unverifiable";
}

export function deriveUnderstandingSeverity(input: {
  status: UnderstandingFieldStatus;
  factKey: string;
  legalOrCommercialRisk?: boolean;
}): "P0" | "P1" | "P2" | null {
  if (!["inaccurate", "outdated", "conflicting", "hallucinated"].includes(input.status)) return null;
  if (input.legalOrCommercialRisk) return "P0";
  if (["brand_name", "company_name", "core_business"].includes(input.factKey) && ["inaccurate", "outdated", "hallucinated", "conflicting"].includes(input.status)) return "P0";
  if (["category", "target_customers", "main_products", "main_services", "core_capabilities", "differentiators"].includes(input.factKey) && input.status !== "accurate") return "P1";
  return "P2";
}

export function calculateUnderstandingTotalScore(results: Array<{
  dimension: UnderstandingDimensionId;
  score: number | null;
}>): { score: number | null; sufficient: boolean; missingDimensions: UnderstandingDimensionId[] } {
  return calculateUnderstandingTotalScoreWithMethodology(results, DEFAULT_UNDERSTANDING_METHODOLOGY);
}

export function calculateUnderstandingTotalScoreWithMethodology(
  results: Array<{ dimension: UnderstandingDimensionId; score: number | null }>,
  methodology: { dimensions: ReadonlyArray<{ id: UnderstandingDimensionId; weight: number }> },
): { score: number | null; sufficient: boolean; missingDimensions: UnderstandingDimensionId[] } {
  const configuredDimensions = methodology.dimensions;
  const byDimension = new Map(results.map(result => [result.dimension, result.score]));
  const missingDimensions = configuredDimensions.filter(dimension => byDimension.get(dimension.id) == null).map(dimension => dimension.id);
  if (missingDimensions.length > 0) return { score: null, sufficient: false, missingDimensions };
  const score = configuredDimensions.reduce((total, dimension) => total + ((byDimension.get(dimension.id) ?? 0) * dimension.weight) / 100, 0);
  return { score: Math.round(score), sufficient: true, missingDimensions: [] };
}

export const CORRECTION_ACTION_TYPES = [
  "official_definition_page", "product_service_page", "faq", "organization_schema", "brand_schema", "product_service_schema",
  "brand_company_relation", "official_account_name", "third_party_profile", "update_old_content", "deprecate_old_business",
  "customer_case", "verifiable_data", "capability_boundary", "non_applicable_scenarios", "third_party_definition",
  "public_content_evidence", "manual_review", "schedule_retest",
] as const;

export function recommendCorrectionAction(factKey: string): { actionType: (typeof CORRECTION_ACTION_TYPES)[number]; assetType: string; label: string } {
  if (["brand_name", "company_name", "brand_company_relation"].includes(factKey)) return { actionType: "organization_schema", assetType: "品牌实体资产", label: "修正官网主体关系并补充 Organization / Brand Schema" };
  if (["official_website", "category", "one_line_definition", "core_business"].includes(factKey)) return { actionType: "official_definition_page", assetType: "业务定义资产", label: "更新官网品牌定义页" };
  if (["target_customers", "non_target_customers", "current_limitations", "non_applicable_boundaries"].includes(factKey)) return { actionType: "faq", assetType: "业务定义资产", label: "新增 FAQ 与适用边界说明" };
  if (["discontinued_business", "discontinued_products", "outdated_data"].includes(factKey)) return { actionType: "update_old_content", assetType: "可信信源资产", label: "更新旧内容并标记停用信息" };
  if (["core_capabilities", "differentiators"].includes(factKey)) return { actionType: "customer_case", assetType: "可信信源资产", label: "建设可核验案例或能力证据" };
  return { actionType: "manual_review", assetType: "复测与增长证据资产", label: "提交人工核验并安排复测" };
}

export function renderUnderstandingQuestion(template: string, context: { brandName: string; companyName?: string; competitorName?: string; confusingCapability?: string; historicalBusiness?: string }): string {
  return template
    .replaceAll("[品牌]", context.brandName)
    .replaceAll("[公司主体]", context.companyName || "公司主体")
    .replaceAll("[竞品]", context.competitorName || "主要竞品")
    .replaceAll("[易混淆能力]", context.confusingCapability || "易混淆能力")
    .replaceAll("[历史业务]", context.historicalBusiness || "历史业务");
}
