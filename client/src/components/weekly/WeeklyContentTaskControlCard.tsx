import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import type { GeoContentTaskSource } from "@shared/geoContentTaskSource";
import {
  formatWeeklyContentTaskProgress,
  type WeeklyContentTaskProgress,
} from "@shared/weeklyContentTaskStatus";
import { ArrowRight } from "lucide-react";

type Props = {
  source: GeoContentTaskSource;
  progress: WeeklyContentTaskProgress;
  taskOptions?: Array<{ id: number; label: string }>;
  selectedTaskId?: number | null;
  onSelectTaskId?: (id: number) => void;
  publishableCount: number;
  batchBusy?: boolean;
  onGenerateNext?: () => void;
  onViewPublishable?: () => void;
  onGoPublishingQueue?: () => void;
};

export function WeeklyContentTaskControlCard({
  source,
  progress,
  taskOptions,
  selectedTaskId,
  onSelectTaskId,
  publishableCount,
  batchBusy,
  onGenerateNext,
  onViewPublishable,
  onGoPublishingQueue,
}: Props) {
  const showTaskPicker = (taskOptions?.length ?? 0) > 1 && onSelectTaskId;

  return (
    <P0Card testId="weekly-content-task-control">
      <p className={geoP0Surfaces.sectionTitle}>本轮内容任务</p>
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
          <dt className="font-medium text-gray-500">任务来源</dt>
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
          <dt className="font-medium text-gray-500">GEO 缺口</dt>
          <dd className="mt-1" data-testid="weekly-task-geo-gap">
            {source.geoGapSummary}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">本轮目标</dt>
          <dd className="mt-1" data-testid="weekly-task-round-goal">
            {source.taskGoal}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-gray-500">当前进度</dt>
          <dd className="mt-1 font-medium text-gray-900" data-testid="weekly-task-progress">
            {formatWeeklyContentTaskProgress(progress)}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        {onGenerateNext ? (
          <Button
            type="button"
            size="sm"
            className={geoP0Brand.primary}
            disabled={batchBusy}
            data-testid="weekly-generate-next-content"
            onClick={onGenerateNext}
          >
            生成下一篇内容
          </Button>
        ) : null}
        {publishableCount > 0 && onViewPublishable ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            data-testid="weekly-view-publishable-content"
            onClick={onViewPublishable}
          >
            查看可发布内容（{publishableCount}）
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
