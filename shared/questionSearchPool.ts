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

/** 月报续费证明：searchPoolType / questionType → 客户可读场景名（不含「类问题」后缀） */
const SEARCH_POOL_RENEWAL_SCENE_SHORT_LABELS: Record<string, string> = {
  scene_need: "场景需求",
  brand_search: "品牌认知",
  brand_recognition: "品牌认知",
  category_recommend: "行业推荐",
  industry_recommendation: "行业推荐",
  comparison: "竞品对比",
  competitor_comparison: "竞品对比",
  long_tail: "长尾转化",
  long_tail_conversion: "长尾转化",
  geo_region: "地域/行业",
  local_industry: "地域/行业",
  scenario_need: "场景需求",
  品牌认知: "品牌认知",
  行业推荐: "行业推荐",
  品类推荐: "行业推荐",
  竞品对比: "竞品对比",
  痛点解决: "场景需求",
  价格选型: "行业推荐",
  高意向成交: "长尾转化",
  指定问题: "相关",
};

const SEARCH_POOL_RENEWAL_SCENE_SHORT_LABEL_VALUES = new Set(
  Object.values(SEARCH_POOL_RENEWAL_SCENE_SHORT_LABELS),
);

export function resolveSearchPoolTypeRenewalSceneLabel(
  poolTypeOrQuestionType: string | null | undefined,
): string {
  const raw = (poolTypeOrQuestionType ?? "").trim();
  if (!raw) return "相关";
  if (SEARCH_POOL_RENEWAL_SCENE_SHORT_LABELS[raw]) {
    return SEARCH_POOL_RENEWAL_SCENE_SHORT_LABELS[raw];
  }
  if (SEARCH_POOL_RENEWAL_SCENE_SHORT_LABEL_VALUES.has(raw)) {
    return raw;
  }
  return "相关";
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
  coveredContentQuestions: number;
  competitorOccupiedQuestions: number;
  monthlyFocusQuestions: number;
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
    coveredContentQuestions: 0,
    competitorOccupiedQuestions: 0,
    monthlyFocusQuestions: 0,
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

export function groupQuestionsBySearchPoolType(
  questions: SearchPoolQuestionRow[],
  context?: Omit<InferSearchPoolTypeInput, "questionText" | "questionType">,
) {
  const grouped = Object.fromEntries(
    SEARCH_POOL_QUESTION_TYPES.map(type => [type.value, [] as SearchPoolQuestionRow[]]),
  ) as Record<SearchPoolQuestionType, SearchPoolQuestionRow[]>;
  for (const question of questions) {
    const key = resolveQuestionSearchPoolType({
      questionText: question.questionText,
      questionType: question.questionType,
      searchPoolType: question.searchPoolType,
      targetKeywords: question.targetKeywords,
      brandName: context?.brandName,
      competitorNames: context?.competitorNames,
    });
    grouped[key].push(question);
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
  brand_recognition: "brand_search",
  category_recommendation: "category_recommend",
  industry_recommendation: "category_recommend",
  scenario_need: "scene_need",
  competitor_compare: "comparison",
  competitor_comparison: "comparison",
  industry_location: "geo_region",
  local_industry: "geo_region",
  long_tail_pain: "long_tail",
  long_tail_conversion: "long_tail",
};

export type InferSearchPoolTypeInput = {
  questionText: string;
  questionType?: string | null;
  searchPoolType?: string | null;
  targetKeywords?: string[] | null;
  brandName?: string | null;
  competitorNames?: string[] | null;
};

const COMPARISON_KEYWORDS = ["对比", "比较", " vs ", "vs.", "相较", "相比", "区别", "哪个更好", "哪个好", "怎么选"];
const CATEGORY_KEYWORDS = ["推荐", "哪家好", "有哪些", "排行榜", "主流", "选型", "靠谱的服务商", "有哪些选择", "值得关注的品牌"];
const SCENE_KEYWORDS = ["场景", "怎么用", "如何使用", "适合", "如何提升", "如何解决", "需要什么方案", "会遇到哪些", "常见方案"];
const LONG_TAIL_KEYWORDS = ["常见坑", "值得投入", "靠谱吗", "需要确认", "使用前", "小众", "长尾", "投入吗"];
const GEO_REGION_KEYWORDS = ["地域", "行业", "市场主流", "领域有哪些", "头部方案", "区域"];
const BRAND_KEYWORDS = ["是什么", "做什么", "口碑", "怎么样", "主要提供", "适合哪些客户", "是做什么的"];

function includesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(keyword => lower.includes(keyword.toLowerCase()));
}

function includesBrandOrCompetitor(text: string, names: string[]): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  return names.some(name => {
    const trimmed = name.trim();
    return trimmed.length > 0 && normalized.includes(trimmed);
  });
}

