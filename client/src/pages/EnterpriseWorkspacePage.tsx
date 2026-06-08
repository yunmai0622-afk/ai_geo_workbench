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
import { resolveDeliveryStageView } from "@/lib/deliveryStage";
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
import { AlertTriangle, ArrowRight, CheckCircle2, Clock } from "lucide-react";
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
  const waitingLinkCount = metrics?.waitingPublicLinkCount ?? 0;
  const waitingPublishQueueCount = Math.max(
    0,
    (metrics?.articleCount ?? 0) - (metrics?.publishTaskCount ?? 0) - (metrics?.publishRecordCount ?? 0),
  );
  const showRetestTodo = Boolean((metrics?.publishRecordWithPublicUrlCount ?? 0) > 0);
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
    <div className="space-y-5" data-testid="workspace-page">
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
            <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-gray-100" aria-hidden />
          ))}
        </div>
      ) : summaryQuery.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
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
          {/* ═══ 区块一：当前交付阶段 ═══ */}
          <section
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            data-testid="workspace-delivery-stage-card"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-400">客户项目</p>
                <h1 className="mt-1 text-xl font-bold text-gray-900" data-testid="workspace-enterprise-name">
                  {selectedProject?.enterpriseName ?? "当前企业"}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {stageLabel ? (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                      当前阶段：{stageLabel}
                    </span>
                  ) : null}
                  {deliveryStage ? (
                    <span className="text-sm text-gray-600">{deliveryStage.stageDescription}</span>
                  ) : null}
                </div>
                {deliveryStage?.blockingReasons && deliveryStage.blockingReasons.length > 0 ? (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span>当前阻断：{deliveryStage.blockingReasons.join("；")}</span>
                  </div>
                ) : null}
              </div>
              {headerCtaPath && headerCtaLabel ? (
                <Button
                  type="button"
                  className="rounded-xl bg-blue-600 px-6 text-white shadow-sm hover:bg-blue-700"
                  data-testid="workspace-primary-cta"
                  onClick={() => setLocation(headerCtaPath)}
                >
                  {headerCtaLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </section>

          {/* ═══ 区块二：今日待办 ═══ */}
          <section
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            data-testid="workspace-priority-todos"
          >
            <h2 className="text-base font-semibold text-gray-900">今日待办</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {waitingLinkCount > 0 ? (
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                  <p className="text-sm font-medium text-gray-800">回填已发布内容的公开链接</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {waitingLinkCount} 条内容待回填，回填后系统安排复测
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
                    onClick={() =>
                      setLocation(buildProjectUrl("/content-publishing", selectedProjectId) + "&filter=waiting_links")
                    }
                  >
                    去回填链接
                  </Button>
                </div>
              ) : null}
              {waitingPublishQueueCount > 0 ? (
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                  <p className="text-sm font-medium text-gray-800">处理待发布内容</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {waitingPublishQueueCount} 篇内容可加入发布队列
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => setLocation(buildProjectUrl("/weekly", selectedProjectId))}
                  >
                    去处理内容
                  </Button>
                </div>
              ) : null}
              {showRetestTodo ? (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <p className="text-sm font-medium text-gray-800">执行 AI 复测</p>
                  <p className="mt-1 text-xs text-gray-500">
                    已有公开链接的内容可进行收录复测
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => setLocation(buildProjectUrl("/inclusion-monitoring", selectedProjectId))}
                  >
                    去收录复测
                  </Button>
                </div>
              ) : null}
              {waitingLinkCount === 0 && waitingPublishQueueCount === 0 && !showRetestTodo ? (
                <div className="col-span-full flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-500">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  当前无紧急待办，可继续推进下一阶段
                </div>
              ) : null}
            </div>
          </section>

          {/* ═══ 区块三：交付进度 ═══ */}
          <section
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            data-testid="workspace-main-chain-progress"
          >
            <h2 className="text-base font-semibold text-gray-900">交付进度</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
                    "flex min-w-0 items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-[13px] font-medium transition-colors",
                    step.done
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                      : "border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-200 hover:bg-blue-50",
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

          {/* ═══ 区块四（折叠）：数据概览 ═══ */}
          <details className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <summary className="cursor-pointer px-6 py-4 text-base font-semibold text-gray-900">
              数据概览
            </summary>
            <div className="border-t border-gray-100 px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
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

              {resolution.riskHints.length > 0 ? (
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-[13px] text-amber-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{resolution.riskHints[0]}</span>
                </div>
              ) : null}

              <GeoScoreTrendChart
                points={scoreTrendPoints}
                loading={scoreTrendQuery.isLoading}
                variant="light"
                data-testid="workspace-geo-score-trend-chart"
              />
            </div>
          </details>

          {/* ═══ 折叠：收录监测概览 ═══ */}
          <details className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <summary className="cursor-pointer px-6 py-4 text-base font-semibold text-gray-900">
              收录监测概览
            </summary>
            <div className="border-t border-gray-100 px-6 py-5">
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
        </>
      ) : metrics === undefined && selectedProjectId ? (
        <P0Card testId="workspace-profile-zero" className="py-12 text-center">
          <p className="text-sm leading-relaxed text-gray-600">
            请先完成品牌资料建档，让系统了解您的企业。
          </p>
          <Button
            type="button"
            className="mt-4 rounded-xl bg-blue-600 px-6 text-white hover:bg-blue-700"
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
      <p className="mt-0.5 text-lg font-bold tabular-nums tracking-tight text-gray-900">{value}</p>
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
