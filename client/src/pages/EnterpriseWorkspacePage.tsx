import { GeoGrowthSuggestionsPanel } from "@/components/geo/GeoGrowthSuggestionsPanel";
import { GeoScoreTrendChart } from "@/components/geo/GeoScoreTrendChart";
import { GeoScoreWeightExplanationHelp } from "@/components/geo/GeoScoreWeightExplanationHelp";
import { RetestDueReminderCard } from "@/components/diagnosis/RetestDueReminderCard";
import { T0ContentGapSuggestionsCard } from "@/components/geo/T0ContentGapSuggestionsCard";
import { FirstUseHintBanner } from "@/components/FirstUseHintBanner";
import { GeoBusinessMaturityCard } from "@/components/maturity/GeoBusinessMaturityCard";
import { PLATFORM_PRODUCT_NAME } from "@/components/auth/authMarketing";
import { P0Card } from "@/components/geo/P0UiPrimitives";
import { WorkspaceDashboardOverviewCards } from "@/components/project/WorkspaceDashboardOverviewCards";
import { AiBrandValueOverviewSection } from "@/components/workspace/AiBrandValueOverviewSection";
import { WorkspaceSellableDeliveryLoopCard } from "@/components/workspace/WorkspaceSellableDeliveryLoopCard";
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
  formatDeliveryStageCustomerLabel,
  resolveDeliveryStageView,
} from "@/lib/deliveryStage";
import { buildTopWeaknessHighlights } from "@shared/maturityDetailDisplay";
import { buildT0DiagnosisResultsDisplay } from "@shared/t0DiagnosisDisplay";
import {
  resolveMainChainSteps,
  toMainChainProgressInput,
  type MainChainStepView,
} from "@shared/workspaceMainChain";
import { buildSellableDeliveryLoopView } from "@shared/sellableDeliveryLoop";
import {
  buildGeoScoreAttributionLines,
  buildGeoScoreChangeReason,
  formatGeoScoreChangeBadge,
  formatWorkspacePublishCount,
  workspaceAiMentionRateHint,
} from "@shared/workspaceDashboardOverview";
import { resolveWorkspaceStagePrimaryAction } from "@shared/workspacePrimaryAction";
import { resolveWorkspaceStage, workspaceCtaUrl } from "@shared/workspaceStateMachine";
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
  const maturityLatestQuery = trpc.geo.maturity.getLatest.useQuery(
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
  const calculateMaturityMutation = trpc.geo.maturity.calculateAndSave.useMutation({
    onSuccess: () => {
      void maturityReportQuery.refetch();
    },
  });

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
  const aiBrandOverviewLoading =
    summaryQuery.isLoading ||
    testRoundsQuery.isLoading ||
    (Boolean(latestCompletedT0Round?.id) &&
      (t0RunsQuery.isLoading || t0RoundQuestionsQuery.isLoading));
  const hasAiBrandDiagnosisData = metrics ? workspaceHasAiTestData(metrics) : false;
  const aiBrandMentionRate = metrics?.brandMentionRate ?? t0ResultsDisplay?.mentionRate ?? null;
  const aiBrandRecommendRate = metrics?.recommendRate ?? t0ResultsDisplay?.recommendRate ?? null;
  const aiBrandCompetitorRate =
    t0ResultsDisplay && t0ResultsDisplay.totalRuns > 0
      ? t0ResultsDisplay.competitorAppearances / t0ResultsDisplay.totalRuns
      : null;
  const aiBrandTopWeaknesses = useMemo(
    () =>
      maturityReportQuery.data
        ? buildTopWeaknessHighlights(
            maturityReportQuery.data,
            (maturityLatestQuery.data?.calculationDetail as Record<string, unknown> | null) ?? null,
            3,
          )
        : [],
    [maturityReportQuery.data, maturityLatestQuery.data?.calculationDetail],
  );
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
  const sellableDeliveryLoopView = useMemo(() => {
    if (!metrics) return null;
    const monthlyProgress = monthlyPlanQuery.data?.progress ?? { completedCount: 0, totalCount: 0 };
    return buildSellableDeliveryLoopView({
      maturityScore: businessMaturityQuery.data?.totalScore ?? maturityReportQuery.data?.totalScore ?? null,
      maturityLevel: businessMaturityQuery.data?.level ?? maturityReportQuery.data?.stage ?? null,
      hasDiagnosis: metrics.hasCompletedT0Baseline || metrics.aiTestResultCount > 0 || metrics.hasAnalysis,
      monthlyPlanTotalCount: monthlyProgress.totalCount,
      monthlyPlanCompletedCount: monthlyProgress.completedCount,
      articleCount: metrics.articleCount,
      publishCount: metrics.publishRecordCount + metrics.completedPublishTaskCount,
      monitoringRecordCount: metrics.monitoringRecordCount,
      retestComparisonCount: metrics.retestComparisonCount,
      reportCount: metrics.reportCount,
      brandMentionRate: aiBrandMentionRate,
      recommendRate: aiBrandRecommendRate,
      priorities:
        optimizationBriefQuery.data?.priorities.map(priority => ({
          title: priority.title,
          dimensionName: priority.relatedDimensionName,
          source: priority.source,
        })) ?? [],
      nextActionLabel: stagePrimaryAction?.ctaLabel ?? homeDisplay.mainChainNextAction?.ctaLabel ?? stage?.ctaLabel,
      nextActionReason: stagePrimaryAction?.reason ?? homeDisplay.mainChainNextAction?.reason ?? null,
    });
  }, [
    aiBrandMentionRate,
    aiBrandRecommendRate,
    businessMaturityQuery.data?.level,
    businessMaturityQuery.data?.totalScore,
    homeDisplay.mainChainNextAction?.ctaLabel,
    homeDisplay.mainChainNextAction?.reason,
    maturityReportQuery.data?.stage,
    maturityReportQuery.data?.totalScore,
    metrics,
    monthlyPlanQuery.data?.progress,
    optimizationBriefQuery.data?.priorities,
    stage?.ctaLabel,
    stagePrimaryAction?.ctaLabel,
    stagePrimaryAction?.reason,
  ]);
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
    if (!customerHasMonthlyPlan) {
      return {
        label: "查看/制定本月方案",
        path: buildProjectUrl("/monthly-plan", selectedProjectId),
        reason: "先把当前短板转成本月服务方案。",
      };
    }
    if (
      customerMonthlyProgress.totalCount > 0 &&
      customerMonthlyProgress.completedCount < customerMonthlyProgress.totalCount
    ) {
      return {
        label: "查看执行进度",
        path: buildProjectUrl("/weekly", selectedProjectId),
        reason: "本月服务事项还在推进中。",
      };
    }
    if ((metrics?.monitoringRecordCount ?? 0) === 0 && (metrics?.retestComparisonCount ?? 0) === 0) {
      return {
        label: "查看效果验证",
        path: buildProjectUrl("/inclusion-monitoring", selectedProjectId),
        reason: "执行完成后，需要验证内容是否被搜索和 AI 看见。",
      };
    }
    return {
      label: (metrics?.reportCount ?? 0) > 0 ? "查看效果报告" : "生成/查看效果报告",
      path: buildProjectUrl("/delivery-reports", selectedProjectId),
      reason: "把本月做了什么、产生了什么变化沉淀成客户报告。",
    };
  }, [
    customerHasMonthlyPlan,
    customerMonthlyProgress.completedCount,
    customerMonthlyProgress.totalCount,
    metrics?.monitoringRecordCount,
    metrics?.reportCount,
    metrics?.retestComparisonCount,
    selectedProjectId,
  ]);
  const customerConclusion = useMemo(() => {
    if (!metrics) return "正在加载客户 GEO 服务状态。";
    if (!metrics.p0ProfileComplete) {
      return "当前品牌资料仍待完善。建议先补齐基础信息，让 AI 能正确理解品牌是谁、服务什么客户。";
    }
    if (!workspaceHasAiTestData(metrics)) {
      return "当前还没有完成 AI 现状诊断。建议先建立基线，确认 AI 是否知道你、是否愿意推荐你。";
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
            : "先生成本月服务方案",
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
        title: "未完成 AI 现状诊断",
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
  const customerServicePriorities = useMemo(
    () =>
      (optimizationBriefQuery.data?.priorities ?? []).slice(0, 3).map(priority => ({
        rank: priority.rank,
        title: priority.title,
        why: priority.reason,
        status: customerPriorityStatus(priority.source, priority.tasks.map(task => task.status)),
        proof: priority.retestMethod,
      })),
    [optimizationBriefQuery.data?.priorities],
  );
  const customerFlowSteps = useMemo(() => {
    const done = {
      diagnosis: Boolean(metrics && workspaceHasAiTestData(metrics)),
      plan: customerHasMonthlyPlan,
      execution:
        customerMonthlyProgress.totalCount > 0
          ? customerMonthlyProgress.completedCount >= customerMonthlyProgress.totalCount
          : (metrics?.articleCount ?? 0) > 0,
      verify: (metrics?.monitoringRecordCount ?? 0) > 0 || (metrics?.retestComparisonCount ?? 0) > 0,
      report: (metrics?.reportCount ?? 0) > 0,
    };
    const steps = [
      { key: "diagnosis", label: "诊断", path: "/ai-diagnosis", done: done.diagnosis, next: "完成 AI 现状诊断，建立优化前基线。" },
      { key: "plan", label: "本月方案", path: "/monthly-plan", done: done.plan, next: "把短板转成本月 Top 3 服务事项。" },
      { key: "execution", label: "执行", path: "/weekly", done: done.execution, next: "生成、质检并推进内容资产。" },
      { key: "verify", label: "效果验证", path: "/inclusion-monitoring", done: done.verify, next: "检查内容是否被搜索和 AI 看见。" },
      { key: "report", label: "效果报告", path: "/delivery-reports", done: done.report, next: "汇总本月执行、变化和下月建议。" },
    ];
    const currentIndex = steps.findIndex(step => !step.done);
    return steps.map((step, index) => ({
      ...step,
      status: step.done ? "已完成" : index === currentIndex ? "进行中" : "待开始",
      active: index === currentIndex,
    }));
  }, [
    customerHasMonthlyPlan,
    customerMonthlyProgress.completedCount,
    customerMonthlyProgress.totalCount,
    metrics,
  ]);
  const customerRecentProgress = useMemo(() => {
    if (!metrics) return [];
    const items: Array<{ title: string; description: string }> = [];
    if (metrics.lastDiagnosisAt) {
      items.push({
        title: "最近诊断",
        description: `已在 ${formatCustomerDate(metrics.lastDiagnosisAt)} 完成 AI 现状检测。`,
      });
    }
    if (customerHasMonthlyPlan) {
      items.push({
        title: "最近计划",
        description:
          customerMonthlyProgress.totalCount > 0
            ? `本月方案包含 ${customerMonthlyProgress.totalCount} 项服务事项，已完成 ${customerMonthlyProgress.completedCount} 项。`
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
        description: `已生成 ${metrics.reportCount} 份效果报告。`,
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
    return risks;
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
        message={`欢迎使用${PLATFORM_PRODUCT_NAME}，这里汇总当前问题、本月服务进度和下一步动作。`}
        data-testid="first-use-hint-workspace"
      />
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
              {customerMainCta ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    className={cn("rounded-xl px-6", geoP0Brand.primary)}
                    data-testid="workspace-primary-cta"
                    onClick={() => setLocation(customerMainCta.path)}
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

            <div className="mt-6 grid gap-4 lg:grid-cols-[0.95fr_1.15fr]" data-testid="workspace-customer-first-screen">
              <section className="rounded-2xl border border-gray-100 bg-white p-5" data-testid="workspace-top-issues">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-gray-900">当前最重要的问题</h2>
                  <span className="text-xs text-gray-400">客户能理解的影响</span>
                </div>
                {customerIssues.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {customerIssues.map(issue => (
                      <div key={issue.title} className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                        <p className="text-sm font-semibold text-amber-950">{issue.title}</p>
                        <p className="mt-1 text-sm leading-6 text-amber-900">{issue.impact}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                    暂无明显阻断，建议继续按本月方案推进并复测效果。
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-gray-100 bg-white p-5" data-testid="workspace-monthly-top3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-gray-900">下一步服务动作</h2>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-blue-700"
                    onClick={() => setLocation(buildProjectUrl("/monthly-plan", selectedProjectId))}
                  >
                    查看本月方案
                  </Button>
                </div>
                {customerServicePriorities.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {customerServicePriorities.map(priority => (
                      <div key={`${priority.rank}-${priority.title}`} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900">
                            {priority.rank}. {priority.title}
                          </p>
                          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">
                            {priority.status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-gray-600">为什么现在做：{priority.why}</p>
                        <p className="mt-1 text-sm leading-6 text-gray-600">月底报告能证明：{priority.proof}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-600">
                    暂无明确的下一步服务事项。建议先进入本月方案，把当前短板转成客户可验收的执行计划。
                  </p>
                )}
              </section>
            </div>
          </section>

          <section className="geo-card p-5" data-testid="workspace-service-flow">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-blue-600">服务流程进度</p>
                <h2 className="mt-1 text-lg font-semibold text-gray-900">从诊断到报告的交付路径</h2>
              </div>
              <p className="text-sm text-gray-500">客户能看懂当前卡在哪一步、下一步去哪。</p>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-5">
              {customerFlowSteps.map(step => (
                <button
                  key={step.key}
                  type="button"
                  className={cn(
                    "min-h-[132px] rounded-2xl border p-4 text-left transition-colors",
                    step.done
                      ? "border-emerald-200 bg-emerald-50"
                      : step.active
                        ? "border-blue-200 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-blue-100",
                  )}
                  data-testid={`workspace-service-flow-${step.key}`}
                  onClick={() => setLocation(buildProjectUrl(step.path, selectedProjectId))}
                >
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                      step.done
                        ? "bg-emerald-100 text-emerald-800"
                        : step.active
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-600",
                    )}
                  >
                    {step.status}
                  </span>
                  <p className="mt-3 text-sm font-semibold text-gray-900">{step.label}</p>
                  <p className="mt-2 text-xs leading-5 text-gray-600">{step.next}</p>
                </button>
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
                  暂无可展示进展。建议先完成诊断和本月方案。
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
                    <button
                      key={risk.title}
                      type="button"
                      className="w-full rounded-xl border border-amber-100 bg-amber-50 p-3 text-left transition-colors hover:bg-amber-100"
                      onClick={() => setLocation(buildProjectUrl(risk.path, selectedProjectId))}
                    >
                      <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-950">
                        <AlertTriangle className="size-4" aria-hidden />
                        {risk.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-amber-900">{risk.description}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                  暂无客户可见风险，建议继续执行并定期复测。
                </p>
              )}
            </section>
          </div>

          <details className="group rounded-2xl border border-gray-200 bg-white shadow-sm" data-testid="workspace-customer-detail-entry">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
                查看诊断、成熟度与运营详情
              </span>
            </summary>
            <div className="space-y-5 border-t border-gray-100 px-5 pb-5 pt-4">
              {selectedProjectId ? (
                <AiBrandValueOverviewSection
                  projectId={selectedProjectId}
                  hasDiagnosisData={hasAiBrandDiagnosisData}
                  loading={aiBrandOverviewLoading}
                  maturityScore={maturityReportQuery.data?.totalScore ?? null}
                  mentionRate={aiBrandMentionRate}
                  recommendRate={aiBrandRecommendRate}
                  competitorRate={aiBrandCompetitorRate}
                  topWeaknesses={aiBrandTopWeaknesses}
                  onNavigate={setLocation}
                />
              ) : null}
              {sellableDeliveryLoopView ? (
                <WorkspaceSellableDeliveryLoopCard
                  view={sellableDeliveryLoopView}
                  onNextAction={headerCtaPath ? () => setLocation(headerCtaPath) : undefined}
                />
              ) : null}
              {selectedProjectId ? (
                <GeoBusinessMaturityCard
                  report={businessMaturityQuery.data}
                  loading={businessMaturityQuery.isLoading}
                  onGoMonthlyPlan={() => setLocation(buildProjectUrl("/monthly-plan", selectedProjectId))}
                  onGoMaturityDetail={() => setLocation(buildProjectUrl("/maturity", selectedProjectId))}
                />
              ) : null}
              {metrics?.retestDueReminder && selectedProjectId ? (
                <RetestDueReminderCard
                  reminder={metrics.retestDueReminder}
                  testId="workspace-retest-due-reminder"
                  onGoRetest={() =>
                    setLocation(buildProjectUrl(metrics.retestDueReminder!.ctaPath, selectedProjectId))
                  }
                />
              ) : null}
            </div>
          </details>

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

function customerPriorityStatus(source: "existing_task" | "suggestion", taskStatuses: string[]): string {
  if (source === "suggestion" || taskStatuses.length === 0) return "待纳入方案";
  const doneValues = new Set(["done", "completed", "finished", "success"]);
  const doneCount = taskStatuses.filter(status => doneValues.has(status)).length;
  if (doneCount === taskStatuses.length) return "已完成";
  if (doneCount > 0) return "进行中";
  return "待处理";
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
