import { AiStatusBadge } from "@/components/ai/ProductUi";
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
import PlatformContentStrategyPanel from "@/components/PlatformContentStrategyPanel";
import { PlatformContentBoard, type PlatformBoardRow } from "@/components/weekly/PlatformContentBoard";
import {
  WeeklyPlatformArticleCard,
  resolveQualityDisplay,
  type WeeklyArticleCardModel,
} from "@/components/weekly/WeeklyPlatformArticleCard";
import { P0Card } from "@/components/geo/P0UiPrimitives";
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
import { buildProjectUrl } from "@/lib/activeProject";
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
  generationBasis?: Record<string, unknown> | null;
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
  return useActiveProjectSelection();
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
  const { selectedProjectId, selectedProject, projectInput, enabled, projectsLoading } = useProjectSelection();

  const tasksQuery = trpc.geo.tasks.list.useQuery(projectInput, { enabled });
  const questionsQuery = trpc.geo.questions.list.useQuery(projectInput, { enabled });
  const analysisQuery = trpc.geo.analysis.list.useQuery(projectInput, { enabled });
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
  const [platformStrategy, setPlatformStrategy] = useState<PlatformContentStrategyInput>(() =>
    buildDefaultPlatformStrategy(),
  );

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
  const targetQuestionOptions = useMemo(() => {
    const fromQuestions = (questionsQuery.data ?? [])
      .map((q: { questionText?: string }) => q.questionText?.trim())
      .filter(Boolean) as string[];
    const fromTasks = tasks.map(t => t.taskName?.trim()).filter(Boolean) as string[];
    return Array.from(new Set([...fromQuestions, ...fromTasks]));
  }, [questionsQuery.data, tasks]);

  useEffect(() => {
    if (!platformStrategy.targetQuestion.trim() && targetQuestionOptions[0]) {
      setPlatformStrategy(prev => ({ ...prev, targetQuestion: targetQuestionOptions[0]! }));
    }
  }, [targetQuestionOptions, platformStrategy.targetQuestion]);

  const platformStrategyError = useMemo(
    () => validatePlatformContentStrategy(platformStrategy),
    [platformStrategy],
  );

  const latestDiagnosisGap = useMemo(() => {
    const rows = (analysisQuery.data ?? []) as Array<{ contentGap?: string | null }>;
    return rows.map(r => r.contentGap?.trim()).find(Boolean) ?? null;
  }, [analysisQuery.data]);

  const hasDiagnosisData = useMemo(() => {
    if (tasks.length > 0) return true;
    return Boolean(latestDiagnosisGap);
  }, [tasks.length, latestDiagnosisGap]);
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
      const strategyErr = validatePlatformContentStrategy(platformStrategy);
      if (strategyErr) {
        toast.error(strategyErr);
        return false;
      }
      setGeneratingTopicIds(prev => new Set(prev).add(topicId));
      try {
        await generateArticleMutation.mutateAsync({
          topicId,
          targetPublishPlatform: platformStrategy.targetPublishPlatform,
          contentStrategyType: platformStrategy.contentStrategyType,
          publishIdentity: platformStrategy.publishIdentity,
          recommendedAccountGroup: platformStrategy.recommendedAccountGroup,
          targetQuestion: platformStrategy.targetQuestion.trim(),
          geoEnhancementGoal: platformStrategy.geoEnhancementGoal,
          targetAiPlatforms: [...platformStrategy.targetAiPlatforms],
        });
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
    [generateArticleMutation, invalidateArticles, platformStrategy],
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
    if (platformStrategyError) {
      toast.error(platformStrategyError);
      return;
    }
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

  const platformBoardRows = useMemo((): PlatformBoardRow[] => {
    return WEEKLY_PLATFORM_DEFS.map(def => {
      const counts: PlatformContentCounts = {
        pending: 0,
        pendingConfirm: 0,
        ready: 0,
        published: 0,
      };
      for (const topic of topics) {
        const task = tasks.find(t => t.id === topic.optimizationTaskId);
        const card = parseGeoTaskCard(task?.executionSuggestion ?? null);
        const article = articleByTopicId.get(topic.id);
        const platformKey = article
          ? normalizeWeeklyPlatformKey(article.targetPlatform)
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
      return { def, counts };
    });
  }, [topics, tasks, articleByTopicId, scoresByArticleId]);

  const contentCardModels = useMemo((): WeeklyArticleCardModel[] => {
    return articles
      .filter(a => typeof a.topicId === "number")
      .map(a => {
        const topic = topics.find(t => t.id === a.topicId);
        const task = topic ? tasks.find(t => t.id === topic.optimizationTaskId) : undefined;
        const card = parseGeoTaskCard(task?.executionSuggestion ?? null);
        const q = scoresByArticleId.get(a.id);
        const pass = qualityPasses(a, q);
        const published = a.status === "已发布";
        const ps = a.generationBasis?.platformContentStrategy as Record<string, unknown> | undefined;
        const keywords = Array.isArray(ps?.targetAiPlatforms)
          ? (ps.targetAiPlatforms as string[]).filter(x => typeof x === "string")
          : [];
        return {
          id: a.id,
          title: a.title ?? topic?.title ?? "未命名内容",
          targetPlatform:
            typeof ps?.targetPublishPlatformLabel === "string"
              ? ps.targetPublishPlatformLabel
              : a.targetPlatform,
          contentGoal:
            typeof platformStrategy.geoEnhancementGoal === "string"
              ? platformStrategy.geoEnhancementGoal
              : null,
          geoGap: latestDiagnosisGap ?? card?.keyPoints?.[0] ?? topic?.businessReason?.slice(0, 120) ?? null,
          keywords,
          statusLabel: published ? "已发布" : pass ? "可发布" : "待确认",
          statusTone: published ? "success" : pass ? "info" : "warning",
          qualityDisplay: resolveQualityDisplay(a),
          strategySummary: formatArticleStrategySummary(a),
          lifecycle: a.lifecycle,
          postPublish: a.postPublish,
          article: a as Record<string, unknown>,
        };
      });
  }, [articles, topics, tasks, scoresByArticleId, latestDiagnosisGap, platformStrategy.geoEnhancementGoal]);

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
    const publishSlug = resolvePublishSlugForWeeklyPlatform(normalizeWeeklyPlatformKey(article.targetPlatform));
    setSelectedPlatforms(publishSlug ? new Set([publishSlug]) : new Set());
    setSelectedPublishAccountIds({});
    void refreshLocalAgentHealth();
    setPublishDialogOpen(true);
  };

  const handlePlatformGenerate = (platformKey: WeeklyPlatformKey) => {
    const publishId = resolvePublishSlugForWeeklyPlatform(platformKey);
    if (publishId) {
      setPlatformStrategy(prev => ({ ...prev, targetPublishPlatform: publishId }));
    }
    const def = WEEKLY_PLATFORM_DEFS.find(d => d.key === platformKey)!;
    const pending = topics.find(t => {
      if (articleByTopicId.has(t.id)) return false;
      const task = tasks.find(row => row.id === t.optimizationTaskId);
      const card = parseGeoTaskCard(task?.executionSuggestion ?? null);
      return matchTopicToPlatform(card?.recommendedPlatform ?? [], def.label);
    });
    if (!pending) {
      toast.message(`${def.label} 暂无待生成方向，请先完成 AI 诊断或切换平台`);
      return;
    }
    void generateOne(pending.id);
  };

  const handlePlatformView = (platformKey: WeeklyPlatformKey) => {
    const hit = articles.find(a => normalizeWeeklyPlatformKey(a.targetPlatform) === platformKey);
    if (hit) openEditor(hit);
    else toast.message("该平台暂无已生成内容，请先点击「生成本轮平台化内容」");
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
      selectedProjectId && setLocation(buildProjectUrl("/enterprise-profile", selectedProjectId) + "#platform-accounts");
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
          selectedProjectId && setLocation(buildProjectUrl("/enterprise-profile", selectedProjectId) + "#platform-accounts");
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

  if (!enabled && !projectsLoading) {
    return (
      <div data-testid="weekly-platform-content-page">
        <ProjectContextEmptyState />
      </div>
    );
  }

  const publishDialogSlug =
    publishArticle && selectedPlatforms.size === 1 ? Array.from(selectedPlatforms)[0]! : null;

  return (
    <div className="space-y-8 pb-12" data-testid="weekly-platform-content-page">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">平台化内容资产</h1>
        <p className="text-sm text-gray-500">
          根据 AI 实测缺口，按平台生成可发布、可监测、可复测的 GEO 内容资产。各平台独立生成，不支持一稿多发。
        </p>
      </header>

      {tasksQuery.isError || topicsQuery.isError || articlesQuery.isError ? (
        <p className="text-sm text-red-700">暂时无法加载，请刷新重试</p>
      ) : !queriesReady || preparingTopics || generateTopicsMutation.isPending ? (
        <div className="flex flex-col items-center gap-3 py-16 text-slate-500">
          <Spinner className="size-6 text-blue-600" />
          <p className="text-sm">正在加载平台化内容生产数据…</p>
        </div>
      ) : showDiagnosisEmpty ? (
        <P0Card testId="weekly-no-diagnosis">
          <p className="text-sm leading-relaxed text-gray-700">
            暂无 AI 实测诊断结果。建议先完成 AI 实测诊断，再根据缺口生成平台化内容资产。
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
          <P0Card testId="weekly-round-goal">
            <p className={geoP0Surfaces.sectionTitle}>本轮内容目标</p>
            <p className="mt-2 text-sm text-slate-800">
              {platformStrategy.geoEnhancementGoal || "覆盖目标搜索问题，提升品牌提及与 AI 推荐概率"}
            </p>
            {platformStrategy.targetQuestion.trim() ? (
              <p className="mt-2 text-sm text-slate-600">
                <span className="font-medium text-slate-500">关联问题：</span>
                {platformStrategy.targetQuestion.trim()}
              </p>
            ) : null}
          </P0Card>

          <P0Card testId="weekly-strategy-source">
            <p className={geoP0Surfaces.sectionTitle}>内容策略来源</p>
            <p className="mt-2 text-sm text-slate-700">最近一次 AI 诊断</p>
            {latestDiagnosisGap ? (
              <p className="mt-2 text-sm text-slate-600" data-testid="diagnosis-gap-preview">
                {latestDiagnosisGap}
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-500">诊断任务已就绪，缺口说明将随诊断结果展示</p>
            )}
          </P0Card>

          {platformStrategyError ? <p className="text-sm text-amber-800">{platformStrategyError}</p> : null}

          <PlatformContentBoard
            rows={platformBoardRows}
            disabled={anyGenerating}
            onGenerate={handlePlatformGenerate}
            onView={handlePlatformView}
          />

          {showDirectionEmpty ? (
            <P0Card>
              <p className="text-sm text-slate-700">正在根据 AI 诊断准备内容方向，请稍候…</p>
            </P0Card>
          ) : null}

          {contentCardModels.length > 0 ? (
            <section className="space-y-4" data-testid="weekly-content-cards">
              <h2 className={geoP0Surfaces.sectionTitle}>已生成内容</h2>
              <p className={geoP0Surfaces.muted}>按平台独立管理；无真实质检分时不展示评分。</p>
              <div className="grid gap-4 lg:grid-cols-2">
                {contentCardModels.map(model => {
                  const article = articles.find(a => a.id === model.id);
                  const topicId = article?.topicId;
                  return (
                    <WeeklyPlatformArticleCard
                      key={model.id}
                      model={model}
                      disabled={anyGenerating}
                      onView={() => article && openEditor(article)}
                      onRegenerate={() => {
                        if (typeof topicId === "number") void generateOne(topicId);
                      }}
                      onEnqueuePublish={() => article && openPublishDialog(article)}
                    />
                  );
                })}
              </div>
            </section>
          ) : null}

          <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-slate-800">
              内容策略细项（可选，按单平台调整）
            </summary>
            <div className="border-t border-slate-100 p-4">
              <PlatformContentStrategyPanel
                value={platformStrategy}
                onChange={setPlatformStrategy}
                targetQuestionOptions={targetQuestionOptions}
                disabled={anyGenerating}
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
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                客户端状态：
                {localAgentOnline === true ? (
                  <AiStatusBadge tone="success">已连接</AiStatusBadge>
                ) : localAgentOnline === false ? (
                  <AiStatusBadge tone="warning">未连接</AiStatusBadge>
                ) : (
                  <span className="text-gray-400">检测中…</span>
                )}
              </p>
            </div>
            {publishArticle && !hasGeoQualityReview(publishArticle) ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                当前内容尚未进行发布前质检，建议先质检后发布。
              </p>
            ) : null}
            {publishArticle && isGeoQualityScoreStale(publishArticle) ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {GEO_QUALITY_STALE_PUBLISH_HINT}
              </p>
            ) : null}
            {publishArticle &&
            !isGeoQualityScoreStale(publishArticle) &&
            publishArticle.geoQualityRecommendation === "revise" ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                内容有优化空间，确认后可继续发布。
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
            {publishDialogSlug ? (
              PUBLISH_PLATFORMS.filter(p => p.slug === publishDialogSlug).map(p => {
              const readyAccounts = isBindingPublishPlatform(p.slug) ? getPublishReadyAccountsForPlatform(p.slug) : [];
              const legacyAccounts = isBindingPublishPlatform(p.slug)
                ? getAllEnabledAccountsForPlatform(p.slug).filter(
                    a => a.isEnabled && !isPublishReadyAccount(a),
                  )
                : [];
              const picked = isBindingPublishPlatform(p.slug) ? pickPublishAccount(p.slug) : null;
              const needsPick = readyAccounts.length > 1 && !picked;
              return (
                <div key={p.slug} className="flex flex-col gap-2 rounded-lg border border-gray-200 px-3 py-2">
                  <span className="text-sm font-medium">{p.label}</span>
                  {isBindingPublishPlatform(p.slug) ? (
                    <div className="space-y-2">
                      {readyAccounts.length === 0 ? (
                        <span className="text-xs text-amber-600">无可发布账号（需绑定本地环境且登录有效）</span>
                      ) : readyAccounts.length === 1 ? (
                        <span className="text-xs text-gray-600">
                          发布账号：{readyAccounts[0]!.accountName} · 登录有效
                        </span>
                      ) : (
                        <>
                          <span className="text-xs text-gray-500">选择发布账号（必选）</span>
                          <select
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
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
                                {a.accountName}
                              </option>
                            ))}
                          </select>
                          {picked ? (
                            <span className="text-xs text-gray-600">
                              已选账号：{picked.accountName}
                            </span>
                          ) : null}
                        </>
                      )}
                      {legacyAccounts.length > 0 ? (
                        <p className="text-xs text-amber-600">
                          {legacyAccounts.length} 个旧账号需在企业档案重新绑定本地客户端后方可发布。
                        </p>
                      ) : null}
                      {needsPick ? (
                        <span className="text-xs text-red-600">该平台有多个可发布账号，请选择后再发布</span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="pl-7 text-xs text-gray-500">
                      {isBindingPublishPlatform(p.slug) && readyAccounts.length === 1
                        ? `可发布账号：${readyAccounts[0]!.accountName}`
                        : isBindingPublishPlatform(p.slug) && readyAccounts.length > 1
                          ? `${readyAccounts.length} 个可发布账号`
                          : isBindingPublishPlatform(p.slug)
                            ? "暂无可发布账号"
                            : "无需绑定平台账号"}
                    </span>
                  )}
                </div>
              );
            })
            ) : (
              <p className="text-sm text-gray-400">暂未识别本篇发布平台</p>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {Array.from(selectedPlatforms).some(
              slug => isBindingPublishPlatform(slug) && getPublishReadyAccountsForPlatform(slug).length === 0,
            ) ? (
              <Button
                type="button"
                variant="outline"
                className="w-full border-amber-500 text-amber-700"
                onClick={() => {
                  setPublishDialogOpen(false);
                  selectedProjectId && setLocation(buildProjectUrl("/enterprise-profile", selectedProjectId) + "#platform-accounts");
                }}
              >
                去绑定账号
              </Button>
            ) : null}
            <div className="flex w-full gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setPublishDialogOpen(false)}>
                取消
              </Button>
              <Button
                type="button"
                className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                disabled={createPublishTask.isPending || selectedPlatforms.size === 0}
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
