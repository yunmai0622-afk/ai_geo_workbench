import { GeoScoreTrendChart } from "@/components/geo/GeoScoreTrendChart";
import { GeoScoreWeightExplanationHelp } from "@/components/geo/GeoScoreWeightExplanationHelp";
import { RetestDueReminderCard } from "@/components/diagnosis/RetestDueReminderCard";
import { T0ContentGapSuggestionsCard } from "@/components/geo/T0ContentGapSuggestionsCard";
import { FirstUseHintBanner } from "@/components/FirstUseHintBanner";
import { P0Card } from "@/components/geo/P0UiPrimitives";
import { WorkspaceDashboardOverviewCards } from "@/components/project/WorkspaceDashboardOverviewCards";
import { WorkspaceInclusionMonitoringSection } from "@/components/workspace/WorkspaceInclusionMonitoringSection";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { useWorkspaceHomeDisplay } from "@/hooks/useWorkspaceHomeDisplay";
import { buildProjectUrl } from "@/lib/activeProject";
import { FIRST_USE_HINT_KEYS } from "@/lib/firstUseHints";
import { geoP0Brand, geoTypography, stageBadgeClass } from "@/lib/geoP0Visual";
import { useLocalAgentConnection } from "@/hooks/useLocalAgentConnection";
import {
  CUSTOMER_STAGE_LABELS,
  formatGeoScore,
} from "@/lib/projectWorkspaceDisplay";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatDeliveryStageCustomerLabel, resolveDeliveryStageView } from "@/lib/deliveryStage";
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
import { resolveWorkspaceStage, workspaceCtaUrl } from "@shared/workspaceStateMachine";
import type { WorkspaceTodayTask, WorkspaceTodayTaskStatus } from "@shared/workspaceTodayTasks";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useEffect, useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";

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
  const stage = resolution?.currentStage;
  const stageLabel = stage ? CUSTOMER_STAGE_LABELS[stage.id] : null;
  const deliveryStage = useMemo(() => {
    if (!metrics) return null;
    return resolveDeliveryStageView({ ...metrics, localAgentOnline });
  }, [metrics, localAgentOnline]);

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
    homeDisplay.mainChainNextAction?.ctaPath ??
    (stage && selectedProjectId ? workspaceCtaUrl(selectedProjectId, stage) : null);
  const headerCtaLabel = homeDisplay.mainChainNextAction?.ctaLabel ?? stage?.ctaLabel;
  const todayTasks = metrics?.todayTasks ?? [];
  const brandMentionRateHint = metrics ? workspaceAiMentionRateHint(metrics) : undefined;
  const publishOverview = useMemo(
    () => (metrics ? formatWorkspacePublishCount(metrics) : null),
    [metrics],
  );

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
        message="欢迎使用GEO增长工作台，从左侧菜单开始你的第一步"
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
          <section className="geo-card p-4" data-testid="workspace-priority-todos">
            <h2 className="text-sm font-semibold text-gray-900">本周待办 / 今日动作</h2>
            {todayTasks.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500" data-testid="workspace-today-tasks-empty">
                暂无待处理任务
              </p>
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {todayTasks.map(task => (
                  <TodayTaskCard
                    key={task.key}
                    task={task}
                    onAction={() => setLocation(task.targetPath)}
                  />
                ))}
              </div>
            )}
          </section>

          <WorkspaceDashboardOverviewCards
            metrics={metrics}
            latestGeoScore={latestTrendScore}
            previousGeoScore={previousTrendScore}
          />

          <section className="geo-card p-5" data-testid="workspace-business-results">
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

          <section className="geo-card p-5" data-testid="workspace-geo-score-trend">
            <GeoScoreTrendChart
              points={scoreTrendPoints}
              loading={scoreTrendQuery.isLoading}
              variant="light"
              data-testid="workspace-geo-score-trend-chart"
            />
          </section>

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

          {metrics.t0ContentGapSuggestions ? (
            <T0ContentGapSuggestionsCard
              projectId={selectedProjectId}
              suggestions={metrics.t0ContentGapSuggestions}
            />
          ) : null}

          {/* ═══ 8 步主链路进度 ═══ */}
          <section className="geo-card p-5" data-testid="workspace-main-chain-progress">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-gray-400">交付指挥中心</p>
                <h1 className={cn(geoTypography.pageTitle, "mt-0.5")} data-testid="workspace-enterprise-name">
                  {selectedProject?.enterpriseName ?? "当前企业"}
                </h1>
              </div>
              {stageLabel ? <span className={stageBadgeClass(stageLabel)}>{stageLabel}</span> : null}
            </div>
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

          {/* ═══ 数据摘要 + 快速操作 ═══ */}
          <section className="geo-card p-6" data-testid="workspace-header-card">
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

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
              {resolution.riskHints.length > 0 ? (
                <div className="flex items-center gap-2 text-[13px] text-amber-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{resolution.riskHints[0]}</span>
                </div>
              ) : (
                <span className="text-[13px] text-gray-400">
                  {homeDisplay.mainChainNextAction?.reason ?? resolution.blockerReasons[0]}
                </span>
              )}
              {headerCtaPath && headerCtaLabel ? (
                <Button
                  type="button"
                  className={cn("rounded-xl px-5", geoP0Brand.primary)}
                  data-testid="workspace-primary-cta"
                  onClick={() => setLocation(headerCtaPath)}
                >
                  {headerCtaLabel}
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              ) : null}
            </div>
          </section>
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

function TodayTaskCard({
  task,
  onAction,
}: {
  task: WorkspaceTodayTask;
  onAction: () => void;
}) {
  const palette = todayTaskPalette(task.status);
  return (
    <div
      className={cn("rounded-lg border p-3", palette.card)}
      data-testid={`workspace-today-task-${task.key}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900">{task.title}</p>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", palette.badge)}>
          {todayTaskStatusLabel(task.status)}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-600">
        {task.count > 0 ? `${task.count} 项 · ` : ""}
        {task.reason}
      </p>
      <Button
        type="button"
        size="sm"
        className={cn("mt-2", palette.button)}
        disabled={task.status === "blocked"}
        data-testid={`workspace-today-task-action-${task.key}`}
        onClick={onAction}
      >
        {task.actionLabel}
      </Button>
    </div>
  );
}

function todayTaskStatusLabel(status: WorkspaceTodayTaskStatus): string {
  if (status === "blocked") return "待前置";
  if (status === "todo") return "待处理";
  if (status === "ready") return "可执行";
  return "已完成";
}

function todayTaskPalette(status: WorkspaceTodayTaskStatus) {
  if (status === "blocked") {
    return {
      card: "border-gray-200 bg-gray-50",
      badge: "bg-gray-100 text-gray-600",
      button: "bg-gray-300 text-gray-500",
    };
  }
  if (status === "todo") {
    return {
      card: "border-amber-200 bg-amber-50",
      badge: "bg-amber-100 text-amber-800",
      button: "bg-amber-600 text-white hover:bg-amber-700",
    };
  }
  return {
    card: "border-blue-200 bg-blue-50",
    badge: "bg-blue-100 text-blue-800",
    button: "bg-blue-600 text-white hover:bg-blue-700",
  };
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
