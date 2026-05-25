import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { buildProjectUrl, setActiveProjectId } from "@/lib/activeProject";
import {
  ArrowRight,
  Brain,
  Building2,
  Clock,
  FileText,
  Loader2,
  Plus,
  Search,
  Send,
  TrendingUp,
  Users2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

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

type CreateProjectForm = {
  enterpriseName: string;
  industry: string;
  website: string;
  oneLiner: string;
};

const emptyCreateForm = (): CreateProjectForm => ({
  enterpriseName: "",
  industry: "",
  website: "",
  oneLiner: "",
});

export default function ClientDashboardPage() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateProjectForm>(emptyCreateForm);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: projects = [], isLoading } = trpc.geo.clientDashboard.listProjectsSummary.useQuery();
  const createProject = trpc.geo.projects.create.useMutation();

  const filtered = projects.filter(p => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.enterpriseName.toLowerCase().includes(q) ||
      p.industry.toLowerCase().includes(q) ||
      p.region.toLowerCase().includes(q)
    );
  });

  const handleEnter = (projectId: number) => {
    setActiveProjectId(projectId);
    setLocation(buildProjectUrl("/workspace", projectId));
  };

  async function handleCreateProject() {
    const enterpriseName = createForm.enterpriseName.trim();
    if (!enterpriseName) {
      toast.error("请填写企业名称");
      return;
    }
    try {
      await createProject.mutateAsync({
        enterpriseName,
        industry: createForm.industry.trim() || "待补充",
        website: createForm.website.trim() || "https://",
        region: "中国",
        productIntro: createForm.oneLiner.trim() || "待补充",
        targetCustomers: "待补充",
        coreSellingPoints: createForm.oneLiner.trim() || "待补充",
        competitorNames: [],
        coreKeywords: [],
      });
      const list = await utils.geo.projects.list.fetch();
      const created =
        list.find(p => p.enterpriseName === enterpriseName) ?? list[list.length - 1];
      if (!created?.id) {
        toast.error("创建成功但未找到项目，请刷新后重试");
        return;
      }
      await utils.geo.clientDashboard.listProjectsSummary.invalidate();
      setActiveProjectId(created.id);
      setCreateOpen(false);
      setCreateForm(emptyCreateForm());
      toast.success("客户项目已创建，请继续完成 GEO 建档");
      setLocation(buildProjectUrl("/enterprise-profile", created.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败");
    }
  }

  const totalArticles = projects.reduce((s, p) => s + p.articleCount, 0);
  const totalPublished = projects.reduce((s, p) => s + p.publishCount, 0);
  const scored = projects.filter(p => p.latestGeoScore !== null);
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((s, p) => s + (p.latestGeoScore ?? 0), 0) / scored.length)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">客户项目管理台</h1>
          <p className="text-sm text-slate-400">统览所有客户项目，在此新建、选择并进入工作台</p>
        </div>
        <Button
          className="shrink-0 bg-cyan-400 text-slate-950 hover:bg-cyan-300"
          data-testid="create-client-project-button"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          新建客户项目
        </Button>
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
          className="flex min-h-[30vh] flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center"
          data-testid={projects.length === 0 ? "client-dashboard-empty" : "client-dashboard-search-empty"}
        >
          <Building2 className="h-10 w-10 text-slate-600 opacity-40" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-100">
              {search ? "没有匹配的客户项目" : "还没有客户项目"}
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-slate-400">
              {search
                ? "请调整搜索关键词，或新建客户项目。"
                : "先创建一个客户项目，再进行 GEO 建档、内容生产、发布和监测。"}
            </p>
          </div>
          {!search ? (
            <Button
              className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
              data-testid="create-client-project-empty-button"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              新建客户项目
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-white/10 bg-slate-950 text-slate-100" data-testid="create-client-project-dialog">
          <DialogHeader>
            <DialogTitle>新建客户项目</DialogTitle>
            <DialogDescription className="text-slate-400">
              仅填写基础信息即可创建；详细企业资料请在 GEO 建档页完善。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-enterprise-name">企业名称</Label>
              <Input
                id="create-enterprise-name"
                data-testid="create-enterprise-name"
                value={createForm.enterpriseName}
                onChange={e => setCreateForm(f => ({ ...f, enterpriseName: e.target.value }))}
                placeholder="客户企业或品牌全称"
                className="border-white/10 bg-slate-900"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-industry">所属行业（选填）</Label>
              <Input
                id="create-industry"
                data-testid="create-industry"
                value={createForm.industry}
                onChange={e => setCreateForm(f => ({ ...f, industry: e.target.value }))}
                placeholder="例如：企业服务、制造业"
                className="border-white/10 bg-slate-900"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-website">官网 / 主页链接（选填）</Label>
              <Input
                id="create-website"
                data-testid="create-website"
                value={createForm.website}
                onChange={e => setCreateForm(f => ({ ...f, website: e.target.value }))}
                placeholder="https://"
                className="border-white/10 bg-slate-900"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-one-liner">一句话介绍（选填）</Label>
              <Input
                id="create-one-liner"
                data-testid="create-one-liner"
                value={createForm.oneLiner}
                onChange={e => setCreateForm(f => ({ ...f, oneLiner: e.target.value }))}
                placeholder="简要说明企业做什么"
                className="border-white/10 bg-slate-900"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/15" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
              data-testid="create-client-project-submit"
              disabled={createProject.isPending}
              onClick={() => void handleCreateProject()}
            >
              {createProject.isPending ? "创建中…" : "创建并去 GEO 建档"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
