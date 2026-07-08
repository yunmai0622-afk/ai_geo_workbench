import { LocalAgentDownloadCard } from "@/components/LocalAgentDownloadCard";
import { ArticleAssetEditorSheet } from "@/components/ArticleAssetEditorSheet";
import { PlatformPublishSuccessRatePanel } from "@/components/publishing/PlatformPublishSuccessRatePanel";
import { PlatformStatusOverview } from "@/components/platformAccounts/PlatformStatusOverview";
import { PublishPlatformAccountsOverview } from "@/components/platformAccounts/PublishPlatformAccountsOverview";
import { LocalAccountBindingGuideCard } from "@/components/publishing/LocalAccountBindingGuideCard";
import { LocalAgentPublishStepsPanel } from "@/components/publishing/LocalAgentPublishStepsPanel";
import {
  PublishOperatorOverview,
  type PublishOperatorAccountRow,
  type PublishOperatorBlocker,
  type PublishOperatorFlowStep,
  type PublishOperatorMetric,
  type PublishOperatorPublishedRow,
  type PublishOperatorTaskRow,
} from "@/components/publishing/PublishOperatorOverview";
import { PublishTaskQueueTable, type PublishExecutionTabKey } from "@/components/publishing/PublishTaskQueueTable";
import {
  cardsForExecutionTab,
  PUBLISH_EXECUTION_EMPTY_HINTS,
  PUBLISH_EXECUTION_TABS,
  resolveDefaultPublishExecutionTab,
} from "@/lib/publishExecutionTabs";
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

function formatOperatorCount(value: number, empty = "暂无"): string {
  return value > 0 ? `${value} 项` : empty;
}

function publishTaskOperatorTab(card: PublishTaskCardModel): PublishExecutionTabKey {
  if (card.statusRaw === "failed" || card.statusRaw === "publish_failed" || card.retryExhausted) {
    return "failed";
  }
  if (card.statusRaw === "completed") {
    return card.publishedUrl?.trim() ? "published" : "waiting_links";
  }
  if (card.statusRaw === "agent_processing" || card.statusRaw === "processing") {
    return "active";
  }
  return "pending";
}

function publishTaskOperatorAction(card: PublishTaskCardModel, localAgentOnline: boolean): string {
  if (card.statusRaw === "failed" || card.statusRaw === "publish_failed" || card.retryExhausted) {
    return card.canRetry ? "重试发布" : "转人工处理";
  }
  if (card.statusRaw === "completed" && !card.publishedUrl?.trim()) {
    return "回填链接";
  }
  if (card.statusRaw === "agent_processing" || card.statusRaw === "processing") {
    return "查看进度";
  }
  return localAgentOnline ? "发送到客户端" : "先打开客户端";
}

function publishTaskOperatorNextAction(card: PublishTaskCardModel, localAgentOnline: boolean): string {
  if (card.statusRaw === "failed" || card.statusRaw === "publish_failed" || card.retryExhausted) {
    return card.canRetry ? "先重试，仍失败则转人工发布并回填链接。" : "转人工发布，完成后回填公开链接。";
  }
  if (card.statusRaw === "completed" && !card.publishedUrl?.trim()) {
    return "补齐公开链接，让内容进入效果验证。";
  }
  if (card.statusRaw === "agent_processing" || card.statusRaw === "processing") {
    return "确认客户端处理结果，完成后回填公开链接。";
  }
  return localAgentOnline ? "提交发布处理并完成人工确认。" : "先确认发布环境，或转人工发布。";
}

