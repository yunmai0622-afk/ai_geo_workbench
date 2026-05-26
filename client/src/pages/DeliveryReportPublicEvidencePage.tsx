import { AiSearchEvidenceView } from "@/components/AiSearchEvidenceView";
import { trpc } from "@/lib/trpc";
import {
  buildDeliveryReportPublicEvidencePath,
  buildDeliveryReportPublicPath,
  DELIVERY_REPORT_EVIDENCE_INVALID_MESSAGE,
} from "@shared/deliveryReportPublicShare";
import { useLocation, useRoute } from "wouter";

export default function DeliveryReportPublicEvidencePage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/delivery-reports/public/:token/evidence/:monitoringId/:resultIndex");
  const token = (params?.token ?? "").trim();
  const recordId = Number(params?.monitoringId);
  const resultIndex = Number(params?.resultIndex);
  const enabled =
    token.length >= 16 && Number.isFinite(recordId) && recordId > 0 && Number.isFinite(resultIndex) && resultIndex >= 0;

  const evidenceQuery = trpc.geo.reports.publicEvidence.useQuery(
    { token, recordId, resultIndex },
    { enabled, retry: false },
  );

  if (!enabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6 text-center text-gray-600">
        <p>{DELIVERY_REPORT_EVIDENCE_INVALID_MESSAGE}</p>
      </div>
    );
  }

  if (evidenceQuery.isLoading) {
    return <div className="min-h-screen bg-white px-4 py-10 text-gray-500">正在加载 AI 搜索实测证据…</div>;
  }

  if (evidenceQuery.isError || !evidenceQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6 text-center text-gray-600">
        <p>{evidenceQuery.error?.message ?? DELIVERY_REPORT_EVIDENCE_INVALID_MESSAGE}</p>
      </div>
    );
  }

  const reportPath = buildDeliveryReportPublicPath(token);

  return (
    <div className="min-h-screen bg-white">
      <AiSearchEvidenceView
        evidence={evidenceQuery.data}
        footerActions={[{ label: "返回客户报告", onClick: () => setLocation(reportPath) }]}
      />
    </div>
  );
}

export { buildDeliveryReportPublicEvidencePath };
