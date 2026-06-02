import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  buildEvidenceDetailPath,
  formatDeltaPercent,
  formatDeltaRank,
  formatPercentMetric,
  formatRankMetric,
  type AiTestEvidenceAggregate,
} from "@shared/aiTestEvidence";
import {
  buildEngineMentionSubtitle,
  buildNextActionLines,
  formatDeliveryReportVisibilityScore,
  showPublishCompareSection,
  type DeliveryReportPublishedItem,
} from "@/lib/deliveryReportDisplay";
import {
  buildBossThreePoints,
  buildDisplayReportNumber,
  buildValueSettlementItems,
  DELIVERY_REPORT_SERVICE_PROVIDER,
  formatBaselinePercent,
  formatReportDateTime,
  mentionRateNarrative,
  publishCompareBaselineNote,
  recommendRateNarrative,
  resolveVisibilityScoreTier,
} from "@/lib/deliveryReportLightDisplay";
import { formatDeliveryReportShareExpiryLabel, resolveDeliveryReportShareCountdown } from "@shared/deliveryReportPublicShare";
import { useMemo, useRef, type ReactNode } from "react";
import { DeliveryReportCompetitorSection } from "@/components/DeliveryReportCompetitorSection";
import { DeliveryReportRetestHero } from "@/components/DeliveryReportRetestHero";
import type { DeliveryReportCustomerViewProps } from "@/components/DeliveryReportCustomerView";

const REPORT_TITLE = "GEO AI 搜索可见度优化交付报告";

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

