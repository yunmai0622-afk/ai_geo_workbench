import { DeliveryReportProductBody } from "@/components/delivery/DeliveryReportProductBody";
import {
  buildCustomerDeliverySnapshot,
  type BuildCustomerDeliverySnapshotInput,
} from "@/lib/buildCustomerDeliverySnapshot";
import type { DeliveryReportPublishedItem } from "@/lib/deliveryReportDisplay";
import { useMemo } from "react";

export type DeliveryReportCustomerProductSectionsProps = {
  enterpriseName: string;
  brandName: string;
  reportPeriod: string;
  conclusionLine: string;
  visibilityScore: number | null;
  mentionRate: number | null;
  recommendRate: number | null;
  hasAiTestData: boolean;
  questionCount: number;
  engineCount: number;
  publishCount: number;
  contentAssetCount?: number;
  publishedItems?: DeliveryReportPublishedItem[];
  customerSnapshotInput?: Partial<
    Omit<
      BuildCustomerDeliverySnapshotInput,
      | "enterpriseName"
      | "brandName"
      | "conclusionLine"
      | "visibilityScore"
      | "aiTestAggregate"
      | "publishedItems"
      | "contentAssetCount"
    >
  >;
};

export function DeliveryReportCustomerProductSections({
  enterpriseName,
  brandName,
  reportPeriod,
  conclusionLine,
  visibilityScore,
  mentionRate,
  recommendRate,
  hasAiTestData,
  questionCount,
  engineCount,
  publishCount,
  contentAssetCount = 0,
  publishedItems = [],
  customerSnapshotInput,
}: DeliveryReportCustomerProductSectionsProps) {
  const displayName = brandName.trim() || enterpriseName.trim() || "当前企业";

  const snapshot = useMemo(() => {
    return buildCustomerDeliverySnapshot({
      enterpriseName: displayName,
      brandName,
      reportGeneratedAt: customerSnapshotInput?.reportGeneratedAt ?? null,
      conclusionLine,
      visibilityScore,
      aiTestAggregate: {
        questionCount: hasAiTestData ? questionCount : 0,
        engineCount: hasAiTestData ? engineCount : 0,
        mentionRate: mentionRate ?? 0,
        recommendRate: recommendRate ?? 0,
        averageRank: null,
        sentimentCounts: { positive: 0, neutral: 0, negative: 0 },
        competitorMentionCount: 0,
        citedUrlCount: 0,
        byEngine: [],
        keySamples: [],
        publishCompare: {
          before: { hasData: false, questionCount: 0, mentionRate: null, recommendRate: null, averageRank: null, citedUrlCount: null },
          after: { hasData: false, questionCount: 0, mentionRate: null, recommendRate: null, averageRank: null, citedUrlCount: null },
          changes: { mentionRateDelta: null, recommendRateDelta: null, averageRankDelta: null, citedUrlCountDelta: null },
          hasAnyStageData: false,
        },
      },
      publishedItems,
      contentAssetCount,
      analysisCount: customerSnapshotInput?.analysisCount,
      testRounds: customerSnapshotInput?.testRounds,
      retestCompletedCount: customerSnapshotInput?.retestCompletedCount,
      retestPendingCount: customerSnapshotInput?.retestPendingCount,
      citationRate: customerSnapshotInput?.citationRate,
      maxProblemLine: customerSnapshotInput?.maxProblemLine ?? reportPeriod,
      growthSuggestions: customerSnapshotInput?.growthSuggestions,
    });
  }, [
    displayName,
    brandName,
    customerSnapshotInput,
    conclusionLine,
    visibilityScore,
    mentionRate,
    recommendRate,
    hasAiTestData,
    questionCount,
    engineCount,
    contentAssetCount,
    publishedItems,
    reportPeriod,
  ]);

  return <DeliveryReportProductBody snapshot={snapshot} mode="customer" />;
}
