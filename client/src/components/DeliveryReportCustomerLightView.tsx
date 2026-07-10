import { DeliveryReportCustomerProductSections } from "@/components/delivery/DeliveryReportCustomerProductSections";
import { DeliveryReportCompetitorSection } from "@/components/DeliveryReportCompetitorSection";
import { DeliveryReportRetestHero } from "@/components/DeliveryReportRetestHero";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { buildEvidenceDetailPath, formatDeltaPercent, formatDeltaRank, formatPercentMetric, formatRankMetric } from "@shared/aiTestEvidence";
import type { DeliveryReportCustomerViewProps } from "@/components/DeliveryReportCustomerView";
import { showPublishCompareSection } from "@/lib/deliveryReportDisplay";
import {
  buildDisplayReportNumber,
  DELIVERY_REPORT_SERVICE_PROVIDER,
  formatBaselinePercent,
  formatReportDateTime,
  publishCompareBaselineNote,
} from "@/lib/deliveryReportLightDisplay";
import { formatDeliveryReportShareExpiryLabel, resolveDeliveryReportShareCountdown } from "@shared/deliveryReportPublicShare";
import { buildDeliveryReportTitle } from "@shared/deliveryReportReadability";
import { useMemo, useRef, type ReactNode } from "react";
import { whiteLabel } from "@/lib/whiteLabel";

const REPORT_TITLE = "GEO 增长交付报告";

function LightSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-gray-900 sm:text-xl">{title}</h2>
        {description ? <p className="max-w-3xl text-sm leading-relaxed text-gray-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export type DeliveryReportCustomerLightViewProps = DeliveryReportCustomerViewProps & {
  reportNumberSuffix?: number;
  reportNumberSeed?: string;
  contentAssetCount?: number;
};

