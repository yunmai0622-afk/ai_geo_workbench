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
import type {
  MonthlyOptimizationBrief,
  MonthlyOptimizationPriority,
} from "@shared/monthlyOptimizationBrief";
import {
  ArrowRight,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardList,
  Eye,
  ListChecks,
  Sparkles,
  Target,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";

type MonthlyPlanPrimaryCta = {
  label: string;
  hint: string;
  path?: string;
  action?: "generate";
};

type MonthlyPlanBriefView = Pick<MonthlyOptimizationBrief, "priorities"> &
  Partial<Pick<MonthlyOptimizationBrief, "reviewCalendar">>;

const SAMPLE_210001_ASSET_PRIORITIES: MonthlyOptimizationPriority[] = [
  {
    rank: 1,
    title: "补业务定义资产：建设官网同主题定义页",
    relatedDimensionKey: "profile",
    relatedDimensionName: "业务定义资产",
    source: "suggestion",
    reason: "官网统一定义能让 AI 在品牌是什么、解决什么问题和适合谁上获得更稳定的一手依据。",
    shortcoming: "知乎已有第一条定义型公开内容，但官网缺少同主题定义页。",
    tasks: [{ id: null, title: "建设官网同主题定义页", status: "suggested", actionUrl: "/enterprise-profile" }],
    successCriteria: "形成可公开访问的官网定义页，并与现有品牌标准表达保持一致。",
    retestMethod: "检查页面可访问性与标题检索，并复测 AI 对“海豚知道是什么？”的解释是否一致。",
  },
  {
    rank: 2,
    title: "补可信信源资产：新增第三方公开证据",
    relatedDimensionKey: "sourceConsistency",
    relatedDimensionName: "可信信源资产",
    source: "suggestion",
    reason: "独立第三方信源能降低单一自述带来的可信度不足，为 AI 引用和推荐提供交叉验证。",
    shortcoming: "当前主要证据来自知乎公开内容，官网与第三方可信信源仍不足。",
    tasks: [{ id: null, title: "新增第三方公开信源", status: "suggested", actionUrl: "/brand-source-graph" }],
    successCriteria: "新增至少一条可访问、主体清楚、表达一致的第三方公开信源。",
    retestMethod: "验证 URL 可访问和核心事实一致性，并观察 AI 回答是否引用或复述新增信源。",
  },
  {
    rank: 3,
    title: "补第二个 AI 问题占位资产",
    relatedDimensionKey: "questionCoverage",
    relatedDimensionName: "AI 问题占位资产",
    source: "suggestion",
    reason: "从定义型问题扩展到推荐型问题，才能验证品牌是否进入用户真实决策场景。",
    shortcoming: "目前只围绕“海豚知道是什么？”形成第一条公开答案，推荐类问题尚未完成占位。",
    tasks: [{ id: null, title: "围绕“知识付费 SaaS 系统有哪些推荐？”建设公开答案", status: "suggested", actionUrl: "/questions" }],
    successCriteria: "第二个目标问题形成公开可访问内容和稳定 URL，未公开前不计为完成。",
    retestMethod: "使用同一推荐型问题执行 T1/T2/T3，分别记录提及、推荐、引用和竞品占位。",
  },
];

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
  if (status === "completed")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "in_progress")
    return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function priorityStatusLabel(
  priority: MonthlyOptimizationPriority,
  planPhase: string | null | undefined
): string {
  if (priority.source === "suggestion") return "待建设";
  if (priority.tasks.length === 0) return "待确认";
  const allCompleted = priority.tasks.every(
    task => task.status === "completed"
  );
  if (allCompleted && planPhase === "completed") return "已验证";
  if (allCompleted) return "待验证";
  if (
    priority.tasks.some(
      task => task.status === "in_progress" || task.status === "completed"
    )
  )
    return "执行中";
  return "计划中";
}

