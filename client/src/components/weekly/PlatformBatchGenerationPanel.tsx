import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import {
  countPlatformBatchCompleted,
  formatPlatformBatchProgress,
  platformBatchStatusLabel,
  type PlatformBatchQueueItem,
} from "@shared/platformBatchGeneration";

type Props = {
  queue: PlatformBatchQueueItem[] | null;
  running: boolean;
  onStartBatch: () => void;
  onRetry: (platformKey: string) => void;
};

function statusTone(status: PlatformBatchQueueItem["status"]): string {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700";
    case "running":
      return "bg-blue-50 text-blue-700";
    case "failed":
      return "bg-red-50 text-red-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export function PlatformBatchGenerationPanel({ queue, running, onStartBatch, onRetry }: Props) {
  const total = queue?.length ?? 0;
  const completed = queue ? countPlatformBatchCompleted(queue) : 0;
  const showQueue = Boolean(queue && queue.length > 0);

  return (
    <section
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      data-testid="platform-batch-generation-panel"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className={geoP0Surfaces.sectionTitle}>全平台内容生成</h2>
          <p className={geoP0Surfaces.muted}>
            按平台顺序依次生成内容；单个平台失败不影响其余平台继续。
          </p>
          {showQueue ? (
            <p className="text-sm font-medium text-gray-800" data-testid="platform-batch-progress">
              {formatPlatformBatchProgress(completed, total)}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          className={geoP0Brand.primary}
          disabled={running}
          data-testid="platform-batch-generate-all"
          onClick={onStartBatch}
        >
          {running ? "正在生成全部平台…" : "一键生成所有平台内容"}
        </Button>
      </div>

      {showQueue ? (
        <ul className="mt-4 space-y-2" data-testid="platform-batch-queue">
          {queue!.map(item => (
            <li
              key={item.platformKey}
              className="flex flex-col gap-2 rounded-lg border border-gray-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              data-testid={`platform-batch-item-${item.platformKey}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                {item.errorMessage ? (
                  <p className="mt-0.5 text-xs text-red-600">{item.errorMessage}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(item.status)}`}
                  data-testid={`platform-batch-status-${item.platformKey}`}
                >
                  {platformBatchStatusLabel(item.status)}
                </span>
                {item.status === "failed" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={geoP0Brand.primaryOutline}
                    disabled={running}
                    data-testid={`platform-batch-retry-${item.platformKey}`}
                    onClick={() => onRetry(item.platformKey)}
                  >
                    重试
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
