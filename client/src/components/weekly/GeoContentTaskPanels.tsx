import { P0Card } from "@/components/geo/P0UiPrimitives";
import { geoP0Surfaces } from "@/lib/geoP0Visual";
import type { GeoContentTaskSource } from "@shared/geoContentTaskSource";

type Props = {
  source: GeoContentTaskSource;
  taskOptions?: Array<{ id: number; label: string }>;
  selectedTaskId?: number | null;
  onSelectTaskId?: (id: number) => void;
};

export function GeoContentTaskPanels({ source, taskOptions, selectedTaskId, onSelectTaskId }: Props) {
  const showTaskPicker = (taskOptions?.length ?? 0) > 1 && onSelectTaskId;

  return (
    <>
      <P0Card testId="weekly-geo-content-task">
        <p className={geoP0Surfaces.sectionTitle}>本轮 GEO 内容任务</p>
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
        <dl className="mt-3 space-y-3 text-sm text-gray-800">
          <div>
            <dt className="font-medium text-gray-500">任务名称</dt>
            <dd className="mt-1" data-testid="weekly-geo-task-name">
              {source.taskDisplayName}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">任务目标</dt>
            <dd className="mt-1" data-testid="weekly-geo-task-goal">
              {source.taskGoal}
            </dd>
          </div>
          {source.linkedQuestion ? (
            <div>
              <dt className="font-medium text-gray-500">关联问题</dt>
              <dd className="mt-1" data-testid="weekly-geo-linked-question">
                {source.linkedQuestion}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="font-medium text-gray-500">来源</dt>
            <dd className="mt-1" data-testid="weekly-geo-task-source-label">
              {source.sourceLabel}
            </dd>
          </div>
        </dl>
      </P0Card>

      <P0Card testId="weekly-ai-diagnosis-basis">
        <p className={geoP0Surfaces.sectionTitle}>AI 诊断依据</p>
        <dl className="mt-3 space-y-3 text-sm text-gray-800">
          <div>
            <dt className="font-medium text-gray-500">诊断发现</dt>
            <dd className="mt-1 leading-relaxed" data-testid="weekly-diagnosis-finding">
              {source.diagnosisFinding}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">内容缺口</dt>
            <dd className="mt-1" data-testid="weekly-content-gaps">
              {source.contentGaps.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-gray-700">
                  {source.contentGaps.map(gap => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600">诊断任务已就绪，缺口条目将随实测结果展示。</p>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">推荐补齐</dt>
            <dd className="mt-1" data-testid="weekly-recommend-fill">
              {source.recommendFill}
            </dd>
          </div>
        </dl>
      </P0Card>
    </>
  );
}
