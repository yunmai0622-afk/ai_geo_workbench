import { ClientsHubTopBar } from "@/components/clients/ClientsHubTopBar";
import { Button } from "@/components/ui/button";
import { geoP0Brand, geoTypography, stageBadgeClass } from "@/lib/geoP0Visual";
import { cn } from "@/lib/utils";
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
import { buildProjectUrl, setActiveProjectId } from "@/lib/activeProject";
import {
  deriveClientProjectCardDisplay,
  displayRegionIndustry,
  formatGeoScore,
} from "@/lib/projectWorkspaceDisplay";
import { trpc } from "@/lib/trpc";
import { toUserFacingCreateProjectError } from "@shared/userFacingMutationErrors";
import { ArrowRight, Building2, FolderKanban, Loader2, Plus, Search, Clock, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

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

function normalizeIndustryRegion(industry: string, region: string): { industry?: string; region?: string } {
  const ind = industry?.trim();
  const reg = region?.trim();
  return {
    industry: ind && ind !== "待补充" ? ind : undefined,
    region: reg && reg !== "待补充" && reg !== "中国" ? reg : reg === "中国" ? "中国" : undefined,
  };
}

/* ─── 总览统计卡片 ─── */
function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="geo-card flex items-center gap-3.5 px-5 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
        {icon}
      </div>
      <div>
        <p className="text-[13px] font-medium text-gray-500">{label}</p>
        <p className="text-xl font-bold tabular-nums tracking-tight text-gray-900">{value}</p>
      </div>
    </div>
  );
}

