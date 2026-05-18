import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ProjectOption = { id: number; enterpriseName: string };

type ScoreRow = {
  id: number;
  totalScore: number;
  createdAt?: Date | string | null;
};

type ArticleRow = {
  id: number;
  title?: string | null;
  status?: string | null;
  createdAt?: Date | string | null;
};

type PublishRecordRow = {
  id: number;
  articleId?: number | null;
  publishTitle?: string | null;
  publishChannel?: string | null;
  publishedAt?: Date | string | null;
};

type TaskRow = {
  id: number;
  taskName?: string | null;
  executionSuggestion?: string | null;
};

const GEO_TASK_CARD_MARK = "__GEO_TASK_CARD__";

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

function formatMonthDay(value: Date | string | null | undefined): string {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "—";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function daysAgoLabel(value: Date | string | null | undefined): string {
  const t = parseTime(value ?? null);
  if (Number.isNaN(t)) return "—";
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return "今天";
  if (days === 1) return "昨天";
  return `${days} 天前`;
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

function parseTaskArticleTitle(task: TaskRow): string {
  const es = task.executionSuggestion;
  if (!es?.includes(GEO_TASK_CARD_MARK)) return (task.taskName || "内容建议").trim();
  const jsonPart = es.split(`${GEO_TASK_CARD_MARK}\n`)[1]?.trim();
  if (!jsonPart) return (task.taskName || "内容建议").trim();
  try {
    const j = JSON.parse(jsonPart) as Record<string, unknown>;
    const title = typeof j.articleTitle === "string" ? j.articleTitle.trim() : "";
    return title || (task.taskName || "内容建议").trim();
  } catch {
    return (task.taskName || "内容建议").trim();
  }
}

function milestoneText(publishedCount: number): string {
  if (publishedCount === 0) return "发布第一篇文章，开始积累内容资产";
  if (publishedCount <= 4) return `已发布 ${publishedCount} 篇，继续保持！`;
  if (publishedCount <= 9) return `🎉 已发布 ${publishedCount} 篇，内容积累初见成效`;
  if (publishedCount <= 19) return `🎉 已发布 ${publishedCount} 篇，优秀！坚持是最好的策略`;
  return `🏆 已发布 ${publishedCount} 篇，你是内容创作的坚持者`;
}

function StatCard({ label, value, sub, valueClassName = "text-white" }: { label: string; value: string; sub?: string; valueClassName?: string }) {
  return (
    <div className="rounded-2xl bg-slate-900/80 p-4 shadow-inner">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-medium leading-tight ${valueClassName}`} style={{ fontSize: "24px", fontWeight: 500 }}>
        {value}
      </p>
      {sub ? <p className="mt-1 text-[11px] leading-4 text-slate-500">{sub}</p> : null}
    </div>
  );
}

function ChartTooltipContent({ active, payload }: { active?: boolean; payload?: Array<{ payload?: { tooltipLabel?: string; score?: number } }> }) {
  if (!active || !payload?.[0]?.payload) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-100 shadow-lg">
      {row.tooltipLabel} · {row.score}分
    </div>
  );
}

export default function ProgressPage() {
  const [, setLocation] = useLocation();
  const { projects, selectedProjectId, setSelectedProjectId, projectInput, enabled } = useProjectSelection();

  const scoresQuery = trpc.geo.scores.list.useQuery(projectInput, { enabled });
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const publishRecordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });
  const tasksQuery = trpc.geo.tasks.list.useQuery(projectInput, { enabled });

  const scores = (scoresQuery.data ?? []) as ScoreRow[];
  const articles = (articlesQuery.data ?? []) as ArticleRow[];
  const publishRecords = (publishRecordsQuery.data ?? []) as PublishRecordRow[];
  const tasks = (tasksQuery.data ?? []) as TaskRow[];

  const publishedSceneCount = useMemo(() => articles.filter(a => a.status === "已发布").length, [articles]);
  const latestScore = scores.length > 0 ? scores[scores.length - 1] : null;

  const scoreDelta = useMemo(() => {
    if (scores.length < 2) return { text: "首次", kind: "neutral" as const };
    const prev = scores[scores.length - 2]!;
    const curr = scores[scores.length - 1]!;
    const d = curr.totalScore - prev.totalScore;
    if (d > 0) return { text: `+${d}`, kind: "up" as const };
    if (d < 0) return { text: String(d), kind: "down" as const };
    return { text: "无变化", kind: "neutral" as const };
  }, [scores]);

  const chartData = useMemo(
    () =>
      scores.map(s => ({
        date: formatMonthDay(s.createdAt),
        score: s.totalScore,
        tooltipLabel: formatMonthDay(s.createdAt),
      })),
    [scores],
  );

  const weeklyArticles = useMemo(
    () =>
      [...articles]
        .filter(a => isInThisWeek(a.createdAt))
        .sort((a, b) => parseTime(b.createdAt) - parseTime(a.createdAt))
        .slice(0, 5),
    [articles],
  );

  const articleTitleById = useMemo(() => new Map(articles.map(a => [a.id, a.title ?? "无标题"])), [articles]);

  const recentPublish = useMemo(
    () =>
      [...publishRecords]
        .sort((a, b) => parseTime(b.publishedAt) - parseTime(a.publishedAt))
        .slice(0, 5),
    [publishRecords],
  );

  const nextTasks = useMemo(() => tasks.slice(0, 3), [tasks]);

  const loading = enabled && (scoresQuery.isLoading || articlesQuery.isLoading || publishRecordsQuery.isLoading || tasksQuery.isLoading);
  const loadError = scoresQuery.isError || articlesQuery.isError || publishRecordsQuery.isError || tasksQuery.isError;

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12 pt-2 text-slate-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">内容进展</h1>
          <p className="mt-1 text-sm text-slate-500">累计发布、评分趋势与下周建议</p>
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

      {!enabled ? (
        <p className="text-sm text-slate-400">请先选择项目</p>
      ) : loadError ? (
        <p className="text-sm text-amber-100">暂时无法加载，请刷新重试</p>
      ) : loading ? (
        <p className="text-sm text-slate-400">加载中...</p>
      ) : (
        <>
          <section aria-label="核心数字" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="累计发布篇数" value={String(publishRecords.length)} />
            <StatCard label="覆盖问题场景" value={String(publishedSceneCount)} />
            <StatCard
              label="当前内容评分"
              value={latestScore ? `${latestScore.totalScore} 分` : "未诊断"}
              sub={latestScore ? "基于最近一次内容诊断" : undefined}
            />
            <StatCard
              label="较上次变化"
              value={scoreDelta.text}
              valueClassName={
                scoreDelta.kind === "up" ? "text-emerald-400" : scoreDelta.kind === "down" ? "text-rose-400" : "text-slate-300"
              }
              sub={scores.length >= 2 ? "与上一次评分记录对比" : undefined}
            />
          </section>

          <section aria-label="评分趋势" className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold text-white">评分趋势</h2>
            {chartData.length === 0 ? (
              <p className="mt-8 text-center text-sm text-slate-500">完成第一次内容诊断后，这里会显示你的评分趋势</p>
            ) : (
              <div className="mt-4 h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} width={32} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#1D9E75"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#1D9E75", strokeWidth: 0 }}
                      activeDot={{ r: 3, fill: "#1D9E75", strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section aria-label="本周新增内容" className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold text-white">本周新增内容</h2>
            {weeklyArticles.length === 0 ? (
              <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-400">本周还没有生成文章，去本周内容页生成吧</p>
                <Button type="button" className="bg-cyan-400 text-slate-950 hover:bg-cyan-300" onClick={() => setLocation("/weekly")}>
                  去生成
                </Button>
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {weeklyArticles.map(a => (
                  <li key={a.id} className="rounded-xl border border-white/5 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
                    {a.title || "无标题"}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="累计发布记录" className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">累计发布记录</h2>
              <button type="button" className="text-sm text-cyan-300 hover:text-cyan-200" onClick={() => setLocation("/content-publishing")}>
                查看全部 →
              </button>
            </div>
            {recentPublish.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">还没有发布记录</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-slate-500">
                      <th className="pb-2 font-medium">文章标题</th>
                      <th className="pb-2 font-medium">平台</th>
                      <th className="pb-2 font-medium">发布时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPublish.map(row => (
                      <tr key={row.id} className="border-b border-white/5 text-slate-300">
                        <td className="py-3 pr-4 text-slate-200">
                          {row.publishTitle || (row.articleId ? articleTitleById.get(row.articleId) : null) || "无标题"}
                        </td>
                        <td className="py-3 pr-4">{row.publishChannel || "—"}</td>
                        <td className="py-3 whitespace-nowrap">{daysAgoLabel(row.publishedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-label="下周建议" className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold text-white">下周建议写的内容</h2>
            {nextTasks.length === 0 ? (
              <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-400">先运行内容诊断，获取内容方向建议</p>
                <Button type="button" variant="outline" className="border-white/15 text-cyan-100" onClick={() => setLocation("/ai-diagnosis")}>
                  去诊断
                </Button>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {nextTasks.map(task => (
                  <li
                    key={task.id}
                    className="flex flex-col gap-3 rounded-xl border border-white/5 bg-slate-950/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="text-sm text-slate-200">{parseTaskArticleTitle(task)}</span>
                    <Button type="button" size="sm" className="shrink-0 bg-cyan-400 text-slate-950 hover:bg-cyan-300" onClick={() => setLocation("/weekly")}>
                      去生成
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="里程碑" className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 px-6 py-5 text-center">
            <p className="text-base text-cyan-100">{milestoneText(publishRecords.length)}</p>
          </section>
        </>
      )}
    </div>
  );
}
