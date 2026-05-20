import React from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

type ArticleRow = {
  id: number;
  status?: string | null;
  createdAt?: Date | string | null;
  title?: string | null;
};

type PublishRecordRow = {
  id: number;
  publishTitle?: string | null;
  publishChannel?: string | null;
  publishedAt?: Date | string | null;
};

type GeoScoreRow = {
  id: number;
  totalScore: number;
  createdAt?: Date | string | null;
};

function parseTime(value: Date | string | number | null | undefined): number {
  if (value == null) return NaN;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? NaN : t;
}

/** 当前自然周：周一 00:00 至周日 23:59:59.999（本地时区） */
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

function daysAgoLabel(publishedAt: Date | string | null | undefined): string {
  const t = parseTime(publishedAt ?? null);
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return "今天";
  if (days === 1) return "昨天";
  return `${days} 天前`;
}

function truncate(s: string, max: number) {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function SectionSkeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/[0.06] ${className}`} aria-hidden />;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-slate-900/80 p-4 shadow-inner">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-medium leading-tight text-white" style={{ fontSize: "24px", fontWeight: 500 }}>
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">{sub}</p>
    </div>
  );
}

export default function V1WorkbenchOverview() {
  const [, setLocation] = useLocation();
  const { data: projects = [], isLoading: projectsLoading } = trpc.geo.projects.list.useQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(() => projects[0]?.id);

  // SEO: 设置页面标题
  useEffect(() => {
    document.title = "企业 AI 搜索增长工作台 - GEO 内容诊断与智能发布";
  }, []);

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  const projectInput = useMemo(() => ({ projectId: selectedProjectId }), [selectedProjectId]);
  const enabled = Boolean(selectedProjectId);

  const scoreQuery = trpc.geo.scores.latest.useQuery(projectInput, { enabled });
  const tasksQuery = trpc.geo.tasks.list.useQuery(projectInput, { enabled });
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const publishRecordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });

  const tasks = (tasksQuery.data ?? []) as { id: number }[];
  const articles = (articlesQuery.data ?? []) as ArticleRow[];
  const publishRecords = (publishRecordsQuery.data ?? []) as PublishRecordRow[];
  const latestScore = scoreQuery.data as GeoScoreRow | null | undefined;

  const weekRange = useMemo(() => getThisWeekRange(), []);
  const weeklyGenerated = useMemo(() => articles.filter(a => isInThisWeek(a.createdAt)).length, [articles, weekRange]);
  const taskCount = tasks.length;
  const weekCap = Math.min(Math.max(taskCount, 0), 7);
  const pendingGenerate = Math.max(0, taskCount - weeklyGenerated);

  const publishedSceneCount = useMemo(() => articles.filter(a => a.status === "已发布").length, [articles]);
  const totalPublishCount = publishRecords.length;

  const recentPublish = useMemo(() => {
    return [...publishRecords]
      .sort((a, b) => parseTime(b.publishedAt) - parseTime(a.publishedAt))
      .slice(0, 3);
  }, [publishRecords]);

  const progressRatio = weekCap > 0 ? Math.min(1, weeklyGenerated / weekCap) : 0;
  const progressPct = Math.round(progressRatio * 100);

  const progressBarClass =
    progressPct < 50 ? "bg-amber-500" : progressPct < 100 ? "bg-cyan-400" : "bg-emerald-500";

  const prevScoreRef = useRef<{ id: number; total: number } | null>(null);
  const [deltaLine, setDeltaLine] = useState<{ text: string; kind: "up" | "down" | "neutral" }>({ text: "—", kind: "neutral" });

  useEffect(() => {
    prevScoreRef.current = null;
    setDeltaLine({ text: "—", kind: "neutral" });
  }, [selectedProjectId]);

  useEffect(() => {
    const row = latestScore;
    if (!row || typeof row.totalScore !== "number" || typeof row.id !== "number") {
      setDeltaLine({ text: "—", kind: "neutral" });
      return;
    }
    const prev = prevScoreRef.current;
    if (!prev) {
      setDeltaLine({ text: "首次", kind: "neutral" });
      prevScoreRef.current = { id: row.id, total: row.totalScore };
      return;
    }
    if (prev.id === row.id) {
      setDeltaLine({ text: "—", kind: "neutral" });
      return;
    }
    const d = row.totalScore - prev.total;
    if (d > 0) setDeltaLine({ text: `+${d}`, kind: "up" });
    else if (d < 0) setDeltaLine({ text: String(d), kind: "down" });
    else setDeltaLine({ text: "无变化", kind: "neutral" });
    prevScoreRef.current = { id: row.id, total: row.totalScore };
  }, [latestScore]);

  const scoreValueText =
    latestScore && typeof latestScore.totalScore === "number" ? `${latestScore.totalScore} 分` : "未诊断";
  const diagnosisDaysAgo =
    latestScore && latestScore.createdAt
      ? daysAgoLabel(latestScore.createdAt)
      : null;
  const hasDiagnosisScore = Boolean(latestScore && typeof latestScore.totalScore === "number");

  const weeklyPrimaryDone = weekCap > 0 && weeklyGenerated >= weekCap;
  const weeklyPrimaryInProgress = weekCap > 0 && weeklyGenerated > 0 && !weeklyPrimaryDone;

  const scoreErr = scoreQuery.isError;
  const tasksErr = tasksQuery.isError;
  const articlesErr = articlesQuery.isError;
  const publishErr = publishRecordsQuery.isError;

  const greetingLoading =
    projectsLoading || (enabled && (articlesQuery.isLoading || tasksQuery.isLoading));
  const greetingLine = greetingLoading
    ? "你好。"
    : `你好。本周已生成 ${weeklyGenerated} 篇内容，还有 ${pendingGenerate} 篇待生成。`;

  const goWeekly = () => setLocation("/weekly");

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-16 pt-2 text-slate-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">企业 AI 搜索增长工作台</h1>
          <h2 className="mt-1 text-sm font-normal text-slate-500">GEO 内容诊断与智能发布 — 今日概览与本周任务</h2>
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

      {/* 区域1 */}
      <section aria-label="问候">
        {greetingLoading ? <SectionSkeleton className="h-10 w-full max-w-2xl" /> : <p className="text-base leading-relaxed text-slate-200">{greetingLine}</p>}
      </section>

      {/* 区域2 */}
      <section aria-label="核心数字" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {publishErr ? (
          <div className="col-span-full rounded-2xl bg-slate-900/80 p-4 text-sm text-amber-100">暂时无法加载，请刷新重试</div>
        ) : publishRecordsQuery.isLoading && enabled ? (
          <>
            <SectionSkeleton className="h-28" />
            <SectionSkeleton className="h-28" />
            <SectionSkeleton className="h-28" />
            <SectionSkeleton className="h-28" />
          </>
        ) : (
          <>
            <StatCard label="累计发布篇数" value={String(totalPublishCount)} sub="已登记各平台发布" />
            <StatCard label="覆盖问题场景" value={String(publishedSceneCount)} sub="已发布内容计为 1 个场景" />
            {scoreErr ? (
              <div className="rounded-2xl bg-slate-900/80 p-4 text-sm text-amber-100">暂时无法加载，请刷新重试</div>
            ) : scoreQuery.isLoading && enabled ? (
              <SectionSkeleton className="h-28" />
            ) : (
              <StatCard label="内容覆盖评分" value={scoreValueText} sub="基于最近一次内容诊断" />
            )}
            {scoreErr ? null : scoreQuery.isLoading && enabled ? (
              <SectionSkeleton className="h-28" />
            ) : (
              <div className="rounded-2xl bg-slate-900/80 p-4 shadow-inner">
                <p className="text-xs text-slate-500">较上次变化</p>
                <p
                  className={`mt-1 text-2xl font-medium leading-tight ${
                    deltaLine.kind === "up" ? "text-emerald-400" : deltaLine.kind === "down" ? "text-rose-400" : "text-white"
                  }`}
                  style={{ fontSize: "24px", fontWeight: 500 }}
                >
                  {deltaLine.text}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">与上一次评分记录对比</p>
              </div>
            )}
          </>
        )}
      </section>

      {/* 区域3 */}
      <section aria-label="本周任务" className="rounded-3xl bg-slate-900/70 p-6 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
        <h2 className="text-lg font-semibold text-white">本周内容任务</h2>
        {tasksErr || articlesErr ? (
          <p className="mt-4 text-sm text-amber-100">暂时无法加载，请刷新重试</p>
        ) : tasksQuery.isLoading || articlesQuery.isLoading ? (
          <div className="mt-6 space-y-3">
            <SectionSkeleton className="h-2 w-full" />
            <SectionSkeleton className="h-4 w-2/3" />
            <SectionSkeleton className="h-12 w-full" />
          </div>
        ) : (
          <>
            <div
              className="mt-6 h-2 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: progressPct === 0 ? "var(--color-border-tertiary)" : "rgb(30 41 59)" }}
            >
              {progressPct > 0 ? (
                <div className={`h-full rounded-full transition-all ${progressBarClass}`} style={{ width: `${progressPct}%` }} />
              ) : null}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              已生成 {weeklyGenerated} 篇 / 共 {weekCap} 篇
            </p>
            <p className="mt-1 text-xs text-slate-500">基于你的内容诊断，本周建议生成 {weekCap} 篇文章</p>
            <Button
              type="button"
              className="mt-6 h-12 w-full rounded-xl bg-cyan-400 text-base font-medium text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
              disabled={weekCap === 0 ? false : weeklyPrimaryDone}
              onClick={() => {
                if (taskCount === 0) setLocation("/ai-diagnosis");
                else goWeekly();
              }}
            >
              {taskCount === 0
                ? "先去获取本周建议 →"
                : weeklyPrimaryDone
                  ? "本周文章已全部生成 ✓"
                  : weeklyPrimaryInProgress
                    ? `继续生成本周文章（已完成 ${weeklyGenerated}/${weekCap}）→`
                    : "开始生成本周文章 →"}
            </Button>
          </>
        )}
      </section>

      {/* 区域4 */}
      <section aria-label="最近发布">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">最近发布</h2>
          <button type="button" onClick={() => setLocation("/content-publishing")} className="text-xs text-cyan-300 hover:text-cyan-200">
            查看全部 →
          </button>
        </div>
        {publishErr ? (
          <p className="text-sm text-amber-100">暂时无法加载，请刷新重试</p>
        ) : publishRecordsQuery.isLoading && enabled ? (
          <div className="space-y-2">
            <SectionSkeleton className="h-14 w-full" />
            <SectionSkeleton className="h-14 w-full" />
            <SectionSkeleton className="h-14 w-full" />
          </div>
        ) : recentPublish.length === 0 ? (
          <div className="rounded-2xl bg-slate-900/70 p-5 text-sm leading-relaxed text-slate-400">
            <p>还没有发布记录。生成文章后，复制到平台发布，再回来登记链接。</p>
            <Button type="button" variant="secondary" className="mt-4 bg-white/10 text-white hover:bg-white/15" onClick={goWeekly}>
              去生成文章
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-white/10 rounded-2xl border border-white/5 bg-slate-900/50">
            {recentPublish.map(r => (
              <li key={r.id} className="px-4 py-3 text-sm text-slate-300">
                <span className="text-slate-100">{truncate((r.publishTitle || "未命名").trim(), 30)}</span>
                <span className="text-slate-500"> · </span>
                <span>{r.publishChannel ?? "—"}</span>
                <span className="text-slate-500"> · </span>
                <span className="text-slate-500">{daysAgoLabel(r.publishedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 区域5 */}
      <section aria-label="内容诊断">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">内容诊断</h2>
          <button type="button" onClick={() => setLocation("/ai-diagnosis")} className="text-xs text-cyan-300 hover:text-cyan-200">
            查看详情 →
          </button>
        </div>
        {scoreErr ? (
          <p className="text-sm text-amber-100">暂时无法加载，请刷新重试</p>
        ) : scoreQuery.isLoading && enabled ? (
          <div className="space-y-2">
            <SectionSkeleton className="h-16 w-full" />
            <SectionSkeleton className="h-10 w-40" />
          </div>
        ) : hasDiagnosisScore ? (
          <div className="flex flex-col gap-4 rounded-2xl bg-slate-900/70 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-relaxed text-slate-300">
              上次诊断：{diagnosisDaysAgo ?? "—"} · 评分 {latestScore?.totalScore ?? "—"} 分 · 发现 {taskCount} 个内容缺口
            </p>
            <Button type="button" variant="outline" className="shrink-0 border-white/15 text-cyan-100 hover:bg-white/10" onClick={() => setLocation("/ai-diagnosis")}>
              重新诊断
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-2xl bg-slate-900/70 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-relaxed text-slate-400">还没有运行过内容诊断。诊断后系统会自动为你生成本周内容建议。</p>
            <Button type="button" className="shrink-0 bg-cyan-400 text-slate-950 hover:bg-cyan-300" onClick={() => setLocation("/ai-diagnosis")}>
              立即诊断
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
