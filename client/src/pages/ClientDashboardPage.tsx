import { ClientsHubTopBar } from "@/components/clients/ClientsHubTopBar";
import { DangerousActionConfirmDialog } from "@/components/DangerousActionConfirmDialog";
import { Button } from "@/components/ui/button";
import { useDangerousActionConfirm } from "@/hooks/useDangerousActionConfirm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DANGEROUS_ACTION_LABELS } from "@shared/dangerousActionConfirm";
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
import { activateProject, buildProjectUrl } from "@/lib/activeProject";
import { resolveClientProjectCardPrimaryAction } from "@shared/clientProjectCardPrimaryAction";
import {
  formatSubscriptionExpiryLabel,
  type SubscriptionServiceStatus,
} from "@shared/companySubscriptionServiceStatus";
import { SubscriptionUpgradePrompt } from "@/components/SubscriptionUpgradePrompt";
import { handleSubscriptionLimitMutationError } from "@/lib/subscriptionUpgrade";
import { trpc } from "@/lib/trpc";
import { SUBSCRIPTION_LIMIT_PROJECT_MESSAGE } from "@shared/subscriptionLimits";
import { toUserFacingCreateProjectError } from "@shared/userFacingMutationErrors";
import { AlertTriangle, Archive, ArchiveRestore, ArrowRight, BarChart3, Building2, ClipboardCheck, Loader2, MoreHorizontal, Plus, Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { whiteLabelPrimaryStyle } from "@/lib/whiteLabel";

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
  lastMeasuredAt: Date | null;
  latestGeoScore: number | null;
  t0BrandMentionRate: number | null;
  archivedAt: Date | null;
  completionScore: number;
  hasCompletedT0Baseline: boolean;
  hasActiveMonthlyPlan: boolean;
  monthlyPlanCompletedCount: number;
  monthlyPlanTotalCount: number;
  subscriptionPlanName: string | null;
  subscriptionExpiresAt: Date | null;
  subscriptionServiceStatus: string;
  subscriptionServiceStatusLabel: string;
};

const ARCHIVE_VIEW_FILTERS = [
  { key: "active", label: "进行中" },
  { key: "archived", label: "已归档" },
] as const;

type ArchiveViewKey = (typeof ARCHIVE_VIEW_FILTERS)[number]["key"];

const STATUS_FILTERS = [
  { key: "all", label: "全部" },
  { key: "needs_attention", label: "待处理" },
  { key: "in_service", label: "服务中" },
  { key: "report_ready", label: "可出报告" },
  { key: "renewal_risk", label: "有风险" },
] as const;

type FilterKey = (typeof STATUS_FILTERS)[number]["key"];

function matchFilter(project: ProjectSummary, filter: FilterKey): boolean {
  if (filter === "all") return true;
  const view = resolveClientProjectCardPrimaryAction({
    completionScore: project.completionScore,
    hasCompletedT0Baseline: project.hasCompletedT0Baseline,
    hasActiveMonthlyPlan: project.hasActiveMonthlyPlan,
    monthlyPlanCompletedCount: project.monthlyPlanCompletedCount,
    monthlyPlanTotalCount: project.monthlyPlanTotalCount,
    articleCount: project.articleCount,
    publishCount: project.publishCount,
    aiTestCount: project.aiTestCount,
    latestGeoScore: project.latestGeoScore,
    subscriptionServiceStatus: project.subscriptionServiceStatus,
  });
  switch (filter) {
    case "needs_attention":
      return view.needsAttention;
    case "in_service":
      return view.serviceActive;
    case "report_ready":
      return view.reportReady;
    case "renewal_risk":
      return view.renewalRisk;
    default:
      return true;
  }
}

function businessStats(projects: ProjectSummary[]) {
  const views = projects.map(project =>
    resolveClientProjectCardPrimaryAction({
      completionScore: project.completionScore,
      hasCompletedT0Baseline: project.hasCompletedT0Baseline,
      hasActiveMonthlyPlan: project.hasActiveMonthlyPlan,
      monthlyPlanCompletedCount: project.monthlyPlanCompletedCount,
      monthlyPlanTotalCount: project.monthlyPlanTotalCount,
      articleCount: project.articleCount,
      publishCount: project.publishCount,
      aiTestCount: project.aiTestCount,
      latestGeoScore: project.latestGeoScore,
      subscriptionServiceStatus: project.subscriptionServiceStatus,
    }),
  );
  return {
    total: projects.length,
    inService: views.filter(view => view.serviceActive).length,
    needsAttention: views.filter(view => view.needsAttention).length,
    reportReady: views.filter(view => view.reportReady).length,
    renewalRisk: views.filter(view => view.renewalRisk).length,
  };
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: typeof UsersRound;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" data-testid="client-business-metric">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-950">{value}</p>
        </div>
        <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-gray-500">{hint}</p>
    </div>
  );
}

