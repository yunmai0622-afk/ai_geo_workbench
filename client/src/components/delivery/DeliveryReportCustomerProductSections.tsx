import { DeliveryReportProductBody } from "@/components/delivery/DeliveryReportProductBody";
import type { DeliveryReportPublishedItem } from "@/lib/deliveryReportDisplay";
import { buildDeliveryReportProductSnapshot } from "@shared/deliveryReportReadability";
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
}: DeliveryReportCustomerProductSectionsProps) {
  const displayName = brandName.trim() || enterpriseName.trim() || "当前企业";

  const snapshot = useMemo(() => {
    const publishWithLinkCount = publishedItems.filter(item => (item.url ?? "").trim().length > 0).length;
    const contentEvidenceRows = publishedItems.map((item, index) => ({
      key: `customer-${index}`,
      title: item.title,
      questionText: "已发布内容",
      platform: item.platform ?? "未标注平台",
      publishStatus: item.url ? "已发布" : "待回填链接",
      publicUrl: item.url ?? "",
      qualityStatus: "已交付",
      retestStatus: "待复测",
    }));

    const insufficientReasonParts: string[] = [];
    if (publishCount > 0 && publishWithLinkCount === 0) {
      insufficientReasonParts.push("尚未完成发布链接回填");
    }
    if (!hasAiTestData) {
      insufficientReasonParts.push("尚未完成 T1 复测");
    }

    return buildDeliveryReportProductSnapshot({
      enterpriseName: displayName,
      reportPeriod,
      roundGoal: "提升 AI 搜索可见度与品牌推荐率",
      visibilityScore,
      mentionRate,
      recommendRate,
      hasAiTestData,
      conclusionLine,
      completedActionLines: [
        contentAssetCount > 0 ? `已生成 ${contentAssetCount} 篇内容资产` : "",
        publishCount > 0 ? `已登记 ${publishCount} 条发布记录` : "",
        hasAiTestData ? `完成 ${questionCount} 次 AI 实测` : "",
      ].filter(Boolean),
      nextStepFocusLines: [
        publishWithLinkCount === 0 && publishCount > 0
          ? "优先回填公开链接，以便形成可核验的发布证据"
          : "按诊断建议持续优化并安排复测",
      ],
      insufficientReasonParts,
      questionCount,
      engineCount,
      lastAiTestedAt: null,
      generatedArticleCount: contentAssetCount,
      publishableArticleCount: Math.max(0, contentAssetCount - publishCount),
      publishedRecordCount: publishCount,
      distinctPlatformCount: new Set(publishedItems.map(i => i.platform).filter(Boolean)).size,
      publishWithLinkCount,
      pendingLinkCount: Math.max(0, publishCount - publishWithLinkCount),
      retestCompletedCount: 0,
      retestPendingCount: 0,
      nextRetestAtLabel: null,
      geoAttributionLines: [
        visibilityScore != null
          ? `当前 GEO 综合评分 ${visibilityScore} 分，由内容诊断与 AI 实测共同形成。`
          : "完成 AI 实测与内容诊断后将展示 GEO 分归因说明。",
      ],
      positiveIndicatorLines: hasAiTestData
        ? [`已形成 AI 实测基线，覆盖 ${engineCount} 个平台`]
        : [],
      laggingIndicatorLines: publishWithLinkCount === 0 && publishCount > 0
        ? ["公开链接回填不足，发布结果暂无法进入完整监测链路"]
        : [],
      nextPriorityLine: "按诊断结论持续优化内容并安排复测",
      contentEvidenceRows,
      testRounds: [],
      citationRate: null,
      latestPublishAt: null,
      growthSuggestions: [],
      maxProblemLine: "当前高意向诊断问题",
      profileCompletionPercent: 100,
      qualityScoredCount: contentAssetCount,
    });
  }, [
    displayName,
    reportPeriod,
    visibilityScore,
    mentionRate,
    recommendRate,
    hasAiTestData,
    conclusionLine,
    contentAssetCount,
    publishCount,
    questionCount,
    engineCount,
    publishedItems,
  ]);

  return (
    <DeliveryReportProductBody snapshot={snapshot} mode="customer" />
  );
}
