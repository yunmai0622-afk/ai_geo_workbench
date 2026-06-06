import type { DeliveryReportPublishedItem } from "@/lib/deliveryReportDisplay";
import { buildDeliveryReportMeta } from "@/lib/deliveryReportProductDisplay";
import type { AiTestEvidenceAggregate } from "@shared/aiTestEvidence";
import {
  buildGeoGrowthSuggestions,
  countDistinctPublishPlatforms,
  countUnpublishedArticles,
  findLatestT0FinishedAt,
  type GeoGrowthSuggestion,
} from "@shared/geoGrowthSuggestions";
import {
  buildDeliveryReportProductSnapshot,
  type DeliveryReportProductSnapshot,
} from "@shared/deliveryReportReadability";
import type { TestRoundSummary } from "@shared/retestComparisonDisplay";
import { T1_RETEST_PLAN_DAYS } from "@shared/retestPlan";
import { hasCompletedT0Baseline, hasCompletedT1Retest } from "@shared/workspaceMainChain";

export type BuildCustomerDeliverySnapshotInput = {
  enterpriseName: string;
  brandName?: string;
  reportGeneratedAt: Date | null;
  conclusionLine: string;
  visibilityScore: number | null;
  aiTestAggregate: AiTestEvidenceAggregate;
  publishedItems: DeliveryReportPublishedItem[];
  contentAssetCount: number;
  analysisCount?: number;
  testRounds?: TestRoundSummary[];
  retestCompletedCount?: number;
  retestPendingCount?: number;
  citationRate?: number | null;
  maxProblemLine?: string;
  growthSuggestions?: GeoGrowthSuggestion[];
};

function computeCitationRate(aggregate: AiTestEvidenceAggregate): number | null {
  if (aggregate.questionCount === 0) return null;
  return aggregate.citedUrlCount / aggregate.questionCount;
}

function resolveLatestPublishAt(items: DeliveryReportPublishedItem[]): string | null {
  let latest: number | null = null;
  let value: string | null = null;
  for (const item of items) {
    if (!item.publishedAt) continue;
    const ts = new Date(item.publishedAt).getTime();
    if (!Number.isNaN(ts) && (latest == null || ts > latest)) {
      latest = ts;
      value = item.publishedAt;
    }
  }
  return value;
}