export function DeliveryReportCustomerLightView({
  brandName,
  enterpriseName,
  reportGeneratedAt,
  conclusionLine,
  visibilityScore,
  publishCount,
  contentAssetCount,
  aiTestAggregate,
  publishedItems = [],
  competitorComparison,
  loading,
  showEvidenceLinks = true,
  embedded = false,
  showMonitoringCta = false,
  onNavigateEvidence,
  buildEvidenceLink,
  onGoMonitoring,
  reportNumberSuffix,
  reportNumberSeed,
  shareExpiresAt,
  customerSnapshotInput,
}: DeliveryReportCustomerLightViewProps) {
  const evidenceRef = useRef<HTMLDivElement>(null);
  const hasAiTestData = aiTestAggregate.questionCount > 0;
  const assetCount = contentAssetCount ?? publishCount;
  const reportNumber = useMemo(
    () =>
      buildDisplayReportNumber({
        projectId: reportNumberSuffix,
        reportGeneratedAt,
        fallbackSeed: reportNumberSeed,
      }),
    [reportNumberSuffix, reportGeneratedAt, reportNumberSeed],
  );
  const showCompare = showPublishCompareSection(aiTestAggregate.publishCompare);
  const compareBaselineNote = useMemo(
    () => (showCompare ? publishCompareBaselineNote(aiTestAggregate.publishCompare) : null),
    [showCompare, aiTestAggregate.publishCompare],
  );
  const shareExpiryLabel = formatDeliveryReportShareExpiryLabel(shareExpiresAt);
  const shareCountdown = resolveDeliveryReportShareCountdown(shareExpiresAt);
  const detectionConclusion = conclusionLine.trim();
  const shellClass = embedded
    ? "space-y-10 overflow-x-hidden bg-gray-50 text-gray-900"
    : "min-h-screen overflow-x-hidden bg-gray-100 text-gray-900";

  return (
    <div className={shellClass}>
      <div className={`mx-auto max-w-3xl space-y-10 ${embedded ? "" : "px-4 py-8 pb-16 sm:px-6 sm:py-10"}`}>
        {shareExpiresAt !== undefined ? (
          <p
            className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-center text-sm text-sky-900"
            data-testid="delivery-report-public-share-expiry"
          >
            本报告为对外分享只读版本 ·
            {shareCountdown?.expired
              ? " 报告链接已过期"
              : shareCountdown
                ? ` 有效期剩余 ${shareCountdown.daysRemaining} 天`
                : ""}
            {" · "}
            {shareExpiryLabel}
          </p>
        ) : null}

        <header className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gradient-to-r from-sky-50 to-white px-5 py-6 sm:px-8 sm:py-8">
            <p className="text-xs font-medium tracking-wide text-sky-700" style={whiteLabel.brandColor ? { color: whiteLabel.brandColor } : undefined}>{DELIVERY_REPORT_SERVICE_PROVIDER}</p>
            <p className="mt-1 text-xs text-gray-500">本报告由 {DELIVERY_REPORT_SERVICE_PROVIDER} 为客户生成</p>
            <p className="mt-2 text-sm font-medium text-gray-600">{REPORT_TITLE}</p>
            <h1 className="mt-3 text-xl font-bold leading-snug text-gray-900 sm:text-2xl">
              {buildDeliveryReportTitle(brandName || enterpriseName)}
            </h1>
          </div>
          <div className="p-5 sm:p-8">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-gray-500">服务对象</dt>
                <dd className="mt-0.5 font-medium text-gray-900">{enterpriseName}</dd>
              </div>
              <div>
                <dt className="text-gray-500">服务方</dt>
                <dd className="mt-0.5 font-medium text-gray-900">{DELIVERY_REPORT_SERVICE_PROVIDER}</dd>
              </div>
              <div>
                <dt className="text-gray-500">报告生成时间</dt>
                <dd className="mt-0.5 font-medium text-gray-800">{formatReportDateTime(reportGeneratedAt)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-gray-500">报告编号</dt>
                <dd className="mt-0.5 font-mono text-sm font-medium text-gray-800">{reportNumber}</dd>
              </div>
            </dl>
            {whiteLabel.supportContact ? <p className="mt-4 text-xs text-gray-500">服务联系：{whiteLabel.supportContact}</p> : null}
            {whiteLabel.poweredByVisible ? <p className="mt-1 text-xs text-gray-400">技术支持：GEO Engine</p> : null}
          </div>
        </header>

        <DeliveryReportRetestHero publishCompare={aiTestAggregate.publishCompare} />

        <DeliveryReportCustomerProductSections
          enterpriseName={enterpriseName}
          brandName={brandName}
          reportPeriod={
            reportGeneratedAt
              ? `截至 ${reportGeneratedAt.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })}`
              : "交付周期待更新"
          }
          conclusionLine={conclusionLine}
          visibilityScore={visibilityScore}
          mentionRate={hasAiTestData ? aiTestAggregate.mentionRate : null}
          recommendRate={hasAiTestData ? aiTestAggregate.recommendRate : null}
          hasAiTestData={hasAiTestData}
          questionCount={aiTestAggregate.questionCount}
          engineCount={aiTestAggregate.engineCount}
          publishCount={publishCount}
          contentAssetCount={assetCount}
          publishedItems={publishedItems}
          customerSnapshotInput={customerSnapshotInput}
        />

        {detectionConclusion ? (
          <LightSection title="主要检测结论" description="基于本轮内容诊断与 AI 搜索实测汇总，不含内部技术字段。">
            <p
              className="rounded-xl border border-amber-100 bg-amber-50/80 p-4 text-sm leading-relaxed text-gray-800 sm:text-base"
              data-testid="delivery-report-public-detection-conclusion"
            >
              {detectionConclusion}
            </p>
          </LightSection>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-gray-600">
            <Spinner className="size-5 text-blue-600" />
            <p className="text-sm">正在加载报告内容…</p>
          </div>
        ) : (
          <>
            <LightSection title="AI 实测证据" description="以下为分引擎汇总与可核对的关键证据样例。">
              {aiTestAggregate.questionCount === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-5 text-sm text-gray-600">
                  原因：尚未完成 AI 搜索实测。下一步：先完成一次 AI 实测，以建立可追溯的可见度基线。
                  {showMonitoringCta && onGoMonitoring ? (
                    <Button variant="ai" className="mt-4 h-11 w-full sm:w-auto" onClick={onGoMonitoring}>
                      前往收录监测实测
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-medium text-gray-500">分引擎结果</p>
                    {aiTestAggregate.byEngine.length === 0 ? (
                      <p className="mt-2 text-sm text-gray-600">
                        原因：当前样本未形成分引擎数据。下一步：在收录监测补充不同引擎实测后回看该区块。
                      </p>
                    ) : (
                      <ul className="mt-3 divide-y divide-slate-100">
                        {aiTestAggregate.byEngine.map(engine => (
                          <li
                            key={engine.engineName}
                            className="flex flex-col gap-1 py-3 text-sm first:pt-0 last:pb-0 sm:flex-row sm:justify-between"
                          >
                            <span className="font-medium text-gray-900">{engine.engineName}</span>
                            <span className="text-gray-600">
                              提及 {formatBaselinePercent(engine.mentionRate, true)} · 推荐{" "}
                              {formatBaselinePercent(engine.recommendRate, true)} · {engine.questionCount} 题
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {aiTestAggregate.keySamples.length > 0 ? (
                    <div ref={evidenceRef} className="scroll-mt-8 space-y-3">
                      <p className="text-sm font-medium text-gray-800">关键证据样例</p>
                      {aiTestAggregate.keySamples.map(sample => (
                        <div
                          key={`${sample.monitoringRecordId}-${sample.resultIndex}`}
                          className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-sm font-medium text-gray-900">{sample.question}</p>
                            <p className="mt-1 text-xs text-gray-500">{sample.engineName}</p>
                          </div>
                          {showEvidenceLinks && onNavigateEvidence ? (
                            <Button
                              size="sm"
                              variant="aiOutline"
                              className="h-11 shrink-0"
                              onClick={() =>
                                onNavigateEvidence(
                                  buildEvidenceLink
                                    ? buildEvidenceLink(sample)
                                    : buildEvidenceDetailPath(sample.monitoringRecordId, sample.resultIndex),
                                )
                              }
                            >
                              查看原始 AI 回答证据
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </LightSection>

            {showCompare ? (
              <LightSection title="发布前后变化" description="用于观察内容发布后，品牌在 AI 搜索中的表现变化。">
                {compareBaselineNote ? (
                  <p className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {compareBaselineNote}
                  </p>
                ) : null}
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="w-full table-fixed border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                        <th className="w-[28%] px-3 py-3 font-medium sm:px-4">指标</th>
                        <th className="w-[24%] px-3 py-3 font-medium sm:px-4">发布前</th>
                        <th className="w-[24%] px-3 py-3 font-medium sm:px-4">发布后</th>
                        <th className="w-[24%] px-3 py-3 font-medium sm:px-4">变化</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-800">
                      {[
                        {
                          label: "品牌提及率",
                          before: aiTestAggregate.publishCompare.before.hasData
                            ? formatPercentMetric(aiTestAggregate.publishCompare.before.mentionRate)
                            : "待有实测数据",
                          after: aiTestAggregate.publishCompare.after.hasData
                            ? formatPercentMetric(aiTestAggregate.publishCompare.after.mentionRate)
                            : "待有实测数据",
                          change:
                            aiTestAggregate.publishCompare.before.hasData && aiTestAggregate.publishCompare.after.hasData
                              ? formatDeltaPercent(aiTestAggregate.publishCompare.changes.mentionRateDelta)
                              : "待有对应记录",
                        },
                        {
                          label: "品牌推荐率",
                          before: aiTestAggregate.publishCompare.before.hasData
                            ? formatPercentMetric(aiTestAggregate.publishCompare.before.recommendRate)
                            : "待有实测数据",
                          after: aiTestAggregate.publishCompare.after.hasData
                            ? formatPercentMetric(aiTestAggregate.publishCompare.after.recommendRate)
                            : "待有实测数据",
                          change:
                            aiTestAggregate.publishCompare.before.hasData && aiTestAggregate.publishCompare.after.hasData
                              ? formatDeltaPercent(aiTestAggregate.publishCompare.changes.recommendRateDelta)
                              : "待有对应记录",
                        },
                        {
                          label: "平均排名",
                          before: aiTestAggregate.publishCompare.before.hasData
                            ? formatRankMetric(aiTestAggregate.publishCompare.before.averageRank)
                            : "待有实测数据",
                          after: aiTestAggregate.publishCompare.after.hasData
                            ? formatRankMetric(aiTestAggregate.publishCompare.after.averageRank)
                            : "待有实测数据",
                          change:
                            aiTestAggregate.publishCompare.before.hasData && aiTestAggregate.publishCompare.after.hasData
                              ? formatDeltaRank(aiTestAggregate.publishCompare.changes.averageRankDelta)
                              : "待有对应记录",
                        },
                      ].map(row => (
                        <tr key={row.label} className="border-b border-gray-100 last:border-0">
                          <td className="px-3 py-3 font-medium text-gray-700 sm:px-4">{row.label}</td>
                          <td className="break-words px-3 py-3 sm:px-4">{row.before}</td>
                          <td className="break-words px-3 py-3 sm:px-4">{row.after}</td>
                          <td className="break-words px-3 py-3 text-sky-700 sm:px-4">{row.change}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </LightSection>
            ) : null}

            <LightSection
              title="竞品对比"
              description="对比本品牌与主要竞品在 AI 实测中的提及情况，以及竞品公开内容分布。"
            >
              {competitorComparison ? (
                <DeliveryReportCompetitorSection data={competitorComparison} />
              ) : (
                <p className="text-sm text-gray-600" data-testid="delivery-report-competitor-empty">
                  原因：尚未完成竞品档案。下一步：补充主要竞品后可查看 AI 实测提及对比与内容分布建议。
                </p>
              )}
            </LightSection>

            <p className="text-[11px] leading-relaxed text-gray-500">
              说明：样本量有限，不代表全网绝对排名；不承诺保证收录、排名或 AI 推荐；对外材料须以已确认事实为准。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
