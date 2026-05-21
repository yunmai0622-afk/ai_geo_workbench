import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function scoreBadgeClass(score: number) {
  if (score >= 80) return "border-emerald-400/50 bg-emerald-400/10 text-emerald-200";
  if (score >= 60) return "border-amber-400/50 bg-amber-400/10 text-amber-200";
  return "border-rose-400/50 bg-rose-400/10 text-rose-200";
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
  const [batchState, setBatchState] = useState<{ current: number; total: number } | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishArticle, setPublishArticle] = useState<ArticleRow | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(() => new Set());
  const [showExtensionHint, setShowExtensionHint] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(EXTENSION_HINT_KEY) !== "1";
  });

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
      .mutateAsync({ projectId: selectedProjectId! })
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

  const handleBatchGenerate = async () => {
    if (pendingTopicIds.length === 0) return;
    const total = pendingTopicIds.length;
    setBatchState({ current: 0, total });
    let done = 0;
    for (let i = 0; i < pendingTopicIds.length; i++) {
      const topicId = pendingTopicIds[i]!;
      setBatchState({ current: i + 1, total });
      const ok = await generateOne(topicId);
      if (ok) done += 1;
    }
    setBatchState(null);
    if (done === total) toast.success(`本周 ${done} 篇文章已生成`);
  };

  const batchBusy = batchState !== null;
  const anyGenerating = batchBusy || generatingTopicIds.size > 0 || generateArticleMutation.isPending;
  const batchDone = !batchBusy && pendingTopicIds.length === 0 && topics.length > 0 && topics.every(t => articleByTopicId.has(t.id));

  const estMinutesRemaining = batchState ? Math.max(1, Math.ceil((batchState.total - batchState.current + 1) * 2)) : 0;

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
    <div className="relative mx-auto max-w-5xl pb-32 pt-2 text-slate-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">本周内容</h1>
          <p className="mt-1 text-sm text-slate-500">按诊断建议生成文章，复制后到平台发布</p>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <label className="text-xs text-slate-500">当前项目</label>
          <select
            value={selectedProjectId ?? ""}
            onChange={e => setSelectedProjectId(Number(e.target.value) || undefined)}
            className="h-10 min-w-[200px] rounded-xl border border-white/10 bg-slate-900/90 px-3 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <option value="">请选择项目</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.enterpriseName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm">
        <p className="font-medium text-slate-100">浏览器发布插件</p>
        <p className="mt-1 text-xs text-slate-400">
          下载插件后，在 Chrome 扩展程序页面加载，安装即自动配置完成；再在各平台完成登录即可自动发布。
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-cyan-400/40 text-cyan-100 hover:bg-cyan-400/10"
            disabled={downloadExtension.isPending}
            onClick={() => void handleDownloadExtension()}
          >
            {downloadExtension.isPending ? "正在打包…" : "下载插件"}
          </Button>
          {showExtensionHint ? (
            <button type="button" className="text-xs text-slate-500 hover:text-slate-300" onClick={dismissExtensionHint}>
              收起说明
            </button>
          ) : null}
        </div>
        {showExtensionHint ? (
          <p className="mt-2 text-xs text-slate-500">
            流程：下载插件 → Chrome 扩展程序 → 开发者模式 → 加载已解压 → 连接各平台登录 → 本页「发布到平台」。
          </p>
        ) : null}
        <div className="mt-4 border-t border-white/5 pt-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-cyan-400/10 px-2 py-0.5 text-xs font-medium text-cyan-200 ring-1 ring-inset ring-cyan-400/20">v1.8.0</span>
            <span className="text-xs text-slate-500">BUILD: bg-v18-textarea-draftjs</span>
          </div>
          <details className="mt-2 text-xs text-slate-400">
            <summary className="cursor-pointer text-slate-300 hover:text-cyan-200">更新日志</summary>
            <ul className="mt-2 space-y-1.5 pl-3">
              <li className="flex gap-2"><span className="shrink-0 text-cyan-400/70">v1.8</span><span>标题用 textarea、正文 click+focus 后 insertText，提升填充稳定性</span></li>
              <li className="flex gap-2"><span className="shrink-0 text-cyan-400/70">v1.7</span><span>知乎正文改用 Draft.js insertText 填充，解决内容丢失问题</span></li>
              <li className="flex gap-2"><span className="shrink-0 text-cyan-400/70">v1.6</span><span>编辑器适配修复，精简 shared.js 发布逻辑</span></li>
              <li className="flex gap-2"><span className="shrink-0 text-cyan-400/70">v1.5</span><span>知乎封面图改用 UploadPicture-input 选择器上传</span></li>
              <li className="flex gap-2"><span className="shrink-0 text-cyan-400/70">v1.4</span><span>知乎发布改回单步点击，精简弹窗确认逻辑</span></li>
              <li className="flex gap-2"><span className="shrink-0 text-cyan-400/70">v1.3</span><span>插件目录重命名，新增发布弹窗确认流程</span></li>
              <li className="flex gap-2"><span className="shrink-0 text-cyan-400/70">v1.2</span><span>封面图经 background 下载解决跨域，增强知乎上传逻辑</span></li>
              <li className="flex gap-2"><span className="shrink-0 text-cyan-400/70">v1.1</span><span>封面图改用内置 Forge API 生成，无需额外 API Key</span></li>
              <li className="flex gap-2"><span className="shrink-0 text-cyan-400/70">v1.0</span><span>修复知乎发布 URL 404，适配 zhuanlan.zhihu.com/write</span></li>
            </ul>
          </details>
        </div>
      </div>

      <p className="mt-6 text-sm text-slate-300">
        本周已生成 <span className="font-medium text-white">{weeklyArticles.length}</span> 篇 · 已发布{" "}
        <span className="font-medium text-white">{publishedCount}</span> 篇 · 覆盖{" "}
        <span className="font-medium text-white">{sceneCount}</span> 个问题场景
      </p>

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
        <div className="mt-16 rounded-3xl border border-white/10 bg-slate-900/60 p-10 text-center">
          <p className="text-base text-slate-200">还没有内容诊断数据，请先运行内容诊断</p>
          <Button type="button" className="mt-6 bg-cyan-400 text-slate-950 hover:bg-cyan-300" onClick={() => setLocation("/ai-diagnosis")}>
            去诊断
          </Button>
        </div>
      ) : showDirectionEmpty ? (
        <div className="mt-16 rounded-3xl border border-white/10 bg-slate-900/60 p-10 text-center">
          <p className="text-base font-medium text-slate-200">还没有内容方向建议</p>
          <p className="mt-2 text-sm text-slate-400">先运行内容诊断，系统会自动为你生成本周内容方向</p>
          <Button type="button" className="mt-6 bg-cyan-400 text-slate-950 hover:bg-cyan-300" onClick={() => setLocation("/ai-diagnosis")}>
            去运行内容诊断 →
          </Button>
        </div>
      ) : topics.length === 0 ? (
        <p className="mt-10 text-sm text-slate-400">暂无选题</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
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

            return (
              <div
                key={topic.id}
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
                className={`flex flex-col rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-left shadow-inner transition ${
                  isPublished ? "opacity-75" : ""
                } ${isGenerated ? "cursor-pointer hover:border-white/20" : ""}`}
                style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-white/15 text-slate-200">
                    {meta.contentType}
                  </Badge>
                  {isGenerated && q ? (
                    <>
                      <Badge variant="outline" className={scoreBadgeClass(q.totalScore)}>
                        {q.totalScore} 分
                      </Badge>
                      <Badge variant="outline" className={pass ? "border-emerald-400/40 text-emerald-200" : "border-amber-400/40 text-amber-200"}>
                        {pass ? "通过" : "未通过"}
                      </Badge>
                    </>
                  ) : null}
                  {isPublished ? (
                    <Badge variant="outline" className="border-emerald-400/50 bg-emerald-400/10 text-emerald-200">
                      ✓ 已发布
                    </Badge>
                  ) : null}
                </div>

                <h3 className={`mt-3 line-clamp-2 text-base font-semibold leading-snug ${isPublished ? "text-slate-400" : "text-white"}`}>
                  {topic.title}
                </h3>

                {isPending || isGenerating ? (
                  meta.keyPoints.length > 0 ? (
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">{meta.keyPoints.join(" · ")}</p>
                  ) : null
                ) : null}

                <div className="mt-4 border-t border-white/10 pt-4">
                  {isPending ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-white/15 text-cyan-100 hover:bg-white/10"
                      disabled={anyGenerating}
                      onClick={e => {
                        e.stopPropagation();
                        handleGenerateOne(topic.id);
                      }}
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
                    <div className="space-y-3" onClick={e => e.stopPropagation()}>
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
                          className="border-white/15 text-cyan-100"
                          onClick={() => setLocation("/content-publishing")}
                        >
                          标记已发布
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-cyan-400/40 text-cyan-100 hover:bg-cyan-400/10"
                          disabled={createPublishTask.isPending}
                          onClick={() => openPublishDialog(article)}
                        >
                          发布到平台
                        </Button>
                      </div>
                      {expanded ? (
                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-400">{previewText(article.markdownContent)}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {isPublished ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-white/15 text-slate-300"
                      onClick={e => {
                        e.stopPropagation();
                        setLocation("/content-publishing");
                      }}
                    >
                      查看发布记录
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {enabled && topics.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-slate-950/95 px-4 py-4 backdrop-blur-md">
          <div className="mx-auto max-w-5xl">
            {batchBusy && batchState ? (
              <p className="mb-2 text-center text-xs text-slate-400">
                生成中（{batchState.current}/{batchState.total}）... 预计还需约 {estMinutesRemaining} 分钟
              </p>
            ) : batchDone ? (
              <p className="mb-2 text-center text-sm text-emerald-300">本周 {topics.length} 篇文章已生成 ✓</p>
            ) : null}
            <Button
              type="button"
              className="h-12 w-full rounded-xl bg-cyan-400 text-base font-medium text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
              disabled={pendingTopicIds.length === 0 || anyGenerating}
              onClick={() => void handleBatchGenerate()}
            >
              {batchBusy && batchState
                ? `生成中（${batchState.current}/${batchState.total}）...`
                : batchDone
                  ? `本周 ${topics.length} 篇文章已生成 ✓`
                  : `生成全部未生成文章（${pendingTopicIds.length}篇）`}
            </Button>
          </div>
        </div>
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
    </div>
  );
}
