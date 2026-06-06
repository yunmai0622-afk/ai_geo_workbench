import { LocalAgentDownloadCard } from "@/components/LocalAgentDownloadCard";
import { ArticleAssetEditorSheet } from "@/components/ArticleAssetEditorSheet";
import { PlatformPublishSuccessRatePanel } from "@/components/publishing/PlatformPublishSuccessRatePanel";
import { PlatformStatusOverview } from "@/components/platformAccounts/PlatformStatusOverview";
import { PublishPlatformAccountsOverview } from "@/components/platformAccounts/PublishPlatformAccountsOverview";
import { LocalAccountBindingGuideCard } from "@/components/publishing/LocalAccountBindingGuideCard";
import { LocalAgentPublishStepsPanel } from "@/components/publishing/LocalAgentPublishStepsPanel";
import {
  PublishStatusBar,
  resolvePublishStatusLocalAgentLabel,
} from "@/components/publishing/PublishStatusBar";
import { PublishPlatformCardGrid } from "@/components/publishing/PublishPlatformCardGrid";
import { PublishSuccessNotificationCard } from "@/components/publishing/PublishSuccessNotificationCard";
import { publishPlatformCustomerLabel } from "@/lib/publishCenterDisplay";
import { PublishRecordsCalendar } from "@/components/publishing/PublishRecordsCalendar";
import { PublishRecordsListPanel } from "@/components/publishing/PublishRecordsListPanel";
import { PublishCenterErrorBoundary } from "@/components/publishing/PublishCenterErrorBoundary";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { useLocalAgentConnection } from "@/hooks/useLocalAgentConnection";
import { flattenPlatformAccountsForServerHeartbeat } from "@/lib/localAgentServerContext";
import { usePublishAccountHealthCheck } from "@/hooks/usePublishAccountHealthCheck";
import { buildProjectUrl } from "@/lib/activeProject";
import { buildPublishingViewModel } from "@/lib/buildPublishingViewModel";
import {
  asArray,
  PUBLISH_QUEUE_EMPTY_HINTS,
  PUBLISH_QUEUE_EMPTY_LABELS,
  type PublishQueueTabKey,
} from "@/lib/contentPublishingSafeData";
import {
  fetchLocalAgentDownloadManifest,
  pickLocalAgentDownloadHref,
} from "@/lib/localAgentDownloadManifest";
import { isLocalAgentClientOutdated } from "@shared/localAgentVersionCompare";
import { LocalAgentStatusCard } from "@/components/publishing/LocalAgentStatusCard";
import { recordPublicLink, publishStatusLabel } from "@/lib/assetProgressDisplay";
import { downloadPublishRecordsCsv } from "@/lib/geoDataExportDownload";
import { formatPublishedAtLabel } from "@/lib/deliveryReportDisplay";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { type PublishTaskCardModel } from "@/lib/publishCenterDisplay";
import { trpc } from "@/lib/trpc";
import { articleHasPublishableCover } from "@shared/articleCoverReadiness";
import { GEO_ARTICLE_MIN_PASS_SCORE } from "@shared/const";
import { type PublishPagePlatformCard } from "@shared/publishPageLayout";
import {
  REVIEW_QUEUE_STATUS_LABELS,
  REVIEW_TYPE_LABELS,
  type ReviewQueueStatus,
  type ReviewType,
} from "@shared/reviewQueue";
import {
  isLocalAgentPublishTaskResult,
  pickReadyAccountForPlatform,
  publishBlockedReasonForPlatform,
  resolveEnqueuePlatformSlug,
} from "@/lib/publishCenterEnqueue";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import {
  formatPublishSuccessPlatformPhrase,
  resolvePublishSuccessArticleUrl,
} from "@shared/publishSuccessNotification";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type PublishSuccessNotice = {
  platformLabel: string;
  articleUrl: string | null;
};

type ArticleRow = {
  id: number;
  title?: string | null;
  status?: string | null;
  targetPlatform?: string | null;
  publishPlatform?: string | null;
  markdownContent?: string | null;
  generationBasis?: Record<string, unknown> | null;
  publishedAt?: Date | string | null;
  lastPublishRecordAt?: Date | string | null;
};

type QualityScoreRow = {
  articleId?: number;
  totalScore: number;
  blocked?: number | boolean | null;
};

type PublishRecordRow = {
  id: number;
  articleId?: number | null;
  publishTitle?: string | null;
  publishChannel?: string | null;
  publishStatus?: string | null;
  publishUrl?: string | null;
  publicUrl?: string | null;
  publishedAt?: Date | string | number | null;
  notes?: string | null;
};

const MANUAL_PUBLISH_PLATFORMS = ["百家号", "知乎", "微信公众号", "头条号", "小红书"] as const;
type ManualPublishPlatform = (typeof MANUAL_PUBLISH_PLATFORMS)[number];
type ManualPublishStatus =
  | "pending_human_publish"
  | "published"
  | "publish_failed"
  | "manual_publish_needed"
  | "link_backfilled";

type AgentTaskRow = {
  id: number;
  articleId: number;
  articleTitle: string | null;
  platform: string;
  status: string;
  expectedAccountName: string | null;
  agentErrorType?: string | null;
  agentErrorMessage?: string | null;
  draftUrl?: string | null;
  resultUrl?: string | null;
  publishedUrl?: string | null;
  agentFinishedAt?: Date | string | number | null;
  agentPickedAt?: Date | string | number | null;
  createdAt?: Date | string | number | null;
  retryCount?: number | null;
  canRetry?: boolean;
  retryExhausted?: boolean;
};

type RetestQueueItemRow = {
  queueId?: number;
  articleId?: number;
  title?: string | null;
  reviewType?: string | null;
  triggerStatus?: string | null;
  status?: string | null;
  scheduledAt?: Date | string | number | null;
};

type InclusionMonitoringRow = {
  articleId?: number;
  publicUrl?: string | null;
};

type RewritePoolItemRow = {
  articleId: number;
  poolId?: number | null;
  title?: string | null;
  reason?: string | null;
  source?: string | null;
  articleStatus?: string | null;
  publishTaskStatus?: string | null;
  suggestionText?: string | null;
};

function hasNumericId<T extends { id?: unknown }>(
  value: T | null | undefined,
): value is T & { id: number } {
  return value != null && typeof value?.id === "number";
}

function filterListWithNumericId<T extends { id?: unknown }>(
  rows: Array<T | null | undefined> | null | undefined,
): Array<T & { id: number }> {
  return (rows ?? []).filter(hasNumericId);
}

