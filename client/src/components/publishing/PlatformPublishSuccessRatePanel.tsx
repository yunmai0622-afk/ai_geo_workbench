import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { formatPlatformPublishSuccessRateLine } from "@shared/deliveryReportPublishStats";

type Props = {
  projectId: number;
  className?: string;
};

export function PlatformPublishSuccessRatePanel({ projectId, className }: Props) {
  const statsQuery = trpc.publishTasks.projectStats.useQuery({ projectId });

  return (
    <P0Card testId="platform-publish-success-rates" className={className}>
      <div>
        <h2 className="text-base font-semibold text-gray-900">各平台发布成功率</h2>
        <p className="mt-1 text-sm text-gray-600">
          基于本项目的发布任务（publish_tasks）统计成功与失败次数；仅计入已完成或已失败的任务。
        </p>
      </div>

      {statsQuery.isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <Spinner className="size-4 text-blue-600" />
          正在统计各平台发布成功率…
        </div>
      ) : statsQuery.isError ? (
        <p className="mt-4 text-sm text-red-600">发布成功率加载失败，请刷新后重试。</p>
      ) : (
        <ul className="mt-4 space-y-2" data-testid="platform-publish-success-rate-list">
          {(statsQuery.data?.platformSuccessRates ?? []).map(row => (
            <li
              key={row.platform}
              className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm text-gray-800"
              data-testid={`platform-publish-success-rate-${row.platform}`}
            >
              {formatPlatformPublishSuccessRateLine(row)}
            </li>
          ))}
        </ul>
      )}
    </P0Card>
  );
}
