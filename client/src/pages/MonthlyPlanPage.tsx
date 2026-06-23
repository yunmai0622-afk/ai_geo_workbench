import { P0Card } from "@/components/geo/P0UiPrimitives";
import { MonthlyPlanCompletionBenefitsSection } from "@/components/monthlyPlan/MonthlyPlanCompletionBenefitsSection";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { isMonthlyPlanRetestReady } from "@shared/monthlyPlanGeneration";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Circle,
  ListChecks,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function taskStatusLabel(status: string): string {
  if (status === "completed") return "已完成";
  if (status === "in_progress") return "进行中";
  return "待处理";
}

function taskStatusClass(status: string): string {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "in_progress") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default function MonthlyPlanPage() {
  const [, setLocation] = useLocation();
  const { selectedProjectId, selectedProject, enabled, projectsLoading } = useActiveProjectSelection();
  const utils = trpc.useUtils();

  const currentQuery = trpc.geo.monthlyPlan.getCurrent.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const historyQuery = trpc.geo.monthlyPlan.getHistory.useQuery(
    { projectId: selectedProjectId!, limit: 10 },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const maturityQuery = trpc.geo.maturity.getMaturityReport.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const workspaceSummaryQuery = trpc.geo.workspace.summary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );

  const generateMutation = trpc.geo.monthlyPlan.generate.useMutation({
    onSuccess: () => {
      void utils.geo.monthlyPlan.getCurrent.invalidate({ projectId: selectedProjectId! });
      void utils.geo.monthlyPlan.getHistory.invalidate({ projectId: selectedProjectId! });
    },
  });
  const retestMutation = trpc.geo.monthlyPlan.triggerRetest.useMutation({
    onSuccess: () => {
      void utils.geo.monthlyPlan.getCurrent.invalidate({ projectId: selectedProjectId! });
      void utils.geo.monthlyPlan.getHistory.invalidate({ projectId: selectedProjectId! });
      void utils.geo.maturity.getMaturityReport.invalidate({ projectId: selectedProjectId! });
      void utils.geo.maturity.getLatest.invalidate({ projectId: selectedProjectId! });
    },
  });

  useEffect(() => {
    const name = selectedProject?.enterpriseName?.trim() || "企业";
    document.title = `${name} - 本月优化计划`;
  }, [selectedProject?.enterpriseName]);

  const current = currentQuery.data;
  const plan = current?.plan ?? null;
  const tasks = current?.tasks ?? [];
  const progress = current?.progress ?? { completedCount: 0, totalCount: 0 };
  const focusSummary = current?.focusSummary ?? "";
  const planPhase = current?.planPhase ?? null;

  const comparisonQuery = trpc.geo.monthlyPlan.getComparison.useQuery(
    { planId: plan?.id ?? 0 },
    { enabled: Boolean(plan?.id && plan.status === "completed") },
  );

  const retestReady = useMemo(
    () =>
      plan
        ? isMonthlyPlanRetestReady({ retestScheduledAt: plan.retestScheduledAt })
        : false,
    [plan],
  );

  const canGeneratePlan = Boolean(maturityQuery.data) && (!plan || plan.status === "completed");
  const showGenerateEmpty = !currentQuery.isLoading && !plan && maturityQuery.data;
  const showActivePlan = plan?.status === "active";
  const showCompletedPlan = plan?.status === "completed";

  const handleGeneratePlan = () => {
    if (!selectedProjectId) return;
    void generateMutation.mutateAsync({ projectId: selectedProjectId });
  };

  const handleGoTask = (actionUrl: string) => {
    if (!selectedProjectId) return;
    setLocation(buildProjectUrl(actionUrl, selectedProjectId));
  };

  const handleRetest = () => {
    if (!plan) return;
    void retestMutation.mutateAsync({ planId: plan.id });
  };

  const handleGoAiDiagnosis = () => {
    if (!selectedProjectId) return;
    setLocation(buildProjectUrl("/ai-diagnosis", selectedProjectId));
  };

  if (!selectedProjectId && !projectsLoading) {
    return (
      <div className="space-y-6" data-testid="monthly-plan-page">
        <ProjectContextEmptyState title="本月优化计划" description="请先选择或创建项目后再制定本月优化计划。" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10" data-testid="monthly-plan-page">
      <header className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-600">月度优化计划</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">本月优化计划</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              把 AI 品牌成熟度短板转化为本月可执行任务，完成后复测并对比成效。
            </p>
          </div>
          {canGeneratePlan ? (
            <Button
              type="button"
              className={cn("rounded-lg", geoP0Brand.primary)}
              data-testid="monthly-plan-generate-btn"
              disabled={generateMutation.isPending}
              onClick={handleGeneratePlan}
            >
              {generateMutation.isPending ? (
                <>
                  <Spinner className="mr-2 size-4" />
                  生成中…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 size-4" />
                  {plan?.status === "completed" ? "生成下月计划" : "生成本月优化计划"}
                </>
              )}
            </Button>
          ) : null}
        </div>
      </header>

      {(showActivePlan || showCompletedPlan) && plan ? (
        <MonthlyPlanCompletionBenefitsSection
          progress={progress}
          tasks={tasks}
          boundPublishAccountCount={workspaceSummaryQuery.data?.boundPublishAccountCount ?? null}
        />
      ) : null}

      {currentQuery.isLoading || maturityQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Spinner className="size-4" />
          加载本月计划…
        </div>
      ) : null}

      {!maturityQuery.data && !maturityQuery.isLoading ? (
        <P0Card testId="monthly-plan-no-maturity">
          <p className="text-sm text-gray-700">请先完成 AI 品牌成熟度评估，再生成本月优化计划。</p>
          <Button
            type="button"
            size="sm"
            className="mt-3"
            onClick={() => setLocation(buildProjectUrl("/maturity", selectedProjectId))}
          >
            前往 AI 品牌成熟度
            <ArrowRight className="ml-1.5 size-3.5" />
          </Button>
        </P0Card>
      ) : null}

      {showGenerateEmpty ? (
        <P0Card testId="monthly-plan-empty">
          <p className="text-sm text-gray-700">
            成熟度评估已完成（{maturityQuery.data?.totalScore ?? "—"} 分），点击上方按钮生成本月优化计划。
          </p>
        </P0Card>
      ) : null}

      {(showActivePlan || showCompletedPlan) && plan ? (
        <>
          <P0Card testId="monthly-plan-overview">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-500">第 {plan.roundNumber} 轮 · 本月目标</p>
                <p className="mt-1 text-lg font-semibold text-gray-900" data-testid="monthly-plan-focus-summary">
                  本月重点：提升 {focusSummary || "关键成熟度维度"}
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  基线成熟度 {plan.baselineMaturityScore} 分 · 生成于 {formatDateTime(plan.generatedAt)}
                </p>
              </div>
              <div
                className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center"
                data-testid="monthly-plan-progress"
              >
                <p className="text-xs text-gray-500">整体进度</p>
                <p className="text-2xl font-bold tabular-nums text-blue-700">
                  {progress.completedCount}/{progress.totalCount}
                </p>
                <p className="text-xs text-gray-500">项已完成</p>
              </div>
            </div>
          </P0Card>

          <P0Card testId="monthly-plan-task-list">
            <div className="flex items-center gap-2">
              <ListChecks className="size-4 text-blue-600" />
              <p className="text-sm font-semibold text-gray-900">任务清单</p>
            </div>
            <ul className="mt-4 space-y-3">
              {tasks.map(task => {
                const meta = (task.metadata as Record<string, unknown> | null) ?? {};
                const actionIndex = meta.actionIndex ?? "—";
                return (
                  <li
                    key={task.id}
                    className="rounded-xl border border-gray-200 bg-white p-4"
                    data-testid={`monthly-plan-task-${task.id}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-gray-500">动作 {String(actionIndex)}</span>
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                              taskStatusClass(task.status),
                            )}
                          >
                            {taskStatusLabel(task.status)}
                          </span>
                        </div>
                        <p className="mt-2 font-medium text-gray-900">{task.title}</p>
                        <p className="mt-1 text-sm text-gray-600">{task.reason}</p>
                      </div>
                      {task.status !== "completed" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          data-testid={`monthly-plan-task-go-${task.id}`}
                          onClick={() => handleGoTask(task.actionUrl)}
                        >
                          去完成
                          <ArrowRight className="ml-1.5 size-3.5" />
                        </Button>
                      ) : (
                        <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </P0Card>

          <P0Card testId="monthly-plan-retest-section">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4 text-blue-600" />
              <p className="text-sm font-semibold text-gray-900">复测区</p>
            </div>
            {showCompletedPlan && plan.resultMaturityScore != null ? (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-gray-700">
                  复测已完成 · 成熟度 {plan.baselineMaturityScore} → {plan.resultMaturityScore} 分
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="monthly-plan-comparison">
                  {(comparisonQuery.data?.dimensions ?? []).map(dim => (
                    <div key={dim.key} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">{dim.label}</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {dim.baseline} → {dim.result ?? "—"}
                        {dim.delta != null ? (
                          <span className={cn("ml-2 text-xs", dim.delta >= 0 ? "text-emerald-600" : "text-red-600")}>
                            {dim.delta >= 0 ? "+" : ""}
                            {dim.delta}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  className={geoP0Brand.primary}
                  data-testid="monthly-plan-next-round-btn"
                  disabled={generateMutation.isPending}
                  onClick={handleGeneratePlan}
                >
                  <TrendingUp className="mr-2 size-4" />
                  生成下月计划
                </Button>
              </div>
            ) : showActivePlan && retestReady ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-gray-700">可以进行 7 天后复测了，建议立即复测查看本月优化成效。</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className={geoP0Brand.primary}
                    data-testid="monthly-plan-retest-btn"
                    disabled={retestMutation.isPending}
                    onClick={handleRetest}
                  >
                    {retestMutation.isPending ? "复测中…" : "立即复测"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleGoAiDiagnosis}>
                    前往 AI 实测诊断
                  </Button>
                </div>
              </div>
            ) : showActivePlan && plan.retestScheduledAt ? (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-700">
                  完成全部内容任务并发布后，系统将在 7 天后自动复测。
                </p>
                <p className="text-sm text-gray-500">
                  预计复测时间：{formatDateTime(plan.retestScheduledAt)}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-700">
                完成全部内容任务并发布后，系统将在 7 天后自动复测。
              </p>
            )}
          </P0Card>
        </>
      ) : null}

      <details className="group rounded-2xl border border-gray-200 bg-white shadow-sm" data-testid="monthly-plan-history">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <ChevronDown className="size-4 text-gray-400 transition-transform group-open:rotate-180" />
            往期计划
          </span>
        </summary>
        <div className="border-t border-gray-100 px-5 pb-5 pt-2">
          {historyQuery.isLoading ? (
            <p className="text-sm text-gray-500">加载历史…</p>
          ) : (historyQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-gray-500">暂无历史计划</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {(historyQuery.data ?? []).map(entry => (
                <li key={entry.plan.id} className="py-3">
                  <div className="flex items-start gap-2">
                    <Circle className="mt-1 size-3 text-gray-300" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        第 {entry.plan.roundNumber} 轮 · {formatDateTime(entry.plan.generatedAt)}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">{entry.summary}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      {planPhase ? (
        <p className="sr-only" data-testid="monthly-plan-phase">
          {planPhase}
        </p>
      ) : null}
    </div>
  );
}
