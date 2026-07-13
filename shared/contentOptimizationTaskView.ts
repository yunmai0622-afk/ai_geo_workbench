import { getArticlePublishPlatform } from "./articlePublishPlatform";
import { hasEditableArticleBody, resolveArticleContentEditState } from "./contentEditState";
import { getContentQualityGateStatus, type ContentQualityGateArticle } from "./contentQualityGate";
import {
  buildGeoContentTaskDisplayName,
  buildGeoContentTaskGoal,
} from "./geoContentTaskSource";
import { normalizeSearchPoolType, type SearchPoolQuestionType } from "./questionSearchPool";
import { buildRetestPlan, type RetestPlanView } from "./retestPlan";
import type { CompletedPublishTaskRow } from "./t1RetestAutoTrigger";
import { articleHasAssignedTargetPublishPlatform } from "./weeklyArticleCustomerTitle";
import {
  resolveWeeklyPlatformContentStatus,
  weeklyContentTaskStatusLabel,
  type WeeklyContentTaskStatus,
} from "./weeklyContentTaskStatus";
import type { TestRoundRow } from "./workspaceMainChain";

export const MONTHLY_PLAN_UNBOUND_HINT = "暂未绑定本月计划";
export const MONTHLY_PLAN_SUGGEST_JOIN_HINT = "建议加入本月优化计划";

export const WEEKLY_CONTENT_TASK_VIEW_FALLBACK_MESSAGE =
  "暂未绑定明确问题，建议从本月优化计划中选择任务开始内容生产";

export const UNPUBLISHED_RETEST_PLAN_SUMMARY = "发布后 7 天进行第一次复测";

export type RecommendedPlatformView = {
  platformKey: string;
  platformLabel: string;
  reason: string;
  priority: number;
};

export type PlatformDraftView = {
  articleId: number;
  platformKey: string;
  platformLabel: string;
  title: string;
  status: WeeklyContentTaskStatus;
  statusLabel: string;
  qualityStatusLabel: string;
  publishQueueStatusLabel: string;
};

export type ContentOptimizationTaskRetestPlanView = {
  summary: string;
  publishAtLabel: string | null;
  milestones: Array<{
    phase: string;
    title: string;
    scheduleHint: string;
    suggestedAtLabel: string;
    statusLabel: string;
  }>;
};

export type ContentOptimizationTaskView = {
  projectId: number;
  questionId: number;
  questionText: string;
  questionType: string;
  relatedMaturityDimension: string;
  relatedGap: string | null;
  monthlyPlanId: number | null;
  monthlyPlanTitle: string | null;
  monthlyPlanActionLabel: string | null;
  monthlyPlanHint: string;
  taskTitle: string;
  taskReason: string;
  targetImprovement: string;
  motherArticleId: number | null;
  motherArticleTitle: string | null;
  motherArticleSummary: string | null;
  motherArticleStatus: string | null;
  recommendedPlatforms: RecommendedPlatformView[];
  platformDrafts: PlatformDraftView[];
  qualityStatus: string;
  publishQueueStatus: string;
  retestPlan: ContentOptimizationTaskRetestPlanView;
};

export type ContentOptimizationArticleInput = {
  id: number;
  title: string;
  markdownContent?: string | null;
  status?: string | null;
  lifecycleStatus?: string | null;
  lifecycleEvents?: unknown;
  geoQualityScore?: number | null;
  geoQualityRecommendation?: string | null;
  geoQualityStale?: boolean | number | null;
  contentReviewStatus?: string | null;
  publishedAt?: Date | string | null;
  generationBasis?: Record<string, unknown> | null;
  targetPlatform?: string | null;
  publishPlatform?: string | null;
};

export type ContentOptimizationPublishTaskInput = {
  articleId: number;
  platform: string;
  status: string;
};

export type ContentOptimizationTaskBuildInput = {
  projectId: number;
  question: {
    id: number;
    questionText: string;
    questionType: string;
    searchPoolType?: string | null;
    relatedGeoGap?: string | null;
    contentGapTags?: string[] | null;
  };
  monthlyPlan?: {
    planId: number;
    planTitle: string;
    actionLabel?: string | null;
    taskTitle?: string | null;
    taskReason?: string | null;
    targetDimension?: string | null;
  } | null;
  articles: ContentOptimizationArticleInput[];
  publishTasks: ContentOptimizationPublishTaskInput[];
  completedPublishTasks?: CompletedPublishTaskRow[];
  testRounds?: TestRoundRow[];
  now?: Date;
};

