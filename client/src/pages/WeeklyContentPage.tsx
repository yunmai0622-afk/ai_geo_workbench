import { PublishPrePublishChecklist } from "@/components/publishing/PublishPrePublishChecklist";
import {
  CurrentContentTaskCard,
  TaskProgressionFallback,
  PlatformTaskBoard,
  TaskProgressOverview,
  NextStepSuggestion,
  MonthlyContentTaskList,
  computeTaskBoardProgress,
  type MonthlyContentTaskItem,
} from "@/components/weekly/ContentTaskProgressionView";
import {
  WeeklyAdvancedInfoSections,
  buildProfilePreviewFromRecord,
} from "@/components/weekly/WeeklyAdvancedInfoSections";
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
import { encodeStoredCoverBase64, type StoredCoverMime } from "@shared/articleCoverBase64";
import { focusLocalAgentAccountsTab } from "@/lib/localAgentClient";
import { PlatformContentBoard, type PlatformBoardPrimaryActionKind, type PlatformBoardRow } from "@/components/weekly/PlatformContentBoard";
import { buildTaskBoardNextStepSuggestion } from "@shared/weeklyContentTaskBoard";
import { WeeklyContentDetailSheet } from "@/components/weekly/WeeklyContentDetailSheet";
import { WeeklyCustomerExecutionOverview } from "@/components/weekly/WeeklyCustomerExecutionOverview";
import {
  WeeklyContentReviewConfirmDialog,
  type WeeklyContentReviewDialogMode,
} from "@/components/weekly/WeeklyContentReviewConfirmDialog";
import { WeeklyLocalAgentStatusBar } from "@/components/weekly/WeeklyLocalAgentStatusBar";
import type { WeeklyArticleCardModel } from "@/components/weekly/WeeklyPlatformArticleCard";
import { resolveGeoQualityOptimizationSuggestions } from "@shared/geoQualityAutoSuggest";
import {
  buildUnifiedQualityGateArticle,
  computeAverageGeoQualityScore,
  dedupeLatestQualityScoreRows,
  resolveEffectiveGeoQualityScore,
  resolveFriendlyQualityFailHints,
  resolveQualityBlockingIssues,
  resolveQualityCardView,
} from "@shared/geoQualityScoreDisplay";
import {
  buildMonthlyContentTaskEntryUrl,
  parseWeeklyContentEntryContext,
  resolveMonthlyContentTaskQuestionId,
  resolveWeeklyContentSourceTypeLabel,
  WEEKLY_CONTENT_TASK_UNBOUND_QUESTION_MESSAGE,
  type WeeklyContentEntryContext,
} from "@shared/weeklyContentEntryContext";
import {
  buildWeeklyContentTaskNextStep,
  weeklyContentTaskStatusLabel,
  resolveWeeklyPlatformContentStatus,
  type WeeklyContentTaskProgress,
  type WeeklyContentTaskStatus,
} from "@shared/weeklyContentTaskStatus";
import { formatWeeklyArticleCustomerTitle } from "@shared/weeklyArticleCustomerTitle";
import { CUSTOMER_STAGE_LABELS, deriveClientProjectCardDisplay } from "@/lib/projectWorkspaceDisplay";
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
import { useLocalAgentConnection } from "@/hooks/useLocalAgentConnection";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { useProjectScopedQueryRows } from "@/hooks/useProjectScopedQueryRows";
import { useIsMobile } from "@/hooks/useMobile";
import { buildProjectUrl, getActiveProjectId, getSearchFromLocation } from "@/lib/activeProject";
import { publishPlatformCustomerLabel } from "@/lib/publishCenterDisplay";
import { trpc } from "@/lib/trpc";
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
import {
  evaluatePublishPreflight,
  formatPublishPreflightBlockMessage,
  inferServerHeartbeatConnected,
} from "@shared/publishPreflight";
import {
  isPublishReadyPlatformAccount,
  type PublishReadyAccountRow,
} from "@shared/publishReadiness";
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
import { formatPublishEffectPrediction } from "@shared/publishEffectPrediction";
import {
  formatPublishSuccessBody,
  formatPublishSuccessPlatformPhrase,
  PUBLISH_SUCCESS_NEXT_STEP,
  PUBLISH_SUCCESS_NOTIFICATION_TITLE,
  resolvePublishSuccessArticleUrl,
} from "@shared/publishSuccessNotification";
import {
  formatPublishEnqueueAccountOptionLabel,
  PUBLISH_ENQUEUE_RELOGIN_ACTION_LABEL,
  PUBLISH_ENQUEUE_SESSION_EXPIRED_HINT,
  readLastEnqueuePublishAccountId,
  writeLastEnqueuePublishAccountId,
} from "@shared/publishEnqueueAccountSelect";
import {
  ACCOUNT_GROUP_MISMATCH_HINT,
  accountGroupsMismatch,
  formatArticleStrategySummary,
  getAccountGroupLabel,
  getPublishIdentityLabel,
  isAccountGroupType,
} from "@shared/contentStrategy";
import {
  isContentReviewPending,
  normalizeContentReviewStatus,
} from "@shared/contentReviewStatus";
import {
  mapReviewEnqueueCustomerMessage,
  REVIEW_ENQUEUE_SUCCESS_MESSAGE,
} from "@shared/reviewEnqueueErrors";
import { publishTaskStatusCustomerLabel } from "@shared/publishTaskErrors";
import { stripInternalArticleMetadataFromMarkdown } from "@shared/stripInternalArticleMetadata";
import { resolveArticleLifecycleView } from "@shared/articleLifecycle";
import {
  pickLaggingContentAssetLifecycleStage,
  resolveContentAssetLifecycleStage,
} from "@shared/contentAssetLifecycle";
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
import { FileText, Search } from "lucide-react";

function resolvePlatformBoardPrimaryActionKind(status: WeeklyContentTaskStatus, hasContent: boolean): PlatformBoardPrimaryActionKind {
  if (!hasContent || status === "UNGENERATED" || status === "GENERATING") return "generate_platform_draft";
  if (status === "PUBLISH_READY") return "enqueue_publish";
  return "save_and_qc";
}