function resolveNextRetestAtLabel(latestPublishAt: string | null): string | null {
  if (!latestPublishAt) return null;
  const d = new Date(latestPublishAt);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + T1_RETEST_PLAN_DAYS);
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function buildCustomerDeliverySnapshot(
  input: BuildCustomerDeliverySnapshotInput,
): DeliveryReportProductSnapshot {
  const displayName = input.brandName?.trim() || input.enterpriseName.trim() || "当前企业";
  const hasAiTestData = input.aiTestAggregate.questionCount > 0;
  const publishCount = input.publishedItems.length;
  const publishWithLinkCount = input.publishedItems.filter(i => (i.url ?? "").trim().length > 0).length;
  const testRounds = input.testRounds ?? [];
  const citationRate = input.citationRate ?? computeCitationRate(input.aiTestAggregate);
  const latestPublishAt = resolveLatestPublishAt(input.publishedItems);
  const maxProblemLine = input.maxProblemLine?.trim() || "当前高意向诊断问题";

  const reportMeta = buildDeliveryReportMeta({
    enterpriseName: displayName,
    reportGeneratedAt: input.reportGeneratedAt,
    analysisCount: input.analysisCount ?? 0,
    hasAiTestData,
    hasPublishWithLink: publishWithLinkCount > 0,
    visibilityScore: input.visibilityScore,
    mentionRate: input.aiTestAggregate.mentionRate,
    recommendRate: input.aiTestAggregate.recommendRate,
    maxProblemLine,
  });

  const growthSuggestions =
    input.growthSuggestions ??
    buildGeoGrowthSuggestions({
      mentionRate: hasAiTestData ? input.aiTestAggregate.mentionRate : null,
      recommendRate: hasAiTestData ? input.aiTestAggregate.recommendRate : null,
      distinctPublishPlatformCount: countDistinctPublishPlatforms(
        input.publishedItems.map(i => ({ publishChannel: i.platform })),
      ),
      unpublishedArticleCount: countUnpublishedArticles([]),
      hasCompletedT0Baseline: hasCompletedT0Baseline(testRounds),
      hasCompletedT1Retest: hasCompletedT1Retest(testRounds),
      t0FinishedAt: findLatestT0FinishedAt(testRounds),
    });

  const contentEvidenceRows = input.publishedItems.map((item, index) => ({
    key: `customer-${index}`,
    title: item.title,
    questionText: maxProblemLine.startsWith("暂无") ? "已发布内容" : maxProblemLine,
    platform: item.platform ?? "未标注平台",
    publishStatus: item.url ? "已发布" : "待回填链接",
    publicUrl: item.url ?? "",
    qualityStatus: "已交付",
    retestStatus: hasAiTestData ? "待复测" : "需先完成 AI 实测",
  }));

  const insufficientReasonParts: string[] = [];
  if (publishCount > 0 && publishWithLinkCount === 0) {
    insufficientReasonParts.push("尚未完成发布链接回填");
  }
  if (!hasCompletedT1Retest(testRounds) && hasAiTestData) {
    insufficientReasonParts.push("尚未完成 T1 复测");
  }
  if (!hasAiTestData) {
    insufficientReasonParts.push("尚未完成 AI 搜索实测");
  }

  const completedActionLines = [
    input.contentAssetCount > 0 ? `已生成 ${input.contentAssetCount} 篇内容资产` : "",
    publishCount > 0 ? `已登记 ${publishCount} 条发布记录` : "",
    hasAiTestData
      ? `完成 ${input.aiTestAggregate.questionCount} 次 AI 实测（覆盖 ${input.aiTestAggregate.engineCount} 个引擎）`
      : "",
  ].filter(Boolean);

  const nextStepFocusLines =
    publishWithLinkCount === 0 && publishCount > 0
      ? ["优先回填公开链接，以便形成可核验的发布证据"]
      : growthSuggestions.slice(0, 2).map(s => s.message);

  const positiveIndicatorLines: string[] = [];
  if (hasAiTestData) {
    positiveIndicatorLines.push(`已形成 AI 实测基线，覆盖 ${input.aiTestAggregate.engineCount} 个平台`);
  }
  if (publishWithLinkCount > 0) {
    positiveIndicatorLines.push(`已有 ${publishWithLinkCount} 条公开链接进入监测链路`);
  }

  const laggingIndicatorLines: string[] = [];
  if (publishWithLinkCount === 0 && publishCount > 0) {
    laggingIndicatorLines.push("公开链接回填不足，发布结果暂无法进入完整监测链路");
  }
  if (!hasAiTestData) {
    laggingIndicatorLines.push("尚未完成 AI 实测，提及率与推荐率无法形成稳定结论");
  }
  if (laggingIndicatorLines.length === 0 && hasAiTestData) {
    laggingIndicatorLines.push("建议持续扩大覆盖问题与发布平台，并安排 T1 复测形成前后对比");
  }

  return buildDeliveryReportProductSnapshot({
    enterpriseName: displayName,
    reportPeriod: reportMeta.reportPeriod,
    roundGoal: reportMeta.reportRound,
    visibilityScore: input.visibilityScore,
    mentionRate: hasAiTestData ? input.aiTestAggregate.mentionRate : null,
    recommendRate: hasAiTestData ? input.aiTestAggregate.recommendRate : null,
    hasAiTestData,
    conclusionLine: input.conclusionLine.trim() || reportMeta.conclusionLine,
    completedActionLines,
    nextStepFocusLines,
    insufficientReasonParts,
    questionCount: input.aiTestAggregate.questionCount,
    engineCount: input.aiTestAggregate.engineCount,
    lastAiTestedAt: null,
    generatedArticleCount: input.contentAssetCount,
    publishableArticleCount: Math.max(0, input.contentAssetCount - publishCount),
    publishedRecordCount: publishCount,
    distinctPlatformCount: new Set(input.publishedItems.map(i => i.platform).filter(Boolean)).size,
    publishWithLinkCount,
    pendingLinkCount: Math.max(0, publishCount - publishWithLinkCount),
    retestCompletedCount: input.retestCompletedCount ?? 0,
    retestPendingCount: input.retestPendingCount ?? 0,
    nextRetestAtLabel: resolveNextRetestAtLabel(latestPublishAt),
    geoAttributionLines: [
      input.visibilityScore != null
        ? `当前 GEO 综合评分 ${input.visibilityScore} 分，由内容诊断与 AI 实测共同形成。`
        : "完成 AI 实测与内容诊断后将展示 GEO 分归因说明。",
    ],
    positiveIndicatorLines,
    laggingIndicatorLines,
    nextPriorityLine: growthSuggestions[0]?.message ?? "按诊断结论持续优化内容并安排复测",
    contentEvidenceRows,
    testRounds,
    citationRate,
    latestPublishAt,
    growthSuggestions,
    maxProblemLine,
    profileCompletionPercent: 100,
    qualityScoredCount: input.contentAssetCount,
  });
}
