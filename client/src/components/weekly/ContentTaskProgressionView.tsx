import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import type {
  ContentOptimizationTaskView,
  RecommendedPlatformView,
} from "@shared/contentOptimizationTaskView";
import {
  MONTHLY_PLAN_UNBOUND_HINT,
  WEEKLY_CONTENT_TASK_VIEW_FALLBACK_MESSAGE,
} from "@shared/contentOptimizationTaskView";
import { resolveWeeklyContentSourceTypeLabel } from "@shared/weeklyContentEntryContext";
import {
  computeTaskBoardProgress,
  resolvePlatformTaskAction,
  shouldDisablePlatformGenerateButton,
  showSerialGenerationHint,
  WEEKLY_SERIAL_GENERATION_HINT,
  type PlatformTaskActionKind,
  type TaskBoardProgressMetrics,
} from "@shared/weeklyContentTaskBoard";
import {
  WEEKLY_CONTENT_TASK_STATUS_BADGE_CLASS,
  weeklyContentTaskStatusLabel,
  type WeeklyContentTaskStatus,
} from "@shared/weeklyContentTaskStatus";
import { cn } from "@/lib/utils";
import { ArrowRight, Target } from "lucide-react";
import type { PlatformBoardRow } from "@/components/weekly/PlatformContentBoard";
import type { WeeklyPlatformKey } from "@shared/articlePublishPlatform";

const DIMENSION_LABEL_MAP: Record<string, string> = {
  brandIdentity: "提升品牌实体清晰度",
  categoryPositioning: "提升品类定位清晰度",
  questionCoverage: "提升搜索问题覆盖度",
  sourceGraph: "提升公开信源完整度",
  trustEvidence: "提升信任证据强度",
  aiTestPerformance: "提升 AI 实测表现",
};

function humanizeTarget(raw: string): string {
  return DIMENSION_LABEL_MAP[raw] ?? raw;
}

/* ─── Module 1: Current Content Task Card ─── */

type CurrentContentTaskCardProps = {
  view: ContentOptimizationTaskView;
  sourceTypeLabel?: string;
};