/* ─── 项目卡片 ─── */
function ProjectCard({
  project,
  onEnter,
}: {
  project: ProjectSummary;
  onEnter: (id: number) => void;
}) {
  const { industry, region } = normalizeIndustryRegion(project.industry, project.region);
  const { stageLabel, nextStep } = deriveClientProjectCardDisplay(project);
  const showContentStats = project.articleCount > 0 || project.publishCount > 0;
  const geoScore = formatGeoScore(project.latestGeoScore);

  return (
    <article
      className="geo-card-interactive flex flex-col justify-between p-5"
      data-testid="client-project-card"
      onClick={() => onEnter(project.id)}
    >
      {/* 顶部：企业名 + 阶段 */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="truncate text-[15px] font-semibold text-gray-900">{project.enterpriseName}</h3>
        <span className={cn(stageBadgeClass(stageLabel), "shrink-0")}>{stageLabel}</span>
      </div>

      {/* 行业 / 地区 */}
      <p className="mb-3 text-[13px] text-gray-500">{displayRegionIndustry(industry, region)}</p>

      {/* AI 搜索可见度评分 */}
      <div className="mb-3 rounded-lg bg-gray-50 px-3.5 py-2.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">AI 搜索可见度</p>
        <p className="mt-0.5 text-lg font-bold tabular-nums tracking-tight text-gray-900">{geoScore}</p>
      </div>

      {/* 内容统计 */}
      {showContentStats ? (
        <p className="mb-2 text-[13px] text-gray-500">
          内容 {project.articleCount} 篇 · 已发布 {project.publishCount} 次
        </p>
      ) : null}

      {/* 下一步动作 */}
      <p className="mb-4 line-clamp-2 text-[13px] leading-relaxed text-gray-600">
        <span className="font-medium text-gray-400">下一步：</span>
        {nextStep}
      </p>

      {/* 底部 CTA */}
      <div className="mt-auto flex justify-end">
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all",
            "bg-blue-50 text-blue-700 hover:bg-blue-100",
          )}
          data-testid="enter-workspace-button"
          onClick={(e) => {
            e.stopPropagation();
            onEnter(project.id);
          }}
        >
          进入工作台
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </article>
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
    return p.enterpriseName.toLowerCase().includes(q);
  });

  // 总览统计
  const totalProjects = projects.length;
  const inProgressCount = projects.filter(p => {
    const { stageLabel } = deriveClientProjectCardDisplay(p);
    return stageLabel !== "待建档" && stageLabel !== "报告已生成";
  }).length;
  const pendingCount = projects.filter(p => {
    const { stageLabel } = deriveClientProjectCardDisplay(p);
    return stageLabel === "待建档";
  }).length;

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
      const created = list.find(p => p.enterpriseName === enterpriseName) ?? list[list.length - 1];
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
      console.error("[create-client-project]", err);
      toast.error(toUserFacingCreateProjectError(err));
    }
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-6" data-testid="client-dashboard-page">
      <ClientsHubTopBar />

      {/* 标题区：左标题 + 右按钮 */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className={geoTypography.pageTitle}>客户项目</h1>
          <p className="max-w-xl text-sm leading-relaxed text-gray-500">
            管理企业的 GEO 建档、AI 诊断、内容发布、收录监测与交付报告
          </p>
        </div>
        <Button
          className={cn("shrink-0 rounded-xl px-5 py-2.5", geoP0Brand.primary)}
          data-testid="create-client-project-button"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          新建客户项目
        </Button>
      </div>

      {/* 总览卡片 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={<FolderKanban className="h-5 w-5 text-blue-600" />}
          label="客户项目"
          value={totalProjects > 0 ? String(totalProjects) : "--"}
        />
        <SummaryCard
          icon={<Clock className="h-5 w-5 text-blue-600" />}
          label="进行中"
          value={inProgressCount > 0 ? String(inProgressCount) : "--"}
        />
        <SummaryCard
          icon={<AlertCircle className="h-5 w-5 text-blue-600" />}
          label="待处理"
          value={pendingCount > 0 ? String(pendingCount) : "--"}
        />
      </div>

      {/* 搜索栏 */}
      <div className="relative w-full max-w-[400px]">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="搜索企业名称…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="rounded-xl border-gray-200 bg-white pl-10 shadow-sm transition-shadow focus:shadow-md"
          data-testid="client-dashboard-search"
        />
      </div>

      {/* 卡片网格 / 加载 / 空状态 */}
      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="geo-empty-state flex min-h-[28vh] flex-col items-center justify-center gap-4 px-6 py-12"
          data-testid={projects.length === 0 ? "client-dashboard-empty" : "client-dashboard-search-empty"}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
            <Building2 className="h-7 w-7 text-gray-400" />
          </div>
          <div className="space-y-2 text-center">
            <h2 className="text-lg font-semibold text-gray-900">
              {search ? "没有匹配的企业项目" : "还没有客户项目"}
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-gray-500">
              {search
                ? "请调整搜索关键词，或新建客户项目。"
                : "创建第一个企业项目，开始 GEO 增长之旅。只需填写企业名称和行业，即可在 5 分钟内完成建档。"}
            </p>
          </div>
          {!search ? (
            <Button
              className={cn("rounded-xl px-5", geoP0Brand.primary)}
              data-testid="create-client-project-empty-button"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              新建客户项目
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(project => (
            <ProjectCard key={project.id} project={project} onEnter={handleEnter} />
          ))}
        </div>
      )}

      {/* 新建客户项目弹窗 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          className="rounded-2xl border-gray-200 bg-white text-gray-900 shadow-xl sm:max-w-md"
          data-testid="create-client-project-dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">新建客户项目</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              仅填写基础信息即可创建；详细企业资料请在 GEO 建档页完善。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-enterprise-name" className="text-sm font-medium text-gray-700">
                企业名称
              </Label>
              <Input
                id="create-enterprise-name"
                data-testid="create-enterprise-name"
                value={createForm.enterpriseName}
                onChange={e => setCreateForm(f => ({ ...f, enterpriseName: e.target.value }))}
                placeholder="客户企业或品牌全称"
                className="rounded-xl border-gray-200 bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-industry" className="text-sm font-medium text-gray-700">
                所属行业（选填）
              </Label>
              <Input
                id="create-industry"
                data-testid="create-industry"
                value={createForm.industry}
                onChange={e => setCreateForm(f => ({ ...f, industry: e.target.value }))}
                placeholder="例如：企业服务、制造业"
                className="rounded-xl border-gray-200 bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-website" className="text-sm font-medium text-gray-700">
                官网 / 主页链接（选填）
              </Label>
              <Input
                id="create-website"
                data-testid="create-website"
                value={createForm.website}
                onChange={e => setCreateForm(f => ({ ...f, website: e.target.value }))}
                placeholder="https://"
                className="rounded-xl border-gray-200 bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-one-liner" className="text-sm font-medium text-gray-700">
                一句话介绍（选填）
              </Label>
              <Input
                id="create-one-liner"
                data-testid="create-one-liner"
                value={createForm.oneLiner}
                onChange={e => setCreateForm(f => ({ ...f, oneLiner: e.target.value }))}
                placeholder="简要说明企业做什么"
                className="rounded-xl border-gray-200 bg-white"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">
              取消
            </Button>
            <Button
              className={cn("rounded-xl", geoP0Brand.primary)}
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
