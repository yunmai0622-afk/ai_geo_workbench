import {
  AiEmptyState,
  AiMetricCard,
  AiPageHero,
  AiPageShell,
  AiSection,
  AiStatusBadge,
} from "@/components/ai/ProductUi";
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
import { trpc } from "@/lib/trpc";
import { GEO_ARTICLE_MIN_PASS_SCORE } from "@shared/const";
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
};

type QualityScoreRow = {
  articleId?: number;
  totalScore: number;
  blocked?: number | boolean | null;
};

const GEO_TASK_CARD_MARK = "__GEO_TASK_CARD__";
const EXTENSION_HINT_KEY = "weekly-publish-extension-hint-dismissed";

const PUBLISH_PLATFORMS = [
  { slug: "zhihu" as const, label: "知乎" },
  { slug: "toutiao" as const, label: "头条号" },
  { slug: "sohu" as const, label: "搜狐号" },
  { slug: "baijiahao" as const, label: "百家号" },
  { slug: "wechat" as const, label: "微信公众号" },
];

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

export default function WeeklyContentPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { projects, selectedProjectId, setSelectedProjectId, projectInput, enabled } = useProjectSelection();

  const tasksQuery = trpc.geo.tasks.list.useQuery(projectInput, { enabled });
  const topicsQuery = trpc.geo.articles.topics.list.useQuery(projectInput, { enabled });
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const scoresQuery = trpc.geo.articles.latestQualityScores.useQuery(projectInput, { enabled });

  const generateTopicsMutation = trpc.geo.articles.topics.generate.useMutation();
  const generateArticleMutation = trpc.geo.articles.generate.useMutation();
  const createPublishTask = trpc.publishTasks.create.useMutation();
  const downloadExtension = trpc.publishTasks.downloadExtension.useMutation();

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
  const [showExtensionHint, setShowExtensionHint] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(EXTENSION_HINT_KEY) !== "1";
  });
  const [publishToolsOpen, setPublishToolsOpen] = useState(false);

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

  const openPublishDialog = (article: ArticleRow) => {
    setPublishArticle(article);
    setSelectedPlatforms(new Set());
    setPublishDialogOpen(true);
  };

  const togglePlatform = (slug: string) => {
    setSelectedPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
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

        const allDone = tracked.every(t => t.status === "completed" || t.status === "failed");
        if (!allDone) continue;

        await invalidateArticles();

        const ok = tracked.filter(t => t.status === "completed");
        const failed = tracked.filter(t => t.status === "failed");
        if (ok.length > 0) {
          toast.success(
            ok.length === tracked.length
              ? "发布成功，文章已标记为已发布"
              : `${ok.length} 个平台发布成功，${failed.length} 个失败`,
          );
        } else {
          toast.error(failed[0]?.errorMessage || "发布失败，请稍后重试");
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
    const articleId = publishArticle.id;
    const taskIds: number[] = [];
    try {
      for (const slug of Array.from(selectedPlatforms)) {
        const res = await createPublishTask.mutateAsync({
          articleId,
          platform: slug as (typeof PUBLISH_PLATFORMS)[number]["slug"],
          projectId: selectedProjectId,
        });
        taskIds.push(res.taskId);
      }
      toast.success("已提交发布任务，插件发布中…");
      setPublishDialogOpen(false);
      setPublishArticle(null);
      void pollPublishTasksUntilDone(articleId, taskIds);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建发布任务失败");
    }
  };

  const dismissExtensionHint = () => {
    localStorage.setItem(EXTENSION_HINT_KEY, "1");
    setShowExtensionHint(false);
  };

  const handleDownloadExtension = async () => {
    try {
      const result = await downloadExtension.mutateAsync();
      const binary = atob(result.dataBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("插件已下载，请在 Chrome 扩展程序页面加载");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "下载插件失败，请稍后重试");
    }
  };

  return (
    <AiPageShell>
      <AiPageHero
        title="内容资产生产"
        description="围绕目标问题批量生成可用于 AI 搜索优化的内容资产。"
        badge="资产生产台"
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
                    <h3
                      className={`mt-2 line-clamp-2 text-base font-semibold leading-snug ${isPublished ? "text-slate-400" : "text-white"}`}
                      role={isGenerated ? "button" : undefined}
                      tabIndex={isGenerated ? 0 : undefined}
                      onClick={() => {
                        if (isGenerated && article) toggleExpand(topic.id);
                      }}
                      onKeyDown={e => {
                        if (isGenerated && article && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          toggleExpand(topic.id);
                        }
                      }}
                    >
                      {topic.title}
                    </h3>
                  </div>

                  <div className="flex flex-1 flex-col gap-3 px-4 py-3">
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
                              disabled={createPublishTask.isPending}
                              onClick={() => openPublishDialog(article)}
                            >
                              发布到平台
                            </Button>
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
        <details
          className="ai-glass-panel border-white/8 bg-slate-950/30 text-sm opacity-90"
          open={publishToolsOpen}
          onToggle={e => setPublishToolsOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer list-none px-4 py-3 font-medium text-slate-400 hover:text-slate-200 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <span className="text-cyan-500/80">▸</span>
              发布辅助工具
            </span>
          </summary>
          <div className="space-y-3 border-t border-white/8 px-4 pb-4 pt-2">
            <p className="text-xs text-slate-500">用于辅助交付人员把内容发布到外部平台。</p>
            <p className="text-xs text-slate-500">
              下载插件后，在 Chrome 扩展程序页面加载；再在各平台完成登录即可配合「发布到平台」使用。
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/12 text-slate-300"
                disabled={downloadExtension.isPending}
                onClick={() => void handleDownloadExtension()}
              >
                {downloadExtension.isPending ? "正在打包…" : "下载插件"}
              </Button>
              {showExtensionHint ? (
                <button type="button" className="text-xs text-slate-500 hover:text-slate-300" onClick={dismissExtensionHint}>
                  不再提示
                </button>
              ) : null}
            </div>
            {showExtensionHint ? (
              <p className="text-xs text-slate-600">
                流程：下载插件 → Chrome 扩展程序 → 开发者模式 → 加载已解压 → 连接各平台登录。
              </p>
            ) : null}
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer text-slate-500 hover:text-slate-400">插件更新日志</summary>
              <ul className="mt-2 space-y-1 pl-3">
                <li>v2.2 · 等待发布按钮可点击后再操作</li>
                <li>v2.0 · 正文粘贴兼容性提升</li>
              </ul>
            </details>
          </div>
        </details>
      ) : null}

      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="border-white/10 bg-slate-950 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>选择发布平台</DialogTitle>
            <DialogDescription className="text-slate-400">
              {publishArticle?.title ?? "当前文章"} · 确认后将加入插件发布队列
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {PUBLISH_PLATFORMS.map(p => (
              <label key={p.slug} className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5">
                <input
                  type="checkbox"
                  className="size-4 accent-cyan-400"
                  checked={selectedPlatforms.has(p.slug)}
                  onChange={() => togglePlatform(p.slug)}
                />
                <span className="text-sm">{p.label}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="border-white/15" onClick={() => setPublishDialogOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
              disabled={createPublishTask.isPending || selectedPlatforms.size === 0}
              onClick={() => void handleConfirmPublish()}
            >
              {createPublishTask.isPending ? "提交中..." : "确认发布"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AiPageShell>
  );
}
