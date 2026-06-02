import { monitoringEvidenceRows } from "@/lib/assetProgressDisplay";
import {
  formatBrandMentionRate,
  formatLastAiTestLabel,
  formatRecommendRate,
  hasCompletedT1Retest,
  pickAiTestAggregate,
  resolveMainChainNextAction,
  type MainChainNextAction,
} from "@/lib/workspaceHomeDisplay";
import { trpc } from "@/lib/trpc";
import type { WorkspaceSummaryMetrics } from "@shared/workspaceStateMachine";
import { buildWorkspaceInclusionPlatformRows } from "@shared/workspaceInclusionMonitoring";
import { useMemo } from "react";
import { aggregateAiTestEvidence } from "@shared/aiTestEvidence";

export function useWorkspaceHomeDisplay(projectId: number | undefined, summary: WorkspaceSummaryMetrics | undefined) {
  const enabled = Boolean(projectId);
  const queryInput = useMemo(() => (projectId ? { projectId } : undefined), [projectId]);

  const monitoringQuery = trpc.geo.articles.inclusionMonitoringRecords.useQuery(
    queryInput!,
    { enabled },
  );
  const testRoundsQuery = trpc.geo.testRounds.list.useQuery(queryInput!, { enabled });
  const publishRecordsQuery = trpc.geo.articles.publishRecords.useQuery(queryInput!, { enabled });

  const monitoring = monitoringQuery.data ?? [];
  const publishRecords = publishRecordsQuery.data ?? [];
  const testRounds = testRoundsQuery.data ?? [];

  const monitoringAggregate = useMemo(() => {
    const rows = monitoringEvidenceRows(monitoring);
    return aggregateAiTestEvidence(rows);
  }, [monitoring]);

  const aiTestAggregate = useMemo(() => {
    if (!summary) return monitoringAggregate;
    return pickAiTestAggregate(
      summary.brandMentionRate,
      summary.recommendRate,
      summary.aiTestResultCount,
      monitoringAggregate,
    );
  }, [summary, monitoringAggregate]);

  const mainChainNextAction: MainChainNextAction | null = useMemo(() => {
    if (!summary || !projectId) return null;
    return resolveMainChainNextAction(projectId, summary, testRounds);
  }, [projectId, summary, testRounds]);

  const brandMentionRateText =
    summary && summary.aiTestResultCount > 0 && summary.brandMentionRate != null
      ? `${Math.round(summary.brandMentionRate * 100)}%`
      : formatBrandMentionRate(aiTestAggregate);
  const recommendRateText =
    summary && summary.aiTestResultCount > 0 && summary.recommendRate != null
      ? `${Math.round(summary.recommendRate * 100)}%`
      : formatRecommendRate(aiTestAggregate);
  const lastAiTestLabel = formatLastAiTestLabel({
    analyses: [],
    monitoring,
    testRounds,
  });
  const hasT1Retest = summary?.hasCompletedT1Retest ?? hasCompletedT1Retest(testRounds);

  const inclusionPlatformRows = useMemo(
    () =>
      buildWorkspaceInclusionPlatformRows(
        monitoring.map(row => ({
          id: row.id,
          publishRecordId: row.publishRecordId,
          inclusionStatus: row.inclusionStatus,
          lastCheckedAt: row.lastCheckedAt,
        })),
        publishRecords.map(row => ({
          id: row.id,
          publishChannel: row.publishChannel,
        })),
      ),
    [monitoring, publishRecords],
  );

  const inclusionMonitoringLoading =
    enabled && (monitoringQuery.isLoading || publishRecordsQuery.isLoading);

  const loading = enabled && (monitoringQuery.isLoading || testRoundsQuery.isLoading);

  return {
    mainChainNextAction,
    brandMentionRateText,
    recommendRateText,
    lastAiTestLabel,
    hasT1Retest,
    loading,
    inclusionPlatformRows,
    inclusionMonitoringLoading,
    monitoringRecordCount: monitoring.length,
    publishRecordCount: publishRecords.length,
  };
}