function LightMetric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900 sm:text-2xl">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-relaxed text-gray-600">{hint}</p> : null}
    </div>
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
  suggestionLines,
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
}: DeliveryReportCustomerLightViewProps) {
  const evidenceRef = useRef<HTMLDivElement>(null);
  const hasAiTestData = aiTestAggregate.questionCount > 0;
  const evidenceCount = aiTestAggregate.keySamples.length;

  const reportNumber = useMemo(
    () =>
      buildDisplayReportNumber({
        projectId: reportNumberSuffix,
        reportGeneratedAt,
        fallbackSeed: reportNumberSeed,
      }),
    [reportNumberSuffix, reportGeneratedAt, reportNumberSeed],
  );

  const bossPoints = useMemo(
    () =>
      buildBossThreePoints({
        brandName,
        publishCount,
        questionCount: aiTestAggregate.questionCount,
        engineCount: aiTestAggregate.engineCount,
        mentionRate: aiTestAggregate.mentionRate,
        recommendRate: aiTestAggregate.recommendRate,
        hasAiTestData,
        visibilityScore,
      }),
    [
      brandName,
      publishCount,
      aiTestAggregate.questionCount,
      aiTestAggregate.engineCount,
      aiTestAggregate.mentionRate,
      aiTestAggregate.recommendRate,
      hasAiTestData,
      visibilityScore,
    ],
  );

  const assetCount = contentAssetCount ?? publishCount;

  const valueItems = useMemo(
    () =>
      buildValueSettlementItems({
        contentAssetCount: assetCount,
        publishCount,
        questionCount: aiTestAggregate.questionCount,
        engineCount: aiTestAggregate.engineCount,
        evidenceCount,
        hasAiTestData,
        publishCompare: aiTestAggregate.publishCompare,
      }),
    [
      assetCount,
      publishCount,
      aiTestAggregate.questionCount,
      aiTestAggregate.engineCount,
      evidenceCount,
      hasAiTestData,
      aiTestAggregate.publishCompare,
    ],
  );

  const scoreTier = useMemo(() => resolveVisibilityScoreTier(visibilityScore), [visibilityScore]);
  const engineSubtitle = useMemo(
    () => buildEngineMentionSubtitle(aiTestAggregate.byEngine, aiTestAggregate.mentionRate, aiTestAggregate.recommendRate),
    [aiTestAggregate.byEngine, aiTestAggregate.mentionRate, aiTestAggregate.recommendRate],
  );

  const actionLines = useMemo(
    () =>
      buildNextActionLines(
        aiTestAggregate.mentionRate,
        aiTestAggregate.recommendRate,
        publishCount,
        hasAiTestData,
        suggestionLines,
      ).slice(0, 3),
    [aiTestAggregate.mentionRate, aiTestAggregate.recommendRate, publishCount, hasAiTestData, suggestionLines],
  );

  const showCompare = showPublishCompareSection(aiTestAggregate.publishCompare);
  const compareBaselineNote = useMemo(
    () => (showCompare ? publishCompareBaselineNote(aiTestAggregate.publishCompare) : null),
    [showCompare, aiTestAggregate.publishCompare],
  );

  const scoreDisplay = formatDeliveryReportVisibilityScore(visibilityScore);
  const mentionDisplay = formatBaselinePercent(aiTestAggregate.mentionRate, hasAiTestData);
  const recommendDisplay = formatBaselinePercent(aiTestAggregate.recommendRate, hasAiTestData);
  const rankDisplay = hasAiTestData
    ? aiTestAggregate.averageRank != null
      ? `约第 ${aiTestAggregate.averageRank.toFixed(1)} 位`
      : "暂无稳定排名"
    : "待实测";

  const shellClass = embedded
    ? "space-y-10 overflow-x-hidden bg-gray-50 text-gray-900"
    : "min-h-screen overflow-x-hidden bg-gray-100 text-gray-900";

  const scrollToEvidence = () => {
    evidenceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const shareExpiryLabel = formatDeliveryReportShareExpiryLabel(shareExpiresAt);
  const shareCountdown = resolveDeliveryReportShareCountdown(shareExpiresAt);
  const detectionConclusion = conclusionLine.trim();

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

        {/* 区块 1：报告封面 */}
        <header className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gradient-to-r from-sky-50 to-white px-5 py-6 sm:px-8 sm:py-8">
            <p className="text-xs font-medium tracking-wide text-sky-700">{DELIVERY_REPORT_SERVICE_PROVIDER}</p>
            <h1 className="mt-3 text-xl font-bold leading-snug text-gray-900 sm:text-2xl">{REPORT_TITLE}</h1>
          </div>
          <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-8">
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <p className="text-xs text-gray-500">客户名称</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{enterpriseName}</p>
                {brandName && brandName !== enterpriseName ? (
                  <p className="mt-0.5 text-sm text-gray-600">品牌：{brandName}</p>
                ) : null}
              </div>
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-gray-500">服务方</dt>
                  <dd className="mt-0.5 font-medium text-gray-800">{DELIVERY_REPORT_SERVICE_PROVIDER}</dd>
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
            </div>
            <div
              className="flex h-20 w-full shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-4 sm:h-24 sm:w-28"
              aria-hidden
            >
              <span className="line-clamp-3 text-center text-sm font-bold leading-tight text-gray-700">
                {enterpriseName.slice(0, 8)}
                {enterpriseName.length > 8 ? "…" : ""}
              </span>
            </div>
          </div>
        </header>

        <DeliveryReportRetestHero publishCompare={aiTestAggregate.publishCompare} />

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

        {/* 区块 2：老板版结论 */}
        <LightSection title="老板先看这 3 点">
          <ol className="space-y-3">
            {bossPoints.map((line, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm leading-relaxed text-gray-800 shadow-sm sm:text-base"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-800">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">{line}</span>
              </li>
            ))}
          </ol>
        </LightSection>

        {/* 区块 3：本轮价值结算 */}
        <LightSection title="本轮你获得了什么" description="以下为本轮交付与实测的核心产出概览。">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {valueItems.map(item => (
              <li key={item.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{item.value}</p>
              </li>
            ))}
          </ul>
        </LightSection>

        {/* 区块 4：AI 搜索可见度评分 */}
        <LightSection title="AI 搜索可见度评分">
          <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 sm:p-6">
            <div className="flex flex-wrap items-end gap-3">
              <p className="text-4xl font-bold tabular-nums text-sky-700 sm:text-5xl">
                {scoreDisplay}
                {visibilityScore != null ? <span className="text-2xl font-semibold text-sky-600"> 分</span> : null}
              </p>
              <span className="mb-1 rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-800">{scoreTier.label}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-gray-700">{scoreTier.description}</p>
            {engineSubtitle ? <p className="mt-2 text-sm text-gray-600">{engineSubtitle}</p> : null}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <LightMetric
              label="品牌提及率"
              value={mentionDisplay}
              hint={mentionRateNarrative(aiTestAggregate.mentionRate, hasAiTestData)}
            />
            <LightMetric
              label="品牌推荐率"
              value={recommendDisplay}
              hint={recommendRateNarrative(aiTestAggregate.recommendRate, hasAiTestData)}
            />
            <LightMetric label="平均排名" value={rankDisplay} />
          </div>
        </LightSection>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-gray-600">
            <Spinner className="size-5 text-blue-600" />
            <p className="text-sm">正在加载报告内容…</p>
          </div>
        ) : (
          <>
            {/* 区块 5：AI 实测证据 */}
            <LightSection title="AI 实测证据" description="以下为分引擎汇总与可核对的关键证据样例。">
              {aiTestAggregate.questionCount === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-5 text-sm text-gray-600">
                  暂无 AI 搜索实测数据。建议先完成一次 AI 实测，以建立可追溯的可见度基线。
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
                      <p className="mt-2 text-sm text-gray-600">暂无分引擎数据</p>
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

                  <Button
                    type="button"
                    variant="ai"
                    disabled={aiTestAggregate.keySamples.length === 0}
                    className="h-11 w-full disabled:opacity-40 sm:w-auto"
                    onClick={scrollToEvidence}
                  >
                    查看原始 AI 回答证据
                  </Button>
                </div>
              )}
            </LightSection>

            {/* 区块 6：发布前后变化 */}
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
                            : "暂无",
                          after: aiTestAggregate.publishCompare.after.hasData
                            ? formatPercentMetric(aiTestAggregate.publishCompare.after.mentionRate)
                            : "暂无",
                          change:
                            aiTestAggregate.publishCompare.before.hasData && aiTestAggregate.publishCompare.after.hasData
                              ? formatDeltaPercent(aiTestAggregate.publishCompare.changes.mentionRateDelta)
                              : "—",
                        },
                        {
                          label: "品牌推荐率",
                          before: aiTestAggregate.publishCompare.before.hasData
                            ? formatPercentMetric(aiTestAggregate.publishCompare.before.recommendRate)
                            : "暂无",
                          after: aiTestAggregate.publishCompare.after.hasData
                            ? formatPercentMetric(aiTestAggregate.publishCompare.after.recommendRate)
                            : "暂无",
                          change:
                            aiTestAggregate.publishCompare.before.hasData && aiTestAggregate.publishCompare.after.hasData
                              ? formatDeltaPercent(aiTestAggregate.publishCompare.changes.recommendRateDelta)
                              : "—",
                        },
                        {
                          label: "平均排名",
                          before: aiTestAggregate.publishCompare.before.hasData
                            ? formatRankMetric(aiTestAggregate.publishCompare.before.averageRank)
                            : "暂无",
                          after: aiTestAggregate.publishCompare.after.hasData
                            ? formatRankMetric(aiTestAggregate.publishCompare.after.averageRank)
                            : "暂无",
                          change:
                            aiTestAggregate.publishCompare.before.hasData && aiTestAggregate.publishCompare.after.hasData
                              ? formatDeltaRank(aiTestAggregate.publishCompare.changes.averageRankDelta)
                              : "—",
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

            {/* 区块 7：竞品对比 */}
            <LightSection
              title="竞品对比"
              description="对比本品牌与主要竞品在 AI 实测中的提及情况，以及竞品公开内容分布。"
            >
              {competitorComparison ? (
                <DeliveryReportCompetitorSection data={competitorComparison} />
              ) : (
                <p className="text-sm text-gray-600" data-testid="delivery-report-competitor-empty">
                  暂无竞品档案。完成品牌建档并补充主要竞品后，可在此查看 AI 实测提及对比与内容分布建议。
                </p>
              )}
            </LightSection>

            {/* 区块 8：本轮新增 AI 搜索资产 */}
            <LightSection title="本轮新增 AI 搜索资产">
              {publishedItems.length === 0 ? (
                <p className="text-sm text-gray-600">本轮暂无发布记录</p>
              ) : (
                <ul className="space-y-3">
                  {publishedItems.map((item, index) => (
                    <li key={`${item.title}-${index}`} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                      <p className="font-medium text-gray-900">{item.title}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                        {item.platform ? (
                          <span className="rounded-full bg-gray-100 px-2.5 py-0.5">{item.platform}</span>
                        ) : null}
                        {item.publishedAt ? <span>发布时间 {item.publishedAt}</span> : null}
                      </div>
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-block min-h-11 break-all text-sm font-medium text-sky-700 underline-offset-2 hover:underline"
                        >
                          查看文章
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </LightSection>

            {/* 区块 9：下一轮优化动作 */}
            <LightSection title="下一轮优化动作">
              {actionLines.length === 0 ? (
                <p className="text-sm text-gray-600">建议完成更多 AI 实测后更新优化动作。</p>
              ) : (
                <ul className="space-y-3">
                  {actionLines.map((line, i) => (
                    <li
                      key={i}
                      className="flex gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm leading-relaxed text-gray-800"
                    >
                      <span className="font-bold text-emerald-700">{i + 1}.</span>
                      <span className="min-w-0 flex-1">{line}</span>
                    </li>
                  ))}
                </ul>
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
