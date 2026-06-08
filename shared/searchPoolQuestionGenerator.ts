import type { ProfileForQuestionGeneration } from "./geoProfileQuestionMapping";
import {
  SEARCH_POOL_DEFAULT_COUNTS,
  SEARCH_POOL_TOTAL_DEFAULT,
  type SearchPoolQuestionType,
} from "./questionSearchPool";

export type GeneratedSearchPoolQuestion = {
  questionText: string;
  searchPoolType: SearchPoolQuestionType;
  relatedGeoGap: string;
  targetCustomerScene?: string;
  requiredEntityAnchors: string[];
};

export type SearchPoolProfileReadiness = {
  ready: boolean;
  missingFields: string[];
};

export function assessSearchPoolProfileReadiness(
  profile: ProfileForQuestionGeneration,
): SearchPoolProfileReadiness {
  const missingFields: string[] = [];
  if (!profile.brandName.trim()) missingFields.push("品牌名称");
  if (!profile.industryTag.trim()) missingFields.push("行业");
  if (!profile.productDesc.trim()) missingFields.push("产品/服务介绍");
  if (!profile.targetCustomer.trim()) missingFields.push("目标客户");
  return { ready: missingFields.length === 0, missingFields };
}

function uniqueTexts(texts: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const text of texts) {
    const trimmed = text.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function buildBrandSearchQuestions(profile: ProfileForQuestionGeneration): GeneratedSearchPoolQuestion[] {
  const brand = profile.brandName.trim();
  const product = profile.productDesc.trim();
  return uniqueTexts([
    `${brand}是什么？`,
    `${brand}主要提供什么产品或服务？`,
    `${brand}是做什么的？`,
    `${brand}适合哪些客户？`,
    product ? `${brand}的${product.slice(0, 12)}怎么样？` : `${brand}口碑如何？`,
  ])
    .slice(0, SEARCH_POOL_DEFAULT_COUNTS.brand_search)
    .map(questionText => ({
      questionText,
      searchPoolType: "brand_search",
      relatedGeoGap: "品牌直搜可见度不足",
      requiredEntityAnchors: ["brand_name", "business"],
    }));
}

function buildCategoryRecommendQuestions(
  profile: ProfileForQuestionGeneration,
): GeneratedSearchPoolQuestion[] {
  const industry = profile.industryTag.trim();
  const keyword = profile.keywords[0]?.trim() || industry;
  return uniqueTexts([
    `${industry}领域有哪些推荐方案？`,
    `做${industry}一般选什么工具或平台？`,
    `${keyword}有哪些靠谱的服务商？`,
    `${industry}选型时应该关注什么？`,
    `国内${industry}有哪些主流选择？`,
  ])
    .slice(0, SEARCH_POOL_DEFAULT_COUNTS.category_recommend)
    .map(questionText => ({
      questionText,
      searchPoolType: "category_recommend",
      relatedGeoGap: "品类推荐未覆盖品牌",
      requiredEntityAnchors: ["keywords", "business"],
    }));
}

function buildSceneNeedQuestions(profile: ProfileForQuestionGeneration): GeneratedSearchPoolQuestion[] {
  const customer = profile.targetCustomer.trim();
  const pain = profile.customerPains[0]?.trim();
  const product = profile.productDesc.trim().slice(0, 16);
  const templates = [
    customer ? `${customer}想提升业务效率，有什么方案推荐？` : "",
    pain ? `如何解决${pain}？` : "",
    customer && product ? `${customer}需要${product}，有哪些选择？` : "",
    profile.keyPoints[0] ? `有没有适合${profile.keyPoints[0].slice(0, 20)}的解决方案？` : "",
    customer ? `${customer}在选型时最该关注什么？` : "",
    product ? `企业做${product}通常会遇到哪些问题？` : "",
  ].filter(Boolean);
  return uniqueTexts(templates)
    .slice(0, SEARCH_POOL_DEFAULT_COUNTS.scene_need)
    .map(questionText => ({
      questionText,
      searchPoolType: "scene_need",
      relatedGeoGap: "场景需求问题未推荐品牌",
      targetCustomerScene: customer || undefined,
      requiredEntityAnchors: ["target_customer", "business"],
    }));
}

function buildComparisonQuestions(profile: ProfileForQuestionGeneration): GeneratedSearchPoolQuestion[] {
  const brand = profile.brandName.trim();
  const competitor = profile.competitors[0]?.trim();
  if (!competitor) return [];
  return uniqueTexts([
    `${brand}和${competitor}哪个更好？`,
    `${brand}与${competitor}怎么选？`,
    `${brand}相比${competitor}有什么优势？`,
    `${competitor}和${brand}有什么区别？`,
    `${brand}、${competitor}哪家更适合企业？`,
  ])
    .slice(0, SEARCH_POOL_DEFAULT_COUNTS.comparison)
    .map(questionText => ({
      questionText,
      searchPoolType: "comparison",
      relatedGeoGap: "竞品对比语境下品牌处于劣势",
      requiredEntityAnchors: ["brand_name", "case"],
    }));
}

function buildGeoRegionQuestions(profile: ProfileForQuestionGeneration): GeneratedSearchPoolQuestion[] {
  const industry = profile.industryTag.trim();
  const brand = profile.brandName.trim();
  const keyword = profile.keywords[0]?.trim() || industry;
  return uniqueTexts([
    `${industry}行业有哪些值得关注的品牌？`,
    `${keyword}在${industry}领域有哪些选择？`,
    `${industry}市场主流方案有哪些？`,
    brand ? `${industry}领域${brand}表现怎么样？` : `${industry}领域头部方案有哪些？`,
  ])
    .slice(0, SEARCH_POOL_DEFAULT_COUNTS.geo_region)
    .map(questionText => ({
      questionText,
      searchPoolType: "geo_region",
      relatedGeoGap: "地域/行业语境下品牌曝光不足",
      requiredEntityAnchors: ["keywords", "brand_name"],
    }));
}

function buildLongTailQuestions(profile: ProfileForQuestionGeneration): GeneratedSearchPoolQuestion[] {
  const brand = profile.brandName.trim();
  const pain = profile.customerPains[0]?.trim();
  const customer = profile.targetCustomer.trim();
  const product = profile.productDesc.trim().slice(0, 16);
  const templates = [
    pain ? `${brand}能解决${pain}吗？` : "",
    customer && product ? `${customer}使用${product}的常见坑有哪些？` : "",
    brand && pain ? `选择${brand}前需要确认哪些问题？` : "",
    profile.keyPoints[0] ? `${profile.keyPoints[0].slice(0, 24)}靠谱吗？` : "",
    product ? `${brand}在${product}场景下值得投入吗？` : "",
  ].filter(Boolean);
  return uniqueTexts(templates)
    .slice(0, SEARCH_POOL_DEFAULT_COUNTS.long_tail)
    .map(questionText => ({
      questionText,
      searchPoolType: "long_tail",
      relatedGeoGap: "长尾痛点问题未形成有效推荐",
      requiredEntityAnchors: ["target_customer", "case"],
    }));
}

export function generateRuleBasedSearchPoolQuestions(
  profile: ProfileForQuestionGeneration,
): { questions: GeneratedSearchPoolQuestion[]; readiness: SearchPoolProfileReadiness } {
  const readiness = assessSearchPoolProfileReadiness(profile);
  if (!readiness.ready) {
    return { questions: [], readiness };
  }

  const questions = [
    ...buildBrandSearchQuestions(profile),
    ...buildCategoryRecommendQuestions(profile),
    ...buildSceneNeedQuestions(profile),
    ...buildComparisonQuestions(profile),
    ...buildGeoRegionQuestions(profile),
    ...buildLongTailQuestions(profile),
  ];

  return { questions, readiness };
}

export { SEARCH_POOL_TOTAL_DEFAULT };
