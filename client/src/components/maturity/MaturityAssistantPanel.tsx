import { Button } from "@/components/ui/button";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { trpc } from "@/lib/trpc";
import {
  resolveWeakestDimension,
  resolveWeakestDimensionAction,
} from "@shared/maturityDetailDisplay";
import { ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

export function MaturityAssistantPanel() {
  const { selectedProjectId, enabled } = useActiveProjectSelection();
  const [, setLocation] = useLocation();

  const reportQuery = trpc.geo.maturity.getMaturityReport.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const latestQuery = trpc.geo.maturity.getLatest.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );

  const report = reportQuery.data;
  const calculationDetail = (latestQuery.data?.calculationDetail as Record<string, unknown> | null) ?? null;
  const weakest = resolveWeakestDimension(report);
  const weakestAction = resolveWeakestDimensionAction(report, calculationDetail);

  return (
    <aside className="w-full space-y-4" data-testid="maturity-assistant-panel">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">短板行动指引</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-gray-500">当前总分</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-blue-600" data-testid="maturity-sidebar-total">
              {reportQuery.isLoading ? "—" : report ? `${report.totalScore} 分` : "暂无"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">最弱维度</dt>
            <dd className="mt-1 font-semibold text-gray-900" data-testid="maturity-sidebar-weakest">
              {weakest ? `${weakest.label}（${weakest.score} 分）` : "暂无评分"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">建议动作</dt>
            <dd className="mt-1 text-sm leading-relaxed text-gray-800" data-testid="maturity-sidebar-next-action">
              {weakestAction?.action ?? "完成建档后自动计算成熟度，获取优先改善建议。"}
            </dd>
          </div>
        </dl>
        {weakestAction && selectedProjectId ? (
          <Button
            type="button"
            size="sm"
            className={`mt-4 w-full ${geoP0Brand.primary}`}
            data-testid="maturity-sidebar-action-cta"
            onClick={() => setLocation(buildProjectUrl(weakestAction.path, selectedProjectId))}
          >
            {weakestAction.ctaLabel}
            <ArrowRight className="ml-1.5 size-3.5" />
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
