import { P0MetricTile } from "@/components/geo/P0UiPrimitives";
import {
  buildGeoScoreAttributionLines,
  buildGeoScoreChangeReason,
  formatGeoScoreChangeBadge,
  formatWorkspaceOverviewValues,
} from "@shared/workspaceDashboardOverview";
import type { WorkspaceSummaryMetrics } from "@shared/workspaceStateMachine";

type Props = {
  metrics: WorkspaceSummaryMetrics;
  latestGeoScore: number | null;
  previousGeoScore: number | null;
};

export function WorkspaceDashboardOverviewCards({ metrics, latestGeoScore, previousGeoScore }: Props) {
  const values = formatWorkspaceOverviewValues(metrics);
  const attributionLines = buildGeoScoreAttributionLines(metrics);
  const scoreChangeText = formatGeoScoreChangeBadge({
    latestScore: latestGeoScore,
    previousScore: previousGeoScore,
  });
  const changeReason = scoreChangeText ? buildGeoScoreChangeReason(metrics) : null;

  return (
    <section
      className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
      data-testid="workspace-dashboard-overview"
      aria-label="项目数据总览"
    >
      <div data-testid="workspace-overview-articles">
        <P0MetricTile label="内容资产" value={values.articleCountText} />
      </div>
      <div data-testid="workspace-overview-publishes">
        <P0MetricTile label="发布次数" value={values.publishCountText} />
      </div>
      <div data-testid="workspace-overview-mention-rate">
        <P0MetricTile
          label="AI提及率"
          value={values.aiMentionRateText}
          hint={values.aiMentionRateHint}
        />
      </div>
      <div data-testid="workspace-overview-geo-score">
        <P0MetricTile
          label="GEO评分"
          value={values.geoScoreText}
          hint={[
            scoreChangeText ? `${scoreChangeText} · ${changeReason}` : null,
            ...attributionLines,
          ]
            .filter(Boolean)
            .join("；")}
        />
      </div>
    </section>
  );
}
