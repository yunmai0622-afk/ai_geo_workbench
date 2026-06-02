import { FirstUseHintBanner } from "@/components/FirstUseHintBanner";
import { LocalAgentDownloadCard } from "@/components/LocalAgentDownloadCard";
import { ArticleAssetEditorSheet } from "@/components/ArticleAssetEditorSheet";
import { PlatformPublishSuccessRatePanel } from "@/components/publishing/PlatformPublishSuccessRatePanel";
import { PublishPlatformAccountsOverview } from "@/components/platformAccounts/PublishPlatformAccountsOverview";
import { LocalAccountBindingGuideCard } from "@/components/publishing/LocalAccountBindingGuideCard";
import { LocalAgentStatusCard } from "@/components/publishing/LocalAgentStatusCard";
import { LocalAgentPublishStepsPanel } from "@/components/publishing/LocalAgentPublishStepsPanel";
import { PublishWeeklyOverviewBar } from "@/components/publishing/PublishWeeklyOverviewBar";
import { PublishPlatformCardGrid } from "@/components/publishing/PublishPlatformCardGrid";
import { PublishActionSidePanel } from "@/components/publishing/PublishActionSidePanel";
import { PublishSuccessNotificationCard } from "@/components/publishing/PublishSuccessNotificationCard";
import { publishPlatformCustomerLabel } from "@/lib/publishCenterDisplay";
import { PublishRecordsCalendar } from "@/components/publishing/PublishRecordsCalendar";
import { PublishAccountSessionAlert } from "@/components/publishing/PublishAccountSessionAlert";
import { PublishRecordsListPanel } from "@/components/publishing/PublishRecordsListPanel";
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
import { usePublishAccountHealthCheck } from "@/hooks/usePublishAccountHealthCheck";
import { buildProjectUrl } from "@/lib/activeProject";
import { FIRST_USE_HINT_KEYS } from "@/lib/firstUseHints";
import { recordPublicLink, publishStatusLabel } from "@/lib/assetProgressDisplay";
import { downloadPublishRecordsCsv } from "@/lib/geoDataExportDownload";
import { formatPublishedAtLabel } from "@/lib/deliveryReportDisplay";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import {
  fetchLocalAgentDownloadManifest,
  pickLocalAgentDownloadHref,
} from "@/lib/localAgentDownloadManifest";
import { checkLocalAgentHealth } from "@/lib/localAgentClient";
import { isLocalAgentClientOutdated } from "@shared/localAgentVersionCompare";
import {
  mapAgentTaskToCard,
  mapManualRecordToCard,
  type PublishTaskCardModel,
} from "@/lib/publishCenterDisplay";
import { trpc } from "@/lib/trpc";
import { GEO_ARTICLE_MIN_PASS_SCORE } from "@shared/const";
import {
  buildPublishPagePlatformCards,
  buildWeeklyPublishOverviewStats,
  type PublishPagePlatformCard,
} from "@shared/publishPageLayout";
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
  agentFinishedAt?: Date | string | number | null;
  agentPickedAt?: Date | string | number | null;
  createdAt?: Date | string | number | null;
  retryCount?: number | null;
  canRetry?: boolean;
  retryExhausted?: boolean;
};

type QueueTabKey = "pending" | "active" | "failed" | "completed";

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

function queueTabFromCard(card: PublishTaskCardModel): QueueTabKey {
  if (
    card.statusRaw === "failed" ||
    card.statusRaw === "publish_failed" ||
    card.statusRaw === "session_expired" ||
    card.retryExhausted
  ) {
    return "failed";
  }
  if (
    card.statusRaw === "pending" ||
    card.statusRaw === "pending_agent" ||
    card.statusRaw === "copied"
  ) {
    return "pending";
  }
  if (
    card.statusRaw === "agent_processing" ||
    card.statusRaw === "processing" ||
    card.statusRaw === "manual_required" ||
    card.statusRaw === "draft_saved"
  ) {
    return "active";
  }
  return "completed";
}

