import type { QuestionBankRow } from "./questionBankIntentMap";

/** AI 搜索问题池六类（P1-A）；DB 列 searchPoolType，与 legacy questionType 枚举并存 */
export const SEARCH_POOL_QUESTION_TYPES = [
  { value: "brand_search", label: "品牌认知" },
  { value: "category_recommend", label: "品类推荐" },
  { value: "scene_need", label: "场景需求" },
  { value: "comparison", label: "竞品对比" },
  { value: "long_tail", label: "长尾痛点" },
  { value: "geo_region", label: "地域/行业" },
] as const;

export type SearchPoolQuestionType = (typeof SEARCH_POOL_QUESTION_TYPES)[number]["value"];

export const SEARCH_POOL_PRIORITY_LEVELS = ["high", "medium", "low"] as const;
export type SearchPoolPriorityLevel = (typeof SEARCH_POOL_PRIORITY_LEVELS)[number];

export const SEARCH_POOL_LAST_TEST_RESULTS = [
  "mentioned",
  "recommended",
  "not_mentioned",
  "competitor_won",
] as const;
export type SearchPoolLastTestResult = (typeof SEARCH_POOL_LAST_TEST_RESULTS)[number];

export const REQUIRED_SOURCE_TYPES = [
  { value: "official_site", label: "官网" },
  { value: "case_page", label: "案例页" },
  { value: "zhihu", label: "知乎" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "media", label: "媒体" },
  { value: "third_party", label: "第三方" },
] as const;

export const REQUIRED_ENTITY_ANCHORS = [
  { value: "brand_name", label: "品牌名" },
  { value: "business", label: "业务" },
  { value: "target_customer", label: "目标客户" },
  { value: "keywords", label: "关键词" },
  { value: "website", label: "官网" },
  { value: "case", label: "案例" },
] as const;

export type SearchPoolQuestionRow = QuestionBankRow & {
  searchPoolType?: string | null;
  targetKeywords?: string[] | null;
  targetCustomerScene?: string | null;
  relatedGeoGap?: string | null;
  relatedContentTask?: boolean | null;
  requiredSourceTypes?: string[] | null;
  requiredEntityAnchors?: string[] | null;
  priorityLevel?: string | null;
  lastTestResult?: string | null;
  lastTestedAt?: Date | string | null;
};

const LEGACY_TYPE_BY_POOL: Record<SearchPoolQuestionType, string> = {
  brand_search: "品牌认知",
  category_recommend: "行业推荐",
  scene_need: "scenario_need",
  comparison: "竞品对比",
  long_tail: "long_tail_conversion",
  geo_region: "行业推荐",
};

const POOL_TYPE_LABEL = Object.fromEntries(
  SEARCH_POOL_QUESTION_TYPES.map(item => [item.value, item.label]),
) as Record<string, string>;

const SOURCE_TYPE_LABEL = Object.fromEntries(
  REQUIRED_SOURCE_TYPES.map(item => [item.value, item.label]),
) as Record<string, string>;

const LAST_TEST_RESULT_LABEL: Record<string, string> = {
  mentioned: "已提及",
  recommended: "已推荐",
  not_mentioned: "未提及品牌",
  competitor_won: "竞品占优",
};

const PRIORITY_LABEL: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export function mapSearchPoolTypeToLegacyQuestionType(poolType: SearchPoolQuestionType): string {
  return LEGACY_TYPE_BY_POOL[poolType] ?? "指定问题";
}

export function resolveSearchPoolTypeLabel(poolType?: string | null): string {
  if (!poolType) return "未分类";
  return POOL_TYPE_LABEL[poolType] ?? poolType;
}

export function resolveSearchPoolPriorityLabel(level?: string | null): string {
  if (!level) return "—";
  return PRIORITY_LABEL[level] ?? level;
}

export function resolveLastTestResultLabel(result?: string | null): string {
  if (!result) return "未测试";
  return LAST_TEST_RESULT_LABEL[result] ?? result;
}

export function resolveSourceTypeLabel(sourceType: string): string {
  return SOURCE_TYPE_LABEL[sourceType] ?? sourceType;
}

export function buildSearchPoolOverviewMetrics(questions: SearchPoolQuestionRow[]) {
  return {
    total: questions.length,
    covered: questions.filter(
      q => q.lastTestResult === "mentioned" || q.lastTestResult === "recommended",
    ).length,
    notMentioned: questions.filter(q => q.lastTestResult === "not_mentioned").length,
    competitorWon: questions.filter(q => q.lastTestResult === "competitor_won").length,
    highPriority: questions.filter(q => q.priorityLevel === "high").length,
  };
}

export function groupQuestionsBySearchPoolType(questions: SearchPoolQuestionRow[]) {
  const grouped = Object.fromEntries(
    SEARCH_POOL_QUESTION_TYPES.map(type => [type.value, [] as SearchPoolQuestionRow[]]),
  ) as Record<SearchPoolQuestionType, SearchPoolQuestionRow[]>;
  for (const question of questions) {
    const key = question.searchPoolType;
    if (key && key in grouped) {
      grouped[key as SearchPoolQuestionType].push(question);
    }
  }
  return grouped;
}

export function filterQuestionsRequiringSourceType(
  questions: SearchPoolQuestionRow[],
  sourceType: string,
): SearchPoolQuestionRow[] {
  return questions.filter(q => (q.requiredSourceTypes ?? []).includes(sourceType));
}

export function filterQuestionsRequiringEntityAnchor(
  questions: SearchPoolQuestionRow[],
  anchor: string,
): SearchPoolQuestionRow[] {
  return questions.filter(q => (q.requiredEntityAnchors ?? []).includes(anchor));
}

export function parseTargetKeywordsInput(raw: string): string[] {
  return raw
    .split(/[,，、\n]/)
    .map(part => part.trim())
    .filter(Boolean);
}

export function formatTargetKeywordsInput(keywords?: string[] | null): string {
  return (keywords ?? []).join("、");
}
