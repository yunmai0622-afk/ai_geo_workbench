import { PublishPrePublishChecklist } from "@/components/publishing/PublishPrePublishChecklist";
import { ArticleAssetEditorSheet } from "@/components/ArticleAssetEditorSheet";
import { PublishSuccessNotificationCard } from "@/components/publishing/PublishSuccessNotificationCard";
import { ArticleLifecyclePanel } from "@/components/ArticleLifecyclePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { aiInput } from "@/lib/aiProductUi";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { renderArticleCoverPng } from "@/lib/renderArticleCoverPng";
import {
  checkLocalAgentHealth,
  focusLocalAgentAccountsTab,
  listLocalAgentAccountSnapshots,
} from "@/lib/localAgentClient";
import PlatformContentStrategyPanel from "@/components/PlatformContentStrategyPanel";
import { QuestionTemplatePicker } from "@/components/content/QuestionTemplatePicker";
import { PlatformBatchGenerationPanel } from "@/components/weekly/PlatformBatchGenerationPanel";
import { PlatformContentBoard, type PlatformBoardRow } from "@/components/weekly/PlatformContentBoard";
import { GeoContentTaskPanels } from "@/components/weekly/GeoContentTaskPanels";
import { WeeklyPlatformArticleCard, type WeeklyArticleCardModel } from "@/components/weekly/WeeklyPlatformArticleCard";
import { resolveGeoQualityOptimizationSuggestions } from "@shared/geoQualityAutoSuggest";
import {
  computeAverageGeoQualityScore,
  resolveFriendlyQualityFailHints,
  resolveQualityCardView,
} from "@shared/geoQualityScoreDisplay";
import { AiTaskProgressCard } from "@/components/geo/AiTaskProgressCard";
import { P0Card } from "@/components/geo/P0UiPrimitives";
import { useAiTaskStagedProgress } from "@/hooks/useAiTaskStagedProgress";
import { mapPlatformContentErrorCategory } from "@/lib/aiTaskProgressErrors";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import {
  WEEKLY_PLATFORM_DEFS,
  matchTopicToPlatform,
  normalizeWeeklyPlatformKey,
  resolvePublishSlugForWeeklyPlatform,
  type PlatformContentCounts,
  type WeeklyPlatformKey,
} from "@/lib/weeklyPlatformBoard";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl, getActiveProjectId, getSearchFromLocation } from "@/lib/activeProject";
import { publishPlatformCustomerLabel } from "@/lib/publishCenterDisplay";
import { trpc } from "@/lib/trpc";
import { GEO_ARTICLE_MIN_PASS_SCORE } from "@shared/const";
import {
  BINDING_PUBLISH_PLATFORMS,
  isBindingPublishPlatform,
  PUBLISH_PLATFORM_LABELS,
  publishBlockedNoAccountMessage,
  publishBlockedNoLocalProfileMessage,
  publishBlockedSessionExpiredMessage,
  publishMustSelectAccountMessage,
  type BindingPublishPlatform,
} from "@shared/platformAccountVerify";
import {
  getArticlePublishPlatform,
  resolveEffectiveArticlePublishPlatform,
  type ResolvedArticlePublishPlatform,
} from "@shared/articlePublishPlatform";
import {
  ARTICLE_MISSING_COVER_PUBLISH_HINT_MESSAGE,
  ARTICLE_UNSAVED_PUBLISH_BLOCK_MESSAGE,
} from "@shared/articleAssetDraft";
import { isP0GeoProfileCompleteFromRecord } from "@shared/geoProfileP0Readiness";
import { evaluatePublishReadiness, type PublishReadyAccountRow } from "@shared/publishReadiness";
import {
  getGeoQualityLabel,
  type GeoQualityRecommendation,
  type GeoQualityReviewResult,
} from "@shared/geoQualityReview";
import {
  GEO_QUALITY_STALE_PUBLISH_HINT,
  isGeoQualityScoreStale,
  shouldBlockPublishForGeoQuality,
} from "@shared/geoQualityStale";
import { getPublishTimeSuggest } from "@shared/publishTimeSuggest";
import {
  formatPublishEffectPrediction,
  PUBLISH_EFFECT_PREDICTION_LINES,
} from "@shared/publishEffectPrediction";
import {
  formatPublishSuccessBody,
  formatPublishSuccessPlatformPhrase,
  PUBLISH_SUCCESS_NEXT_STEP,
  PUBLISH_SUCCESS_NOTIFICATION_TITLE,
  resolvePublishSuccessArticleUrl,
} from "@shared/publishSuccessNotification";
import {
  formatPublishEnqueueAccountOptionLabel,
  publishEnqueueLoginStatusLabel,
  PUBLISH_ENQUEUE_RELOGIN_ACTION_LABEL,
  PUBLISH_ENQUEUE_SESSION_EXPIRED_HINT,
  readLastEnqueuePublishAccountId,
  writeLastEnqueuePublishAccountId,
} from "@shared/publishEnqueueAccountSelect";
import {
  evaluatePrePublishChecklist,
  formatPrePublishChecklistBlockMessage,
} from "@shared/publishPrePublishChecklist";
import {
  ACCOUNT_GROUP_MISMATCH_HINT,
  accountGroupsMismatch,
  formatArticleStrategySummary,
  getAccountGroupLabel,
  getPublishIdentityLabel,
  isAccountGroupType,
} from "@shared/contentStrategy";
import {
  CONTENT_REVIEW_PENDING_ENQUEUE_HINT,
  isContentReviewPending,
  normalizeContentReviewStatus,
} from "@shared/contentReviewStatus";
import { publishTaskStatusCustomerLabel } from "@shared/publishTaskErrors";
import { stripInternalArticleMetadataFromMarkdown } from "@shared/stripInternalArticleMetadata";
import { type resolveArticleLifecycleView } from "@shared/articleLifecycle";
import { normalizeArticleCoverTemplateId } from "@shared/articleCoverTemplate";
import {
  buildDefaultPlatformStrategy,
  getPlatformRule,
  validatePlatformContentStrategy,
  type PlatformContentStrategyInput,
} from "@shared/platformContentRules";
import {
  DEFAULT_WEEKLY_GENERATION_COUNT,
  MAX_WEEKLY_GENERATION_COUNT,
  weeklyGenerationCountClientError,
} from "@shared/weeklyContentGeneration";
import { resolveQuestionTypeDisplayLabel } from "@shared/retestComparisonDisplay";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { TRPCClientError } from "@trpc/client";
import {
  toPlatformContentGenerationError,
  PLATFORM_CONTENT_NO_PLATFORM_TASK_MESSAGE,
  PLATFORM_CONTENT_PROJECT_ACCESS_MESSAGE,
} from "@shared/platformContentGenerationErrors";
import { SubscriptionUpgradePrompt } from "@/components/SubscriptionUpgradePrompt";
import { handleSubscriptionLimitMutationError } from "@/lib/subscriptionUpgrade";
import { isSubscriptionLimitMessage, SUBSCRIPTION_LIMIT_CONTENT_MESSAGE } from "@shared/subscriptionLimits";
import { toUserFacingError, toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { countStaleTopics, isTopicBoundToProjectTasks, taskIdSetFromList } from "@shared/platformContentDiagnosisGate";
import {
  buildArticleTopicIdSet,
  countUnassignedPendingTopics,
  isTopicIdInRows,
  resolvePendingPlatformTopic,
} from "@shared/platformTopicAllocation";
import {
  GEO_CONTENT_TASK_NO_DIAGNOSIS_MESSAGE,
  buildGeoContentTaskDisplayName,
  buildWeeklyPlatformGenerationGoal,
  formatPlatformRuleSummaryForGeneration,
  getWeeklyPlatformContentRole,
  hasGeoDiagnosisSourceData,
  parseGeoOptimizationTaskCard,
  resolveGeoContentTaskSource,
} from "@shared/geoContentTaskSource";
import {
  PLATFORM_CONTENT_PROGRESS_HINT_90S,
  PLATFORM_CONTENT_PROGRESS_STAGES,
  type AiTaskProgressErrorCategory,
} from "@shared/aiTaskProgress";
import {
  LOCAL_AGENT_ACCOUNT_SYNC_PENDING_DISPLAY_NAME,
  type LocalAgentAccountStatusEntry,
} from "@shared/localAgentAccountSync";
import {
  formatArticlePublishedAtSentence,
  resolveArticlePublishedAtForDisplay,
} from "@shared/articlePublishState";
import { computeContentTagStats, normalizeContentTags } from "@shared/geoArticleContentTags";
import {
  filterWeeklyContentCards,
  resolveArticleCoverPreviewSrc,
  resolveArticlePublishLink,
  resolveContentCardStatus,
  resolveContentTypeLabel,
  sortWeeklyContentCardsByQuality,
  type ContentCardQualitySort,
  type ContentCardStatusFilter,
} from "@shared/weeklyContentAssetsDisplay";
import {
  buildPlatformBatchQueue,
  countPlatformBatchCompleted,
  updatePlatformBatchItemStatus,
  type PlatformBatchQueueItem,
} from "@shared/platformBatchGeneration";
import {
  CONTENT_GENERATION_RETRY_EXHAUSTED_MESSAGE,
  nextConsecutiveGenerationFailCount,
  resolveContentGenerationFailureDisplay,
} from "@shared/contentGenerationRetry";

type ProjectOption = { id: number; enterpriseName: string };

function flattenPlatformAccounts(
  groups: Array<{ platform: string; accounts: PlatformAccountItem[] }>,
): PublishReadyAccountRow[] {
  return groups.flatMap(g =>
    g.accounts.map(a => ({
      platform: g.platform,
      accountName: a.accountName,
      isEnabled: a.isEnabled,
      localProfileId: a.localProfileId,
      localAgentId: a.localAgentId,
      sessionStatus: a.sessionStatus,
    })),
  );
}

type PlatformAccountItem = {
  id: number;
  accountName: string;
  accountGroup: string | null;
  accountRole: string | null;
  isEnabled: boolean;
  localAgentId: string | null;
  localProfileId: string | null;
  sessionStatus: string | null;
  lastLoginAt?: Date | string | null;
  verificationStatus: string;
};

function readGenerateArticleError(err: unknown): string {
  if (err instanceof TRPCClientError) {
    if (isSubscriptionLimitMessage(err.message)) return err.message;
    return toPlatformContentGenerationError(err.message);
  }
  if (err instanceof Error) {
    if (isSubscriptionLimitMessage(err.message)) return err.message;
    return toPlatformContentGenerationError(err.message);
  }
  return toPlatformContentGenerationError("");
}

type TopicRow = {
  id: number;
  optimizationTaskId?: number | null;
  title: string;
  articleType?: string | null;
  businessReason?: string | null;
  status?: string | null;
};

type TaskRow = {
  id: number;
  taskName?: string | null;
  priority?: string | null;
  generationReason?: string | null;
  executionSuggestion?: string | null;
  expectedImpact?: string | null;
};

type AnalysisRow = {
  contentGap?: string | null;
  notRecommendedReason?: string | null;
  questionText?: string | null;
};

type ArticleRow = {
  id: number;
  topicId?: number | null;
  title?: string | null;
  markdownContent?: string | null;
  status?: string | null;
  createdAt?: Date | string | null;
  targetPlatform?: string | null;
  publishPlatform?: string | null;
  contentType?: string | null;
  coverTemplate?: string | null;
  coverBase64?: string | null;
  coverImageUrl?: string | null;
  geoQualityScore?: number | null;
  geoQualityRecommendation?: string | null;
  geoQualityDetail?: GeoQualityReviewResult | Record<string, unknown> | null;
  geoQualityStale?: boolean | number | null;
  contentStrategyType?: string | null;
  publishIdentity?: string | null;
  recommendedAccountGroup?: string | null;
  articleType?: string | null;
  lifecycleStatus?: string | null;
  lifecycleEvents?: unknown;
  publicPath?: string | null;
  publishedAt?: Date | string | null;
  lastPublishRecordAt?: Date | string | null;
  generationBasis?: Record<string, unknown> | null;
  contentTags?: string[] | null;
  lifecycle?: ReturnType<typeof resolveArticleLifecycleView>;
  postPublish?: {
    pendingReview?: boolean;
    needsRewrite?: boolean;
  };
  contentReviewStatus?: string | null;
};

function formatGeoQualitySummary(article: ArticleRow): string | null {
  if (article.geoQualityScore == null || !article.geoQualityRecommendation) return null;
  const label = getGeoQualityLabel(article.geoQualityRecommendation as GeoQualityRecommendation);
  const stale = isGeoQualityScoreStale(article) ? " · 待重新质检" : "";
  return `GEO 质量：${article.geoQualityScore} 分 · ${label}${stale}`;
}

type QualityScoreRow = {
  articleId?: number;
  totalScore: number;
  blocked?: number | boolean | null;
};

const PUBLISH_QUEUE_PLATFORMS = BINDING_PUBLISH_PLATFORMS.map(slug => ({
  slug,
  label: PUBLISH_PLATFORM_LABELS[slug],
}));

const publishTaskStatusLabel = publishTaskStatusCustomerLabel;

function mapContentTypeLabel(raw: string): string {
  if (raw?.includes("痛点") || raw?.includes("官网")) return "痛点解决";
  if (raw?.includes("行业") || raw?.includes("场景") || raw?.includes("指南")) return "场景指南";
  if (raw?.includes("案例")) return "案例证据";
  if (raw?.includes("竞品") || raw?.includes("对比")) return "竞品对比";
  if (raw?.includes("FAQ") || raw?.includes("问答")) return "FAQ";
  return raw?.replace(/GEO/gi, "").replace(/文章/g, "").trim() || "内容";
}

function parseTime(value: Date | string | null | undefined): number {
  if (value == null) return NaN;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? NaN : t;
}

function getThisWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function isInThisWeek(createdAt: Date | string | null | undefined): boolean {
  const t = parseTime(createdAt ?? null);
  if (Number.isNaN(t)) return false;
  const { start, end } = getThisWeekRange();
  return t >= start.getTime() && t <= end.getTime();
}

function useProjectSelection() {
  return useActiveProjectSelection();
}

/** URL projectId 优先，避免多平台生成时 session 与路由上下文不一致 */
function resolveMutationProjectId(
  selectedProjectId: number | undefined,
  location: string,
): number | null {
  const pid = selectedProjectId ?? getActiveProjectId({ search: getSearchFromLocation(location) });
  if (pid == null || !Number.isFinite(pid) || pid <= 0) return null;
  return pid;
}

function assertMutationProjectId(
  selectedProjectId: number | undefined,
  location: string,
  accessibleProjectIds?: readonly number[],
): number {
  const pid = resolveMutationProjectId(selectedProjectId, location);
  if (!pid) throw new Error("项目未选择");
  if (accessibleProjectIds && !accessibleProjectIds.includes(pid)) {
    throw new Error("项目未选择");
  }
  return pid;
}

function parseKeyPointsFromBusinessReason(reason?: string | null): string[] {
  if (!reason) return [];
  const m = reason.match(/核心论点：([^；]+)/);
  if (!m?.[1]) return [];
  return m[1]
    .split(/[；;、]/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 2);
}

function topicMeta(topic: TopicRow, tasks: TaskRow[]) {
  const task = tasks.find(t => t.id === topic.optimizationTaskId);
  const card = parseGeoOptimizationTaskCard(task?.executionSuggestion ?? null);
  const rawType = (card?.contentType || topic.articleType || "其他").trim() || "其他";
  const contentType = mapContentTypeLabel(rawType);
  const keyPoints =
    card?.keyPoints?.length ? card.keyPoints.slice(0, 2) : parseKeyPointsFromBusinessReason(topic.businessReason);
  return { contentType, keyPoints };
}

function contentTypeBorderColor(contentType: string): string {
  if (contentType.includes("痛点")) return "var(--color-border-info)";
  if (contentType.includes("场景")) return "#7F77DD";
  if (contentType.includes("案例")) return "#BA7517";
  return "rgb(100 116 139)";
}

function isBlocked(value: number | boolean | null | undefined) {
  return value === true || value === 1;
}

function qualityPasses(article: ArticleRow, q?: QualityScoreRow) {
  if (!q) return false;
  if (isBlocked(q.blocked)) return false;
  return article.status === "质检通过" || q.totalScore >= GEO_ARTICLE_MIN_PASS_SCORE;
}

function previewText(markdown?: string | null, max = 400) {
  const raw = stripInternalArticleMetadataFromMarkdown(markdown ?? "")
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*/g, "")
    .trim();
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}…`;
}

function articleNeedsCoverSaveHint(article: ArticleRow): boolean {
  return !article.coverBase64?.trim();
}

function notifyPublishEffectPrediction() {
  toast.message("发布后效果预期", {
    description: formatPublishEffectPrediction(),
    duration: 12_000,
  });
}

type PublishSuccessNotice = {
  platformLabel: string;
  articleUrl: string | null;
};

function showPublishSuccessNotification(
  notice: PublishSuccessNotice,
  setNotice: (value: PublishSuccessNotice | null) => void,
) {
  setNotice(notice);
  toast.success(PUBLISH_SUCCESS_NOTIFICATION_TITLE, {
    description: `${formatPublishSuccessBody(notice.platformLabel)}\n下一步：${PUBLISH_SUCCESS_NEXT_STEP}`,
    duration: 10_000,
  });
}

export default function WeeklyContentPage() {
  const [location, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { selectedProjectId, selectedProject, projectInput, enabled, projectsLoading, projects } =
    useProjectSelection();
  const accessibleProjectIds = useMemo(() => projects.map(p => p.id), [projects]);
  const subscriptionUsageQuery = trpc.geo.subscription.usage.useQuery();
  const contentLimitReached = subscriptionUsageQuery.data?.atLimit.contentArticle ?? false;

  const tasksQuery = trpc.geo.tasks.list.useQuery(projectInput, { enabled });
  const questionsQuery = trpc.geo.questions.list.useQuery(projectInput, { enabled });
  const analysisQuery = trpc.geo.analysis.list.useQuery(projectInput, { enabled });
  const topicsQuery = trpc.geo.articles.topics.list.useQuery(projectInput, { enabled });
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const platformAccountsQuery = trpc.geo.platformAccounts.list.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );
  const workspaceSummaryQuery = trpc.geo.workspace.summary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );
  const assetSummaryQuery = trpc.geo.assetLibrary.summary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );
  const enterpriseProfileRecord = assetSummaryQuery.data?.profile as Record<string, unknown> | undefined;
  const scoresQuery = trpc.geo.articles.latestQualityScores.useQuery(projectInput, { enabled });
  const publishRecordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });
  const publishTasksQuery = trpc.publishTasks.listRecentByProject.useQuery(
    { projectId: selectedProjectId!, limit: 50 },
    { enabled: Boolean(selectedProjectId) },
  );

  const generateTopicsMutation = trpc.geo.articles.topics.generate.useMutation();
  const generateTasksMutation = trpc.geo.tasks.generate.useMutation();
  const generateArticleMutation = trpc.geo.articles.generate.useMutation();
  const createPublishTask = trpc.publishTasks.create.useMutation();
  const syncLocalAgentSnapshot = trpc.geo.platformAccounts.syncLocalAgentSnapshot.useMutation();
  const updateGeneratedArticle = trpc.geo.articles.updateGeneratedArticle.useMutation();
  const setContentReviewStatus = trpc.geo.articles.setContentReviewStatus.useMutation({
    onSuccess: async () => {
      await invalidateArticles();
      toast.success("审核状态已更新");
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "更新审核状态失败")),
  });
  const generateRewriteSuggestion = trpc.geo.articles.generateRewriteSuggestion.useMutation();
  const [suggestionDialog, setSuggestionDialog] = useState<{ open: boolean; text: string; articleTitle: string }>({
    open: false,
    text: "",
    articleTitle: "",
  });

  const autoTopicsTriggeredRef = useRef(false);
  const [preparingTopics, setPreparingTopics] = useState(false);
  const [generatingTopicIds, setGeneratingTopicIds] = useState<Set<number>>(() => new Set());
  const [expandedTopicIds, setExpandedTopicIds] = useState<Set<number>>(() => new Set());
  const [batchState, setBatchState] = useState<{ current: number; total: number; target: number } | null>(null);
  const [countPreset, setCountPreset] = useState<"7" | "14" | "21" | "custom">("7");
  const [customCount, setCustomCount] = useState(String(DEFAULT_WEEKLY_GENERATION_COUNT));
  const [countError, setCountError] = useState<string | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishSuccessNotice, setPublishSuccessNotice] = useState<PublishSuccessNotice | null>(null);
  const [publishArticle, setPublishArticle] = useState<ArticleRow | null>(null);
  const [manualPublishPlatform, setManualPublishPlatform] = useState<BindingPublishPlatform | "">("");
  const [publishPlatformResolved, setPublishPlatformResolved] = useState<ResolvedArticlePublishPlatform | null>(
    null,
  );
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(() => new Set());
  const [localAgentOnline, setLocalAgentOnline] = useState<boolean | null>(null);
  const [localAgentAccountSnapshot, setLocalAgentAccountSnapshot] = useState<LocalAgentAccountStatusEntry[]>([]);
  /** 发布弹窗内冻结的 Agent 状态，避免打开期间反复 sync/invalidate 导致抖动 */
  const [publishDialogAgentOnline, setPublishDialogAgentOnline] = useState<boolean | null>(null);
  const [publishDialogAccountSnapshot, setPublishDialogAccountSnapshot] = useState<
    LocalAgentAccountStatusEntry[]
  >([]);
  const publishDialogPlatformsInitRef = useRef(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorArticle, setEditorArticle] = useState<ArticleRow | null>(null);
  const [regeneratingCoverIds, setRegeneratingCoverIds] = useState<Set<number>>(() => new Set());
  const [unsavedArticleIds, setUnsavedArticleIds] = useState<Set<number>>(() => new Set());
  const [selectedPublishAccountIds, setSelectedPublishAccountIds] = useState<Record<string, number>>({});
  const [platformStrategy, setPlatformStrategy] = useState<PlatformContentStrategyInput>(() =>
    buildDefaultPlatformStrategy(),
  );
  const [selectedQuestionTemplateId, setSelectedQuestionTemplateId] = useState<number | null>(null);
  const [selectedContentTaskId, setSelectedContentTaskId] = useState<number | null>(null);
  const [generatingPlatformKey, setGeneratingPlatformKey] = useState<WeeklyPlatformKey | null>(null);
  const [platformBatchQueue, setPlatformBatchQueue] = useState<PlatformBatchQueueItem[] | null>(null);
  const [platformBatchRunning, setPlatformBatchRunning] = useState(false);
  const [platformProgressLabelKey, setPlatformProgressLabelKey] = useState<WeeklyPlatformKey | null>(null);
  const [platformProgressErrorCategory, setPlatformProgressErrorCategory] = useState<
    AiTaskProgressErrorCategory | undefined
  >();
  const [platformProgressErrorMessage, setPlatformProgressErrorMessage] = useState<string>();
  const [platformGenerationRetry, setPlatformGenerationRetry] = useState<{
    platformKey: WeeklyPlatformKey;
    topicId: number;
    strategyOverride: Partial<PlatformContentStrategyInput>;
    failCount: number;
  } | null>(null);
  const platformContentProgress = useAiTaskStagedProgress({ stages: PLATFORM_CONTENT_PROGRESS_STAGES });
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const t0GapDeepLinkHandledRef = useRef(false);
  const [filterStatus, setFilterStatus] = useState<ContentCardStatusFilter>("all");
  const [filterContentTag, setFilterContentTag] = useState<string>("all");
  const [titleSearch, setTitleSearch] = useState("");
  const [sortQuality, setSortQuality] = useState<ContentCardQualitySort>("none");
  const [selectedCardIds, setSelectedCardIds] = useState<Set<number>>(() => new Set());
  const [batchEnqueueBusy, setBatchEnqueueBusy] = useState(false);

  useEffect(() => {
    if (t0GapDeepLinkHandledRef.current) return;
    const params = new URLSearchParams(getSearchFromLocation(location));
    const weeklyPlatform = params.get("weeklyPlatform");
    const questionType = params.get("questionType");
    if (!weeklyPlatform && !questionType) return;
    t0GapDeepLinkHandledRef.current = true;
    if (weeklyPlatform) {
      const key = normalizeWeeklyPlatformKey(weeklyPlatform);
      setFilterPlatform(key);
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-testid="weekly-platform-card-${key}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    if (questionType) {
      toast.message("T0 检测内容缺口建议", {
        description: `建议优先生成${resolveQuestionTypeDisplayLabel(questionType)}相关内容`,
      });
    }
  }, [location]);

  const isPublishReadyAccount = (a: PlatformAccountItem) =>
    a.isEnabled &&
    Boolean(a.accountName?.trim()) &&
    Boolean(a.localProfileId?.trim()) &&
    Boolean(a.localAgentId?.trim()) &&
    a.sessionStatus === "active";

  const readLocalAgentSnapshot = useCallback(async () => {
    const h = await checkLocalAgentHealth();
    const online = h?.ok ?? false;
    if (!online) {
      return { health: h, online: false, snapshot: [] as LocalAgentAccountStatusEntry[] };
    }
    try {
      const snapshot = await listLocalAgentAccountSnapshots();
      return { health: h, online: true, snapshot };
    } catch {
      return { health: h, online: true, snapshot: [] as LocalAgentAccountStatusEntry[] };
    }
  }, []);

  const applyGlobalAgentSnapshot = useCallback((online: boolean, snapshot: LocalAgentAccountStatusEntry[]) => {
    setLocalAgentOnline(online);
    setLocalAgentAccountSnapshot(snapshot);
  }, []);

  const applyPublishDialogAgentSnapshot = useCallback(
    (online: boolean, snapshot: LocalAgentAccountStatusEntry[]) => {
      setPublishDialogAgentOnline(online);
      setPublishDialogAccountSnapshot(snapshot);
    },
    [],
  );

  /** 仅读取本地 Agent 快照，不触发 Web 同步（避免弹窗抖动） */
  const hydratePublishDialogAgent = useCallback(
    async (options?: { syncToWeb?: boolean }) => {
      const { health, online, snapshot } = await readLocalAgentSnapshot();
      applyPublishDialogAgentSnapshot(online, snapshot);
      applyGlobalAgentSnapshot(online, snapshot);
      if (options?.syncToWeb && online && selectedProjectId && health && snapshot.length > 0) {
        try {
          await syncLocalAgentSnapshot.mutateAsync({
            agentId: health.agentId,
            projectId: selectedProjectId,
            accounts: snapshot,
          });
          await utils.geo.platformAccounts.list.invalidate({ projectId: selectedProjectId });
        } catch {
          // 同步失败不阻断弹窗；状态已由本地快照更新
        }
      }
      return health;
    },
    [
      readLocalAgentSnapshot,
      applyPublishDialogAgentSnapshot,
      applyGlobalAgentSnapshot,
      selectedProjectId,
      syncLocalAgentSnapshot,
      utils.geo.platformAccounts.list,
    ],
  );

  const refreshLocalAgentHealth = useCallback(
    () => hydratePublishDialogAgent({ syncToWeb: true }),
    [hydratePublishDialogAgent],
  );

  const brandName = selectedProject?.enterpriseName ?? "海豚知道";
  const projectName = selectedProject?.enterpriseName ?? "当前企业";

  const platformAccountGroups = useMemo(
    () =>
      (platformAccountsQuery.data?.accounts ?? []) as Array<{
        platform: string;
        accounts: PlatformAccountItem[];
      }>,
    [platformAccountsQuery.data],
  );

  const getAllEnabledAccountsForPlatform = useCallback(
    (slug: string) => {
      const group = platformAccountGroups.find(g => g.platform === slug);
      return (group?.accounts ?? []) as PlatformAccountItem[];
    },
    [platformAccountGroups],
  );

  const getPublishReadyAccountsForPlatform = useCallback(
    (slug: string) => getAllEnabledAccountsForPlatform(slug).filter(isPublishReadyAccount),
    [getAllEnabledAccountsForPlatform],
  );

  const getEnqueueSelectableAccountsForPlatform = useCallback(
    (slug: string) =>
      getAllEnabledAccountsForPlatform(slug).filter(a => a.isEnabled && Boolean(a.accountName?.trim())),
    [getAllEnabledAccountsForPlatform],
  );

  const pickSelectedPublishAccount = useCallback(
    (slug: string): PlatformAccountItem | null => {
      const selectable = getEnqueueSelectableAccountsForPlatform(slug);
      if (selectable.length === 0) return null;
      const selectedId = selectedPublishAccountIds[slug];
      if (selectedId) return selectable.find(a => a.id === selectedId) ?? null;
      if (selectable.length === 1) return selectable[0]!;
      const ready = selectable.filter(isPublishReadyAccount);
      if (ready.length === 1) return ready[0]!;
      return null;
    },
    [getEnqueueSelectableAccountsForPlatform, selectedPublishAccountIds],
  );

  const pickPublishAccount = useCallback(
    (slug: string): PlatformAccountItem | null => {
      const selected = pickSelectedPublishAccount(slug);
      if (selected && isPublishReadyAccount(selected)) return selected;
      const ready = getPublishReadyAccountsForPlatform(slug);
      if (ready.length === 0) return null;
      if (ready.length === 1) return ready[0]!;
      return null;
    },
    [pickSelectedPublishAccount, getPublishReadyAccountsForPlatform],
  );

  const rememberEnqueuePublishAccount = useCallback(
    (slug: string, accountId: number) => {
      if (!selectedProjectId) return;
      writeLastEnqueuePublishAccountId(selectedProjectId, slug, accountId);
      setSelectedPublishAccountIds(prev => ({ ...prev, [slug]: accountId }));
    },
    [selectedProjectId],
  );

  const publishAccountGroupWarnings = useMemo(() => {
    if (!publishArticle?.recommendedAccountGroup || !isAccountGroupType(publishArticle.recommendedAccountGroup)) {
      return [] as Array<{ slug: string; platformLabel: string; message: string }>;
    }
    const recLabel = getAccountGroupLabel(publishArticle.recommendedAccountGroup);
    const out: Array<{ slug: string; platformLabel: string; message: string }> = [];
    for (const slug of Array.from(selectedPlatforms)) {
      const row = pickSelectedPublishAccount(slug);
      if (!row) continue;
      if (!accountGroupsMismatch(publishArticle.recommendedAccountGroup, row.accountGroup)) continue;
      const boundLabel = getAccountGroupLabel(row.accountGroup) || "未设置账号组";
      out.push({
        slug,
        platformLabel: PUBLISH_QUEUE_PLATFORMS.find(p => p.slug === slug)?.label ?? slug,
        message: ACCOUNT_GROUP_MISMATCH_HINT(recLabel, boundLabel),
      });
    }
    return out;
  }, [publishArticle, selectedPlatforms, pickSelectedPublishAccount]);

  const tasks = (tasksQuery.data ?? []) as TaskRow[];
  const analyses = (analysisQuery.data ?? []) as AnalysisRow[];
  const geoContentTaskSource = useMemo(
    () =>
      resolveGeoContentTaskSource({
        tasks,
        analyses,
        questions: questionsQuery.data ?? [],
        selectedTaskId: selectedContentTaskId,
        preferredTargetQuestion: platformStrategy.targetQuestion,
      }),
    [tasks, analyses, questionsQuery.data, selectedContentTaskId, platformStrategy.targetQuestion],
  );

  const contentTaskOptions = useMemo(
    () =>
      tasks.map(t => {
        const card = parseGeoOptimizationTaskCard(t.executionSuggestion);
        const scene = card?.articleTitle?.trim() || t.taskName?.trim() || `任务 ${t.id}`;
        return { id: t.id, label: buildGeoContentTaskDisplayName(scene) };
      }),
    [tasks],
  );

  const targetQuestionOptions = useMemo(() => {
    const fromSource = geoContentTaskSource?.linkedQuestion?.trim();
    const fromQuestions = (questionsQuery.data ?? [])
      .map((q: { questionText?: string }) => q.questionText?.trim())
      .filter(Boolean) as string[];
    const fromTasks = tasks.map(t => t.taskName?.trim()).filter(Boolean) as string[];
    return Array.from(new Set([fromSource, ...fromQuestions, ...fromTasks].filter(Boolean) as string[]));
  }, [questionsQuery.data, tasks, geoContentTaskSource?.linkedQuestion]);

  useEffect(() => {
    const linked = geoContentTaskSource?.linkedQuestion?.trim();
    if (linked) {
      setPlatformStrategy(prev =>
        prev.targetQuestion.trim() === linked ? prev : { ...prev, targetQuestion: linked },
      );
      return;
    }
    if (!platformStrategy.targetQuestion.trim() && targetQuestionOptions[0]) {
      setPlatformStrategy(prev => ({ ...prev, targetQuestion: targetQuestionOptions[0]! }));
    }
  }, [geoContentTaskSource?.linkedQuestion, targetQuestionOptions, platformStrategy.targetQuestion]);

  useEffect(() => {
    setSelectedQuestionTemplateId(null);
  }, [platformStrategy.targetPublishPlatform]);

  const platformStrategyError = useMemo(
    () => validatePlatformContentStrategy(platformStrategy),
    [platformStrategy],
  );

  const latestDiagnosisGap = useMemo(() => {
    if (geoContentTaskSource?.contentGaps[0]) return geoContentTaskSource.contentGaps[0]!;
    return analyses.map(r => r.contentGap?.trim()).find(Boolean) ?? null;
  }, [geoContentTaskSource?.contentGaps, analyses]);

  const hasDiagnosisData = useMemo(
    () => hasGeoDiagnosisSourceData(tasks, analyses),
    [tasks, analyses],
  );

  const enterpriseProfileReady = useMemo(() => {
    if (assetSummaryQuery.isFetched && enterpriseProfileRecord) {
      return isP0GeoProfileCompleteFromRecord(enterpriseProfileRecord);
    }
    if (workspaceSummaryQuery.isFetched) {
      return workspaceSummaryQuery.data?.p0ProfileComplete ?? false;
    }
    return true;
  }, [
    assetSummaryQuery.isFetched,
    enterpriseProfileRecord,
    workspaceSummaryQuery.isFetched,
    workspaceSummaryQuery.data?.p0ProfileComplete,
  ]);

  const publishBaseContext = useMemo(
    () => ({
      projectAccessible: Boolean(selectedProjectId),
      enterpriseProfileReady,
      enterpriseProfile: enterpriseProfileRecord ?? null,
      diagnosisReady: hasDiagnosisData,
      localAgentConnected: localAgentOnline,
      platformAccounts: flattenPlatformAccounts(platformAccountGroups),
      localAgentAccountSnapshot,
    }),
    [
      selectedProjectId,
      enterpriseProfileReady,
      enterpriseProfileRecord,
      hasDiagnosisData,
      localAgentOnline,
      platformAccountGroups,
      localAgentAccountSnapshot,
    ],
  );

  const publishDialogReadinessContext = useMemo(
    () => ({
      ...publishBaseContext,
      localAgentConnected: publishDialogAgentOnline,
      localAgentAccountSnapshot: publishDialogAccountSnapshot,
    }),
    [publishBaseContext, publishDialogAgentOnline, publishDialogAccountSnapshot],
  );

  const activePublishReadiness = useMemo(() => {
    if (!publishArticle) return null;
    const requestedPlatform =
      manualPublishPlatform && isBindingPublishPlatform(manualPublishPlatform)
        ? manualPublishPlatform
        : null;
    const ctx = publishDialogOpen ? publishDialogReadinessContext : publishBaseContext;
    return evaluatePublishReadiness({
      ...ctx,
      article: publishArticle,
      requestedPlatform,
    });
  }, [
    publishArticle,
    publishBaseContext,
    publishDialogReadinessContext,
    publishDialogOpen,
    manualPublishPlatform,
  ]);

  const topics = (topicsQuery.data ?? []) as TopicRow[];
  const taskIdSet = useMemo(() => taskIdSetFromList(tasks.map(t => t.id)), [tasks]);
  const staleTopicCount = useMemo(() => countStaleTopics(topics, taskIdSet), [topics, taskIdSet]);
  const hasStaleTopics = staleTopicCount > 0;
  const articles = (articlesQuery.data ?? []) as ArticleRow[];
  const scores = (scoresQuery.data ?? []) as QualityScoreRow[];

  const scoresByArticleId = useMemo(() => new Map(scores.map(s => [s.articleId, s] as const)), [scores]);

  const articleByTopicId = useMemo(() => {
    const map = new Map<number, ArticleRow>();
    for (const a of articles) {
      if (typeof a.topicId === "number") map.set(a.topicId, a);
    }
    return map;
  }, [articles]);

  const weeklyArticles = useMemo(() => articles.filter(a => isInThisWeek(a.createdAt)), [articles]);
  const publishedCount = useMemo(() => articles.filter(a => a.status === "已发布").length, [articles]);
  const sceneCount = topics.length > 0 ? topics.length : tasks.length;

  const pendingTopicIds = useMemo(
    () => topics.filter(t => !articleByTopicId.has(t.id)).map(t => t.id),
    [topics, articleByTopicId],
  );

  const queriesReady =
    enabled && !tasksQuery.isLoading && !topicsQuery.isLoading && !analysisQuery.isLoading;
  const showDiagnosisEmpty = queriesReady && !hasDiagnosisData;
  const showDirectionEmpty =
    queriesReady &&
    hasDiagnosisData &&
    topics.length === 0 &&
    tasks.length > 0 &&
    !preparingTopics &&
    !generateTopicsMutation.isPending;

  useEffect(() => {
    autoTopicsTriggeredRef.current = false;
    setPreparingTopics(false);
    setGeneratingTopicIds(new Set());
    setExpandedTopicIds(new Set());
    setBatchState(null);
    setSelectedContentTaskId(null);
    setPlatformBatchQueue(null);
    setPlatformBatchRunning(false);
    setPublishSuccessNotice(null);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!enabled || !queriesReady) return;
    if (autoTopicsTriggeredRef.current) return;
    if (tasks.length === 0) return;
    if (topics.length > 0 && !hasStaleTopics) return;

    autoTopicsTriggeredRef.current = true;
    setPreparingTopics(true);
    const projectId = resolveMutationProjectId(selectedProjectId, location);
    if (!projectId) return;
    generateTopicsMutation
      .mutateAsync({ projectId, generationCount: DEFAULT_WEEKLY_GENERATION_COUNT })
      .then(async () => {
        await topicsQuery.refetch();
      })
      .catch(err => {
        toast.error(readGenerateArticleError(err));
      })
      .finally(() => {
        setPreparingTopics(false);
      });
  }, [
    enabled,
    queriesReady,
    topics.length,
    tasks.length,
    hasStaleTopics,
    selectedProjectId,
    location,
    generateTopicsMutation,
    topicsQuery,
  ]);

  const invalidateArticles = useCallback(async () => {
    if (!selectedProjectId) return;
    await Promise.all([
      utils.geo.articles.list.invalidate({ projectId: selectedProjectId }),
      utils.geo.articles.latestQualityScores.invalidate({ projectId: selectedProjectId }),
      utils.geo.articles.topics.list.invalidate({ projectId: selectedProjectId }),
    ]);
    await articlesQuery.refetch();
    await scoresQuery.refetch();
  }, [selectedProjectId, utils, articlesQuery, scoresQuery]);

  const generateOne = useCallback(
    async (
      topicId: number,
      strategyOverride?: Partial<PlatformContentStrategyInput>,
      options?: { silentToast?: boolean },
    ): Promise<{ ok: boolean; userNotice?: string | null; errorDetail?: string }> => {
      const effectiveStrategy = { ...platformStrategy, ...strategyOverride };
      const strategyErr = validatePlatformContentStrategy(effectiveStrategy);
      if (strategyErr) {
        if (!options?.silentToast) {
          toast.error(strategyErr);
          return { ok: false };
        }
        throw new Error(strategyErr);
      }
      setGeneratingTopicIds(prev => new Set(prev).add(topicId));
      try {
        const data = await generateArticleMutation.mutateAsync({
          topicId,
          targetPublishPlatform: effectiveStrategy.targetPublishPlatform,
          contentStrategyType: effectiveStrategy.contentStrategyType,
          publishIdentity: effectiveStrategy.publishIdentity,
          recommendedAccountGroup: effectiveStrategy.recommendedAccountGroup,
          targetQuestion: effectiveStrategy.targetQuestion.trim(),
          geoEnhancementGoal: effectiveStrategy.geoEnhancementGoal,
          targetAiPlatforms: [...effectiveStrategy.targetAiPlatforms],
          contentTaskId: geoContentTaskSource?.contentTaskId ?? undefined,
          diagnosisFinding: geoContentTaskSource?.diagnosisFinding,
          geoGap: geoContentTaskSource?.geoGapSummary,
          platformRule: formatPlatformRuleSummaryForGeneration(
            effectiveStrategy.targetPublishPlatform,
          ),
          questionTemplateId: selectedQuestionTemplateId ?? undefined,
        });
        await invalidateArticles();
        const userNotice = data.userNotice ?? null;
        if (userNotice && !options?.silentToast) {
          toast.message(userNotice);
        }
        return { ok: true, userNotice };
      } catch (err) {
        if (!options?.silentToast && handleSubscriptionLimitMutationError(err)) {
          return { ok: false, userNotice: null };
        }
        const msg = readGenerateArticleError(err);
        if (!options?.silentToast) {
          toast.error(msg);
          return { ok: false, userNotice: null };
        }
        throw err instanceof Error ? err : new Error(msg);
      } finally {
        setGeneratingTopicIds(prev => {
          const next = new Set(prev);
          next.delete(topicId);
          return next;
        });
      }
    },
    [generateArticleMutation, invalidateArticles, platformStrategy, geoContentTaskSource, selectedQuestionTemplateId],
  );

  const handleGenerateOne = (topicId: number) => {
    void generateOne(topicId);
  };

  const resolveGenerationCount = useCallback((): number | null => {
    if (countPreset === "custom") {
      const err = weeklyGenerationCountClientError(customCount);
      setCountError(err);
      return err ? null : Number(customCount);
    }
    setCountError(null);
    return Number(countPreset);
  }, [countPreset, customCount]);

  const handleWeeklyGenerate = async () => {
    const projectId = resolveMutationProjectId(selectedProjectId, location);
    if (!projectId) {
      toast.error(PLATFORM_CONTENT_PROJECT_ACCESS_MESSAGE);
      return;
    }
    if (platformStrategyError) {
      toast.error(platformStrategyError);
      return;
    }
    const targetCount = resolveGenerationCount();
    if (targetCount == null) return;

    setBatchState({ current: 0, total: targetCount, target: targetCount });
    try {
      const topicResult = await generateTopicsMutation.mutateAsync({
        projectId,
        generationCount: targetCount,
      });
      const [topicRefetch, articleRefetch] = await Promise.all([topicsQuery.refetch(), articlesQuery.refetch()]);
      const refreshedTopics = (topicRefetch.data ?? []) as TopicRow[];
      const refreshedArticles = (articleRefetch.data ?? []) as ArticleRow[];
      const topicToArticle = new Map<number, ArticleRow>();
      for (const a of refreshedArticles) {
        if (typeof a.topicId === "number") topicToArticle.set(a.topicId, a);
      }
      const pending = refreshedTopics.filter(t => !topicToArticle.has(t.id)).map(t => t.id);
      const toGenerate = pending.slice(0, targetCount);
      const total = toGenerate.length;
      if (total === 0) {
        toast.message("暂无可生成的内容方向，请先完成内容诊断");
        return;
      }
      setBatchState({ current: 0, total, target: targetCount });
      let done = 0;
      for (let i = 0; i < toGenerate.length; i++) {
        const topicId = toGenerate[i]!;
        setBatchState({ current: i + 1, total, target: targetCount });
        const result = await generateOne(topicId);
        if (result.ok) done += 1;
      }
      const planned = topicResult?.count ?? targetCount;
      if (done === 0) {
        toast.error("本次生成未成功，请检查客户资料是否完整后重试");
      } else if (done < planned) {
        toast.success(`本次实际生成 ${done} 篇内容（目标 ${planned} 篇）`);
      } else {
        toast.success(`已生成 ${done} 篇内容`);
      }
    } catch {
      toast.error("生成本周内容失败，请稍后重试");
    } finally {
      setBatchState(null);
    }
  };

  const batchBusy = batchState !== null || platformBatchRunning;
  const anyGenerating =
    batchBusy || generatingTopicIds.size > 0 || generateArticleMutation.isPending || platformBatchRunning;
  const batchDone = !batchBusy && pendingTopicIds.length === 0 && topics.length > 0 && topics.every(t => articleByTopicId.has(t.id));

  const estMinutesRemaining = batchState ? Math.max(1, Math.ceil((batchState.total - batchState.current + 1) * 2)) : 0;

  const generatedAssetCount = useMemo(
    () => topics.filter(t => articleByTopicId.has(t.id)).length,
    [topics, articleByTopicId],
  );
  const publishedAssetCount = useMemo(
    () => topics.filter(t => articleByTopicId.get(t.id)?.status === "已发布").length,
    [topics, articleByTopicId],
  );
  const pendingPublishCount = Math.max(0, generatedAssetCount - publishedAssetCount);

  const displayTargetCount = useMemo(() => {
    if (batchState) return batchState.target;
    if (countPreset === "custom") {
      const err = weeklyGenerationCountClientError(customCount);
      if (err) return null;
      return Number(customCount);
    }
    return Number(countPreset);
  }, [batchState, countPreset, customCount]);

  const platformBoardRows = useMemo((): PlatformBoardRow[] => {
    const linkedQuestion = geoContentTaskSource?.linkedQuestion ?? platformStrategy.targetQuestion;
    const sceneLabel = geoContentTaskSource?.sceneLabel ?? "";
    return WEEKLY_PLATFORM_DEFS.map(def => {
      const counts: PlatformContentCounts = {
        pending: 0,
        pendingConfirm: 0,
        ready: 0,
        published: 0,
      };
      for (const topic of topics) {
        const task = tasks.find(t => t.id === topic.optimizationTaskId);
        const card = parseGeoOptimizationTaskCard(task?.executionSuggestion ?? null);
        const article = articleByTopicId.get(topic.id);
        const platformKey = article
          ? getArticlePublishPlatform({
              generationBasis: article.generationBasis ?? null,
              targetPlatform: article.targetPlatform,
              publishPlatform: article.publishPlatform,
            }).weeklyPlatformKey
          : normalizeWeeklyPlatformKey(card?.recommendedPlatform?.[0]);
        if (platformKey !== def.key) continue;
        if (!article) {
          counts.pending += 1;
          continue;
        }
        const q = scoresByArticleId.get(article.id);
        const pass = qualityPasses(article, q);
        if (article.status === "已发布") counts.published += 1;
        else if (pass) counts.ready += 1;
        else counts.pendingConfirm += 1;
      }
      return {
        def,
        counts,
        platformRole: getWeeklyPlatformContentRole(def.key),
        platformGenerationGoal: buildWeeklyPlatformGenerationGoal(def.key, linkedQuestion, sceneLabel),
        publishHint:
          counts.ready > 0
            ? "本平台已有可发布内容，建议进入发布队列。"
            : counts.pendingConfirm > 0
              ? "本平台内容待质检确认，确认后可加入发布队列。"
              : counts.pending > 0
                ? "本平台仍有待生成任务，请先生成内容。"
                : counts.published > 0
                  ? "本平台已有发布内容，建议回填公开链接并进入复测。"
                  : "先生成本平台内容，再推进发布与复测。",
      };
    });
  }, [
    topics,
    tasks,
    articleByTopicId,
    scoresByArticleId,
    geoContentTaskSource?.linkedQuestion,
    geoContentTaskSource?.sceneLabel,
    platformStrategy.targetQuestion,
  ]);

  const contentCardModels = useMemo((): WeeklyArticleCardModel[] => {
    const publishRecords = publishRecordsQuery.data ?? [];
    const publishTasks = publishTasksQuery.data?.tasks ?? [];
    return articles
      .filter(a => typeof a.topicId === "number")
      .map(a => {
        const topic = topics.find(t => t.id === a.topicId);
        const task = topic ? tasks.find(t => t.id === topic.optimizationTaskId) : undefined;
        const card = parseGeoOptimizationTaskCard(task?.executionSuggestion ?? null);
        const q = scoresByArticleId.get(a.id);
        const pass = qualityPasses(a, q);
        const published = a.status === "已发布";
        const statusView = resolveContentCardStatus({ published, publishable: pass });
        const ps = a.generationBasis?.platformContentStrategy as Record<string, unknown> | undefined;
        const keywords = Array.isArray(ps?.targetAiPlatforms)
          ? (ps.targetAiPlatforms as string[]).filter(x => typeof x === "string")
          : [];
        const platformResolved = getArticlePublishPlatform({
          generationBasis: a.generationBasis ?? null,
          targetPlatform: a.targetPlatform,
          publishPlatform: a.publishPlatform,
        });
        const publishReadiness = evaluatePublishReadiness({
          ...publishBaseContext,
          article: a,
        });
        const platformKey = platformResolved.recognized
          ? normalizeWeeklyPlatformKey(platformResolved.label)
          : normalizeWeeklyPlatformKey(a.targetPlatform);
        return {
          id: a.id,
          title: a.title ?? topic?.title ?? "未命名内容",
          targetPlatform: platformResolved.recognized ? platformResolved.label : a.targetPlatform,
          platformKey,
          contentTypeLabel: resolveContentTypeLabel(a),
          publishBlockHint: publishReadiness.ready ? null : publishReadiness.message,
          publishNextActionLabel: publishReadiness.ready ? null : publishReadiness.nextActionLabel,
          contentGoal: geoContentTaskSource?.taskDisplayName ?? null,
          geoGap:
            geoContentTaskSource?.geoGapSummary ??
            latestDiagnosisGap ??
            card?.keyPoints?.[0] ??
            topic?.businessReason?.slice(0, 120) ??
            null,
          keywords,
          statusLabel: statusView.label,
          statusTone: statusView.tone,
          statusFilterKey: statusView.filterKey,
          qualityView: resolveQualityCardView(a),
          qualityFailHints: resolveFriendlyQualityFailHints(a),
          qualityOptimizationSuggestions: resolveGeoQualityOptimizationSuggestions(a),
          qualityScore: a.geoQualityScore ?? q?.totalScore ?? null,
          qualityScoreRow: q ?? null,
          strategySummary: formatArticleStrategySummary(a),
          coverThumbnailSrc: resolveArticleCoverPreviewSrc(a),
          publishLink: resolveArticlePublishLink({
            articleId: a.id,
            publicPath: a.publicPath,
            publishRecords,
            publishTasks,
          }),
          publishedAtLabel: published
            ? formatArticlePublishedAtSentence(
                resolveArticlePublishedAtForDisplay({
                  publishedAt: a.publishedAt,
                  lastPublishRecordAt: a.lastPublishRecordAt,
                }),
              )
            : null,
          lifecycle: a.lifecycle,
          postPublish: a.postPublish,
          contentTags: normalizeContentTags(a.contentTags),
          contentReviewStatus: normalizeContentReviewStatus(a.contentReviewStatus),
          article: a as Record<string, unknown>,
        };
      });
  }, [
    articles,
    topics,
    tasks,
    scoresByArticleId,
    latestDiagnosisGap,
    geoContentTaskSource,
    publishBaseContext,
    publishRecordsQuery.data,
    publishTasksQuery.data?.tasks,
  ]);

  const displayContentCards = useMemo((): WeeklyArticleCardModel[] => {
    const filtered = filterWeeklyContentCards<WeeklyArticleCardModel>(contentCardModels, {
      platform: filterPlatform,
      status: filterStatus,
      titleQuery: titleSearch,
      contentTag: filterContentTag,
    });
    return sortWeeklyContentCardsByQuality(filtered, sortQuality);
  }, [contentCardModels, filterPlatform, filterStatus, filterContentTag, titleSearch, sortQuality]);

  const contentTagStats = useMemo(() => computeContentTagStats(contentCardModels), [contentCardModels]);
  const platformProgressText = useMemo(() => {
    const pending = platformBoardRows.reduce((sum, row) => sum + row.counts.pending, 0);
    const generated = platformBoardRows.reduce(
      (sum, row) => sum + row.counts.pendingConfirm + row.counts.ready + row.counts.published,
      0,
    );
    const publishable = platformBoardRows.reduce((sum, row) => sum + row.counts.ready, 0);
    const published = platformBoardRows.reduce((sum, row) => sum + row.counts.published, 0);
    return `待生成 ${pending} / 已生成 ${generated} / 可发布 ${publishable} / 已发布 ${published}`;
  }, [platformBoardRows]);
  const contentNextAction = useMemo(() => {
    const publishable = platformBoardRows.reduce((sum, row) => sum + row.counts.ready, 0);
    const generated = platformBoardRows.reduce(
      (sum, row) => sum + row.counts.pendingConfirm + row.counts.ready + row.counts.published,
      0,
    );
    if (publishable > 0) return "进入平台适配发布，将可发布内容加入发布队列。";
    if (generated > 0) return "优先完成内容质检，形成可发布资产。";
    return "先按平台生成本轮内容资产，再进入发布队列。";
  }, [platformBoardRows]);

  const averageQualityScore = useMemo(
    () => computeAverageGeoQualityScore(contentCardModels.map(card => card.qualityScore)),
    [contentCardModels],
  );

  const toggleCardSelection = useCallback((articleId: number, checked: boolean) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(articleId);
      else next.delete(articleId);
      return next;
    });
  }, []);

  const toggleSelectVisibleCards = useCallback(
    (checked: boolean) => {
      setSelectedCardIds(prev => {
        const next = new Set(prev);
        for (const card of displayContentCards) {
          if (card.statusFilterKey === "published") continue;
          if (checked) next.add(card.id);
          else next.delete(card.id);
        }
        return next;
      });
    },
    [displayContentCards],
  );

  const toggleExpand = (topicId: number) => {
    setExpandedTopicIds(prev => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  };

  const openEditor = (article: ArticleRow) => {
    setEditorArticle(article);
    setEditorOpen(true);
  };

  const setArticleUnsaved = useCallback((articleId: number, unsaved: boolean) => {
    setUnsavedArticleIds(prev => {
      const has = prev.has(articleId);
      if (unsaved === has) return prev;
      const next = new Set(prev);
      if (unsaved) next.add(articleId);
      else next.delete(articleId);
      return next;
    });
  }, []);

  const blockPublishIfUnsaved = useCallback(
    (articleId: number): boolean => {
      if (!unsavedArticleIds.has(articleId)) return false;
      toast.error(ARTICLE_UNSAVED_PUBLISH_BLOCK_MESSAGE);
      return true;
    },
    [unsavedArticleIds],
  );

  const blockPublishIfQualityReject = useCallback((article: ArticleRow): boolean => {
    if (!shouldBlockPublishForGeoQuality(article)) return false;
    toast.error("内容质量不足，建议优化后再发布");
    return true;
  }, []);

  const openPublishDialog = (article: ArticleRow) => {
    if (blockPublishIfUnsaved(article.id)) return;
    if (blockPublishIfQualityReject(article)) return;
    if (articleNeedsCoverSaveHint(article)) {
      toast.message(ARTICLE_MISSING_COVER_PUBLISH_HINT_MESSAGE);
    }
    if (isGeoQualityScoreStale(article)) {
      toast.message(GEO_QUALITY_STALE_PUBLISH_HINT);
    } else if (article.geoQualityRecommendation === "revise") {
      toast.message("内容有优化空间，确认后可继续发布");
    }
    if (isContentReviewPending(article.contentReviewStatus)) {
      toast.message(CONTENT_REVIEW_PENDING_ENQUEUE_HINT);
    }
    setPublishArticle(article);
    setManualPublishPlatform("");
    const resolved = getArticlePublishPlatform({
      generationBasis: article.generationBasis ?? null,
      targetPlatform: article.targetPlatform,
      publishPlatform: article.publishPlatform,
    });
    setPublishPlatformResolved(resolved);
    const publishSlug =
      resolved.publishQueueSlug && resolved.supportedByLocalAgent && !resolved.queueBlockedReason
        ? resolved.publishQueueSlug
        : null;
    setSelectedPlatforms(publishSlug ? new Set([publishSlug]) : new Set());
    const restoredAccounts: Record<string, number> = {};
    if (selectedProjectId && publishSlug) {
      const lastId = readLastEnqueuePublishAccountId(selectedProjectId, publishSlug);
      if (lastId != null) restoredAccounts[publishSlug] = lastId;
    }
    setSelectedPublishAccountIds(restoredAccounts);
    publishDialogPlatformsInitRef.current = true;
    void hydratePublishDialogAgent({ syncToWeb: false });
    setPublishDialogOpen(true);
  };

  const pickPendingTopicForPlatform = useCallback(
    (platformKey: WeeklyPlatformKey, topicRows: TopicRow[], articleTopicIds: Set<number>) => {
      const def = WEEKLY_PLATFORM_DEFS.find(d => d.key === platformKey)!;
      return resolvePendingPlatformTopic({
        platformKey,
        platformLabel: def.label,
        topicRows,
        articleTopicIds,
        tasks,
        taskIdSet,
        activeTaskId: geoContentTaskSource?.contentTaskId ?? null,
      });
    },
    [tasks, taskIdSet, geoContentTaskSource?.contentTaskId],
  );

  const recordPlatformGenerationFailure = useCallback(
    (
      platformKey: WeeklyPlatformKey,
      topicId: number,
      strategyOverride: Partial<PlatformContentStrategyInput>,
      lastError: string,
    ) => {
      let failCount = 1;
      setPlatformGenerationRetry(prev => {
        failCount = nextConsecutiveGenerationFailCount(platformKey, prev);
        return { platformKey, topicId, strategyOverride, failCount };
      });
      return resolveContentGenerationFailureDisplay({ failCount, lastError });
    },
    [],
  );

  const clearPlatformGenerationRetry = useCallback((platformKey?: WeeklyPlatformKey) => {
    setPlatformGenerationRetry(prev => {
      if (!prev) return null;
      if (platformKey && prev.platformKey !== platformKey) return prev;
      return null;
    });
  }, []);

  const resolvePlatformGenerationParams = useCallback(
    async (
      platformKey: WeeklyPlatformKey,
    ): Promise<
      | { ok: true; topicId: number; strategyOverride: Partial<PlatformContentStrategyInput> }
      | { ok: false; errorMessage: string }
    > => {
      let projectId: number;
      try {
        projectId = assertMutationProjectId(selectedProjectId, location, accessibleProjectIds);
      } catch {
        return { ok: false, errorMessage: PLATFORM_CONTENT_PROJECT_ACCESS_MESSAGE };
      }

      const publishId = resolvePublishSlugForWeeklyPlatform(platformKey);
      const strategyOverride: Partial<PlatformContentStrategyInput> = {};
      if (publishId) {
        strategyOverride.targetPublishPlatform = publishId;
        setPlatformStrategy(prev => ({ ...prev, targetPublishPlatform: publishId }));
      }
      if (platformKey === "xiaohongshu") {
        strategyOverride.contentStrategyType = "seeding";
        setPlatformStrategy(prev => ({ ...prev, contentStrategyType: "seeding" }));
      }

      const reloadTopicGenerationSnapshot = async () => {
        const [topicList, articleList] = await Promise.all([
          utils.geo.articles.topics.list.fetch({ projectId }),
          utils.geo.articles.list.fetch({ projectId }),
        ]);
        const rows = (topicList ?? []).filter(t => t != null && typeof t.id === "number") as TopicRow[];
        const articleTopicIds = buildArticleTopicIdSet((articleList ?? []) as ArticleRow[]);
        return { topicRows: rows, articleTopicIds };
      };

      const regenTopicsIfNeeded = async () => {
        await generateTopicsMutation.mutateAsync({
          projectId,
          generationCount: DEFAULT_WEEKLY_GENERATION_COUNT,
        });
        await utils.geo.articles.topics.list.invalidate({ projectId });
        await utils.geo.articles.list.invalidate({ projectId });
        return reloadTopicGenerationSnapshot();
      };

      let { topicRows, articleTopicIds } = await reloadTopicGenerationSnapshot();
      let pending = pickPendingTopicForPlatform(platformKey, topicRows, articleTopicIds);

      if (!pending && topicRows.length === 0 && tasks.length === 0 && analyses.length > 0) {
        await generateTasksMutation.mutateAsync({ projectId });
        const tasksRefetch = await tasksQuery.refetch();
        const refreshedTasks = (tasksRefetch.data ?? []) as TaskRow[];
        if (refreshedTasks.length > 0) {
          ({ topicRows, articleTopicIds } = await regenTopicsIfNeeded());
          pending = pickPendingTopicForPlatform(platformKey, topicRows, articleTopicIds);
        }
      }

      if (
        !pending &&
        tasks.length > 0 &&
        countUnassignedPendingTopics(topicRows, articleTopicIds, taskIdSet) === 0
      ) {
        ({ topicRows, articleTopicIds } = await regenTopicsIfNeeded());
        pending = pickPendingTopicForPlatform(platformKey, topicRows, articleTopicIds);
      }

      if (!pending?.id || !isTopicIdInRows(pending.id, topicRows)) {
        ({ topicRows, articleTopicIds } = await reloadTopicGenerationSnapshot());
        pending = pickPendingTopicForPlatform(platformKey, topicRows, articleTopicIds);
      }

      if (!pending?.id || !isTopicIdInRows(pending.id, topicRows)) {
        return { ok: false, errorMessage: PLATFORM_CONTENT_NO_PLATFORM_TASK_MESSAGE };
      }
      return { ok: true, topicId: pending.id, strategyOverride };
    },
    [
      tasks.length,
      analyses.length,
      pickPendingTopicForPlatform,
      generateTopicsMutation,
      generateTasksMutation,
      selectedProjectId,
      location,
      accessibleProjectIds,
      tasksQuery,
      taskIdSet,
      utils,
    ],
  );

  const generatePlatformContent = useCallback(
    async (
      platformKey: WeeklyPlatformKey,
      options?: {
        silentToast?: boolean;
        /** 重试时复用上次 topic 与策略参数，不再重新匹配选题 */
        retryParams?: { topicId: number; strategyOverride: Partial<PlatformContentStrategyInput> };
      },
    ): Promise<{
      ok: boolean;
      errorMessage?: string;
      userNotice?: string | null;
      topicId?: number;
      strategyOverride?: Partial<PlatformContentStrategyInput>;
    }> => {
      let resolved:
        | { ok: true; topicId: number; strategyOverride: Partial<PlatformContentStrategyInput> }
        | { ok: false; errorMessage: string };
      if (options?.retryParams) {
        try {
          const projectId = assertMutationProjectId(selectedProjectId, location, accessibleProjectIds);
          const topicList = await utils.geo.articles.topics.list.fetch({ projectId });
          const topicRows = (topicList ?? []).filter(t => t != null && typeof t.id === "number") as TopicRow[];
          if (isTopicIdInRows(options.retryParams.topicId, topicRows)) {
            resolved = {
              ok: true,
              topicId: options.retryParams.topicId,
              strategyOverride: options.retryParams.strategyOverride,
            };
          } else {
            resolved = await resolvePlatformGenerationParams(platformKey);
          }
        } catch {
          resolved = { ok: false, errorMessage: PLATFORM_CONTENT_PROJECT_ACCESS_MESSAGE };
        }
      } else {
        resolved = await resolvePlatformGenerationParams(platformKey);
      }
      if (!resolved.ok) {
        if (!options?.silentToast) {
          toast.error(resolved.errorMessage);
        }
        return { ok: false, errorMessage: resolved.errorMessage };
      }

      const { topicId, strategyOverride } = resolved;
      const result = await generateOne(topicId, strategyOverride, { silentToast: true });
      if (!result.ok) {
        const failure = recordPlatformGenerationFailure(
          platformKey,
          topicId,
          strategyOverride,
          result.errorDetail ?? "内容生成失败，请稍后重试",
        );
        if (!options?.silentToast) {
          toast.error(failure.message);
        }
        return {
          ok: false,
          errorMessage: failure.message,
          topicId,
          strategyOverride,
        };
      }
      clearPlatformGenerationRetry(platformKey);
      return { ok: true, userNotice: result.userNotice, topicId, strategyOverride };
    },
    [
      resolvePlatformGenerationParams,
      generateOne,
      recordPlatformGenerationFailure,
      clearPlatformGenerationRetry,
      selectedProjectId,
      location,
      accessibleProjectIds,
      utils,
    ],
  );

  const runPlatformContentGenerationUi = async (
    platformKey: WeeklyPlatformKey,
    options?: { retryParams?: { topicId: number; strategyOverride: Partial<PlatformContentStrategyInput> } },
  ) => {
    setGeneratingPlatformKey(platformKey);
    setPlatformProgressLabelKey(platformKey);
    setPlatformProgressErrorCategory(undefined);
    setPlatformProgressErrorMessage(undefined);
    if (!options?.retryParams) {
      platformContentProgress.reset();
    }
    platformContentProgress.start();

    try {
      platformContentProgress.setStage(10);
      platformContentProgress.setStage(25);
      platformContentProgress.setStage(40);
      platformContentProgress.allowOptimisticUpTo(80);
      const result = await generatePlatformContent(platformKey, options);
      if (!result.ok) {
        const msg = result.errorMessage ?? "内容生成失败，请稍后重试";
        const exhausted = msg === CONTENT_GENERATION_RETRY_EXHAUSTED_MESSAGE;
        setPlatformProgressErrorCategory(exhausted ? undefined : "unknown");
        setPlatformProgressErrorMessage(msg);
        platformContentProgress.fail();
        if (!options?.retryParams) {
          toast.error(msg);
        }
        return;
      }
      platformContentProgress.setStage(95);
      platformContentProgress.complete();
      if (result.userNotice) {
        toast.message(result.userNotice);
      } else {
        toast.success(options?.retryParams ? "内容已重新生成并保存。" : "内容已生成并保存。");
      }
      window.setTimeout(() => platformContentProgress.reset(), 5000);
    } catch (err) {
      const raw =
        err instanceof TRPCClientError ? err.message : err instanceof Error ? err.message : "";
      const msg = readGenerateArticleError(err);
      const topicId = options?.retryParams?.topicId ?? platformGenerationRetry?.topicId;
      const strategyOverride =
        options?.retryParams?.strategyOverride ?? platformGenerationRetry?.strategyOverride;
      let displayMessage = msg;
      if (topicId != null && strategyOverride) {
        const failure = recordPlatformGenerationFailure(platformKey, topicId, strategyOverride, msg);
        displayMessage = failure.message;
      }
      const exhausted = displayMessage === CONTENT_GENERATION_RETRY_EXHAUSTED_MESSAGE;
      setPlatformProgressErrorMessage(displayMessage);
      setPlatformProgressErrorCategory(
        exhausted ? undefined : mapPlatformContentErrorCategory(raw || msg),
      );
      platformContentProgress.fail();
      toast.error(msg);
    } finally {
      setGeneratingPlatformKey(null);
    }
  };

  const handlePlatformGenerate = async (platformKey: WeeklyPlatformKey) => {
    await runPlatformContentGenerationUi(platformKey);
  };

  const handlePlatformRegenerate = () => {
    if (!platformGenerationRetry) return;
    const { platformKey, topicId, strategyOverride, failCount } = platformGenerationRetry;
    const display = resolveContentGenerationFailureDisplay({ failCount, lastError: null });
    if (!display.canRegenerate) return;
    void runPlatformContentGenerationUi(platformKey, {
      retryParams: { topicId, strategyOverride },
    });
  };

  const runPlatformBatchItem = useCallback(
    async (platformKey: WeeklyPlatformKey): Promise<{ ok: boolean; errorMessage?: string }> => {
      setGeneratingPlatformKey(platformKey);
      setPlatformBatchQueue(prev =>
        prev
          ? updatePlatformBatchItemStatus(prev, platformKey, { status: "running", errorMessage: undefined })
          : prev,
      );
      try {
        const result = await generatePlatformContent(platformKey, { silentToast: true });
        setPlatformBatchQueue(prev =>
          prev
            ? updatePlatformBatchItemStatus(prev, platformKey, {
                status: result.ok ? "completed" : "failed",
                errorMessage: result.ok ? undefined : result.errorMessage,
              })
            : prev,
        );
        return result;
      } catch (err) {
        const msg = readGenerateArticleError(err);
        setPlatformBatchQueue(prev =>
          prev
            ? updatePlatformBatchItemStatus(prev, platformKey, { status: "failed", errorMessage: msg })
            : prev,
        );
        return { ok: false, errorMessage: msg };
      } finally {
        setGeneratingPlatformKey(null);
      }
    },
    [generatePlatformContent],
  );

  const handleBatchGenerateAllPlatforms = async () => {
    try {
      assertMutationProjectId(selectedProjectId, location, accessibleProjectIds);
    } catch {
      toast.error(PLATFORM_CONTENT_PROJECT_ACCESS_MESSAGE);
      return;
    }
    if (platformStrategyError) {
      toast.error(platformStrategyError);
      return;
    }
    const queue = buildPlatformBatchQueue(
      WEEKLY_PLATFORM_DEFS.map(def => ({ key: def.key, label: def.label })),
    );
    setPlatformBatchQueue(queue);
    setPlatformBatchRunning(true);
    try {
      for (const def of WEEKLY_PLATFORM_DEFS) {
        await runPlatformBatchItem(def.key);
      }
      setPlatformBatchQueue(prev => {
        const done = prev ? countPlatformBatchCompleted(prev) : 0;
        const total = prev?.length ?? WEEKLY_PLATFORM_DEFS.length;
        if (done === total) {
          toast.success(`全部平台内容已生成（${done}/${total}）`);
        } else if (done > 0) {
          toast.message(`部分平台生成完成：${done}/${total} 个平台成功`);
        } else {
          toast.error("全部平台生成失败，请检查诊断与资料后重试");
        }
        return prev;
      });
    } finally {
      setPlatformBatchRunning(false);
    }
  };

  const handleRetryPlatformBatchItem = (platformKey: string) => {
    void (async () => {
      setPlatformBatchRunning(true);
      try {
        const result = await runPlatformBatchItem(platformKey as WeeklyPlatformKey);
        if (result.ok) {
          toast.success("该平台内容已重新生成");
        } else {
          toast.error(result.errorMessage ?? "重试失败，请稍后再试");
        }
      } finally {
        setPlatformBatchRunning(false);
      }
    })();
  };

  const activePlatformProgressLabel = useMemo(() => {
    const key = platformProgressLabelKey ?? generatingPlatformKey;
    if (!key) return null;
    return WEEKLY_PLATFORM_DEFS.find(d => d.key === key)?.label ?? null;
  }, [platformProgressLabelKey, generatingPlatformKey]);

  const platformProgressFailureDisplay = useMemo(
    () =>
      resolveContentGenerationFailureDisplay({
        failCount: platformGenerationRetry?.failCount ?? 0,
        lastError: platformProgressErrorMessage,
      }),
    [platformGenerationRetry?.failCount, platformProgressErrorMessage],
  );

  const canRegeneratePlatformContent =
    platformContentProgress.isFailed &&
    platformGenerationRetry != null &&
    platformProgressFailureDisplay.canRegenerate;

  const handlePlatformView = (platformKey: WeeklyPlatformKey) => {
    const hit = articles.find(
      a =>
        getArticlePublishPlatform({
          generationBasis: a.generationBasis ?? null,
          targetPlatform: a.targetPlatform,
          publishPlatform: a.publishPlatform,
        }).weeklyPlatformKey === platformKey,
    );
    if (hit) openEditor(hit);
    else toast.message("该平台暂无已生成内容，请先点击「生成该平台内容」");
  };

  const handleRegenerateCover = async (article: ArticleRow) => {
    if (!selectedProjectId) return;
    const title = (article.title ?? "").trim();
    const content = (article.markdownContent ?? "").trim();
    if (!title || !content) {
      toast.error("请先通过「编辑内容」填写标题与正文");
      return;
    }
    setRegeneratingCoverIds(prev => new Set(prev).add(article.id));
    try {
      const template = normalizeArticleCoverTemplateId(article.coverTemplate);
      const { coverBase64 } = await renderArticleCoverPng({ template, title, brandName });
      await updateGeneratedArticle.mutateAsync({
        projectId: selectedProjectId,
        articleId: article.id,
        title,
        content,
        coverTemplate: template,
        coverBase64,
        coverImageUrl: null,
      });
      await invalidateArticles();
      toast.success("封面已重新生成");
    } catch (err) {
      toast.error(toUserFacingErrorFromUnknown(err, "封面生成失败，可重试"));
    } finally {
      setRegeneratingCoverIds(prev => {
        const next = new Set(prev);
        next.delete(article.id);
        return next;
      });
    }
  };

  const togglePlatform = (slug: string) => {
    setSelectedPlatforms(prev => {
      const next = new Set(prev);
      const adding = !next.has(slug);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      if (adding && isBindingPublishPlatform(slug)) {
        const ready = getPublishReadyAccountsForPlatform(slug);
        if (ready.length === 1) {
          rememberEnqueuePublishAccount(slug, ready[0]!.id);
        }
      }
      return next;
    });
  };

  const pollPublishTasksUntilDone = useCallback(
    async (articleId: number, taskIds: number[]) => {
      if (!selectedProjectId || taskIds.length === 0) return;

      for (let i = 0; i < 40; i += 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const data = await utils.publishTasks.latestByArticle.fetch({
          articleId,
          projectId: selectedProjectId,
        });
        const tracked = data.tasks.filter(t => taskIds.includes(t.id));
        if (tracked.length === 0) continue;

        const allDone = tracked.every(
          t =>
            t.status === "completed" ||
            t.status === "failed" ||
            t.status === "draft_saved" ||
            t.status === "session_expired" ||
            t.status === "manual_required",
        );
        if (!allDone) continue;

        await invalidateArticles();

        const ok = tracked.filter(t => t.status === "completed");
        const drafts = tracked.filter(t => t.status === "draft_saved");
        const manual = tracked.filter(t => t.status === "manual_required");
        const failed = tracked.filter(t => t.status === "failed");
        if (ok.length > 0) {
          showPublishSuccessNotification(
            {
              platformLabel: formatPublishSuccessPlatformPhrase(
                ok.map(t => publishPlatformCustomerLabel(t.platform)),
              ),
              articleUrl: resolvePublishSuccessArticleUrl(
                ok.map(t => t.resultUrl ?? t.publishedUrl),
              ),
            },
            setPublishSuccessNotice,
          );
          if (ok.length < tracked.length) {
            toast.message(
              `${ok.length} 个平台发布成功，${drafts.length} 个已存草稿，${failed.length} 个失败`,
            );
          }
        } else if (drafts.length > 0 && failed.length === 0) {
          toast.success("内容已保存为平台草稿，请在平台内确认后正式发布");
        } else if (manual.length > 0 && failed.length === 0 && ok.length === 0) {
          toast.success(
            manual.length === tracked.length
              ? "本地 Agent 已填入标题与正文，状态为需人工确认：请在知乎窗口手动保存草稿，并在「资产发布记录」查看任务状态"
              : `${manual.length} 个平台需人工确认保存，请在本地客户端窗口完成操作`,
          );
        } else {
          const first = failed[0] ?? tracked.find(t => t.status === "session_expired" || t.status === "manual_required");
          const detail =
            first?.agentErrorMessage?.trim() ||
            first?.errorMessage?.split("\n")[0] ||
            "";
          toast.error(
            first
              ? publishTaskStatusLabel({
                  status: first.status,
                  accountVerificationStatus: first.accountVerificationStatus,
                  errorMessage: first.errorMessage,
                  agentErrorMessage: first.agentErrorMessage,
                }) + (detail ? `：${detail}` : "")
              : "发布失败，请稍后重试",
          );
        }
        return;
      }

      await invalidateArticles();
      toast.message("发布仍在进行，请稍后刷新页面查看状态");
    },
    [invalidateArticles, selectedProjectId, utils],
  );

  const handleConfirmPublish = async () => {
    if (!publishArticle || !selectedProjectId || selectedPlatforms.size === 0) {
      toast.error("请至少选择一个发布平台");
      return;
    }
    if (blockPublishIfUnsaved(publishArticle.id)) return;
    if (blockPublishIfQualityReject(publishArticle)) return;
    const readiness =
      activePublishReadiness ??
      evaluatePublishReadiness({
        ...publishDialogReadinessContext,
        article: publishArticle,
      });
    if (!readiness.ready) {
      toast.error(readiness.message);
      return;
    }
    if (activePrePublishChecklist && !activePrePublishChecklist.allPassed) {
      toast.error(formatPrePublishChecklistBlockMessage(activePrePublishChecklist));
      return;
    }
    await hydratePublishDialogAgent({ syncToWeb: true });
    const freshAccountGroups = selectedProjectId
      ? (((await utils.geo.platformAccounts.list.fetch({ projectId: selectedProjectId }))?.accounts ??
          []) as Array<{ platform: string; accounts: PlatformAccountItem[] }>)
      : platformAccountGroups;
    const getReadyAccountsFresh = (slug: string) => {
      const group = freshAccountGroups.find(g => g.platform === slug);
      return (group?.accounts ?? []).filter(isPublishReadyAccount) as PlatformAccountItem[];
    };
    const getAllEnabledFresh = (slug: string) => {
      const group = freshAccountGroups.find(g => g.platform === slug);
      return (group?.accounts ?? []).filter(a => a.isEnabled) as PlatformAccountItem[];
    };
    const pickPublishAccountFresh = (slug: string): PlatformAccountItem | null => {
      const ready = getReadyAccountsFresh(slug);
      if (ready.length === 0) return null;
      const stored =
        selectedProjectId != null ? readLastEnqueuePublishAccountId(selectedProjectId, slug) : null;
      const preferredId = selectedPublishAccountIds[slug] ?? stored;
      if (preferredId) {
        const found = ready.find(a => a.id === preferredId);
        if (found) return found;
      }
      if (ready.length === 1) return ready[0]!;
      return null;
    };
    for (const slug of Array.from(selectedPlatforms)) {
      if (!isBindingPublishPlatform(slug)) continue;
      const ready = getReadyAccountsFresh(slug);
      const allEnabled = getAllEnabledFresh(slug).filter(a => a.isEnabled);
      if (ready.length === 0) {
        if (allEnabled.some(a => !a.localProfileId?.trim() || !a.localAgentId?.trim())) {
          toast.error(
            `${publishBlockedNoLocalProfileMessage(slug)} 请先下载安装并启动本地发布客户端，然后到企业档案绑定发布账号。`,
          );
          selectedProjectId && setLocation(buildProjectUrl("/enterprise-profile", selectedProjectId) + "#publish-platform-accounts");
          return;
        }
        if (allEnabled.some(a => a.sessionStatus !== "active")) {
          toast.error(publishBlockedSessionExpiredMessage(slug));
          return;
        }
        toast.error(publishBlockedNoAccountMessage(slug));
        return;
      }
      const picked = pickPublishAccountFresh(slug);
      if (!picked) {
        toast.error(publishMustSelectAccountMessage(slug));
        return;
      }
    }
    if (articleNeedsCoverSaveHint(publishArticle)) {
      toast.message(ARTICLE_MISSING_COVER_PUBLISH_HINT_MESSAGE);
    }
    if (isContentReviewPending(publishArticle.contentReviewStatus)) {
      toast.message(CONTENT_REVIEW_PENDING_ENQUEUE_HINT);
    }
    const articleId = publishArticle.id;
    const taskIds: number[] = [];
    try {
      for (const slug of Array.from(selectedPlatforms)) {
        const picked = pickPublishAccountFresh(slug)!;
        const res = await createPublishTask.mutateAsync({
          articleId,
          platform: slug as BindingPublishPlatform,
          projectId: selectedProjectId,
          platformAccountId: picked.id,
        });
        taskIds.push(res.taskId);
        rememberEnqueuePublishAccount(slug, picked.id);
        if (res.publishMode !== "local_agent") {
          toast.error("发布任务未走本地客户端，请联系交付同学检查配置");
          return;
        }
      }
      toast.success("发布任务已发送至本地客户端，请保持客户端运行。");
      notifyPublishEffectPrediction();
      setPublishDialogOpen(false);
      setPublishArticle(null);
      void pollPublishTasksUntilDone(articleId, taskIds);
    } catch (err) {
      toast.error(toUserFacingErrorFromUnknown(err, "创建发布任务失败"));
    }
  };

  const handleBatchEnqueuePublish = async () => {
    if (!selectedProjectId || selectedCardIds.size === 0) {
      toast.error("请先选择要加入发布队列的内容");
      return;
    }
    if (batchEnqueueBusy || anyGenerating) return;

    setBatchEnqueueBusy(true);
    let successCount = 0;
    let skippedCount = 0;
    let pendingReviewEnqueuedCount = 0;
    const taskIdsByArticle = new Map<number, number[]>();

    try {
      await hydratePublishDialogAgent({ syncToWeb: true });
      const freshAccountGroups = (((await utils.geo.platformAccounts.list.fetch({ projectId: selectedProjectId }))
        ?.accounts ?? []) as Array<{ platform: string; accounts: PlatformAccountItem[] }>);
      const getReadyAccountsFresh = (slug: string) => {
        const group = freshAccountGroups.find(g => g.platform === slug);
        return (group?.accounts ?? []).filter(isPublishReadyAccount) as PlatformAccountItem[];
      };
      const pickPublishAccountFresh = (slug: string): PlatformAccountItem | null => {
        const ready = getReadyAccountsFresh(slug);
        if (ready.length === 0) return null;
        const stored = readLastEnqueuePublishAccountId(selectedProjectId, slug);
        if (stored) {
          const found = ready.find(a => a.id === stored);
          if (found) return found;
        }
        if (ready.length === 1) return ready[0]!;
        return null;
      };

      for (const articleId of Array.from(selectedCardIds)) {
        const article = articles.find(a => a.id === articleId);
        if (!article) {
          skippedCount += 1;
          continue;
        }
        if (article.status === "已发布" || unsavedArticleIds.has(articleId) || shouldBlockPublishForGeoQuality(article)) {
          skippedCount += 1;
          continue;
        }
        const readiness = evaluatePublishReadiness({
          ...publishBaseContext,
          article,
        });
        if (!readiness.ready) {
          skippedCount += 1;
          continue;
        }
        const resolved = getArticlePublishPlatform({
          generationBasis: article.generationBasis ?? null,
          targetPlatform: article.targetPlatform,
          publishPlatform: article.publishPlatform,
        });
        const slug =
          resolved.publishQueueSlug && resolved.supportedByLocalAgent && !resolved.queueBlockedReason
            ? resolved.publishQueueSlug
            : null;
        if (!slug || !isBindingPublishPlatform(slug)) {
          skippedCount += 1;
          continue;
        }
        const picked = pickPublishAccountFresh(slug);
        if (!picked) {
          skippedCount += 1;
          continue;
        }
        const preCheck = evaluatePrePublishChecklist({
          title: article.title ?? "",
          markdownContent: article.markdownContent ?? "",
          coverBase64: article.coverBase64,
          coverImageUrl: article.coverImageUrl,
          platform: slug,
          article,
          account: { ...picked, platform: slug },
          localAgentAccountValid: localAgentAccountSnapshot.some(
            e => e.platform === slug && e.loginStatus === "valid",
          ),
        });
        if (!preCheck.allPassed) {
          skippedCount += 1;
          continue;
        }
        try {
          const res = await createPublishTask.mutateAsync({
            articleId,
            platform: slug,
            projectId: selectedProjectId,
            platformAccountId: picked.id,
          });
          if (res.publishMode !== "local_agent") {
            skippedCount += 1;
            continue;
          }
          successCount += 1;
          if (isContentReviewPending(article.contentReviewStatus)) {
            pendingReviewEnqueuedCount += 1;
          }
          const existing = taskIdsByArticle.get(articleId) ?? [];
          existing.push(res.taskId);
          taskIdsByArticle.set(articleId, existing);
        } catch {
          skippedCount += 1;
        }
      }

      if (successCount > 0) {
        toast.success(`已将 ${successCount} 篇内容加入发布队列`);
        if (pendingReviewEnqueuedCount > 0) {
          toast.message(
            `${pendingReviewEnqueuedCount} 篇尚未标记为「已审核可发布」，${CONTENT_REVIEW_PENDING_ENQUEUE_HINT}`,
          );
        }
        notifyPublishEffectPrediction();
        setSelectedCardIds(new Set());
        for (const [articleId, taskIds] of Array.from(taskIdsByArticle.entries())) {
          void pollPublishTasksUntilDone(articleId, taskIds);
        }
      } else {
        toast.error("所选内容均未能加入发布队列，请检查发布就绪状态与账号绑定");
      }
      if (skippedCount > 0 && successCount > 0) {
        toast.message(`${skippedCount} 篇未满足发布条件，已跳过`);
      }
    } finally {
      setBatchEnqueueBusy(false);
    }
  };

  if (!enabled && !projectsLoading) {
    return (
      <div data-testid="weekly-platform-content-page">
        <ProjectContextEmptyState />
      </div>
    );
  }

  const effectivePublishResolved = useMemo(() => {
    if (!publishArticle) return publishPlatformResolved;
    const requested =
      manualPublishPlatform && isBindingPublishPlatform(manualPublishPlatform)
        ? manualPublishPlatform
        : null;
    return resolveEffectiveArticlePublishPlatform(
      {
        generationBasis: publishArticle.generationBasis ?? null,
        targetPlatform: publishArticle.targetPlatform,
        publishPlatform: publishArticle.publishPlatform,
      },
      requested,
    );
  }, [publishArticle, publishPlatformResolved, manualPublishPlatform]);

  const publishDialogSlug = useMemo(() => {
    const resolved = effectivePublishResolved ?? activePublishReadiness?.resolvedPlatform ?? null;
    if (
      resolved?.publishQueueSlug &&
      resolved.supportedByLocalAgent &&
      !resolved.queueBlockedReason
    ) {
      return resolved.publishQueueSlug;
    }
    if (manualPublishPlatform && isBindingPublishPlatform(manualPublishPlatform)) {
      return manualPublishPlatform;
    }
    return null;
  }, [effectivePublishResolved, activePublishReadiness?.resolvedPlatform, manualPublishPlatform]);

  const publishDialogNicknamePendingHint = useMemo(() => {
    if (!publishDialogSlug) return false;
    const localEntry = publishDialogAccountSnapshot.find(
      e => e.platform === publishDialogSlug && e.loginStatus === "valid",
    );
    if (localEntry && !localEntry.displayNameVerified) return true;
    const rows = getPublishReadyAccountsForPlatform(publishDialogSlug);
    return rows.some(a => a.accountName === LOCAL_AGENT_ACCOUNT_SYNC_PENDING_DISPLAY_NAME);
  }, [publishDialogAccountSnapshot, publishDialogSlug, getPublishReadyAccountsForPlatform]);

  const activePrePublishChecklist = useMemo(() => {
    if (!publishArticle || !publishDialogSlug || !isBindingPublishPlatform(publishDialogSlug)) {
      return null;
    }
    const account = pickSelectedPublishAccount(publishDialogSlug);
    const localAgentAccountValid = publishDialogAccountSnapshot.some(
      e => e.platform === publishDialogSlug && e.loginStatus === "valid",
    );
    return evaluatePrePublishChecklist({
      title: publishArticle.title ?? "",
      markdownContent: publishArticle.markdownContent ?? "",
      coverBase64: publishArticle.coverBase64,
      coverImageUrl: publishArticle.coverImageUrl,
      platform: publishDialogSlug,
      article: publishArticle,
      account: account ? { ...account, platform: publishDialogSlug } : null,
      localAgentAccountValid,
    });
  }, [
    publishArticle,
    publishDialogSlug,
    pickSelectedPublishAccount,
    publishDialogAccountSnapshot,
  ]);

  useEffect(() => {
    if (!publishDialogOpen) {
      publishDialogPlatformsInitRef.current = false;
      return;
    }
    if (!publishDialogPlatformsInitRef.current && publishDialogSlug) {
      publishDialogPlatformsInitRef.current = true;
      setSelectedPlatforms(new Set([publishDialogSlug]));
    }
  }, [publishDialogOpen, publishDialogSlug]);

  useEffect(() => {
    if (!publishDialogOpen || !publishDialogSlug || !selectedProjectId) return;
    const selectable = getEnqueueSelectableAccountsForPlatform(publishDialogSlug);
    if (selectable.length === 0) return;
    setSelectedPublishAccountIds(prev => {
      if (prev[publishDialogSlug]) return prev;
      const stored = readLastEnqueuePublishAccountId(selectedProjectId, publishDialogSlug);
      if (stored && selectable.some(a => a.id === stored)) {
        return { ...prev, [publishDialogSlug]: stored };
      }
      const ready = selectable.filter(isPublishReadyAccount);
      if (ready.length === 1) return { ...prev, [publishDialogSlug]: ready[0]!.id };
      return prev;
    });
  }, [
    publishDialogOpen,
    publishDialogSlug,
    selectedProjectId,
    getEnqueueSelectableAccountsForPlatform,
    platformAccountGroups,
  ]);

  return (
    <div className="space-y-8 pb-12" data-testid="weekly-platform-content-page">
      {contentLimitReached ? (
        <SubscriptionUpgradePrompt
          message={SUBSCRIPTION_LIMIT_CONTENT_MESSAGE}
          testId="weekly-content-article-limit"
        />
      ) : null}
      <header className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">平台化内容资产（GEO 内容任务工作台）</h1>
          <p className="text-sm text-gray-500">
            根据 AI 实测缺口，按平台生成可发布、可监测、可复测的 GEO 内容资产。各平台独立生成，不支持一稿多发。
          </p>
        </div>
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <label className="sr-only" htmlFor="weekly-content-title-search">
            按标题搜索内容
          </label>
          <Input
            id="weekly-content-title-search"
            type="search"
            placeholder="按标题搜索内容…"
            value={titleSearch}
            onChange={e => setTitleSearch(e.target.value)}
            className="rounded-xl border-gray-200 bg-white pl-10 shadow-sm"
            data-testid="weekly-content-title-search"
          />
        </div>
      </header>

      <PublishSuccessNotificationCard
        visible={Boolean(publishSuccessNotice)}
        platformLabel={publishSuccessNotice?.platformLabel ?? ""}
        articleUrl={publishSuccessNotice?.articleUrl}
        onDismiss={() => setPublishSuccessNotice(null)}
      />

      {tasksQuery.isError || topicsQuery.isError || articlesQuery.isError ? (
        <p className="text-sm text-red-700">暂时无法加载，请刷新重试</p>
      ) : !queriesReady || preparingTopics || generateTopicsMutation.isPending ? (
        <div className="flex flex-col items-center gap-3 py-16 text-gray-500">
          <Spinner className="size-6 text-blue-600" />
          <p className="text-sm">正在加载平台化内容生产数据…</p>
        </div>
      ) : showDiagnosisEmpty ? (
        <P0Card testId="weekly-no-diagnosis">
          <p className="text-sm leading-relaxed text-gray-700" data-testid="weekly-no-diagnosis-message">
            {GEO_CONTENT_TASK_NO_DIAGNOSIS_MESSAGE}
          </p>
          <Button
            type="button"
            className="mt-4 bg-blue-600 text-white hover:bg-blue-700"
            data-testid="weekly-go-ai-diagnosis"
            onClick={() => selectedProjectId && setLocation(buildProjectUrl("/ai-diagnosis", selectedProjectId))}
          >
            去 AI 实测诊断
          </Button>
        </P0Card>
      ) : (
        <>
          {geoContentTaskSource ? (
            <GeoContentTaskPanels
              source={geoContentTaskSource}
              taskOptions={contentTaskOptions}
              selectedTaskId={selectedContentTaskId ?? geoContentTaskSource.contentTaskId}
              onSelectTaskId={id => setSelectedContentTaskId(id)}
              platformProgress={platformProgressText}
              nextAction={contentNextAction}
            />
          ) : null}

          {platformStrategyError ? <p className="text-sm text-amber-800">{platformStrategyError}</p> : null}

          <PlatformBatchGenerationPanel
            queue={platformBatchQueue}
            running={platformBatchRunning}
            onStartBatch={() => void handleBatchGenerateAllPlatforms()}
            onRetry={handleRetryPlatformBatchItem}
          />

          {platformContentProgress.status !== "idle" && activePlatformProgressLabel ? (
            <AiTaskProgressCard
              testId="platform-content-progress"
              title={`正在生成${activePlatformProgressLabel}内容`}
              stepLabel={platformContentProgress.stepLabel}
              stepDescription={platformContentProgress.stepDescription}
              percent={platformContentProgress.percent}
              elapsedSec={platformContentProgress.elapsedSec}
              hint90s={PLATFORM_CONTENT_PROGRESS_HINT_90S}
              status={
                platformContentProgress.isFailed
                  ? "failed"
                  : platformContentProgress.isSuccess
                    ? "success"
                    : "running"
              }
              errorCategory={platformProgressErrorCategory}
              errorMessage={
                platformContentProgress.isFailed
                  ? platformProgressFailureDisplay.message
                  : platformProgressErrorMessage
              }
              onRegenerate={
                canRegeneratePlatformContent ? () => handlePlatformRegenerate() : undefined
              }
              regenerateDisabled={anyGenerating}
            />
          ) : null}

          <PlatformContentBoard
            rows={platformBoardRows}
            boardBusy={batchBusy}
            generatingPlatformKey={generatingPlatformKey}
            onGenerate={key => void handlePlatformGenerate(key)}
            onView={handlePlatformView}
          />

          {showDirectionEmpty ? (
            <P0Card>
              <p className="text-sm text-gray-700">正在根据 AI 诊断准备内容方向，请稍候…</p>
            </P0Card>
          ) : null}

          {contentCardModels.length > 0 ? (
            <section className="space-y-4" data-testid="weekly-content-cards">
              <div className="flex flex-col gap-3">
                <div>
                  <h2 className={geoP0Surfaces.sectionTitle}>已生成内容</h2>
                  <p className={geoP0Surfaces.muted}>按平台独立管理；无真实质检分时不展示评分。</p>
                  {averageQualityScore != null ? (
                    <p className="mt-1 text-sm text-gray-700" data-testid="weekly-content-avg-quality">
                      平均质检分：
                      <span className="ml-1 font-semibold tabular-nums text-gray-900">{averageQualityScore}</span>
                      <span className="ml-1 text-gray-500">分（共 {contentCardModels.filter(c => c.qualityScore != null).length} 篇已评分）</span>
                    </p>
                  ) : null}
                </div>
                <div
                  className="flex gap-2 overflow-x-auto pb-1"
                  data-testid="weekly-filter-platform"
                  role="tablist"
                  aria-label="按平台筛选"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filterPlatform === "all"}
                    data-testid="weekly-filter-platform-all"
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 text-sm transition",
                      filterPlatform === "all"
                        ? "border-blue-400 bg-blue-50 font-medium text-blue-800"
                        : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50",
                    )}
                    onClick={() => setFilterPlatform("all")}
                  >
                    全部
                  </button>
                  {WEEKLY_PLATFORM_DEFS.map(def => (
                    <button
                      key={def.key}
                      type="button"
                      role="tab"
                      aria-selected={filterPlatform === def.key}
                      data-testid={`weekly-filter-platform-${def.key}`}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-1.5 text-sm transition",
                        filterPlatform === def.key
                          ? "border-blue-400 bg-blue-50 font-medium text-blue-800"
                          : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50",
                      )}
                      onClick={() => setFilterPlatform(def.key)}
                    >
                      {def.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2" data-testid="weekly-content-filters">
                  <label className="sr-only" htmlFor="weekly-filter-status">
                    按状态筛选
                  </label>
                  <select
                    id="weekly-filter-status"
                    className={aiInput}
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value as ContentCardStatusFilter)}
                    data-testid="weekly-filter-status"
                  >
                    <option value="all">全部状态</option>
                    <option value="publishable">可发布</option>
                    <option value="draft">草稿</option>
                    <option value="published">已发布</option>
                  </select>
                  <label className="sr-only" htmlFor="weekly-sort-quality">
                    按质检分排序
                  </label>
                  <select
                    id="weekly-sort-quality"
                    className={aiInput}
                    value={sortQuality}
                    onChange={e => setSortQuality(e.target.value as ContentCardQualitySort)}
                    data-testid="weekly-sort-quality"
                  >
                    <option value="none">默认顺序</option>
                    <option value="desc">质检分从高到低</option>
                    <option value="asc">质检分从低到高</option>
                  </select>
                  <label className="sr-only" htmlFor="weekly-filter-content-tag">
                    按内容标签筛选
                  </label>
                  <select
                    id="weekly-filter-content-tag"
                    className={aiInput}
                    value={filterContentTag}
                    onChange={e => setFilterContentTag(e.target.value)}
                    data-testid="weekly-filter-content-tag"
                  >
                    <option value="all">全部标签</option>
                    {contentTagStats.map(row => (
                      <option key={row.tag} value={row.tag}>
                        {row.tag}（{row.count}）
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {contentTagStats.length > 0 ? (
                <div
                  className="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700"
                  data-testid="weekly-content-tag-stats"
                >
                  <span className="font-medium text-gray-900">标签统计：</span>
                  {contentTagStats.map(row => (
                    <button
                      key={row.tag}
                      type="button"
                      className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                        filterContentTag === row.tag
                          ? "border-violet-600 bg-violet-600 text-white"
                          : "border-gray-300 bg-white hover:border-violet-400"
                      }`}
                      onClick={() =>
                        setFilterContentTag(prev => (prev === row.tag ? "all" : row.tag))
                      }
                    >
                      {row.tag} · {row.count}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={geoP0Brand.primaryOutline}
                  data-testid="weekly-select-visible-cards"
                  onClick={() => toggleSelectVisibleCards(true)}
                >
                  全选当前列表
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={geoP0Brand.primaryOutline}
                  onClick={() => setSelectedCardIds(new Set())}
                >
                  取消选择
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className={geoP0Brand.primary}
                  disabled={batchEnqueueBusy || anyGenerating || selectedCardIds.size === 0}
                  data-testid="weekly-batch-enqueue-publish"
                  onClick={() => void handleBatchEnqueuePublish()}
                >
                  {batchEnqueueBusy ? "提交中…" : `批量加入发布队列（${selectedCardIds.size}）`}
                </Button>
              </div>
              {displayContentCards.length === 0 ? (
                <p className="text-sm text-gray-500" data-testid="weekly-content-cards-empty">
                  {titleSearch.trim() || filterContentTag !== "all"
                    ? "未找到匹配内容"
                    : "当前筛选条件下暂无内容"}
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {displayContentCards.map(model => {
                    const article = articles.find(a => a.id === model.id);
                    const topicId = article?.topicId;
                    return (
                      <WeeklyPlatformArticleCard
                        key={model.id}
                        model={model}
                        disabled={anyGenerating || batchEnqueueBusy}
                        selectable
                        selected={selectedCardIds.has(model.id)}
                        onSelectedChange={(checked: boolean) => toggleCardSelection(model.id, checked)}
                        onView={() => article && openEditor(article)}
                        onRegenerate={() => {
                          if (typeof topicId === "number") void generateOne(topicId);
                        }}
                        onEnqueuePublish={() => article && openPublishDialog(article)}
                        onContentReviewStatusChange={status => {
                          if (!selectedProjectId) return;
                          setContentReviewStatus.mutate({
                            projectId: selectedProjectId,
                            articleId: model.id,
                            status,
                          });
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}

          <details className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-gray-800">
              内容策略细项（可选，按单平台调整）
            </summary>
            <div className="space-y-4 border-t border-gray-100 p-4">
              <PlatformContentStrategyPanel
                value={platformStrategy}
                onChange={setPlatformStrategy}
                targetQuestionOptions={targetQuestionOptions}
                disabled={anyGenerating}
              />
              <QuestionTemplatePicker
                platform={platformStrategy.targetPublishPlatform}
                value={selectedQuestionTemplateId}
                onChange={setSelectedQuestionTemplateId}
                disabled={anyGenerating}
                projectId={selectedProjectId}
              />
            </div>
          </details>
        </>
      )}

      {enabled ? (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm" data-testid="local-agent-publish-hint">
          <p className="font-medium text-gray-800">本地发布客户端</p>
          <p className="mt-1 text-xs text-gray-500">
            发布任务将发送至本机 GEO 本地发布客户端。请保持客户端运行并接收发布任务；任务状态为「等待本地客户端处理」时表示已入队。
          </p>
          {localAgentOnline === false ? (
            <p className="mt-2 text-xs text-amber-600">当前未检测到客户端在线，发布将被阻断。</p>
          ) : null}
        </div>
      ) : null}

      <section className="rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm" data-testid="weekly-advanced-config">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-gray-900">高级配置</h2>
            <p className="text-xs text-gray-500">内容模板库供策略负责人维护；普通执行可忽略该项。</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full md:w-auto"
            data-testid="weekly-open-templates-entry"
            onClick={() => setLocation(buildProjectUrl("/templates", selectedProjectId))}
          >
            打开内容模板库
          </Button>
        </div>
      </section>

      {selectedProjectId && editorArticle ? (
        <ArticleAssetEditorSheet
          open={editorOpen}
          onOpenChange={open => {
            setEditorOpen(open);
            if (!open) setEditorArticle(null);
          }}
          projectId={selectedProjectId}
          brandName={brandName}
          article={editorArticle}
          onDirtyChange={setArticleUnsaved}
          onSaved={() => {
            if (editorArticle) setArticleUnsaved(editorArticle.id, false);
            void invalidateArticles();
          }}
          onDeleted={() => {
            setEditorArticle(null);
            void invalidateArticles();
          }}
        />
      ) : null}

      <Dialog open={suggestionDialog.open} onOpenChange={open => setSuggestionDialog(s => ({ ...s, open }))}>
        <DialogContent className="border-gray-200 bg-white text-gray-900 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新版内容建议</DialogTitle>
            <DialogDescription className="text-gray-500">{suggestionDialog.articleTitle}</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
            {suggestionDialog.text}
          </pre>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSuggestionDialog(s => ({ ...s, open: false }))}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="border-gray-200 bg-white text-gray-900 sm:max-w-md" data-testid="publish-to-platform-dialog">
          <DialogHeader>
            <DialogTitle>加入发布队列</DialogTitle>
            <DialogDescription className="text-gray-500">
              {publishArticle?.title ?? "当前文章"} · 各平台内容独立，本篇不支持一稿多发
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              <p className="mt-2 text-xs text-blue-700">
                任务将发送至本地 GEO 发布客户端，由本篇对应平台账号执行填稿。
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-blue-800">
                客户端状态：
                {publishDialogAgentOnline === true ? (
                  <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    已连接
                  </span>
                ) : publishDialogAgentOnline === false ? (
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                    未连接
                  </span>
                ) : (
                  <span className="text-gray-500">检测中…</span>
                )}
              </p>
            </div>
            <PublishPrePublishChecklist checklist={activePrePublishChecklist} />
            {activePublishReadiness && !activePublishReadiness.ready ? (
              <p
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                data-testid="publish-readiness-block"
              >
                {activePublishReadiness.message}
              </p>
            ) : null}
            {activePublishReadiness?.ready &&
            publishArticle?.geoQualityRecommendation === "revise" ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                内容有优化空间，确认后可继续发布。
              </p>
            ) : null}
            {publishDialogNicknamePendingHint ? (
              <p
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900"
                data-testid="publish-dialog-nickname-pending-hint"
              >
                当前账号已登录有效，但暂未识别真实昵称。可继续发布，或点击重新检测刷新昵称。
              </p>
            ) : null}
            {publishAccountGroupWarnings.map(w => (
              <p
                key={w.slug}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
                data-testid="account-group-mismatch-hint"
              >
                <span className="font-medium">{w.platformLabel}：</span>
                {w.message}
              </p>
            ))}
          </div>
          <div className="space-y-3 py-2">
            {activePublishReadiness?.resolvedPlatform?.recognized ? (
              <div className="space-y-1">
                <p className="text-sm text-gray-700" data-testid="publish-dialog-platform-label">
                  发布平台：<span className="font-medium">{activePublishReadiness.platformLabel}</span>
                  {!getArticlePublishPlatform({
                    generationBasis: publishArticle?.generationBasis ?? null,
                    targetPlatform: publishArticle?.targetPlatform,
                    publishPlatform: publishArticle?.publishPlatform,
                  }).recognized && manualPublishPlatform ? (
                    <span className="ml-1 text-xs text-amber-700">（手动指定）</span>
                  ) : null}
                </p>
                {publishDialogSlug ? (
                  <p
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700"
                    data-testid="publish-time-suggest"
                  >
                    <span className="font-medium text-gray-900">建议发布时间：</span>
                    {getPublishTimeSuggest(publishDialogSlug)}
                  </p>
                ) : null}
                {publishDialogSlug && isBindingPublishPlatform(publishDialogSlug) ? (
                  (() => {
                    const selectable = getEnqueueSelectableAccountsForPlatform(publishDialogSlug);
                    const picked = pickSelectedPublishAccount(publishDialogSlug);
                    const localEntry = publishDialogAccountSnapshot.find(
                      e => e.platform === publishDialogSlug && e.loginStatus === "valid",
                    );
                    if (selectable.length === 0 && !localEntry) return null;
                    const accountNameLabel =
                      picked?.accountName ??
                      selectable[0]?.accountName ??
                      (localEntry?.displayNameVerified && localEntry.displayName
                        ? localEntry.displayName
                        : LOCAL_AGENT_ACCOUNT_SYNC_PENDING_DISPLAY_NAME);
                    const statusLabel = picked
                      ? publishEnqueueLoginStatusLabel(picked.sessionStatus)
                      : selectable[0]
                        ? publishEnqueueLoginStatusLabel(selectable[0].sessionStatus)
                        : "有效";
                    return (
                      <p className="text-xs text-gray-600" data-testid="publish-dialog-account-status">
                        账号名称：{accountNameLabel}
                        <span className="ml-2">登录状态：{statusLabel}</span>
                      </p>
                    );
                  })()
                ) : null}
              </div>
            ) : (
              <div className="space-y-2" data-testid="publish-dialog-platform-unknown">
                <p className="text-sm text-amber-800">
                  本篇为历史内容或未写入发布平台，无法自动识别。请手动选择发布平台后继续：
                </p>
                <label className="block text-xs font-medium text-gray-600" htmlFor="manual-publish-platform">
                  手动指定发布平台
                </label>
                <select
                  id="manual-publish-platform"
                  className={aiInput}
                  value={manualPublishPlatform}
                  onChange={e => setManualPublishPlatform(e.target.value as BindingPublishPlatform | "")}
                  data-testid="manual-publish-platform-select"
                >
                  <option value="">请选择</option>
                  {PUBLISH_QUEUE_PLATFORMS.map(p => (
                    <option key={p.slug} value={p.slug}>
                      {p.label}
                    </option>
                  ))}
                  <option value="" disabled>
                    — 以下平台请人工发布 —
                  </option>
                  <option value="xiaohongshu" disabled>
                    小红书（本地客户端暂不支持自动发布）
                  </option>
                  <option value="wechat" disabled>
                    公众号（请使用资产发布记录人工登记）
                  </option>
                </select>
              </div>
            )}
            <div
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"
              data-testid="publish-effect-prediction"
            >
              <p className="font-medium text-emerald-950">发布后效果预期</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-emerald-900">
                {PUBLISH_EFFECT_PREDICTION_LINES.map(line => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            {publishDialogSlug ? (
              PUBLISH_QUEUE_PLATFORMS.filter(p => p.slug === publishDialogSlug).map(p => {
              const selectableAccounts = isBindingPublishPlatform(p.slug)
                ? getEnqueueSelectableAccountsForPlatform(p.slug)
                : [];
              const readyAccounts = isBindingPublishPlatform(p.slug) ? getPublishReadyAccountsForPlatform(p.slug) : [];
              const legacyAccounts = isBindingPublishPlatform(p.slug)
                ? selectableAccounts.filter(a => !a.localProfileId?.trim() || !a.localAgentId?.trim())
                : [];
              const selected = isBindingPublishPlatform(p.slug) ? pickSelectedPublishAccount(p.slug) : null;
              const needsPick = selectableAccounts.length > 1 && !selectedPublishAccountIds[p.slug];
              const sessionExpired =
                selected != null &&
                isBindingPublishPlatform(p.slug) &&
                selected.sessionStatus === "expired";
              const renderAccountSummary = (a: PlatformAccountItem) =>
                formatPublishEnqueueAccountOptionLabel({
                  accountName: a.accountName,
                  sessionStatus: a.sessionStatus,
                  lastLoginAt: a.lastLoginAt ?? null,
                });
              return (
                <div key={p.slug} className="flex flex-col gap-2 rounded-lg border border-gray-200 px-3 py-2">
                  <span className="text-sm font-medium">{p.label}</span>
                  {isBindingPublishPlatform(p.slug) ? (
                    <div className="space-y-2">
                      {selectableAccounts.length === 0 ? (
                        <span className="text-xs text-amber-600">无可发布账号（需绑定本地环境且登录有效）</span>
                      ) : selectableAccounts.length === 1 ? (
                        <span className="text-xs text-gray-600" data-testid="publish-dialog-single-account">
                          发布账号：{renderAccountSummary(selectableAccounts[0]!)}
                        </span>
                      ) : (
                        <>
                          <span className="text-xs text-gray-500">选择发布账号（必选）</span>
                          <select
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                            value={selectedPublishAccountIds[p.slug] ?? ""}
                            onChange={e => {
                              const accountId = Number(e.target.value);
                              if (!accountId) return;
                              rememberEnqueuePublishAccount(p.slug, accountId);
                            }}
                            onClick={e => e.stopPropagation()}
                            data-testid="publish-dialog-account-select"
                          >
                            <option value="">请选择账号</option>
                            {selectableAccounts.map(a => (
                              <option key={a.id} value={a.id}>
                                {renderAccountSummary(a)}
                              </option>
                            ))}
                          </select>
                          {selected ? (
                            <span className="text-xs text-gray-600">
                              已选：{renderAccountSummary(selected)}
                            </span>
                          ) : null}
                        </>
                      )}
                      {sessionExpired ? (
                        <div
                          className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                          data-testid="publish-enqueue-session-expired"
                        >
                          <p className="text-xs text-amber-900">{PUBLISH_ENQUEUE_SESSION_EXPIRED_HINT}</p>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-amber-500 text-amber-800"
                            data-testid="publish-enqueue-relogin"
                            onClick={() => {
                              void focusLocalAgentAccountsTab()
                                .then(r => {
                                  if (r.ok) toast.success("已切换到本地客户端「账号环境」");
                                  else toast.error(toUserFacingError(r.message, "请手动打开本地客户端"));
                                })
                                .catch(() => toast.message("请在本机打开 GEO 本地发布客户端"));
                            }}
                          >
                            {PUBLISH_ENQUEUE_RELOGIN_ACTION_LABEL}
                          </Button>
                        </div>
                      ) : null}
                      {legacyAccounts.length > 0 ? (
                        <p className="text-xs text-amber-600">
                          {legacyAccounts.length} 个账号需在企业档案重新绑定本地客户端后方可发布。
                        </p>
                      ) : null}
                      {needsPick ? (
                        <span className="text-xs text-red-600">该平台有多个账号，请选择后再发布</span>
                      ) : null}
                      {selected && !isPublishReadyAccount(selected) && !sessionExpired ? (
                        <span className="text-xs text-amber-600">
                          当前账号尚未就绪，请完成本地绑定并检测登录态后再发布。
                        </span>
                      ) : null}
                      {readyAccounts.length === 0 && selectableAccounts.length > 0 && !sessionExpired ? (
                        <span className="text-xs text-amber-600">暂无可直接发布的账号，请检查登录状态与本地绑定。</span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="pl-7 text-xs text-gray-500">无需绑定平台账号</span>
                  )}
                </div>
              );
            })
            ) : null}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {activePublishReadiness?.blockingCode === "PLATFORM_ACCOUNT_UNBOUND" ? (
              <Button
                type="button"
                variant="outline"
                className="w-full border-amber-500 text-amber-700"
                data-testid="publish-readiness-open-accounts"
                onClick={() => {
                  void focusLocalAgentAccountsTab()
                    .then(r => {
                      if (r.ok) toast.success("已切换到本地客户端「账号环境」");
                      else toast.error(toUserFacingError(r.message, "请手动打开本地客户端"));
                    })
                    .catch(() => toast.message("请在本机打开 GEO 本地发布客户端"));
                }}
              >
                {activePublishReadiness.nextActionLabel}
              </Button>
            ) : null}
            {activePublishReadiness?.blockingCode === "ACCOUNT_STATUS_NOT_SYNCED" ? (
              <Button
                type="button"
                variant="outline"
                className="w-full border-blue-500 text-blue-700"
                data-testid="publish-readiness-refresh-status"
                onClick={() => void hydratePublishDialogAgent({ syncToWeb: true })}
              >
                刷新账号状态
              </Button>
            ) : null}
            <div className="flex w-full gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setPublishDialogOpen(false)}>
                取消
              </Button>
              <Button
                type="button"
                className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                disabled={
                  createPublishTask.isPending ||
                  selectedPlatforms.size === 0 ||
                  (activePublishReadiness != null && !activePublishReadiness.ready) ||
                  (activePrePublishChecklist != null && !activePrePublishChecklist.allPassed)
                }
                onClick={() => void handleConfirmPublish()}
              >
                {createPublishTask.isPending ? "提交中..." : "确认加入队列"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
