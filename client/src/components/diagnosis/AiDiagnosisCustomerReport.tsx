import { Button } from "@/components/ui/button";
import { buildProjectUrl } from "@/lib/activeProject";
import {
  AI_DIAGNOSIS_METRIC_EXPLANATIONS,
  AI_DIAGNOSIS_PAGE_SUBTITLE,
  AI_DIAGNOSIS_RUNNING_BACKGROUND_HINT,
  AI_DIAGNOSIS_RUNNING_PATIENCE_HINT,
  formatAiDiagnosisRunningProgressLabel,
  type AiDiagnosisFirstScreenState,
  type AiDiagnosisPlatformCustomerStatus,
  type AiDiagnosisRunningProgress,
  mapPlatformPerformanceToCustomerStatus,
  resolveTestRoundPhaseLabel,
} from "@shared/aiDiagnosisReportDisplay";
import type { MaturityWeaknessHighlight } from "@shared/maturityDetailDisplay";
import { formatT0Rate, T0_AI_ENGINE_OPTIONS, type T0QuestionTypeGroup } from "@shared/t0DiagnosisDisplay";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, FileSearch, Lightbulb, Route } from "lucide-react";

type PlatformCard = {
  id: string;
  name: string;
  icon: string;
  tested: boolean;
  status: string;
  customerStatus: AiDiagnosisPlatformCustomerStatus;
  summary: string;
  mentionCount: number;
  recommendCount: number;
};

type PlatformRunningRow = {
  platformId: string;
  platformName: string;
  status: string;
};

type DiagnosisProblemItem = {
  title: string;
  impact: string;
  fix: string;
  ctaLabel: string;
  path: string;
};

type DiagnosisMissReason = {
  title: string;
  why: string;
  fix: string;
  active: boolean;
};

type DiagnosisRepairStep = {
  title: string;
  status: "current" | "next" | "pending";
  description: string;
};

export type AiDiagnosisCustomerReportProps = {
  firstScreenState: AiDiagnosisFirstScreenState;
  selectedProjectId: number | null;
  canOperate: boolean;
  enabledQuestionCount: number;
  platformCount: number;
  startDisabled: boolean;
  onStartDiagnosis: () => void;
  onViewQuestionPool: () => void;
  runningProgress: AiDiagnosisRunningProgress;
  diagnosisHasRuns: boolean;
  platformRunningRows: PlatformRunningRow[];
  roundFailed: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onGoMonthlyPlan: () => void;
  reportConclusion: string;
  mentionPctDisplay: number | null;
  recommendPctDisplay: number | null;
  competitorPctDisplay: number | null;
  coveredQuestionDisplay: string;
  coveredPlatformCount: number;
  aiRecognitionStatus: string;
  aiRecommendStatus: string;
  lastDiagnosisLabel: string;
  platformCards: PlatformCard[];
  topWeaknesses: MaturityWeaknessHighlight[];
  scenarioGroups: T0QuestionTypeGroup[];
  totalRunCount: number;
  mentionedRunCount: number;
  recommendedRunCount: number;
  competitorNames: string[];
  hasExecutionTasks: boolean;
  detectionPhaseLabel: string;
  detectionTimeLabel: string | null;
  onViewFullData: () => void;
  onNavigate: (path: string) => void;
};

const BEFORE_OUTCOMES = [
  "AI 是否知道你的品牌",
  "品牌提及率",
  "品牌推荐率",
  "竞品出现情况",
  "各平台表现差异",
  "优先优化建议",
] as const;

const RUNNING_PREVIEW = [
  "AI 是否认识、提到并推荐你的品牌",
  "五大平台表现对比",
  "品牌提及率、推荐率与竞品出现率",
  "最需要改善的 3 件事",
] as const;

function platformRunningBadgeClass(status: string): string {
  if (status === "已完成") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "检测中") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "检测失败") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "暂未检测") return "border-gray-200 bg-gray-50 text-gray-500";
  return "border-gray-200 bg-gray-50 text-gray-600";
}

function platformCustomerBadgeClass(status: AiDiagnosisPlatformCustomerStatus): string {
  if (status === "表现较好") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "已识别但推荐不足") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "未明显识别") return "border-orange-200 bg-orange-50 text-orange-800";
  if (status === "检测失败") return "border-red-200 bg-red-50 text-red-800";
  return "border-gray-200 bg-gray-50 text-gray-500";
}

