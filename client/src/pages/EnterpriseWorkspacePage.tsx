import { GeoGrowthSuggestionsPanel } from "@/components/geo/GeoGrowthSuggestionsPanel";
import { GeoScoreTrendChart } from "@/components/geo/GeoScoreTrendChart";
import { GeoScoreWeightExplanationHelp } from "@/components/geo/GeoScoreWeightExplanationHelp";
import { RetestDueReminderCard } from "@/components/diagnosis/RetestDueReminderCard";
import { T0ContentGapSuggestionsCard } from "@/components/geo/T0ContentGapSuggestionsCard";
import { FirstUseHintBanner } from "@/components/FirstUseHintBanner";
import { PLATFORM_PRODUCT_NAME } from "@/components/auth/authMarketing";
import { P0Card } from "@/components/geo/P0UiPrimitives";
import { WorkspaceDashboardOverviewCards } from "@/components/project/WorkspaceDashboardOverviewCards";
import { WorkspaceInclusionMonitoringSection } from "@/components/workspace/WorkspaceInclusionMonitoringSection";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { useGeoGrowthSuggestions } from "@/hooks/useGeoGrowthSuggestions";
import { useWorkspaceHomeDisplay } from "@/hooks/useWorkspaceHomeDisplay";
import { buildProjectUrl } from "@/lib/activeProject";
import { FIRST_USE_HINT_KEYS } from "@/lib/firstUseHints";
import { geoP0Brand, geoTypography, stageBadgeClass } from "@/lib/geoP0Visual";
import { useLocalAgentConnection } from "@/hooks/useLocalAgentConnection";
import {
  formatGeoScore,
} from "@/lib/projectWorkspaceDisplay";
import {
  resolveWorkspaceCustomerStatusLabel,
  workspaceHasAiTestData,
} from "@shared/workspaceCustomerDisplay";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  buildWorkspaceDeliveryConclusion,
  formatDeliveryStageCustomerLabel,
  resolveDeliveryPhaseCustomerView,
  resolveDeliveryStageView,
} from "@/lib/deliveryStage";
import { WEEKLY_PENDING_CONTENT_TAB_NEEDS_MODIFY } from "@shared/workspaceRiskHints";
import { appendWeeklyContentEntryParams } from "@shared/weeklyContentEntryContext";
import {
  resolveMainChainSteps,
  toMainChainProgressInput,
  type MainChainStepView,
} from "@shared/workspaceMainChain";
import {
  buildGeoScoreAttributionLines,
  buildGeoScoreChangeReason,
  formatGeoScoreChangeBadge,
  formatWorkspacePublishCount,
  workspaceAiMentionRateHint,
} from "@shared/workspaceDashboardOverview";
import { resolveWorkspaceStagePrimaryAction } from "@shared/workspacePrimaryAction";
import { resolveWorkspaceStage, workspaceCtaUrl } from "@shared/workspaceStateMachine";
import type { WorkspaceTodayTask, WorkspaceTodayTaskStatus } from "@shared/workspaceTodayTasks";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bot,
  ChevronDown,
  Globe,
  MessageCircleQuestion,
  RefreshCw,
  ShieldCheck,
  Target,
} from "lucide-react";
import { useEffect, useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";

const MATURITY_DIMENSION_ICONS: Record<string, typeof BadgeCheck> = {
  brandIdentity: BadgeCheck,
  categoryPositioning: Target,
  questionCoverage: MessageCircleQuestion,
  sourceGraph: Globe,
  trustEvidence: ShieldCheck,
  aiTestPerformance: Bot,
};

export default function EnterpriseWorkspacePage() {
  const [, setLocation] = useLocation();
  const { selectedProjectId, selectedProject, projectInput, enabled, projectsLoading } =
    useActiveProjectSelection();
  const summaryQuery = trpc.geo.workspace.summary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );
  const scoreTrendQuery = trpc.geo.scores.recent.useQuery(projectInput, {
    enabled: Boolean(selectedProjectId),
  });
  const feedbackSummaryQuery = trpc.geo.feedbackLoop.getRetestFeedbackSummary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );
  const completenessReportQuery = trpc.geo.onboarding.getCompletenessReport.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );
  const maturityReportQuery = trpc.geo.maturity.getMaturityReport.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );
  const monthlyPlanQuery = trpc.geo.monthlyPlan.getCurrent.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );
  const calculateMaturityMutation = trpc.geo.maturity.calculateAndSave.useMutation({
    onSuccess: () => {
      void maturityReportQuery.refetch();
    },
  });

  useEffect(() => {
    const enterpriseName = selectedProject?.enterpriseName?.trim() || "企业";
    document.title = `${enterpriseName} - 项目工作台`;
  }, [selectedProject?.enterpriseName]);

  const { localAgentOnline, status: localAgentConnectionStatus, accountSnapshot } =
    useLocalAgentConnection({
      boundPublishAccountCount: summaryQuery.data?.boundPublishAccountCount ?? 0,
    });

  const resolution = useMemo(() => {
    const m = summaryQuery.data;
    if (!m || !selectedProjectId) return null;
    return resolveWorkspaceStage({
      ...m,
      localAgentOnline,
      localAgentConnectionStatus,
      localAccountSnapshotEmpty: accountSnapshot.length === 0,
    });
  }, [summaryQuery.data, selectedProjectId, localAgentOnline, localAgentConnectionStatus, accountSnapshot]);

  const metrics = summaryQuery.data;
  const homeDisplay = useWorkspaceHomeDisplay(selectedProjectId, metrics);
  const growthSuggestions = useGeoGrowthSuggestions(selectedProjectId, Boolean(selectedProjectId));
  const stage = resolution?.currentStage;
  const stageLabel = useMemo(() => {
    if (!stage || !metrics) return null;
    const maturityScore = maturityReportQuery.data?.totalScore ?? null;
    const monthlyPlanStage =
      maturityScore != null && maturityScore > 0
        ? (monthlyPlanQuery.data?.planPhase ??
          (monthlyPlanQuery.data === null ? "none" : null))
        : null;
    return resolveWorkspaceCustomerStatusLabel({
      stageId: stage.id,
      monthlyPlanStage,
      hasAiTestData: workspaceHasAiTestData(metrics),
      hasCompletedT0Baseline: metrics.hasCompletedT0Baseline,
    });
  }, [stage, metrics, maturityReportQuery.data?.totalScore, monthlyPlanQuery.data]);
  const deliveryStage = useMemo(() => {
    if (!metrics) return null;
    return resolveDeliveryStageView({ ...metrics, localAgentOnline });
  }, [metrics, localAgentOnline]);
  const deliveryPhase = useMemo(
    () => (deliveryStage ? resolveDeliveryPhaseCustomerView(deliveryStage.stage) : null),
    [deliveryStage],
  );
  const stagePrimaryAction = useMemo(() => {
    if (!metrics) return null;
    const maturityScore = maturityReportQuery.data?.totalScore ?? null;
    const monthlyPlanStage =
      maturityScore != null && maturityScore > 0
        ? (monthlyPlanQuery.data?.planPhase ??
          (monthlyPlanQuery.data === null ? "none" : null))
        : null;
    return resolveWorkspaceStagePrimaryAction({
      profileCompletionPercent: metrics.profileCompletionPercent,
      hasCompletedT0Baseline: metrics.hasCompletedT0Baseline,
      articleCount: metrics.articleCount,
      pendingPublishContentCount: metrics.pendingPublishContentCount ?? 0,
      publishRecordCount: metrics.publishRecordCount,
      publishTaskCount: metrics.publishTaskCount,
      lowQualityArticleCount: metrics.lowQualityArticleCount,
      rewriteOpenCount: metrics.rewriteOpenCount,
      maturityTotalScore: maturityScore,
      pendingReviewCount: metrics.pendingReviewCount,
      monthlyPlanStage,
    });
  }, [metrics, maturityReportQuery.data?.totalScore, monthlyPlanQuery.data]);
  const deliveryConclusion = useMemo(() => {
    if (stagePrimaryAction?.reason) return stagePrimaryAction.reason;
    if (!deliveryStage) return null;
    return buildWorkspaceDeliveryConclusion(deliveryStage, {
      mainChainReason: homeDisplay.mainChainNextAction?.reason,
      blockerReason: resolution?.blockerReasons[0],
    });
  }, [
    stagePrimaryAction?.reason,
    deliveryStage,
    homeDisplay.mainChainNextAction?.reason,
    resolution?.blockerReasons,
  ]);

  const mainChainSteps = useMemo((): MainChainStepView[] => {
    if (!metrics) return [];
    return resolveMainChainSteps(toMainChainProgressInput(metrics));
  }, [metrics]);

  const scoreTrendPoints = useMemo(
    () =>
      ((scoreTrendQuery.data ?? []) as { totalScore: number; createdAt?: Date | string | null }[]).map(
        row => ({
          totalScore: row.totalScore,
          createdAt: row.createdAt ?? new Date(0),
        }),
      ),
    [scoreTrendQuery.data],
  );
  const latestTrendScore = scoreTrendPoints.length > 0 ? scoreTrendPoints[scoreTrendPoints.length - 1]!.totalScore : null;
  const previousTrendScore = scoreTrendPoints.length > 1 ? scoreTrendPoints[scoreTrendPoints.length - 2]!.totalScore : null;
  const geoScoreChangeText = formatGeoScoreChangeBadge({
    latestScore: latestTrendScore,
    previousScore: previousTrendScore,
  });
  const geoScoreChangeReason = metrics && geoScoreChangeText ? buildGeoScoreChangeReason(metrics) : null;
  const geoScoreAttributions = metrics ? buildGeoScoreAttributionLines(metrics) : [];

  const headerCtaPath =
    stagePrimaryAction && selectedProjectId
      ? buildProjectUrl(stagePrimaryAction.ctaPath, selectedProjectId)
      : homeDisplay.mainChainNextAction?.ctaPath ??
        (stage && selectedProjectId ? workspaceCtaUrl(selectedProjectId, stage) : null);
  const headerCtaLabel =
    stagePrimaryAction?.ctaLabel ??
    homeDisplay.mainChainNextAction?.ctaLabel ??
    stage?.ctaLabel;
  const todayTasks = metrics?.todayTasks ?? [];
  const monthlyTasks = todayTasks.slice(0, 5);
  const brandMentionRateHint = metrics ? workspaceAiMentionRateHint(metrics) : undefined;
  const publishOverview = useMemo(
    () => (metrics ? formatWorkspacePublishCount(metrics) : null),
    [metrics],
  );
  const maturityScoreDisplay =
    maturityReportQuery.isLoading || calculateMaturityMutation.isPending
      ? "计算中…"
      : maturityReportQuery.data
        ? `${maturityReportQuery.data.totalScore} 分`
        : "--";
  const publishedContentCount =
    metrics && metrics.publishRecordCount + metrics.completedPublishTaskCount > 0
      ? `${metrics.publishRecordCount + metrics.completedPublishTaskCount}`
      : metrics && metrics.articleCount > 0
        ? `${metrics.articleCount}`
        : "--";

  if (!enabled && !projectsLoading) {
    return (
      <div data-testid="workspace-page">
        <ProjectContextEmptyState testId="workspace-empty" />
      </div>
    );
  }

  return (
    <div className="space-y-7" data-testid="workspace-page">
      <FirstUseHintBanner
        storageKey={FIRST_USE_HINT_KEYS.workspace}
        message={`欢迎使用${PLATFORM_PRODUCT_NAME}，从左侧菜单开始你的第一步`}
        data-testid="first-use-hint-workspace"
      />
      {metrics?.retestDueReminder && selectedProjectId ? (
        <RetestDueReminderCard
          reminder={metrics.retestDueReminder}
          testId="workspace-retest-due-reminder"
          onGoRetest={() =>
            setLocation(buildProjectUrl(metrics.retestDueReminder!.ctaPath, selectedProjectId))
          }
        />
      ) : null}
      {summaryQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4" data-testid="workspace-dashboard-overview-loading">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="geo-card h-[88px] animate-pulse bg-gray-50" aria-hidden />
          ))}
        </div>
      ) : summaryQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>暂时无法加载工作台数据。</p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => {
              void summaryQuery.refetch();
              void scoreTrendQuery.refetch();
            }}
          >
            重试加载
          </Button>
        </div>
      ) : stage && metrics && selectedProjectId ? (
        <>
          <section
            className="geo-card border-2 border-blue-200 bg-gradient-to-br from-blue-50/80 via-white to-white p-6"
            data-testid="workspace-command-center"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-blue-600">交付指挥中心</p>
                <h1 className={cn(geoTypography.pageTitle, "mt-1")} data-testid="workspace-enterprise-name">
                  {selectedProject?.enterpriseName ?? "当前企业"}
                </h1>
              </div>
              {stageLabel ? <span className={stageBadgeClass(stageLabel)}>{stageLabel}</span> : null}
            </div>

            {deliveryPhase || stagePrimaryAction ? (
              <div className="mt-5" data-testid="workspace-delivery-phase">
                <p className="text-xs font-medium text-gray-500">当前阶段</p>
                <p className="mt-1 text-lg font-semibold text-gray-900" data-testid="workspace-current-stage-headline">
                  {stagePrimaryAction?.stageHeadline ?? deliveryPhase?.currentStageHeadline}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {stagePrimaryAction
                    ? `${stagePrimaryAction.phaseTitle} · ${stagePrimaryAction.phaseDescription}`
                    : `${deliveryPhase?.phaseTitle} · ${deliveryPhase?.phaseDescription}`}
                </p>
              </div>
            ) : null}

            {deliveryConclusion ? (
              <p className="mt-4 text-sm leading-relaxed text-gray-700" data-testid="workspace-delivery-conclusion">
                {deliveryConclusion}
              </p>
            ) : null}

            {resolution.riskHints.length > 0 ? (
              <div className="mt-3 space-y-2" data-testid="workspace-risk-tags">
                <div className="flex flex-wrap gap-2">
                  {resolution.riskHints.map(hint => (
                    <span
                      key={hint}
                      className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800"
                    >
                      <AlertTriangle className="size-3 shrink-0" aria-hidden />
                      {hint}
                    </span>
                  ))}
                </div>
                {(metrics?.rewriteOpenCount ?? 0) > 0 && selectedProjectId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 border-amber-300 text-xs text-amber-900"
                    data-testid="workspace-rewrite-quality-cta"
                    onClick={() =>
                      setLocation(
                        appendWeeklyContentEntryParams(buildProjectUrl("/weekly", selectedProjectId), {
                          pendingContentTab: WEEKLY_PENDING_CONTENT_TAB_NEEDS_MODIFY,
                        }),
                      )
                    }
                  >
                    去内容生产 · 需修改
                  </Button>
                ) : null}
              </div>
            ) : null}

            {headerCtaPath && headerCtaLabel ? (
              <Button
                type="button"
                className={cn("mt-5 rounded-xl px-6", geoP0Brand.primary)}
                data-testid="workspace-primary-cta"
                onClick={() => setLocation(headerCtaPath)}
              >
                {headerCtaLabel}
                <ArrowRight className="ml-2 size-4" />
              </Button>
            ) : null}

            <div className="mt-6" data-testid="workspace-priority-todos">
              <h2 className="text-sm font-semibold text-gray-900">本月任务进度</h2>
              {monthlyTasks.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500" data-testid="workspace-today-tasks-empty">
                  暂无待处理任务
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white">
                  {monthlyTasks.map(task => (
                    <MonthlyTaskRow
                      key={task.key}
                      task={task}
                      onAction={() => setLocation(task.targetPath)}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div
              className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
              data-testid="workspace-core-metrics"
            >
              <CoreMetricTile label="AI 品牌成熟度" value={maturityScoreDisplay} testId="workspace-core-maturity" />
              <CoreMetricTile
                label="品牌提及率"
                value={homeDisplay.brandMentionRateText}
                testId="workspace-core-mention-rate"
              />
              <CoreMetricTile
                label="已发布内容数"
                value={publishedContentCount}
                testId="workspace-core-published-count"
              />
              <CoreMetricTile
                label="最近检测时间"
                value={homeDisplay.lastAiTestLabel}
                testId="workspace-core-last-test"
              />
            </div>
          </section>

          <details className="group rounded-2xl border border-gray-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
                AI 品牌成熟度详情
              </span>
            </summary>
            <div className="border-t border-gray-100 px-5 pb-5 pt-2">
          <section
            className="border-0 bg-transparent p-0 shadow-none"
            data-testid="workspace-maturity-hero"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-blue-600">AI 品牌成熟度</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-blue-700">
                  {maturityReportQuery.isLoading || calculateMaturityMutation.isPending
                    ? "计算中…"
                    : maturityReportQuery.data
                      ? `${maturityReportQuery.data.totalScore} 分`
                      : "暂无评分"}
                </p>
                {maturityReportQuery.data ? (
                  <>
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      阶段：{maturityReportQuery.data.stage}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">{maturityReportQuery.data.stageDesc}</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">点击「重新计算」生成 AI 品牌成熟度评分</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-lg"
                  data-testid="workspace-maturity-view-report"
                  onClick={() => setLocation(buildProjectUrl("/maturity", selectedProjectId))}
                >
                  查看完整成熟度报告
                  <ArrowRight className="ml-1.5 size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={calculateMaturityMutation.isPending}
                  data-testid="workspace-maturity-recalculate"
                  onClick={() => calculateMaturityMutation.mutate({ projectId: selectedProjectId })}
                >
                  <RefreshCw className="mr-1.5 size-3.5" />
                  重新计算
                </Button>
              </div>
            </div>
            {maturityReportQuery.data ? (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {maturityReportQuery.data.dimensions.map(dimension => {
                  const Icon = MATURITY_DIMENSION_ICONS[dimension.key] ?? BadgeCheck;
                  return (
                    <div
                      key={dimension.key}
                      className="flex flex-col items-center rounded-xl border border-gray-100 bg-white p-3 text-center"
                      data-testid={`workspace-maturity-dimension-${dimension.key}`}
                    >
                      <Icon className="size-5 text-blue-500" aria-hidden />
                      <p className="mt-2 text-[10px] font-medium text-gray-500">{dimension.label}</p>
                      <p className="mt-0.5 text-sm font-bold tabular-nums text-gray-900">{dimension.score}</p>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
            </div>
          </details>

          <details className="group rounded-2xl border border-gray-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
                数据总览与经营结果
              </span>
            </summary>
            <div className="space-y-4 border-t border-gray-100 px-5 pb-5 pt-4">
          <WorkspaceDashboardOverviewCards
            metrics={metrics}
            latestGeoScore={latestTrendScore}
            previousGeoScore={previousTrendScore}
          />

          <section className="rounded-xl border border-gray-100 bg-gray-50 p-5" data-testid="workspace-business-results">
            <h2 className="text-sm font-semibold text-gray-900">经营结果</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div data-testid="workspace-last-retest">
                <p className="text-[11px] font-medium text-gray-400">上次复测</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">
                  {feedbackSummaryQuery.isLoading
                    ? "加载中…"
                    : feedbackSummaryQuery.data?.lastRetestAt
                      ? new Date(feedbackSummaryQuery.data.lastRetestAt).toLocaleString("zh-CN", {
                          hour12: false,
                        })
                      : "暂无复测记录"}
                </p>
              </div>
              <div data-testid="workspace-question-pool-coverage">
                <p className="text-[11px] font-medium text-gray-400">问题池覆盖率</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">
                  {feedbackSummaryQuery.isLoading
                    ? "加载中…"
                    : `${feedbackSummaryQuery.data?.questionPoolCoveragePercent ?? 0}%`}
                </p>
              </div>
              <div data-testid="workspace-source-consistency">
                <p className="text-[11px] font-medium text-gray-400">信源一致性</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">
                  {feedbackSummaryQuery.isLoading
                    ? "加载中…"
                    : `${feedbackSummaryQuery.data?.sourceConsistencyScore ?? 0} 分`}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2 border-t border-gray-100 pt-4" data-testid="workspace-profile-completeness">
              <p className="text-sm font-semibold text-gray-900">
                建档完整度：
                {completenessReportQuery.isLoading
                  ? "加载中…"
                  : `${completenessReportQuery.data?.totalScore ?? metrics.profileCompletionPercent ?? 0}%`}
              </p>
              <p className="text-sm text-gray-600">
                主要缺口：
                {completenessReportQuery.isLoading ? (
                  "加载中…"
                ) : (completenessReportQuery.data?.topMissingItems ?? []).length > 0 ? (
                  (completenessReportQuery.data?.topMissingItems ?? []).map(item => (
                    <span
                      key={item}
                      className="ml-1 inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900"
                    >
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="ml-1 text-gray-500">暂无显著缺口</span>
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                data-testid="workspace-go-complete-profile"
                onClick={() => setLocation(buildProjectUrl("/enterprise-profile", selectedProjectId))}
              >
                去完善建档
                <ArrowRight className="ml-1.5 size-3.5" />
              </Button>
            </div>
          </section>
            </div>
          </details>

          <details className="group rounded-2xl border border-gray-200 bg-white shadow-sm" data-testid="workspace-geo-score-trend">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
                GEO 分趋势
              </span>
            </summary>
            <div className="border-t border-gray-100 px-5 pb-5 pt-2">
            <GeoScoreTrendChart
              points={scoreTrendPoints}
              loading={scoreTrendQuery.isLoading}
              variant="light"
              data-testid="workspace-geo-score-trend-chart"
            />
            </div>
          </details>

          <details className="group rounded-2xl border border-gray-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
                收录监测明细
              </span>
            </summary>
            <div className="border-t border-gray-100 px-5 pb-5 pt-2">
          <WorkspaceInclusionMonitoringSection
            loading={homeDisplay.inclusionMonitoringLoading}
            platformRows={homeDisplay.inclusionPlatformRows}
            publishRecordCount={homeDisplay.publishRecordCount}
            monitoringRecordCount={homeDisplay.monitoringRecordCount}
            onOpenMonitoring={() =>
              setLocation(buildProjectUrl("/inclusion-monitoring", selectedProjectId))
            }
            onOpenPublishing={() =>
              setLocation(buildProjectUrl("/content-publishing", selectedProjectId))
            }
          />
            </div>
          </details>

          {metrics.t0ContentGapSuggestions ? (
            <T0ContentGapSuggestionsCard
              projectId={selectedProjectId}
              suggestions={metrics.t0ContentGapSuggestions}
            />
          ) : null}

          <details className="group rounded-2xl border border-gray-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
                增长建议
              </span>
            </summary>
            <div className="border-t border-gray-100 px-5 pb-5 pt-2">
              <GeoGrowthSuggestionsPanel
                projectId={selectedProjectId}
                suggestions={growthSuggestions.suggestions}
                loading={growthSuggestions.loading}
                variant="card"
              />
            </div>
          </details>

          <details className="group rounded-2xl border border-gray-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
                交付进度明细
              </span>
            </summary>
            <div className="border-t border-gray-100 px-5 pb-5 pt-4">
          <section className="p-0 shadow-none" data-testid="workspace-main-chain-progress">
            {deliveryStage ? (
              <div
                className="mb-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4"
                data-testid="workspace-delivery-stage-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-blue-900">
                    当前阶段：{deliveryStage.stageLabel}
                  </p>
                  <span className="text-xs text-blue-700" data-testid="workspace-delivery-stage-badge">
                    {formatDeliveryStageCustomerLabel(deliveryStage.stage)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-blue-800">{deliveryStage.stageDescription}</p>
                {deliveryStage.blockingReasons.length > 0 ? (
                  <p className="mt-2 text-xs text-blue-700">
                    阻断原因：{deliveryStage.blockingReasons.join("；")}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-700">
                  {deliveryStage.todos.map(todo => (
                    <span key={todo} className="rounded-full border border-gray-200 bg-white px-2.5 py-1">
                      {todo}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(deliveryStage?.progressSteps ?? mainChainSteps).map(step => (
                <button
                  key={"id" in step ? step.id : step.key}
                  type="button"
                  onClick={() =>
                    "path" in step
                      ? setLocation(buildProjectUrl(step.path, selectedProjectId))
                      : null
                  }
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[12px] font-medium transition-colors sm:text-[13px]",
                    step.done
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                      : "border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50",
                  )}
                  data-testid={`main-chain-step-${"step" in step ? step.step : step.key}`}
                >
                  <span aria-hidden className="shrink-0">{step.done ? "✅" : "⏳"}</span>
                  <span className="min-w-0 leading-snug">
                    {"shortLabel" in step && typeof step.shortLabel === "string" ? (
                      <>
                        <span className="sm:hidden">{step.shortLabel}</span>
                        <span className="hidden sm:inline">{"name" in step ? step.name : step.label}</span>
                      </>
                    ) : (
                      ("name" in step ? step.name : step.label)
                    )}
                  </span>
                </button>
              ))}
            </div>
          </section>
            </div>
          </details>

          <details className="group rounded-2xl border border-gray-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
                更多指标明细
              </span>
            </summary>
            <div className="border-t border-gray-100 px-5 pb-5 pt-4">
          <section className="p-0 shadow-none" data-testid="workspace-header-card">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
              <MetricCell
                label="GEO 分"
                value={formatGeoScore(metrics.geoScore)}
                labelSuffix={<GeoScoreWeightExplanationHelp />}
                hintLines={[
                  geoScoreChangeText ? `${geoScoreChangeText} · ${geoScoreChangeReason}` : null,
                  ...geoScoreAttributions,
                ].filter((line): line is string => Boolean(line))}
              />
              <MetricCell
                label="品牌提及率"
                value={homeDisplay.brandMentionRateText}
                hintLines={brandMentionRateHint ? [brandMentionRateHint] : []}
              />
              <MetricCell label="推荐率" value={homeDisplay.recommendRateText} />
              <MetricCell label="最近实测" value={homeDisplay.lastAiTestLabel} />
              <MetricCell
                label="内容资产"
                value={metrics.articleCount > 0 ? `${metrics.articleCount} 篇` : "--"}
              />
              <MetricCell
                label="发布记录"
                value={
                  publishOverview && metrics.publishRecordCount + metrics.completedPublishTaskCount > 0
                    ? publishOverview.text.replace("次", " 次")
                    : "--"
                }
                hintLines={publishOverview?.hint ? [publishOverview.hint] : []}
              />
            </div>
          </section>
            </div>
          </details>
        </>
      ) : metrics === undefined && selectedProjectId ? (
        <P0Card testId="workspace-profile-zero" className="py-12 text-center">
          <p className="text-sm leading-relaxed text-gray-600">
            请先完成品牌资料建档，让系统了解您的企业。
          </p>
          <Button
            type="button"
            className={cn("mt-4 rounded-xl", geoP0Brand.primary)}
            onClick={() => setLocation(buildProjectUrl("/enterprise-profile", selectedProjectId))}
          >
            去建档
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </P0Card>
      ) : null}
    </div>
  );
}

function MonthlyTaskRow({
  task,
  onAction,
}: {
  task: WorkspaceTodayTask;
  onAction: () => void;
}) {
  return (
    <li
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
      data-testid={`workspace-today-task-${task.key}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{task.title}</p>
        <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{task.reason}</p>
      </div>
      <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium", monthlyTaskStatusBadge(task.status))}>
        {monthlyTaskStatusLabel(task.status)}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0"
        disabled={task.status === "blocked"}
        data-testid={`workspace-today-task-action-${task.key}`}
        onClick={onAction}
      >
        {task.actionLabel}
      </Button>
    </li>
  );
}

function monthlyTaskStatusLabel(status: WorkspaceTodayTaskStatus): string {
  if (status === "done") return "已完成";
  if (status === "ready") return "进行中";
  return "待完成";
}

function monthlyTaskStatusBadge(status: WorkspaceTodayTaskStatus): string {
  if (status === "done") return "bg-emerald-100 text-emerald-800";
  if (status === "ready") return "bg-blue-100 text-blue-800";
  return "bg-amber-100 text-amber-800";
}

function CoreMetricTile({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 text-center" data-testid={testId}>
      <p className="text-[11px] font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">{value}</p>
    </div>
  );
}

function MetricCell({
  label,
  value,
  labelSuffix,
  hintLines = [],
}: {
  label: string;
  value: string;
  labelSuffix?: ReactNode;
  hintLines?: string[];
}) {
  return (
    <div data-testid={label === "GEO 分" ? "workspace-geo-score-metric" : undefined}>
      <div className="flex items-center gap-0.5">
        <p className="text-[11px] font-medium text-gray-400">{label}</p>
        {labelSuffix}
      </div>
      <p className="mt-0.5 text-base font-bold tabular-nums tracking-tight text-gray-900">{value}</p>
      {hintLines.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-[11px] leading-4 text-gray-500">
          {hintLines.map((line, index) => (
            <li key={`${label}-${index}`}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
