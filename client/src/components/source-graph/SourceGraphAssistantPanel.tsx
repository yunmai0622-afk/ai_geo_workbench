import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { trpc } from "@/lib/trpc";
import {
  buildBrandSourceOverviewMetrics,
  computeConsistencyScore,
  pickSidebarMainGaps,
  type BrandSourceRecordRow,
} from "@shared/brandSourceGraph";
import { useMemo } from "react";

function formatVerifiedAt(value: Date | string | null | undefined): string {
  if (!value) return "尚未验证";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "尚未验证";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SourceGraphAssistantPanel() {
  const { selectedProjectId, enabled } = useActiveProjectSelection();

  const sourcesQuery = trpc.geo.brandSourceGraph.getBrandSources.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );

  const view = useMemo(() => {
    const records = (sourcesQuery.data ?? []) as BrandSourceRecordRow[];
    const overview = buildBrandSourceOverviewMetrics(records);
    const score = computeConsistencyScore(records);
    return {
      consistencyScore: overview.consistencyScore,
      incompleteCount: overview.incompleteCount,
      latestVerifiedAt: overview.latestVerifiedAt,
      mainGaps: pickSidebarMainGaps(score.mainIssues, 2),
    };
  }, [sourcesQuery.data]);

  return (
    <aside className="w-full space-y-4" data-testid="source-graph-assistant-panel">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">信源图谱助手</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-gray-500">实体一致性评分</dt>
            <dd className="mt-1 text-2xl font-bold text-blue-600" data-testid="sidebar-consistency-score">
              {view.consistencyScore}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">待完善信源数</dt>
            <dd className="mt-1 font-semibold text-gray-900" data-testid="sidebar-incomplete-count">
              {view.incompleteCount}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">最近验证时间</dt>
            <dd className="mt-1 text-gray-900" data-testid="sidebar-latest-verified">
              {formatVerifiedAt(view.latestVerifiedAt)}
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
