import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { formatMentionDelta } from "@/lib/inclusionMonitoringDisplay";
import { trpc } from "@/lib/trpc";
import { recordPublicLink } from "@/lib/assetProgressDisplay";
import { aggregateAiTestEvidence } from "@shared/aiTestEvidence";
import { useMemo } from "react";

export function InclusionMonitoringAssistantPanel() {
  const { selectedProjectId, projectInput, enabled } = useActiveProjectSelection();

  const summaryQuery = trpc.geo.workspace.summary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const monitoringQuery = trpc.geo.articles.inclusionMonitoringRecords.useQuery(projectInput, { enabled });
  const publishRecordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });

  const pendingRetestCount = useMemo(() => {
    const records = monitoringQuery.data ?? [];
    return records.filter(record => !record?.lastAiTestedAt).length;
  }, [monitoringQuery.data]);

  const missingLinkCount = useMemo(() => {
    const publishRecords = publishRecordsQuery.data ?? [];
    return publishRecords.filter(record => !recordPublicLink(record)).length;
  }, [publishRecordsQuery.data]);

  const mentionDeltaLabel = useMemo(() => {
    const records = monitoringQuery.data ?? [];
    const aiAggregate = aggregateAiTestEvidence(
      records.map(record => ({
        monitoringRecordId: record.id,
        results: Array.isArray(record.aiTestResults) ? record.aiTestResults : [],
      })),
    );
    const baseline = summaryQuery.data?.brandMentionRate ?? null;
    const mentionDelta =
      baseline != null && aiAggregate.questionCount > 0
        ? aiAggregate.mentionRate - baseline
        : null;
    return formatMentionDelta(mentionDelta);
  }, [monitoringQuery.data, summaryQuery.data?.brandMentionRate]);

  const nextRetestLabel =
    summaryQuery.data?.retestPlan?.nextSuggestion?.suggestedAtLabel ?? "暂无计划";

  return (
    <aside className="w-full space-y-4" data-testid="inclusion-monitoring-assistant-panel">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">收录复测摘要</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div data-testid="inclusion-sidebar-pending-retest">
            <dt className="text-xs font-semibold text-gray-500">待复测内容数</dt>
            <dd className="mt-0.5 font-semibold text-gray-900">{pendingRetestCount}</dd>
          </div>
          <div data-testid="inclusion-sidebar-missing-links">
            <dt className="text-xs font-semibold text-gray-500">未回填链接数</dt>
            <dd className="mt-0.5 font-semibold text-gray-900">{missingLinkCount}</dd>
          </div>
          <div data-testid="inclusion-sidebar-mention-delta">
            <dt className="text-xs font-semibold text-gray-500">AI提及变化</dt>
            <dd className="mt-0.5 font-semibold text-gray-900">{mentionDeltaLabel}</dd>
          </div>
          <div data-testid="inclusion-sidebar-next-retest">
            <dt className="text-xs font-semibold text-gray-500">下一次复测时间</dt>
            <dd className="mt-0.5 font-semibold text-gray-900">{nextRetestLabel}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