function weaknessActionLabel(path: string, defaultLabel: string): string {
  if (path.includes("monthly-plan")) return "去生成本月优化计划";
  if (path.includes("enterprise-profile")) return "去完善品牌资产";
  if (path.includes("brand-source-graph")) return "去查看信源图谱";
  if (path.includes("/weekly")) return "去内容生产";
  return defaultLabel;
}

function formatCustomerPercent(value: number | null): string {
  return value == null ? "待诊断" : `${value}%`;
}

function parseCoveredQuestionCounts(display: string): { covered: number | null; total: number | null; missing: number | null } {
  const match = display.match(/^(\d+)\/(\d+)$/);
  if (!match) return { covered: null, total: null, missing: null };
  const covered = Number(match[1]);
  const total = Number(match[2]);
  return { covered, total, missing: Math.max(0, total - covered) };
}

function resolveAccuracyStatus(competitorPct: number | null): string {
  if (competitorPct == null) return "待确认";
  if (competitorPct >= 50) return "容易跑偏";
  if (competitorPct >= 25) return "需要校准";
  return "基本稳定";
}

function resolvePrimaryDiagnosisCta(hasExecutionTasks: boolean): { label: string; path: string; hint: string } {
  if (hasExecutionTasks) {
    return {
      label: "查看执行进度",
      path: "/weekly",
      hint: "诊断已转成内容任务，下一步看本月执行推进到哪一步。",
    };
  }
  return {
    label: "制定本月服务方案",
    path: "/monthly-plan",
    hint: "先把诊断问题转成客户看得懂、交付能执行的本月服务方案。",
  };
}

function buildCustomerDiagnosisProblems(input: {
  mentionPct: number | null;
  recommendPct: number | null;
  competitorPct: number | null;
  coveredQuestionDisplay: string;
  topWeaknesses: MaturityWeaknessHighlight[];
}): DiagnosisProblemItem[] {
  const mention = input.mentionPct ?? 0;
  const recommend = input.recommendPct ?? 0;
  const competitor = input.competitorPct ?? 0;
  const coverage = parseCoveredQuestionCounts(input.coveredQuestionDisplay);
  const problems: DiagnosisProblemItem[] = [];

  if (mention <= 20) {
    problems.push({
      title: "AI 对品牌识别不稳定",
      impact: "客户问到相关品类时，AI 可能不知道你是谁，品牌很难进入备选名单。",
      fix: "先补齐品牌资料、服务对象、案例证明和公开信源，让 AI 能稳定理解品牌。",
      ctaLabel: "完善品牌资料",
      path: "/enterprise-profile",
    });
  }
  if (mention > 20 && recommend <= 20) {
    problems.push({
      title: "AI 知道品牌，但推荐意愿不足",
      impact: "AI 可能会提到你，但在推荐场景里仍更倾向竞品或泛化答案。",
      fix: "补充客户案例、对比理由、服务成果和可信证据，形成推荐理由。",
      ctaLabel: "查看本月方案",
      path: "/monthly-plan",
    });
  }
  if (competitor >= 35) {
    problems.push({
      title: "竞品在 AI 认知中占位更强",
      impact: "当用户问“推荐谁、怎么选”时，AI 更容易引用竞品信息。",
      fix: "围绕竞品比较、差异化优势和客户成功案例补充公开内容。",
      ctaLabel: "补强信源证据",
      path: "/brand-source-graph",
    });
  }
  if ((coverage.missing ?? 0) > 0) {
    problems.push({
      title: "用户常问问题还没有完全覆盖",
      impact: "没有被内容覆盖的问题，AI 很难找到足够材料回答并推荐品牌。",
      fix: "把未覆盖问题转成内容任务，优先生产能被搜索和 AI 引用的回答。",
      ctaLabel: "查看执行进度",
      path: "/weekly",
    });
  }

  for (const weakness of input.topWeaknesses) {
    if (problems.length >= 3) break;
    problems.push({
      title: weakness.label,
      impact: weakness.conclusion,
      fix: weakness.action,
      ctaLabel: weaknessActionLabel(weakness.path, weakness.ctaLabel),
      path: weakness.path,
    });
  }

  if (problems.length === 0) {
    problems.push({
      title: "诊断未发现明显单点阻断",
      impact: "当前样本表现相对稳定，但仍需要扩大问题覆盖，避免只在少数问题里表现好。",
      fix: "继续按本月方案执行内容补齐，并在发布后安排效果验证。",
      ctaLabel: "查看本月方案",
      path: "/monthly-plan",
    });
  }

  return problems.slice(0, 3);
}

