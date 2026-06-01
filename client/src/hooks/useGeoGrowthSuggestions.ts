import { trpc } from "@/lib/trpc";
import {
  buildGeoGrowthSuggestions,
  countDistinctPublishPlatforms,
  countUnpublishedArticles,
  findLatestT0FinishedAt,
  type GeoGrowthSuggestion,
} from "@shared/geoGrowthSuggestions";
import { hasCompletedT0Baseline, hasCompletedT1Retest } from "@shared/workspaceMainChain";
import { useMemo } from "react";

export function useGeoGrowthSuggestions(projectId: number | undefined, enabled: boolean) {
  const projectInput = { projectId: projectId! };

  const summaryQuery = trpc.geo.workspace.summary.useQuery(projectInput, {
    enabled: enabled && Boolean(projectId),
  });
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, {
    enabled: enabled && Boolean(projectId),
  });
  const publishRecordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, {
    enabled: enabled && Boolean(projectId),
  });
  const testRoundsQuery = trpc.geo.testRounds.list.useQuery(projectInput, {
    enabled: enabled && Boolean(projectId),
  });

  const suggestions = useMemo((): GeoGrowthSuggestion[] => {
    const summary = summaryQuery.data;
    if (!summary) return [];

    const rounds = testRoundsQuery.data ?? [];
    return buildGeoGrowthSuggestions({
      mentionRate: summary.brandMentionRate,
      recommendRate: summary.recommendRate,
      distinctPublishPlatformCount: countDistinctPublishPlatforms(publishRecordsQuery.data ?? []),
      unpublishedArticleCount: countUnpublishedArticles(
        (articlesQuery.data ?? []) as Array<{ status?: string | null }>,
      ),
      hasCompletedT0Baseline:
        summary.hasCompletedT0Baseline || hasCompletedT0Baseline(rounds),
      hasCompletedT1Retest: summary.hasCompletedT1Retest || hasCompletedT1Retest(rounds),
      t0FinishedAt: findLatestT0FinishedAt(rounds),
    });
  }, [
    summaryQuery.data,
    articlesQuery.data,
    publishRecordsQuery.data,
    testRoundsQuery.data,
  ]);

  const loading =
    (summaryQuery.isLoading ||
      articlesQuery.isLoading ||
      publishRecordsQuery.isLoading ||
      testRoundsQuery.isLoading) &&
    Boolean(projectId);

  return { suggestions, loading };
}
