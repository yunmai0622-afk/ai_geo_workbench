import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { trpc } from "@/lib/trpc";
import {
  aggregateContentAssetEffectOverview,
} from "@shared/contentAssetEffectTracking";
import { useMemo } from "react";

function formatRate(rate: number | null) {
  if (rate == null) return "—";
  return `${rate}%`;
}

export function InclusionMonitoringAssistantPanel() {
  const { projectInput, enabled } = useActiveProjectSelection();

  const monitoringQuery = trpc.geo.articles.inclusionMonitoringRecords.useQuery(projectInput, { enabled });
  const publishRecordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });

  const overview = useMemo(() => {
    const records = monitoringQuery.data ?? [];
    const publishedCount = publishRecordsQuery.data?.length ?? 0;
    return aggregateContentAssetEffectOverview(publishedCount, records);
  }, [monitoringQuery.data, publishRecordsQuery.data]);

  const retestReadyLabel = String(overview.retestReadyCount);

  return (
    <aside className="w-full space-y-4" data-testid="inclusion-monitoring-assistant-panel">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">内容资产效果摘要</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div data-testid="inclusion-sidebar-included-count">
            <dt className="text-xs font-semibold text-gray-500">已收录内容数</dt>
            <dd className="mt-0.5 font-semibold text-gray-900">{overview.includedCount}</dd>
          </div>
          <div data-testid="inclusion-sidebar-inclusion-rate">
            <dt className="text-xs font-semibold text-gray-500">收录率</dt>
            <dd className="mt-0.5 font-semibold text-gray-900">{formatRate(overview.inclusionRate)}</dd>
          </div>
          <div data-testid="inclusion-sidebar-pending-count">
            <dt className="text-xs font-semibold text-gray-500">待收录内容数</dt>
            <dd className="mt-0.5 font-semibold text-gray-900">{overview.pendingCount}</dd>
          </div>
          <div data-testid="inclusion-sidebar-retest-ready">
            <dt className="text-xs font-semibold text-gray-500">可进入AI复测数</dt>
            <dd className="mt-0.5 font-semibold text-gray-900">{retestReadyLabel}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
