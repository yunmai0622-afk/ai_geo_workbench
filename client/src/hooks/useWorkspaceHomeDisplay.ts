import { monitoringEvidenceRows } from "@/lib/assetProgressDisplay";
import {
  formatBrandMentionRate,
  formatLastAiTestLabel,
  formatRecommendRate,
  formatT0BrandMentionRate,
  formatT0RecommendRate,
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

  const monitoringQuery = trpc.geo.articles.inclusionMonitoringRecords.useQuery(
    { projectId: projectId! },
    { enabled },
  );
  const testRoundsQuery = trpc.geo.testRounds.list.useQuery({ projectId: projectId! }, { enabled });
  const t0MetricsQuery = trpc.geo.scores.t0Metrics.useQuery({ projectId: projectId! }, { enabled });
  const analysisQuery = trpc.geo.analysis.list.useQuery({ projectId: projectId! }, { enabled });
  const publishRecordsQuery = trpc.geo.articles.publishRecords.useQuery({ projectId: projectId! }, { enabled });

  const monitoring = monitoringQuery.data ?? [];
  const publishRecords = publishRecordsQuery.data ?? [];
  const testRounds = testRoundsQuery.data ?? [];
  const analyses = analysisQuery.data ?? [];

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

  const brandMentionRateText = t0MetricsQuery.data
    ? formatT0BrandMentionRate(t0MetricsQuery.data)
    : formatBrandMentionRate(aiTestAggregate);
  const recommendRateText = t0MetricsQuery.data
    ? formatT0RecommendRate(t0MetricsQuery.data)
    : formatRecommendRate(aiTestAggregate);
  const lastAiTestLabel = formatLastAiTestLabel({
    analyses,
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

  const loading =
    enabled &&
    (monitoringQuery.isLoading ||
      testRoundsQuery.isLoading ||
      t0MetricsQuery.isLoading ||
      analysisQuery.isLoading);

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
