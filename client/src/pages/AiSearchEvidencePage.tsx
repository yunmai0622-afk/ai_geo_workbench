import { AiSearchEvidenceView } from "@/components/AiSearchEvidenceView";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { buildEvidenceDetailPath, type AiTestEvidenceItem } from "@shared/aiTestEvidence";
import { mapItemToPublicEvidence } from "@shared/deliveryReportPublicShare";
import { useLocation, useRoute } from "wouter";

export default function AiSearchEvidencePage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/geo/evidence/:monitoringId/:resultIndex");
  const monitoringRecordId = Number(params?.monitoringId);
  const resultIndex = Number(params?.resultIndex);
  const enabled = Number.isFinite(monitoringRecordId) && monitoringRecordId > 0 && Number.isFinite(resultIndex) && resultIndex >= 0;

  const detailQuery = trpc.geo.aiMentionCheck.evidenceDetail.useQuery(
    { monitoringRecordId, resultIndex },
    { enabled },
  );

  const item = detailQuery.data?.item as AiTestEvidenceItem | undefined;
  const competitorConfigured = detailQuery.data?.competitorConfigured ?? false;
  const enterpriseName = detailQuery.data?.enterpriseName ?? "";

  if (!enabled) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-gray-600">
        <p>链接无效，请从交付报告或收录监测页重新进入。</p>
        <Button className="mt-4" variant="outline" onClick={() => setLocation("/delivery-reports")}>
          返回交付报告
        </Button>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return <div className="mx-auto max-w-3xl p-8 text-gray-500">正在加载 AI 搜索实测证据…</div>;
  }

  if (detailQuery.isError || !item) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-8 text-gray-600">
        <p>{detailQuery.error?.message ?? "未找到该条实测证据。"}</p>
        <Button variant="outline" onClick={() => setLocation("/inclusion-monitoring")}>
          返回收录监测
        </Button>
      </div>
    );
  }

  const evidence = mapItemToPublicEvidence(item, {
    brandName: enterpriseName,
    enterpriseName,
    competitorConfigured,
  });

  return (
    <AiSearchEvidenceView
      evidence={evidence}
      footerActions={[
        { label: "返回收录监测", onClick: () => setLocation("/inclusion-monitoring") },
        { label: "返回交付报告", onClick: () => setLocation("/delivery-reports") },
      ]}
    />
  );
}

export { buildEvidenceDetailPath };