import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { toastErrorDeduped } from "@/lib/dedupedToast";
import { TRPCClientError } from "@trpc/client";
import {
  toPlatformContentGenerationError,
  PLATFORM_CONTENT_NO_PLATFORM_TASK_MESSAGE,
  PLATFORM_CONTENT_PROJECT_ACCESS_MESSAGE,
} from "@shared/platformContentGenerationErrors";
import {
  isPlatformDraftInFlight,
  PLATFORM_DRAFT_GENERATION_FAILED_MESSAGE,
  PLATFORM_DRAFT_GENERATION_TIMEOUT_CUSTOMER_MESSAGE,
  PLATFORM_DRAFT_START_MESSAGE,
  readPlatformDraftGeneration,
} from "@shared/platformDraftGeneration";
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
  GEO_CONTENT_TASK_EMPTY_FOR_PROJECT_MESSAGE,
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
  isContentTaskIdInProjectTaskList,
  PROJECT_SCOPED_CONTENT_TASK_STALE_CLIENT_MESSAGE,
} from "@shared/geoProjectScopedContentTask";
import {
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
  thirdPartyMaterials?: Record<string, string> | null;
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

function articleMatchesQuestionId(article: ArticleRow, questionId: number): boolean {
  const basis = article.generationBasis ?? {};
  const sourceQuestionId = basis.sourceQuestionId;
  if (typeof sourceQuestionId === "number" && sourceQuestionId === questionId) return true;
  if (typeof sourceQuestionId === "string" && sourceQuestionId === String(questionId)) return true;
  return false;
}

function resolveArticleLifecycleForBoard(input: {
  article?: ArticleRow | null;
  publishRecord?: {
    publishUrl?: string | null;
    publishStatus?: string | null;
    publishedAt?: Date | string | null;
  } | null;
  inclusionRecord?: {
    effectInclusionStatus?: string | null;
    inclusionVerifiedAt?: Date | string | null;
    readCount?: number | null;
    impressionCount?: number | null;
    lastAiTestedAt?: Date | string | null;
    aiTestResults?: unknown[] | null;
  } | null;
  publishTask?: { status?: string | null } | null;
  generating?: boolean;
}) {
  return resolveContentAssetLifecycleStage({
    article: input.article ?? undefined,
    publishRecord: input.publishRecord ?? undefined,
    inclusionRecord: input.inclusionRecord ?? undefined,
    publishTask: input.publishTask ?? undefined,
    generating: input.generating,
  });
}

type QualityScoreRow = {
  articleId?: number;
  totalScore: number;
  blocked?: number | boolean | null;
  blockReasons?: string[] | null;
};

function resolveArticleLinkedQuestionText(
  article: ArticleRow | null | undefined,
  questions: Array<{ id?: number; questionText?: string | null }>,
): string | null {
  if (!article) return null;
  const basis = article.generationBasis ?? {};
  const entryText =
    typeof basis.entryQuestionText === "string" ? basis.entryQuestionText.trim() : "";
  if (entryText) return entryText;
  const sourceQuestionId =
    typeof basis.sourceQuestionId === "number" ? basis.sourceQuestionId : null;
  if (sourceQuestionId != null) {
    const matched = questions.find(q => q.id === sourceQuestionId);
    const text = matched?.questionText?.trim();
    if (text) return text;
  }
  const customerQuestion =
    typeof basis.customerQuestion === "string" ? basis.customerQuestion.trim() : "";
  if (customerQuestion) return customerQuestion;
  return null;
}

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

function buildArticlePublishPreflightInput(
  projectId: number,
  article: ArticleRow,
  ctx: {
    projectAccessible: boolean;
    enterpriseProfileReady: boolean;
    enterpriseProfile: Record<string, unknown> | null | undefined;
    diagnosisReady: boolean;
    platformAccounts: PublishReadyAccountRow[];
    localAgentStatus: {
      serverHeartbeatConnected: boolean;
      browserLocalAgentConnected: boolean | null;
      localAgentAccountSnapshot: LocalAgentAccountStatusEntry[];
    };
    requestedPlatform?: BindingPublishPlatform | null;
    selectedAccount?: PublishReadyAccountRow | null;
    selectedAccountId?: number | null;
  },
) {
  return {
    projectId,
    article: { ...article, projectId },
    projectAccessible: ctx.projectAccessible,
    enterpriseProfileReady: ctx.enterpriseProfileReady,
    enterpriseProfile: ctx.enterpriseProfile ?? null,
    diagnosisReady: ctx.diagnosisReady,
    platformAccounts: ctx.platformAccounts,
    requestedPlatform: ctx.requestedPlatform ?? null,
    selectedAccount: ctx.selectedAccount ?? null,
    selectedAccountId: ctx.selectedAccountId ?? undefined,
    localAgentStatus: ctx.localAgentStatus,
  };
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
  const searchString = useSearch();
  const isMobile = useIsMobile();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailModel, setDetailModel] = useState<WeeklyArticleCardModel | null>(null);
  const [detailStatus, setDetailStatus] = useState<WeeklyContentTaskStatus | null>(null);
  const [reviewConfirmDialog, setReviewConfirmDialog] = useState<{
    open: boolean;
    article: ArticleRow | null;
    confirmed: boolean;
    mode: WeeklyContentReviewDialogMode;
  }>({ open: false, article: null, confirmed: false, mode: "review_and_enqueue" });
  const [reviewConfirmBusy, setReviewConfirmBusy] = useState(false);
  const [generatedSectionOpen, setGeneratedSectionOpen] = useState(false);
  const utils = trpc.useUtils();
  const { selectedProjectId, selectedProject, projectInput, enabled, projectsLoading, projects } =
    useProjectSelection();
  const accessibleProjectIds = useMemo(() => projects.map(p => p.id), [projects]);
  const subscriptionUsageQuery = trpc.geo.subscription.usage.useQuery();
  const contentLimitReached = subscriptionUsageQuery.data?.atLimit.contentArticle ?? false;

  const scopedListInput = { projectId: selectedProjectId! };
  const scopedListEnabled = Boolean(selectedProjectId);
  const tasksQuery = trpc.geo.tasks.list.useQuery(scopedListInput, { enabled: scopedListEnabled });
  const questionsQuery = trpc.geo.questions.list.useQuery(projectInput, { enabled });
  const analysisQuery = trpc.geo.analysis.list.useQuery(scopedListInput, { enabled: scopedListEnabled });
  const topicsQuery = trpc.geo.articles.topics.list.useQuery(scopedListInput, { enabled: scopedListEnabled });
  const articlesQuery = trpc.geo.articles.list.useQuery(scopedListInput, { enabled: scopedListEnabled });
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
  const inclusionMonitoringQuery = trpc.geo.articles.inclusionMonitoringRecords.useQuery(projectInput, {
    enabled,
  });
  const publishTasksQuery = trpc.publishTasks.listRecentByProject.useQuery(
    { projectId: selectedProjectId!, limit: 50 },
    { enabled: Boolean(selectedProjectId) },
  );

  const generateTopicsMutation = trpc.geo.articles.topics.generate.useMutation();
  const generateTasksMutation = trpc.geo.tasks.generate.useMutation();
  const generateArticleMutation = trpc.geo.articles.generate.useMutation();
  const startPlatformDraftMutation = trpc.geo.articles.startPlatformDraftGeneration.useMutation();
  const createPublishTask = trpc.publishTasks.create.useMutation();
  const reviewAndEnqueueArticle = trpc.publishTasks.reviewAndEnqueueArticle.useMutation();
  const syncLocalAgentSnapshot = trpc.geo.platformAccounts.syncLocalAgentSnapshot.useMutation();
  const updateGeneratedArticle = trpc.geo.articles.updateGeneratedArticle.useMutation();
  const setContentReviewStatus = trpc.geo.articles.setContentReviewStatus.useMutation({
    onSuccess: async () => {
      await invalidateArticles();
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
  const [entryContext, setEntryContext] = useState<WeeklyContentEntryContext>({});
  const entryContextRef = useRef<WeeklyContentEntryContext>({});
  const entryAutoGenerateHandledRef = useRef(false);
  const activeDraftPollsRef = useRef(new Set<number>());
  const recoveryPollsStartedRef = useRef(new Set<number>());
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
    const parsed = parseWeeklyContentEntryContext(searchString);
    setEntryContext(parsed);
    entryContextRef.current = parsed;
    entryAutoGenerateHandledRef.current = false;
  }, [searchString]);

  useEffect(() => {
    if (entryContext.taskId != null) {
      setSelectedContentTaskId(entryContext.taskId);
    }
    if (entryContext.questionText?.trim()) {
      const q = entryContext.questionText.trim();
      setPlatformStrategy(prev => (prev.targetQuestion.trim() === q ? prev : { ...prev, targetQuestion: q }));
    }
    if (entryContext.platform) {
      const key = normalizeWeeklyPlatformKey(entryContext.platform);
      setFilterPlatform(key);
    }
    if (entryContext.articleId != null) {
      setGeneratedSectionOpen(true);
    }
  }, [
    entryContext.taskId,
    entryContext.questionText,
    entryContext.platform,
    entryContext.articleId,
  ]);

  const contentTaskViewQuery = trpc.geo.contentTasks.getCurrentTaskView.useQuery(
    {
      projectId: selectedProjectId!,
      questionId: entryContext.questionId!,
    },
    { enabled: Boolean(selectedProjectId) && entryContext.questionId != null },
  );

  const monthlyPlanQuery = trpc.geo.monthlyPlan.getCurrent.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) && entryContext.questionId == null },
  );

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
      toast.message("AI 现状检测内容缺口建议", {
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

  const brandName = selectedProject?.enterpriseName ?? "海豚知道";
  const projectName = selectedProject?.enterpriseName ?? "当前企业";
  const isContentProductionWorkbench = useMemo(
    () => new URLSearchParams(searchString).get("mode") === "content-production",
    [searchString],
  );
  const isCustomerExecutionView = !isContentProductionWorkbench;

  const platformAccountGroups = useMemo(
    () =>
      (platformAccountsQuery.data?.accounts ?? []) as Array<{
        platform: string;
        accounts: PlatformAccountItem[];
      }>,
    [platformAccountsQuery.data],
  );

  const boundPublishAccountCount = useMemo(() => {
    let count = 0;
    for (const group of platformAccountGroups) {
      for (const account of group.accounts ?? []) {
        if (isPublishReadyPlatformAccount({ ...account, platform: group.platform })) {
          count += 1;
        }
      }
    }
    return count;
  }, [platformAccountGroups]);

  const flattenedPlatformAccounts = useMemo(
    () => flattenPlatformAccounts(platformAccountGroups),
    [platformAccountGroups],
  );

  const {
    status: localAgentConnectionStatus,
    checkConnection,
    accountSnapshot: localAgentAccountSnapshot,
    localAgentConnectedOnline,
    localAgentOnline,
  } = useLocalAgentConnection({
    boundPublishAccountCount,
    platformAccounts: flattenedPlatformAccounts,
  });

  const applyPublishDialogAgentSnapshot = useCallback(
    (online: boolean, snapshot: LocalAgentAccountStatusEntry[]) => {
      setPublishDialogAgentOnline(online);
      setPublishDialogAccountSnapshot(snapshot);
    },
    [],
  );

  const hydratePublishDialogAgent = useCallback(
    async (options?: { syncToWeb?: boolean }) => {
      const result = await checkConnection();
      applyPublishDialogAgentSnapshot(result.online, result.accountSnapshot);
      if (
        options?.syncToWeb &&
        result.online &&
        selectedProjectId &&
        result.health &&
        result.accountSnapshot.length > 0
      ) {
        try {
          await syncLocalAgentSnapshot.mutateAsync({
            agentId: result.health.agentId,
            projectId: selectedProjectId,
            accounts: result.accountSnapshot,
          });
          await utils.geo.platformAccounts.list.invalidate({ projectId: selectedProjectId });
        } catch {
          // 同步失败不阻断弹窗；状态已由本地快照更新
        }
      }
      return result.health;
    },
    [
      applyPublishDialogAgentSnapshot,
      checkConnection,
      selectedProjectId,
      syncLocalAgentSnapshot,
      utils.geo.platformAccounts.list,
    ],
  );

  const refreshLocalAgentHealth = useCallback(
    () => hydratePublishDialogAgent({ syncToWeb: true }),
    [hydratePublishDialogAgent],
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

  const tasks = useProjectScopedQueryRows<TaskRow>(selectedProjectId, tasksQuery) as TaskRow[];
  const analyses = useProjectScopedQueryRows<AnalysisRow>(selectedProjectId, analysisQuery) as AnalysisRow[];
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

  const serverHeartbeatConnected = useMemo(
    () => inferServerHeartbeatConnected(flattenedPlatformAccounts),
    [flattenedPlatformAccounts],
  );

  const publishBaseContext = useMemo(
    () => ({
      projectAccessible: Boolean(selectedProjectId),
      enterpriseProfileReady,
      enterpriseProfile: enterpriseProfileRecord ?? null,
      diagnosisReady: hasDiagnosisData,
      platformAccounts: flattenedPlatformAccounts,
      localAgentStatus: {
        serverHeartbeatConnected,
        browserLocalAgentConnected: localAgentConnectedOnline ? true : localAgentOnline,
        localAgentAccountSnapshot,
      },
    }),
    [
      selectedProjectId,
      enterpriseProfileReady,
      enterpriseProfileRecord,
      hasDiagnosisData,
      flattenedPlatformAccounts,
      serverHeartbeatConnected,
      localAgentOnline,
      localAgentAccountSnapshot,
    ],
  );

  const publishDialogPreflightContext = useMemo(
    () => ({
      ...publishBaseContext,
      localAgentStatus: {
        serverHeartbeatConnected,
        browserLocalAgentConnected: publishDialogAgentOnline,
        localAgentAccountSnapshot: publishDialogAccountSnapshot,
      },
    }),
    [
      publishBaseContext,
      serverHeartbeatConnected,
      publishDialogAgentOnline,
      publishDialogAccountSnapshot,
    ],
  );

  const topics = useProjectScopedQueryRows<TopicRow>(selectedProjectId, topicsQuery) as TopicRow[];
  const topicsById = useMemo(() => new Map(topics.map(topic => [topic.id, topic] as const)), [topics]);
  const tasksById = useMemo(() => new Map(tasks.map(task => [task.id, task] as const)), [tasks]);
  const taskIdSet = useMemo(() => taskIdSetFromList(tasks.map(t => t.id)), [tasks]);
  const staleTopicCount = useMemo(() => countStaleTopics(topics, taskIdSet), [topics, taskIdSet]);
  const hasStaleTopics = staleTopicCount > 0;
  const articles = useProjectScopedQueryRows<ArticleRow>(selectedProjectId, articlesQuery) as ArticleRow[];
  const scores = dedupeLatestQualityScoreRows((scoresQuery.data ?? []) as QualityScoreRow[]);

  const articlesById = useMemo(() => new Map(articles.map(a => [a.id, a] as const)), [articles]);
  const scoresByArticleId = useMemo(() => new Map(scores.map(s => [s.articleId, s] as const)), [scores]);

  const evaluateArticlePublishPreflight = useCallback(
    (
      article: ArticleRow,
      ctxOverrides?: Partial<
        Parameters<typeof buildArticlePublishPreflightInput>[2]
      >,
    ) => {
      if (selectedProjectId == null) return null;
      const legacyRow = scoresByArticleId.get(article.id) ?? null;
      return evaluatePublishPreflight({
        ...buildArticlePublishPreflightInput(
          selectedProjectId,
          article,
          { ...publishBaseContext, ...ctxOverrides },
        ),
        qualityResult: buildUnifiedQualityGateArticle(article, legacyRow),
      });
    },
    [selectedProjectId, publishBaseContext, scoresByArticleId],
  );

  const articleByTopicId = useMemo(() => {
    const map = new Map<number, ArticleRow>();
    for (const a of articles) {
      if (typeof a.topicId === "number") map.set(a.topicId, a);
    }
    return map;
  }, [articles]);

  const inFlightDraftByPlatform = useMemo(() => {
    const map = new Map<WeeklyPlatformKey, { articleId: number; topicId: number }>();
    for (const article of articles) {
      const record = readPlatformDraftGeneration(article.generationBasis ?? null);
      if (!isPlatformDraftInFlight(record?.status)) continue;
      const resolved = getArticlePublishPlatform({
        generationBasis: article.generationBasis ?? null,
        targetPlatform: article.targetPlatform,
        publishPlatform: article.publishPlatform,
      });
      const platformKey =
        resolved.weeklyPlatformKey ??
        (record?.platform ? normalizeWeeklyPlatformKey(record.platform) : null);
      if (!platformKey || map.has(platformKey)) continue;
      map.set(platformKey, {
        articleId: article.id,
        topicId: typeof article.topicId === "number" ? article.topicId : 0,
      });
    }
    return map;
  }, [articles]);

  const activeInFlightPlatformKey = useMemo((): WeeklyPlatformKey | null => {
    const first = inFlightDraftByPlatform.keys().next().value;
    return first ?? null;
  }, [inFlightDraftByPlatform]);

  useEffect(() => {
    if (!activeInFlightPlatformKey) return;
    setGeneratingPlatformKey(prev => prev ?? activeInFlightPlatformKey);
  }, [activeInFlightPlatformKey]);

  const platformAnyGenerating = useMemo(
    () =>
      platformBatchRunning ||
      generatingPlatformKey != null ||
      inFlightDraftByPlatform.size > 0,
    [platformBatchRunning, generatingPlatformKey, inFlightDraftByPlatform],
  );

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
  const showProjectTasksEmpty = queriesReady && hasDiagnosisData && tasks.length === 0;
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
    if (!selectedProjectId || !tasksQuery.isFetched) return;
    if (
      selectedContentTaskId != null &&
      !isContentTaskIdInProjectTaskList(selectedContentTaskId, tasks)
    ) {
      setSelectedContentTaskId(null);
      toast.message(PROJECT_SCOPED_CONTENT_TASK_STALE_CLIENT_MESSAGE);
    }
  }, [selectedProjectId, tasksQuery.isFetched, tasks, selectedContentTaskId]);

  const resolvedContentTaskIdForGenerate = useMemo(() => {
    const candidate = selectedContentTaskId ?? geoContentTaskSource?.contentTaskId ?? null;
    if (!isContentTaskIdInProjectTaskList(candidate, tasks)) return undefined;
    return candidate ?? undefined;
  }, [selectedContentTaskId, geoContentTaskSource?.contentTaskId, tasks]);

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

  const pollPlatformDraftUntilDone = useCallback(
    async (
      projectId: number,
      articleId: number,
      options?: { onProgress?: (stage: number) => void },
    ): Promise<{
      ok: boolean;
      errorMessage?: string;
      userNotice?: string | null;
      canRetry?: boolean;
    }> => {
      if (activeDraftPollsRef.current.has(articleId)) {
        return { ok: false, errorMessage: PLATFORM_DRAFT_GENERATION_FAILED_MESSAGE };
      }
      activeDraftPollsRef.current.add(articleId);
      try {
        const pollIntervalMs = 4000;
        const maxAttempts = 50;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (attempt > 0) {
            await new Promise(resolve => window.setTimeout(resolve, pollIntervalMs));
          }
          const status = await utils.geo.articles.getPlatformDraftGenerationStatus.fetch({
            projectId,
            articleId,
          });
          options?.onProgress?.(Math.min(92, 35 + attempt * 3));
          if (status.status === "generated") {
            await invalidateArticles();
            return { ok: true, userNotice: status.qualityNotice ?? null };
          }
          if (status.status === "failed") {
            await invalidateArticles();
            return {
              ok: false,
              errorMessage: status.errorMessage ?? PLATFORM_DRAFT_GENERATION_FAILED_MESSAGE,
              canRetry: status.canRetry,
            };
          }
        }
        return {
          ok: false,
          errorMessage: PLATFORM_DRAFT_GENERATION_TIMEOUT_CUSTOMER_MESSAGE,
          canRetry: true,
        };
      } finally {
        activeDraftPollsRef.current.delete(articleId);
      }
    },
    [utils, invalidateArticles],
  );

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
        const ctx = entryContextRef.current;
        const data = await generateArticleMutation.mutateAsync({
          topicId,
          targetPublishPlatform: effectiveStrategy.targetPublishPlatform,
          contentStrategyType: effectiveStrategy.contentStrategyType,
          publishIdentity: effectiveStrategy.publishIdentity,
          recommendedAccountGroup: effectiveStrategy.recommendedAccountGroup,
          targetQuestion: effectiveStrategy.targetQuestion.trim(),
          geoEnhancementGoal: effectiveStrategy.geoEnhancementGoal,
          targetAiPlatforms: [...effectiveStrategy.targetAiPlatforms],
          contentTaskId: resolvedContentTaskIdForGenerate ?? ctx.taskId ?? undefined,
          diagnosisFinding: geoContentTaskSource?.diagnosisFinding ?? ctx.relatedGeoGap,
          geoGap: geoContentTaskSource?.geoGapSummary ?? ctx.relatedGeoGap,
          platformRule: formatPlatformRuleSummaryForGeneration(
            effectiveStrategy.targetPublishPlatform,
          ),
          questionTemplateId: selectedQuestionTemplateId ?? undefined,
          questionId: ctx.questionId ?? undefined,
          sourceType: ctx.sourceType ?? undefined,
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
    [
      generateArticleMutation,
      invalidateArticles,
      platformStrategy,
      geoContentTaskSource,
      resolvedContentTaskIdForGenerate,
      selectedQuestionTemplateId,
    ],
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
    const geoGapDefault = geoContentTaskSource?.geoGapSummary ?? latestDiagnosisGap ?? null;
    const publishTasks = publishTasksQuery.data?.tasks ?? [];
    const publishRecords = publishRecordsQuery.data ?? [];
    const inclusionRecords = inclusionMonitoringQuery.data ?? [];
    const latestPublishTaskByArticle = new Map<number, (typeof publishTasks)[number]>();
    const latestPublishRecordByArticle = new Map<number, (typeof publishRecords)[number]>();
    const latestInclusionRecordByArticle = new Map<number, (typeof inclusionRecords)[number]>();
    for (const task of publishTasks) {
      const articleId = typeof task.articleId === "number" ? task.articleId : null;
      if (!articleId) continue;
      const prev = latestPublishTaskByArticle.get(articleId);
      const taskTime = new Date(task.createdAt ?? 0).getTime();
      const prevTime = prev ? new Date(prev.createdAt ?? 0).getTime() : -1;
      if (!prev || taskTime >= prevTime) {
        latestPublishTaskByArticle.set(articleId, task);
      }
    }
    for (const record of publishRecords) {
      const articleId = typeof record.articleId === "number" ? record.articleId : null;
      if (!articleId) continue;
      const prev = latestPublishRecordByArticle.get(articleId);
      const recordTime = new Date(record.publishedAt ?? record.createdAt ?? 0).getTime();
      const prevTime = prev ? new Date(prev.publishedAt ?? prev.createdAt ?? 0).getTime() : -1;
      if (!prev || recordTime >= prevTime) {
        latestPublishRecordByArticle.set(articleId, record);
      }
    }
    for (const record of inclusionRecords) {
      const articleId = typeof record.articleId === "number" ? record.articleId : null;
      if (!articleId) continue;
      const prev = latestInclusionRecordByArticle.get(articleId);
      const recordTime = new Date(record.updatedAt ?? record.createdAt ?? 0).getTime();
      const prevTime = prev ? new Date(prev.updatedAt ?? prev.createdAt ?? 0).getTime() : -1;
      if (!prev || recordTime >= prevTime) {
        latestInclusionRecordByArticle.set(articleId, record);
      }
    }
    const resolveArticlePlatformKey = (article: ArticleRow) =>
      getArticlePublishPlatform({
        generationBasis: article.generationBasis ?? null,
        targetPlatform: article.targetPlatform,
        publishPlatform: article.publishPlatform,
      }).weeklyPlatformKey;
    const pickPreferredPlatformArticle = (
      current: ArticleRow | undefined,
      candidate: ArticleRow,
    ): ArticleRow => {
      if (!current) return candidate;
      if (current.status === "已发布" && candidate.status !== "已发布") return candidate;
      if (current.status !== "已发布" && candidate.status === "已发布") return current;
      const currentTime = new Date(current.createdAt ?? 0).getTime();
      const candidateTime = new Date(candidate.createdAt ?? 0).getTime();
      return candidateTime >= currentTime ? candidate : current;
    };
    const platformWithReadyAccount = new Set<string>();
    for (const group of platformAccountsQuery.data?.accounts ?? []) {
      const ready = (group.accounts ?? []).some(a => a.isEnabled && a.sessionStatus === "active" && a.localProfileId && a.localAgentId);
      if (ready) platformWithReadyAccount.add(group.platform);
    }

    return WEEKLY_PLATFORM_DEFS.map(def => {
      const counts: PlatformContentCounts = {
        pending: 0,
        pendingConfirm: 0,
        ready: 0,
        published: 0,
      };
      let platformArticle: ArticleRow | undefined;
      let pendingReviewCount = 0;
      let queuedCount = 0;
      let lastGeneratedAt: Date | null = null;
      let lastPublishedAt: Date | null = null;
      const countedArticleIds = new Set<number>();
      const absorbPlatformArticle = (article: ArticleRow) => {
        if (countedArticleIds.has(article.id)) return;
        countedArticleIds.add(article.id);
        platformArticle = pickPreferredPlatformArticle(platformArticle, article);
        const preflight = evaluateArticlePublishPreflight(article);
        const pass = preflight?.ready ?? false;
        if (article.status === "已发布") {
          counts.published += 1;
          const publishedAt = article.publishedAt ?? article.lastPublishRecordAt ?? article.createdAt;
          if (publishedAt) {
            const publishedDate = new Date(publishedAt);
            if (
              !Number.isNaN(publishedDate.getTime()) &&
              (!lastPublishedAt || publishedDate.getTime() > lastPublishedAt.getTime())
            ) {
              lastPublishedAt = publishedDate;
            }
          }
        } else if (pass) counts.ready += 1;
        else counts.pendingConfirm += 1;
        if (pass && isContentReviewPending(article.contentReviewStatus)) pendingReviewCount += 1;
        const articleTask = latestPublishTaskByArticle.get(article.id);
        if (
          articleTask &&
          articleTask.status !== "failed" &&
          articleTask.status !== "session_expired"
        ) {
          queuedCount += 1;
        }
        const createdAt = article.createdAt ? new Date(article.createdAt) : null;
        if (createdAt && (!lastGeneratedAt || createdAt.getTime() > lastGeneratedAt.getTime())) {
          lastGeneratedAt = createdAt;
        }
      };
      for (const topic of topics) {
        const task = typeof topic.optimizationTaskId === "number" ? tasksById.get(topic.optimizationTaskId) : undefined;
        const card = parseGeoOptimizationTaskCard(task?.executionSuggestion ?? null);
        const article = articleByTopicId.get(topic.id);
        const platformKey = article
          ? resolveArticlePlatformKey(article)
          : normalizeWeeklyPlatformKey(card?.recommendedPlatform?.[0]);
        if (platformKey !== def.key) continue;
        if (!article) {
          counts.pending += 1;
          continue;
        }
        absorbPlatformArticle(article);
      }
      for (const article of articles) {
        if (resolveArticlePlatformKey(article) !== def.key) continue;
        absorbPlatformArticle(article);
      }
      const generating = generatingPlatformKey === def.key;
      const draftRecord = platformArticle
        ? readPlatformDraftGeneration(platformArticle.generationBasis ?? null)
        : null;
      const draftInFlight = isPlatformDraftInFlight(draftRecord?.status);
      const draftFailed = draftRecord?.status === "failed";
      const platformGenerating = generating || draftInFlight;
      const published = platformArticle?.status === "已发布";
      const latestTask = platformArticle ? latestPublishTaskByArticle.get(platformArticle.id) : undefined;
      const queued = Boolean(
        latestTask && latestTask.status !== "failed" && latestTask.status !== "session_expired",
      );
      const publishReady =
        platformArticle && selectedProjectId != null
          ? (evaluateArticlePublishPreflight(platformArticle)?.ready ?? false)
          : false;
      const lifecycleView = platformArticle ? resolveArticleLifecycleView(platformArticle) : null;
      const status = resolveWeeklyPlatformContentStatus({
        hasArticle: Boolean(platformArticle) && !draftInFlight,
        generating: platformGenerating,
        published,
        queued,
        publishReady,
        article: platformArticle ?? null,
        needsRewrite: draftFailed || lifecycleView?.status === "needs_revision",
      });
      const lifecycle = resolveArticleLifecycleForBoard({
        article: platformArticle ?? null,
        publishRecord: platformArticle ? latestPublishRecordByArticle.get(platformArticle.id) ?? null : null,
        inclusionRecord: platformArticle ? latestInclusionRecordByArticle.get(platformArticle.id) ?? null : null,
        publishTask: latestTask ?? null,
        generating: platformGenerating && !platformArticle,
      });
      const generatedCount = counts.pendingConfirm + counts.ready + counts.published;
      const topicForArticle =
        platformArticle && typeof platformArticle.topicId === "number"
          ? topicsById.get(platformArticle.topicId)
          : undefined;
      const formatBoardTimeLabel = (value: Date | null) =>
        value
          ? value.toLocaleString("zh-CN", {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : null;
      const lastGeneratedAtLabel = formatBoardTimeLabel(lastGeneratedAt);
      const lastPublishedAtLabel = formatBoardTimeLabel(lastPublishedAt);
      return {
        def,
        counts,
        pendingReviewCount,
        queuedCount,
        lastGeneratedAtLabel,
        lastPublishedAtLabel,
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
        status,
        lifecycle,
        hasContent: generatedCount > 0,
        articleId: platformArticle?.id ?? null,
        platformDraftStatusLabel: lifecycle.label,
        qualityScoreLabel: platformArticle ? (() => { const article = platformArticle!; const q = scoresByArticleId.get(article.id); const view = resolveQualityCardView(buildUnifiedQualityGateArticle(article, q ?? null)); return view ? `${view.score}分 · ${view.tier.label}` : "待质检"; })() : "暂无",
        accountStatusLabel: def.publishPlatformId && platformWithReadyAccount.has(def.publishPlatformId) ? "账号可用" : "待绑定账号",
        primaryActionKind: resolvePlatformBoardPrimaryActionKind(status, generatedCount > 0),
      };
    });
  }, [
    topics,
    topicsById,
    tasksById,
    articles,
    articleByTopicId,
    geoContentTaskSource?.linkedQuestion,
    geoContentTaskSource?.sceneLabel,
    geoContentTaskSource?.geoGapSummary,
    latestDiagnosisGap,
    platformStrategy.targetQuestion,
    selectedProjectId,
    publishBaseContext,
    generatingPlatformKey,
    publishTasksQuery.data?.tasks,
    publishRecordsQuery.data,
    inclusionMonitoringQuery.data,
    platformAccountsQuery.data,
    scoresByArticleId,
  ]);

  const contentCardModels = useMemo((): WeeklyArticleCardModel[] => {
    const publishRecords = publishRecordsQuery.data ?? [];
    const publishTasks = publishTasksQuery.data?.tasks ?? [];
    const latestPublishTaskByArticle = new Map<number, (typeof publishTasks)[number]>();
    for (const task of publishTasks) {
      const articleId = typeof task.articleId === "number" ? task.articleId : null;
      if (!articleId) continue;
      const prev = latestPublishTaskByArticle.get(articleId);
      const taskTime = new Date(task.createdAt ?? 0).getTime();
      const prevTime = prev ? new Date(prev.createdAt ?? 0).getTime() : -1;
      if (!prev || taskTime >= prevTime) {
        latestPublishTaskByArticle.set(articleId, task);
      }
    }
    return articles
      .filter(a => typeof a.topicId === "number")
      .map(a => {
        const topic = typeof a.topicId === "number" ? topicsById.get(a.topicId) : undefined;
        const task =
          topic && typeof topic.optimizationTaskId === "number"
            ? tasksById.get(topic.optimizationTaskId)
            : undefined;
        const card = parseGeoOptimizationTaskCard(task?.executionSuggestion ?? null);
        const taskRecommendedPlatform = card?.recommendedPlatform?.length
          ? card.recommendedPlatform.join("、")
          : null;
        const q = scoresByArticleId.get(a.id);
        const unifiedQualityArticle = buildUnifiedQualityGateArticle(a, q ?? null);
        const preflight = evaluateArticlePublishPreflight(a);
        const pass = preflight?.ready ?? false;
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
          taskRecommendedPlatform,
          thirdPartyMaterials: a.thirdPartyMaterials ?? null,
        });
        const publishBlockHint = preflight?.ready
          ? null
          : preflight?.checks.find(c => c.status === "fail")?.message ??
            preflight?.readiness?.message ??
            null;
        const latestTask = latestPublishTaskByArticle.get(a.id);
        const queuedForPublish = Boolean(
          latestTask &&
            latestTask.status !== "failed" &&
            latestTask.status !== "session_expired",
        );
        const platformKey = platformResolved.recognized
          ? normalizeWeeklyPlatformKey(platformResolved.label)
          : normalizeWeeklyPlatformKey(a.targetPlatform);
        const rawTitle = a.title ?? topic?.title ?? "未命名内容";
        return {
          id: a.id,
          title: formatWeeklyArticleCustomerTitle({
            title: rawTitle,
            generationBasis: a.generationBasis ?? null,
            targetPlatform: a.targetPlatform,
            publishPlatform: a.publishPlatform,
          }),
          targetPlatform: platformResolved.recognized ? platformResolved.label : a.targetPlatform,
          platformKey,
          contentTypeLabel: resolveContentTypeLabel(a),
          publishBlockHint,
          publishNextActionLabel: preflight?.ready
            ? null
            : preflight?.checks.find(c => c.status === "fail")?.action ??
              preflight?.readiness?.nextActionLabel ??
              null,
          publishPreflightReady: pass,
          queuedForPublish,
          queuedStatusLabel: queuedForPublish
            ? publishTaskStatusLabel({ status: latestTask?.status ?? "pending" })
            : null,
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
          qualityView: resolveQualityCardView(a, q ?? null),
          qualityFailHints: resolveFriendlyQualityFailHints(unifiedQualityArticle),
          qualityOptimizationSuggestions: resolveGeoQualityOptimizationSuggestions(a),
          qualityScore: resolveEffectiveGeoQualityScore(a, q ?? null),
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
    topicsById,
    tasksById,
    scoresByArticleId,
    latestDiagnosisGap,
    geoContentTaskSource,
    publishBaseContext,
    selectedProjectId,
    publishRecordsQuery.data,
    publishTasksQuery.data?.tasks,
  ]);

  const detailSyncRef = useRef<string>("");
  useEffect(() => {
    if (!detailOpen || detailModel == null) return;
    const updated = contentCardModels.find(card => card.id === detailModel.id);
    if (!updated) return;
    const sig = `${updated.statusFilterKey}|${updated.queuedForPublish}|${updated.publishPreflightReady}|${updated.contentReviewStatus}|${updated.qualityView?.score}`;
    if (sig !== detailSyncRef.current) {
      detailSyncRef.current = sig;
      setDetailModel(updated);
    }
  }, [contentCardModels, detailOpen, detailModel?.id]);

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
  const queuedContentCount = useMemo(
    () => contentCardModels.filter(card => card.queuedForPublish).length,
    [contentCardModels],
  );
  const pendingReviewCount = useMemo(
    () =>
      contentCardModels.filter(
        c => c.publishPreflightReady && isContentReviewPending(c.contentReviewStatus),
      ).length,
    [contentCardModels],
  );

  const enqueueReadyCount = useMemo(
    () =>
      contentCardModels.filter(
        c =>
          c.publishPreflightReady &&
          !isContentReviewPending(c.contentReviewStatus) &&
          !c.queuedForPublish &&
          c.statusFilterKey !== "published",
      ).length,
    [contentCardModels],
  );

  const taskProgress = useMemo((): WeeklyContentTaskProgress => {
    const generatedCount = contentCardModels.length;
    const publishReadyCount = contentCardModels.filter(c => c.publishPreflightReady).length;
    const queuedCount = contentCardModels.filter(c => c.queuedForPublish).length;
    const publishedCount = contentCardModels.filter(c => c.statusFilterKey === "published").length;
    return {
      generatedCount,
      publishReadyCount,
      pendingReviewCount,
      enqueueReadyCount,
      queuedCount,
      publishedCount,
    };
  }, [contentCardModels, pendingReviewCount, enqueueReadyCount]);

  const customerStageLabel = useMemo(() => {
    const metrics = workspaceSummaryQuery.data;
    if (!metrics || !selectedProjectId) return CUSTOMER_STAGE_LABELS.generate_content;
    const projectStatus = metrics.hasAnalysis
      ? "analysis_done"
      : metrics.hasGeoScore
        ? "score_done"
        : metrics.aiTestResultCount > 0
          ? "responses_imported"
          : "";
    return deriveClientProjectCardDisplay({
      status: projectStatus,
      articleCount: metrics.articleCount,
      publishCount: metrics.publishRecordCount,
      latestGeoScore: metrics.geoScore,
      aiTestCount: metrics.aiTestResultCount,
    }).stageLabel;
  }, [workspaceSummaryQuery.data, selectedProjectId]);

  const statusBarNextStep = useMemo(
    () =>
      buildWeeklyContentTaskNextStep({
        pendingReviewCount: taskProgress.pendingReviewCount,
        publishReadyCount: taskProgress.publishReadyCount,
        generatedCount: taskProgress.generatedCount,
      }),
    [taskProgress],
  );

  const previewCards = useMemo(
    () => displayContentCards.filter(card => card.statusFilterKey !== "published").slice(0, 6),
    [displayContentCards],
  );

  const currentContentTaskStatusLabel = useMemo(() => statusBarNextStep, [statusBarNextStep]);
  const taskSourceTypeLabel = useMemo(() => geoContentTaskSource?.sourceLabel?.trim() || "内容任务", [geoContentTaskSource?.sourceLabel]);

  const taskBoardProgress = useMemo(
    () => computeTaskBoardProgress(platformBoardRows),
    [platformBoardRows],
  );

  const taskBoardNextStep = useMemo(
    () => buildTaskBoardNextStepSuggestion(taskBoardProgress),
    [taskBoardProgress],
  );

  const profilePreview = useMemo(
    () => buildProfilePreviewFromRecord(enterpriseProfileRecord, brandName),
    [enterpriseProfileRecord, brandName],
  );

  const monthlyContentTasks = useMemo((): MonthlyContentTaskItem[] => {
    const publishTasks = publishTasksQuery.data?.tasks ?? [];
    const publishRecords = publishRecordsQuery.data ?? [];
    const inclusionRecords = inclusionMonitoringQuery.data ?? [];
    const latestPublishTaskByArticle = new Map<number, (typeof publishTasks)[number]>();
    const latestPublishRecordByArticle = new Map<number, (typeof publishRecords)[number]>();
    const latestInclusionRecordByArticle = new Map<number, (typeof inclusionRecords)[number]>();
    for (const task of publishTasks) {
      const articleId = typeof task.articleId === "number" ? task.articleId : null;
      if (!articleId) continue;
      const prev = latestPublishTaskByArticle.get(articleId);
      const taskTime = new Date(task.createdAt ?? 0).getTime();
      const prevTime = prev ? new Date(prev.createdAt ?? 0).getTime() : -1;
      if (!prev || taskTime >= prevTime) latestPublishTaskByArticle.set(articleId, task);
    }
    for (const record of publishRecords) {
      const articleId = typeof record.articleId === "number" ? record.articleId : null;
      if (!articleId) continue;
      const prev = latestPublishRecordByArticle.get(articleId);
      const recordTime = new Date(record.publishedAt ?? record.createdAt ?? 0).getTime();
      const prevTime = prev ? new Date(prev.publishedAt ?? prev.createdAt ?? 0).getTime() : -1;
      if (!prev || recordTime >= prevTime) latestPublishRecordByArticle.set(articleId, record);
    }
    for (const record of inclusionRecords) {
      const articleId = typeof record.articleId === "number" ? record.articleId : null;
      if (!articleId) continue;
      const prev = latestInclusionRecordByArticle.get(articleId);
      const recordTime = new Date(record.updatedAt ?? record.createdAt ?? 0).getTime();
      const prevTime = prev ? new Date(prev.updatedAt ?? prev.createdAt ?? 0).getTime() : -1;
      if (!prev || recordTime >= prevTime) latestInclusionRecordByArticle.set(articleId, record);
    }

    return (monthlyPlanQuery.data?.tasks ?? [])
      .filter(t => t.taskType === "content_generation")
      .map(t => {
        const questionId = resolveMonthlyContentTaskQuestionId({
          relatedQuestionId: t.relatedQuestionId,
          metadata: t.metadata,
          actionUrl: t.actionUrl,
        });
        const taskArticles =
          questionId != null ? articles.filter(article => articleMatchesQuestionId(article, questionId)) : [];
        const lifecycleViews = taskArticles.map(article =>
          resolveArticleLifecycleForBoard({
            article,
            publishRecord: latestPublishRecordByArticle.get(article.id) ?? null,
            inclusionRecord: latestInclusionRecordByArticle.get(article.id) ?? null,
            publishTask: latestPublishTaskByArticle.get(article.id) ?? null,
          }),
        );
        const lagging = pickLaggingContentAssetLifecycleStage(lifecycleViews);
        return {
          id: t.id,
          projectId: t.projectId,
          title: t.title,
          reason: t.reason,
          status: t.status,
          questionId,
          actionUrl: t.actionUrl,
          laggingLifecycleLabel: lagging?.label ?? (questionId != null ? "待生成" : null),
        };
      });
  }, [
    monthlyPlanQuery.data?.tasks,
    articles,
    publishTasksQuery.data?.tasks,
    publishRecordsQuery.data,
    inclusionMonitoringQuery.data,
  ]);

  const handleSelectMonthlyContentTask = useCallback(
    (task: MonthlyContentTaskItem) => {
      const entryUrl = buildMonthlyContentTaskEntryUrl({
        task,
        selectedProjectId,
        currentSearch: searchString || getSearchFromLocation(location),
      });
      if (entryUrl) {
        const nextEntryContext = parseWeeklyContentEntryContext(getSearchFromLocation(entryUrl));
        setEntryContext(nextEntryContext);
        entryContextRef.current = nextEntryContext;
        entryAutoGenerateHandledRef.current = false;
        setLocation(entryUrl);
        return;
      }
      toast.message(
        task.questionId
          ? "请先选择客户项目，再进入内容任务推进。"
          : WEEKLY_CONTENT_TASK_UNBOUND_QUESTION_MESSAGE,
      );
    },
    [location, searchString, selectedProjectId, setLocation],
  );

  const weeklyCustomerPrimaryActionLabel = useMemo(() => {
    if (isCustomerExecutionView) return "查看收录与验证";
    if (monthlyContentTasks.length === 0) return "查看本月方案";
    if (taskProgress.publishedCount > 0) return "查看效果验证";
    if (taskProgress.enqueueReadyCount > 0 || taskProgress.queuedCount > 0) return "进入发布页面";
    if (entryContext.questionId != null) return "继续当前任务";
    return "进入本月任务推进";
  }, [
    entryContext.questionId,
    isCustomerExecutionView,
    monthlyContentTasks.length,
    taskProgress.enqueueReadyCount,
    taskProgress.publishedCount,
    taskProgress.queuedCount,
  ]);

  const handleWeeklyCustomerPrimaryAction = useCallback(() => {
    if (!selectedProjectId) return;
    if (isCustomerExecutionView) {
      setLocation(buildProjectUrl("/inclusion-monitoring", selectedProjectId));
      return;
    }
    if (monthlyContentTasks.length === 0) {
      setLocation(buildProjectUrl("/monthly-plan", selectedProjectId));
      return;
    }
    if (taskProgress.publishedCount > 0) {
      setLocation(buildProjectUrl("/inclusion-monitoring", selectedProjectId));
      return;
    }
    if (taskProgress.enqueueReadyCount > 0 || taskProgress.queuedCount > 0) {
      setLocation(buildProjectUrl("/content-publishing", selectedProjectId));
      return;
    }
    if (entryContext.questionId != null) {
      document
        .getElementById("weekly-operational-workbench")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const firstTask = monthlyContentTasks[0];
    if (firstTask) handleSelectMonthlyContentTask(firstTask);
  }, [
    entryContext.questionId,
    handleSelectMonthlyContentTask,
    isCustomerExecutionView,
    monthlyContentTasks,
    selectedProjectId,
    setLocation,
    taskProgress.enqueueReadyCount,
    taskProgress.publishedCount,
    taskProgress.queuedCount,
  ]);

  const platformProgressText = useMemo(() => {
    const pending = platformBoardRows.reduce((sum, row) => sum + row.counts.pending, 0);
    const generated = platformBoardRows.reduce(
      (sum, row) => sum + row.counts.pendingConfirm + row.counts.ready + row.counts.published,
      0,
    );
    const publishable = platformBoardRows.reduce((sum, row) => sum + row.counts.ready, 0);
    const published = platformBoardRows.reduce((sum, row) => sum + row.counts.published, 0);
    return `待生成 ${pending} / 已生成 ${generated} / 可入队 ${publishable} / 已入队 ${queuedContentCount} / 已发布 ${published}`;
  }, [platformBoardRows, queuedContentCount]);
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

  const entryMotherArticle = useMemo(() => {
    if (entryContext.articleId == null) return null;
    return articlesById.get(entryContext.articleId) ?? null;
  }, [entryContext.articleId, articlesById]);

  const entryLinkedQuestionText = useMemo(() => {
    if (entryContext.questionText?.trim()) return entryContext.questionText.trim();
    if (entryContext.questionId != null) {
      const fromList = (questionsQuery.data ?? []).find(
        (q: { id?: number }) => q.id === entryContext.questionId,
      ) as { questionText?: string } | undefined;
      const text = fromList?.questionText?.trim();
      if (text) return text;
    }
    return resolveArticleLinkedQuestionText(entryMotherArticle, questionsQuery.data ?? []);
  }, [
    entryContext.questionText,
    entryContext.questionId,
    entryMotherArticle,
    questionsQuery.data,
  ]);

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

  const preparePublishDialogForArticle = useCallback((article: ArticleRow) => {
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
    applyPublishDialogAgentSnapshot(localAgentConnectedOnline, localAgentAccountSnapshot);
  }, [
    selectedProjectId,
    localAgentConnectedOnline,
    localAgentAccountSnapshot,
    applyPublishDialogAgentSnapshot,
  ]);

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
    preparePublishDialogForArticle(article);
    setPublishDialogOpen(true);
  };

  const requestEnqueuePublish = useCallback(
    (article: ArticleRow) => {
      if (blockPublishIfUnsaved(article.id)) return;
      if (blockPublishIfQualityReject(article)) return;
      const legacyQuality = scoresByArticleId.get(article.id) ?? null;
      const preflight = evaluateArticlePublishPreflight(article);
      if (!preflight?.ready) {
        const blocking = resolveQualityBlockingIssues(article, legacyQuality);
        const detail = preflight ? formatPublishPreflightBlockMessage(preflight) : "";
        toast.error([detail, blocking.join("；")].filter(Boolean).join("；") || "发布前检查未通过");
        return;
      }
      if (isContentReviewPending(article.contentReviewStatus)) {
        setReviewConfirmDialog({
          open: true,
          article,
          confirmed: false,
          mode: "review_and_enqueue",
        });
        return;
      }
      if (articleNeedsCoverSaveHint(article)) {
        toast.message(ARTICLE_MISSING_COVER_PUBLISH_HINT_MESSAGE);
      }
      if (isGeoQualityScoreStale(article)) {
        toast.message(GEO_QUALITY_STALE_PUBLISH_HINT);
      } else if (article.geoQualityRecommendation === "revise") {
        toast.message("内容有优化空间，确认后可继续发布");
      }
      preparePublishDialogForArticle(article);
      setPublishDialogOpen(true);
    },
    [
      blockPublishIfUnsaved,
      blockPublishIfQualityReject,
      selectedProjectId,
      publishBaseContext,
      preparePublishDialogForArticle,
    ],
  );

  const openReviewConfirmDialog = useCallback(
    (article: ArticleRow, mode: WeeklyContentReviewDialogMode = "review_only") => {
      setReviewConfirmDialog({
        open: true,
        article,
        confirmed: false,
        mode,
      });
    },
    [],
  );

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

  useEffect(() => {
    if (!selectedProjectId) return;
    for (const [platformKey, { articleId, topicId }] of inFlightDraftByPlatform.entries()) {
      if (recoveryPollsStartedRef.current.has(articleId) || activeDraftPollsRef.current.has(articleId)) {
        continue;
      }
      recoveryPollsStartedRef.current.add(articleId);
      setGeneratingPlatformKey(prev => prev ?? platformKey);
      void pollPlatformDraftUntilDone(selectedProjectId, articleId).then(result => {
        if (!result.ok && result.errorMessage && topicId > 0) {
          recordPlatformGenerationFailure(platformKey, topicId, {}, result.errorMessage);
        } else if (result.ok) {
          clearPlatformGenerationRetry(platformKey);
        }
        setGeneratingPlatformKey(prev => (prev === platformKey ? null : prev));
      });
    }
  }, [
    selectedProjectId,
    inFlightDraftByPlatform,
    pollPlatformDraftUntilDone,
    recordPlatformGenerationFailure,
    clearPlatformGenerationRetry,
  ]);

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

      const entryCtx = entryContextRef.current;
      if (entryCtx.articleId != null) {
        const articleList = (await utils.geo.articles.list.fetch({ projectId })) as ArticleRow[];
        const mother = articleList.find(a => a?.id === entryCtx.articleId);
        if (mother?.topicId) {
          return { ok: true, topicId: mother.topicId, strategyOverride };
        }
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
      let projectId: number;
      try {
        projectId = assertMutationProjectId(selectedProjectId, location, accessibleProjectIds);
      } catch {
        const message = PLATFORM_CONTENT_PROJECT_ACCESS_MESSAGE;
        if (!options?.silentToast) toast.error(message);
        return { ok: false, errorMessage: message };
      }

      const effectiveStrategy = { ...platformStrategy, ...strategyOverride };
      const strategyErr = validatePlatformContentStrategy(effectiveStrategy);
      if (strategyErr) {
        if (!options?.silentToast) toast.error(strategyErr);
        return { ok: false, errorMessage: strategyErr, topicId, strategyOverride };
      }

      const ctx = entryContextRef.current;
      try {
        const startResult = await startPlatformDraftMutation.mutateAsync({
          topicId,
          targetPublishPlatform: effectiveStrategy.targetPublishPlatform,
          contentStrategyType: effectiveStrategy.contentStrategyType,
          publishIdentity: effectiveStrategy.publishIdentity,
          recommendedAccountGroup: effectiveStrategy.recommendedAccountGroup,
          targetQuestion: effectiveStrategy.targetQuestion.trim(),
          geoEnhancementGoal: effectiveStrategy.geoEnhancementGoal,
          targetAiPlatforms: [...effectiveStrategy.targetAiPlatforms],
          contentTaskId: resolvedContentTaskIdForGenerate ?? ctx.taskId ?? undefined,
          diagnosisFinding: geoContentTaskSource?.diagnosisFinding ?? ctx.relatedGeoGap,
          geoGap: geoContentTaskSource?.geoGapSummary ?? ctx.relatedGeoGap,
          platformRule: formatPlatformRuleSummaryForGeneration(effectiveStrategy.targetPublishPlatform),
          questionTemplateId: selectedQuestionTemplateId ?? undefined,
          questionId: ctx.questionId ?? undefined,
          sourceType: ctx.sourceType ?? undefined,
        });
        await invalidateArticles();
        if (!options?.silentToast) {
          toast.message(startResult.message || PLATFORM_DRAFT_START_MESSAGE);
        }

        const pollResult = await pollPlatformDraftUntilDone(projectId, startResult.articleId, {
          onProgress: stage => platformContentProgress.setStage(stage),
        });
        if (!pollResult.ok) {
          const failure = recordPlatformGenerationFailure(
            platformKey,
            topicId,
            strategyOverride,
            pollResult.errorMessage ?? PLATFORM_DRAFT_GENERATION_FAILED_MESSAGE,
          );
          return {
            ok: false,
            errorMessage: failure.message,
            topicId,
            strategyOverride,
          };
        }
        clearPlatformGenerationRetry(platformKey);
        return { ok: true, userNotice: pollResult.userNotice, topicId, strategyOverride };
      } catch (err) {
        if (!options?.silentToast && handleSubscriptionLimitMutationError(err)) {
          return { ok: false, errorMessage: SUBSCRIPTION_LIMIT_CONTENT_MESSAGE, topicId, strategyOverride };
        }
        const msg = readGenerateArticleError(err);
        const failure = recordPlatformGenerationFailure(platformKey, topicId, strategyOverride, msg);
        return { ok: false, errorMessage: failure.message, topicId, strategyOverride };
      }
    },
    [
      resolvePlatformGenerationParams,
      selectedProjectId,
      location,
      accessibleProjectIds,
      platformStrategy,
      geoContentTaskSource,
      resolvedContentTaskIdForGenerate,
      selectedQuestionTemplateId,
      startPlatformDraftMutation,
      invalidateArticles,
      pollPlatformDraftUntilDone,
      platformContentProgress,
      recordPlatformGenerationFailure,
      clearPlatformGenerationRetry,
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
          toastErrorDeduped(msg);
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
      toastErrorDeduped(displayMessage);
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

  const openContentDetail = useCallback((model: WeeklyArticleCardModel) => {
    setDetailModel(model);
    setDetailStatus(
      resolveWeeklyPlatformContentStatus({
        hasArticle: true,
        published: model.statusFilterKey === "published",
        queued: model.queuedForPublish,
        publishReady: model.publishPreflightReady,
        article: model.article as Parameters<typeof resolveWeeklyPlatformContentStatus>[0]["article"],
        needsRewrite: model.lifecycle?.status === "needs_revision",
      }),
    );
    setDetailOpen(true);
  }, []);

  const handlePlatformView = (platformKey: WeeklyPlatformKey) => {
    const model = contentCardModels.find(c => c.platformKey === platformKey);
    if (model) {
      openContentDetail(model);
      return;
    }
    toast.message("该平台暂无已生成内容，请先点击「生成该平台内容」");
  };

  const findArticleByPlatform = (platformKey: WeeklyPlatformKey): ArticleRow | undefined => {
    return articles.find(
      a =>
        getArticlePublishPlatform({
          generationBasis: a.generationBasis ?? null,
          targetPlatform: a.targetPlatform,
          publishPlatform: a.publishPlatform,
        }).weeklyPlatformKey === platformKey,
    );
  };

  const handlePlatformEdit = (platformKey: WeeklyPlatformKey) => {
    const hit = findArticleByPlatform(platformKey);
    if (hit) openEditor(hit);
  };

  const handlePlatformRegenerateFromBoard = (platformKey: WeeklyPlatformKey) => {
    void runPlatformContentGenerationUi(platformKey);
  };

  const handlePlatformEnqueue = (platformKey: WeeklyPlatformKey) => {
    const hit = findArticleByPlatform(platformKey);
    if (hit) openPublishDialog(hit);
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
      toast.success("封面已生成并保存");
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

  const handleUploadCover = async (article: ArticleRow, file: File) => {
    if (!selectedProjectId) return;
    const title = (article.title ?? "").trim();
    const content = (article.markdownContent ?? "").trim();
    if (!title || !content) {
      toast.error("请先通过「编辑内容」填写标题与正文");
      return;
    }
    const mime: StoredCoverMime =
      file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/webp"
        ? (file.type as StoredCoverMime)
        : "image/png";
    setRegeneratingCoverIds(prev => new Set(prev).add(article.id));
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result !== "string") {
            reject(new Error("无法读取封面文件"));
            return;
          }
          const comma = result.indexOf(",");
          resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(new Error("无法读取封面文件"));
        reader.readAsDataURL(file);
      });
      const coverBase64 = encodeStoredCoverBase64({ mime, base64 });
      const template = normalizeArticleCoverTemplateId(article.coverTemplate);
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
      toast.success("封面已上传并保存");
    } catch (err) {
      toast.error(toUserFacingErrorFromUnknown(err, "封面上传失败，可重试"));
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
    const preflight =
      activePublishPreflight ??
      (selectedProjectId
        ? evaluateArticlePublishPreflight(publishArticle, {
            ...publishDialogPreflightContext,
            requestedPlatform:
              manualPublishPlatform && isBindingPublishPlatform(manualPublishPlatform)
                ? manualPublishPlatform
                : null,
          })
        : null);
    if (!preflight?.ready) {
      toast.error(
        preflight ? formatPublishPreflightBlockMessage(preflight) : "发布前检查未通过",
      );
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
          toast.error("发布任务未走本地客户端，请联系支持团队检查配置");
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

  const enqueueArticleDirectly = async (article: ArticleRow): Promise<boolean> => {
    if (!selectedProjectId) return false;
    if (blockPublishIfUnsaved(article.id)) return false;
    if (blockPublishIfQualityReject(article)) return false;
    const preflight = evaluateArticlePublishPreflight(article);
    if (!preflight?.ready) {
      toast.error(
        preflight ? formatPublishPreflightBlockMessage(preflight) : "发布前检查未通过",
      );
      return false;
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
      toast.error("当前内容发布平台不可用，请检查平台绑定");
      return false;
    }
    await hydratePublishDialogAgent({ syncToWeb: true });
    const freshAccountGroups = (((await utils.geo.platformAccounts.list.fetch({ projectId: selectedProjectId }))
      ?.accounts ?? []) as Array<{ platform: string; accounts: PlatformAccountItem[] }>);
    const ready = (freshAccountGroups.find(g => g.platform === slug)?.accounts ?? []).filter(
      isPublishReadyAccount,
    ) as PlatformAccountItem[];
    if (ready.length === 0) {
      toast.error(publishBlockedNoAccountMessage(slug));
      return false;
    }
    const stored = readLastEnqueuePublishAccountId(selectedProjectId, slug);
    const picked =
      (stored ? ready.find(a => a.id === stored) : null) ?? (ready.length === 1 ? ready[0]! : null);
    if (!picked) {
      preparePublishDialogForArticle(article);
      setPublishDialogOpen(true);
      return false;
    }
    try {
      const res = await createPublishTask.mutateAsync({
        articleId: article.id,
        platform: slug,
        projectId: selectedProjectId,
        platformAccountId: picked.id,
      });
      if (res.publishMode !== "local_agent") {
        toast.error("发布任务未走本地客户端，请联系支持团队检查配置");
        return false;
      }
      rememberEnqueuePublishAccount(slug, picked.id);
      toast.success("发布任务已发送至本地客户端，请保持客户端运行。");
      notifyPublishEffectPrediction();
      void pollPublishTasksUntilDone(article.id, [res.taskId]);
      return true;
    } catch (err) {
      toast.error(toUserFacingErrorFromUnknown(err, "创建发布任务失败"));
      return false;
    }
  };

  const handleReviewConfirmSubmit = async () => {
    const { article, confirmed, mode } = reviewConfirmDialog;
    if (!article || !confirmed || !selectedProjectId) return;
    setReviewConfirmBusy(true);
    try {
      if (mode === "review_only") {
        await setContentReviewStatus.mutateAsync({
          projectId: selectedProjectId,
          articleId: article.id,
          status: "已审核可发布",
        });
        setReviewConfirmDialog({
          open: false,
          article: null,
          confirmed: false,
          mode: "review_and_enqueue",
        });
        toast.success("已标记为已审核可发布");
        return;
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
        toast.error(mapReviewEnqueueCustomerMessage("内容平台缺失：请重新生成该平台内容"));
        return;
      }

      await hydratePublishDialogAgent({ syncToWeb: true });
      const freshAccountGroups = (((await utils.geo.platformAccounts.list.fetch({
        projectId: selectedProjectId,
      }))
        ?.accounts ?? []) as Array<{ platform: string; accounts: PlatformAccountItem[] }>);
      const ready = (freshAccountGroups.find(g => g.platform === slug)?.accounts ?? []).filter(
        isPublishReadyAccount,
      ) as PlatformAccountItem[];
      if (ready.length === 0) {
        toast.error(mapReviewEnqueueCustomerMessage(publishBlockedNoAccountMessage(slug)));
        return;
      }
      const stored = readLastEnqueuePublishAccountId(selectedProjectId, slug);
      const picked =
        (stored ? ready.find(a => a.id === stored) : null) ?? (ready.length === 1 ? ready[0]! : null);
      if (!picked) {
        toast.error(mapReviewEnqueueCustomerMessage(publishMustSelectAccountMessage(slug)));
        preparePublishDialogForArticle(article);
        setPublishDialogOpen(true);
        return;
      }

      const res = await reviewAndEnqueueArticle.mutateAsync({
        projectId: selectedProjectId,
        articleId: article.id,
        platform: slug,
        confirmManualReview: true,
        platformAccountId: picked.id,
      });
      setReviewConfirmDialog({
        open: false,
        article: null,
        confirmed: false,
        mode: "review_and_enqueue",
      });
      rememberEnqueuePublishAccount(slug, res.platformAccountId);
      toast.success(REVIEW_ENQUEUE_SUCCESS_MESSAGE);
      notifyPublishEffectPrediction();
      void pollPublishTasksUntilDone(article.id, [res.publishTaskId]);
      await invalidateArticles();
    } catch (err) {
      const raw =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message ?? "")
          : "";
      toast.error(mapReviewEnqueueCustomerMessage(raw) || "审核并加入发布队列失败");
    } finally {
      setReviewConfirmBusy(false);
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
        if (
          article.status === "已发布" ||
          unsavedArticleIds.has(articleId) ||
          shouldBlockPublishForGeoQuality(article) ||
          isContentReviewPending(article.contentReviewStatus)
        ) {
          skippedCount += 1;
          continue;
        }
        const preflight = evaluateArticlePublishPreflight(article);
        if (!preflight?.ready) {
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
          const existing = taskIdsByArticle.get(articleId) ?? [];
          existing.push(res.taskId);
          taskIdsByArticle.set(articleId, existing);
        } catch {
          skippedCount += 1;
        }
      }

      if (successCount > 0) {
        toast.success(`已将 ${successCount} 篇内容加入发布队列`);
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
    const resolved = effectivePublishResolved ?? null;
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
  }, [effectivePublishResolved, manualPublishPlatform]);

  const activePublishPreflight = useMemo(() => {
    if (!publishArticle || !selectedProjectId) return null;
    const requestedPlatform =
      manualPublishPlatform && isBindingPublishPlatform(manualPublishPlatform)
        ? manualPublishPlatform
        : null;
    const account =
      publishDialogSlug && isBindingPublishPlatform(publishDialogSlug)
        ? pickSelectedPublishAccount(publishDialogSlug)
        : null;
    return evaluateArticlePublishPreflight(publishArticle, {
      ...publishDialogPreflightContext,
      requestedPlatform,
      selectedAccount: account
        ? ({ ...account, platform: publishDialogSlug } as PublishReadyAccountRow)
        : null,
      selectedAccountId: account?.id ?? null,
    });
  }, [
    publishArticle,
    selectedProjectId,
    publishDialogPreflightContext,
    manualPublishPlatform,
    publishDialogSlug,
    pickSelectedPublishAccount,
    evaluateArticlePublishPreflight,
  ]);

  const publishDialogNicknamePendingHint = useMemo(() => {
    if (!publishDialogSlug) return false;
    const localEntry = publishDialogAccountSnapshot.find(
      e => e.platform === publishDialogSlug && e.loginStatus === "valid",
    );
    if (localEntry && !localEntry.displayNameVerified) return true;
    const rows = getPublishReadyAccountsForPlatform(publishDialogSlug);
    return rows.some(a => a.accountName === LOCAL_AGENT_ACCOUNT_SYNC_PENDING_DISPLAY_NAME);
  }, [publishDialogAccountSnapshot, publishDialogSlug, getPublishReadyAccountsForPlatform]);


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
      <header className="space-y-2">
        <p className="text-sm font-semibold text-blue-700">
          {isContentProductionWorkbench ? "运营工具 / 内容生产工作台" : "客户主流程 / 执行进度"}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">
          {isContentProductionWorkbench ? "内容生产工作台" : "执行进度"}
        </h1>
        <p className="text-sm text-gray-500">
          {isContentProductionWorkbench
            ? "运营团队在这里围绕 AI 引用逻辑生成、质检并推进平台化内容。"
            : "让客户只看懂本月服务做到哪一步，以及下一步什么时候进入收录与验证。"}
        </p>
      </header>

      <PublishSuccessNotificationCard
        visible={Boolean(publishSuccessNotice)}
        platformLabel={publishSuccessNotice?.platformLabel ?? ""}
        articleUrl={publishSuccessNotice?.articleUrl}
        onDismiss={() => setPublishSuccessNotice(null)}
      />

      {tasksQuery.isError || topicsQuery.isError || articlesQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>暂时无法加载内容任务数据。</p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => {
              void Promise.all([tasksQuery.refetch(), topicsQuery.refetch(), articlesQuery.refetch()]);
            }}
          >
            重试加载
          </Button>
        </div>
      ) : !queriesReady || preparingTopics || generateTopicsMutation.isPending ? (
        <div className="flex flex-col items-center gap-3 py-16 text-gray-500">
          <Spinner className="size-6 text-blue-600" />
          <p className="text-sm">正在加载平台化内容生产数据…</p>
        </div>
      ) : showDiagnosisEmpty ? (
        <P0Card testId="weekly-no-diagnosis">
          <p className="text-base font-semibold text-gray-900" data-testid="weekly-empty-task-title">
            暂无内容任务
          </p>
          <p className="mt-2 text-sm leading-relaxed text-gray-700" data-testid="weekly-no-diagnosis-message">
            原因：尚未完成 AI 实测诊断或未选择内容缺口。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700"
              data-testid="weekly-go-ai-diagnosis"
              onClick={() => selectedProjectId && setLocation(buildProjectUrl("/monthly-plan", selectedProjectId))}
            >
              查看本月服务计划
            </Button>
          </div>
        </P0Card>
      ) : showProjectTasksEmpty ? (
        <P0Card testId="weekly-no-project-content-tasks">
          <p className="text-sm leading-relaxed text-gray-700" data-testid="weekly-no-project-content-tasks-message">
            {GEO_CONTENT_TASK_EMPTY_FOR_PROJECT_MESSAGE}
          </p>
          <Button
            type="button"
            className="mt-4 bg-blue-600 text-white hover:bg-blue-700"
            data-testid="weekly-go-ai-diagnosis-from-empty-tasks"
            onClick={() => selectedProjectId && setLocation(buildProjectUrl("/ai-diagnosis", selectedProjectId))}
          >
            去 AI 实测诊断
          </Button>
        </P0Card>
      ) : (
        <>
          <WeeklyCustomerExecutionOverview
            brandName={brandName}
            projectStageLabel={customerStageLabel}
            monthlyTasks={monthlyContentTasks}
            progress={taskProgress}
            currentTaskProgress={entryContext.questionId != null ? taskBoardProgress : null}
            currentTaskTitle={contentTaskViewQuery.data?.taskTitle ?? null}
            primaryActionLabel={weeklyCustomerPrimaryActionLabel}
            onPrimaryAction={handleWeeklyCustomerPrimaryAction}
          />

          {isContentProductionWorkbench ? (
          <details id="weekly-operational-workbench" open className="group space-y-5 rounded-2xl border border-gray-200 bg-white shadow-sm" data-testid="weekly-operational-workbench">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">运营后台 · 不进入客户第一轮演示</p>
                <h2 className={geoP0Surfaces.sectionTitle}>运营执行明细</h2>
                <p className={geoP0Surfaces.muted}>
                  客户只看上方“做到哪一步”；内部运营仍围绕一个 AI 搜索问题，推进内容生成、质检、适配与发布。
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 group-open:bg-blue-50 group-open:text-blue-700">
                展开处理
              </span>
            </summary>

            <div className="space-y-5 border-t border-gray-100 px-5 pb-5 pt-4">

            {entryContext.questionId == null ? (
              monthlyPlanQuery.isLoading ? (
                <P0Card testId="weekly-monthly-task-list-loading">
                  <p className="text-sm text-gray-600">正在加载本月内容任务…</p>
                </P0Card>
              ) : (
                <MonthlyContentTaskList
                  tasks={monthlyContentTasks}
                  onSelectTask={handleSelectMonthlyContentTask}
                  onGoMonthlyPlan={() =>
                    selectedProjectId
                      ? setLocation(buildProjectUrl("/monthly-plan", selectedProjectId))
                      : setLocation("/monthly-plan")
                  }
                />
              )
            ) : contentTaskViewQuery.isLoading ? (
              <P0Card testId="weekly-content-task-control-loading">
                <p className="text-sm text-gray-600">正在加载当前内容任务…</p>
              </P0Card>
            ) : contentTaskViewQuery.data ? (
              <CurrentContentTaskCard
                view={contentTaskViewQuery.data}
                sourceTypeLabel={resolveWeeklyContentSourceTypeLabel(entryContext.sourceType)}
              />
            ) : (
              <TaskProgressionFallback
                onGoMonthlyPlan={() =>
                  selectedProjectId
                    ? setLocation(buildProjectUrl("/monthly-plan", selectedProjectId))
                    : setLocation("/monthly-plan")
                }
              />
            )}

            {entryContext.questionId != null ? (
              <>
                <TaskProgressOverview metrics={taskBoardProgress} />

                <NextStepSuggestion
                  suggestion={taskBoardNextStep}
                  actionLabel={
                    taskBoardProgress.enqueueReady > 0
                      ? "加入发布队列"
                      : taskBoardProgress.qualityPending > 0
                        ? "查看并质检"
                        : taskBoardProgress.published > 0
                          ? "去收录监测"
                          : "生成平台稿"
                  }
                  onAction={() => {
                    if (taskBoardProgress.enqueueReady > 0) {
                      const readyRow = platformBoardRows.find(r => r.status === "PUBLISH_READY");
                      if (readyRow) {
                        const hit = findArticleByPlatform(readyRow.def.key);
                        if (hit) requestEnqueuePublish(hit);
                      }
                    } else if (taskBoardProgress.qualityPending > 0) {
                      const qcRow = platformBoardRows.find(
                        r => r.status === "QUALITY_PENDING" || r.status === "DRAFT",
                      );
                      if (qcRow) handlePlatformEdit(qcRow.def.key);
                    } else if (taskBoardProgress.published > 0 && selectedProjectId) {
                      setLocation(buildProjectUrl("/inclusion-monitoring", selectedProjectId));
                    } else {
                      const ungen = platformBoardRows.find(r => r.status === "UNGENERATED");
                      if (ungen) void handlePlatformGenerate(ungen.def.key);
                    }
                  }}
                />

                {contentTaskViewQuery.data ? (
                  <PlatformTaskBoard
                    rows={platformBoardRows}
                    recommendedPlatforms={contentTaskViewQuery.data.recommendedPlatforms}
                    boardBusy={batchBusy}
                    generatingPlatformKey={generatingPlatformKey}
                    activeInFlightPlatformKey={activeInFlightPlatformKey}
                    anyGenerating={platformAnyGenerating}
                    onGenerate={key => void handlePlatformGenerate(key)}
                    onSaveAndQc={handlePlatformEdit}
                    onEnqueue={key => {
                      const hit = findArticleByPlatform(key);
                      if (hit) requestEnqueuePublish(hit);
                    }}
                    onView={handlePlatformView}
                    onViewPublish={() =>
                      selectedProjectId &&
                      setLocation(buildProjectUrl("/content-publishing", selectedProjectId))
                    }
                    onGoMonitoring={() =>
                      selectedProjectId &&
                      setLocation(buildProjectUrl("/inclusion-monitoring", selectedProjectId))
                    }
                  />
                ) : (
                  <PlatformContentBoard
                    rows={platformBoardRows}
                    boardBusy={batchBusy}
                    generatingPlatformKey={generatingPlatformKey}
                    activeInFlightPlatformKey={activeInFlightPlatformKey}
                    anyGenerating={platformAnyGenerating}
                    onGenerate={key => void handlePlatformGenerate(key)}
                    onSaveAndQc={handlePlatformEdit}
                    onEnqueue={key => {
                      const hit = findArticleByPlatform(key);
                      if (hit) requestEnqueuePublish(hit);
                    }}
                    onView={handlePlatformView}
                  />
                )}

                <WeeklyAdvancedInfoSections
                  profilePreview={profilePreview}
                  source={geoContentTaskSource}
                  platformStrategy={platformStrategy}
                  onPlatformStrategyChange={setPlatformStrategy}
                  targetQuestionOptions={targetQuestionOptions}
                  strategyDisabled={anyGenerating}
                  platformBatchQueue={platformBatchQueue}
                  platformBatchRunning={platformBatchRunning}
                  onStartBatch={() => void handleBatchGenerateAllPlatforms()}
                  onRetryBatchItem={handleRetryPlatformBatchItem}
                  historyCards={displayContentCards}
                  historyDisabled={anyGenerating || batchEnqueueBusy}
                  onHistoryView={openContentDetail}
                  onHistoryRegenerate={model => {
                    const article = articlesById.get(model.id);
                    if (article && typeof article.topicId === "number") void generateOne(article.topicId);
                  }}
                  onHistoryEnqueue={model => {
                    const article = articlesById.get(model.id);
                    if (article) requestEnqueuePublish(article);
                  }}
                  onHistoryGoPublishing={() =>
                    selectedProjectId && setLocation(buildProjectUrl("/content-publishing", selectedProjectId))
                  }
                  onHistoryReviewChange={(articleId, status) => {
                    if (!selectedProjectId) return;
                    setContentReviewStatus.mutate(
                      { projectId: selectedProjectId, articleId, status },
                      { onSuccess: () => toast.success("审核状态已更新") },
                    );
                  }}
                  motherArticle={
                    contentTaskViewQuery.data
                      ? {
                          title: contentTaskViewQuery.data.motherArticleTitle,
                          summary: contentTaskViewQuery.data.motherArticleSummary,
                          status: contentTaskViewQuery.data.motherArticleStatus,
                          onViewFull: () => {
                            if (previewCards[0]) openContentDetail(previewCards[0]);
                          },
                          onEdit: () => {
                            if (previewCards[0]) {
                              const article = articlesById.get(previewCards[0].id);
                              if (article) openEditor(article);
                            }
                          },
                          onApprove: () => {
                            if (previewCards[0]) {
                              const article = articlesById.get(previewCards[0].id);
                              if (article) openReviewConfirmDialog(article, "review_only");
                            }
                          },
                          approveDisabled: batchBusy,
                        }
                      : null
                  }
                  generationLog={{
                    visible: platformContentProgress.status !== "idle" && Boolean(activePlatformProgressLabel),
                    platformLabel: activePlatformProgressLabel,
                    stepLabel: platformContentProgress.stepLabel,
                    stepDescription: platformContentProgress.stepDescription,
                    percent: platformContentProgress.percent,
                    elapsedSec: platformContentProgress.elapsedSec,
                    status: platformContentProgress.isFailed
                      ? "failed"
                      : platformContentProgress.isSuccess
                        ? "success"
                        : "running",
                    errorCategory: platformProgressErrorCategory,
                    errorMessage: platformContentProgress.isFailed
                      ? platformProgressFailureDisplay.message
                      : platformProgressErrorMessage,
                    onRegenerate: canRegeneratePlatformContent
                      ? () => handlePlatformRegenerate()
                      : undefined,
                    regenerateDisabled: anyGenerating,
                  }}
                />
              </>
            ) : null}
            </div>
          </details>
          ) : null}
        </>
      )}

      {enabled && isContentProductionWorkbench ? (
        <WeeklyLocalAgentStatusBar
          status={localAgentConnectionStatus}
          onGoPublishingPage={() =>
            selectedProjectId && setLocation(buildProjectUrl("/content-publishing", selectedProjectId))
          }
        />
      ) : null}

      <WeeklyContentDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        model={detailModel}
        projectId={selectedProjectId}
        disabled={anyGenerating || batchEnqueueBusy}
        coverGenerating={detailModel ? regeneratingCoverIds.has(detailModel.id) : false}
        onQualityReviewed={() => void invalidateArticles()}
        onSave={() => {
          if (!detailModel) return;
          const article = articlesById.get(detailModel.id);
          if (article) openEditor(article);
        }}
        onMarkReviewed={() => {
          if (!detailModel) return;
          const article = articlesById.get(detailModel.id);
          if (article) openReviewConfirmDialog(article, "review_only");
        }}
        onEnqueuePublish={() => {
          if (!detailModel) return;
          const article = articlesById.get(detailModel.id);
          if (article) requestEnqueuePublish(article);
        }}
        onGenerateCover={() => {
          if (!detailModel) return;
          const article = articlesById.get(detailModel.id);
          if (article) void handleRegenerateCover(article);
        }}
        onUploadCover={file => {
          if (!detailModel) return;
          const article = articlesById.get(detailModel.id);
          if (article) void handleUploadCover(article, file);
        }}
        onGoPublishingPage={() =>
          selectedProjectId && setLocation(buildProjectUrl("/content-publishing", selectedProjectId))
        }
      />

      <WeeklyContentReviewConfirmDialog
        open={reviewConfirmDialog.open}
        articleTitle={reviewConfirmDialog.article?.title}
        confirmed={reviewConfirmDialog.confirmed}
        busy={reviewConfirmBusy}
        mode={reviewConfirmDialog.mode}
        onOpenChange={open =>
          setReviewConfirmDialog(prev => ({
            ...prev,
            open,
            ...(open ? {} : { article: null, confirmed: false }),
          }))
        }
        onConfirmedChange={confirmed =>
          setReviewConfirmDialog(prev => ({
            ...prev,
            confirmed,
          }))
        }
        onConfirm={() => void handleReviewConfirmSubmit()}
      />

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
        <DialogContent
          className="flex max-h-[min(80vh,400px)] flex-col gap-0 border-gray-200 bg-white p-0 text-gray-900 sm:max-w-md"
          data-testid="publish-to-platform-dialog"
        >
          <DialogHeader className="shrink-0 border-b border-gray-100 px-6 py-4">
            <DialogTitle>加入发布队列</DialogTitle>
            <DialogDescription className="text-gray-500">
              确认发布目标后提交至本地客户端 · 各平台内容独立，本篇不支持一稿多发
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <section className="space-y-3" data-testid="publish-dialog-target-section">
              <p className="text-xs font-medium text-gray-500">发布目标</p>
              <div className="space-y-2 rounded-lg border border-gray-200 px-3 py-2">
                <div>
                  <p className="text-xs text-gray-500">文章标题</p>
                  <p className="text-sm font-medium text-gray-900">{publishArticle?.title ?? "当前文章"}</p>
                </div>
                {activePublishPreflight?.resolvedPlatform?.recognized ? (
                  <p className="text-sm text-gray-700" data-testid="publish-dialog-platform-label">
                    发布平台：
                    <span className="font-medium">{activePublishPreflight.platformLabel}</span>
                    {!getArticlePublishPlatform({
                      generationBasis: publishArticle?.generationBasis ?? null,
                      targetPlatform: publishArticle?.targetPlatform,
                      publishPlatform: publishArticle?.publishPlatform,
                    }).recognized && manualPublishPlatform ? (
                      <span className="ml-1 text-xs text-amber-700">（手动指定）</span>
                    ) : null}
                  </p>
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
                {publishDialogSlug
                  ? PUBLISH_QUEUE_PLATFORMS.filter(p => p.slug === publishDialogSlug).map(p => {
                      const selectableAccounts = isBindingPublishPlatform(p.slug)
                        ? getEnqueueSelectableAccountsForPlatform(p.slug)
                        : [];
                      const readyAccounts = isBindingPublishPlatform(p.slug)
                        ? getPublishReadyAccountsForPlatform(p.slug)
                        : [];
                      const legacyAccounts = isBindingPublishPlatform(p.slug)
                        ? selectableAccounts.filter(
                            a => !a.localProfileId?.trim() || !a.localAgentId?.trim(),
                          )
                        : [];
                      const selected = isBindingPublishPlatform(p.slug)
                        ? pickSelectedPublishAccount(p.slug)
                        : null;
                      const needsPick =
                        selectableAccounts.length > 1 && !selectedPublishAccountIds[p.slug];
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
                        <div key={p.slug} className="space-y-2">
                          {isBindingPublishPlatform(p.slug) ? (
                            <>
                              {selectableAccounts.length === 0 ? (
                                <span className="text-xs text-amber-600">
                                  无可发布账号（需绑定本地环境且登录有效）
                                </span>
                              ) : selectableAccounts.length === 1 ? (
                                <span className="text-xs text-gray-600" data-testid="publish-dialog-single-account">
                                  发布账号：{renderAccountSummary(selectableAccounts[0]!)}
                                </span>
                              ) : (
                                <>
                                  <label
                                    className="block text-xs text-gray-500"
                                    htmlFor={`publish-account-${p.slug}`}
                                  >
                                    发布账号
                                  </label>
                                  <select
                                    id={`publish-account-${p.slug}`}
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
                              {readyAccounts.length === 0 &&
                              selectableAccounts.length > 0 &&
                              !sessionExpired ? (
                                <span className="text-xs text-amber-600">
                                  暂无可直接发布的账号，请检查登录状态与本地绑定。
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-xs text-gray-500">无需绑定平台账号</span>
                          )}
                          <p className="text-xs text-gray-500" data-testid="publish-time-suggest">
                            建议发布时间：{getPublishTimeSuggest(publishDialogSlug)}
                          </p>
                        </div>
                      );
                    })
                  : null}
              </div>
            </section>
            <section className="space-y-2" data-testid="publish-dialog-check-section">
              <p className="text-xs font-medium text-gray-500">检查结果</p>
              <PublishPrePublishChecklist
                variant="summary"
                preflightChecks={activePublishPreflight?.checks ?? null}
                blockingCodes={activePublishPreflight?.blockingCodes}
              />
              {activePublishPreflight && !activePublishPreflight.ready ? (
                <p className="text-xs text-red-700" data-testid="publish-readiness-block">
                  {formatPublishPreflightBlockMessage(activePublishPreflight) ||
                    activePublishPreflight.readiness?.message}
                </p>
              ) : null}
              {activePublishPreflight?.ready && publishArticle?.geoQualityRecommendation === "revise" ? (
                <p className="text-xs text-amber-600">内容有优化空间，确认后可继续发布。</p>
              ) : null}
              {publishDialogNicknamePendingHint ? (
                <p className="text-xs text-amber-600" data-testid="publish-dialog-nickname-pending-hint">
                  当前账号已登录有效，但暂未识别真实昵称，可继续发布。
                </p>
              ) : null}
              {publishAccountGroupWarnings.map(w => (
                <p key={w.slug} className="text-xs text-red-700" data-testid="account-group-mismatch-hint">
                  <span className="font-medium">{w.platformLabel}：</span>
                  {w.message}
                </p>
              ))}
            </section>
          </div>
          <DialogFooter className="sticky bottom-0 shrink-0 gap-2 border-t border-gray-100 bg-white px-6 py-4 sm:flex-row">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setPublishDialogOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
              disabled={
                createPublishTask.isPending ||
                selectedPlatforms.size === 0 ||
                (activePublishPreflight != null && !activePublishPreflight.ready)
              }
              onClick={() => void handleConfirmPublish()}
            >
              {createPublishTask.isPending ? "提交中..." : "确认发布"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