function priorityStatusClass(label: string): string {
  if (label === "已验证" || label === "已完成")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (label === "执行中") return "border-blue-200 bg-blue-50 text-blue-700";
  if (label === "待验证")
    return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (label === "待建设") return "border-gray-200 bg-gray-50 text-gray-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function customerGoalForDimension(
  key: MonthlyOptimizationPriority["relatedDimensionKey"]
): string {
  const goalByDimension: Record<
    MonthlyOptimizationPriority["relatedDimensionKey"],
    string
  > = {
    profile: "统一品牌资料与服务口径",
    questionCoverage: "覆盖用户常问的高价值问题",
    aiVisibility: "提升 AI 是否知道你、是否愿意推荐你",
    sourceConsistency: "补齐 AI 推荐所需信任证据",
    contentExecution: "完成本月核心内容与发布动作",
    retestDelivery: "完成发布后收录与 AI 复测和月报证明",
  };
  return goalByDimension[key];
}

function customerValueForDimension(
  key: MonthlyOptimizationPriority["relatedDimensionKey"]
): string {
  const valueByDimension: Record<
    MonthlyOptimizationPriority["relatedDimensionKey"],
    string
  > = {
    profile: "让 AI 和客户看到一致、清楚的品牌介绍，减少理解偏差。",
    questionCoverage: "让用户常问的问题都有内容承接，提高被 AI 发现的机会。",
    aiVisibility: "提高品牌在 AI 回答中被准确识别和主动推荐的概率。",
    sourceConsistency: "让 AI 有更多公开证据判断品牌可信，推荐理由更充分。",
    contentExecution: "把方案变成可被搜索和 AI 读取的公开内容资产。",
    retestDelivery: "用复测和报告证明本月服务是否带来可解释变化。",
  };
  return valueByDimension[key];
}

function buildServiceConclusion(input: {
  brief?: MonthlyPlanBriefView | null;
  hasMaturity: boolean;
  hasPlan: boolean;
  planPhase?: string | null;
  completedCount: number;
  totalCount: number;
}): string {
  if (!input.hasMaturity) {
    return "当前还缺少 AI 能见度诊断，建议先完成诊断，建立月度优化计划的判断基线。";
  }
  const priorities = input.brief?.priorities ?? [];
  if (priorities.length === 0) {
    return "当前缺少可用的本月资产建设任务，请从资产缺口生成 Top 3 任务。";
  }
  const focus = priorities
    .slice(0, 3)
    .map(priority => priority.title)
    .join("、");
  if (!input.hasPlan) {
    return `本月建议优先围绕 ${focus} 制定服务方案，把诊断短板转成可执行动作。`;
  }
  if (input.planPhase === "completed") {
    return `本月服务已进入报告阶段，重点回看 ${focus} 的执行证据和复测变化，为下月续费与优化提供依据。`;
  }
  if (input.totalCount > 0 && input.completedCount >= input.totalCount) {
    return `本月 ${focus} 的主要执行动作已完成，下一步重点是做收录与 AI 复测，确认 AI 是否更稳定地识别和推荐品牌。`;
  }
  return `本月重点是 ${focus}，目标是补齐 AI 推荐所需的内容、信源和复测证据，提升品牌被识别和推荐的稳定性。`;
}

function buildCustomerGoals(input: {
  brief?: MonthlyPlanBriefView | null;
  hasMaturity: boolean;
  hasPlan: boolean;
  completedCount: number;
  totalCount: number;
}): string[] {
  if (!input.hasMaturity) {
    return ["完成 AI 能见度诊断", "建立本月服务基线", "明确最需要改善的问题"];
  }
  const goals: string[] = [];
  for (const priority of input.brief?.priorities ?? []) {
    const goal = customerGoalForDimension(priority.relatedDimensionKey);
    if (!goals.includes(goal)) goals.push(goal);
    if (goals.length >= 3) break;
  }
  if (input.hasPlan && input.totalCount > 0) {
    goals.push(
      `完成本月 Top 服务事项（${input.completedCount}/${input.totalCount}）`
    );
  } else {
    goals.push("完成本月 Top3 服务事项确认");
  }
  goals.push("完成发布后收录与 AI 复测");
  return [...new Set(goals)].slice(0, 4);
}