const MATURITY_BY_POOL: Record<SearchPoolQuestionType, string> = {
  brand_search: "品牌实体清晰度",
  category_recommend: "品类定位清晰度",
  scene_need: "搜索问题覆盖度",
  comparison: "AI 实测表现",
  long_tail: "搜索问题覆盖度",
  geo_region: "公开信源完整度",
};

const MATURITY_BY_QUESTION_TYPE: Record<string, string> = {
  品牌认知: "品牌实体清晰度",
  brand_direct: "品牌实体清晰度",
  行业推荐: "品类定位清晰度",
  category_recommendation: "品类定位清晰度",
  scenario_need: "搜索问题覆盖度",
  scene_need: "搜索问题覆盖度",
  痛点解决: "搜索问题覆盖度",
  竞品对比: "AI 实测表现",
  competitor_compare: "AI 实测表现",
  long_tail_conversion: "搜索问题覆盖度",
  long_tail_pain: "搜索问题覆盖度",
  价格选型: "品类定位清晰度",
  高意向成交: "搜索问题覆盖度",
  指定问题: "搜索问题覆盖度",
};

const PLATFORM_REASONS: Record<string, string> = {
  zhihu: "适合回答「是什么、怎么选、靠谱吗」类问题",
  sohu: "适合沉淀公开信源，帮助 AI 抓取品牌信息",
  wechat: "适合沉淀长文与 FAQ，服务私域与搜索复用",
  xiaohongshu: "适合用场景笔记覆盖种草与推荐类搜索",
  baijiahao: "适合覆盖百度搜索与 AI 摘要可引用的内容",
  toutiao: "适合用观点稿覆盖推荐流与搜索场景",
  netease: "适合输出行业观察，建立专业可信形象",
};

const PLATFORM_RECOMMENDATIONS: Record<SearchPoolQuestionType, string[]> = {
  brand_search: ["zhihu", "sohu", "wechat"],
  category_recommend: ["zhihu", "sohu", "wechat"],
  scene_need: ["zhihu", "xiaohongshu", "baijiahao"],
  comparison: ["zhihu", "sohu", "baijiahao"],
  long_tail: ["zhihu", "xiaohongshu", "toutiao"],
  geo_region: ["baijiahao", "sohu", "netease"],
};

const PLATFORM_LABELS: Record<string, string> = {
  zhihu: "知乎",
  sohu: "搜狐号",
  wechat: "公众号",
  xiaohongshu: "小红书",
  baijiahao: "百家号",
  toutiao: "头条号",
  netease: "网易号",
};

