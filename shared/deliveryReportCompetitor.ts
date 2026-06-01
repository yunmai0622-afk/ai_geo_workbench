import { listActivePlatformLabels } from "./competitorAnalysisDisplay";
import type { CompetitorPlatformKey } from "./competitorContentPlatforms";
import { COMPETITOR_CONTENT_PLATFORMS } from "./competitorContentPlatforms";

/** 交付报告「竞品对比」模块（客户可读，无工程字段） */
export type DeliveryReportCompetitorRow = {
  competitorName: string;
  aiMentionCount: number;
  advantageDescription: string;
  platformLabels: string[];
};

export type DeliveryReportCompetitorComparison = {
  brandName: string;
  brandAiMentionCount: number;
  totalAiTestRuns: number;
  competitors: DeliveryReportCompetitorRow[];
  contentSuggestions: string[];
};

export type CompetitorAnalysisSummaryLike = {
  brandName: string;
  brandAiMentionCount: number;
  totalAiTestRuns: number;
  competitors: Array<{
    competitorName: string;
    aiMentionCount: number;
    advantageDescription: string;
    platformDistribution: Partial<Record<CompetitorPlatformKey, boolean>>;
  }>;
  contentSuggestions: string[];
};

export function mapCompetitorAnalysisForDeliveryReport(
  summary: CompetitorAnalysisSummaryLike,
): DeliveryReportCompetitorComparison {
  return {
    brandName: summary.brandName,
    brandAiMentionCount: summary.brandAiMentionCount,
    totalAiTestRuns: summary.totalAiTestRuns,
    competitors: summary.competitors.map(row => ({
      competitorName: row.competitorName,
      aiMentionCount: row.aiMentionCount,
      advantageDescription: row.advantageDescription,
      platformLabels: listActivePlatformLabels(row.platformDistribution),
    })),
    contentSuggestions: [...summary.contentSuggestions],
  };
}

/** 各平台上有公开内容的竞品名称（用于交付报告矩阵展示） */
export function buildCompetitorPlatformMatrix(
  competitors: DeliveryReportCompetitorRow[],
): Array<{ platformLabel: string; competitorNames: string[] }> {
  return COMPETITOR_CONTENT_PLATFORMS.map(platform => {
    const competitorNames = competitors
      .filter(row => row.platformLabels.includes(platform.label))
      .map(row => row.competitorName);
    return { platformLabel: platform.label, competitorNames };
  }).filter(row => row.competitorNames.length > 0);
}