export function ContentPublishingCenterPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { selectedProjectId, selectedProject, projectInput, enabled, projectsLoading } =
    useActiveProjectSelection();

  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const scoresQuery = trpc.geo.articles.latestQualityScores.useQuery(projectInput, { enabled });
  const publishRecordsQuery = trpc.geo.publishRecords.listWithStatus.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const autoPublishTasksQuery = trpc.publishTasks.listRecentByProject.useQuery(
    { projectId: selectedProjectId!, limit: 30 },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
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
  const createPublishTask = trpc.publishTasks.create.useMutation();
  const [manualArticleId, setManualArticleId] = useState<number | "">("");
  const [manualPlatform, setManualPlatform] = useState<ManualPublishPlatform>("知乎");
  const [manualLink, setManualLink] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  const [localAgentOnline, setLocalAgentOnline] = useState<boolean | null>(null);
  const [localAgentClientVersion, setLocalAgentClientVersion] = useState<string | null>(null);
  const [manifestVersion, setManifestVersion] = useState<string | null>(null);
  const [manifestDownloadHref, setManifestDownloadHref] = useState<string | null>(null);
  const [checkingAgent, setCheckingAgent] = useState(false);
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

  const articles = filterListWithNumericId(articlesQuery.data ?? []) as ArticleRow[];
  const scores = (scoresQuery.data ?? []) as QualityScoreRow[];
  const publishableArticles = useMemo(
    () => articles.filter(a => isQualityPassed(articleLatestQuality(a?.id, scores))),
    [articles, scores],
  );
  const publishRecords = filterListWithNumericId(publishRecordsQuery.data ?? []) as PublishRecordRow[];
  const agentTasks = filterListWithNumericId(autoPublishTasksQuery.data?.tasks ?? []) as AgentTaskRow[];
  const articleById = useMemo(() => new Map(articles.map(a => [a?.id, a])), [articles]);

  const hasInFlightAgentTasks = useMemo(
    () =>
      agentTasks.some(
        t =>
          t.status !== "completed" &&
          t.status !== "failed" &&
          t.status !== "draft_saved" &&
          t.status !== "session_expired" &&
          t.status !== "manual_required",
      ),
    [agentTasks],
  );

  useEffect(() => {
    completedAgentTaskIdsRef.current = new Set();
    completedAgentTasksInitializedRef.current = false;
    setPublishSuccessNotice(null);
  }, [selectedProjectId]);

  useEffect(() => {
    const completedIds = agentTasks.filter(t => t.status === "completed").map(t => t?.id);
    if (!completedAgentTasksInitializedRef.current) {
      completedIds.forEach(id => completedAgentTaskIdsRef.current.add(id));
      completedAgentTasksInitializedRef.current = true;
      return;
    }
    const newlyCompleted = completedIds.filter(id => !completedAgentTaskIdsRef.current.has(id));
    if (newlyCompleted.length > 0) {
      newlyCompleted.forEach(id => completedAgentTaskIdsRef.current.add(id));
      const tasks = agentTasks.filter(t => t?.id != null && newlyCompleted.includes(t?.id));
      setPublishSuccessNotice({
        platformLabel: formatPublishSuccessPlatformPhrase(
          tasks.map(t => publishPlatformCustomerLabel(t.platform)),
        ),
        articleUrl: resolvePublishSuccessArticleUrl(tasks.map(t => t.resultUrl)),
      });
    }
  }, [agentTasks]);

  useEffect(() => {
    if (!enabled || !hasInFlightAgentTasks) return;
    const timer = setInterval(() => {
      void autoPublishTasksQuery.refetch();
    }, 3000);
    return () => clearInterval(timer);
  }, [enabled, hasInFlightAgentTasks, autoPublishTasksQuery]);

  const autoInclusionByArticleAndUrl = useMemo(() => {
    const keys = new Set<string>();
    for (const row of inclusionMonitoringQuery.data ?? []) {
      const articleId = typeof row.articleId === "number" ? row.articleId : null;
      const url = typeof row.publicUrl === "string" ? row.publicUrl.trim() : "";
      if (articleId && url) keys.add(`${articleId}:${url}`);
    }
    return keys;
  }, [inclusionMonitoringQuery.data]);

  const { checking: accountHealthChecking, agentOnline: accountHealthAgentOnline, runCheck: runAccountHealthCheck } =
    usePublishAccountHealthCheck(selectedProjectId ?? null, enabled);

  const refreshAgentHealth = useCallback(async () => {
    setCheckingAgent(true);
    try {
      const h = await checkLocalAgentHealth({ force: true });
      setLocalAgentOnline(h?.ok ?? false);
      setLocalAgentClientVersion(h?.version?.trim() ? h.version.trim() : null);
      await runAccountHealthCheck({ detectSessions: true });
      if (!h?.ok && selectedProjectId) {
        await utils.geo.platformAccounts.list.invalidate({ projectId: selectedProjectId });
      }
    } catch {
      setLocalAgentOnline(false);
      setLocalAgentClientVersion(null);
    } finally {
      setCheckingAgent(false);
    }
  }, [runAccountHealthCheck, selectedProjectId, utils.geo.platformAccounts.list]);

  useEffect(() => {
    if (!enabled) return;
    const h = checkLocalAgentHealth();
    void h.then(health => {
      setLocalAgentOnline(health?.ok ?? false);
      setLocalAgentClientVersion(health?.version?.trim() ? health.version.trim() : null);
    });
  }, [enabled, selectedProjectId]);

  useEffect(() => {
    if (accountHealthAgentOnline != null) {
      setLocalAgentOnline(accountHealthAgentOnline);
    }
  }, [accountHealthAgentOnline]);

  useEffect(() => {
    if (!enabled) return;
    void fetchLocalAgentDownloadManifest().then(manifest => {
      const version = manifest?.version?.trim();
      setManifestVersion(version || null);
      setManifestDownloadHref(pickLocalAgentDownloadHref(manifest));
    });
  }, [enabled]);

  useEffect(() => {
    if (publishableArticles.length === 0) {
      setManualArticleId("");
      return;
    }
    const current = typeof manualArticleId === "number" ? manualArticleId : undefined;
    if (current == null || !publishableArticles.some(a => a?.id === current)) {
      setManualArticleId(publishableArticles[0]?.id ?? "");
    }
  }, [publishableArticles, manualArticleId]);

  useEffect(() => {
    setLinkDraftById(prev => {
      const next = { ...prev };
      for (const r of publishRecords) {
        const url = recordPublicLink(r);
        const recordId = r?.id;
        if (recordId == null) continue;
        if (next[recordId] === undefined) next[recordId] = url;
      }
      return next;
    });
  }, [publishRecords]);

  const platformAccountGroups = platformAccountsQuery.data?.accounts ?? [];

  const boundPlatformCount = useMemo(() => {
    return platformAccountGroups.filter(g => (g.accounts ?? []).some((a: { isEnabled: boolean }) => a.isEnabled))
      .length;
  }, [platformAccountGroups]);
  const availableAccountByPlatform = useMemo(() => {
    return platformAccountGroups
      .map(group => {
        const count = (group.accounts ?? []).filter((a: { isEnabled: boolean }) => a.isEnabled).length;
        return `${publishPlatformCustomerLabel(group.platform)} ${count} 个`;
      })
      .filter(Boolean);
  }, [platformAccountGroups]);

  const taskCards = useMemo(() => {
    const cards: PublishTaskCardModel[] = agentTasks.map(task => {
      const article = articleById.get(task.articleId);
      const basis = article?.generationBasis?.platformContentStrategy as Record<string, unknown> | undefined;
      const goal =
        typeof basis?.geoEnhancementGoal === "string"
          ? basis.geoEnhancementGoal
          : typeof article?.generationBasis?.geoEnhancementGoal === "string"
            ? (article.generationBasis.geoEnhancementGoal as string)
            : null;
      const publishedUrl = task.resultUrl?.trim() || "";
      const autoInclusionMonitoring =
        task.status === "completed" &&
        Boolean(publishedUrl) &&
        autoInclusionByArticleAndUrl.has(`${task.articleId}:${publishedUrl}`);
      return mapAgentTaskToCard(task, goal, { autoInclusionMonitoring });
    });
    for (const record of publishRecords) {
      const article = record.articleId ? articleById.get(record.articleId) : undefined;
      const mapped = mapManualRecordToCard(record, article?.title);
      if (mapped) cards.push(mapped);
    }
    return cards;
  }, [agentTasks, publishRecords, articleById, autoInclusionByArticleAndUrl]);

  const queueTabs = useMemo(() => {
    const out: Record<QueueTabKey, PublishTaskCardModel[]> = {
      pending: [],
      active: [],
      failed: [],
      completed: [],
    };
    for (const card of taskCards) {
      out[queueTabFromCard(card)].push(card);
    }
    return out;
  }, [taskCards]);

  const pendingCount = queueTabs.pending.length;
  const failedCount = queueTabs.failed.length;

  const qualityByArticleId = useMemo(() => {
    const map = new Map<number, QualityScoreRow>();
    for (const score of scores) {
      if (typeof score.articleId === "number") map.set(score.articleId, score);
    }
    return map;
  }, [scores]);

  const weeklyOverviewStats = useMemo(
    () =>
      buildWeeklyPublishOverviewStats({
        articles,
        qualityByArticleId,
        minPassScore: GEO_ARTICLE_MIN_PASS_SCORE,
        publishRecords,
        publishTasks: agentTasks,
      }),
    [articles, qualityByArticleId, publishRecords, agentTasks],
  );

  const platformCards = useMemo(
    () =>
      buildPublishPagePlatformCards({
        articles,
        qualityByArticleId,
        minPassScore: GEO_ARTICLE_MIN_PASS_SCORE,
        publishRecords,
        publishTasks: agentTasks,
        accountGroups: platformAccountGroups,
      }),
    [articles, qualityByArticleId, publishRecords, agentTasks, platformAccountGroups],
  );

  const readyPlatformCount = useMemo(
    () => platformCards.filter(card => card.canPublish).length,
    [platformCards],
  );

  const localAgentUpdateNotice = useMemo(() => {
    if (
      !localAgentOnline ||
      !localAgentClientVersion ||
      !manifestVersion ||
      !manifestDownloadHref ||
      !isLocalAgentClientOutdated(localAgentClientVersion, manifestVersion)
    ) {
      return null;
    }
    return {
      clientVersion: localAgentClientVersion,
      manifestVersion,
      downloadHref: manifestDownloadHref,
    };
  }, [
    localAgentOnline,
    localAgentClientVersion,
    manifestVersion,
    manifestDownloadHref,
  ]);

  const loading =
    articlesQuery.isLoading || scoresQuery.isLoading || publishRecordsQuery.isLoading || autoPublishTasksQuery.isLoading;

  async function handleSaveRowLink(recordId: number) {
    if (!selectedProjectId) return;
    const record = publishRecords.find(r => r?.id === recordId);
    if (!record?.articleId) return;
    const article = articleById.get(record.articleId);
    const channel = (record.publishChannel || "").trim();
    if (!channel) {
      toast.error("该记录缺少平台信息，无法更新链接。");
      return;
    }
    const draft = (linkDraftById[recordId] ?? "").trim();
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
      toast.success("链接已更新");
    } catch (e) {
      toast.error(toUserFacingErrorFromUnknown(e, "更新链接失败"));
    } finally {
      setSavingRowId(null);
    }
  }

  function openPreview(card: PublishTaskCardModel) {
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

  function startLocalPublish(card: PublishTaskCardModel) {
    if (localAgentOnline === false) {
      toast.error("Local Agent 未连接，请先下载并启动客户端");
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
    toast.error(card.errorMessage || card.statusLabel || "发布异常，请查看状态说明或联系交付同学");
  }

  async function enqueuePlatformCard(card: PublishPagePlatformCard): Promise<boolean> {
    if (!selectedProjectId || !card.articleId) return false;
    const slug = resolveEnqueuePlatformSlug(card);
    if (!slug) {
      toast.message(`${card.label} 需人工发布，请复制素材后登记发布记录`);
      return false;
    }
    if (localAgentOnline === false) {
      toast.error("Local Agent 未连接，请先下载并启动客户端");
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
        toast.error("发布任务未走本地客户端，请联系交付同学检查配置");
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
    if (localAgentOnline === false) {
      toast.error("Local Agent 未连接，请先下载并启动客户端");
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
    const articleId = typeof manualArticleId === "number" ? manualArticleId : undefined;
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

  function handleExportPublishRecordsCsv() {
    if (loading) {
      toast.message("发布记录加载中，请稍后再导出");
      return;
    }
    const rows = publishRecords.map(record => {
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
          <h1 className="text-2xl font-bold text-gray-900">平台适配发布</h1>
          <p className="text-sm text-gray-500">
            通过 Local Agent 在本地完成发布，降低登录、验证码和平台风控风险。按平台独立发布，需人工确认，不支持自动发布或一稿多发。
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

      <FirstUseHintBanner
        storageKey={FIRST_USE_HINT_KEYS.contentPublishing}
        message="发布前请确保本地客户端已启动并连接"
        data-testid="first-use-hint-content-publishing"
      />

      {selectedProjectId ? (
        <PublishAccountSessionAlert
          projectId={selectedProjectId}
          groups={platformAccountGroups}
          checking={accountHealthChecking}
          agentOnline={accountHealthAgentOnline ?? localAgentOnline}
          onAfterRelogin={() => void runAccountHealthCheck({ detectSessions: true })}
        />
      ) : null}

      {selectedProjectId ? (
        <PublishWeeklyOverviewBar stats={weeklyOverviewStats} loading={loading} />
      ) : null}

      <PublishSuccessNotificationCard
        visible={Boolean(publishSuccessNotice)}
        platformLabel={publishSuccessNotice?.platformLabel ?? ""}
        articleUrl={publishSuccessNotice?.articleUrl}
        onDismiss={() => setPublishSuccessNotice(null)}
      />

      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList className="grid w-full max-w-2xl grid-cols-3 print:hidden">
          <TabsTrigger value="tasks" data-testid="publish-center-tab-tasks">
            发布任务
          </TabsTrigger>
          <TabsTrigger value="records" data-testid="publish-center-tab-records">
            发布记录
          </TabsTrigger>
          <TabsTrigger value="calendar" data-testid="publish-calendar-tab">
            发布日历
          </TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-0">
          <PublishRecordsListPanel
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
            onViewAllHistory={() =>
              selectedProjectId &&
              setLocation(buildProjectUrl("/publish-records-history", selectedProjectId))
            }
          />
        </TabsContent>

        <TabsContent value="calendar" className="mt-0">
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
        </TabsContent>

        <TabsContent value="tasks" className="mt-0">
      {loading ? (
        <div className="flex items-center gap-2 py-12 text-gray-500">
          <Spinner className="size-5 text-blue-600" />
          正在加载发布任务…
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="publish-ready-status-module">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">发布准备状态</h2>
                <p className="mt-1 text-xs text-gray-500">先确认客户端与账号，再推进任务队列。</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className={geoP0Brand.primaryOutline}
                onClick={() => void refreshAgentHealth()}
                disabled={checkingAgent || accountHealthChecking}
                data-testid="publish-ready-refresh"
              >
                刷新状态
              </Button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Local Agent</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {localAgentOnline ? "已连接" : "未连接"}
                </p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs text-gray-500">可用账号</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {availableAccountByPlatform.length > 0 ? availableAccountByPlatform.join(" / ") : "暂无可用账号"}
                </p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs text-gray-500">待发布任务数</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{pendingCount}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs text-gray-500">失败任务数</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{failedCount}</p>
              </div>
            </div>
            <div className="mt-4">
              <LocalAgentStatusCard
                status={{
                  connected: localAgentOnline,
                  browserReady: localAgentOnline,
                  boundPlatformCount: platformAccountsQuery.isLoading ? null : boundPlatformCount,
                  pendingTaskCount: autoPublishTasksQuery.isLoading ? null : pendingCount,
                }}
                checking={checkingAgent || accountHealthChecking}
                onRefresh={() => void refreshAgentHealth()}
                updateNotice={localAgentUpdateNotice}
              />
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="publish-task-queue-module">
            <h2 className="text-base font-semibold text-gray-900">发布任务队列</h2>
            <p className="mt-1 text-xs text-gray-500">按队列状态处理任务，优先清理失败与待确认任务。</p>
            <Tabs defaultValue="pending" className="mt-4 space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="pending" data-testid="publish-queue-tab-pending">待发布</TabsTrigger>
                <TabsTrigger value="active" data-testid="publish-queue-tab-active">发布中/待确认</TabsTrigger>
                <TabsTrigger value="failed" data-testid="publish-queue-tab-failed">失败</TabsTrigger>
                <TabsTrigger value="completed" data-testid="publish-queue-tab-completed">已完成</TabsTrigger>
              </TabsList>
              {(["pending", "active", "failed", "completed"] as const).map(tab => (
                <TabsContent key={tab} value={tab} className="mt-0">
                  {queueTabs[tab].length === 0 ? (
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                      暂无任务
                    </div>
                  ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {queueTabs[tab].map(card => (
                        <div key={card.key} className="rounded-xl border border-gray-200 bg-white p-4" data-testid={`publish-queue-card-${card.key}`}>
                          <div className="flex items-start justify-between gap-3">
                            <p className="line-clamp-2 text-sm font-semibold text-gray-900">{card.title}</p>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${card.statusBadgeClass}`}>
                              {card.statusLabel}
                            </span>
                          </div>
                          <dl className="mt-3 space-y-1.5 text-xs text-gray-600">
                            <div className="flex gap-2"><dt className="text-gray-500">发布平台</dt><dd>{card.platformLabel}</dd></div>
                            <div className="flex gap-2"><dt className="text-gray-500">账号状态</dt><dd>{card.accountLabel}</dd></div>
                            <div className="flex gap-2"><dt className="text-gray-500">任务状态</dt><dd>{card.statusLabel}</dd></div>
                            <div className="flex gap-2"><dt className="text-gray-500">失败原因</dt><dd>{card.errorMessage ?? "无"}</dd></div>
                          </dl>
                          <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                            <Button type="button" size="sm" variant="outline" className={geoP0Brand.primaryOutline} onClick={() => openPreview(card)}>预览</Button>
                            {tab === "pending" ? (
                              <Button type="button" size="sm" className={geoP0Brand.primary} onClick={() => startLocalPublish(card)}>开始发布</Button>
                            ) : null}
                            {card.canRetry && card.taskId ? (
                              <Button type="button" size="sm" className={geoP0Brand.primary} onClick={() => void handleRetryPublishTask(card)} disabled={retryingTaskId === card.taskId}>
                                {retryingTaskId === card.taskId ? "重试中…" : "重试"}
                              </Button>
                            ) : null}
                            {card.recordId ? (
                              <>
                                <Input
                                  className="h-8 min-w-[180px] flex-1 text-xs"
                                  placeholder="公开链接"
                                  value={linkDraftById[card.recordId] ?? ""}
                                  onChange={e => setLinkDraftById(d => ({ ...d, [card.recordId!]: e.target.value }))}
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className={geoP0Brand.primaryOutline}
                                  disabled={savingRowId === card.recordId}
                                  onClick={() => void handleSaveRowLink(card.recordId!)}
                                >
                                  {savingRowId === card.recordId ? "保存中…" : "填链接"}
                                </Button>
                              </>
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

          <section className="space-y-4" data-testid="publish-config-help-module">
            <h2 className="text-base font-semibold text-gray-900">发布配置与帮助</h2>
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
                  localAgentOnline={localAgentOnline}
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
              <div className="border-t border-gray-100 p-5">
                <LocalAgentDownloadCard />
              </div>
            </details>

            <details className="rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="publish-retest-rewrite-fold">
              <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-gray-800">
                发布后复测 · 重写池
              </summary>
              <div className="grid gap-4 border-t border-gray-100 p-5 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium text-gray-800">待复测队列</h3>
                  {(retestQueueQuery.data?.items ?? []).length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">暂无待复测内容</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm text-gray-700">
                      {(retestQueueQuery.data?.items ?? []).map(item => (
                        <li key={item.queueId ?? item.articleId} className="rounded-lg border border-gray-100 p-3">
                          <p className="font-medium">{item.title}</p>
                          {selectedProjectId && item.queueId ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={`mt-2 ${geoP0Brand.primaryOutline}`}
                              disabled={triggerReview.isPending}
                              onClick={() =>
                                void triggerReview.mutateAsync({
                                  projectId: selectedProjectId,
                                  queueId: item.queueId,
                                })
                              }
                            >
                              手动触发复测
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-800">重写池</h3>
                  {(rewritePoolQuery.data?.items ?? []).length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">暂无待重写条目</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm text-gray-700">
                      {(rewritePoolQuery.data?.items ?? []).map(item => (
                        <li
                          key={`${item.articleId}-${item.poolId ?? 0}`}
                          className="rounded-lg border border-gray-100 p-3"
                        >
                          <p className="font-medium">{item.title}</p>
                          <p className="mt-1 text-xs text-gray-500">{item.reason}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </details>

            <details className="rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="publish-manual-register-fold">
              <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-gray-800">
                人工登记发布记录（可选）
              </summary>
              <div className="space-y-4 border-t border-gray-100 p-5 text-sm text-gray-600">
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
                        value={String(manualArticleId)}
                        onValueChange={v => setManualArticleId(Number(v))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择文章" />
                        </SelectTrigger>
                        <SelectContent>
                          {publishableArticles.map(a => (
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
                <p className="text-gray-500">
                  已登记记录请在上方「发布记录」标签页查看；超过 30 条时可使用「查看全部历史」按时间筛选。
                </p>
              </div>
            </details>
            <LocalAgentPublishStepsPanel projectId={selectedProjectId} />
          </section>
        </div>
      )}
        </TabsContent>
      </Tabs>

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