function buildVerificationCopy(input: {
  brief?: MonthlyPlanBriefView | null;
  planPhase?: string | null;
  retestScheduledAt?: Date | string | null;
}): {
  headline: string;
  description: string;
  schedule: Array<{ label: string; timing: string; purpose: string }>;
} {
  const schedule = input.brief?.reviewCalendar ?? [
    {
      label: "T1",
      timing: "发布后 7 天",
      purpose: "确认内容是否被搜索和 AI 初步感知",
    },
    {
      label: "T2",
      timing: "发布后 14 天",
      purpose: "观察提及、推荐和引用变化",
    },
    {
      label: "T3",
      timing: "发布后 30 天",
      purpose: "沉淀月报证明与下月优先级",
    },
  ];
  if (input.planPhase === "completed") {
    return {
      headline: "本月已完成验证，可进入交付报告。",
      description:
        "复测结果会沉淀到交付报告中，用于说明本月服务动作带来的变化。",
      schedule,
    };
  }
  if (input.planPhase === "retest_ready") {
    return {
      headline: "当前已到验证窗口，建议立即查看收录与 AI 复测。",
      description:
        "重点检查内容是否被收录，以及 AI 回答中是否开始更稳定地识别品牌。",
      schedule,
    };
  }
  if (input.retestScheduledAt) {
    return {
      headline: `预计验证时间：${formatDateTime(input.retestScheduledAt)}`,
      description:
        "内容发布后按计划进入复测，验证结果会在收录与 AI 复测页和交付报告中查看。",
      schedule,
    };
  }
  return {
    headline: "内容发布后 7 天开始第一次收录与 AI 复测。",
    description:
      "检查是否被搜索引擎收录，以及 AI 回答中是否开始更稳定地识别品牌。",
    schedule,
  };
}

function buildCustomerRisks(input: {
  hasMaturity: boolean;
  hasPlan: boolean;
  priorities: MonthlyOptimizationPriority[];
  completedCount: number;
  totalCount: number;
  planPhase?: string | null;
}): Array<{ title: string; suggestion: string }> {
  const risks: Array<{ title: string; suggestion: string }> = [];
  if (!input.hasMaturity) {
    risks.push({
      title: "未完成诊断",
      suggestion: "先完成 AI 能见度诊断，建立服务方案基线。",
    });
  }
  if (!input.hasPlan) {
    risks.push({
      title: "月度优化计划未生成",
      suggestion: "把诊断短板转成本月 Top3 服务事项。",
    });
  }
  if (input.hasPlan && input.totalCount > 0 && input.completedCount === 0) {
    risks.push({
      title: "服务事项未开始",
      suggestion: "优先进入执行进度，推进第一批内容或信源任务。",
    });
  }
  if (
    input.hasPlan &&
    input.totalCount > 0 &&
    input.completedCount < input.totalCount
  ) {
    risks.push({
      title: "本月任务未执行完",
      suggestion: "继续完成本月 Top 服务事项，避免月底无法形成报告证据。",
    });
  }
  if (
    input.totalCount > 0 &&
    input.completedCount >= input.totalCount &&
    input.planPhase !== "completed"
  ) {
    risks.push({
      title: "发布后未验证",
      suggestion: "进入收录与 AI 复测，确认内容是否被搜索和 AI 看见。",
    });
  }
  if (input.hasPlan && input.planPhase !== "completed") {
    risks.push({
      title: "报告未生成",
      suggestion: "完成执行和复测后，生成客户可读的交付报告。",
    });
  }
  if (
    input.priorities.some(
      priority => priority.relatedDimensionKey === "sourceConsistency"
    )
  ) {
    risks.push({
      title: "信源证据不足",
      suggestion: "补齐公开信源和信任证据，让 AI 推荐理由更充分。",
    });
  }
  return risks.slice(0, 3);
}

function serviceProgressSteps(input: {
  hasPlan: boolean;
  allTasksCompleted: boolean;
  planPhase?: string | null;
}): Array<{
  label: string;
  status: "已完成" | "进行中" | "待开始";
  description: string;
}> {
  return [
    {
      label: "计划中",
      status: input.hasPlan ? "已完成" : "进行中",
      description: input.hasPlan
        ? "本月服务事项已确认。"
        : "先把诊断短板转成服务事项。",
    },
    {
      label: "执行中",
      status:
        input.planPhase === "executing"
          ? "进行中"
          : input.allTasksCompleted || input.planPhase === "completed"
            ? "已完成"
            : "待开始",
      description: "推进内容、信源、资料和发布相关动作。",
    },
    {
      label: "待验证",
      status:
        input.planPhase === "waiting_retest" ||
        input.planPhase === "retest_ready"
          ? "进行中"
          : input.planPhase === "completed"
            ? "已完成"
            : "待开始",
      description: "检查发布内容是否被搜索和 AI 看见。",
    },
    {
      label: "已验证 / 可报告",
      status: input.planPhase === "completed" ? "已完成" : "待开始",
      description: "复测结果进入交付报告，支持续费沟通。",
    },
  ];
}