function articleLatestQuality(articleId: number | undefined, scores: QualityScoreRow[]) {
  if (!articleId) return undefined;
  return scores.find(s => s.articleId === articleId);
}

function isQualityPassed(score?: QualityScoreRow) {
  return Boolean(score && !score.blocked && score.totalScore >= GEO_ARTICLE_MIN_PASS_SCORE);
}

function publishRecordNoticeText(notes?: string | null) {
  if (!notes) return "";
  return notes
    .replace("V1.0 人工确认发布记录：本系统只记录人工发布结果和公开链接，不调用外部平台 API，不创建收录监测记录。", "")
    .trim();
}

function toDatetimeLocalInput(value?: Date | string | number | null): string {
  const valueNow = new Date();
  valueNow.setMinutes(valueNow.getMinutes() - valueNow.getTimezoneOffset());
  const fallback = valueNow.toISOString().slice(0, 16);
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  const copy = new Date(d.getTime());
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 16);
}

function formatDateTimeText(value?: Date | string | number | null): string {
  if (!value) return "未设置";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "未设置";
  return d.toLocaleString("zh-CN", { hour12: false });
}

function retestStatusLabel(status?: string | null): string {
  if (!status) return "未知状态";
  if ((status as ReviewQueueStatus) in REVIEW_QUEUE_STATUS_LABELS) {
    return REVIEW_QUEUE_STATUS_LABELS[status as ReviewQueueStatus];
  }
  return status;
}

function retestTypeLabel(type?: string | null): string {
  if (!type) return "未分类";
  if ((type as ReviewType) in REVIEW_TYPE_LABELS) {
    return REVIEW_TYPE_LABELS[type as ReviewType];
  }
  return type;
}

function rewriteSourceLabel(source?: string | null): string {
  switch (source) {
    case "quality_reject":
      return "基础质检拒绝";
    case "geo_quality_reject":
      return "发布前质检 reject";
    case "publish_failed":
      return "发布失败";
    case "session_expired":
      return "登录态失效";
    case "manual_required_stale":
      return "人工确认超时";
    case "ai_test_no_brand":
      return "AI 提及不足";
    case "inclusion_failed":
      return "收录复测失败";
    case "quality_check_fail":
      return "自动质检未通过";
    default:
      return source?.trim() || "未标注来源";
  }
}

export function ContentPublishingCenterPage() {
  return (
    <PublishCenterErrorBoundary>
      <ContentPublishingCenterPageInner />
    </PublishCenterErrorBoundary>
  );
}