function buildOperatorAccountRow(card: PublishPagePlatformCard): PublishOperatorAccountRow {
  switch (card.status) {
    case "failed":
      return {
        key: card.key,
        platformLabel: card.label,
        statusLabel: "异常",
        impact: card.failureReason || "该平台最近发布失败，可能影响本月交付进度。",
        nextStep: card.canRetry ? "重试发布；仍失败则转人工发布并回填链接。" : "转人工发布并回填链接。",
        tone: "danger",
      };
    case "not_bound":
      return {
        key: card.key,
        platformLabel: card.label,
        statusLabel: "未绑定",
        impact: "无法自动进入发布流程，需要先补齐账号环境或改走人工发布。",
        nextStep: "检查账号环境，完成绑定后再发布。",
        tone: "danger",
      };
    case "pending_confirm":
      return {
        key: card.key,
        platformLabel: card.label,
        statusLabel: "待确认",
        impact: "已有内容但质量尚未确认，不建议直接发布。",
        nextStep: "回到内容生产工作台补齐内容质量。",
        tone: "warning",
      };
    case "no_content":
      return {
        key: card.key,
        platformLabel: card.label,
        statusLabel: "暂无内容",
        impact: "本月该平台没有可发布内容。",
        nextStep: "如需覆盖该平台，先生成对应内容。",
        tone: "default",
      };
    case "publishing":
      return {
        key: card.key,
        platformLabel: card.label,
        statusLabel: "发布中",
        impact: "内容正在处理，完成前暂不能进入效果验证。",
        nextStep: "跟进发布结果，完成后回填公开链接。",
        tone: "warning",
      };
    case "published":
      return {
        key: card.key,
        platformLabel: card.label,
        statusLabel: "已发布",
        impact: "该平台已有发布记录，下一步需要验证是否被看见。",
        nextStep: "进入效果验证，跟进收录和 AI 识别情况。",
        tone: "success",
      };
    case "manual_only":
      return {
        key: card.key,
        platformLabel: card.label,
        statusLabel: "人工发布",
        impact: "该平台需要人工完成发布，不阻断整体交付。",
        nextStep: "人工发布后登记公开链接。",
        tone: "warning",
      };
    case "ready":
      return {
        key: card.key,
        platformLabel: card.label,
        statusLabel: "可发布",
        impact: "账号与内容都已满足发布条件。",
        nextStep: "加入发布队列，完成后回填公开链接。",
        tone: "success",
      };
    default:
      return {
        key: card.key,
        platformLabel: card.label,
        statusLabel: card.statusLabel || "待确认",
        impact: "平台状态需要运营人员确认。",
        nextStep: "查看账号环境和任务队列。",
        tone: "default",
      };
  }
}

