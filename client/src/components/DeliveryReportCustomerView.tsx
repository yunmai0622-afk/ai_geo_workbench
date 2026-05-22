import { Button } from "@/components/ui/button";
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
  buildHeroSummaryLine,
  DEFAULT_REPORT_SUGGESTIONS,
  showPublishCompareSection,
  type DeliveryReportPublishedItem,
} from "@/lib/deliveryReportDisplay";
import { useMemo, useRef, type ReactNode } from "react";

export type DeliveryReportCustomerViewProps = {
  brandName: string;
  enterpriseName: string;
  reportGeneratedAt: Date | null;
  conclusionLine: string;
  visibilityScore: number | null;
  publishCount: number;
  aiTestAggregate: AiTestEvidenceAggregate;
  publishedItems?: DeliveryReportPublishedItem[];
  suggestionLines?: string[];
  loading?: boolean;
  showEvidenceLinks?: boolean;
  embedded?: boolean;
  showMonitoringCta?: boolean;
  onNavigateEvidence?: (path: string) => void;
  buildEvidenceLink?: (sample: { monitoringRecordId: number; resultIndex: number }) => string;
  onGoMonitoring?: () => void;
};

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-cyan-200 sm:text-3xl">{value}</p>
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{title}</h2>
      {children}
    </section>
  );
}