export function inferSearchPoolType(input: InferSearchPoolTypeInput): SearchPoolQuestionType {
  const questionText = input.questionText.trim();
  if (!questionText) return "brand_search";

  const brandName = input.brandName?.trim() ?? "";
  const competitors = (input.competitorNames ?? []).map(name => name.trim()).filter(Boolean);
  const keywordBlob = [questionText, ...(input.targetKeywords ?? [])].join(" ");

  if (includesBrandOrCompetitor(keywordBlob, competitors)) return "comparison";
  if (includesAny(keywordBlob, COMPARISON_KEYWORDS)) return "comparison";
  if (includesAny(keywordBlob, CATEGORY_KEYWORDS)) return "category_recommend";
  if (includesAny(keywordBlob, SCENE_KEYWORDS)) return "scene_need";
  if (includesAny(keywordBlob, LONG_TAIL_KEYWORDS)) return "long_tail";
  if (includesAny(keywordBlob, GEO_REGION_KEYWORDS)) return "geo_region";
  if (brandName && includesBrandOrCompetitor(keywordBlob, [brandName])) return "brand_search";
  if (includesAny(keywordBlob, BRAND_KEYWORDS)) return "brand_search";

  return "brand_search";
}

export function resolveQuestionSearchPoolType(input: InferSearchPoolTypeInput): SearchPoolQuestionType {
  const fromStored = normalizeSearchPoolType(input.searchPoolType);
  if (fromStored) return fromStored;

  const legacyType = (input.questionType ?? "").trim();
  const fromLegacy = legacyType ? mapLegacyTypeToSearchPoolType(legacyType) : null;
  const inferred = input.questionText.trim() ? inferSearchPoolType(input) : null;

  if (legacyType === "指定问题" || !fromLegacy) {
    return inferred ?? fromLegacy ?? "brand_search";
  }
  return fromLegacy;
}

export const SEARCH_POOL_SORT_MODES = ["value", "createdAt", "alphabetical"] as const;
export type SearchPoolSortMode = (typeof SEARCH_POOL_SORT_MODES)[number];

export const SEARCH_POOL_SORT_MODE_LABELS: Record<SearchPoolSortMode, string> = {
  value: "按价值排序",
  createdAt: "按创建时间",
  alphabetical: "按字母顺序",
};

export type QuestionValueSortInput = {
  monthlyFocus: boolean;
  competitorOccupied: boolean;
  enabled: number | boolean | null;
  hasContentTask: boolean;
  contentPublished: boolean;
  hasContentPending: boolean;
  createdAt?: Date | string | null;
  questionText: string;
};

export function resolveQuestionValueSortTier(input: QuestionValueSortInput): number {
  const enabled = Number(input.enabled) !== 0;
  if (input.monthlyFocus) return 1;
  if (input.competitorOccupied) return 2;
  if (enabled && !input.hasContentTask && !input.contentPublished) return 3;
  if (input.hasContentPending) return 4;
  if (input.contentPublished) return 5;
  return 6;
}

export function compareSearchPoolQuestions(
  a: QuestionValueSortInput,
  b: QuestionValueSortInput,
  mode: SearchPoolSortMode = "value",
): number {
  if (mode === "createdAt") {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  }
  if (mode === "alphabetical") {
    return a.questionText.localeCompare(b.questionText, "zh-CN");
  }
  const tierDiff = resolveQuestionValueSortTier(a) - resolveQuestionValueSortTier(b);
  if (tierDiff !== 0) return tierDiff;
  return a.questionText.localeCompare(b.questionText, "zh-CN");
}

export function sortSearchPoolQuestions<T extends QuestionValueSortInput>(
  questions: readonly T[],
  mode: SearchPoolSortMode = "value",
): T[] {
  return [...questions].sort((a, b) => compareSearchPoolQuestions(a, b, mode));
}

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
  competitorOccupiedCount: number;
  coveredCount: number;
};

export function buildSearchPoolGroupStats(
  questions: Array<
    SearchPoolQuestionRow & {
      competitorOccupied?: boolean;
      contentStatus?: string;
    }
  >,
  hasDiagnosisData: boolean,
  context?: Omit<InferSearchPoolTypeInput, "questionText" | "questionType" | "searchPoolType">,
): Record<SearchPoolQuestionType, SearchPoolGroupStats> {
  type GroupQuestion = SearchPoolQuestionRow & {
    competitorOccupied?: boolean;
    contentStatus?: string;
  };
  const grouped = groupQuestionsBySearchPoolType(questions, context) as Record<
    SearchPoolQuestionType,
    GroupQuestion[]
  >;
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
          competitorOccupiedCount: bucket.filter(q => Boolean(q.competitorOccupied)).length,
          coveredCount: bucket.filter(q => q.contentStatus === "已发布").length,
        },
      ];
    }),
  ) as Record<SearchPoolQuestionType, SearchPoolGroupStats>;
}
