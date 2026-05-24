import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  Brain,
  Building2,
  Clock,
  FileText,
  Loader2,
  Search,
  Send,
  TrendingUp,
  Users2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useLocation } from "wouter";

const STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  created: { label: "已创建", variant: "outline" },
  questions_ready: { label: "问题库就绪", variant: "secondary" },
  responses_imported: { label: "AI实测中", variant: "secondary" },
  analysis_done: { label: "诊断完成", variant: "default" },
  score_done: { label: "评分完成", variant: "default" },
  tasks_ready: { label: "任务规划中", variant: "default" },
  report_ready: { label: "报告就绪", variant: "default" },
};

function formatRelativeTime(date: Date | null | undefined): string {
  if (!date) return "尚未诊断";
  const d = date instanceof Date ? date : new Date(date);
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays} 天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`;
  return `${Math.floor(diffDays / 30)} 个月前`;
}

function getScoreColor(score: number | null): string {
  if (score === null) return "text-slate-500";
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

type ProjectSummary = {
  id: number;
  enterpriseName: string;
  industry: string;
  website: string;
  region: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  articleCount: number;
  publishCount: number;
  aiTestCount: number;
  lastDiagnosisAt: Date | null;
  latestGeoScore: number | null;
};

function ProjectCard({
  project,
  onEnter,
}: {
  project: ProjectSummary;
  onEnter: (id: number) => void;
}) {
  const statusInfo = STATUS_MAP[project.status] ?? { label: project.status, variant: "outline" as const };
  return (
    <Card className="group border border-white/10 bg-white/[0.03] transition-all hover:border-cyan-400/20 hover:bg-white/[0.05]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base font-semibold text-slate-100">
              {project.enterpriseName}
            </CardTitle>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {project.industry} · {project.region}
            </p>
          </div>
          <Badge variant={statusInfo.variant} className="shrink-0 text-xs">
            {statusInfo.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col items-center rounded-lg bg-white/[0.04] px-2 py-2.5 text-center">
            <TrendingUp className="mb-1 h-3.5 w-3.5 text-slate-500" />
            <span className={`text-lg font-bold leading-none ${getScoreColor(project.latestGeoScore)}`}>
              {project.latestGeoScore ?? "—"}
            </span>
            <span className="mt-1 text-[10px] text-slate-500">GEO分</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-white/[0.04] px-2 py-2.5 text-center">
            <FileText className="mb-1 h-3.5 w-3.5 text-slate-500" />
            <span className="text-lg font-bold leading-none text-slate-200">{project.articleCount}</span>
            <span className="mt-1 text-[10px] text-slate-500">内容资产</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-white/[0.04] px-2 py-2.5 text-center">
            <Send className="mb-1 h-3.5 w-3.5 text-slate-500" />
            <span className="text-lg font-bold leading-none text-slate-200">{project.publishCount}</span>
            <span className="mt-1 text-[10px] text-slate-500">已发布</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-white/[0.04] px-2 py-2.5 text-center">
            <Brain className="mb-1 h-3.5 w-3.5 text-slate-500" />
            <span className="text-lg font-bold leading-none text-slate-200">{project.aiTestCount}</span>
            <span className="mt-1 text-[10px] text-slate-500">AI实测</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Clock className="h-3 w-3" />
          <span>最近诊断：{formatRelativeTime(project.lastDiagnosisAt)}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full border-cyan-400/20 text-cyan-300 hover:border-cyan-400/40 hover:bg-cyan-400/10"
          onClick={() => onEnter(project.id)}
        >
          进入工作台
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ClientDashboardPage() {
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();
  const { data: projects = [], isLoading } = trpc.geo.clientDashboard.listProjectsSummary.useQuery();

  const filtered = projects.filter(p => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.enterpriseName.toLowerCase().includes(q) ||
      p.industry.toLowerCase().includes(q) ||
      p.region.toLowerCase().includes(q)
    );
  });

  const handleEnter = (_projectId: number) => {
    // P1-B：全局 activeProjectId 切换后再加载该客户数据
    setLocation("/");
  };

  const totalArticles = projects.reduce((s, p) => s + p.articleCount, 0);
  const totalPublished = projects.reduce((s, p) => s + p.publishCount, 0);
  const scored = projects.filter(p => p.latestGeoScore !== null);
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((s, p) => s + (p.latestGeoScore ?? 0), 0) / scored.length)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">客户项目管理台</h1>
        <p className="text-sm text-slate-400">统览所有客户的 GEO 增长进展，一键进入工作台</p>
      </div>

      {projects.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard icon={<Users2 className="h-4 w-4" />} label="客户总数" value={projects.length} unit="个" />
          <SummaryCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="平均 GEO 分"
            value={avgScore ?? "—"}
            unit={avgScore !== null ? "分" : ""}
          />
          <SummaryCard icon={<FileText className="h-4 w-4" />} label="内容资产总量" value={totalArticles} unit="篇" />
          <SummaryCard icon={<Send className="h-4 w-4" />} label="累计发布" value={totalPublished} unit="次" />
        </div>
      ) : null}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          placeholder="搜索客户名称、行业、地区…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
          data-testid="client-dashboard-search"
        />
      </div>

      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-slate-500"
          data-testid={projects.length === 0 ? "client-dashboard-empty" : "client-dashboard-search-empty"}
        >
          <Building2 className="h-10 w-10 opacity-30" />
          <p className="text-sm">{search ? "没有匹配的客户项目" : "暂无客户项目，请先创建"}</p>
          {!search ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/enterprise-profile")}
              className="mt-2"
            >
              创建第一个客户
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(project => (
            <ProjectCard key={project.id} project={project} onEnter={handleEnter} />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  unit,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  unit: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-400">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className="text-xl font-bold leading-tight text-slate-100">
          {value}
          {unit ? <span className="ml-0.5 text-xs font-normal text-slate-500">{unit}</span> : null}
        </p>
      </div>
    </div>
  );
}