export default function MonthlyPlanPage() {
  const [, setLocation] = useLocation();
  const { selectedProjectId, selectedProject, enabled, projectsLoading } =
    useActiveProjectSelection();
  const utils = trpc.useUtils();

  const currentQuery = trpc.geo.monthlyPlan.getCurrent.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) }
  );
  const historyQuery = trpc.geo.monthlyPlan.getHistory.useQuery(
    { projectId: selectedProjectId!, limit: 10 },
    { enabled: enabled && Boolean(selectedProjectId) }
  );
  const maturityQuery = trpc.geo.maturity.getMaturityReport.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) }
  );
  const workspaceSummaryQuery = trpc.geo.workspace.summary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) }
  );
  const optimizationBriefQuery =
    trpc.geo.monthlyPlan.getOptimizationBrief.useQuery(
      { projectId: selectedProjectId! },
      { enabled: enabled && Boolean(selectedProjectId) }
    );

  const generateMutation = trpc.geo.monthlyPlan.generate.useMutation({
    onSuccess: () => {
      void utils.geo.monthlyPlan.getCurrent.invalidate({
        projectId: selectedProjectId!,
      });
      void utils.geo.monthlyPlan.getHistory.invalidate({
        projectId: selectedProjectId!,
      });
    },
  });
  const retestMutation = trpc.geo.monthlyPlan.triggerRetest.useMutation({
    onSuccess: () => {
      void utils.geo.monthlyPlan.getCurrent.invalidate({
        projectId: selectedProjectId!,
      });
      void utils.geo.monthlyPlan.getHistory.invalidate({
        projectId: selectedProjectId!,
      });
      void utils.geo.maturity.getMaturityReport.invalidate({
        projectId: selectedProjectId!,
      });
      void utils.geo.maturity.getLatest.invalidate({
        projectId: selectedProjectId!,
      });
    },
  });

  useEffect(() => {
    const name = selectedProject?.enterpriseName?.trim() || "企业";
    document.title = `${name} - 本月资产建设计划`;
  }, [selectedProject?.enterpriseName]);

  const current = currentQuery.data;
  const plan = current?.plan ?? null;
  const tasks = current?.tasks ?? [];
  const progress = current?.progress ?? { completedCount: 0, totalCount: 0 };
  const planPhase = current?.planPhase ?? null;

  const comparisonQuery = trpc.geo.monthlyPlan.getComparison.useQuery(
    { planId: plan?.id ?? 0 },
    { enabled: Boolean(plan?.id && plan.status === "completed") }
  );

  const retestReady = useMemo(
    () =>
      plan
        ? isMonthlyPlanRetestReady({
            retestScheduledAt: plan.retestScheduledAt,
          })
        : false,
    [plan]
  );

  const canGeneratePlan =
    Boolean(maturityQuery.data) && (!plan || plan.status === "completed");
  const showGenerateEmpty =
    !currentQuery.isLoading && !plan && maturityQuery.data;
  const showActivePlan = plan?.status === "active";
  const showCompletedPlan = plan?.status === "completed";
  const optimizationBrief = optimizationBriefQuery.data ?? null;
  const hasPlan = Boolean(plan);
  const topPriorities = optimizationBrief?.priorities.length
    ? optimizationBrief.priorities.slice(0, 3)
    : selectedProjectId === 210001
      ? SAMPLE_210001_ASSET_PRIORITIES
      : [];
  const displayBrief = optimizationBrief
    ? { ...optimizationBrief, priorities: topPriorities }
    : selectedProjectId === 210001
      ? { priorities: topPriorities }
      : null;
  const displayProgress = progress.totalCount > 0
    ? progress
    : hasPlan && topPriorities.length > 0
      ? { completedCount: 0, totalCount: topPriorities.length }
      : progress;
  const hasMaturityReport = Boolean(maturityQuery.data);
  const hasServiceItems = topPriorities.length > 0 || tasks.length > 0;
  const allTasksCompleted =
    progress.totalCount > 0 && progress.completedCount >= progress.totalCount;
  const serviceConclusion = useMemo(
    () =>
      buildServiceConclusion({
        brief: displayBrief,
        hasMaturity: hasMaturityReport,
        hasPlan,
        planPhase,
        completedCount: displayProgress.completedCount,
        totalCount: displayProgress.totalCount,
      }),
    [
      hasMaturityReport,
      hasPlan,
      displayBrief,
      planPhase,
      displayProgress.completedCount,
      displayProgress.totalCount,
    ]
  );
  const customerGoals = useMemo(
    () =>
      buildCustomerGoals({
        brief: displayBrief,
        hasMaturity: hasMaturityReport,
        hasPlan,
        completedCount: displayProgress.completedCount,
        totalCount: displayProgress.totalCount,
      }),
    [
      hasMaturityReport,
      hasPlan,
      displayBrief,
      displayProgress.completedCount,
      displayProgress.totalCount,
    ]
  );
  const verificationCopy = useMemo(
    () =>
      buildVerificationCopy({
        brief: displayBrief,
        planPhase,
        retestScheduledAt: plan?.retestScheduledAt,
      }),
    [displayBrief, plan?.retestScheduledAt, planPhase]
  );
  const visibleRisks = useMemo(
    () =>
      buildCustomerRisks({
        hasMaturity: hasMaturityReport,
        hasPlan,
        priorities: topPriorities,
        completedCount: displayProgress.completedCount,
        totalCount: displayProgress.totalCount,
        planPhase,
      }),
    [
      hasMaturityReport,
      hasPlan,
      planPhase,
      displayProgress.completedCount,
      displayProgress.totalCount,
      topPriorities,
    ]
  );
  const progressSteps = useMemo(
    () => serviceProgressSteps({ hasPlan, allTasksCompleted, planPhase }),
    [allTasksCompleted, hasPlan, planPhase]
  );
  const monthlyPrimaryCta = useMemo<MonthlyPlanPrimaryCta>(() => {
    if (!hasMaturityReport) {
      return {
        label: "完善诊断",
        hint: "先完成 AI 能见度诊断，才能制定客户可读的月度优化计划。",
        path: "/maturity",
      };
    }
    if (!hasServiceItems && !canGeneratePlan) {
      return {
        label: "从资产缺口生成 Top 3 任务",
        hint: "当前没有资产建设任务，请先生成本月计划。",
        action: "generate" as const,
      };
    }
    if (!plan && canGeneratePlan) {
      return {
        label: "生成本月资产建设计划",
        hint: "把资产缺口转成 Top 3 建设任务。",
        action: "generate" as const,
      };
    }
    return {
      label: "查看执行进度",
      hint:
        planPhase === "completed" || showCompletedPlan
          ? "月度优化计划已完成，仍从执行进度进入验证和报告闭环。"
          : allTasksCompleted
            ? "本月资产建设任务已完成，下一步进入收录与 AI 复测。"
            : "本月 Top 3 资产任务已确认，可进入执行页查看推进。",
      path: "/weekly",
    };
  }, [
    allTasksCompleted,
    canGeneratePlan,
    hasMaturityReport,
    hasServiceItems,
    plan,
    planPhase,
    showCompletedPlan,
  ]);

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

  const handlePrimaryCta = () => {
    if (monthlyPrimaryCta.action === "generate") {
      handleGeneratePlan();
      return;
    }
    if (!selectedProjectId || !monthlyPrimaryCta.path) return;
    setLocation(buildProjectUrl(monthlyPrimaryCta.path, selectedProjectId));
  };

  if (!selectedProjectId && !projectsLoading) {
    return (
      <div className="space-y-6" data-testid="monthly-plan-page">
        <ProjectContextEmptyState
          title="本月资产建设计划"
          description="请先选择或创建项目后再制定本月资产建设计划。"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10" data-testid="monthly-plan-page">
      <header className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-600">
              客户主流程 · 本月资产建设计划
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">
              本月资产建设计划
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              把诊断结果转成本月要补强的 3 类品牌资产。
            </p>
          </div>
          <Button
            type="button"
            className={cn("rounded-lg", geoP0Brand.primary)}
            data-testid="monthly-plan-primary-cta"
            disabled={
              monthlyPrimaryCta.action === "generate" &&
              generateMutation.isPending
            }
            onClick={handlePrimaryCta}
          >
            {monthlyPrimaryCta.action === "generate" &&
            generateMutation.isPending ? (
              <>
                <Spinner className="mr-2 size-4" />
                生成中…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" />
                {monthlyPrimaryCta.label}
              </>
            )}
          </Button>
        </div>
      </header>

      {currentQuery.isLoading || maturityQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Spinner className="size-4" />
          加载月度优化计划…
        </div>
      ) : null}

      <P0Card testId="monthly-plan-service-proposal" className="space-y-6">
        <div>
          <div>
            <div className="flex items-center gap-2">
              <Target className="size-4 text-blue-600" />
              <p className="text-sm font-semibold text-gray-900">
                本月资产建设结论
              </p>
            </div>
            <p
              className="mt-3 text-lg font-semibold leading-8 text-gray-900"
              data-testid="monthly-plan-service-conclusion"
            >
              {serviceConclusion}
            </p>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              {monthlyPrimaryCta.hint}
            </p>
          </div>
        </div>

        <div data-testid="monthly-plan-top3-service-items">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ListChecks className="size-4 text-blue-600" />
              <p className="text-sm font-semibold text-gray-900">
                本月要补强的 3 类品牌资产
              </p>
            </div>
            {optimizationBriefQuery.isLoading && !plan ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
                <Spinner className="size-3" />
                生成中
              </span>
            ) : null}
          </div>
          {topPriorities.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-600">
              暂无本月 Top 3
              资产建设事项。建议先完成诊断或生成计划，不会把建议项伪装成已完成结果。
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {topPriorities.map(priority => {
                const status = priorityStatusLabel(priority, planPhase);
                return (
                  <article
                    key={priority.rank}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    data-testid={`monthly-plan-service-item-${priority.rank}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-blue-600">
                          资产建设 {priority.rank} ·{" "}
                          {priority.relatedDimensionName}
                        </p>
                        <h2 className="mt-1 text-base font-semibold leading-6 text-gray-900">
                          {priority.title}
                        </h2>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium",
                          priorityStatusClass(status)
                        )}
                      >
                        {status}
                      </span>
                    </div>
                    <dl className="mt-4 space-y-2 text-sm leading-5">
                      <span className="sr-only">做什么：为什么：</span>
                      <div><dt className="inline font-medium text-gray-900">补哪类资产：</dt><dd className="inline text-gray-600">{priority.relatedDimensionName || "AI 品牌资产"}</dd></div>
                      <div><dt className="inline font-medium text-gray-900">当前缺口：</dt><dd className="inline text-gray-600">{priority.shortcoming || "公开证据仍需补强"}</dd></div>
                      <div>
                        <dt className="inline font-medium text-gray-900">
                          本月动作：
                        </dt>
                        <dd className="inline text-gray-600">
                          {priority.title}
                        </dd>
                      </div>
                      <div><dt className="inline font-medium text-gray-900">会形成什么公开证据：</dt><dd className="inline text-gray-600">可访问并可回填 URL 的官网页、平台内容或第三方信源；未公开前不计为已建立。</dd></div>
                      <div>
                        <dt className="inline font-medium text-gray-900">
                          为什么影响 AI 识别/信任/推荐：
                        </dt>
                        <dd className="inline text-gray-600">
                          {priority.reason}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline font-medium text-gray-900">
                          完成标准：
                        </dt>
                        <dd className="inline text-gray-600">
                          {priority.successCriteria}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline font-medium text-gray-900">
                          验证方式：
                        </dt>
                        <dd className="inline text-gray-600">
                          {priority.retestMethod}
                        </dd>
                      </div>
                    </dl>
                    <details className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600">
                      <summary className="cursor-pointer font-medium text-gray-500">
                        查看详细说明
                      </summary>
                      <p className="mt-2">
                        {priority.shortcoming ||
                          customerValueForDimension(
                            priority.relatedDimensionKey
                          )}
                      </p>
                    </details>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </P0Card>

      {!maturityQuery.data && !maturityQuery.isLoading ? (
        <P0Card testId="monthly-plan-no-maturity">
          <p className="text-sm text-gray-700">
            请先完成 AI 能见度诊断，再生成月度优化计划。
          </p>
        </P0Card>
      ) : null}

      <details
        className="group rounded-2xl border border-gray-200 bg-white shadow-sm"
        data-testid="monthly-plan-customer-goals"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <ChevronDown className="size-4 text-gray-400 transition-transform group-open:rotate-180" />
            查看本月目标补充说明
          </span>
          <span className="text-xs font-normal text-gray-500">默认收起</span>
        </summary>
        <div className="grid gap-3 border-t border-gray-100 px-5 pb-5 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          {customerGoals.map((goal, index) => (
            <div
              key={goal}
              className="rounded-xl border border-gray-200 bg-gray-50 p-3"
            >
              <p className="text-xs font-medium text-gray-500">
                目标 {index + 1}
              </p>
              <p className="mt-1 text-sm font-semibold leading-6 text-gray-900">
                {goal}
              </p>
            </div>
          ))}
        </div>
      </details>

      {showGenerateEmpty ? (
        <P0Card testId="monthly-plan-empty">
          <p className="text-sm text-gray-700">
            成熟度评估已完成（{maturityQuery.data?.totalScore ?? "—"}{" "}
            分），点击上方主按钮生成月度优化计划。
          </p>
        </P0Card>
      ) : null}

      <P0Card testId="monthly-plan-service-progress" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="size-4 text-blue-600" />
              <p className="text-sm font-semibold text-gray-900">
                本月执行节奏
              </p>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              计划中 → 执行中 → 待验证 → 已验证 / 可报告
            </p>
          </div>
          <div
            className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center"
            data-testid="monthly-plan-progress"
          >
            <p className="text-xs text-gray-500">本月进度</p>
            <p className="text-2xl font-bold tabular-nums text-blue-700">
              {displayProgress.completedCount}/{displayProgress.totalCount}
            </p>
            <p className="text-xs text-gray-500">项完成</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {progressSteps.map(step => (
            <div
              key={step.label}
              className="rounded-xl border border-gray-200 bg-white p-3"
            >
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                  step.status === "已完成"
                    ? "bg-emerald-50 text-emerald-700"
                    : step.status === "进行中"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-gray-100 text-gray-500"
                )}
              >
                {step.status}
              </span>
              <p className="mt-2 text-sm font-semibold text-gray-900">
                {step.label}
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </P0Card>

      <details
        className="group rounded-2xl border border-gray-200 bg-white shadow-sm"
        data-testid="monthly-plan-verification-details"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <ChevronDown className="size-4 text-gray-400 transition-transform group-open:rotate-180" />
            验证安排与完成收益
          </span>
          <span className="text-xs font-normal text-gray-500">
            默认收起，不抢本月 Top 3 主线
          </span>
        </summary>
        <div className="space-y-5 border-t border-gray-100 p-5">
          <P0Card testId="monthly-plan-next-verification" className="space-y-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4 text-blue-600" />
              <p className="text-sm font-semibold text-gray-900">
                下一次验证安排
              </p>
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">
                {verificationCopy.headline}
              </p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                {verificationCopy.description}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {verificationCopy.schedule.map(item => (
                <div
                  key={item.label}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3"
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {item.label} · {item.timing}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    {item.purpose}
                  </p>
                </div>
              ))}
            </div>
            {showCompletedPlan && plan?.resultMaturityScore != null ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-sm text-emerald-800">
                  复测已完成 · 成熟度 {plan.baselineMaturityScore} →{" "}
                  {plan.resultMaturityScore} 分
                </p>
                <div
                  className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                  data-testid="monthly-plan-comparison"
                >
                  {(comparisonQuery.data?.dimensions ?? []).map(dim => (
                    <div key={dim.key} className="rounded-lg bg-white/80 p-3">
                      <p className="text-xs text-gray-500">{dim.label}</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {dim.baseline} → {dim.result ?? "—"}
                        {dim.delta != null ? (
                          <span
                            className={cn(
                              "ml-2 text-xs",
                              dim.delta >= 0
                                ? "text-emerald-600"
                                : "text-red-600"
                            )}
                          >
                            {dim.delta >= 0 ? "+" : ""}
                            {dim.delta}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {showActivePlan && retestReady ? (
              <details className="rounded-xl border border-gray-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700">
                  运营复测操作
                </summary>
                <div className="flex flex-wrap gap-2 border-t border-gray-100 p-4">
                  <Button
                    type="button"
                    variant="outline"
                    data-testid="monthly-plan-retest-btn"
                    disabled={retestMutation.isPending}
                    onClick={handleRetest}
                  >
                    {retestMutation.isPending ? "复测中…" : "立即复测"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoAiDiagnosis}
                  >
                    前往 AI 实测诊断
                  </Button>
                </div>
              </details>
            ) : null}
          </P0Card>

          {(showActivePlan || showCompletedPlan) && plan ? (
            <MonthlyPlanCompletionBenefitsSection
              progress={progress}
              tasks={tasks}
              boundPublishAccountCount={
                workspaceSummaryQuery.data?.boundPublishAccountCount ?? null
              }
            />
          ) : null}
        </div>
      </details>

      <P0Card testId="monthly-plan-customer-risks" className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-600" />
          <p className="text-sm font-semibold text-gray-900">
            当前影响交付的 3 个卡点
          </p>
        </div>
        {visibleRisks.length === 0 ? (
          <p className="text-sm text-gray-600">
            暂无明显阻断，建议继续按月度优化计划推进并复测效果。
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleRisks.map(risk => (
              <div
                key={risk.title}
                className="rounded-xl border border-amber-100 bg-amber-50/70 p-3"
              >
                <p className="text-sm font-semibold text-amber-900">
                  {risk.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-amber-800">
                  {risk.suggestion}
                </p>
              </div>
            ))}
          </div>
        )}
      </P0Card>

      {(showActivePlan || showCompletedPlan) && plan ? (
        <details
          className="group rounded-2xl border border-gray-200 bg-white shadow-sm"
          data-testid="monthly-plan-execution-details"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <ChevronDown className="size-4 text-gray-400 transition-transform group-open:rotate-180" />
              查看服务事项明细
            </span>
            <span className="text-xs font-normal text-gray-500">默认收起</span>
          </summary>
          <div className="border-t border-gray-100 px-5 pb-5 pt-4">
            {tasks.length === 0 ? (
              <p className="text-sm text-gray-500">暂无执行任务。</p>
            ) : (
              <ul className="space-y-3">
                {tasks.map(task => (
                  <li
                    key={task.id}
                    className="rounded-xl border border-gray-200 bg-white p-4"
                    data-testid={`monthly-plan-task-${task.id}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                              taskStatusClass(task.status)
                            )}
                          >
                            {taskStatusLabel(task.status)}
                          </span>
                        </div>
                        <p className="mt-2 font-medium text-gray-900">
                          {task.title}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          {task.reason}
                        </p>
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
                ))}
              </ul>
            )}
          </div>
        </details>
      ) : null}

      <details
        className="group rounded-2xl border border-gray-200 bg-white shadow-sm"
        data-testid="monthly-plan-flow-links"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <ChevronDown className="size-4 text-gray-400 transition-transform group-open:rotate-180" />
            服务流程衔接
          </span>
          <span className="text-xs font-normal text-gray-500">
            客户默认只点主 CTA
          </span>
        </summary>
        <div className="border-t border-gray-100 px-5 pb-5 pt-4">
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-blue-600" />
            <p className="text-sm font-semibold text-gray-900">
              状态 → 计划 → 执行 → 验证 → 报告
            </p>
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-5">
            {[
              { label: "服务首页", path: "/workspace" },
              { label: "月度优化计划", path: "/monthly-plan" },
              { label: "执行进度", path: "/weekly" },
              { label: "收录与 AI 复测", path: "/inclusion-monitoring" },
              { label: "交付报告", path: "/delivery-reports" },
            ].map(item => (
              <div
                key={item.path}
                className={cn(
                  "rounded-xl border px-3 py-2 text-left font-medium",
                  item.path === "/monthly-plan"
                    ? "border-blue-200 bg-blue-50 text-blue-800"
                    : "border-gray-200 bg-white text-gray-700"
                )}
              >
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </details>

      <details
        className="group rounded-2xl border border-gray-200 bg-white shadow-sm"
        data-testid="monthly-plan-history"
      >
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
                        第 {entry.plan.roundNumber} 轮 ·{" "}
                        {formatDateTime(entry.plan.generatedAt)}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        {entry.summary}
                      </p>
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