function ProjectCard({
  project,
  onEnter,
  showArchived,
  onArchive,
  onUnarchive,
  archivePending,
}: {
  project: ProjectSummary;
  onEnter: (id: number) => void;
  showArchived: boolean;
  onArchive: (id: number) => void;
  onUnarchive: (id: number) => void;
  archivePending: boolean;
}) {
  const [, setLocation] = useLocation();
  const primaryAction = resolveClientProjectCardPrimaryAction({
    completionScore: project.completionScore,
    hasCompletedT0Baseline: project.hasCompletedT0Baseline,
    hasActiveMonthlyPlan: project.hasActiveMonthlyPlan,
    monthlyPlanCompletedCount: project.monthlyPlanCompletedCount,
    monthlyPlanTotalCount: project.monthlyPlanTotalCount,
    articleCount: project.articleCount,
    publishCount: project.publishCount,
    aiTestCount: project.aiTestCount,
    latestGeoScore: project.latestGeoScore,
    subscriptionServiceStatus: project.subscriptionServiceStatus,
  });
  const sampleRetestInProgress = project.id === 210001 && project.publishCount > 0;
  const pipelineBadgeLabel = sampleRetestInProgress ? "收录与 AI 复测" : primaryAction.stageLabel;
  const serviceHomeUrl = buildProjectUrl("/workspace", project.id);
  const nextStep = sampleRetestInProgress ? "07/12 收录初查与 T2 轻量复测" : primaryAction.nextStepHint;
  const subscriptionStatus = (project.subscriptionServiceStatus ?? "not_configured") as SubscriptionServiceStatus;
  const subscriptionExpiryLabel = formatSubscriptionExpiryLabel(
    project.subscriptionExpiresAt,
    subscriptionStatus,
  );
  const riskLabel = primaryAction.riskLabels.length > 0 ? primaryAction.riskLabels.join("、") : "暂无明显风险";
  const reportReadyLabel = primaryAction.reportReady ? "可出报告" : "报告待积累";
  const reportReadyClass = primaryAction.reportReady
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-gray-200 bg-gray-50 text-gray-600";
  const aiVisibilityLabel =
    project.latestGeoScore != null
      ? `${Math.round(project.latestGeoScore)} 分`
      : project.aiTestCount > 0
        ? "已有实测"
        : "待实测";

  return (
    <article
      className="geo-card-interactive flex flex-col justify-between p-5"
      data-testid="client-project-card"
      onClick={() => onEnter(project.id)}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="truncate text-[15px] font-semibold text-gray-900">{project.enterpriseName}</h3>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className={cn(stageBadgeClass(pipelineBadgeLabel))}
            data-testid="client-project-pipeline-step"
          >
            {pipelineBadgeLabel}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                data-testid="client-project-card-menu"
                aria-label="项目操作"
                onClick={e => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 rounded-xl" onClick={e => e.stopPropagation()}>
              <DropdownMenuItem
                disabled
                className="flex-col items-start gap-0 text-xs"
                data-testid="client-project-subscription"
              >
                <span>套餐：{project.subscriptionPlanName ?? "未开通"}</span>
                <span className="text-gray-400">
                  {project.subscriptionServiceStatusLabel} · 到期 {subscriptionExpiryLabel}
                </span>
              </DropdownMenuItem>
              {showArchived ? (
                <DropdownMenuItem
                  className="cursor-pointer"
                  data-testid="client-project-unarchive"
                  disabled={archivePending}
                  onClick={() => onUnarchive(project.id)}
                >
                  <ArchiveRestore className="mr-2 h-4 w-4" />
                  取消归档
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="cursor-pointer"
                  data-testid="client-project-archive"
                  disabled={archivePending}
                  onClick={() => onArchive(project.id)}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  归档
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mb-4 grid gap-2 rounded-lg border border-gray-100 bg-white px-3 py-3" data-testid="client-project-service-summary">
        <div className="grid grid-cols-[5rem_1fr] gap-2 text-[12px] leading-5">
          <span className="font-medium text-gray-500">当前阶段</span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-gray-900">
            <span className={cn("size-2 rounded-full", sampleRetestInProgress ? "bg-blue-500" : "bg-amber-500")} aria-hidden />
            {pipelineBadgeLabel}
          </span>
        </div>
        <div className="grid grid-cols-[5rem_1fr] gap-2 text-[12px] leading-5" data-testid="client-project-ai-visibility">
          <span className="font-medium text-gray-500">AI 可见度</span>
          <span className="font-semibold text-gray-900">{aiVisibilityLabel}</span>
        </div>
        <div className="grid grid-cols-[5rem_1fr] gap-2 text-[12px] leading-5">
          <span className="font-medium text-gray-500">是否有风险</span>
          <span className={primaryAction.riskLabels.length > 0 ? "font-semibold text-amber-800" : "text-gray-700"}>
            {riskLabel}
          </span>
        </div>
        <p className="text-[12px] leading-5 text-gray-600" data-testid="client-project-main-problem">
          <span className="font-medium text-gray-500">风险说明：</span>
          {primaryAction.majorProblem}
        </p>
        <p className="text-[12px] leading-5 text-gray-600" data-testid="client-project-monthly-progress">
          <span className="font-medium text-gray-500">是否可出报告：</span>
          {reportReadyLabel}
        </p>
        <p className="text-[12px] leading-5 text-gray-600" data-testid="client-project-next-step">
          <span className="font-medium text-gray-500">下一步：</span>
          {nextStep}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5" data-testid="client-project-risk-tags">
        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", reportReadyClass)}>
          {reportReadyLabel}
        </span>
      </div>

      <div className="mt-auto">
        <button
          type="button"
          className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition-all hover:bg-blue-100"
          data-testid="enter-workspace-button"
          onClick={e => {
            e.stopPropagation();
            setLocation(serviceHomeUrl);
          }}
        >
          进入服务首页
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
  const [archiveView, setArchiveView] = useState<ArchiveViewKey>("active");
  const [statusFilter, setStatusFilter] = useState<FilterKey>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateProjectForm>(emptyCreateForm);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const showArchived = archiveView === "archived";
  const { data: projects = [], isLoading } = trpc.geo.clientDashboard.listProjectsSummary.useQuery({
    archived: showArchived,
  });
  const subscriptionUsageQuery = trpc.geo.subscription.usage.useQuery();
  const projectLimitReached = subscriptionUsageQuery.data?.atLimit.project ?? false;
  const createProject = trpc.geo.projects.create.useMutation();
  const archiveProject = trpc.geo.projects.archive.useMutation();
  const unarchiveProject = trpc.geo.projects.unarchive.useMutation();
  const archivePending = archiveProject.isPending || unarchiveProject.isPending;
  const dangerousConfirm = useDangerousActionConfirm();

  const filtered = useMemo(() => {
    return projects.filter(p => {
      const q = search.trim().toLowerCase();
      const matchesSearch = !q || p.enterpriseName.toLowerCase().includes(q);
      const matchesStatus = matchFilter(p, statusFilter);
      return matchesSearch && matchesStatus;
    });
  }, [projects, search, statusFilter]);

  const stats = useMemo(() => businessStats(projects), [projects]);

  const handleEnter = (projectId: number) => {
    activateProject(projectId);
    setLocation(buildProjectUrl("/workspace", projectId));
  };

  async function invalidateProjectLists() {
    await Promise.all([
      utils.geo.clientDashboard.listProjectsSummary.invalidate(),
      utils.geo.projects.list.invalidate(),
    ]);
  }

  async function handleArchive(projectId: number) {
    try {
      await archiveProject.mutateAsync({ id: projectId });
      await invalidateProjectLists();
      toast.success("项目已归档，可在「已归档」中查看");
    } catch (err) {
      console.error("[archive-client-project]", err);
      toast.error("归档失败，请稍后重试");
    }
  }

  async function handleUnarchive(projectId: number) {
    try {
      await unarchiveProject.mutateAsync({ id: projectId });
      await invalidateProjectLists();
      toast.success("已取消归档，项目回到进行中列表");
    } catch (err) {
      console.error("[unarchive-client-project]", err);
      toast.error("取消归档失败，请稍后重试");
    }
  }

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
      activateProject(created.id);
      setCreateOpen(false);
      setCreateForm(emptyCreateForm());
      toast.success("企业项目已创建，请按引导完成设置");
      setLocation(buildProjectUrl("/onboarding", created.id));
    } catch (err) {
      console.error("[create-client-project]", err);
      if (!handleSubscriptionLimitMutationError(err)) {
        toast.error(toUserFacingCreateProjectError(err));
      }
    }
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-6" data-testid="client-dashboard-page">
      <ClientsHubTopBar />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className={geoTypography.pageTitle}>客户 GEO 服务管理台</h1>
          <span className="sr-only">客户经营看板</span>
          <p className="max-w-2xl text-sm leading-relaxed text-gray-500">
            管理客户的 GEO 诊断、月度服务、执行进度、交付报告和续费风险。
          </p>
        </div>
        <Button
          className={cn("w-full shrink-0 rounded-xl px-5 py-2.5 sm:w-auto", geoP0Brand.primary)}
          data-testid="create-client-project-button"
          disabled={projectLimitReached}
          onClick={() => setCreateOpen(true)}
          style={whiteLabelPrimaryStyle}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          新建企业项目
        </Button>
      </div>

      {projectLimitReached ? (
        <SubscriptionUpgradePrompt
          message={SUBSCRIPTION_LIMIT_PROJECT_MESSAGE}
          testId="client-dashboard-project-limit"
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" data-testid="client-business-metrics">
        <StatCard label="客户总数" value={isLoading ? "—" : stats.total} hint="当前列表中的客户项目" icon={UsersRound} />
        <StatCard label="服务中客户" value={isLoading ? "—" : stats.inService} hint="已有月度优化计划或正在交付" icon={BarChart3} />
        <StatCard label="待处理客户" value={isLoading ? "—" : stats.needsAttention} hint="需要建档、诊断、发布或制定方案" icon={AlertTriangle} />
        <StatCard label="可出报告客户" value={isLoading ? "—" : stats.reportReady} hint="已有服务动作，可进入交付报告" icon={ClipboardCheck} />
        <StatCard label="有续费风险客户" value={isLoading ? "—" : stats.renewalRisk} hint="即将到期、已到期或服务暂停" icon={AlertTriangle} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-[380px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="搜索企业名称…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-xl border-gray-200 bg-white pl-10 shadow-sm transition-shadow focus:shadow-md"
            data-testid="client-dashboard-search"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" data-testid="client-dashboard-archive-filters">
          {ARCHIVE_VIEW_FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setArchiveView(f.key)}
              className={cn(
                "min-h-9 rounded-lg px-3.5 py-2 text-sm font-medium transition-all",
                archiveView === f.key
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-gray-900",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                "min-h-9 rounded-lg px-3.5 py-2 text-sm font-medium transition-all",
                statusFilter === f.key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-blue-200 hover:text-blue-700",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

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
              {showArchived
                ? search || statusFilter !== "all"
                  ? "没有匹配的已归档项目"
                  : "暂无已归档项目"
                : search || statusFilter !== "all"
                  ? "没有匹配的企业项目"
                  : "当前账号暂无可管理客户项目"}
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-gray-500">
              {showArchived
                ? search || statusFilter !== "all"
                  ? "请调整搜索条件或筛选状态。"
                  : "归档后的项目会显示在这里，可随时取消归档恢复为进行中。"
                : search || statusFilter !== "all"
                  ? "请调整搜索条件或筛选状态。"
                  : "请使用有客户数据的账号验证客户管理台，或先创建样板客户项目。"}
            </p>
          </div>
          {!search && statusFilter === "all" && !showArchived ? (
            <Button
              className={cn("rounded-xl px-5", geoP0Brand.primary)}
              data-testid="create-client-project-empty-button"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              新建企业项目
            </Button>
          ) : null}
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-5",
            filtered.length === 1
              ? "grid-cols-1 max-w-[560px]"
              : filtered.length === 2
                ? "grid-cols-1 sm:grid-cols-2 max-w-[1080px]"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
          )}
        >
          {filtered.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onEnter={handleEnter}
              showArchived={showArchived}
              onArchive={id =>
                dangerousConfirm.requestConfirm(DANGEROUS_ACTION_LABELS.archiveProject, () => handleArchive(id))
              }
              onUnarchive={id => void handleUnarchive(id)}
              archivePending={archivePending}
            />
          ))}
        </div>
      )}

      <DangerousActionConfirmDialog {...dangerousConfirm.dialogProps} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          className="rounded-2xl border-gray-200 bg-white text-gray-900 shadow-xl sm:max-w-md"
          data-testid="create-client-project-dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">新建企业项目</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              仅填写基础信息即可创建；详细品牌资料请在建档页完善。
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
              {createProject.isPending ? "创建中…" : "创建并去建档"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
