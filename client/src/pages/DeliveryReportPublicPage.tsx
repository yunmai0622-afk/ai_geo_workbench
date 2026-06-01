import { DeliveryReportCustomerView } from "@/components/DeliveryReportCustomerView";
import { formatPublishedAtLabel } from "@/lib/deliveryReportDisplay";
import { trpc } from "@/lib/trpc";
import {
  buildDeliveryReportPublicEvidencePath,
  DELIVERY_REPORT_SHARE_INVALID_MESSAGE,
} from "@shared/deliveryReportPublicShare";
import { toUserFacingQueryError } from "@shared/userFacingErrors";
import type { AiTestEvidenceAggregate } from "@shared/aiTestEvidence";
import { useLocation, useRoute } from "wouter";

const emptyAggregate: AiTestEvidenceAggregate = {
  questionCount: 0,
  engineCount: 0,
  mentionRate: 0,
  recommendRate: 0,
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
};

export default function DeliveryReportPublicPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/delivery-reports/public/:token");
  const token = (params?.token ?? "").trim();
  const enabled = token.length >= 16;

  const shareQuery = trpc.geo.reports.publicShare.useQuery({ token }, { enabled, retry: false });

  if (!enabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-6 text-center text-gray-700">
        <p>{DELIVERY_REPORT_SHARE_INVALID_MESSAGE}</p>
      </div>
    );
  }

  if (shareQuery.isLoading) {
    return (
      <DeliveryReportCustomerView
        variant="light"
        brandName="—"
        enterpriseName="—"
        reportGeneratedAt={null}
        conclusionLine=""
        visibilityScore={null}
        publishCount={0}
        aiTestAggregate={emptyAggregate}
        reportNumberSeed={token}
        loading
        showEvidenceLinks={false}
      />
    );
  }

  if (shareQuery.isError || !shareQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-6 text-center text-gray-700">
        <p>{toUserFacingQueryError(shareQuery.error?.message, DELIVERY_REPORT_SHARE_INVALID_MESSAGE)}</p>
      </div>
    );
  }

  const data = shareQuery.data;
  const publishedItems = (data.publishedContent ?? []).map(item => ({
    title: item.title,
    platform: item.platform,
    publishedAt: formatPublishedAtLabel(item.publishedAt),
    url: item.url,
  }));
  return (
    <DeliveryReportCustomerView
      variant="light"
      brandName={data.brandName}
      enterpriseName={data.enterpriseName}
      reportGeneratedAt={data.reportGeneratedAt ? new Date(data.reportGeneratedAt) : null}
      conclusionLine={data.conclusionLine}
      shareExpiresAt={data.shareExpiresAt}
      visibilityScore={data.visibilityScore ?? null}
      publishCount={publishedItems.length}
      contentAssetCount={publishedItems.length}
      publishedItems={publishedItems}
      aiTestAggregate={data.aiTest}
      competitorComparison={data.competitorComparison ?? null}
      reportNumberSeed={token}
      showEvidenceLinks
      buildEvidenceLink={sample => buildDeliveryReportPublicEvidencePath(token, sample.monitoringRecordId, sample.resultIndex)}
      onNavigateEvidence={path => setLocation(path)}
    />
  );
}
