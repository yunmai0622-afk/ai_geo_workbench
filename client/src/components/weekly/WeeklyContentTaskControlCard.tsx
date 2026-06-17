import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import type { RecommendedPlatformView } from "@shared/contentOptimizationTaskView";
import { WEEKLY_CONTENT_TASK_VIEW_FALLBACK_MESSAGE } from "@shared/contentOptimizationTaskView";

const DEFAULT_LINKED_QUESTION = "暂未绑定明确问题";
const DEFAULT_MATURITY_GAP = "暂未绑定成熟度短板";
const DEFAULT_TARGET_IMPROVEMENT = "发布后可进入 AI 复测查看变化";

type TaskViewProps = {
  contentTitle: string;
  currentStatusLabel: string;
  sourceTypeLabel: string;
  aiSearchQuestion?: string | null;
  targetDimension?: string | null;
  maturityGap?: string | null;
  targetImprovementMetric?: string | null;
  monthlyPlanActionLabel?: string | null;
  monthlyPlanHint?: string | null;
  retestPlanSummary?: string | null;
  recommendedPlatformItems?: RecommendedPlatformView[];
  taskOptions?: Array<{ id: number; label: string }>;
  selectedTaskId?: number | null;
  onSelectTaskId?: (id: number) => void;
  pendingReviewCount: number;
  enqueueReadyCount: number;
  batchBusy?: boolean;
  onGenerateNext?: () => void;
  onGoReview?: () => void;
  onGoEnqueue?: () => void;
};

type FallbackProps = {
  onGoMonthlyPlan?: () => void;
};

type Props =
  | ({ mode: "task" } & TaskViewProps)
  | ({ mode: "fallback" } & FallbackProps);

export function WeeklyContentTaskControlCard(props: Props) {
  if (props.mode === "fallback") {
    return (
      <P0Card testId="weekly-content-task-control-fallback">
        <p className={geoP0Surfaces.sectionTitle}>当前内容任务</p>
        <p
          className="mt-3 text-sm leading-relaxed text-gray-700"
          data-testid="weekly-task-view-fallback-message"
        >
          {WEEKLY_CONTENT_TASK_VIEW_FALLBACK_MESSAGE}
        </p>
        {props.onGoMonthlyPlan ? (
          <Button
            type="button"
            size="sm"
            className={`mt-4 ${geoP0Brand.primary}`}
            data-testid="weekly-go-monthly-plan"
            onClick={props.onGoMonthlyPlan}
          >
            去本月优化计划
          </Button>
        ) : null}
      </P0Card>
    );
  }

  const {
    contentTitle,
    currentStatusLabel,
    sourceTypeLabel,
    aiSearchQuestion,
    targetDimension,
    maturityGap,
    targetImprovementMetric,
    monthlyPlanActionLabel,
    monthlyPlanHint,
    retestPlanSummary,
    recommendedPlatformItems = [],
    pendingReviewCount,
    enqueueReadyCount,
    batchBusy,
    onGenerateNext,
    onGoReview,
    onGoEnqueue,
  } = props;

  const act = pendingReviewCount > 0 ? "review" : enqueueReadyCount > 0 ? "enqueue" : "generate";

  return (
    <P0Card testId="weekly-content-task-control">
      <p className={geoP0Surfaces.sectionTitle}>当前内容任务</p>

      {monthlyPlanActionLabel?.trim() ? (
        <p
          className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800"
          data-testid="weekly-monthly-plan-task-label"
        >
          {monthlyPlanActionLabel}
        </p>
      ) : monthlyPlanHint?.trim() ? (
        <p
          className="mt-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          data-testid="weekly-monthly-plan-hint"
        >
          {monthlyPlanHint}
        </p>
      ) : null}

      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="font-medium text-gray-500">内容标题</dt>
          <dd data-testid="weekly-task-content-title">{contentTitle}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">当前状态</dt>
          <dd data-testid="weekly-task-current-status">{currentStatusLabel}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">任务来源</dt>
          <dd data-testid="weekly-task-source-type-label">{sourceTypeLabel}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-gray-500">对应 AI 搜索问题</dt>
          <dd data-testid="weekly-task-ai-search-question">
            {aiSearchQuestion?.trim() || DEFAULT_LINKED_QUESTION}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-gray-500">目标短板</dt>
          <dd data-testid="weekly-task-target-dimension">
            {targetDimension?.trim() || DEFAULT_MATURITY_GAP}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-gray-500">成熟度短板</dt>
          <dd data-testid="weekly-task-maturity-gap">{maturityGap?.trim() || DEFAULT_MATURITY_GAP}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-gray-500">目标改善指标</dt>
          <dd data-testid="weekly-task-target-improvement">
            {targetImprovementMetric?.trim() || DEFAULT_TARGET_IMPROVEMENT}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-gray-500">发布后复测计划</dt>
          <dd data-testid="weekly-task-retest-plan">
            {retestPlanSummary?.trim() || "发布后 7 天进行第一次复测"}
          </dd>
        </div>
        {recommendedPlatformItems.length ? (
          <div className="sm:col-span-2">
            <dt className="font-medium text-gray-500">推荐平台</dt>
            <dd className="space-y-1" data-testid="weekly-task-recommended-platforms">
              {recommendedPlatformItems.map(item => (
                <p key={item.platformKey}>
                  {item.platformLabel}：{item.reason}
                </p>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4 flex gap-2">
        {act === "review" && onGoReview ? (
          <Button
            size="sm"
            className={geoP0Brand.primary}
            data-testid="weekly-go-review-content"
            onClick={onGoReview}
          >
            去审核内容（{pendingReviewCount}）
          </Button>
        ) : null}
        {act === "enqueue" && onGoEnqueue ? (
          <Button
            size="sm"
            className={geoP0Brand.primary}
            data-testid="weekly-go-enqueue-content"
            onClick={onGoEnqueue}
          >
            加入发布队列（{enqueueReadyCount}）
          </Button>
        ) : null}
        {act === "generate" && onGenerateNext ? (
          <Button
            size="sm"
            className={geoP0Brand.primary}
            disabled={batchBusy}
            data-testid="weekly-generate-next-content"
            onClick={onGenerateNext}
          >
            生成平台稿
          </Button>
        ) : null}
      </div>
    </P0Card>
  );
}
