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
import { useMemo } from "react";
import { aggregateAiTestEvidence } from "@shared/aiTestEvidence";

export function useWorkspaceHomeDisplay(projectId: number | undefined, summary: WorkspaceSummaryMetrics | undefined) {
  const enabled = Boolean(projectId);

  const monitoringQuery = trpc.geo.articles.inclusionMonitoringRecords.useQuery(
    { projectId: projectId! },
    { enabled },
  );
  const testRoundsQuery = trpc.geo.testRounds.list.useQuery({ projectId: projectId! }, { enabled });
  const analysisQuery = trpc.geo.analysis.list.useQuery({ projectId: projectId! }, { enabled });

  const monitoring = monitoringQuery.data ?? [];
  const testRounds = testRoundsQuery.data ?? [];
  const analyses = analysisQuery.data ?? [];

  const monitoringAggregate = useMemo(() => {
    const rows = monitoringEvidenceRows(monitoring);
    return aggregateAiTestEvidence(rows);
  }, [monitoring]);

  const aiTestAggregate = useMemo(() => {
    if (!summary) return monitoringAggregate;
    return pickAiTestAggregate(summary.brandMentionRate, summary.aiTestResultCount, monitoringAggregate);
  }, [summary, monitoringAggregate]);

  const mainChainNextAction: MainChainNextAction | null = useMemo(() => {
    if (!summary || !projectId) return null;
    return resolveMainChainNextAction(projectId, summary, testRounds);
  }, [projectId, summary, testRounds]);

  const brandMentionRateText = formatBrandMentionRate(aiTestAggregate);
  const recommendRateText = formatRecommendRate(aiTestAggregate);
  const lastAiTestLabel = formatLastAiTestLabel({
    analyses,
    monitoring,
    testRounds,
  });
  const hasT1Retest = hasCompletedT1Retest(testRounds);

  const loading =
    enabled &&
    (monitoringQuery.isLoading || testRoundsQuery.isLoading || analysisQuery.isLoading);

  return {
    mainChainNextAction,
    brandMentionRateText,
    recommendRateText,
    lastAiTestLabel,
    hasT1Retest,
    loading,
  };
}
