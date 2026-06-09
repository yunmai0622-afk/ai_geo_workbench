import { Button } from "@/components/ui/button";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { useMaturityAutoCalculate } from "@/hooks/useMaturityAutoCalculate";
import { buildProjectUrl } from "@/lib/activeProject";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { trpc } from "@/lib/trpc";
import {
  buildMaturityNextActionItems,
  resolveWeakestDimension,
} from "@shared/maturityDetailDisplay";
import { RefreshCw } from "lucide-react";
import { useLocation } from "wouter";

type Props = {
  onRecalculate?: () => void;
  recalculating?: boolean;
};

export function MaturityAssistantPanel({ onRecalculate, recalculating }: Props) {
  const { selectedProjectId, enabled } = useActiveProjectSelection();
  const [, setLocation] = useLocation();
  const { triggerMaturityCalculate, isCalculating } = useMaturityAutoCalculate(selectedProjectId);
  const calculating = recalculating ?? isCalculating;

  const reportQuery = trpc.geo.maturity.getMaturityReport.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );

  const report = reportQuery.data;
  const weakest = resolveWeakestDimension(report);
  const nextAction = report ? buildMaturityNextActionItems(report)[0] : null;

  return (
    <aside className="w-full space-y-4" data-testid="maturity-assistant-panel">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">成熟度助手</h3>
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
            <dt className="text-gray-500">下一步建议</dt>
            <dd className="mt-1 text-sm leading-relaxed text-gray-800" data-testid="maturity-sidebar-next-action">
              {nextAction?.description ?? "完成建档后自动计算成熟度，获取优先优化建议。"}
            </dd>
          </div>
        </dl>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4 w-full"
          disabled={!selectedProjectId || calculating}
          data-testid="maturity-sidebar-recalculate"
          onClick={() => {
            if (onRecalculate) {
              onRecalculate();
              return;
            }
            void triggerMaturityCalculate({ silent: false });
          }}
        >
          <RefreshCw className="mr-1.5 size-3.5" />
          {calculating ? "计算中…" : "重新计算"}
        </Button>
        {nextAction && selectedProjectId ? (
          <Button
            type="button"
            size="sm"
            className={`mt-2 w-full ${geoP0Brand.primary}`}
            data-testid="maturity-sidebar-action-cta"
            onClick={() => setLocation(buildProjectUrl(nextAction.path, selectedProjectId))}
          >
            {nextAction.ctaLabel}
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