function buildPublishOperatorConclusion(input: {
  pendingWorkCount: number;
  failedCount: number;
  waitingLinkCount: number;
  publishedWaitingVerifyCount: number;
  readyPlatformCount: number;
  hasPublishableContent: boolean;
  localAgentNeeded: boolean;
}): string {
  if (!input.hasPublishableContent && input.pendingWorkCount === 0 && input.publishedWaitingVerifyCount === 0) {
    return "当前没有可执行的发布任务。建议先回到执行进度生成可发布内容，再进入发布执行和效果验证。";
  }
  if (input.failedCount > 0) {
    return `当前有 ${input.failedCount} 项发布异常需要优先处理。先处理失败或待重试任务，再回填公开链接进入效果验证。`;
  }
  if (input.pendingWorkCount > 0) {
    return input.localAgentNeeded
      ? `当前有 ${input.pendingWorkCount} 项内容待发布，且需要先确认发布环境可用。今天优先处理待发布队列和账号环境。`
      : `当前有 ${input.pendingWorkCount} 项内容待发布。今天按平台逐项执行，并在发布后回填公开链接。`;
  }
  if (input.waitingLinkCount > 0) {
    return `当前有 ${input.waitingLinkCount} 项发布记录缺少公开链接。先回填链接，才能进入收录和 AI 识别验证。`;
  }
  if (input.publishedWaitingVerifyCount > 0) {
    return `当前已有 ${input.publishedWaitingVerifyCount} 项内容完成发布，今天重点是进入效果验证，确认内容是否被搜索和 AI 看见。`;
  }
  if (input.readyPlatformCount > 0) {
    return `当前有 ${input.readyPlatformCount} 个平台满足发布条件。建议从可发布平台开始执行，形成可验证的公开链接。`;
  }
  return "当前发布链路暂无明确异常。建议继续检查平台账号、内容质量和效果验证进度。";
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
  const [executionTab, setExecutionTab] = useState<PublishExecutionTabKey>("pending");
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
    setExecutionTab("pending");
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

  const {
    pendingCount,
    failedCount,
    waitingLinkCount,
  } = agentTaskDerivedState;
  const activeTaskCount = queueTabs.active.length;

  const publishedTabCount = useMemo(
    () => cardsForExecutionTab("published", queueTabs).length,
    [queueTabs],
  );
  const waitingLinksTabCount = useMemo(
    () => cardsForExecutionTab("waiting_links", queueTabs).length,
    [queueTabs],
  );
  const defaultExecutionTab = useMemo(
    () =>
      resolveDefaultPublishExecutionTab({
        publishedCount: publishedTabCount,
        waitingLinksCount: waitingLinksTabCount,
        hasActiveSuccessNotice: Boolean(publishSuccessNotice),
      }),
    [publishedTabCount, waitingLinksTabCount, publishSuccessNotice],
  );

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

  const initialAgentCheckProjectRef = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled || selectedProjectId == null) return;
    if (initialAgentCheckProjectRef.current === selectedProjectId) return;
    initialAgentCheckProjectRef.current = selectedProjectId;
    void (async () => {
      await checkConnection();
      await runAccountHealthCheck({ detectSessions: true });
    })();
  }, [checkConnection, enabled, runAccountHealthCheck, selectedProjectId]);

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

  useEffect(() => {
    if (loading) return;
    setExecutionTab(defaultExecutionTab);
  }, [loading, defaultExecutionTab]);

  useEffect(() => {
    if (publishSuccessNotice) setExecutionTab("published");
  }, [publishSuccessNotice]);

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

  function handleOpenClient() {
    setLastUserAction("open_local_agent_client");
    const fold = document.querySelector('[data-testid="publish-account-client-fold"]');
    if (fold instanceof HTMLDetailsElement) {
      fold.open = true;
      fold.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    void runCheckConnectionWithFeedback();
  }

  function handleBackfillFromTable(card: PublishTaskCardModel) {
    if (card.taskId) {
      void handleBackfillTaskLink(card.taskId, card.publishedUrl);
      return;
    }
    if (card.recordId) {
      const draft = window.prompt(
        "请输入公开链接",
        (linkDraftById[card.recordId] ?? card.publishedUrl ?? "").trim(),
      );
      if (draft == null) return;
      void handleSaveRowLink(card.recordId, draft);
    }
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

  const openPublishTaskTab = useCallback((tab: PublishExecutionTabKey) => {
    setExecutionTab(tab);
    window.setTimeout(() => {
      document
        .querySelector("[data-testid='publish-task-queue-module']")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, []);

  const goToProjectPath = useCallback(
    (path: string) => {
      if (!selectedProjectId) return;
      setLocation(buildProjectUrl(path, selectedProjectId));
    },
    [selectedProjectId, setLocation],
  );

  const pendingWorkCount = queueTabs.pending.length + queueTabs.active.length;
  const publishedCards = useMemo(
    () => cardsForExecutionTab("published", queueTabs),
    [queueTabs],
  );
  const waitingLinkCards = useMemo(
    () => cardsForExecutionTab("waiting_links", queueTabs),
    [queueTabs],
  );
  const failedOrAttentionCards = useMemo(
    () => cardsForExecutionTab("failed", queueTabs),
    [queueTabs],
  );
  const platformAttentionCount = useMemo(
    () =>
      platformCards.filter(card =>
        card.status === "failed" ||
        card.status === "not_bound" ||
        card.status === "pending_confirm",
      ).length,
    [platformCards],
  );
  const hasPublishableContent =
    publishableArticles.length > 0 ||
    taskCards.length > 0 ||
    publishRecords.length > 0;
  const localAgentNeededForOperator = pendingWorkCount > 0 || failedOrAttentionCards.length > 0;
  const localAgentNeedLabel = localAgentNeededForOperator
    ? localAgentConnectedOnline
      ? "需要，当前已检测到可用连接"
      : "需要，先打开客户端或改走人工发布"
    : "暂不需要，当前重点是链接回填或效果验证";

  const publishOperatorMetrics = useMemo<PublishOperatorMetric[]>(
    () => [
      {
        label: "待发布内容",
        value: formatOperatorCount(pendingWorkCount),
        hint: pendingWorkCount > 0 ? "需要今天推进到发布或人工处理。" : "暂无待发布队列。",
        tone: pendingWorkCount > 0 ? "warning" : "default",
      },
      {
        label: "已发布待验证",
        value: formatOperatorCount(publishedCards.length),
        hint: publishedCards.length > 0 ? "下一步进入收录和 AI 识别验证。" : "暂无已发布待验证内容。",
        tone: publishedCards.length > 0 ? "success" : "default",
      },
      {
        label: "账号可用平台",
        value: boundPlatformCount > 0 ? `${boundPlatformCount} 个` : "暂无",
        hint:
          readyPlatformCount > 0
            ? `${readyPlatformCount} 个平台当前内容可加入发布。`
            : "可用账号需结合内容状态确认。",
        tone: boundPlatformCount > 0 ? "success" : "warning",
      },
      {
        label: "异常/待处理平台",
        value: formatOperatorCount(platformAttentionCount),
        hint: platformAttentionCount > 0 ? "需要处理账号、质量或发布异常。" : "暂无明显平台卡点。",
        tone: platformAttentionCount > 0 ? "danger" : "default",
      },
    ],
    [
      boundPlatformCount,
      pendingWorkCount,
      platformAttentionCount,
      publishedCards.length,
      readyPlatformCount,
    ],
  );

  const publishOperatorBlockers = useMemo<PublishOperatorBlocker[]>(() => {
    const blockers: PublishOperatorBlocker[] = [];
    if (failedCount > 0) {
      blockers.push({
        title: "发布失败或待重试",
        impact: "内容无法进入公开渠道，客户看不到执行结果。",
        nextAction: "先处理失败任务，能重试则重试，不能重试则转人工发布并回填链接。",
      });
    }
    if (waitingLinkCount > 0 || waitingLinkCards.length > 0) {
      blockers.push({
        title: "公开链接未回填",
        impact: "没有公开链接就无法进入收录监测和 AI 复测。",
        nextAction: "补齐公开链接，并确认内容进入效果验证。",
      });
    }
    if (pendingWorkCount > 0 && !localAgentConnectedOnline) {
      blockers.push({
        title: "本地发布助手未就绪",
        impact: "自动发布任务无法继续处理，可能拖慢交付节奏。",
        nextAction: "打开客户端并刷新账号状态；不适合自动发布的平台走人工发布。",
      });
    }
    if (platformAttentionCount > 0) {
      blockers.push({
        title: "平台账号或内容质量待处理",
        impact: "部分平台无法直接发布，影响内容覆盖。",
        nextAction: "检查账号环境、补齐登录状态或回到内容生产修正质量。",
      });
    }
    if (!hasPublishableContent) {
      blockers.push({
        title: "暂无可发布内容",
        impact: "发布中心没有可执行事项，客户无法看到本月执行进展。",
        nextAction: "先回到执行进度生成并确认内容。",
      });
    }
    return blockers.slice(0, 3);
  }, [
    failedCount,
    hasPublishableContent,
    localAgentConnectedOnline,
    pendingWorkCount,
    platformAttentionCount,
    waitingLinkCards.length,
    waitingLinkCount,
  ]);

  const publishOperatorFlowSteps = useMemo<PublishOperatorFlowStep[]>(() => {
    const contentReady = publishableArticles.length > 0 || taskCards.length > 0 || publishRecords.length > 0;
    const hasPublished = publishedCards.length > 0 || publishRecords.length > 0;
    const hasVerification = autoInclusionByArticleAndUrl.size > 0 || retestQueueItems.length > 0;
    const linkBackfillDone = hasPublished && waitingLinkCount === 0;
    return [
      {
        label: "内容生成",
        status: contentReady ? "done" : "current",
        hint: contentReady ? "已有内容进入发布链路。" : "先生成可发布内容。",
      },
      {
        label: "待发布",
        status: pendingWorkCount > 0 || failedCount > 0 ? "current" : hasPublished ? "done" : "waiting",
        hint: pendingWorkCount > 0 ? "当前重点处理待发布队列。" : "暂无待发布任务。",
      },
      {
        label: "已发布",
        status: hasPublished ? "done" : pendingWorkCount > 0 ? "waiting" : "current",
        hint: hasPublished ? "已有发布记录。" : "完成发布后进入下一步。",
      },
      {
        label: "链接回填",
        status: waitingLinkCount > 0 ? "current" : linkBackfillDone ? "done" : "waiting",
        hint: waitingLinkCount > 0 ? "需要补齐公开链接。" : linkBackfillDone ? "公开链接已具备验证条件。" : "发布后回填公开链接。",
      },
      {
        label: "效果验证",
        status: hasVerification ? "done" : hasPublished && waitingLinkCount === 0 ? "current" : "waiting",
        hint: hasVerification ? "已有内容进入验证链路。" : "确认搜索收录和 AI 识别。",
      },
      {
        label: "报告",
        status: hasVerification ? "current" : "waiting",
        hint: "把发布和验证结果沉淀到效果报告。",
      },
    ];
  }, [
    autoInclusionByArticleAndUrl.size,
    failedCount,
    pendingWorkCount,
    publishRecords.length,
    publishableArticles.length,
    publishedCards.length,
    retestQueueItems.length,
    taskCards.length,
    waitingLinkCount,
  ]);

  const publishOperatorPendingTasks = useMemo<PublishOperatorTaskRow[]>(() => {
    const cards = [
      ...failedOrAttentionCards,
      ...queueTabs.active,
      ...queueTabs.pending,
      ...waitingLinkCards,
    ];
    return cards.slice(0, 6).map(card => ({
      key: card.key,
      title: card.title || "未命名内容",
      platformLabel: card.platformLabel || "未标注平台",
      statusLabel: card.statusLabel || "待处理",
      nextAction: publishTaskOperatorNextAction(card, localAgentConnectedOnline),
      operationLabel: publishTaskOperatorAction(card, localAgentConnectedOnline),
      afterPublishLabel: "回填公开链接后，进入效果验证并沉淀到客户报告。",
      targetTab: publishTaskOperatorTab(card),
    }));
  }, [
    failedOrAttentionCards,
    localAgentConnectedOnline,
    queueTabs.active,
    queueTabs.pending,
    waitingLinkCards,
  ]);

  const publishOperatorAccountRows = useMemo<PublishOperatorAccountRow[]>(
    () =>
      platformCards
        .map(buildOperatorAccountRow)
        .sort((a, b) => {
          const rank = (row: PublishOperatorAccountRow) =>
            row.tone === "danger" ? 0 : row.tone === "warning" ? 1 : row.tone === "success" ? 2 : 3;
          return rank(a) - rank(b);
        }),
    [platformCards],
  );

  const publishOperatorPublishedRows = useMemo<PublishOperatorPublishedRow[]>(
    () =>
      publishedCards.slice(0, 6).map(card => ({
        key: card.key,
        title: card.title || "未命名内容",
        platformLabel: card.platformLabel || "未标注平台",
        statusLabel: card.autoInclusionMonitoring ? "已进入效果验证" : "待效果验证",
        nextStep: card.autoInclusionMonitoring
          ? "继续跟进收录和 AI 复测结果。"
          : "进入效果验证，确认内容是否被搜索和 AI 看见。",
        publicLinkLabel: card.publishedUrl?.trim() ? "已回填" : "待回填",
      })),
    [publishedCards],
  );

  const publishOperatorPrimaryAction = useMemo(() => {
    if (!hasPublishableContent) {
      return {
        label: "去生成可发布内容",
        hint: "先回到执行进度，生成本月可发布内容。",
        onClick: () => goToProjectPath("/weekly"),
      };
    }
    if (failedOrAttentionCards.length > 0) {
      return {
        label: "处理失败任务",
        hint: "优先处理失败或需人工介入的发布任务。",
        onClick: () => openPublishTaskTab("failed"),
      };
    }
    if (pendingWorkCount > 0) {
      return {
        label: "处理待发布任务",
        hint: "进入任务队列，把内容发布到对应平台。",
        onClick: () => openPublishTaskTab(queueTabs.active.length > 0 ? "active" : "pending"),
      };
    }
    if (platformAttentionCount > 0) {
      return {
        label: "检查账号环境",
        hint: "先处理账号或平台状态，再继续发布。",
        onClick: handleOpenClient,
      };
    }
    if (publishedCards.length > 0) {
      return {
        label: "去效果验证",
        hint: "确认已发布内容是否被搜索和 AI 看见。",
        onClick: () => goToProjectPath("/inclusion-monitoring"),
      };
    }
    return {
      label: "查看效果报告",
      hint: "发布链路暂无待处理事项，进入报告沉淀交付结果。",
      onClick: () => goToProjectPath("/delivery-reports"),
    };
  }, [
    failedOrAttentionCards.length,
    goToProjectPath,
    handleOpenClient,
    hasPublishableContent,
    openPublishTaskTab,
    pendingWorkCount,
    platformAttentionCount,
    publishedCards.length,
    queueTabs.active.length,
  ]);

  const publishOperatorConclusion = useMemo(
    () =>
      buildPublishOperatorConclusion({
        pendingWorkCount,
        failedCount,
        waitingLinkCount,
        publishedWaitingVerifyCount: publishedCards.length,
        readyPlatformCount,
        hasPublishableContent,
        localAgentNeeded: localAgentNeededForOperator && !localAgentConnectedOnline,
      }),
    [
      failedCount,
      hasPublishableContent,
      localAgentConnectedOnline,
      localAgentNeededForOperator,
      pendingWorkCount,
      publishedCards.length,
      readyPlatformCount,
      waitingLinkCount,
    ],
  );

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
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              运营后台
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              不进入客户第一轮演示
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">运营发布执行中心</h1>
          <p className="text-sm text-gray-500">
            面向代理运营的发布工作台：处理待发布内容、账号环境、失败重试、链接回填和效果验证；保留运营可用性，不作为客户首轮演示页。
          </p>
        </div>
        <details className="shrink-0 rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="publish-secondary-actions">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700">
            发布辅助操作
          </summary>
          <div className="border-t border-gray-100 p-3">
            <Button
              type="button"
              variant="outline"
              className={geoP0Brand.primaryOutline}
              data-testid="publish-records-export-csv"
              disabled={loading || !selectedProjectId}
              onClick={handleExportPublishRecordsCsv}
            >
              导出发布记录
            </Button>
          </div>
        </details>
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

      <PublishOperatorOverview
        conclusion={publishOperatorConclusion}
        localAgentNeedLabel={localAgentNeedLabel}
        metrics={publishOperatorMetrics}
        blockers={publishOperatorBlockers}
        flowSteps={publishOperatorFlowSteps}
        primaryAction={publishOperatorPrimaryAction}
        pendingTasks={publishOperatorPendingTasks}
        accountRows={publishOperatorAccountRows}
        publishedRows={publishOperatorPublishedRows}
        onOpenTaskTab={openPublishTaskTab}
        onOpenAccountTools={handleOpenClient}
        onOpenVerification={() => goToProjectPath("/inclusion-monitoring")}
      />

      <details className="rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="publish-status-bar-fold">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-gray-900">
          发布状态与客户端检查
          <span className="ml-2 text-xs font-normal text-gray-500">Local Agent、账号刷新和拉取任务默认收起</span>
        </summary>
        <div className="border-t border-gray-100 p-5">
          <PublishStatusBar
            localAgentLabel={localAgentLabel}
            readyAccountCount={boundPublishAccountCount}
            pendingTaskCount={pendingCount}
            activeTaskCount={activeTaskCount}
            failedTaskCount={failedCount}
            waitingLinkCount={waitingLinkCount}
            checking={checkingAgent}
            tasksFetching={autoPublishTasksQuery.isFetching}
            onPullTasks={refreshPublishTasks}
            onRefreshAccountStatus={() => void refreshAgentHealth()}
            onOpenClient={handleOpenClient}
          />
        </div>
      </details>

      <PublishSuccessNotificationCard
        visible={Boolean(publishSuccessNotice)}
        platformLabel={publishSuccessNotice?.platformLabel ?? ""}
        articleUrl={publishSuccessNotice?.articleUrl}
        onDismiss={() => setPublishSuccessNotice(null)}
        onGoToInclusionMonitoring={() =>
          selectedProjectId &&
          setLocation(buildProjectUrl("/inclusion-monitoring", selectedProjectId))
        }
      />

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-gray-500">
          <Spinner className="size-5 text-blue-600" />
          正在加载发布任务…
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="publish-task-queue-module">
            <div>
              <h2 className="text-base font-semibold text-gray-900">发布任务队列</h2>
              <p className="mt-1 text-xs text-gray-500">按状态处理待发布、发布中与失败任务。</p>
            </div>
            <Tabs value={executionTab} onValueChange={value => setExecutionTab(value as PublishExecutionTabKey)} className="mt-4 space-y-4">
              <TabsList className="flex w-full gap-2 overflow-x-auto">
                {PUBLISH_EXECUTION_TABS.map(tab => (
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
              {PUBLISH_EXECUTION_TABS.map(tab => {
                const tabCards = cardsForExecutionTab(tab.key, queueTabs);
                return (
                <TabsContent key={tab.key} value={tab.key} className="mt-0">
                  {tabCards.length === 0 ? (
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-5">
                      <p className="text-sm font-medium text-gray-900">
                        {PUBLISH_EXECUTION_EMPTY_HINTS[tab.key].title}
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        {PUBLISH_EXECUTION_EMPTY_HINTS[tab.key].reason}
                      </p>
                      {PUBLISH_EXECUTION_EMPTY_HINTS[tab.key].nextStep ? (
                        <p className="mt-1 text-xs text-gray-500">
                          {PUBLISH_EXECUTION_EMPTY_HINTS[tab.key].nextStep}
                        </p>
                      ) : null}
                      {tab.key === "pending" && selectedProjectId ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={geoP0Brand.primaryOutline}
                            data-testid="publish-empty-go-weekly"
                            onClick={() => setLocation(buildProjectUrl("/weekly", selectedProjectId))}
                          >
                            去生成新内容
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={geoP0Brand.primaryOutline}
                            data-testid="publish-empty-view-published"
                            onClick={() => setExecutionTab("published")}
                          >
                            查看已发布
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={geoP0Brand.primaryOutline}
                            data-testid="publish-empty-go-inclusion"
                            onClick={() =>
                              setLocation(buildProjectUrl("/inclusion-monitoring", selectedProjectId))
                            }
                          >
                            去收录监测
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <PublishTaskQueueTable
                      tab={tab.key}
                      cards={tabCards}
                      savingRowId={savingRowId}
                      retryingTaskId={retryingTaskId}
                      onSendToClient={startLocalPublish}
                      onViewTask={openArticleContent}
                      onRetry={card => void handleRetryPublishTask(card)}
                      onBackfillLink={handleBackfillFromTable}
                      onMarkFailed={markAbnormal}
                    />
                  )}
                </TabsContent>
              );
              })}
            </Tabs>
          </section>
          <section className="space-y-4" data-testid="publish-auxiliary-fold">
            <details
              className="rounded-xl border border-gray-200 bg-white shadow-sm"
              data-testid="publish-account-client-fold"
            >
              <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-gray-800">
                账号与客户端
              </summary>
              <div className="space-y-4 border-t border-gray-100 p-5">
                <details className="rounded-lg border border-gray-100" data-testid="publish-platform-accounts-fold">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-800">账号环境</summary>
                  <div className="space-y-4 border-t border-gray-100 p-4">
                    {selectedProjectId ? <PlatformStatusOverview projectId={selectedProjectId} /> : null}
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

                <details className="rounded-lg border border-gray-100" data-testid="publish-local-agent-download-fold">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-800">下载客户端</summary>
                  <div className="space-y-4 border-t border-gray-100 p-4">
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

                <details className="rounded-lg border border-gray-100" data-testid="publish-advanced-diagnostics-fold">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-800">诊断日志</summary>
                  <div className="space-y-4 border-t border-gray-100 p-4">
                    <LocalAgentPublishStepsPanel projectId={selectedProjectId} />
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
                  </div>
                </details>

                <details className="rounded-lg border border-gray-100" data-testid="publish-success-rate-fold">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-800">平台成功率</summary>
                  <div className="border-t border-gray-100 p-4">
                    {selectedProjectId ? <PlatformPublishSuccessRatePanel projectId={selectedProjectId} /> : null}
                  </div>
                </details>

                <details className="rounded-lg border border-gray-100" data-testid="publish-calendar-fold">
                  <summary
                    className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-800"
                    data-testid="publish-calendar-tab"
                  >
                    发布日历
                  </summary>
                  <div className="border-t border-gray-100 p-4">
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

                <details className="rounded-lg border border-gray-100" data-testid="publish-manual-register-fold">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-800">人工登记发布记录</summary>
                  <div className="border-t border-gray-100 p-4">
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