export function resolveQuestionPoolType(
  questionType: string,
  searchPoolType?: string | null,
): SearchPoolQuestionType | null {
  const fromPool = normalizeSearchPoolType(searchPoolType);
  if (fromPool) return fromPool;

  const legacyPoolMap: Record<string, SearchPoolQuestionType> = {
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
  return legacyPoolMap[questionType.trim()] ?? normalizeSearchPoolType(questionType);
}

export function resolveMaturityDimensionForQuestion(
  questionType: string,
  searchPoolType?: string | null,
): string {
  const poolType = resolveQuestionPoolType(questionType, searchPoolType);
  if (poolType) return MATURITY_BY_POOL[poolType];
  return MATURITY_BY_QUESTION_TYPE[questionType.trim()] ?? "搜索问题覆盖度";
}

export function buildRecommendedPlatformsForQuestion(
  questionType: string,
  searchPoolType?: string | null,
): RecommendedPlatformView[] {
  const poolType = resolveQuestionPoolType(questionType, searchPoolType) ?? "brand_search";
  const keys = PLATFORM_RECOMMENDATIONS[poolType];
  return keys.map((platformKey, index) => ({
    platformKey,
    platformLabel: PLATFORM_LABELS[platformKey] ?? platformKey,
    reason: PLATFORM_REASONS[platformKey] ?? "适合覆盖本轮搜索问题",
    priority: index + 1,
  }));
}

function summarizeMarkdown(content?: string | null, maxLen = 160): string | null {
  const text = (content ?? "")
    .replace(/[#>*`\-\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

function qualityStatusLabel(article: ContentOptimizationArticleInput | null): string {
  if (!article) return "尚未生成内容";
  if (!hasEditableArticleBody(article)) {
    const state = resolveArticleContentEditState(article);
    if (state.state === "failed") return "生成失败，需重新生成";
    if (state.state === "generating") return "内容生成中";
    return "尚未生成内容";
  }
  const gate = getContentQualityGateStatus(article);
  if (gate.passed) return "质检通过，可进入发布准备";
  if (gate.reason === "failed") return "质检未通过，需修改后重新质检";
  if (gate.reason === "missing") return "待质检";
  return gate.message || "质检状态待确认";
}

function resolveArticleWeeklyStatus(
  article: ContentOptimizationArticleInput,
  publishTasks: ContentOptimizationPublishTaskInput[],
): WeeklyContentTaskStatus {
  const tasksForArticle = publishTasks.filter(task => task.articleId === article.id);
  const latestTask = tasksForArticle[0];
  const editState = resolveArticleContentEditState(article);
  if (!editState.editable) {
    if (editState.state === "failed") return "NEEDS_REWRITE";
    if (editState.state === "generating") return "GENERATING";
    return "UNGENERATED";
  }
  const published = article.status === "已发布" || tasksForArticle.some(task => task.status === "completed");
  const queued = Boolean(
    latestTask && latestTask.status !== "failed" && latestTask.status !== "session_expired",
  );
  const gateArticle: ContentQualityGateArticle = {
    geoQualityScore: article.geoQualityScore,
    geoQualityRecommendation: article.geoQualityRecommendation,
    geoQualityStale: article.geoQualityStale,
    lifecycleStatus: article.lifecycleStatus,
    lifecycleEvents: article.lifecycleEvents,
    status: article.status,
    qualityStatus: article.contentReviewStatus,
  };
  const gate = getContentQualityGateStatus(gateArticle);
  return resolveWeeklyPlatformContentStatus({
    hasArticle: true,
    published,
    queued,
    publishReady: gate.passed && !published && !queued,
    article: gateArticle,
    needsRewrite: gate.reason === "failed",
  });
}

function publishQueueStatusLabel(
  publishTasks: ContentOptimizationPublishTaskInput[],
): string {
  if (publishTasks.length === 0) return "未加入发布队列";
  const completed = publishTasks.filter(task => task.status === "completed").length;
  const active = publishTasks.filter(
    task => task.status !== "failed" && task.status !== "session_expired" && task.status !== "completed",
  ).length;
  if (completed > 0 && completed === publishTasks.length) return "已全部发布";
  if (active > 0) return `已入队 ${active} 个平台发布任务`;
  if (completed > 0) return `已发布 ${completed} 个平台`;
  return "发布任务待处理";
}

function splitMotherAndPlatformDrafts(articles: ContentOptimizationArticleInput[]): {
  mother: ContentOptimizationArticleInput | null;
  platformDrafts: ContentOptimizationArticleInput[];
} {
  const platformDrafts = articles.filter(article =>
    articleHasAssignedTargetPublishPlatform(article.generationBasis),
  );
  const motherCandidates = articles.filter(
    article => !articleHasAssignedTargetPublishPlatform(article.generationBasis),
  );
  const mother = motherCandidates[0] ?? platformDrafts[0] ?? null;
  const drafts = platformDrafts.length > 0 ? platformDrafts : articles.filter(a => a.id !== mother?.id);
  return { mother, platformDrafts: drafts };
}

function buildRetestPlanView(input: {
  completedPublishTasks: CompletedPublishTaskRow[];
  testRounds: TestRoundRow[];
  now?: Date;
}): ContentOptimizationTaskRetestPlanView {
  const plan: RetestPlanView = buildRetestPlan({
    completedPublishTasks: input.completedPublishTasks,
    testRounds: input.testRounds,
    now: input.now,
  });

  if (!plan.publishAt) {
    return {
      summary: UNPUBLISHED_RETEST_PLAN_SUMMARY,
      publishAtLabel: null,
      milestones: [],
    };
  }

  return {
    summary: plan.nextSuggestion
      ? `下次建议：${plan.nextSuggestion.title}（${plan.nextSuggestion.suggestedAtLabel}）`
      : "三轮复测计划已建立",
    publishAtLabel: plan.publishAtLabel,
    milestones: plan.milestones.map(milestone => ({
      phase: milestone.phase,
      title: milestone.title,
      scheduleHint: milestone.scheduleHint,
      suggestedAtLabel: milestone.suggestedAtLabel,
      statusLabel: milestone.statusLabel,
    })),
  };
}

function buildRelatedGap(question: ContentOptimizationTaskBuildInput["question"]): string | null {
  const gap = question.relatedGeoGap?.trim();
  if (gap) return gap;
  const tags = question.contentGapTags?.filter(Boolean) ?? [];
  if (tags.length > 0) return tags.join("、");
  return null;
}

function buildTaskCopy(input: ContentOptimizationTaskBuildInput): {
  taskTitle: string;
  taskReason: string;
  targetImprovement: string;
} {
  const questionText = input.question.questionText.trim();
  const maturity = resolveMaturityDimensionForQuestion(
    input.question.questionType,
    input.question.searchPoolType,
  );
  const gap = buildRelatedGap(input.question);

  if (input.monthlyPlan?.taskTitle?.trim()) {
    return {
      taskTitle: input.monthlyPlan.taskTitle.trim(),
      taskReason:
        input.monthlyPlan.taskReason?.trim() ||
        `围绕「${questionText}」补齐「${maturity}」短板，提升 AI 搜索可见度。`,
      targetImprovement: input.monthlyPlan.targetDimension?.trim() || maturity,
    };
  }

  const sceneLabel = questionText || "相关搜索问题";
  return {
    taskTitle: buildGeoContentTaskDisplayName(sceneLabel),
    taskReason:
      gap ||
      `AI 实测发现「${questionText}」相关内容不足，需要补齐可被 AI 引用与推荐的平台内容。`,
    targetImprovement: maturity,
  };
}

function buildMonthlyPlanFields(
  monthlyPlan: ContentOptimizationTaskBuildInput["monthlyPlan"],
): Pick<
  ContentOptimizationTaskView,
  "monthlyPlanId" | "monthlyPlanTitle" | "monthlyPlanActionLabel" | "monthlyPlanHint"
> {
  if (!monthlyPlan) {
    return {
      monthlyPlanId: null,
      monthlyPlanTitle: null,
      monthlyPlanActionLabel: null,
      monthlyPlanHint: `${MONTHLY_PLAN_UNBOUND_HINT}，${MONTHLY_PLAN_SUGGEST_JOIN_HINT}`,
    };
  }
  return {
    monthlyPlanId: monthlyPlan.planId,
    monthlyPlanTitle: monthlyPlan.planTitle,
    monthlyPlanActionLabel: monthlyPlan.actionLabel?.trim() || null,
    monthlyPlanHint: monthlyPlan.planTitle,
  };
}

export function buildContentOptimizationTaskView(
  input: ContentOptimizationTaskBuildInput,
): ContentOptimizationTaskView {
  const { mother, platformDrafts } = splitMotherAndPlatformDrafts(input.articles);
  const taskCopy = buildTaskCopy(input);
  const monthlyFields = buildMonthlyPlanFields(input.monthlyPlan ?? null);
  const motherStatus = mother
    ? weeklyContentTaskStatusLabel(resolveArticleWeeklyStatus(mother, input.publishTasks))
    : null;

  const platformDraftViews: PlatformDraftView[] = platformDrafts.map(article => {
    const resolved = getArticlePublishPlatform({
      generationBasis: article.generationBasis ?? null,
      targetPlatform: article.targetPlatform,
      publishPlatform: article.publishPlatform,
    });
    const weeklyStatus = resolveArticleWeeklyStatus(article, input.publishTasks);
    const tasksForArticle = input.publishTasks.filter(task => task.articleId === article.id);
    return {
      articleId: article.id,
      platformKey: resolved.weeklyPlatformKey,
      platformLabel: resolved.label,
      title: article.title,
      status: weeklyStatus,
      statusLabel: weeklyContentTaskStatusLabel(weeklyStatus),
      qualityStatusLabel: qualityStatusLabel(article),
      publishQueueStatusLabel: publishQueueStatusLabel(tasksForArticle),
    };
  });

  return {
    projectId: input.projectId,
    questionId: input.question.id,
    questionText: input.question.questionText,
    questionType: input.question.questionType,
    relatedMaturityDimension: resolveMaturityDimensionForQuestion(
      input.question.questionType,
      input.question.searchPoolType,
    ),
    relatedGap: buildRelatedGap(input.question),
    ...monthlyFields,
    taskTitle: taskCopy.taskTitle,
    taskReason: taskCopy.taskReason,
    targetImprovement: taskCopy.targetImprovement,
    motherArticleId: mother?.id ?? null,
    motherArticleTitle: mother?.title ?? null,
    motherArticleSummary: summarizeMarkdown(mother?.markdownContent),
    motherArticleStatus: motherStatus,
    recommendedPlatforms: buildRecommendedPlatformsForQuestion(
      input.question.questionType,
      input.question.searchPoolType,
    ),
    platformDrafts: platformDraftViews,
    qualityStatus: qualityStatusLabel(mother),
    publishQueueStatus: publishQueueStatusLabel(input.publishTasks),
    retestPlan: buildRetestPlanView({
      completedPublishTasks: input.completedPublishTasks ?? [],
      testRounds: input.testRounds ?? [],
      now: input.now,
    }),
  };
}

/** 客户化任务目标摘要（供页面副标题使用） */
export function buildContentOptimizationTaskGoal(questionText: string): string {
  return buildGeoContentTaskGoal(questionText);
}
