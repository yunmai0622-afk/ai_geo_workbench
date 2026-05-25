import {
  AiEmptyState,
  AiMetricCard,
  AiPageHero,
  AiPageShell,
  AiSection,
  AiStatusBadge,
} from "@/components/ai/ProductUi";
import { ArticleAssetEditorSheet } from "@/components/ArticleAssetEditorSheet";
import { ArticleLifecyclePanel } from "@/components/ArticleLifecyclePanel";
import { Button } from "@/components/ui/button";
import { aiInput } from "@/lib/aiProductUi";
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
import { checkLocalAgentHealth } from "@/lib/localAgentClient";
import { trpc } from "@/lib/trpc";
import { LOCAL_AGENT_BASE_URL } from "@shared/localAgent";
import { GEO_ARTICLE_MIN_PASS_SCORE } from "@shared/const";
import {
  isBindingPublishPlatform,
  publishBlockedNoAccountMessage,
  publishBlockedNoLocalProfileMessage,
  publishBlockedSessionExpiredMessage,
  publishMustSelectAccountMessage,
} from "@shared/platformAccountVerify";
import { ARTICLE_UNSAVED_PUBLISH_BLOCK_MESSAGE } from "@shared/articleAssetDraft";
import { getGeoQualityLabel, type GeoQualityRecommendation } from "@shared/geoQualityReview";
import {
  GEO_QUALITY_STALE_PUBLISH_HINT,
  isGeoQualityScoreStale,
  shouldBlockPublishForGeoQuality,
} from "@shared/geoQualityStale";
import {
  ACCOUNT_GROUP_MISMATCH_HINT,
  accountGroupsMismatch,
  formatArticleStrategySummary,
  getAccountGroupLabel,
  getPublishIdentityLabel,
  isAccountGroupType,
} from "@shared/contentStrategy";
import { publishTaskStatusCustomerLabel } from "@shared/publishTaskErrors";
import { type resolveArticleLifecycleView } from "@shared/articleLifecycle";
import { isLegacyAiGeneratedCoverUrl, normalizeArticleCoverTemplateId } from "@shared/articleCoverTemplate";
import {
  DEFAULT_WEEKLY_GENERATION_COUNT,
  MAX_WEEKLY_GENERATION_COUNT,
  weeklyGenerationCountClientError,
} from "@shared/weeklyContentGeneration";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type ProjectOption = { id: number; enterpriseName: string };

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
  executionSuggestion?: string | null;
};

type ArticleRow = {
  id: number;
  topicId?: number | null;
  title?: string | null;
  markdownContent?: string | null;
  status?: string | null;
  createdAt?: Date | string | null;
  targetPlatform?: string | null;
  contentType?: string | null;
  coverTemplate?: string | null;
  coverBase64?: string | null;
  coverImageUrl?: string | null;
  geoQualityScore?: number | null;
  geoQualityRecommendation?: string | null;
  geoQualityStale?: boolean | number | null;
  contentStrategyType?: string | null;
  publishIdentity?: string | null;
  recommendedAccountGroup?: string | null;
  articleType?: string | null;
  lifecycleStatus?: string | null;
  lifecycleEvents?: unknown;
  publicPath?: string | null;
  lifecycle?: ReturnType<typeof resolveArticleLifecycleView>;
  postPublish?: {
    pendingReview?: boolean;
    needsRewrite?: boolean;
  };
};

function formatGeoQualitySummary(article: ArticleRow): string | null {
  if (article.geoQualityScore == null || !article.geoQualityRecommendation) return null;
  const label = getGeoQualityLabel(article.geoQualityRecommendation as GeoQualityRecommendation);
  const stale = isGeoQualityScoreStale(article) ? " · 待重新质检" : "";
  return `GEO 质量：${article.geoQualityScore} 分 · ${label}${stale}`;
}

function hasGeoQualityReview(article: ArticleRow): boolean {
  return article.geoQualityScore != null && article.geoQualityRecommendation != null;
}

type QualityScoreRow = {
  articleId?: number;
  totalScore: number;
  blocked?: number | boolean | null;
};

const GEO_TASK_CARD_MARK = "__GEO_TASK_CARD__";
const PUBLISH_PLATFORMS = [
  { slug: "zhihu" as const, label: "知乎" },
  { slug: "toutiao" as const, label: "头条号" },
  { slug: "sohu" as const, label: "搜狐号" },
  { slug: "baijiahao" as const, label: "百家号" },
];

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
  const { data: projects = [] } = trpc.geo.projects.list.useQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>();

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  const projectInput = useMemo(() => ({ projectId: selectedProjectId }), [selectedProjectId]);
  return { projects: projects as ProjectOption[], selectedProjectId, setSelectedProjectId, projectInput, enabled: Boolean(selectedProjectId) };
}

