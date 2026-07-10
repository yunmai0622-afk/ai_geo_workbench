import { FirstUseHintBanner } from "@/components/FirstUseHintBanner";
import { PLATFORM_PRODUCT_NAME } from "@/components/auth/authMarketing";
import { P0Card } from "@/components/geo/P0UiPrimitives";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { FIRST_USE_HINT_KEYS } from "@/lib/firstUseHints";
import { geoP0Brand, geoTypography, stageBadgeClass } from "@/lib/geoP0Visual";
import { useLocalAgentConnection } from "@/hooks/useLocalAgentConnection";
import {
  resolveWorkspaceCustomerStatusLabel,
  workspaceHasAiTestData,
} from "@shared/workspaceCustomerDisplay";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { whiteLabel, whiteLabelPrimaryStyle } from "@/lib/whiteLabel";
import { buildT0DiagnosisResultsDisplay } from "@shared/t0DiagnosisDisplay";
import { resolveWorkspaceStage } from "@shared/workspaceStateMachine";
import {
  AlertTriangle,
  ArrowRight,
  Check,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";

export default function EnterpriseWorkspacePage() {
  const [, setLocation] = useLocation();
  const { selectedProjectId, selectedProject, enabled, projectsLoading } =
    useActiveProjectSelection();
  const summaryQuery = trpc.geo.workspace.summary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );
  const maturityReportQuery = trpc.geo.maturity.getMaturityReport.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );
  const testRoundsQuery = trpc.geo.testRounds.list.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );
  const monthlyPlanQuery = trpc.geo.monthlyPlan.getCurrent.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );
  const businessMaturityQuery = trpc.geo.maturity.getBusinessReport.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );
  const optimizationBriefQuery = trpc.geo.monthlyPlan.getOptimizationBrief.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );

  useEffect(() => {
    const enterpriseName = selectedProject?.enterpriseName?.trim() || "企业";
    document.title = `${enterpriseName} - GEO 服务首页`;
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
  const latestCompletedT0Round = useMemo(
    () =>
      (testRoundsQuery.data ?? []).find(
        round => round.roundType === "T0_BASELINE" && round.status === "completed",
      ) ?? null,
    [testRoundsQuery.data],
  );
  const t0RunsQuery = trpc.geo.aiTestRuns.listByRound.useQuery(
    { projectId: selectedProjectId!, roundId: latestCompletedT0Round?.id ?? "" },
    { enabled: Boolean(selectedProjectId && latestCompletedT0Round?.id) },
  );
  const t0RoundQuestionsQuery = trpc.geo.roundQuestions.listByRound.useQuery(
    { projectId: selectedProjectId!, roundId: latestCompletedT0Round?.id ?? "" },
    { enabled: Boolean(selectedProjectId && latestCompletedT0Round?.id) },
  );
  const t0QuestionTypeById = useMemo(() => {
    const map = new Map<number, string>();
    for (const link of t0RoundQuestionsQuery.data ?? []) {
      if (!link || typeof link.questionId !== "number") continue;
      const questionType = link.question?.questionType;
      if (typeof questionType === "string" && questionType.trim()) {
        map.set(link.questionId, questionType);
      }
    }
    return map;
  }, [t0RoundQuestionsQuery.data]);
  const t0ResultsDisplay = useMemo(() => {
    if (!latestCompletedT0Round) return null;
    const runs = t0RunsQuery.data ?? [];
    if (runs.length === 0) return null;
    return buildT0DiagnosisResultsDisplay(
      runs.map(run => ({
        questionId: run.questionId,
        platform: run.platform,
        mentionedCompany: run.mentionedCompany,
        recommendedCompany: run.recommendedCompany,
        competitorMentioned: run.competitorMentioned,
        competitorNames: run.competitorNames ?? [],
      })),
      t0QuestionTypeById,
    );
  }, [latestCompletedT0Round, t0RunsQuery.data, t0QuestionTypeById]);
  const aiBrandMentionRate = metrics?.brandMentionRate ?? t0ResultsDisplay?.mentionRate ?? null;
  const aiBrandRecommendRate = metrics?.recommendRate ?? t0ResultsDisplay?.recommendRate ?? null;
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
  const customerMonthlyProgress = monthlyPlanQuery.data?.progress ?? { completedCount: 0, totalCount: 0 };
  const customerMaturityScore =
    businessMaturityQuery.data?.totalScore ?? maturityReportQuery.data?.totalScore ?? null;
  const customerMaturityLevel =
    businessMaturityQuery.data?.level ?? maturityReportQuery.data?.stage ?? null;
  const customerHasMonthlyPlan =
    customerMonthlyProgress.totalCount > 0 ||
    Boolean(optimizationBriefQuery.data?.hasActivePlan) ||
    Boolean(optimizationBriefQuery.data?.priorities.length);
  const customerPublishCount =
    (metrics?.publishRecordCount ?? 0) + (metrics?.completedPublishTaskCount ?? 0);
  const customerMainCta = useMemo(() => {
    if (!selectedProjectId) return null;
    return {
      label: "查看本月服务计划",
      path: buildProjectUrl("/monthly-plan", selectedProjectId),
      reason: customerHasMonthlyPlan
        ? "先看本月围绕哪 3 件事推进，再进入执行和验证。"
        : "先把当前最大问题转成本月可执行的服务计划。",
    };
  }, [customerHasMonthlyPlan, selectedProjectId]);
  const customerConclusion = useMemo(() => {
    if (!metrics) return "正在加载客户 GEO 服务状态。";
    if (!metrics.p0ProfileComplete) {
      return "当前品牌资料仍待完善。建议先补齐基础信息，让 AI 能正确理解品牌是谁、服务什么客户。";
    }
    if (!workspaceHasAiTestData(metrics)) {
      return "当前还没有完成 AI 能见度诊断。建议先建立基线，确认 AI 是否知道你、是否愿意推荐你。";
    }
    const maturityText =
      customerMaturityScore == null
        ? "AI 品牌成熟度待评分"
        : `当前 AI 品牌成熟度 ${customerMaturityScore} 分${customerMaturityLevel ? `，处于${customerMaturityLevel}` : ""}`;
    const mentionText =
      aiBrandMentionRate == null
        ? "AI 对品牌识别情况待复测"
        : aiBrandMentionRate >= 0.5
          ? "AI 已能识别品牌"
          : "AI 对品牌的识别仍不稳定";
    const recommendText =
      aiBrandRecommendRate == null
        ? "推荐意愿待复测"
        : aiBrandRecommendRate >= 0.35
          ? "推荐意愿已有基础"
          : "推荐意愿仍偏弱";
    const priorityNames = optimizationBriefQuery.data?.priorities
      .slice(0, 3)
      .map(priority => priority.relatedDimensionName)
      .filter(Boolean)
      .join("、");
    const monthlyText =
      customerHasMonthlyPlan
        ? `本月重点是${priorityNames || "推进内容、发布和复测闭环"}。`
        : "本月还需要先制定服务方案。";
    return `${maturityText}。${mentionText}，但${recommendText}，${monthlyText}`;
  }, [
    aiBrandMentionRate,
    aiBrandRecommendRate,
    customerHasMonthlyPlan,
    customerMaturityLevel,
    customerMaturityScore,
    metrics,
    optimizationBriefQuery.data?.priorities,
  ]);
  const customerCoreMetrics = useMemo(() => {
    const mention = customerRateDisplay(aiBrandMentionRate, "mention");
    const recommend = customerRateDisplay(aiBrandRecommendRate, "recommend");
    return [
      {
        label: "AI 成熟度",
        value: customerMaturityScore == null ? "待评分" : `${customerMaturityScore} 分`,
        description: customerMaturityLevel ?? "完成诊断后生成评分",
      },
      {
        label: "AI 是否知道你",
        value: mention.value,
        description: mention.description,
      },
      {
        label: "AI 是否愿意推荐你",
        value: recommend.value,
        description: recommend.description,
      },
      {
        label: "本月服务进度",
        value:
          customerMonthlyProgress.totalCount > 0
            ? `${customerMonthlyProgress.completedCount}/${customerMonthlyProgress.totalCount} 项`
            : "待制定",
        description:
          customerMonthlyProgress.totalCount > 0
            ? "本月 Top 服务事项完成情况"
            : "先生成月度优化计划",
      },
    ];
  }, [
    aiBrandMentionRate,
    aiBrandRecommendRate,
    customerMaturityLevel,
    customerMaturityScore,
    customerMonthlyProgress.completedCount,
    customerMonthlyProgress.totalCount,
  ]);
  const customerIssues = useMemo(() => {
    if (!metrics) return [];
    const issues: Array<{ title: string; impact: string }> = [];
    if (!metrics.p0ProfileComplete) {
      issues.push({
        title: "资料不完整",
        impact: "AI 缺少稳定事实来源，容易说不清品牌是谁、适合谁。",
      });
    }
    if (!workspaceHasAiTestData(metrics)) {
      issues.push({
        title: "未完成 AI 能见度诊断",
        impact: "还不知道 AI 当前是否提及和推荐品牌，无法证明优化前后的变化。",
      });
    }
    if (aiBrandRecommendRate != null && aiBrandRecommendRate < 0.35) {
      issues.push({
        title: "AI 推荐率偏低",
        impact: "用户询问相关问题时，AI 可能知道品牌，但还不愿意主动推荐。",
      });
    }
    if (aiBrandMentionRate != null && aiBrandMentionRate < 0.35) {
      issues.push({
        title: "AI 对品牌识别不足",
        impact: "AI 回答行业问题时不稳定提到品牌，说明公开内容和信源还不够。",
      });
    }
    if (metrics.articleCount === 0) {
      issues.push({
        title: "内容覆盖不足",
        impact: "用户常问的问题缺少可被 AI 引用的公开答案。",
      });
    } else if (customerPublishCount === 0) {
      issues.push({
        title: "内容尚未发布",
        impact: "内容还没有进入公开平台，AI 暂时难以读取和引用。",
      });
    }
    if (customerPublishCount > 0 && metrics.monitoringRecordCount === 0 && metrics.retestComparisonCount === 0) {
      issues.push({
        title: "发布后未复测",
        impact: "还不能证明内容发布后 AI 回答是否发生变化。",
      });
    }
    if (customerMonthlyProgress.totalCount > 0 && customerMonthlyProgress.completedCount < customerMonthlyProgress.totalCount) {
      issues.push({
        title: "本月任务未完成",
        impact: "本月服务还在执行中，效果证明需要等关键动作完成后再看。",
      });
    }
    return issues.slice(0, 3);
  }, [
    aiBrandMentionRate,
    aiBrandRecommendRate,
    customerMonthlyProgress.completedCount,
    customerMonthlyProgress.totalCount,
    customerPublishCount,
    metrics,
  ]);
  const customerPrimaryIssue = customerIssues[0] ?? null;
  const customerFlowSteps = useMemo(() => {
    const isSampleRetestInProgress = selectedProjectId === 210001;
    const done = {
      profile: Boolean(metrics?.p0ProfileComplete),
      diagnosis: Boolean(metrics && workspaceHasAiTestData(metrics)),
      plan: customerHasMonthlyPlan,
      execution: (metrics?.publishRecordWithPublicUrlCount ?? 0) > 0,
      verify:
        !isSampleRetestInProgress &&
        (metrics?.monitoringRecordCount ?? 0) > 0 &&
        (metrics?.hasCompletedT1Retest ?? false) &&
        (metrics?.retestPendingCount ?? 0) === 0,
      report: (metrics?.reportCount ?? 0) > 0,
    };
    const steps = [
      { key: "profile", label: "品牌建档", path: "/enterprise-profile", done: done.profile, description: "统一品牌资料、官网、公开表达和基础信源。" },
      { key: "diagnosis", label: "AI 能见度诊断", path: "/ai-diagnosis", done: done.diagnosis, description: "判断 AI 是否认识品牌、正确描述并愿意推荐。" },
      { key: "plan", label: "月度优化计划", path: "/monthly-plan", done: done.plan, description: "把诊断结果转成本月 3 个重点服务事项。" },
      { key: "execution", label: "内容生产与发布", path: "/weekly?mode=content-production", done: done.execution, description: "围绕 AI 搜索问题生产、质检并发布公开内容。" },
      { key: "verify", label: "收录与 AI 复测", path: "/inclusion-monitoring", done: done.verify, description: "验证内容是否被搜索和 AI 看见，推进 T1/T2/T3 复测。" },
      { key: "report", label: "交付报告", path: "/delivery-reports", done: done.report, description: "汇总本月动作、验证结果和下一步优化。" },
    ];
    const currentIndex = isSampleRetestInProgress
      ? steps.findIndex(step => step.key === "verify")
      : Math.max(0, steps.findIndex(step => !step.done));
    return steps.map((step, index) => ({
      ...step,
      status: index < currentIndex || (step.done && index !== currentIndex) ? "已完成" : index === currentIndex ? "进行中" : "待开始",
      active: index === currentIndex,
      actionLabel: index === currentIndex ? "继续" : index < currentIndex ? "查看" : "下一步",
    }));
  }, [
    customerHasMonthlyPlan,
    metrics,
    selectedProjectId,
  ]);
  const customerRecentProgress = useMemo(() => {
    if (!metrics) return [];
    const items: Array<{ title: string; description: string }> = [];
    if (metrics.lastDiagnosisAt) {
      items.push({
        title: "最近诊断",
        description: `已在 ${formatCustomerDate(metrics.lastDiagnosisAt)} 完成 AI 能见度诊断。`,
      });
    }
    if (customerHasMonthlyPlan) {
      items.push({
        title: "最近计划",
        description:
          customerMonthlyProgress.totalCount > 0
            ? `月度优化计划包含 ${customerMonthlyProgress.totalCount} 项服务事项，已完成 ${customerMonthlyProgress.completedCount} 项。`
            : "本月 Top 3 优先级已明确，待生成具体执行任务。",
      });
    }
    if (metrics.articleCount > 0) {
      items.push({
        title: "最近内容",
        description: `已形成 ${metrics.articleCount} 篇内容资产，用于覆盖 AI 搜索问题。`,
      });
    }
    if (customerPublishCount > 0) {
      items.push({
        title: "最近发布",
        description: `已有 ${customerPublishCount} 条发布或发布完成记录。`,
      });
    }
    if (metrics.retestComparisonCount > 0) {
      items.push({
        title: "最近复测",
        description: `已形成 ${metrics.retestComparisonCount} 次 AI 复测对比。`,
      });
    }
    if (metrics.reportCount > 0) {
      items.push({
        title: "最近报告",
        description: `已生成 ${metrics.reportCount} 份交付报告。`,
      });
    }
    return items.slice(0, 3);
  }, [
    customerHasMonthlyPlan,
    customerMonthlyProgress.completedCount,
    customerMonthlyProgress.totalCount,
    customerPublishCount,
    metrics,
  ]);
  const customerRisks = useMemo(() => {
    if (!metrics) return [];
    const risks: Array<{ title: string; description: string; path: string }> = [];
    if (!metrics.p0ProfileComplete) {
      risks.push({ title: "资料不完整", description: "先补齐品牌、客户和案例信息。", path: "/enterprise-profile" });
    }
    if (!workspaceHasAiTestData(metrics)) {
      risks.push({ title: "未完成诊断", description: "先确认 AI 当前是否知道并推荐品牌。", path: "/ai-diagnosis" });
    }
    if (customerHasMonthlyPlan && customerMonthlyProgress.completedCount < customerMonthlyProgress.totalCount) {
      risks.push({ title: "本月任务未执行完", description: "继续推进本月 Top 服务事项。", path: "/weekly" });
    }
    if (metrics.articleCount > customerPublishCount) {
      risks.push({ title: "内容未发布", description: "已生成内容还需要进入公开平台。", path: "/weekly" });
    }
    if (customerPublishCount > 0 && metrics.monitoringRecordCount === 0 && metrics.retestComparisonCount === 0) {
      risks.push({ title: "发布后未复测", description: "需要验证内容是否被搜索和 AI 看见。", path: "/inclusion-monitoring" });
    }
    if (metrics.reportCount === 0 && (customerHasMonthlyPlan || metrics.articleCount > 0 || customerPublishCount > 0)) {
      risks.push({ title: "报告未生成", description: "本月证据还没有沉淀成客户可读报告。", path: "/delivery-reports" });
    }
    return risks.slice(0, 3);
  }, [
    customerHasMonthlyPlan,
    customerMonthlyProgress.completedCount,
    customerMonthlyProgress.totalCount,
    customerPublishCount,
    metrics,
  ]);

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
        message={`欢迎使用${PLATFORM_PRODUCT_NAME}，客户只看当前状态、服务进度和下一步动作。`}
        data-testid="first-use-hint-workspace"
      />
      {summaryQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4" data-testid="workspace-core-metrics-loading">
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
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-blue-200 bg-white px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    客户可见
                  </span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    服务进度
                  </span>
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                    交付报告
                  </span>
                </div>
                <p className="mt-3 text-xs font-medium text-blue-600">GEO 服务首页</p>
                <p className="mt-1 text-sm text-gray-600">客户只看当前状态、服务进度和下一步动作。</p>
                <p className="mt-1 text-xs text-gray-500" data-testid="workspace-service-agency">
                  由 {whiteLabel.agencyName} 提供 GEO 代运营服务
                </p>
                <h1 className={cn(geoTypography.pageTitle, "mt-1")} data-testid="workspace-enterprise-name">
                  {selectedProject?.enterpriseName ?? "当前企业"}
                </h1>
              </div>
              {stageLabel ? <span className={stageBadgeClass(stageLabel)}>{stageLabel}</span> : null}
            </div>

            <div className="mt-5 rounded-2xl border border-blue-100 bg-white/80 p-5" data-testid="workspace-customer-conclusion">
              <p className="text-xs font-medium text-gray-500">当前 AI 可见度结论</p>
              <p className="mt-2 text-base font-semibold leading-7 text-gray-900" data-testid="workspace-current-stage-headline">
                {customerConclusion}
              </p>
              <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/70 p-3" data-testid="workspace-top-issues">
                <p className="text-xs font-medium text-amber-700">当前最大问题</p>
                {customerPrimaryIssue ? (
                  <p className="mt-1 text-sm leading-6 text-amber-950">
                    <span className="font-semibold">{customerPrimaryIssue.title}：</span>
                    {customerPrimaryIssue.impact}
                  </p>
                ) : (
                  <p className="mt-1 text-sm leading-6 text-amber-950">
                    暂无明显阻断，建议继续按月度优化计划推进并复测效果。
                  </p>
                )}
              </div>
              {customerMainCta ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    className={cn("rounded-xl px-6", geoP0Brand.primary)}
                    data-testid="workspace-primary-cta"
                    onClick={() => setLocation(customerMainCta.path)}
                    style={whiteLabelPrimaryStyle}
                  >
                    {customerMainCta.label}
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                  <p className="text-sm text-gray-600">{customerMainCta.reason}</p>
                </div>
              ) : null}
            </div>

            <div
              className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
              data-testid="workspace-core-metrics"
            >
              {customerCoreMetrics.map(metric => (
                <CustomerMetricCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  description={metric.description}
                />
              ))}
            </div>
          </section>

          <section className="geo-card overflow-hidden p-5 sm:p-6" data-testid="workspace-delivery-flow-map">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-blue-600">AI 可见度服务流程</p>
                <h2 className="mt-1 text-xl font-semibold text-gray-950">GEO 交付地图</h2>
                <p className="mt-1 text-sm text-gray-500">从品牌建档到交付报告，展示本项目当前服务阶段和下一步动作。</p>
              </div>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                6 步完整交付
              </span>
            </div>

            <div className="mt-5 grid gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center" data-testid="workspace-delivery-current-summary">
              <div>
                <p className="text-xs font-medium text-blue-700">当前项目阶段</p>
                <p className="mt-1 text-lg font-bold text-gray-950">{customerFlowSteps.find(step => step.active)?.label}</p>
              </div>
              <div className="text-sm leading-6 text-gray-700">
                <p><span className="font-semibold text-gray-900">当前进展：</span>{selectedProjectId === 210001 ? "已围绕“海豚知道是什么？”完成知乎公开内容建设，正在观察收录和 AI 复测结果。" : customerFlowSteps.find(step => step.active)?.description}</p>
                <p><span className="font-semibold text-gray-900">下一步：</span>{selectedProjectId === 210001 ? "07/12 执行收录初查与 T2 轻量复测。" : `继续推进${customerFlowSteps.find(step => step.active)?.label ?? "当前服务"}。`}</p>
              </div>
              <Button
                type="button"
                className={cn("rounded-xl whitespace-nowrap", geoP0Brand.primary)}
                data-testid="workspace-delivery-flow-primary-action"
                onClick={() => setLocation(buildProjectUrl(customerFlowSteps.find(step => step.active)?.path ?? "/workspace", selectedProjectId))}
              >
                查看{customerFlowSteps.find(step => step.active)?.label}
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {customerFlowSteps.map((step, index) => (
                <div
                  key={step.key}
                  className={cn(
                    "relative flex min-h-[210px] flex-col rounded-2xl border p-4 text-left transition-colors",
                    step.status === "已完成"
                      ? "border-emerald-200 bg-emerald-50"
                      : step.active
                        ? "border-2 border-blue-400 bg-blue-50 shadow-sm"
                        : "border-gray-200 bg-white",
                  )}
                  data-testid={`workspace-service-flow-${step.key}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("inline-flex size-7 items-center justify-center rounded-full text-xs font-bold", step.status === "已完成" ? "bg-emerald-600 text-white" : step.active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500")}>
                      {step.status === "已完成" ? <Check className="size-4" /> : index + 1}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", step.status === "已完成" ? "bg-emerald-100 text-emerald-800" : step.active ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600")}>{step.status}</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-gray-900">{step.label}</p>
                  <p className="mt-2 text-xs leading-5 text-gray-600">{step.description}</p>
                  <button
                    type="button"
                    className={cn("mt-auto inline-flex items-center pt-3 text-xs font-semibold", step.active ? "text-blue-700" : "text-gray-600 hover:text-blue-700")}
                    onClick={() => setLocation(buildProjectUrl(step.path, selectedProjectId))}
                  >
                    {step.actionLabel}<ArrowRight className="ml-1 size-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-4 text-xs text-gray-500" data-testid="workspace-operator-entry-points">
              <span className="font-medium text-gray-600">运营处理入口：</span>
              {[
                ["内容生产与发布", "/weekly?mode=content-production"],
                ["发布执行中心", "/content-publishing"],
                ["搜索问题挖掘", "/questions"],
                ["信源引用监测", "/brand-source-graph"],
              ].map(([label, path]) => (
                <button key={path} type="button" className="hover:text-blue-700" onClick={() => setLocation(buildProjectUrl(path, selectedProjectId))}>{label}</button>
              ))}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]" data-testid="workspace-customer-lower-sections">
            <section className="geo-card p-5" data-testid="workspace-recent-progress">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-gray-900">最近进展</h2>
                <span className="text-xs text-gray-400">最多 3 条</span>
              </div>
              {customerRecentProgress.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {customerRecentProgress.map(item => (
                    <div key={item.title} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-gray-600">{item.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-600">
                  暂无可展示进展。建议先完成诊断和月度优化计划。
                </p>
              )}
            </section>

            <section className="geo-card p-5" data-testid="workspace-customer-risks">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-gray-900">客户可见风险</h2>
                <span className="text-xs text-gray-400">只展示客户能理解的问题</span>
              </div>
              {customerRisks.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {customerRisks.map(risk => (
                    <div
                      key={risk.title}
                      className="w-full rounded-xl border border-amber-100 bg-amber-50 p-3 text-left"
                    >
                      <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-950">
                        <AlertTriangle className="size-4" aria-hidden />
                        {risk.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-amber-900">{risk.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                  暂无客户可见风险，建议继续执行并定期复测。
                </p>
              )}
            </section>
          </div>
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

function customerRateDisplay(
  value: number | null | undefined,
  kind: "mention" | "recommend",
): { value: string; description: string } {
  if (value == null) {
    return {
      value: "待诊断",
      description: kind === "mention" ? "先检测 AI 是否知道你" : "先检测 AI 是否愿意推荐你",
    };
  }
  const percent = `${Math.round(value * 100)}%`;
  if (kind === "mention") {
    if (value >= 0.5) return { value: `已知道 · ${percent}`, description: "AI 回答中较稳定出现品牌" };
    if (value >= 0.25) return { value: `不稳定 · ${percent}`, description: "AI 有时知道你，但还不稳定" };
    return { value: `偏弱 · ${percent}`, description: "AI 还不够认识品牌" };
  }
  if (value >= 0.35) return { value: `有基础 · ${percent}`, description: "AI 已开始在部分问题中推荐" };
  if (value >= 0.15) return { value: `不稳定 · ${percent}`, description: "AI 推荐意愿还需要加强" };
  return { value: `偏弱 · ${percent}`, description: "AI 暂时不太愿意主动推荐" };
}

function formatCustomerDate(value: Date | string): string {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CustomerMetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4" data-testid="workspace-customer-core-metric">
      <p className="text-[11px] font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-gray-900">{value}</p>
      <p className="mt-2 text-xs leading-5 text-gray-500">{description}</p>
    </div>
  );
}