function buildAiNotRecommendReasons(input: {
  mentionPct: number | null;
  recommendPct: number | null;
  competitorPct: number | null;
  coveredQuestionDisplay: string;
}): DiagnosisMissReason[] {
  const mention = input.mentionPct ?? 0;
  const recommend = input.recommendPct ?? 0;
  const competitor = input.competitorPct ?? 0;
  const coverage = parseCoveredQuestionCounts(input.coveredQuestionDisplay);
  return [
    {
      title: "公开证据还不够让 AI 相信你",
      why: "AI 更愿意推荐有清晰案例、第三方信息和公开内容支撑的品牌。",
      fix: "补齐案例证明、服务成果、媒体/平台内容和可引用信源。",
      active: mention <= 50 || recommend <= 20,
    },
    {
      title: "AI 不清楚你的核心优势",
      why: "如果品牌定位、服务对象和差异化表达不稳定，AI 会给出泛化答案。",
      fix: "统一品牌资料、客户画像、核心卖点和竞品对比表达。",
      active: mention <= 50,
    },
    {
      title: "用户问题缺少内容承接",
      why: "AI 回答依赖公开语料；常见问题没有内容覆盖时，很难被引用。",
      fix: "把未覆盖问题转成知乎、搜狐号、公众号等平台内容任务。",
      active: (coverage.missing ?? 0) > 0,
    },
    {
      title: "品牌信息在不同信源中不够一致",
      why: "名称、服务范围、优势和案例口径不一致，会降低 AI 判断稳定性。",
      fix: "梳理品牌资料和信源证据，保持公开信息一致。",
      active: competitor >= 25 || mention <= 50,
    },
    {
      title: "竞品公开内容更容易被引用",
      why: "竞品如果有更多问答、案例和对比内容，AI 会更容易把它们放进推荐答案。",
      fix: "补充竞品比较、选型指南和场景解决方案，建立自己的引用入口。",
      active: competitor >= 35,
    },
  ];
}

function buildDiagnosisRepairSteps(hasExecutionTasks: boolean): DiagnosisRepairStep[] {
  return [
    {
      title: "诊断问题",
      status: "current",
      description: "先确认 AI 是否知道你、是否愿意推荐你，以及卡在哪些问题场景。",
    },
    {
      title: "本月方案",
      status: "next",
      description: "把诊断问题翻译成本月要做的 3 件服务事项。",
    },
    {
      title: "内容执行",
      status: hasExecutionTasks ? "next" : "pending",
      description: "围绕未覆盖问题生成并发布可被 AI 引用的内容。",
    },
    {
      title: "效果验证",
      status: "pending",
      description: "发布后确认是否被搜索看见，并安排 AI 复测。",
    },
    {
      title: "效果报告",
      status: "pending",
      description: "把诊断、执行和变化整理成客户续费能看懂的证据。",
    },
  ];
}

function scenarioIssueLabel(group: T0QuestionTypeGroup): string {
  if (group.totalRuns === 0) return "暂无实测证据";
  if (group.mentionRate === 0) return "AI 尚未明显识别品牌";
  if (group.recommendRate === 0) return "提到品牌但没有形成推荐";
  if (group.competitorAppearances > group.recommendedCount) return "竞品更容易被引用";
  return "表现可继续扩大覆盖";
}