function ContentPublishingCenterPageInner() {
  const [location, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { selectedProjectId, selectedProject, projectInput, enabled, projectsLoading } =
    useActiveProjectSelection();

  const articlesQuery = trpc.geo.articles.list.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const scoresQuery = trpc.geo.articles.latestQualityScores.useQuery(projectInput, { enabled });
  const publishRecordsQuery = trpc.geo.publishRecords.listWithStatus.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const autoPublishTasksQuery = trpc.publishTasks.listRecentByProject.useQuery(
    { projectId: selectedProjectId!, limit: 30 },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const refetchAutoPublishTasks = autoPublishTasksQuery.refetch;
  const platformAccountsQuery = trpc.geo.platformAccounts.list.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const retestQueueQuery = trpc.geo.articles.retestQueue.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const rewritePoolQuery = trpc.geo.articles.rewritePool.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const inclusionMonitoringQuery = trpc.geo.articles.inclusionMonitoringRecords.useQuery(
    projectInput,
    { enabled },
  );
  const triggerReview = trpc.geo.articles.triggerReview.useMutation({
    onSuccess: () => void retestQueueQuery.refetch(),
  });
  const createManualPublishRecord = trpc.geo.articles.createManualPublishRecord.useMutation();
  const updateManualPublishRecord = trpc.geo.articles.updateManualPublishRecord.useMutation();
  const retryPublishTask = trpc.publishTasks.retry.useMutation();
  const backfillTaskPublicUrl = trpc.publishTasks.backfillPublicUrl.useMutation();
  const createPublishTask = trpc.publishTasks.create.useMutation();
  const [manualArticleId, setManualArticleId] = useState<number | undefined>(undefined);
  const [manualPlatform, setManualPlatform] = useState<ManualPublishPlatform>("知乎");
  const [manualLink, setManualLink] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  const [linkDraftById, setLinkDraftById] = useState<Record<number, string>>({});
  const [savingRowId, setSavingRowId] = useState<number | null>(null);
  const [retryingTaskId, setRetryingTaskId] = useState<number | null>(null);
  const [publishingCardKey, setPublishingCardKey] = useState<string | null>(null);
  const [publishAllBusy, setPublishAllBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorArticle, setEditorArticle] = useState<ArticleRow | null>(null);
  const [publishSuccessNotice, setPublishSuccessNotice] = useState<PublishSuccessNotice | null>(null);
  const completedAgentTaskIdsRef = useRef<Set<number>>(new Set());
  const completedAgentTasksInitializedRef = useRef(false);
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  const [lastUserAction, setLastUserAction] = useState("page_open");
  const debugEnabled = useMemo(
    () => new URLSearchParams(location.split("?")[1] ?? "").get("debug") === "1",
    [location],
  );

  const articles = useMemo(
    () => filterListWithNumericId(asArray<ArticleRow>(articlesQuery.data)) as ArticleRow[],
    [articlesQuery.data],
  );
  const scores = useMemo(() => asArray<QualityScoreRow>(scoresQuery.data), [scoresQuery.data]);
  const publishRecords = useMemo(
    () => filterListWithNumericId(asArray<PublishRecordRow>(publishRecordsQuery.data)) as PublishRecordRow[],
    [publishRecordsQuery.data],
  );
  const agentTasks = useMemo(
    () => filterListWithNumericId(asArray<AgentTaskRow>(autoPublishTasksQuery.data?.tasks)) as AgentTaskRow[],
    [autoPublishTasksQuery.data?.tasks],
  );
  const articleById = useMemo(() => new Map((articles ?? []).map(a => [a?.id, a])), [articles]);

  useEffect(() => {
    completedAgentTaskIdsRef.current = new Set();
    completedAgentTasksInitializedRef.current = false;
    setPublishSuccessNotice(null);
    setManualArticleId(undefined);
  }, [selectedProjectId]);

  useEffect(() => {
    const completedIds = ((agentTasks ?? []).filter(t => t.status === "completed") ?? []).map(t => t?.id);
    if (!completedAgentTasksInitializedRef.current) {
      completedIds.forEach(id => completedAgentTaskIdsRef.current.add(id));
      completedAgentTasksInitializedRef.current = true;
      return;
    }
    const newlyCompleted = completedIds.filter(id => !completedAgentTaskIdsRef.current.has(id));
    if (newlyCompleted.length > 0) {
      newlyCompleted.forEach(id => completedAgentTaskIdsRef.current.add(id));
      const tasks = (agentTasks ?? []).filter(t => t?.id != null && newlyCompleted.includes(t?.id));
      const platformLabel = formatPublishSuccessPlatformPhrase(
        (tasks ?? []).map(t => publishPlatformCustomerLabel(t.platform)),
      );
      const articleUrl = resolvePublishSuccessArticleUrl((tasks ?? []).map(t => t.resultUrl));
      setPublishSuccessNotice(prev =>
        prev?.platformLabel === platformLabel && prev?.articleUrl === articleUrl
          ? prev
          : { platformLabel, articleUrl },
      );
    }
  }, [agentTasks]);

  const autoInclusionByArticleAndUrl = useMemo(() => {
    const keys = new Set<string>();
    for (const row of asArray<InclusionMonitoringRow>(inclusionMonitoringQuery.data)) {
      const articleId = typeof row.articleId === "number" ? row.articleId : null;
      const url = typeof row.publicUrl === "string" ? row.publicUrl.trim() : "";
      if (articleId && url) keys.add(`${articleId}:${url}`);
    }
    return keys;
  }, [inclusionMonitoringQuery.data]);

  const { checking: accountHealthChecking, runCheck: runAccountHealthCheck } =
    usePublishAccountHealthCheck(selectedProjectId ?? null, enabled);
  const [manifestVersion, setManifestVersion] = useState<string | null>(null);
  const [manifestDownloadHref, setManifestDownloadHref] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    void fetchLocalAgentDownloadManifest().then(manifest => {
      const version = manifest?.version?.trim() || null;
      const href = pickLocalAgentDownloadHref(manifest);
      setManifestVersion(prev => (prev === version ? prev : version));
      setManifestDownloadHref(prev => (prev === href ? prev : href));
    });
  }, [enabled]);

  useEffect(() => {
    setLinkDraftById(prev => {
      let changed = false;
      const next = { ...prev };
      for (const r of publishRecords ?? []) {
        const url = recordPublicLink(r);
        const recordId = r?.id;
        if (recordId == null) continue;
        if (next[recordId] === undefined) {
          next[recordId] = url;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [publishRecords]);

  const platformAccountGroups = useMemo(() => {
    const accounts = platformAccountsQuery.data?.accounts;
    if (!Array.isArray(accounts)) return [];
    return accounts.map(group => ({
      ...group,
      accounts: Array.isArray(group.accounts) ? group.accounts : [],
    }));
  }, [platformAccountsQuery.data?.accounts]);

  const flattenedPlatformAccounts = useMemo(
    () => flattenPlatformAccountsForServerHeartbeat(platformAccountGroups),
    [platformAccountGroups],
  );
  const retestQueueItems = useMemo(
    () => asArray<RetestQueueItemRow>(retestQueueQuery.data?.items),
    [retestQueueQuery.data?.items],
  );
  const rewritePoolItems = useMemo(
    () => asArray<RewritePoolItemRow>(rewritePoolQuery.data?.items),
    [rewritePoolQuery.data?.items],
  );

  const publishingViewModel = useMemo(
    () =>
      buildPublishingViewModel({
        projectId: selectedProjectId,
        articles,
        scores,
        publishRecords,
        agentTasks,
        accountGroups: platformAccountGroups,
        articleById,
        autoInclusionByArticleAndUrl,
      }),
    [
      selectedProjectId,
      articles,
      scores,
      publishRecords,
      agentTasks,
      platformAccountGroups,
      articleById,
      autoInclusionByArticleAndUrl,
    ],
  );

  const {
    publishableArticles,
    taskCards,
    queueTabs,
    platformCards,
    boundPublishAccountCount,
    boundPlatformCount,
    readyPlatformCount,
    qualityByArticleId,
    agentTaskDerivedState,
  } = publishingViewModel;

  const { pendingCount, abnormalCount } = agentTaskDerivedState;

  const PUBLISH_QUEUE_TABS: Array<{
    key: PublishQueueTabKey;
    label: string;
    testId: string;
  }> = [
    { key: "pending", label: "待发布", testId: "publish-queue-tab-pending" },
    { key: "active", label: "发布中", testId: "publish-queue-tab-active" },
    { key: "needs_attention", label: "需要处理", testId: "publish-queue-tab-needs-attention" },
    { key: "completed", label: "已完成", testId: "publish-queue-tab-completed" },
    { key: "failed", label: "失败", testId: "publish-queue-tab-failed" },
  ];

  function qualityStatusLabel(card: PublishTaskCardModel): string {
    if (!card.articleId) return "未关联内容";
    const score = qualityByArticleId.get(card.articleId);
    if (!score) return "未质检";
    return isQualityPassed(score) ? `通过（${score.totalScore} 分）` : `未通过（${score.totalScore} 分）`;
  }

  function coverStatusLabel(card: PublishTaskCardModel): string {
    if (!card.articleId) return "未关联内容";
    const article = articleById.get(card.articleId);
    if (!article) return "内容缺失";
    return articleHasPublishableCover(article) ? "封面就绪" : "封面待补齐";
  }

  function taskNextActionLabel(card: PublishTaskCardModel, tab: PublishQueueTabKey): string {
    if (tab === "pending") return "发送到客户端并完成发布确认";
    if (tab === "active") return "在客户端继续处理并回传状态";
    if (tab === "needs_attention") {
      return card.canRetry ? "优先重试，失败后标记人工发布" : "标记人工发布并登记结果";
    }
    if (tab === "failed") {
      return card.canRetry ? "先重试，仍失败则标记人工发布" : "标记人工发布并回填链接";
    }
    if (card.publishedUrl) return "已完成，等待收录监测推进";
    return "回填公开链接以进入收录监测";
  }

  const manualArticleSelectValue = useMemo(() => {
    if (publishableArticles.length === 0) return undefined;
    if (
      manualArticleId != null &&
      publishableArticles.some(a => a?.id === manualArticleId)
    ) {
      return String(manualArticleId);
    }
    const fallbackId = publishableArticles[0]?.id;
    return fallbackId != null ? String(fallbackId) : undefined;
  }, [publishableArticles, manualArticleId]);
  const effectiveManualArticleId = useMemo(() => {
    if (!manualArticleSelectValue) return undefined;
    const parsed = Number.parseInt(manualArticleSelectValue, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [manualArticleSelectValue]);

  const {
    status: localAgentConnectionStatus,
    resolvedState: localAgentResolvedState,
    statusSnapshot: localAgentStatusSnapshot,
    checkConnection,
    clientVersion,
    accountSnapshot: localAgentAccountSnapshot,
    localAgentConnectedOnline,
    localAgentOnline,
  } = useLocalAgentConnection({
    boundPublishAccountCount,
    boundPlatformCount: platformAccountsQuery.isLoading ? null : boundPlatformCount,
    pendingTaskCount: autoPublishTasksQuery.isLoading ? null : pendingCount,
    platformAccounts: flattenedPlatformAccounts,
  });

  const runCheckConnectionWithFeedback = useCallback(async () => {
    const result = await checkConnection();
    if (result.feedback.kind === "success") toast.success(result.feedback.message);
    else if (result.feedback.kind === "info") toast.message(result.feedback.message);
    else toast.error(result.feedback.message);
    return result;
  }, [checkConnection]);

  const refreshAgentHealth = useCallback(async () => {
    setLastUserAction("refresh_agent_health");
    const result = await checkConnection();
    if (result.online) {
      setLastUserAction("refresh_account_status");
      await runAccountHealthCheck({ detectSessions: true });
    } else if (selectedProjectId) {
      await utils.geo.platformAccounts.list.invalidate({ projectId: selectedProjectId });
    }
  }, [checkConnection, runAccountHealthCheck, selectedProjectId, utils.geo.platformAccounts.list]);

  const refreshPublishTasks = useCallback(() => {
    setLastUserAction("refresh_publish_tasks");
    void refetchAutoPublishTasks();
  }, [refetchAutoPublishTasks]);

  const checkingAgent =
    localAgentConnectionStatus === "CHECKING" || accountHealthChecking;

  const localAgentUpdateNotice = useMemo(() => {
    if (!clientVersion || !manifestVersion || !manifestDownloadHref) return null;
    if (!isLocalAgentClientOutdated(clientVersion, manifestVersion)) return null;
    return {
      clientVersion,
      manifestVersion,
      downloadHref: manifestDownloadHref,
    };
  }, [clientVersion, manifestVersion, manifestDownloadHref]);

  const enabledQueries = useMemo(
    () => ({
      articles: enabled && Boolean(selectedProjectId),
      scores: enabled,
      publishRecords: enabled && Boolean(selectedProjectId),
      publishTasks: enabled && Boolean(selectedProjectId),
      platformAccounts: enabled && Boolean(selectedProjectId),
    }),
    [enabled, selectedProjectId],
  );

  if (debugEnabled) {
    console.info(
      "[GEO content-publishing debug]\n" +
        [
          `- projectId: ${selectedProjectId ?? "—"}`,
          `- renderCount: ${renderCountRef.current}`,
          `- agentHealthStatus: ${localAgentConnectionStatus}`,
          `- accountsCount: ${platformAccountGroups.reduce((n, g) => n + (g.accounts?.length ?? 0), 0)}`,
          `- tasksCount: ${agentTasks.length}`,
          `- recordsCount: ${publishRecords.length}`,
          `- activeTab: tasks`,
          `- isCheckingAccount: ${accountHealthChecking}`,
          `- isSyncingAccount: ${accountHealthChecking}`,
          `- enabledQueries: articles=${enabledQueries.articles} scores=${enabledQueries.scores} publishRecords=${enabledQueries.publishRecords} publishTasks=${enabledQueries.publishTasks} platformAccounts=${enabledQueries.platformAccounts}`,
          `- lastUserAction: ${lastUserAction}`,
        ].join("\n"),
    );
  }

  const loading =
    articlesQuery.isLoading || scoresQuery.isLoading || publishRecordsQuery.isLoading || autoPublishTasksQuery.isLoading;

  const publishDataLoadFailed =
    !loading &&
    enabled &&
    (articlesQuery.isError ||
      scoresQuery.isError ||
      publishRecordsQuery.isError ||
      autoPublishTasksQuery.isError);

  async function handleSaveRowLink(recordId: number, explicitDraft?: string) {
    if (!selectedProjectId) return;
    const record = publishRecords.find(r => r?.id === recordId);
    if (!record?.articleId) return;
    const article = articleById.get(record.articleId);
    const channel = (record.publishChannel || "").trim();
    if (!channel) {
      toast.error("该记录缺少平台信息，无法更新链接。");
      return;
    }
    const draft = (explicitDraft ?? linkDraftById[recordId] ?? "").trim();
    setSavingRowId(recordId);
    try {
      await updateManualPublishRecord.mutateAsync({
        id: record?.id,
        projectId: selectedProjectId,
        articleId: record.articleId,
        publishPlatform: channel as "知乎",
        publishTitle: (record.publishTitle || article?.title || "").trim() || "发布记录",
        publishUrl: draft,
        publishedAt: toDatetimeLocalInput(record.publishedAt),
        publishStatus: (draft ? "link_backfilled" : record.publishStatus || "pending_human_publish") as ManualPublishStatus,
        notes: publishRecordNoticeText(record.notes),
      });
      await utils.geo.publishRecords.listWithStatus.invalidate({ projectId: selectedProjectId });
      await inclusionMonitoringQuery.refetch();
      toast.success(
        draft ? "已回填公开链接，并已生成收录监测计划" : "链接已更新",
      );
    } catch (e) {
      toast.error(toUserFacingErrorFromUnknown(e, "更新链接失败"));
    } finally {
      setSavingRowId(null);
    }
  }

  async function handleBackfillTaskLink(taskId: number, currentLink?: string | null) {
    if (!selectedProjectId) return;
    const draft = window.prompt("请输入公开链接", currentLink?.trim() || "");
    if (draft == null) return;
    const link = draft.trim();
    if (!link) {
      toast.error("请输入公开链接");
      return;
    }
    setSavingRowId(taskId);
    try {
      await backfillTaskPublicUrl.mutateAsync({
        projectId: selectedProjectId,
        taskId,
        publicUrl: link,
      });
      await autoPublishTasksQuery.refetch();
      await utils.geo.publishRecords.listWithStatus.invalidate({ projectId: selectedProjectId });
      await inclusionMonitoringQuery.refetch();
      toast.success("已回填公开链接，并已生成收录监测计划");
    } catch (e) {
      toast.error(toUserFacingErrorFromUnknown(e, "回填公开链接失败"));
    } finally {
      setSavingRowId(null);
    }
  }

  function openArticleContent(card: PublishTaskCardModel) {
    if (!card.articleId) {
      toast.message("暂无可查看内容");
      return;
    }
    const article = articleById.get(card.articleId);
    if (!article) {
      toast.message("暂无可查看内容，请刷新后重试");
      return;
    }
    setEditorArticle(article);
    setEditorOpen(true);
  }

  function startLocalPublish(card: PublishTaskCardModel) {
    if (!localAgentConnectedOnline) {
      toast.error("未检测到本地发布助手，请打开客户端后重试。");
      return;
    }
    if (card.taskId) {
      toast.message("任务已在队列中，请在 Local Agent 中确认账号并人工发布");
      void refreshAgentHealth();
      return;
    }
    toast.message("请从平台化内容生产页将内容加入发布队列");
  }

  function markAbnormal(card: PublishTaskCardModel) {
    toast.error(card.errorMessage || card.statusLabel || "发布异常，请查看状态说明或联系支持团队");
  }

  async function enqueuePlatformCard(card: PublishPagePlatformCard): Promise<boolean> {
    if (!selectedProjectId || !card.articleId) return false;
    const slug = resolveEnqueuePlatformSlug(card);
    if (!slug) {
      toast.message(`${card.label} 需人工发布，请复制素材后登记发布记录`);
      return false;
    }
    if (!localAgentConnectedOnline) {
      toast.error("未检测到本地发布助手，请打开客户端后重试。");
      return false;
    }
    const account = pickReadyAccountForPlatform(platformAccountGroups, slug);
    if (!account) {
      const blocked = publishBlockedReasonForPlatform(platformAccountGroups, slug);
      toast.error(blocked);
      return false;
    }
    setPublishingCardKey(card.key);
    try {
      const res = await createPublishTask.mutateAsync({
        articleId: card.articleId,
        platform: slug,
        projectId: selectedProjectId,
        platformAccountId: account.id,
      });
      if (!isLocalAgentPublishTaskResult(res)) {
        toast.error("发布任务未走本地客户端，请联系支持团队检查配置");
        return false;
      }
      await autoPublishTasksQuery.refetch();
      toast.success(`${card.label} 已加入本地发布队列`);
      return true;
    } catch (e) {
      toast.error(toUserFacingErrorFromUnknown(e, "加入发布队列失败"));
      return false;
    } finally {
      setPublishingCardKey(null);
    }
  }

  async function handlePublishAllPlatforms() {
    if (!selectedProjectId) return;
    const targets = platformCards.filter(card => card.canPublish);
    if (targets.length === 0) {
      toast.error("当前没有可一键发布的平台内容，请先生成并通过质量检查");
      return;
    }
    if (!localAgentConnectedOnline) {
      toast.error("未检测到本地发布助手，请打开客户端后重试。");
      return;
    }
    setPublishAllBusy(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const card of targets) {
        const success = await enqueuePlatformCard(card);
        if (success) ok += 1;
        else fail += 1;
      }
      if (ok > 0) {
        toast.success(`已将 ${ok} 个平台内容加入本地发布队列`);
      }
      if (fail > 0 && ok > 0) {
        toast.message(`${fail} 个平台未能加入队列，请检查账号绑定与内容状态`);
      } else if (fail > 0 && ok === 0) {
        toast.error("未能加入发布队列，请检查各平台账号与内容状态");
      }
    } finally {
      setPublishAllBusy(false);
    }
  }

  function handlePlatformCardPreview(card: PublishPagePlatformCard) {
    if (card.previewUrl) {
      window.open(card.previewUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (card.articleId) {
      const article = articleById.get(card.articleId);
      if (article) {
        setEditorArticle(article);
        setEditorOpen(true);
        return;
      }
    }
    toast.message("暂无可预览内容，请先在平台化内容生产完成生成");
  }

  function handlePlatformCardRetry(card: PublishPagePlatformCard) {
    if (!card.taskId) return;
    const taskCard = taskCards.find(t => t.taskId === card.taskId);
    if (taskCard) void handleRetryPublishTask(taskCard);
  }

  async function handleRetryPublishTask(card: PublishTaskCardModel) {
    if (!selectedProjectId || !card.taskId) return;
    if (card.retryExhausted) {
      toast.error("请人工处理：已达最大重试次数");
      return;
    }
    setRetryingTaskId(card.taskId);
    try {
      const result = await retryPublishTask.mutateAsync({
        projectId: selectedProjectId,
        taskId: card.taskId,
      });
      await autoPublishTasksQuery.refetch();
      toast.success(
        result.canRetryAgain
          ? `已重新加入发布队列（第 ${result.retryCount} 次重试）`
          : "已重新加入发布队列；若再次失败需人工处理",
      );
    } catch (e) {
      toast.error(toUserFacingErrorFromUnknown(e, "重试失败"));
    } finally {
      setRetryingTaskId(null);
    }
  }

  async function handleSaveManualRecord() {
    if (!selectedProjectId) return;
    const articleId = effectiveManualArticleId;
    if (!articleId) {
      toast.error("请选择一篇文章");
      return;
    }
    const article = articles.find(a => a?.id === articleId);
    if (!article || !isQualityPassed(articleLatestQuality(articleId, scores))) {
      toast.error(`仅可选择已通过质量检查（≥ ${GEO_ARTICLE_MIN_PASS_SCORE} 分）的文章`);
      return;
    }
    const url = manualLink.trim();
    setSavingManual(true);
    try {
      await createManualPublishRecord.mutateAsync({
        projectId: selectedProjectId,
        articleId,
        publishPlatform: manualPlatform,
        publishTitle: article.title?.trim() || "发布记录",
        publishUrl: url,
        publishedAt: toDatetimeLocalInput(),
        publishStatus: url ? "link_backfilled" : "pending_human_publish",
        notes: "",
      });
      await utils.geo.publishRecords.listWithStatus.invalidate({ projectId: selectedProjectId });
      setManualLink("");
      if (url) {
        setPublishSuccessNotice({
          platformLabel: manualPlatform,
          articleUrl: resolvePublishSuccessArticleUrl([url]),
        });
      }
      toast.success("已登记发布记录");
    } catch (e) {
      toast.error(toUserFacingErrorFromUnknown(e, "登记失败"));
    } finally {
      setSavingManual(false);
    }
  }

  if (!enabled && !projectsLoading) {
    return (
      <div data-testid="publish-center-page">
        <ProjectContextEmptyState />
      </div>
    );
  }

  const projectName = selectedProject?.enterpriseName ?? "当前企业";
  const localAgentLabel = resolvePublishStatusLocalAgentLabel(
    localAgentConnectionStatus,
    localAgentConnectedOnline,
    localAgentResolvedState,
  );

  function handleExportPublishRecordsCsv() {
    if (loading) {
      toast.message("发布记录加载中，请稍后再导出");
      return;
    }
    const rows = (publishRecords ?? []).map(record => {
      const article = articleById.get(record.articleId ?? 0);
      const title =
        article?.title?.trim() || record.publishTitle?.trim() || `文章 #${record.articleId ?? "—"}`;
      const link = recordPublicLink(record);
      return {
        title,
        platform: record.publishChannel?.trim() || "—",
        publishedAt:
          formatPublishedAtLabel(record.publishedAt as Date | string | null | undefined) ?? "—",
        link: link || "—",
        status: publishStatusLabel(record.publishStatus),
      };
    });
    downloadPublishRecordsCsv({ projectName, rows });
    toast.success(rows.length > 0 ? "发布记录 CSV 已开始下载" : "已导出空表（暂无发布记录）");
  }

  return (
    <div className="space-y-6 pb-12" data-testid="publish-center-page">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">发布任务指挥台</h1>
          <p className="text-sm text-gray-500">
            先看有多少内容待发布、哪些可以发、哪些被阻断，再决定下一步操作。将已确认的内容发送到本地发布助手，由本机登录账号完成平台发布；账号和 Cookie 只保存在本机。发布后在此回填公开链接。按平台独立发布，不支持一稿多发。
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className={`shrink-0 ${geoP0Brand.primaryOutline}`}
          data-testid="publish-records-export-csv"
          disabled={loading || !selectedProjectId}
          onClick={handleExportPublishRecordsCsv}
        >
          导出发布记录
        </Button>
      </header>

      {publishDataLoadFailed ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
          data-testid="publish-center-load-failed"
        >
          发布状态暂时无法加载，请稍后重试。
        </div>
      ) : null}

      <PublishStatusBar
        localAgentLabel={localAgentLabel}
        readyAccountCount={boundPublishAccountCount}
        pendingTaskCount={pendingCount}
        abnormalTaskCount={abnormalCount}
        checking={checkingAgent}
        showDisconnectedHint={!localAgentConnectedOnline}
        onCheckConnection={() => {
          setLastUserAction("check_local_agent");
          void runCheckConnectionWithFeedback();
        }}
        onRefreshAccountStatus={() => void refreshAgentHealth()}
      />

      <PublishSuccessNotificationCard
        visible={Boolean(publishSuccessNotice)}
        platformLabel={publishSuccessNotice?.platformLabel ?? ""}
        articleUrl={publishSuccessNotice?.articleUrl}
        onDismiss={() => setPublishSuccessNotice(null)}
      />

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-gray-500">
          <Spinner className="size-5 text-blue-600" />
          正在加载发布任务…
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="publish-task-queue-module">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">发布任务队列</h2>
                <p className="mt-1 text-xs text-gray-500">先处理任务队列，再查看辅助状态与诊断信息。</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={geoP0Brand.primaryOutline}
                disabled={autoPublishTasksQuery.isFetching}
                onClick={refreshPublishTasks}
                data-testid="publish-queue-refresh"
              >
                {autoPublishTasksQuery.isFetching ? "刷新中…" : "立即拉取任务"}
              </Button>
            </div>
            <Tabs defaultValue="pending" className="mt-4 space-y-4">
              <TabsList className="flex w-full gap-2 overflow-x-auto">
                {PUBLISH_QUEUE_TABS.map(tab => (
                  <TabsTrigger
                    key={tab.key}
                    value={tab.key}
                    data-testid={tab.testId}
                    className="shrink-0"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {PUBLISH_QUEUE_TABS.map(tab => (
                <TabsContent key={tab.key} value={tab.key} className="mt-0">
                  {queueTabs[tab.key].length === 0 ? (
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-5">
                      <p className="text-sm font-medium text-gray-900">
                        {PUBLISH_QUEUE_EMPTY_LABELS[tab.key]}
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        {PUBLISH_QUEUE_EMPTY_HINTS[tab.key].reason}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {PUBLISH_QUEUE_EMPTY_HINTS[tab.key].nextStep}
                      </p>
                      {tab.key === "pending" && selectedProjectId ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={`mt-3 ${geoP0Brand.primaryOutline}`}
                          onClick={() => setLocation(buildProjectUrl("/weekly", selectedProjectId))}
                        >
                          去生成/选择内容
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {(queueTabs[tab.key] ?? []).map(card => (
                        <div key={card.key} className="rounded-xl border border-gray-200 bg-white p-4" data-testid={`publish-queue-card-${card.key}`}>
                          <div className="flex items-start justify-between gap-3">
                            <p className="line-clamp-2 text-sm font-semibold text-gray-900">{card.title}</p>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${card.statusBadgeClass}`}>
                              {card.statusLabel}
                            </span>
                          </div>
                          <dl className="mt-3 space-y-1.5 text-xs text-gray-600">
                            <div className="flex gap-2"><dt className="text-gray-500">平台</dt><dd>{card.platformLabel}</dd></div>
                            <div className="flex gap-2"><dt className="text-gray-500">发布账号</dt><dd>{card.accountLabel}</dd></div>
                            <div className="flex gap-2"><dt className="text-gray-500">质检状态</dt><dd>{qualityStatusLabel(card)}</dd></div>
                            <div className="flex gap-2"><dt className="text-gray-500">封面状态</dt><dd>{coverStatusLabel(card)}</dd></div>
                            <div className="flex gap-2"><dt className="text-gray-500">当前状态</dt><dd>{card.statusLabel}</dd></div>
                            <div className="flex gap-2"><dt className="text-gray-500">下一步动作</dt><dd>{taskNextActionLabel(card, tab.key)}</dd></div>
                          </dl>
                          <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                            {(tab.key === "pending" || tab.key === "active") ? (
                              <Button
                                type="button"
                                size="sm"
                                className={geoP0Brand.primary}
                                data-testid={`publish-queue-send-client-${card.key}`}
                                onClick={() => startLocalPublish(card)}
                              >
                                发送到客户端
                              </Button>
                            ) : null}
                            <Button type="button" size="sm" variant="outline" className={geoP0Brand.primaryOutline} onClick={() => openArticleContent(card)}>查看内容</Button>
                            {card.canRetry && card.taskId ? (
                              <Button type="button" size="sm" className={geoP0Brand.primary} onClick={() => void handleRetryPublishTask(card)} disabled={retryingTaskId === card.taskId}>
                                {retryingTaskId === card.taskId ? "重试中…" : "重试"}
                              </Button>
                            ) : null}
                            {(tab.key === "completed" || tab.key === "failed" || tab.key === "needs_attention") &&
                            card.taskId ? (
                              <>
                                {card.publishedUrl ? (
                                  <a
                                    href={card.publishedUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-xs text-blue-600 hover:underline"
                                  >
                                    链接预览
                                  </a>
                                ) : null}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className={geoP0Brand.primaryOutline}
                                  disabled={savingRowId === card.taskId}
                                  onClick={() => void handleBackfillTaskLink(card.taskId!, card.publishedUrl)}
                                >
                                  {savingRowId === card.taskId
                                    ? "保存中…"
                                    : card.publishedUrl
                                      ? "编辑链接"
                                      : "回填链接"}
                                </Button>
                              </>
                            ) : null}
                            {(tab.key === "completed" || tab.key === "failed" || tab.key === "needs_attention") &&
                            card.recordId ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className={geoP0Brand.primaryOutline}
                                  disabled={savingRowId === card.recordId}
                                  onClick={async () => {
                                    const draft = window.prompt(
                                      "请输入公开链接",
                                      (linkDraftById[card.recordId!] ?? card.publishedUrl ?? "").trim(),
                                    );
                                    if (draft == null) return;
                                    await handleSaveRowLink(card.recordId!, draft);
                                  }}
                                >
                                  {savingRowId === card.recordId
                                    ? "保存中…"
                                    : card.publishedUrl
                                      ? "编辑链接"
                                      : "回填链接"}
                                </Button>
                              </>
                            ) : null}
                            {(tab.key === "failed" || tab.key === "needs_attention") ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className={geoP0Brand.primaryOutline}
                                onClick={() => markAbnormal(card)}
                              >
                                标记人工发布
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </section>
          <PublishRecordsListPanel
            records={publishRecords}
            loading={publishRecordsQuery.isLoading}
            recentLimit={10}
            resolveTitle={record => {
              const article = articleById.get(record.articleId ?? 0);
              return (
                article?.title?.trim() ||
                record.publishTitle?.trim() ||
                `文章 #${record.articleId ?? "—"}`
              );
            }}
            onViewAllHistory={() =>
              selectedProjectId &&
              setLocation(buildProjectUrl("/publish-records-history", selectedProjectId))
            }
          />

          <section className="space-y-4" data-testid="publish-auxiliary-fold">
            <details className="rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="publish-platform-status-fold">
              <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-gray-800">
                平台状态总览
              </summary>
              <div className="border-t border-gray-100 p-5">
                {selectedProjectId ? <PlatformStatusOverview projectId={selectedProjectId} /> : null}
              </div>
            </details>

            <details className="rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="publish-success-rate-fold">
              <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-gray-800">
                各平台发布成功率
              </summary>
              <div className="border-t border-gray-100 p-5">
                {selectedProjectId ? <PlatformPublishSuccessRatePanel projectId={selectedProjectId} /> : null}
              </div>
            </details>

            <details className="rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="publish-platform-accounts-fold">
              <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-gray-800">
                管理发布账号
              </summary>
              <div className="space-y-4 border-t border-gray-100 p-5">
                <PublishPlatformAccountsOverview
                  projectId={selectedProjectId!}
                  showDownloadCard={false}
                />
                <LocalAccountBindingGuideCard
                  localAgentConnectedOnline={localAgentConnectedOnline}
                  boundPlatformCount={boundPlatformCount}
                  checking={checkingAgent || accountHealthChecking}
                  onRefresh={() => void refreshAgentHealth()}
                />
              </div>
            </details>

            <details className="rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="publish-local-agent-download-fold">
              <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-gray-800">
                下载 Local Agent
              </summary>
              <div className="space-y-4 border-t border-gray-100 p-5">
                <LocalAgentStatusCard
                  status={localAgentConnectionStatus}
                  statusSnapshot={localAgentStatusSnapshot}
                  checking={checkingAgent}
                  onCheckConnection={() => {
                    setLastUserAction("check_local_agent");
                    void runCheckConnectionWithFeedback();
                  }}
                  onRefreshAccountStatus={() => void refreshAgentHealth()}
                  updateNotice={localAgentUpdateNotice}
                />
                <LocalAgentDownloadCard
                  projectId={selectedProjectId ?? undefined}
                  platformAccounts={flattenedPlatformAccounts}
                  boundPublishAccountCount={boundPublishAccountCount}
                  localAgentAccountSnapshot={localAgentAccountSnapshot}
                />
              </div>
            </details>

            <details className="rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="publish-calendar-fold">
              <summary
                className="cursor-pointer px-5 py-4 text-sm font-medium text-gray-800"
                data-testid="publish-calendar-tab"
              >
                发布日历
              </summary>
              <div className="border-t border-gray-100 p-5">
                <PublishRecordsCalendar
                  records={publishRecords}
                  loading={publishRecordsQuery.isLoading}
                  resolveTitle={record => {
                    const article = articleById.get(record.articleId ?? 0);
                    return (
                      article?.title?.trim() ||
                      record.publishTitle?.trim() ||
                      `文章 #${record.articleId ?? "—"}`
                    );
                  }}
                />
              </div>
            </details>

            <details className="rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="publish-retest-rewrite-fold">
              <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-gray-800">
                发布后复测 · 重写池
              </summary>
              <div className="grid gap-4 border-t border-gray-100 p-5 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium text-gray-800">待复测队列</h3>
                  {retestQueueItems.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">暂无待复测内容</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm text-gray-700">
                      {retestQueueItems.map(item => (
                        <li key={item.queueId ?? item.articleId} className="rounded-lg border border-gray-100 p-3">
                          <p className="font-medium">{item.title}</p>
                          {selectedProjectId && typeof item.queueId === "number" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={`mt-2 ${geoP0Brand.primaryOutline}`}
                              disabled={triggerReview.isPending}
                              onClick={() => {
                                const queueId = item.queueId;
                                if (queueId == null) return;
                                void triggerReview
                                  .mutateAsync({
                                    projectId: selectedProjectId,
                                    queueId,
                                  })
                                  .then(() => {
                                    toast.success("已触发复测，状态更新为“复测进行中”");
                                  })
                                  .catch(e => {
                                    toast.error(toUserFacingErrorFromUnknown(e, "触发复测失败"));
                                  });
                              }}
                            >
                              手动触发复测
                            </Button>
                          ) : null}
                          <dl className="mt-2 grid grid-cols-1 gap-1 text-xs text-gray-500">
                            <div className="flex gap-2">
                              <dt>复测类型</dt>
                              <dd>{retestTypeLabel(item.reviewType)}</dd>
                            </div>
                            <div className="flex gap-2">
                              <dt>触发状态</dt>
                              <dd>{item.triggerStatus || "未记录"}</dd>
                            </div>
                            <div className="flex gap-2">
                              <dt>当前状态</dt>
                              <dd>{retestStatusLabel(item.status)}</dd>
                            </div>
                            <div className="flex gap-2">
                              <dt>计划时间</dt>
                              <dd>{formatDateTimeText(item.scheduledAt)}</dd>
                            </div>
                          </dl>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-800">重写池</h3>
                  {rewritePoolItems.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">暂无待重写条目</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm text-gray-700">
                      {rewritePoolItems.map(item => (
                        <li
                          key={`${item.articleId}-${item.poolId ?? 0}`}
                          className="rounded-lg border border-gray-100 p-3"
                        >
                          <p className="font-medium">{item.title}</p>
                          <p className="mt-1 text-xs text-gray-500">{item.reason}</p>
                          <dl className="mt-2 grid grid-cols-1 gap-1 text-xs text-gray-500">
                            <div className="flex gap-2">
                              <dt>触发来源</dt>
                              <dd>{rewriteSourceLabel(item.source)}</dd>
                            </div>
                            <div className="flex gap-2">
                              <dt>文章状态</dt>
                              <dd>{item.articleStatus || "未记录"}</dd>
                            </div>
                            <div className="flex gap-2">
                              <dt>任务状态</dt>
                              <dd>{item.publishTaskStatus || "无发布任务"}</dd>
                            </div>
                            {item.suggestionText?.trim() ? (
                              <div className="flex gap-2">
                                <dt>改写建议</dt>
                                <dd className="line-clamp-2">{item.suggestionText.trim()}</dd>
                              </div>
                            ) : null}
                          </dl>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </details>

            <details className="rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="publish-manual-register-fold">
              <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-gray-800">
                人工登记发布记录
              </summary>
              <div className="border-t border-gray-100 p-5">
                <section className="rounded-lg border border-gray-100 p-4">
                  <h3 className="text-sm font-medium text-gray-800">人工登记发布记录（可选）</h3>
                  <div className="mt-3 space-y-4 text-sm text-gray-600">
                    <p>若内容已在平台外发布，可在此登记公开链接，与 Local Agent 任务相互独立。每次仅登记一个平台。</p>
                    {publishableArticles.length === 0 ? (
                      <p className="text-gray-500">
                        暂无可选文章，请先在平台化内容生产完成质量检查（≥ {GEO_ARTICLE_MIN_PASS_SCORE} 分）。
                      </p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>选择文章</Label>
                          <Select
                            value={manualArticleSelectValue}
                            onValueChange={v => setManualArticleId(Number(v))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择文章" />
                            </SelectTrigger>
                            <SelectContent>
                              {(publishableArticles ?? []).map(a => (
                                <SelectItem key={a?.id} value={String(a?.id)}>
                                  {a.title?.trim() || `文章 #${a?.id}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>发布平台</Label>
                          <Select
                            value={manualPlatform}
                            onValueChange={v => setManualPlatform(v as ManualPublishPlatform)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MANUAL_PUBLISH_PLATFORMS.map(p => (
                                <SelectItem key={p} value={p}>
                                  {p}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label>公开链接（可选）</Label>
                          <Input
                            placeholder="人工发布后粘贴平台公开链接"
                            value={manualLink}
                            onChange={e => setManualLink(e.target.value)}
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className={geoP0Brand.primary}
                          disabled={savingManual || !selectedProjectId}
                          onClick={() => void handleSaveManualRecord()}
                        >
                          {savingManual ? "保存中…" : "保存发布记录"}
                        </Button>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </details>

            <details className="rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="publish-advanced-diagnostics-fold">
              <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-gray-800">
                高级诊断与补充操作
              </summary>
              <div className="space-y-5 border-t border-gray-100 p-5">
                <section className="rounded-lg border border-gray-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-medium text-gray-800">平台发布支持状态</h3>
                      <p className="mt-1 text-xs text-gray-500">
                        已验证 / 待实机验证 / 需人工确认；待验证平台失败时请转人工发布并回填链接。
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className={geoP0Brand.primary}
                      disabled={publishAllBusy || readyPlatformCount <= 0}
                      onClick={() => void handlePublishAllPlatforms()}
                      data-testid="publish-all-ready-platforms"
                    >
                      {publishAllBusy ? "提交中…" : `一键加入发布队列（${readyPlatformCount}）`}
                    </Button>
                  </div>
                  <div className="mt-4">
                    <PublishPlatformCardGrid
                      cards={platformCards}
                      loading={loading}
                      publishingCardKey={publishingCardKey}
                      retryingTaskId={retryingTaskId}
                      onPreview={handlePlatformCardPreview}
                      onPublish={card => {
                        void enqueuePlatformCard(card);
                      }}
                      onRetry={handlePlatformCardRetry}
                    />
                  </div>
                </section>

                <LocalAgentPublishStepsPanel projectId={selectedProjectId} />
              </div>
            </details>
          </section>
        </div>
      )}

      {selectedProjectId && editorArticle ? (
        <ArticleAssetEditorSheet
          open={editorOpen}
          onOpenChange={open => {
            setEditorOpen(open);
            if (!open) setEditorArticle(null);
          }}
          projectId={selectedProjectId}
          brandName={projectName}
          article={editorArticle}
          onSaved={() => void articlesQuery.refetch()}
        />
      ) : null}
    </div>
  );
}
