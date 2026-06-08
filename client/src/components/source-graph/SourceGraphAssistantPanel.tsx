import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { trpc } from "@/lib/trpc";
import { computePageTopMetrics, type BrandSourceRecordRow } from "@shared/brandSourceGraph";
import { useMemo } from "react";

export function SourceGraphAssistantPanel() {
  const { selectedProjectId, enabled } = useActiveProjectSelection();

  const metricsQuery = trpc.geo.brandSourceGraph.getPageMetrics.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const checksQuery = trpc.geo.brandSourceGraph.getEntityConsistencyChecks.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const sourcesQuery = trpc.geo.brandSourceGraph.getBrandSources.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );

  const view = useMemo(() => {
    const records = (sourcesQuery.data ?? []) as BrandSourceRecordRow[];
    const checks = checksQuery.data ?? [];
    const metrics =
      metricsQuery.data ??
      computePageTopMetrics(records, checks.map(item => ({ ...item, anchorLabel: item.anchorLabel ?? item.anchorType })));
    const mainGaps = checks
      .filter(item => item.status === "missing" || item.status === "conflict")
      .map(item => item.issueSummary)
      .slice(0, 2);
    return {
      consistencyScore: metrics.entityConsistency,
      incompleteCount: metrics.priorityFixCount,
      latestVerifiedAt: null,
      mainGaps,
    };
  }, [metricsQuery.data, checksQuery.data, sourcesQuery.data]);

  return (
    <aside className="w-full space-y-4" data-testid="source-graph-assistant-panel">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">信源图谱助手</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-gray-500">实体一致性</dt>
            <dd className="mt-1 text-2xl font-bold text-blue-600" data-testid="sidebar-consistency-score">
              {view.consistencyScore}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">优先修复项</dt>
            <dd className="mt-1 font-semibold text-gray-900" data-testid="sidebar-incomplete-count">
              {view.incompleteCount}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">最近验证时间</dt>
            <dd className="mt-1 text-gray-900" data-testid="sidebar-latest-verified">
              请在信源列表中标记
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">主要缺口</dt>
            <dd className="mt-1 space-y-1 text-gray-900" data-testid="sidebar-main-gaps">
              {view.mainGaps.length > 0 ? (
                view.mainGaps.map(gap => (
                  <p key={gap} className="text-sm leading-relaxed">
                    {gap}
                  </p>
                ))
              ) : (
                <p className="text-sm text-gray-500">暂无显著缺口</p>
              )}
            </dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
