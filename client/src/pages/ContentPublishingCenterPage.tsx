import { LocalAgentDownloadCard } from "@/components/LocalAgentDownloadCard";
import { ArticleAssetEditorSheet } from "@/components/ArticleAssetEditorSheet";
import { LocalAgentPublishStepsPanel } from "@/components/publishing/LocalAgentPublishStepsPanel";
import { LocalAgentStatusCard } from "@/components/publishing/LocalAgentStatusCard";
import { PublishTaskColumnBoard } from "@/components/publishing/PublishTaskColumnBoard";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
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
import { buildProjectUrl } from "@/lib/activeProject";
import { recordPublicLink, publishStatusLabel } from "@/lib/assetProgressDisplay";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import { checkLocalAgentHealth } from "@/lib/localAgentClient";
import {
  mapAgentTaskToCard,
  mapManualRecordToCard,
  type PublishColumnId,
  type PublishTaskCardModel,
} from "@/lib/publishCenterDisplay";
import { trpc } from "@/lib/trpc";
import { GEO_ARTICLE_MIN_PASS_SCORE } from "@shared/const";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type ArticleRow = {
  id: number;
  title?: string | null;
  markdownContent?: string | null;
  generationBasis?: Record<string, unknown> | null;
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
  agentErrorMessage?: string | null;
  draftUrl?: string | null;
  resultUrl?: string | null;
};

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
  const triggerReview = trpc.geo.articles.triggerReview.useMutation({
    onSuccess: () => void retestQueueQuery.refetch(),
  });
  const createManualPublishRecord = trpc.geo.articles.createManualPublishRecord.useMutation();
  const updateManualPublishRecord = trpc.geo.articles.updateManualPublishRecord.useMutation();
  const [manualArticleId, setManualArticleId] = useState<number | "">("");
  const [manualPlatform, setManualPlatform] = useState<ManualPublishPlatform>("知乎");
  const [manualLink, setManualLink] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  const [localAgentOnline, setLocalAgentOnline] = useState<boolean | null>(null);
  const [checkingAgent, setCheckingAgent] = useState(false);
  const [linkDraftById, setLinkDraftById] = useState<Record<number, string>>({});
  const [savingRowId, setSavingRowId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorArticle, setEditorArticle] = useState<ArticleRow | null>(null);

  const articles = (articlesQuery.data ?? []) as ArticleRow[];
  const scores = (scoresQuery.data ?? []) as QualityScoreRow[];
  const publishableArticles = useMemo(
    () => articles.filter(a => isQualityPassed(articleLatestQuality(a.id, scores))),
    [articles, scores],
  );
  const publishRecords = (publishRecordsQuery.data ?? []) as PublishRecordRow[];
  const agentTasks = (autoPublishTasksQuery.data?.tasks ?? []) as AgentTaskRow[];
  const articleById = useMemo(() => new Map(articles.map(a => [a.id, a])), [articles]);

  const refreshAgentHealth = useCallback(async () => {
    setCheckingAgent(true);
    try {
      const h = await checkLocalAgentHealth();
      setLocalAgentOnline(h?.ok ?? false);
    } catch {
      setLocalAgentOnline(false);
    } finally {
      setCheckingAgent(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refreshAgentHealth();
  }, [enabled, selectedProjectId, refreshAgentHealth]);

  useEffect(() => {
    if (publishableArticles.length === 0) {
      setManualArticleId("");
      return;
    }
    const current = typeof manualArticleId === "number" ? manualArticleId : undefined;
    if (current == null || !publishableArticles.some(a => a.id === current)) {
      setManualArticleId(publishableArticles[0].id);
    }
  }, [publishableArticles, manualArticleId]);

  useEffect(() => {
    setLinkDraftById(prev => {
      const next = { ...prev };
      for (const r of publishRecords) {
        const url = recordPublicLink(r);
        if (next[r.id] === undefined) next[r.id] = url;
      }
      return next;
    });
  }, [publishRecords]);

  const boundPlatformCount = useMemo(() => {
    const groups = platformAccountsQuery.data?.accounts ?? [];
    return groups.filter(g => (g.accounts ?? []).some((a: { isEnabled: boolean }) => a.isEnabled)).length;
  }, [platformAccountsQuery.data]);

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
      return mapAgentTaskToCard(task, goal);
    });
    for (const record of publishRecords) {
      const article = record.articleId ? articleById.get(record.articleId) : undefined;
      const mapped = mapManualRecordToCard(record, article?.title);
      if (mapped) cards.push(mapped);
    }
    return cards;
  }, [agentTasks, publishRecords, articleById]);

  const columns = useMemo(() => {
    const out: Record<PublishColumnId, PublishTaskCardModel[]> = {
      pending: [],
      active: [],
      done: [],
    };
    for (const card of taskCards) {
      out[card.column].push(card);
    }
    return out;
  }, [taskCards]);

  const pendingCount = columns.pending.length;

  const loading =
    articlesQuery.isLoading || scoresQuery.isLoading || publishRecordsQuery.isLoading || autoPublishTasksQuery.isLoading;

  async function handleSaveRowLink(recordId: number) {
    if (!selectedProjectId) return;
    const record = publishRecords.find(r => r.id === recordId);
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
        id: record.id,
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
      toast.error(e instanceof Error ? e.message : "更新链接失败");
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
    toast.error(card.statusLabel || "发布异常，请查看状态说明或联系交付同学");
  }

  async function handleSaveManualRecord() {
    if (!selectedProjectId) return;
    const articleId = typeof manualArticleId === "number" ? manualArticleId : undefined;
    if (!articleId) {
      toast.error("请选择一篇文章");
      return;
    }
    const article = articles.find(a => a.id === articleId);
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
      toast.success("已登记发布记录");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "登记失败");
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

  return (
    <div className="space-y-6 pb-12" data-testid="publish-center-page">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">发布中心</h1>
        <p className={geoP0Surfaces.muted}>
          Local Agent 本地发布任务中心：按平台独立发布，需人工确认，不支持自动发布或一稿多发。
        </p>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-slate-500">
          <Spinner className="size-5 text-blue-600" />
          正在加载发布任务…
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_260px]">
          <div className="space-y-6 min-w-0">
            <LocalAgentStatusCard
              status={{
                connected: localAgentOnline,
                browserReady: localAgentOnline,
                boundPlatformCount: platformAccountsQuery.isLoading ? null : boundPlatformCount,
                pendingTaskCount: autoPublishTasksQuery.isLoading ? null : pendingCount,
              }}
              checking={checkingAgent}
              onRefresh={() => void refreshAgentHealth()}
            />

            <PublishTaskColumnBoard
              columns={columns}
              linkDraftByRecordId={linkDraftById}
              savingRecordId={savingRowId}
              onPreview={openPreview}
              onStartPublish={startLocalPublish}
              onSaveLink={handleSaveRowLink}
              onMarkAbnormal={markAbnormal}
              onLinkDraftChange={(id, v) => setLinkDraftById(d => ({ ...d, [id]: v }))}
            />

            <details className="rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="publish-retest-rewrite-fold">
              <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-slate-800">
                发布后复测 · 重写池
              </summary>
              <div className="grid gap-4 border-t border-slate-100 p-5 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium text-slate-800">待复测队列</h3>
                  {(retestQueueQuery.data?.items ?? []).length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">暂无待复测内容</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm text-slate-700">
                      {(retestQueueQuery.data?.items ?? []).map(item => (
                        <li key={item.queueId ?? item.articleId} className="rounded-lg border border-slate-100 p-3">
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
                  <h3 className="text-sm font-medium text-slate-800">重写池</h3>
                  {(rewritePoolQuery.data?.items ?? []).length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">暂无待重写条目</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm text-slate-700">
                      {(rewritePoolQuery.data?.items ?? []).map(item => (
                        <li
                          key={`${item.articleId}-${item.poolId ?? 0}`}
                          className="rounded-lg border border-slate-100 p-3"
                        >
                          <p className="font-medium">{item.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.reason}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </details>

            <details className="rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="publish-manual-register-fold">
              <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-slate-800">
                人工登记发布记录（可选）
              </summary>
              <div className="space-y-4 border-t border-slate-100 p-5 text-sm text-slate-600">
                <p>若内容已在平台外发布，可在此登记公开链接，与 Local Agent 任务相互独立。每次仅登记一个平台。</p>
                {publishableArticles.length === 0 ? (
                  <p className="text-slate-500">
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
                            <SelectItem key={a.id} value={String(a.id)}>
                              {a.title?.trim() || `文章 #${a.id}`}
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
                {publishRecords.length === 0 ? (
                  <p className="text-slate-500">暂无发布记录</p>
                ) : (
                  <ul className="space-y-2">
                    {publishRecords.map(record => (
                      <li key={record.id} className="rounded-lg border border-slate-100 px-3 py-2">
                        {articleById.get(record.articleId ?? 0)?.title ?? record.publishTitle ?? "无标题"} ·{" "}
                        {record.publishChannel ?? "—"} · {publishStatusLabel(record.publishStatus)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>

            <details className="rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="publish-local-agent-download-fold">
              <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-slate-800">
                下载 Local Agent
              </summary>
              <div className="border-t border-slate-100 p-5">
                <LocalAgentDownloadCard />
              </div>
            </details>

            <details className="rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="publish-chrome-legacy-fold">
              <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-slate-800">
                旧版 Chrome 插件入口
              </summary>
              <div className="border-t border-slate-100 p-5">
                <p className="text-sm text-slate-600">
                  旧版 Chrome 插件入口，仅用于历史兼容。新项目建议使用 Local Agent。
                </p>
              </div>
            </details>
          </div>

          <LocalAgentPublishStepsPanel projectId={selectedProjectId} />
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
