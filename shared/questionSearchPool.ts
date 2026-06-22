import { countEnabledQuestionsForT0 } from "./aiDiagnosisManualT0Gate";
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

const LEGACY_QUESTION_TYPE_TO_POOL: Record<string, SearchPoolQuestionType> = {
  品牌认知: "brand_search",
  行业推荐: "category_recommend",
  竞品对比: "comparison",
  scenario_need: "scene_need",
  long_tail_conversion: "long_tail",
  痛点解决: "scene_need",
  价格选型: "category_recommend",
  高意向成交: "long_tail",
  指定问题: "brand_search",
};

export function mapLegacyTypeToSearchPoolType(questionType: string): SearchPoolQuestionType | null {
  const trimmed = questionType.trim();
  if (!trimmed) return null;
  const mapped = LEGACY_QUESTION_TYPE_TO_POOL[trimmed];
  if (mapped) return mapped;
  return normalizeSearchPoolType(trimmed);
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

export type QuestionPoolGapOverview = {
  totalQuestions: number;
  enabledQuestions: number;
  uncoveredQuestions: number;
  competitorDominatedQuestions: number;
  generatedContentTasks: number;
  priorityQuestions: number;
  hasDiagnosisData: boolean;
};

export type QuestionPoolAiPerformanceLabel =
  | "暂无诊断数据"
  | "未实测"
  | "未提及"
  | "已提及"
  | "已推荐"
  | "竞品占优";

export type QuestionPoolContentStatusLabel = "未生成" | "已生成" | "已发布" | "待复测";

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

export function buildQuestionPoolGapOverview(input: {
  questions: SearchPoolQuestionRow[];
  contentTaskCount: number;
  hasDiagnosisData: boolean;
}): QuestionPoolGapOverview {
  const enabledQuestions = countEnabledQuestionsForT0(input.questions);
  const uncoveredQuestions = input.hasDiagnosisData
    ? input.questions.filter(
        q =>
          q.lastTestResult === "not_mentioned" ||
          q.lastTestResult === "competitor_won" ||
          (Number(q.enabled) !== 0 && !q.lastTestResult),
      ).length
    : 0;
  const competitorDominatedQuestions = input.hasDiagnosisData
    ? input.questions.filter(q => q.lastTestResult === "competitor_won").length
    : 0;

  return {
    totalQuestions: input.questions.length,
    enabledQuestions,
    uncoveredQuestions,
    competitorDominatedQuestions,
    generatedContentTasks: input.contentTaskCount,
    priorityQuestions: input.questions.filter(q => q.priorityLevel === "high").length,
    hasDiagnosisData: input.hasDiagnosisData,
  };
}

export function resolveQuestionPoolAiPerformanceLabel(input: {
  lastTestResult?: string | null;
  hasDiagnosisData: boolean;
}): QuestionPoolAiPerformanceLabel {
  if (!input.hasDiagnosisData) return "暂无诊断数据";
  if (!input.lastTestResult) return "未实测";
  if (input.lastTestResult === "mentioned") return "已提及";
  if (input.lastTestResult === "recommended") return "已推荐";
  if (input.lastTestResult === "not_mentioned") return "未提及";
  if (input.lastTestResult === "competitor_won") return "竞品占优";
  return "未实测";
}

export function resolveQuestionPoolContentStatusLabel(question: SearchPoolQuestionRow): QuestionPoolContentStatusLabel {
  if (question.relatedContentTask) return "已生成";
  return "未生成";
}

export function formatQuestionPoolGapMetricValue(
  value: number,
  hasDiagnosisData: boolean,
  options?: { allowZero?: boolean },
): string {
  if (!hasDiagnosisData && !options?.allowZero) return "暂无诊断数据";
  return String(value);
}

export function isQuestionPoolPriority(question: SearchPoolQuestionRow): boolean {
  return question.priorityLevel === "high";
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

/** 规则生成器每类默认条数 */
export const SEARCH_POOL_DEFAULT_COUNTS: Record<SearchPoolQuestionType, number> = {
  brand_search: 5,
  category_recommend: 5,
  scene_need: 6,
  comparison: 5,
  long_tail: 5,
  geo_region: 4,
};

export const SEARCH_POOL_TOTAL_DEFAULT = Object.values(SEARCH_POOL_DEFAULT_COUNTS).reduce(
  (sum, count) => sum + count,
  0,
);

const LEGACY_POOL_TYPE_ALIASES: Record<string, SearchPoolQuestionType> = {
  brand_direct: "brand_search",
  category_recommendation: "category_recommend",
  scenario_need: "scene_need",
  competitor_compare: "comparison",
  industry_location: "geo_region",
  long_tail_pain: "long_tail",
};

export function normalizeSearchPoolType(raw?: string | null): SearchPoolQuestionType | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const canonical = SEARCH_POOL_QUESTION_TYPES.find(type => type.value === trimmed)?.value;
  if (canonical) return canonical;
  return LEGACY_POOL_TYPE_ALIASES[trimmed] ?? null;
}

export type SearchPoolGroupStats = {
  total: number;
  enabled: number;
  tested: number;
  gapCount: number;
  contentReadyCount: number;
};

export function buildSearchPoolGroupStats(
  questions: SearchPoolQuestionRow[],
  hasDiagnosisData: boolean,
): Record<SearchPoolQuestionType, SearchPoolGroupStats> {
  const grouped = groupQuestionsBySearchPoolType(questions);
  return Object.fromEntries(
    SEARCH_POOL_QUESTION_TYPES.map(type => {
      const bucket = grouped[type.value];
      return [
        type.value,
        {
          total: bucket.length,
          enabled: bucket.filter(q => Number(q.enabled) !== 0).length,
          tested: hasDiagnosisData ? bucket.filter(q => Boolean(q.lastTestResult)).length : 0,
          gapCount: hasDiagnosisData
            ? bucket.filter(
                q =>
                  q.lastTestResult === "not_mentioned" ||
                  q.lastTestResult === "competitor_won" ||
                  (Number(q.enabled) !== 0 && !q.lastTestResult),
              ).length
            : 0,
          contentReadyCount: bucket.filter(q => Boolean(q.relatedContentTask)).length,
        },
      ];
    }),
  ) as Record<SearchPoolQuestionType, SearchPoolGroupStats>;
}