export function CurrentContentTaskCard({ view, sourceTypeLabel }: CurrentContentTaskCardProps) {
  const source =
    sourceTypeLabel ??
    (view.monthlyPlanId ? "本月优化计划" : "AI搜索问题");

  return (
    <section data-testid="task-current-content-card">
      <P0Card
        testId="task-hero-question"
        className="border-blue-100 bg-gradient-to-br from-blue-50/80 to-white"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100">
            <Target className="h-5 w-5 text-blue-700" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                当前内容任务
              </p>
              <p className="mt-1 text-xs text-gray-500" data-testid="task-source-type">
                当前内容来源：{source}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">关联问题</p>
              <h2
                className="mt-0.5 text-lg font-bold leading-snug text-gray-900"
                data-testid="task-hero-question-text"
              >
                {view.questionText}
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div data-testid="task-hero-reason">
                <p className="text-xs font-medium text-gray-500">当前任务说明</p>
                <p className="mt-0.5 text-sm text-gray-800">{view.taskTitle}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">为什么重要</p>
                <p className="mt-0.5 text-sm text-gray-800">{view.taskReason}</p>
              </div>
              <div className="sm:col-span-2" data-testid="task-hero-gap">
                <p className="text-xs font-medium text-gray-500">对应成熟度短板</p>
                <p className="mt-0.5 text-sm text-gray-800">
                  {view.relatedGap
                    ? `${view.relatedMaturityDimension}：${view.relatedGap}`
                    : view.relatedMaturityDimension || humanizeTarget(view.targetImprovement)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </P0Card>
    </section>
  );
}

/* ─── Module 2: Task Progress Overview ─── */

const METRIC_ITEMS: Array<{
  key: keyof TaskBoardProgressMetrics;
  label: string;
  testId: string;
}> = [
  { key: "needGenerate", label: "需生成", testId: "task-progress-need-generate" },
  { key: "generated", label: "已生成", testId: "task-progress-generated" },
  { key: "qualityPending", label: "待质检", testId: "task-progress-quality-pending" },
  { key: "enqueueReady", label: "可入队", testId: "task-progress-enqueue-ready" },
  { key: "queued", label: "已入队", testId: "task-progress-queued" },
  { key: "published", label: "发布完成", testId: "task-progress-published" },
];

type TaskProgressOverviewProps = {
  metrics: TaskBoardProgressMetrics;
};

export function TaskProgressOverview({ metrics }: TaskProgressOverviewProps) {
  return (
    <section className="space-y-3" data-testid="task-progress-overview">
      <h2 className={geoP0Surfaces.sectionTitle}>任务进度总览</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {METRIC_ITEMS.map(item => (
          <div
            key={item.key}
            className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm"
            data-testid={item.testId}
          >
            <p className="text-2xl font-bold tabular-nums text-gray-900">{metrics[item.key]}</p>
            <p className="mt-1 text-xs font-medium text-gray-500">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export { computeTaskBoardProgress };

/* ─── Module 3: Platform Task Board ─── */

type PlatformTaskBoardProps = {
  rows: PlatformBoardRow[];
  recommendedPlatforms: RecommendedPlatformView[];
  boardBusy?: boolean;
  generatingPlatformKey?: WeeklyPlatformKey | null;
  anyGenerating?: boolean;
  onGenerate: (key: WeeklyPlatformKey) => void;
  onSaveAndQc: (key: WeeklyPlatformKey) => void;
  onEnqueue: (key: WeeklyPlatformKey) => void;
  onView: (key: WeeklyPlatformKey) => void;
  onViewPublish?: (key: WeeklyPlatformKey) => void;
  onGoMonitoring?: () => void;
};

export function PlatformTaskBoard({
  rows,
  recommendedPlatforms,
  boardBusy = false,
  generatingPlatformKey = null,
  anyGenerating = false,
  onGenerate,
  onSaveAndQc,
  onEnqueue,
  onView,
  onViewPublish,
  onGoMonitoring,
}: PlatformTaskBoardProps) {
  const recommendedOrder = new Map(recommendedPlatforms.map((p, i) => [p.platformKey, i]));
  const reasonMap = new Map(recommendedPlatforms.map(p => [p.platformKey, p.reason]));

  const sortedRows = [...rows].sort((a, b) => {
    const aOrder = recommendedOrder.get(a.def.key) ?? 999;
    const bOrder = recommendedOrder.get(b.def.key) ?? 999;
    return aOrder - bOrder;
  });

  const handleAction = (row: PlatformBoardRow, kind: PlatformTaskActionKind) => {
    switch (kind) {
      case "generate":
      case "regenerate":
        onGenerate(row.def.key);
        break;
      case "view_qc":
        onSaveAndQc(row.def.key);
        break;
      case "enqueue":
        onEnqueue(row.def.key);
        break;
      case "view_publish":
        if (onViewPublish) onViewPublish(row.def.key);
        else onView(row.def.key);
        break;
      case "view_article":
        onView(row.def.key);
        break;
      case "go_monitoring":
        if (onGoMonitoring) onGoMonitoring();
        else onView(row.def.key);
        break;
    }
  };

  return (
    <section className="space-y-4" data-testid="task-platform-publish-plan">
      <div className="space-y-1">
        <h2 className={geoP0Surfaces.sectionTitle}>平台内容任务</h2>
        <p className={geoP0Surfaces.muted}>按推荐优先级推进各平台内容生成、质检与发布。</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="task-platform-plan-grid">
        {sortedRows.map(row => {
          const { def, status, hasContent } = row;
          const reason = reasonMap.get(def.key);
          const statusLabel = weeklyContentTaskStatusLabel(status);
          const action = resolvePlatformTaskAction(status, hasContent);
          const disabled = shouldDisablePlatformGenerateButton({
            status,
            boardBusy,
            generatingPlatformKey,
            platformKey: def.key,
            anyGenerating,
          });
          const serialHint = showSerialGenerationHint({
            anyGenerating,
            generatingPlatformKey,
            platformKey: def.key,
            actionKind: action.kind,
          });

          return (
            <P0Card key={def.key} testId={`task-platform-card-${def.key}`} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-gray-900">{def.label}</h3>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    WEEKLY_CONTENT_TASK_STATUS_BADGE_CLASS[status],
                  )}
                  data-testid={`weekly-platform-status-${def.key}`}
                >
                  {statusLabel}
                </span>
              </div>

              {reason ? (
                <p
                  className="mt-2 line-clamp-2 text-xs text-blue-700"
                  data-testid={`task-platform-reason-${def.key}`}
                >
                  {reason}
                </p>
              ) : null}

              {serialHint ? (
                <p className="mt-2 text-xs text-amber-700" data-testid={`task-platform-serial-hint-${def.key}`}>
                  {WEEKLY_SERIAL_GENERATION_HINT}
                </p>
              ) : null}

              <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-3">
                <Button
                  type="button"
                  size="sm"
                  className={geoP0Brand.primary}
                  disabled={disabled && (action.kind === "generate" || action.kind === "regenerate")}
                  data-testid={`task-platform-action-${def.key}`}
                  onClick={() => handleAction(row, action.kind)}
                >
                  {action.label}
                </Button>
              </div>
            </P0Card>
          );
        })}
      </div>
    </section>
  );
}

/** @deprecated Use PlatformTaskBoard */
export const PlatformPublishPlan = PlatformTaskBoard;

/** @deprecated Use CurrentContentTaskCard */
export const TaskContextHero = CurrentContentTaskCard;

/* ─── Module 4: Next Step Suggestion ─── */

type NextStepSuggestionProps = {
  suggestion: string;
  onAction?: () => void;
  actionLabel?: string;
};

export function NextStepSuggestion({ suggestion, onAction, actionLabel }: NextStepSuggestionProps) {
  return (
    <section data-testid="task-next-step-suggestion">
      <P0Card testId="task-next-step-card" className="border-emerald-100 bg-emerald-50/50">
        <p className="text-xs font-semibold text-emerald-700">下一步建议</p>
        <p className="mt-2 text-sm leading-relaxed text-gray-800" data-testid="task-next-what">
          {suggestion}
        </p>
        {onAction && actionLabel ? (
          <Button
            type="button"
            size="sm"
            className={cn("mt-3", geoP0Brand.primary)}
            data-testid="task-next-action-btn"
            onClick={onAction}
          >
            {actionLabel}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : null}
      </P0Card>
    </section>
  );
}

/** @deprecated Use NextStepSuggestion */
export const NextStepSideCard = NextStepSuggestion;

/* ─── No questionId: Monthly content task list ─── */

export type MonthlyContentTaskItem = {
  id: number;
  title: string;
  reason: string;
  status: string;
  questionId?: number | null;
  actionUrl: string;
};

type MonthlyContentTaskListProps = {
  tasks: MonthlyContentTaskItem[];
  onSelectTask: (task: MonthlyContentTaskItem) => void;
  onGoMonthlyPlan?: () => void;
};

function monthlyTaskStatusLabel(status: string): string {
  if (status === "completed") return "已完成";
  if (status === "in_progress") return "进行中";
  return "待处理";
}

export function MonthlyContentTaskList({
  tasks,
  onSelectTask,
  onGoMonthlyPlan,
}: MonthlyContentTaskListProps) {
  const contentTasks = tasks.filter(t => t.questionId != null);

  if (contentTasks.length === 0) {
    return (
      <P0Card testId="task-progression-fallback">
        <p className={geoP0Surfaces.sectionTitle}>本月内容任务</p>
        <p
          className="mt-3 text-sm leading-relaxed text-gray-700"
          data-testid="task-progression-fallback-message"
        >
          {WEEKLY_CONTENT_TASK_VIEW_FALLBACK_MESSAGE}
        </p>
        {onGoMonthlyPlan ? (
          <Button
            type="button"
            size="sm"
            className={`mt-4 ${geoP0Brand.primary}`}
            data-testid="task-progression-go-monthly-plan"
            onClick={onGoMonthlyPlan}
          >
            去本月优化计划
          </Button>
        ) : null}
      </P0Card>
    );
  }

  return (
    <section className="space-y-4" data-testid="weekly-monthly-content-task-list">
      <div className="space-y-1">
        <h2 className={geoP0Surfaces.sectionTitle}>本月内容任务</h2>
        <p className={geoP0Surfaces.muted}>选择一个任务进入内容推进，围绕 AI 搜索问题生成与发布内容。</p>
      </div>
      <ul className="space-y-3">
        {contentTasks.map(task => (
          <li key={task.id}>
            <P0Card testId={`weekly-content-task-item-${task.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {monthlyTaskStatusLabel(task.status)}
                  </span>
                  <p className="mt-2 font-medium text-gray-900">{task.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{task.reason}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className={geoP0Brand.primary}
                  data-testid={`weekly-select-content-task-${task.id}`}
                  onClick={() => onSelectTask(task)}
                >
                  进入推进
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </P0Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─── Fallback ─── */

type FallbackProps = {
  onGoMonthlyPlan?: () => void;
};

export function TaskProgressionFallback({ onGoMonthlyPlan }: FallbackProps) {
  return (
    <P0Card testId="task-progression-fallback">
      <p className={geoP0Surfaces.sectionTitle}>内容任务推进</p>
      <p
        className="mt-3 text-sm leading-relaxed text-gray-700"
        data-testid="task-progression-fallback-message"
      >
        {WEEKLY_CONTENT_TASK_VIEW_FALLBACK_MESSAGE}
      </p>
      {onGoMonthlyPlan ? (
        <Button
          type="button"
          size="sm"
          className={`mt-4 ${geoP0Brand.primary}`}
          data-testid="task-progression-go-monthly-plan"
          onClick={onGoMonthlyPlan}
        >
          去本月优化计划
        </Button>
      ) : null}
    </P0Card>
  );
}

/* ─── Mother article (collapsed reference) ─── */

type MotherArticleSummaryProps = {
  title: string | null;
  summary: string | null;
  corePoints?: string | null;
  status: string | null;
  onViewFull: () => void;
  onEdit: () => void;
  onApprove: () => void;
  approveDisabled?: boolean;
};

export function MotherArticleSummaryCard({
  title,
  summary,
  corePoints,
  status,
  onViewFull,
  onEdit,
  onApprove,
  approveDisabled,
}: MotherArticleSummaryProps) {
  if (!title) return null;

  return (
    <div className="space-y-3" data-testid="task-mother-article-summary">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-gray-900" data-testid="mother-article-title">
            {title}
          </h3>
          {status ? (
            <span
              className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-700"
              data-testid="mother-article-status"
            >
              {status}
            </span>
          ) : null}
        </div>

        {summary ? (
          <div>
            <p className="text-xs font-medium text-gray-500">摘要</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-700" data-testid="mother-article-summary">
              {summary}
            </p>
          </div>
        ) : null}

        {corePoints ? (
          <div>
            <p className="text-xs font-medium text-gray-500">核心观点</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-700" data-testid="mother-article-core-points">
              {corePoints}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            data-testid="mother-article-view-full"
            onClick={onViewFull}
          >
            查看全文
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            data-testid="mother-article-edit"
            onClick={onEdit}
          >
            编辑内容
          </Button>
          <Button
            type="button"
            size="sm"
            className={geoP0Brand.primary}
            data-testid="mother-article-approve"
            disabled={approveDisabled}
            onClick={onApprove}
          >
            审核通过
          </Button>
        </div>
      </div>
    </div>
  );
}

export { resolveWeeklyContentSourceTypeLabel, MONTHLY_PLAN_UNBOUND_HINT };
