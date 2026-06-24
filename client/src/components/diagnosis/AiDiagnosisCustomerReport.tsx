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
import { T0_AI_ENGINE_OPTIONS } from "@shared/t0DiagnosisDisplay";
import { ChevronDown } from "lucide-react";

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
    detectionPhaseLabel,
    detectionTimeLabel,
    onViewFullData,
    onNavigate,
  } = props;

  const platformLabels = T0_AI_ENGINE_OPTIONS.map(option => option.label).join("、");

  if (firstScreenState === "before") {
    return (
      <div className="space-y-6">
        <div
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          data-testid="ai-diagnosis-first-screen"
        >
          <h1 className="text-2xl font-bold text-gray-900">开始 AI 现状诊断</h1>
          <p className="mt-1 text-sm text-gray-500">{AI_DIAGNOSIS_PAGE_SUBTITLE}</p>
          <p className="mt-4 text-sm leading-relaxed text-gray-600" data-testid="ai-diagnosis-before-suggestion">
            系统将基于客户真实会问的问题，在豆包、DeepSeek、Kimi、通义千问、文心一言等平台中检测 AI
            是否认识、提到并推荐你的品牌。
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
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        data-testid="ai-diagnosis-first-screen"
      >
        <h1 className="text-2xl font-bold text-gray-900">AI 当前怎么看你</h1>
        <p className="mt-1 text-sm text-gray-500">{AI_DIAGNOSIS_PAGE_SUBTITLE}</p>
        {lastDiagnosisLabel !== "暂无" ? (
          <p className="mt-2 text-xs text-gray-500">最近检测：{lastDiagnosisLabel}</p>
        ) : null}

        <p className="mt-5 text-base font-medium leading-relaxed text-gray-900" data-testid="ai-diagnosis-report-conclusion">
          {reportConclusion}
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="ai-diagnosis-core-summary">
          <MetricBlock
            testId="ai-diagnosis-recognition-status"
            label="AI 是否认识你"
            value={aiRecognitionStatus}
            hint="AI 回答中是否能识别你的品牌。"
          />
          <MetricBlock
            testId="ai-diagnosis-mention-rate"
            label="品牌提及率"
            value={mentionPctDisplay != null ? `${mentionPctDisplay}%` : "--"}
            hint={AI_DIAGNOSIS_METRIC_EXPLANATIONS.mentionRate}
          />
          <MetricBlock
            testId="ai-diagnosis-recommend-status"
            label="AI 是否推荐你"
            value={aiRecommendStatus}
            hint="AI 是否把你作为推荐选项。"
          />
          <MetricBlock
            testId="ai-diagnosis-recommend-rate"
            label="品牌推荐率"
            value={recommendPctDisplay != null ? `${recommendPctDisplay}%` : "--"}
            hint={AI_DIAGNOSIS_METRIC_EXPLANATIONS.recommendRate}
          />
          <MetricBlock
            testId="ai-diagnosis-competitor-rate"
            label="竞品出现率"
            value={competitorPctDisplay != null ? `${competitorPctDisplay}%` : "--"}
            hint={AI_DIAGNOSIS_METRIC_EXPLANATIONS.competitorRate}
          />
          <MetricBlock
            testId="ai-diagnosis-covered-questions"
            label="覆盖问题数"
            value={coveredQuestionDisplay}
            hint={AI_DIAGNOSIS_METRIC_EXPLANATIONS.coveredQuestions}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            type="button"
            className="h-11 bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="ai-diagnosis-go-monthly-plan"
            onClick={onGoMonthlyPlan}
          >
            查看本月优化计划
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 border-gray-300 text-gray-700 hover:bg-gray-50"
            data-testid="ai-diagnosis-view-results"
            onClick={onViewFullData}
          >
            查看完整检测数据
          </Button>
        </div>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm" data-testid="ai-diagnosis-platform-cards">
        <h2 className="text-lg font-semibold text-gray-900">五大 AI 平台表现</h2>
        <p className="mt-1 text-xs text-gray-500">基于真实 AI 平台实测结果，不含原始回答内容。</p>
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
      </section>

      <section
        className="rounded-2xl border border-amber-100 bg-white p-6 shadow-sm"
        data-testid="ai-diagnosis-top-improvements"
      >
        <h2 className="text-lg font-semibold text-gray-900">最需要改善的 3 件事</h2>
        {topWeaknesses.length > 0 ? (
          <>
            <p className="mt-1 text-xs text-gray-500">基于 AI 品牌成熟度短板分析，优先补齐最弱项。</p>
            <ol className="mt-4 space-y-4">
              {topWeaknesses.map((item, index) => (
                <li
                  key={item.key}
                  className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                  data-testid={`ai-diagnosis-improvement-${item.key}`}
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {index + 1}. {item.label}
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    <span className="font-medium text-gray-600">原因：</span>
                    {item.conclusion}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    <span className="font-medium text-gray-600">对应成熟度短板：</span>
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    <span className="font-medium text-gray-700">建议：</span>
                    {item.action}
                  </p>
                  {selectedProjectId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 border-gray-300"
                      onClick={() => onNavigate(buildProjectUrl(item.path, selectedProjectId))}
                    >
                      {weaknessActionLabel(item.path, item.ctaLabel)}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <div
            className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4"
            data-testid="ai-diagnosis-top-improvements-empty"
          >
            <p className="text-sm text-gray-600">AI品牌成熟度评分尚未完成，暂无改善建议</p>
            {selectedProjectId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 border-gray-300"
                data-testid="ai-diagnosis-go-maturity-score"
                onClick={() => onNavigate(buildProjectUrl("/maturity", selectedProjectId))}
              >
                去完成品牌成熟度评分 →
              </Button>
            ) : null}
          </div>
        )}
      </section>

      <section
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        data-testid="ai-diagnosis-coverage-scope"
      >
        <h2 className="text-sm font-semibold text-gray-900">本次检测覆盖范围</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

function MetricBlock(props: { testId: string; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" data-testid={props.testId}>
      <p className="text-xs font-medium text-gray-500">{props.label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{props.value}</p>
      <p className="mt-2 text-xs leading-relaxed text-gray-500">{props.hint}</p>
    </div>
  );
}