type ParsedTaskCard = {
  articleTitle: string;
  keyPoints: string[];
  recommendedPlatform: string[];
  contentType: string;
};

function parseGeoTaskCard(executionSuggestion?: string | null): ParsedTaskCard | null {
  if (!executionSuggestion?.includes(GEO_TASK_CARD_MARK)) return null;
  const parts = executionSuggestion.split(`${GEO_TASK_CARD_MARK}\n`);
  const jsonPart = parts[1]?.trim();
  if (!jsonPart) return null;
  try {
    const j = JSON.parse(jsonPart) as Record<string, unknown>;
    const keyPoints = Array.isArray(j.keyPoints)
      ? j.keyPoints.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map(x => x.trim())
      : [];
    const recommendedPlatform = Array.isArray(j.recommendedPlatform)
      ? j.recommendedPlatform.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map(x => x.trim())
      : [];
    const contentType = typeof j.contentType === "string" ? j.contentType.trim() : "";
    return {
      articleTitle: typeof j.articleTitle === "string" ? j.articleTitle : "",
      keyPoints,
      recommendedPlatform,
      contentType,
    };
  } catch {
    return null;
  }
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
  const card = parseGeoTaskCard(task?.executionSuggestion ?? null);
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
  const raw = (markdown ?? "").replace(/^#+\s*/gm, "").replace(/\*\*/g, "").trim();
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}…`;
}

async function copyText(label: string, text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`已复制${label}`);
  } catch {
    toast.error("复制失败，请手动选择复制");
  }
}

function articleCoverPreviewSrc(article: ArticleRow): string | null {
  if (article.coverBase64?.trim()) {
    const raw = article.coverBase64.trim();
    return raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`;
  }
  if (article.coverTemplate && article.coverImageUrl?.trim()) {
    const url = article.coverImageUrl.trim();
    if (url.startsWith("data:")) return url;
  }
  if (isLegacyAiGeneratedCoverUrl(article.coverImageUrl) && !article.coverTemplate) {
    return null;
  }
  return null;
}


