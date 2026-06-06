import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import type { GeoContentTaskSource } from "@shared/geoContentTaskSource";
import {
  buildWeeklyContentTaskNextStep,
  formatWeeklyContentTaskProgress,
  type WeeklyContentTaskProgress,
} from "@shared/weeklyContentTaskStatus";
import { ArrowRight } from "lucide-react";

type Props = {
  source: GeoContentTaskSource;
  progress: WeeklyContentTaskProgress;
  recommendedPlatforms?: string[];
  taskOptions?: Array<{ id: number; label: string }>;
  selectedTaskId?: number | null;
  onSelectTaskId?: (id: number) => void;
  pendingReviewCount: number;
  batchBusy?: boolean;
  onGenerateNext?: () => void;
  onGoReview?: () => void;
  onGoPublishingQueue?: () => void;
};

export function WeeklyContentTaskControlCard({
  source,
  progress,
  recommendedPlatforms = [],
  taskOptions,
  selectedTaskId,
  onSelectTaskId,
  pendingReviewCount,
  batchBusy,
  onGenerateNext,
  onGoReview,
  onGoPublishingQueue,
}: Props) {
  const showTaskPicker = (taskOptions?.length ?? 0) > 1 && onSelectTaskId;
  const nextStep = buildWeeklyContentTaskNextStep({
    pendingReviewCount: progress.pendingReviewCount,
    publishReadyCount: progress.publishReadyCount,
    generatedCount: progress.generatedCount,
  });
  const primaryIsReview = pendingReviewCount > 0 && onGoReview;

  return (
    <P0Card testId="weekly-content-task-control">
      <p className={geoP0Surfaces.sectionTitle}>本轮内容任务总览</p>
      {showTaskPicker ? (
        <div className="mt-3">
          <label className="text-xs font-medium text-gray-500" htmlFor="weekly-content-task-select">
            切换内容任务
          </label>
          <select
            id="weekly-content-task-select"
            className="mt-1 block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
            value={selectedTaskId ?? source.contentTaskId ?? ""}
            onChange={e => onSelectTaskId(Number(e.target.value))}
            data-testid="weekly-content-task-select"
          >
            {taskOptions!.map(opt => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <dl className="mt-3 grid gap-3 text-sm text-gray-800 sm:grid-cols-2">
        <div>
          <dt className="font-medium text-gray-500">本轮任务名称</dt>
          <dd className="mt-1 font-medium text-gray-900" data-testid="weekly-task-display-name">
            {source.taskDisplayName}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">来源</dt>
          <dd className="mt-1" data-testid="weekly-task-source-label">
            {source.sourceLabel}
          </dd>
        </div>
        {source.linkedQuestion ? (
          <div>
            <dt className="font-medium text-gray-500">目标问题</dt>
            <dd className="mt-1" data-testid="weekly-task-target-question">
              {source.linkedQuestion}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="font-medium text-gray-500">对应 GEO 缺口</dt>
          <dd className="mt-1" data-testid="weekly-task-geo-gap">
            {source.geoGapSummary}
          </dd>
        </div>
        {recommendedPlatforms.length > 0 ? (
          <div className="sm:col-span-2">
            <dt className="font-medium text-gray-500">推荐平台</dt>
            <dd className="mt-1" data-testid="weekly-task-recommended-platforms">
              {recommendedPlatforms.join("、")}
            </dd>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="font-medium text-gray-500">进度统计</dt>
          <dd className="mt-1 font-medium text-gray-900" data-testid="weekly-task-progress">
            {formatWeeklyContentTaskProgress(progress)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-gray-500">下一步建议</dt>
          <dd className="mt-1 text-gray-700" data-testid="weekly-task-next-step">
            {nextStep}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        {primaryIsReview ? (
          <Button
            type="button"
            size="sm"
            className={geoP0Brand.primary}
            data-testid="weekly-go-review-content"
            onClick={onGoReview}
          >
            去审核内容（{pendingReviewCount}）
          </Button>
        ) : onGenerateNext ? (
          <Button
            type="button"
            size="sm"
            className={geoP0Brand.primary}
            disabled={batchBusy}
            data-testid="weekly-generate-next-content"
            onClick={onGenerateNext}
          >
            生成下一批内容
          </Button>
        ) : null}
        {!primaryIsReview && pendingReviewCount > 0 && onGoReview ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            data-testid="weekly-go-review-content-secondary"
            onClick={onGoReview}
          >
            去审核内容（{pendingReviewCount}）
          </Button>
        ) : null}
        {onGoPublishingQueue ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            data-testid="weekly-go-publishing-queue"
            onClick={onGoPublishingQueue}
          >
            去发布队列
            <ArrowRight className="ml-1.5 size-4" aria-hidden />
          </Button>
        ) : null}
      </div>
    </P0Card>
  );
}