export function AiDiagnosisCustomerReport(props: AiDiagnosisCustomerReportProps) {
  const {
    firstScreenState,
    selectedProjectId,
    canOperate,
    enabledQuestionCount,
    platformCount,
    startDisabled,
    onStartDiagnosis,
    onViewQuestionPool,
    runningProgress,
    diagnosisHasRuns,
    platformRunningRows,
    roundFailed,
    refreshing,
    onRefresh,
    onGoMonthlyPlan,
    reportConclusion,
    mentionPctDisplay,
    recommendPctDisplay,
    competitorPctDisplay,
    coveredQuestionDisplay,
    coveredPlatformCount,
    aiRecognitionStatus,
    aiRecommendStatus,
    lastDiagnosisLabel,
    platformCards,
    topWeaknesses,
    scenarioGroups,
    totalRunCount,
    mentionedRunCount,
    recommendedRunCount,
    competitorNames,
    hasExecutionTasks,
    detectionPhaseLabel,
    detectionTimeLabel,
    onViewFullData,
    onNavigate,
  } = props;

  const platformLabels = T0_AI_ENGINE_OPTIONS.map(option => option.label).join("、");
  const primaryCta = selectedProjectId ? resolvePrimaryDiagnosisCta(hasExecutionTasks) : null;
  const diagnosisProblems = buildCustomerDiagnosisProblems({
    mentionPct: mentionPctDisplay,
    recommendPct: recommendPctDisplay,
    competitorPct: competitorPctDisplay,
    coveredQuestionDisplay,
    topWeaknesses,
  });
  const aiMissReasons = buildAiNotRecommendReasons({
    mentionPct: mentionPctDisplay,
    recommendPct: recommendPctDisplay,
    competitorPct: competitorPctDisplay,
    coveredQuestionDisplay,
  });
  const repairSteps = buildDiagnosisRepairSteps(hasExecutionTasks);
  const coverageCounts = parseCoveredQuestionCounts(coveredQuestionDisplay);

  if (firstScreenState === "before") {
    return (
      <div className="space-y-6">
        <div
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          data-testid="ai-diagnosis-first-screen"
        >
          <h1 className="text-2xl font-bold text-gray-900">诊断问题页</h1>
          <p className="mt-1 text-sm text-gray-500">回答“为什么现在 AI 还没有稳定推荐我？”</p>
          <p className="mt-4 text-sm leading-relaxed text-gray-600" data-testid="ai-diagnosis-before-suggestion">
            当前还缺少一份优化前基线。先用客户真实会问的问题做 AI 现状诊断，确认 AI 是否认识你、是否愿意推荐你、是否把竞品放在你前面。
          </p>
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            <p className="text-xs font-medium text-gray-700">检测完成后可获得：</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {BEFORE_OUTCOMES.map(item => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-blue-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              type="button"
              className="h-11 bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="ai-diagnosis-start-t0-gate"
              disabled={startDisabled}
              onClick={onStartDiagnosis}
            >
              开始 AI 现状诊断
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 border-gray-300 text-gray-700 hover:bg-gray-50"
              data-testid="ai-diagnosis-view-question-pool"
              disabled={!selectedProjectId}
              onClick={onViewQuestionPool}
            >
              查看问题池
            </Button>
          </div>
        </div>

        <div
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          data-testid="ai-diagnosis-scope-card"
        >
          <h2 className="text-sm font-semibold text-gray-900">检测范围</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">本次检测问题数</p>
              <p className="mt-1 text-xl font-bold text-gray-900">
                {enabledQuestionCount > 0 ? enabledQuestionCount : "请先启用问题"}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">覆盖 AI 平台</p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-gray-900">{platformLabels}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">检测目的</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-700">
                了解 AI 当前是否认识、提到并推荐你的品牌，为后续优化提供基线。
              </p>
            </div>
          </div>
        </div>

        <details className="group rounded-2xl border border-gray-200 bg-white shadow-sm" data-testid="ai-diagnosis-detection-guide">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
            <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
            检测说明
          </summary>
          <div className="space-y-3 border-t border-gray-100 px-5 pb-5 pt-4 text-sm leading-relaxed text-gray-600">
            <p>
              AI 现状诊断会在主流 AI 平台模拟客户真实提问，检测品牌是否被认识、提及和推荐。结果将作为优化前的基线，发布内容后可再次复测对比成效。
            </p>
            <p className="text-xs text-gray-500">
              复测节奏：优化前检测 → 发布后 7 天复测 → 发布后 14 天复测 → 发布后 30 天复测。
            </p>
          </div>
        </details>
      </div>
    );
  }

  if (firstScreenState === "running") {
    const progressLabel = formatAiDiagnosisRunningProgressLabel({
      progress: runningProgress,
      hasRuns: diagnosisHasRuns,
    });
    const progressPercent =
      runningProgress.percent ??
      (runningProgress.totalQuestions > 0 && runningProgress.completedQuestions > 0
        ? Math.round((runningProgress.completedQuestions / runningProgress.totalQuestions) * 100)
        : null);
    return (
      <div className="space-y-6">
        <div
          className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 via-white to-white p-6 shadow-sm"
          data-testid="ai-diagnosis-first-screen"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">AI 正在后台检测中</h1>
            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800">
              后台运行中
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-600" data-testid="ai-diagnosis-running-hint">
            系统正在模拟客户在主流 AI 平台中的真实提问，检测 AI 是否认识、提到并推荐你的品牌。
          </p>

          {roundFailed ? (
            <div
              className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              data-testid="ai-diagnosis-running-failed-hint"
            >
              部分平台检测失败，可稍后重试。
            </div>
          ) : null}

          <div className="mt-5 space-y-3" data-testid="ai-diagnosis-t0-progress">
            <p className="text-sm font-medium text-gray-800" data-testid="ai-diagnosis-running-progress-label">
              {progressLabel}
            </p>
            {progressPercent != null ? (
              <>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${Math.max(4, progressPercent)}%` }}
                  />
                </div>
              </>
            ) : null}
            <p className="text-sm text-gray-600">当前状态：后台运行中</p>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-gray-600">{AI_DIAGNOSIS_RUNNING_BACKGROUND_HINT}</p>
          <p className="mt-2 text-xs text-gray-500">{AI_DIAGNOSIS_RUNNING_PATIENCE_HINT}</p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 border-gray-300 text-gray-700 hover:bg-gray-50"
              data-testid="ai-diagnosis-refresh-t0-status"
              disabled={refreshing}
              onClick={onRefresh}
            >
              {refreshing ? "正在刷新…" : "刷新进度"}
            </Button>
            <Button
              type="button"
              className="h-11 bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="ai-diagnosis-go-monthly-plan"
              onClick={onGoMonthlyPlan}
            >
              去执行本月任务
            </Button>
          </div>
        </div>

        <div
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          data-testid="ai-diagnosis-platform-progress"
        >
          <h2 className="text-sm font-semibold text-gray-900">平台检测进度</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {platformRunningRows.map(row => (
              <div
                key={row.platformId}
                className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                data-testid={`ai-diagnosis-platform-running-${row.platformId}`}
              >
                <p className="text-sm font-medium text-gray-900">{row.platformName}</p>
                <span
                  className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${platformRunningBadgeClass(row.status)}`}
                >
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6">
          <h2 className="text-sm font-semibold text-gray-900">检测完成后将生成</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-gray-600">
            {RUNNING_PREVIEW.map(item => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gray-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-6 shadow-sm"
        data-testid="ai-diagnosis-first-screen"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <FileSearch className="size-5 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">诊断问题页</h1>
            </div>
            <p className="mt-1 text-sm text-gray-500">回答“为什么现在 AI 还没有稳定推荐我？”</p>
            {lastDiagnosisLabel !== "暂无" ? (
              <p className="mt-2 text-xs text-gray-500">最近检测：{lastDiagnosisLabel}</p>
            ) : null}
            <p
              className="mt-5 text-lg font-semibold leading-8 text-gray-900"
              data-testid="ai-diagnosis-report-conclusion"
            >
              {reportConclusion}
            </p>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              第一屏只回答一个问题：为什么 AI 还没有稳定推荐，以及本月先改哪件事。完整证据和检测记录已下沉到运营明细。
            </p>
          </div>
          {primaryCta ? (
            <Button
              type="button"
              className="h-11 bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="ai-diagnosis-primary-cta"
              onClick={() => onNavigate(buildProjectUrl(primaryCta.path, selectedProjectId!))}
            >
              <ArrowRight className="mr-2 size-4" />
              {primaryCta.label}
            </Button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="ai-diagnosis-customer-metrics">
          <MetricBlock
            testId="ai-diagnosis-recognition-status"
            label="AI 是否知道你"
            value={aiRecognitionStatus}
            hint={`品牌提及表现：${formatCustomerPercent(mentionPctDisplay)}。`}
          />
          <MetricBlock
            testId="ai-diagnosis-recommend-status"
            label="AI 是否愿意推荐你"
            value={aiRecommendStatus}
            hint={`推荐表现：${formatCustomerPercent(recommendPctDisplay)}。`}
          />
          <MetricBlock
            testId="ai-diagnosis-accuracy-status"
            label="AI 是否说得准"
            value={resolveAccuracyStatus(competitorPctDisplay)}
            hint={competitorPctDisplay == null ? "待完成实测。" : `竞品出现占比 ${competitorPctDisplay}%。`}
          />
          <MetricBlock
            testId="ai-diagnosis-uncovered-questions"
            label="哪些问题还没覆盖"
            value={
              coverageCounts.missing == null
                ? coveredQuestionDisplay
                : coverageCounts.missing === 0
                  ? "已覆盖"
                  : `${coverageCounts.missing} 个待补`
            }
            hint={`已实测问题：${coveredQuestionDisplay}。`}
          />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <section
            className="rounded-xl border border-amber-100 bg-amber-50/70 p-4"
            data-testid="ai-diagnosis-top-problems"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-700" />
              <h2 className="text-sm font-semibold text-amber-950">当前最大 3 个诊断问题</h2>
            </div>
            <ol className="mt-3 space-y-3">
              {diagnosisProblems.map((problem, index) => (
                <li key={`${problem.title}-${index}`} className="rounded-lg bg-white/80 p-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {index + 1}. {problem.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-600">
                    <span className="font-medium text-gray-700">业务影响：</span>
                    {problem.impact}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-600">
                    <span className="font-medium text-gray-700">怎么修：</span>
                    {problem.fix}
                  </p>
                  {selectedProjectId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 border-amber-200 bg-white text-amber-900 hover:bg-amber-50"
                      onClick={() => onNavigate(buildProjectUrl(problem.path, selectedProjectId))}
                    >
                      {problem.ctaLabel}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>

          <section
            className="rounded-xl border border-blue-100 bg-white p-4"
            data-testid="ai-diagnosis-evidence-summary"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-900">诊断证据摘要</h2>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <EvidenceItem label="AI 回答样本" value={totalRunCount > 0 ? `${totalRunCount} 条` : "暂无"} />
              <EvidenceItem label="覆盖平台" value={coveredPlatformCount > 0 ? `${coveredPlatformCount} 个` : "待诊断"} />
              <EvidenceItem label="品牌被提到" value={mentionedRunCount > 0 ? `${mentionedRunCount} 条` : "暂无"} />
              <EvidenceItem label="品牌被推荐" value={recommendedRunCount > 0 ? `${recommendedRunCount} 条` : "暂无"} />
            </div>
            <p className="mt-3 text-xs leading-5 text-gray-500">
              证据只保留客户能判断的摘要：{platformCards.find(card => card.tested)?.summary ?? "当前诊断数据不足，建议先完成 AI 实测。"}
            </p>
            {competitorNames.length > 0 ? (
              <p className="mt-2 text-xs leading-5 text-gray-500">
                常见竞品占位：{competitorNames.slice(0, 4).join("、")}
              </p>
            ) : null}
            {primaryCta ? <p className="mt-3 text-xs leading-5 text-blue-700">{primaryCta.hint}</p> : null}
          </section>
        </div>
      </div>

      <section
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        data-testid="ai-diagnosis-scenario-breakdown"
      >
        <h2 className="text-lg font-semibold text-gray-900">问题场景拆解</h2>
        <p className="mt-1 text-sm text-gray-500">把问题池和 AI 实测结果翻译成客户能理解的场景表现。</p>
        {scenarioGroups.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {scenarioGroups.slice(0, 6).map(group => (
              <article key={group.questionType} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-900">{group.label}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>
                    <dt className="text-gray-400">是否提及</dt>
                    <dd className="mt-0.5 font-medium text-gray-800">{formatT0Rate(group.mentionRate)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">是否推荐</dt>
                    <dd className="mt-0.5 font-medium text-gray-800">{formatT0Rate(group.recommendRate)}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs leading-5 text-gray-600">
                  <span className="font-medium text-gray-700">主要问题：</span>
                  {scenarioIssueLabel(group)}
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-600">
                  <span className="font-medium text-gray-700">建议动作：</span>
                  {group.recommendRate === 0
                    ? "围绕该场景补充可引用内容和推荐理由。"
                    : "继续扩大相似问题覆盖，并在发布后复测。"}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div
            className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4"
            data-testid="ai-diagnosis-scenario-breakdown-empty"
          >
            <p className="text-sm text-gray-600">暂无问题场景实测数据，建议先完成 AI 实测诊断。</p>
            {selectedProjectId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 border-gray-300"
                data-testid="ai-diagnosis-view-question-pool-empty"
                onClick={() => onNavigate(buildProjectUrl("/questions", selectedProjectId))}
              >
                查看 AI 问题池
              </Button>
            ) : null}
          </div>
        )}
      </section>

      <section
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        data-testid="ai-diagnosis-not-recommended-reasons"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="size-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-gray-900">AI 为什么不稳定推荐</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {aiMissReasons.map(reason => (
            <div
              key={reason.title}
              className={`rounded-xl border p-4 ${reason.active ? "border-amber-200 bg-amber-50/70" : "border-gray-100 bg-gray-50"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900">{reason.title}</p>
                {reason.active ? (
                  <span className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-xs text-amber-800">
                    当前重点
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-xs leading-5 text-gray-600">
                <span className="font-medium text-gray-700">原因：</span>
                {reason.why}
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-600">
                <span className="font-medium text-gray-700">怎么改：</span>
                {reason.fix}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        data-testid="ai-diagnosis-repair-path"
      >
        <div className="flex items-center gap-2">
          <Route className="size-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">从诊断到修复路径</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {repairSteps.map(step => (
            <div
              key={step.title}
              className={`rounded-xl border p-3 ${
                step.status === "current"
                  ? "border-blue-200 bg-blue-50 text-blue-900"
                  : step.status === "next"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-gray-200 bg-gray-50 text-gray-600"
              }`}
            >
              <p className="text-xs font-medium">
                {step.status === "current" ? "当前页" : step.status === "next" ? "下一步" : "待开始"}
              </p>
              <p className="mt-1 text-sm font-semibold">{step.title}</p>
              <p className="mt-2 text-xs leading-5">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        data-testid="ai-diagnosis-platform-evidence-summary"
      >
        <h2 className="text-lg font-semibold text-gray-900">AI 平台证据摘要</h2>
        <p className="mt-1 text-xs text-gray-500">只展示摘要，不铺满原始回答；完整证据在下方“运营诊断明细 / 证据详情”。</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {platformCards.map(p => (
            <div
              key={p.id}
              className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
              data-testid={`ai-diagnosis-platform-${p.id}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{p.icon}</span>
                <p className="text-sm font-medium text-gray-900">{p.name}</p>
              </div>
              <span
                className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-medium ${platformCustomerBadgeClass(p.customerStatus)}`}
                data-testid={`ai-diagnosis-platform-status-${p.id}`}
              >
                {p.customerStatus}
              </span>
              <p className="text-xs leading-relaxed text-gray-600">{p.summary}</p>
              {p.tested ? (
                <p className="text-[11px] text-gray-400">
                  {p.mentionCount > 0 ? "已提到品牌" : "未提到品牌"}
                  {p.recommendCount > 0 ? " · 已推荐品牌" : ""}
                </p>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="ai-diagnosis-coverage-scope">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs text-gray-500">检测问题数量</p>
            <p className="mt-1 text-lg font-bold text-gray-900">{coveredQuestionDisplay}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs text-gray-500">覆盖平台</p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {coveredPlatformCount > 0 ? `${coveredPlatformCount} 个平台` : platformLabels}
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs text-gray-500">检测时间</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{detectionTimeLabel ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs text-gray-500">检测阶段</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{detectionPhaseLabel}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function EvidenceItem(props: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="text-xs text-gray-500">{props.label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{props.value}</p>
    </div>
  );
}

function MetricBlock(props: { testId: string; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" data-testid={props.testId}>
      <p className="text-xs font-medium text-gray-500">{props.label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{props.value}</p>
      <p className="mt-2 text-xs leading-relaxed text-gray-500">{props.hint}</p>
    </div>
  );
}