export function DeliveryReportCustomerView({
  brandName,
  enterpriseName,
  reportGeneratedAt,
  conclusionLine,
  visibilityScore,
  publishCount,
  aiTestAggregate,
  publishedItems = [],
  suggestionLines,
  loading,
  showEvidenceLinks = true,
  embedded = false,
  showMonitoringCta = false,
  onNavigateEvidence,
  buildEvidenceLink,
  onGoMonitoring,
}: DeliveryReportCustomerViewProps) {
  const evidenceRef = useRef<HTMLDivElement>(null);
  const heroSummary = useMemo(() => buildHeroSummaryLine(conclusionLine, visibilityScore), [conclusionLine, visibilityScore]);
  const hasAiTestData = aiTestAggregate.questionCount > 0;
  const engineSubtitle = useMemo(
    () => buildEngineMentionSubtitle(aiTestAggregate.byEngine, aiTestAggregate.mentionRate, aiTestAggregate.recommendRate),
    [aiTestAggregate.byEngine, aiTestAggregate.mentionRate, aiTestAggregate.recommendRate],
  );
  const showCompare = showPublishCompareSection(aiTestAggregate.publishCompare);
  const suggestions = (suggestionLines?.length ? suggestionLines : [...DEFAULT_REPORT_SUGGESTIONS]).slice(0, 3);
  const scoreDisplay = visibilityScore != null ? String(visibilityScore) : "—";
  const mentionPct = hasAiTestData ? `${Math.round(aiTestAggregate.mentionRate * 100)}%` : "—";
  const recommendPct = hasAiTestData ? `${Math.round(aiTestAggregate.recommendRate * 100)}%` : "—";
  const questionCount = String(aiTestAggregate.questionCount);
  const engineCount = String(aiTestAggregate.engineCount);

  const shellClass = embedded
    ? "space-y-10 overflow-x-hidden text-slate-100"
    : "min-h-screen overflow-x-hidden bg-slate-950 text-slate-100";

  const scrollToEvidence = () => {
    evidenceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={shellClass}>
      <div className={`mx-auto max-w-4xl space-y-10 ${embedded ? "" : "px-4 py-8 pb-16 sm:px-6 sm:py-10"}`}>
        {/* 区块 1：顶部英雄区 */}
        <header className="space-y-6 rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/12 via-slate-950/50 to-slate-950/90 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-wide text-cyan-300/80">GEO 内容效果交付报告</p>
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              {enterpriseName !== brandName ? `${enterpriseName} · ` : ""}
              {reportGeneratedAt ? `报告生成于 ${reportGeneratedAt.toLocaleString()}` : "报告生成时间待更新"}
            </p>
            <p className="text-sm font-medium text-cyan-200/90">AI 搜索可见度评分</p>
            <h1 className="text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl">
              {brandName} 当前在 AI 搜索中的可见度评分：
              <span className="mt-1 block text-4xl font-extrabold tabular-nums text-cyan-300 sm:text-5xl lg:text-6xl">
                {scoreDisplay}
                <span className="text-2xl font-semibold text-cyan-200/80 sm:text-3xl"> 分</span>
              </span>
            </h1>
            <p className="text-base leading-relaxed text-slate-200">{heroSummary}</p>
            <p className="text-sm leading-relaxed text-slate-400">{engineSubtitle}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MetricCard label="品牌提及率" value={mentionPct} />
            <MetricCard label="品牌推荐率" value={recommendPct} />
            <MetricCard label="本轮发布篇数" value={`${publishCount} 篇`} />
            <MetricCard label="实测引擎数" value={`${engineCount} 个`} />
          </div>
        </header>

        {loading ? (
          <p className="text-sm text-slate-400">正在加载报告内容…</p>
        ) : (
          <>
            {/* 区块 2：AI 搜索实测结果 */}
            <ReportSection title="AI 搜索实测结果">
              {aiTestAggregate.questionCount === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-5 text-sm text-slate-400">
                  暂无 AI 搜索实测数据。建议先完成一次 AI 实测，以生成可追溯的品牌可见度结果。
                  {showMonitoringCta && onGoMonitoring ? (
                    <Button className="mt-4 h-11 w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300 sm:w-auto" onClick={onGoMonitoring}>
                      前往收录监测实测
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <MetricCard label="品牌提及率" value={mentionPct} />
                    <MetricCard label="品牌推荐率" value={recommendPct} />
                    <MetricCard label="实测问题数" value={questionCount} />
                  </div>

                  <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">分引擎结果</p>
                    {aiTestAggregate.byEngine.length === 0 ? (
                      <p className="text-sm text-slate-400">暂无分引擎数据</p>
                    ) : (
                      <ul className="divide-y divide-white/5">
                        {aiTestAggregate.byEngine.map(engine => (
                          <li
                            key={engine.engineName}
                            className="flex flex-col gap-2 py-3 text-sm first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span className="font-medium text-white">{engine.engineName}</span>
                            <span className="text-slate-400">
                              提及率 {Math.round(engine.mentionRate * 100)}% · 推荐率 {Math.round(engine.recommendRate * 100)}% · 实测{" "}
                              {engine.questionCount} 题
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      disabled={aiTestAggregate.keySamples.length === 0}
                      className="h-11 w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                      onClick={scrollToEvidence}
                    >
                      查看完整证据
                    </Button>
                    {aiTestAggregate.keySamples.length === 0 ? (
                      <span className="text-sm text-slate-500">暂无证据</span>
                    ) : null}
                  </div>
                </div>
              )}
            </ReportSection>

            {/* 区块 3：发布前后复测对比 */}
            {showCompare ? (
              <ReportSection title="发布前后复测对比">
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <table className="w-full table-fixed border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-slate-950/80 text-xs text-slate-400">
                        <th className="w-[28%] px-3 py-3 font-medium">指标</th>
                        <th className="w-[24%] px-3 py-3 font-medium">发布前</th>
                        <th className="w-[24%] px-3 py-3 font-medium">发布后</th>
                        <th className="w-[24%] px-3 py-3 font-medium">变化</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-200">
                      {[
                        {
                          label: "品牌提及率",
                          before: aiTestAggregate.publishCompare.before.hasData
                            ? formatPercentMetric(aiTestAggregate.publishCompare.before.mentionRate)
                            : "暂无数据",
                          after: aiTestAggregate.publishCompare.after.hasData
                            ? formatPercentMetric(aiTestAggregate.publishCompare.after.mentionRate)
                            : "暂无数据",
                          change:
                            aiTestAggregate.publishCompare.before.hasData && aiTestAggregate.publishCompare.after.hasData
                              ? formatDeltaPercent(aiTestAggregate.publishCompare.changes.mentionRateDelta)
                              : "暂无数据",
                        },
                        {
                          label: "品牌推荐率",
                          before: aiTestAggregate.publishCompare.before.hasData
                            ? formatPercentMetric(aiTestAggregate.publishCompare.before.recommendRate)
                            : "暂无数据",
                          after: aiTestAggregate.publishCompare.after.hasData
                            ? formatPercentMetric(aiTestAggregate.publishCompare.after.recommendRate)
                            : "暂无数据",
                          change:
                            aiTestAggregate.publishCompare.before.hasData && aiTestAggregate.publishCompare.after.hasData
                              ? formatDeltaPercent(aiTestAggregate.publishCompare.changes.recommendRateDelta)
                              : "暂无数据",
                        },
                        {
                          label: "平均排名",
                          before: aiTestAggregate.publishCompare.before.hasData
                            ? formatRankMetric(aiTestAggregate.publishCompare.before.averageRank)
                            : "暂无数据",
                          after: aiTestAggregate.publishCompare.after.hasData
                            ? formatRankMetric(aiTestAggregate.publishCompare.after.averageRank)
                            : "暂无数据",
                          change:
                            aiTestAggregate.publishCompare.before.hasData && aiTestAggregate.publishCompare.after.hasData
                              ? formatDeltaRank(aiTestAggregate.publishCompare.changes.averageRankDelta)
                              : "暂无数据",
                        },
                      ].map(row => (
                        <tr key={row.label} className="border-b border-white/5 last:border-0">
                          <td className="px-3 py-3 font-medium text-slate-300">{row.label}</td>
                          <td className="break-words px-3 py-3">{row.before}</td>
                          <td className="break-words px-3 py-3">{row.after}</td>
                          <td className="break-words px-3 py-3 text-cyan-200">{row.change}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ReportSection>
            ) : null}

            {/* 区块 4：本轮发布内容 */}
            <ReportSection title="本轮发布内容">
              {publishedItems.length === 0 ? (
                <p className="text-sm text-slate-400">本轮暂无发布记录</p>
              ) : (
                <ul className="space-y-3">
                  {publishedItems.map((item, index) => (
                    <li
                      key={`${item.title}-${index}`}
                      className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                    >
                      <p className="font-medium leading-snug text-white">{item.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        {item.platform ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-slate-300">
                            {item.platform}
                          </span>
                        ) : null}
                        {item.publishedAt ? <span>{item.publishedAt}</span> : null}
                      </div>
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-block min-h-11 break-all text-sm font-medium text-cyan-300 underline"
                        >
                          查看文章
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </ReportSection>

            {/* 关键证据样例（查看证据） */}
            {aiTestAggregate.keySamples.length > 0 ? (
              <div ref={evidenceRef} className="space-y-3 scroll-mt-8">
                <h2 className="text-lg font-semibold text-white">关键证据样例</h2>
                <div className="space-y-2">
                  {aiTestAggregate.keySamples.map(sample => (
                    <div
                      key={`${sample.monitoringRecordId}-${sample.resultIndex}`}
                      className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 text-sm text-slate-300">
                        <p className="line-clamp-2 font-medium text-white">{sample.question}</p>
                        <p className="mt-1 text-xs text-slate-500">{sample.engineName}</p>
                      </div>
                      {showEvidenceLinks && onNavigateEvidence ? (
                        <Button
                          size="sm"
                          className="h-11 shrink-0 bg-cyan-400 px-5 text-slate-950 hover:bg-cyan-300"
                          onClick={() =>
                            onNavigateEvidence(
                              buildEvidenceLink
                                ? buildEvidenceLink(sample)
                                : buildEvidenceDetailPath(sample.monitoringRecordId, sample.resultIndex),
                            )
                          }
                        >
                          查看证据
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* 区块 5：下一步建议 */}
            <ReportSection title="下一步建议">
              {suggestions.length === 0 ? (
                <p className="text-sm text-slate-400">暂无明确优化建议，建议完成更多 AI 实测后再生成下一步动作。</p>
              ) : (
                <ul className="space-y-3">
                  {suggestions.map((line, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-300">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-xs font-semibold text-cyan-200">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">{line}</span>
                    </li>
                  ))}
                </ul>
              )}
            </ReportSection>

            <p className="text-[11px] leading-relaxed text-slate-600">
              说明：样本量有限，不代表全网绝对排名；不承诺保证收录、排名或 AI 推荐；对外材料须以已确认事实为准。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