export default function WeeklyContentPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { projects, selectedProjectId, setSelectedProjectId, projectInput, enabled } = useProjectSelection();

  const tasksQuery = trpc.geo.tasks.list.useQuery(projectInput, { enabled });
  const topicsQuery = trpc.geo.articles.topics.list.useQuery(projectInput, { enabled });
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const platformAccountsQuery = trpc.geo.platformAccounts.list.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );
  const scoresQuery = trpc.geo.articles.latestQualityScores.useQuery(projectInput, { enabled });

  const generateTopicsMutation = trpc.geo.articles.topics.generate.useMutation();
  const generateArticleMutation = trpc.geo.articles.generate.useMutation();
  const createPublishTask = trpc.publishTasks.create.useMutation();
  const updateGeneratedArticle = trpc.geo.articles.updateGeneratedArticle.useMutation();
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
  const [publishArticle, setPublishArticle] = useState<ArticleRow | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(() => new Set());
  const [localAgentOnline, setLocalAgentOnline] = useState<boolean | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorArticle, setEditorArticle] = useState<ArticleRow | null>(null);
  const [regeneratingCoverIds, setRegeneratingCoverIds] = useState<Set<number>>(() => new Set());
  const [unsavedArticleIds, setUnsavedArticleIds] = useState<Set<number>>(() => new Set());
  const [selectedPublishAccountIds, setSelectedPublishAccountIds] = useState<Record<string, number>>({});

  type PlatformAccountItem = {
    id: number;
    accountName: string;
    accountGroup: string | null;
    accountRole: string | null;
    isEnabled: boolean;
    localAgentId: string | null;
    localProfileId: string | null;
    sessionStatus: string | null;
    verificationStatus: string;
  };

  const isPublishReadyAccount = (a: PlatformAccountItem) =>
    a.isEnabled &&
    Boolean(a.accountName?.trim()) &&
    Boolean(a.localProfileId?.trim()) &&
    Boolean(a.localAgentId?.trim()) &&
    a.sessionStatus === "active";

  const refreshLocalAgentHealth = useCallback(async () => {
    const h = await checkLocalAgentHealth();
    setLocalAgentOnline(h?.ok ?? false);
    return h;
  }, []);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
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

  const pickPublishAccount = useCallback(
    (slug: string): PlatformAccountItem | null => {
      const ready = getPublishReadyAccountsForPlatform(slug);
      if (ready.length === 0) return null;
      const selectedId = selectedPublishAccountIds[slug];
      if (selectedId) return ready.find(a => a.id === selectedId) ?? null;
      if (ready.length === 1) return ready[0]!;
      return null;
    },
    [getPublishReadyAccountsForPlatform, selectedPublishAccountIds],
  );

  const publishAccountGroupWarnings = useMemo(() => {
    if (!publishArticle?.recommendedAccountGroup || !isAccountGroupType(publishArticle.recommendedAccountGroup)) {
      return [] as Array<{ slug: string; platformLabel: string; message: string }>;
    }
    const recLabel = getAccountGroupLabel(publishArticle.recommendedAccountGroup);
    const out: Array<{ slug: string; platformLabel: string; message: string }> = [];
    for (const slug of Array.from(selectedPlatforms)) {
      const row = pickPublishAccount(slug);
      if (!row) continue;
      if (!accountGroupsMismatch(publishArticle.recommendedAccountGroup, row.accountGroup)) continue;
      const boundLabel = getAccountGroupLabel(row.accountGroup) || "未设置账号组";
      out.push({
        slug,
        platformLabel: PUBLISH_PLATFORMS.find(p => p.slug === slug)?.label ?? slug,
        message: ACCOUNT_GROUP_MISMATCH_HINT(recLabel, boundLabel),
      });
    }
    return out;
  }, [publishArticle, selectedPlatforms, pickPublishAccount]);

  const tasks = (tasksQuery.data ?? []) as TaskRow[];
  const topics = (topicsQuery.data ?? []) as TopicRow[];
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

  const queriesReady = enabled && !tasksQuery.isLoading && !topicsQuery.isLoading;
  const bothEmpty = queriesReady && tasks.length === 0 && topics.length === 0;
  const showDiagnosisEmpty = bothEmpty;
  const showDirectionEmpty = queriesReady && topics.length === 0 && tasks.length > 0 && !preparingTopics && !generateTopicsMutation.isPending;

  useEffect(() => {
    autoTopicsTriggeredRef.current = false;
    setPreparingTopics(false);
    setGeneratingTopicIds(new Set());
    setExpandedTopicIds(new Set());
    setBatchState(null);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!enabled || !queriesReady) return;
    if (autoTopicsTriggeredRef.current) return;
    if (topics.length > 0 || tasks.length === 0) return;

    autoTopicsTriggeredRef.current = true;
    setPreparingTopics(true);
    generateTopicsMutation
      .mutateAsync({ projectId: selectedProjectId!, generationCount: DEFAULT_WEEKLY_GENERATION_COUNT })
      .then(async () => {
        await topicsQuery.refetch();
      })
      .catch(() => {
        toast.error("准备内容建议失败，请稍后重试");
      })
      .finally(() => {
        setPreparingTopics(false);
      });
  }, [enabled, queriesReady, topics.length, tasks.length, selectedProjectId, generateTopicsMutation, topicsQuery]);

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
    async (topicId: number) => {
      setGeneratingTopicIds(prev => new Set(prev).add(topicId));
      try {
        await generateArticleMutation.mutateAsync({ topicId });
        await invalidateArticles();
        return true;
      } catch {
        toast.error("生成遇到问题，已跳过，继续生成下一篇");
        return false;
      } finally {
        setGeneratingTopicIds(prev => {
          const next = new Set(prev);
          next.delete(topicId);
          return next;
        });
      }
    },
    [generateArticleMutation, invalidateArticles],
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
    if (!selectedProjectId) return;
    const targetCount = resolveGenerationCount();
    if (targetCount == null) return;

    setBatchState({ current: 0, total: targetCount, target: targetCount });
    try {
      const topicResult = await generateTopicsMutation.mutateAsync({
        projectId: selectedProjectId,
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
        const ok = await generateOne(topicId);
        if (ok) done += 1;
      }
      const planned = topicResult?.count ?? targetCount;
      if (done === 0) {
        toast.error("本次未能成功生成内容，请稍后重试");
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

  const batchBusy = batchState !== null;
  const anyGenerating = batchBusy || generatingTopicIds.size > 0 || generateArticleMutation.isPending;
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

  function assetNextStepHint(status: "pending" | "generating" | "generated" | "published", pass: boolean): string {
    if (status === "pending") return "等待生成，可单独生成或批量生成";
    if (status === "generating") return "正在生成正文，请稍候";
    if (status === "published") return "已发布，可在发布记录补充公开链接";
    return pass ? "可复制内容并发布到外部平台" : "建议优化质量分后再发布";
  }

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
    if (isGeoQualityScoreStale(article)) {
      toast.message(GEO_QUALITY_STALE_PUBLISH_HINT);
    } else if (article.geoQualityRecommendation === "revise") {
      toast.message("内容有优化空间，确认后可继续发布");
    }
    setPublishArticle(article);
    setSelectedPlatforms(new Set());
    setSelectedPublishAccountIds({});
    void refreshLocalAgentHealth();
    setPublishDialogOpen(true);
  };

  useEffect(() => {
    if (!publishDialogOpen) return;
    void refreshLocalAgentHealth();
  }, [publishDialogOpen, refreshLocalAgentHealth]);

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
      toast.error(err instanceof Error ? err.message : "封面生成失败，可重试");
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
          setSelectedPublishAccountIds(p => ({ ...p, [slug]: ready[0]!.id }));
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
          toast.success(
            ok.length === tracked.length
              ? "发布成功，文章已标记为已发布"
              : `${ok.length} 个平台发布成功，${drafts.length} 个已存草稿，${failed.length} 个失败`,
          );
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
    if (isGeoQualityScoreStale(publishArticle)) {
      toast.message(GEO_QUALITY_STALE_PUBLISH_HINT);
    }
    const health = await refreshLocalAgentHealth();
    if (!health?.ok) {
      toast.error(
        "未检测到本地发布客户端。请先下载安装并启动本地发布客户端，然后到企业档案绑定发布账号。",
      );
      setLocation("/enterprise-profile#platform-accounts");
      return;
    }
    for (const slug of Array.from(selectedPlatforms)) {
      if (!isBindingPublishPlatform(slug)) continue;
      const ready = getPublishReadyAccountsForPlatform(slug);
      const allEnabled = getAllEnabledAccountsForPlatform(slug).filter(a => a.isEnabled);
      if (ready.length === 0) {
        if (allEnabled.some(a => !a.localProfileId?.trim() || !a.localAgentId?.trim())) {
          toast.error(
            `${publishBlockedNoLocalProfileMessage(slug)} 请先下载安装并启动本地发布客户端，然后到企业档案绑定发布账号。`,
          );
          setLocation("/enterprise-profile#platform-accounts");
          return;
        }
        if (allEnabled.some(a => a.sessionStatus !== "active")) {
          toast.error(publishBlockedSessionExpiredMessage(slug));
          return;
        }
        toast.error(publishBlockedNoAccountMessage(slug));
        return;
      }
      const picked = pickPublishAccount(slug);
      if (!picked) {
        toast.error(publishMustSelectAccountMessage(slug));
        return;
      }
    }
    if (!articleCoverPreviewSrc(publishArticle)) {
      toast.message("当前文章暂无封面，将先发布正文；可在「编辑内容」中生成封面后重试");
    }
    const articleId = publishArticle.id;
    const taskIds: number[] = [];
    try {
      for (const slug of Array.from(selectedPlatforms)) {
        const picked = pickPublishAccount(slug)!;
        const res = await createPublishTask.mutateAsync({
          articleId,
          platform: slug as (typeof PUBLISH_PLATFORMS)[number]["slug"],
          projectId: selectedProjectId,
          platformAccountId: picked.id,
        });
        taskIds.push(res.taskId);
        if (res.publishMode !== "local_agent") {
          toast.error("发布任务未走本地客户端，请联系交付同学检查配置");
          return;
        }
      }
      toast.success("发布任务已发送至本地客户端，请保持客户端运行。");
      setPublishDialogOpen(false);
      setPublishArticle(null);
      void pollPublishTasksUntilDone(articleId, taskIds);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建发布任务失败");
    }
  };

  return (
    <AiPageShell>
      <AiPageHero
        title="内容资产生产"
        description="围绕目标问题批量生成内容资产，编辑确认标题、正文与封面后再发布到外部平台。"
        badge="AI 内容资产编辑台"
      >
        <label className="text-xs text-slate-500">当前项目</label>
        <select
          value={selectedProjectId ?? ""}
          onChange={e => setSelectedProjectId(Number(e.target.value) || undefined)}
          className={`${aiInput} min-w-[200px]`}
        >
          <option value="">请选择项目</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.enterpriseName}
            </option>
          ))}
        </select>
      </AiPageHero>

      {enabled && queriesReady && !showDiagnosisEmpty && !showDirectionEmpty && topics.length > 0 ? (
        <>
          <section className="ai-console-panel space-y-6 rounded-2xl border border-cyan-400/20 p-5 md:p-6">
            <div>
              <h2 className="text-lg font-semibold text-white">AI 内容资产生产控制台</h2>
              <p className="mt-1 text-sm text-slate-400">
                选择生成数量，系统将围绕目标问题批量生成可发布的 AI 搜索资产。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <AiMetricCard label="当前任务方向数" value={String(tasks.length)} accent="violet" />
              <AiMetricCard label="本周已生成篇数" value={String(weeklyArticles.length)} accent="cyan" />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">生成数量</p>
              <div className="ai-segmented" role="group" aria-label="生成数量">
                {(["7", "14", "21", "custom"] as const).map(key => (
                  <button
                    key={key}
                    type="button"
                    disabled={anyGenerating}
                    data-active={countPreset === key}
                    onClick={() => {
                      setCountPreset(key);
                      setCountError(null);
                    }}
                    className="ai-segmented-item"
                  >
                    {key === "custom" ? "自定义" : `${key} 篇`}
                  </button>
                ))}
              </div>
              {countPreset === "custom" ? (
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={MAX_WEEKLY_GENERATION_COUNT}
                    value={customCount}
                    disabled={anyGenerating}
                    onChange={e => {
                      setCustomCount(e.target.value);
                      setCountError(weeklyGenerationCountClientError(e.target.value));
                    }}
                    className={`${aiInput} max-w-[8rem]`}
                    placeholder="1-50"
                  />
                  {countError ? <p className="text-xs text-amber-200">{countError}</p> : null}
                </div>
              ) : null}
            </div>
            {batchBusy && batchState ? (
              <p className="text-sm text-cyan-100">
                正在生成 {batchState.target} 篇内容（{batchState.current}/{batchState.total}）… 预计还需约 {estMinutesRemaining}{" "}
                分钟
              </p>
            ) : null}
            <Button
              type="button"
              variant="ai"
              className="h-12 w-full text-base disabled:opacity-50 sm:w-auto sm:min-w-[220px]"
              disabled={anyGenerating || (countPreset === "custom" && Boolean(countError)) || tasks.length === 0}
              onClick={() => void handleWeeklyGenerate()}
            >
              {batchBusy && batchState ? `正在生成 ${batchState.target} 篇内容…` : "生成内容资产"}
            </Button>
          </section>

          <AiSection title="本轮生产进度">
            {batchDone ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                <span className="text-emerald-300">✓</span>
                <span>本轮内容资产已生成完成</span>
              </div>
            ) : null}
            <div className="ai-progress-strip">
              <AiMetricCard
                label="本轮目标"
                value={displayTargetCount != null ? `${displayTargetCount} 篇` : "—"}
                accent="cyan"
              />
              <AiMetricCard label="已生成" value={`${generatedAssetCount} 篇`} accent="violet" />
              <AiMetricCard label="已发布" value={`${publishedAssetCount} 篇`} accent="emerald" />
              <AiMetricCard label="待发布" value={`${pendingPublishCount} 篇`} accent="amber" />
            </div>
          </AiSection>
        </>
      ) : null}

      {!enabled ? (
        <p className="mt-10 text-sm text-slate-400">请先选择项目</p>
      ) : tasksQuery.isError || topicsQuery.isError || articlesQuery.isError ? (
        <p className="mt-10 text-sm text-amber-100">暂时无法加载，请刷新重试</p>
      ) : !queriesReady || preparingTopics || generateTopicsMutation.isPending ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-slate-300">
          <Spinner className="size-6 text-cyan-400" />
          <p className="text-sm">正在准备本周内容建议...</p>
        </div>
      ) : showDiagnosisEmpty ? (
        <AiEmptyState
          title="当前暂无可生成内容任务"
          description="请先完成 AI 内容诊断，系统将基于品牌定位生成内容资产方向。"
          actionLabel="去完成内容诊断"
          onAction={() => setLocation("/ai-diagnosis")}
        />
      ) : showDirectionEmpty ? (
        <AiEmptyState
          title="当前暂无可生成内容任务"
          description="请先完成 AI 内容诊断，系统将基于品牌定位生成内容资产方向。"
          actionLabel="去完成内容诊断"
          onAction={() => setLocation("/ai-diagnosis")}
        />
      ) : topics.length === 0 ? (
        <p className="text-sm text-slate-400">暂无选题</p>
      ) : (
        <AiSection title="内容资产卡片区" description={`覆盖 ${sceneCount} 个问题场景 · 共 ${topics.length} 篇资产方向`}>
          <div className="grid gap-4 sm:grid-cols-2">
            {topics.map(topic => {
              const meta = topicMeta(topic, tasks);
              const article = articleByTopicId.get(topic.id);
              const isGenerating = generatingTopicIds.has(topic.id);
              const isPublished = article?.status === "已发布";
              const isGenerated = Boolean(article) && !isPublished;
              const isPending = !article && !isGenerating;
              const q = article ? scoresByArticleId.get(article.id) : undefined;
              const pass = article ? qualityPasses(article, q) : false;
              const expanded = expandedTopicIds.has(topic.id);
              const borderColor = contentTypeBorderColor(meta.contentType);
              const targetQuestion = meta.keyPoints[0] ?? topic.businessReason?.slice(0, 80) ?? "待关联目标问题";
              const statusKey = isPublished
                ? "published"
                : isGenerating
                  ? "generating"
                  : isGenerated
                    ? "generated"
                    : "pending";
              const statusLabel = isPublished ? "已发布" : isGenerating ? "生成中" : isGenerated ? "待发布" : "待生成";
              const statusTone = isPublished ? "success" : isGenerating ? "info" : isGenerated ? (pass ? "info" : "warning") : "neutral";

              return (
                <article
                  key={topic.id}
                  className={`ai-asset-card flex flex-col overflow-hidden ${isPublished ? "opacity-80" : ""}`}
                  style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}
                >
                  <div className="border-b border-white/8 bg-slate-950/40 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <AiStatusBadge tone={statusTone}>{statusLabel}</AiStatusBadge>
                      <span className="text-xs text-slate-500">{meta.contentType}</span>
                    </div>
                    <h3 className={`mt-2 line-clamp-2 text-base font-semibold leading-snug ${isPublished ? "text-slate-400" : "text-white"}`}>
                      {article?.title ?? topic.title}
                    </h3>
                    {isGenerated && article && formatGeoQualitySummary(article) ? (
                      <p className="mt-1 text-xs text-cyan-100/90">{formatGeoQualitySummary(article)}</p>
                    ) : null}
                    {isGenerated && article ? (
                      <p className="mt-1 text-xs text-violet-200/90" data-testid="article-strategy-summary">
                        {formatArticleStrategySummary(article)}
                      </p>
                    ) : null}
                    {isGenerated && article ? (
                      <div className="mt-2">
                        <ArticleLifecyclePanel articleId={article.id} article={article} lifecycle={article.lifecycle} compact />
                      </div>
                    ) : null}
                    {isGenerated && article && (article.postPublish?.pendingReview || article.postPublish?.needsRewrite) ? (
                      <div className="mt-2 flex flex-wrap gap-2" data-testid="article-post-publish-badges">
                        {article.postPublish?.pendingReview ? (
                          <span
                            className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100"
                            data-testid="badge-pending-review"
                          >
                            待复测
                          </span>
                        ) : null}
                        {article.postPublish?.needsRewrite ? (
                          <span
                            className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-100"
                            data-testid="badge-needs-rewrite"
                          >
                            需重写
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {isGenerated && article ? (
                    <div className="relative border-b border-white/8 bg-slate-900/50">
                      {articleCoverPreviewSrc(article) ? (
                        <img
                          src={articleCoverPreviewSrc(article)!}
                          alt=""
                          className="aspect-video w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-video flex-col items-center justify-center gap-2 px-4 text-center text-xs text-slate-500">
                          {isLegacyAiGeneratedCoverUrl(article.coverImageUrl) && !article.coverTemplate ? (
                            <span className="text-amber-200/80">旧版封面已隐藏，请重新生成模板封面</span>
                          ) : regeneratingCoverIds.has(article.id) ? (
                            <>
                              <Spinner className="size-5 text-cyan-400" />
                              <span>正在生成封面…</span>
                            </>
                          ) : (
                            <span>待生成封面</span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div className="flex flex-1 flex-col gap-3 px-4 py-3">
                    {isGenerated && article ? (
                      <p className="text-[10px] text-slate-500">
                        内容类型 · {mapContentTypeLabel(article.contentType ?? meta.contentType)}
                      </p>
                    ) : null}
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">目标问题</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">{targetQuestion}</p>
                    </div>
                    {isGenerated && q ? (
                      <p className="text-sm">
                        <span className="text-slate-500">内容评分 </span>
                        <span className={`font-semibold ${pass ? "text-emerald-300" : "text-amber-200"}`}>{q.totalScore} 分</span>
                        <span className="text-slate-600"> · </span>
                        <span className="text-xs text-slate-500">{pass ? "质量通过" : "建议优化"}</span>
                      </p>
                    ) : null}
                    <p className="text-xs text-cyan-200/80">{assetNextStepHint(statusKey, pass)}</p>

                    <div className="mt-auto space-y-2 border-t border-white/8 pt-3">
                      {isPending ? (
                        <Button
                          type="button"
                          variant="ai"
                          className="w-full"
                          disabled={anyGenerating}
                          onClick={() => handleGenerateOne(topic.id)}
                        >
                          生成这篇文章
                        </Button>
                      ) : null}
                      {isGenerating ? (
                        <div className="flex items-center justify-center gap-2 py-2 text-sm text-slate-400">
                          <Spinner className="size-4 text-cyan-400" />
                          生成中...
                        </div>
                      ) : null}
                      {isGenerated && article ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="ai" size="sm" className="w-full sm:w-auto" onClick={() => openEditor(article)}>
                              编辑内容
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-white/15 text-slate-200"
                              onClick={() => void copyText("标题", article.title ?? topic.title)}
                            >
                              复制标题
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-white/15 text-slate-200"
                              onClick={() => void copyText("正文", article.markdownContent ?? "")}
                            >
                              复制正文
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-white/15 text-slate-200"
                              disabled={regeneratingCoverIds.has(article.id) || updateGeneratedArticle.isPending}
                              onClick={() => void handleRegenerateCover(article)}
                            >
                              {regeneratingCoverIds.has(article.id) ? "生成中…" : "重新生成封面"}
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-white/15 text-slate-400"
                              onClick={() => setLocation("/content-publishing")}
                            >
                              标记已发布
                            </Button>
                            <Button
                              type="button"
                              variant="ai"
                              size="sm"
                              disabled={createPublishTask.isPending || shouldBlockPublishForGeoQuality(article)}
                              onClick={() => openPublishDialog(article)}
                            >
                              发布到平台
                            </Button>
                            {article.postPublish?.needsRewrite ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-amber-400/30 text-amber-100"
                                data-testid="btn-generate-rewrite-suggestion"
                                disabled={generateRewriteSuggestion.isPending || !selectedProjectId}
                                onClick={() => {
                                  if (!selectedProjectId) return;
                                  void generateRewriteSuggestion
                                    .mutateAsync({ projectId: selectedProjectId, articleId: article.id })
                                    .then(res => {
                                      setSuggestionDialog({
                                        open: true,
                                        text: res.suggestionText,
                                        articleTitle: article.title ?? "内容资产",
                                      });
                                      void utils.geo.articles.list.invalidate();
                                      void utils.geo.articles.rewritePool.invalidate();
                                    })
                                    .catch(e => toast.error(e instanceof Error ? e.message : "生成建议失败"));
                                }}
                              >
                                {generateRewriteSuggestion.isPending ? "生成中…" : "生成新版内容建议"}
                              </Button>
                            ) : null}
                          </div>
                          {expanded ? (
                            <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-500">{previewText(article.markdownContent)}</p>
                          ) : (
                            <button
                              type="button"
                              className="text-xs text-slate-500 hover:text-cyan-200"
                              onClick={() => toggleExpand(topic.id)}
                            >
                              展开正文预览
                            </button>
                          )}
                        </div>
                      ) : null}
                      {isPublished ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full border-white/15 text-slate-300"
                          onClick={() => setLocation("/content-publishing")}
                        >
                          查看发布记录
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </AiSection>
      )}

      {enabled ? (
        <div className="ai-glass-panel border-cyan-400/15 px-4 py-3 text-sm" data-testid="local-agent-publish-hint">
          <p className="font-medium text-cyan-100">本地发布客户端</p>
          <p className="mt-1 text-xs text-slate-400">
            发布任务将发送至本机 GEO 本地发布客户端（{LOCAL_AGENT_BASE_URL}）。请保持客户端运行并开启轮询；任务状态为「等待本地客户端处理」时表示已入队。
          </p>
          {localAgentOnline === false ? (
            <p className="mt-2 text-xs text-amber-200">当前未检测到客户端在线，发布将被阻断。</p>
          ) : null}
        </div>
      ) : null}

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
        />
      ) : null}

      <Dialog open={suggestionDialog.open} onOpenChange={open => setSuggestionDialog(s => ({ ...s, open }))}>
        <DialogContent className="border-white/10 bg-slate-950 text-slate-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新版内容建议</DialogTitle>
            <DialogDescription className="text-slate-400">{suggestionDialog.articleTitle}</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-200">
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
        <DialogContent className="border-white/10 bg-slate-950 text-slate-100 sm:max-w-md" data-testid="publish-to-platform-dialog">
          <DialogHeader>
            <DialogTitle>发布到平台</DialogTitle>
            <DialogDescription className="text-slate-400">
              {publishArticle?.title ?? "当前文章"} · 将使用已保存的最新标题、正文与封面（如有）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-50">
              <p>当前企业：{projectName}</p>
              <p className="mt-2 text-xs text-cyan-100/80">
                任务将发送至本地 GEO 发布客户端（{LOCAL_AGENT_BASE_URL}），由本机已绑定的平台账号环境执行填稿。
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                客户端状态：
                {localAgentOnline === true ? (
                  <AiStatusBadge tone="success">已连接</AiStatusBadge>
                ) : localAgentOnline === false ? (
                  <AiStatusBadge tone="warning">未连接</AiStatusBadge>
                ) : (
                  <span className="text-slate-400">检测中…</span>
                )}
              </p>
            </div>
            {publishArticle && !hasGeoQualityReview(publishArticle) ? (
              <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                当前内容尚未进行发布前质检，建议先质检后发布。
              </p>
            ) : null}
            {publishArticle && isGeoQualityScoreStale(publishArticle) ? (
              <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                {GEO_QUALITY_STALE_PUBLISH_HINT}
              </p>
            ) : null}
            {publishArticle &&
            !isGeoQualityScoreStale(publishArticle) &&
            publishArticle.geoQualityRecommendation === "revise" ? (
              <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                内容有优化空间，确认后可继续发布。
              </p>
            ) : null}
            {publishAccountGroupWarnings.map(w => (
              <p
                key={w.slug}
                className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-100"
                data-testid="account-group-mismatch-hint"
              >
                <span className="font-medium">{w.platformLabel}：</span>
                {w.message}
              </p>
            ))}
          </div>
          <div className="space-y-3 py-2">
            {PUBLISH_PLATFORMS.map(p => {
              const readyAccounts = isBindingPublishPlatform(p.slug) ? getPublishReadyAccountsForPlatform(p.slug) : [];
              const legacyAccounts = isBindingPublishPlatform(p.slug)
                ? getAllEnabledAccountsForPlatform(p.slug).filter(
                    a => a.isEnabled && !isPublishReadyAccount(a),
                  )
                : [];
              const picked = isBindingPublishPlatform(p.slug) ? pickPublishAccount(p.slug) : null;
              const needsPick = selectedPlatforms.has(p.slug) && readyAccounts.length > 1 && !picked;
              return (
                <label key={p.slug} className="flex cursor-pointer flex-col gap-2 rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="size-4 accent-cyan-400"
                      checked={selectedPlatforms.has(p.slug)}
                      onChange={() => togglePlatform(p.slug)}
                    />
                    <span className="text-sm font-medium">{p.label}</span>
                  </div>
                  {selectedPlatforms.has(p.slug) && isBindingPublishPlatform(p.slug) ? (
                    <div className="space-y-2 pl-7">
                      {readyAccounts.length === 0 ? (
                        <span className="text-xs text-amber-200">无可发布账号（需绑定本地环境且登录有效）</span>
                      ) : readyAccounts.length === 1 ? (
                        <span className="text-xs text-slate-500">
                          发布账号：{readyAccounts[0]!.accountName}
                          {readyAccounts[0]!.localProfileId
                            ? ` · ${readyAccounts[0]!.localProfileId.slice(0, 20)}`
                            : ""}
                          · 登录有效
                        </span>
                      ) : (
                        <>
                          <span className="text-xs text-slate-400">选择发布账号（必选）</span>
                          <select
                            className={aiInput}
                            value={selectedPublishAccountIds[p.slug] ?? ""}
                            onChange={e =>
                              setSelectedPublishAccountIds(prev => ({
                                ...prev,
                                [p.slug]: Number(e.target.value),
                              }))
                            }
                            onClick={e => e.stopPropagation()}
                          >
                            <option value="">请选择账号</option>
                            {readyAccounts.map(a => (
                              <option key={a.id} value={a.id}>
                                {a.accountName} · {a.localProfileId?.slice(0, 16) ?? "—"}
                              </option>
                            ))}
                          </select>
                          {picked ? (
                            <span className="text-xs text-slate-500">
                              profile：{picked.localProfileId} · 身份：
                              {getPublishIdentityLabel(picked.accountRole) || "未设置"} · 账号组：
                              {getAccountGroupLabel(picked.accountGroup) || "未设置"}
                            </span>
                          ) : null}
                        </>
                      )}
                      {legacyAccounts.length > 0 ? (
                        <p className="text-xs text-amber-200/90">
                          {legacyAccounts.length} 个旧账号需在企业档案重新绑定本地客户端后方可发布。
                        </p>
                      ) : null}
                      {needsPick ? (
                        <span className="text-xs text-red-300">该平台有多个可发布账号，请选择后再发布</span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="pl-7 text-xs text-slate-500">
                      {isBindingPublishPlatform(p.slug) && readyAccounts.length === 1
                        ? `可发布账号：${readyAccounts[0]!.accountName}`
                        : isBindingPublishPlatform(p.slug) && readyAccounts.length > 1
                          ? `${readyAccounts.length} 个可发布账号`
                          : isBindingPublishPlatform(p.slug)
                            ? "暂无可发布账号"
                            : "无需绑定平台账号"}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {Array.from(selectedPlatforms).some(
              slug => isBindingPublishPlatform(slug) && getPublishReadyAccountsForPlatform(slug).length === 0,
            ) ? (
              <Button
                type="button"
                variant="outline"
                className="w-full border-amber-400/30 text-amber-100"
                onClick={() => {
                  setPublishDialogOpen(false);
                  setLocation("/enterprise-profile#platform-accounts");
                }}
              >
                去绑定账号
              </Button>
            ) : null}
            <div className="flex w-full gap-2">
              <Button type="button" variant="outline" className="flex-1 border-white/15" onClick={() => setPublishDialogOpen(false)}>
                取消
              </Button>
              <Button
                type="button"
                className="flex-1 bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                disabled={createPublishTask.isPending || selectedPlatforms.size === 0}
                onClick={() => void handleConfirmPublish()}
              >
                {createPublishTask.isPending ? "提交中..." : "发布到平台"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AiPageShell>
  );
}
