import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildEvidenceDetailPath,
  formatCountMetric,
  formatDeltaCount,
  formatDeltaPercent,
  formatDeltaRank,
  formatPercentMetric,
  formatRankMetric,
  sentimentLabelCn,
  type AiTestEvidenceAggregate,
} from "@shared/aiTestEvidence";

export type DeliveryReportCustomerViewProps = {
  brandName: string;
  enterpriseName: string;
  reportGeneratedAt: Date | null;
  conclusionLine: string;
  aiTestAggregate: AiTestEvidenceAggregate;
  loading?: boolean;
  showEvidenceLinks?: boolean;
  onNavigateEvidence?: (path: string) => void;
  buildEvidenceLink?: (sample: { monitoringRecordId: number; resultIndex: number }) => string;
};

export function DeliveryReportCustomerView({
  brandName,
  enterpriseName,
  reportGeneratedAt,
  conclusionLine,
  aiTestAggregate,
  loading,
  showEvidenceLinks = true,
  onNavigateEvidence,
  buildEvidenceLink,
}: DeliveryReportCustomerViewProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 pb-16 sm:px-6">
        <header className="space-y-4 border-b border-white/10 pb-6">
          <p className="text-xs uppercase tracking-wide text-cyan-300/80">GEO 内容效果交付报告</p>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{brandName} · AI 搜索增长实测报告</h1>
          <div className="grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
            <p>
              <span className="text-slate-500">企业名称：</span>
              {enterpriseName}
            </p>
            <p>
              <span className="text-slate-500">报告生成时间：</span>
              {reportGeneratedAt ? reportGeneratedAt.toLocaleString() : "待生成（完成诊断与实测后更新）"}
            </p>
          </div>
        </header>

        {loading ? (
          <p className="text-sm text-slate-400">正在加载报告内容…</p>
        ) : (
          <>
            <Card className="border-cyan-400/25 bg-gradient-to-br from-cyan-500/10 via-slate-950/40 to-slate-950/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl text-white">GEO 总体结论</CardTitle>
                <CardDescription className="text-cyan-100/90">基于内容评分与 AI 搜索实测的综合判断</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-base leading-relaxed text-slate-100">{conclusionLine}</p>
              </CardContent>
            </Card>

            <section className="space-y-4">
              <h2 className="border-b border-white/10 pb-2 text-lg font-semibold text-white">AI 搜索实测结果</h2>
              <p className="text-sm leading-relaxed text-slate-400">
                以下为主流 AI 搜索引擎的真实提问测试结果，用于判断品牌在 AI 回答中的出现频率、推荐情况与竞品对比。
                {showEvidenceLinks ? "每条样例均可查看完整证据以便复查。" : ""}
              </p>
              {aiTestAggregate.questionCount === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 bg-slate-950/40 p-6 text-sm text-slate-400">
                  暂无 AI 搜索实测数据。建议先完成一次 AI 实测，以生成可追溯的品牌可见度结果。
                  <p className="mt-3 text-xs text-slate-500">建议完成发布前测试和发布后复测后查看完整对比。</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { label: "实测问题数", value: String(aiTestAggregate.questionCount) },
                      { label: "覆盖 AI 引擎数", value: String(aiTestAggregate.engineCount) },
                      { label: "品牌提及率", value: `${Math.round(aiTestAggregate.mentionRate * 100)}%` },
                      { label: "品牌推荐率", value: `${Math.round(aiTestAggregate.recommendRate * 100)}%` },
                      { label: "平均排名", value: aiTestAggregate.averageRank != null ? String(Math.round(aiTestAggregate.averageRank * 10) / 10) : "—" },
                      {
                        label: "情感占比",
                        value: `正 ${aiTestAggregate.sentimentCounts.positive} / 中 ${aiTestAggregate.sentimentCounts.neutral} / 负 ${aiTestAggregate.sentimentCounts.negative}`,
                      },
                      { label: "竞品提及", value: String(aiTestAggregate.competitorMentionCount) },
                      { label: "引用来源数量", value: String(aiTestAggregate.citedUrlCount) },
                    ].map(item => (
                      <div key={item.label} className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3">
                        <p className="text-[11px] text-slate-500">{item.label}</p>
                        <p className="mt-1 text-lg font-semibold text-cyan-200">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/40 p-5">
                    <h3 className="text-base font-semibold text-white">发布前后复测对比</h3>
                    <p className="text-sm leading-relaxed text-slate-400">
                      对比同一条监测记录在内容发布前后的 AI 搜索表现变化，关注品牌提及率、推荐率与平均排名的变化。
                    </p>
                    {!aiTestAggregate.publishCompare.before.hasData || !aiTestAggregate.publishCompare.after.hasData ? (
                      <p className="text-sm leading-relaxed text-slate-400">
                        暂无完整的发布前后对比数据。请分别完成发布前测试与发布后复测，系统将自动生成对比指标。
                      </p>
                    ) : null}
                    {aiTestAggregate.publishCompare.hasAnyStageData ? (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                          <thead>
                            <tr className="border-b border-white/10 text-xs text-slate-400">
                              <th className="py-2 pr-4 font-medium">指标</th>
                              <th className="py-2 pr-4 font-medium">发布前</th>
                              <th className="py-2 pr-4 font-medium">发布后</th>
                              <th className="py-2 font-medium">变化</th>
                            </tr>
                          </thead>
                          <tbody className="text-slate-200">
                            {[
                              {
                                label: "实测问题数",
                                before: formatCountMetric(
                                  aiTestAggregate.publishCompare.before.hasData ? aiTestAggregate.publishCompare.before.questionCount : null,
                                ),
                                after: formatCountMetric(
                                  aiTestAggregate.publishCompare.after.hasData ? aiTestAggregate.publishCompare.after.questionCount : null,
                                ),
                                change: formatDeltaCount(
                                  aiTestAggregate.publishCompare.before.hasData && aiTestAggregate.publishCompare.after.hasData
                                    ? aiTestAggregate.publishCompare.after.questionCount - aiTestAggregate.publishCompare.before.questionCount
                                    : null,
                                ),
                              },
                              {
                                label: "品牌提及率",
                                before: formatPercentMetric(aiTestAggregate.publishCompare.before.mentionRate),
                                after: formatPercentMetric(aiTestAggregate.publishCompare.after.mentionRate),
                                change: formatDeltaPercent(aiTestAggregate.publishCompare.changes.mentionRateDelta),
                              },
                              {
                                label: "品牌推荐率",
                                before: formatPercentMetric(aiTestAggregate.publishCompare.before.recommendRate),
                                after: formatPercentMetric(aiTestAggregate.publishCompare.after.recommendRate),
                                change: formatDeltaPercent(aiTestAggregate.publishCompare.changes.recommendRateDelta),
                              },
                              {
                                label: "平均排名",
                                before: formatRankMetric(aiTestAggregate.publishCompare.before.averageRank),
                                after: formatRankMetric(aiTestAggregate.publishCompare.after.averageRank),
                                change: formatDeltaRank(aiTestAggregate.publishCompare.changes.averageRankDelta),
                              },
                              {
                                label: "引用来源数量",
                                before: formatCountMetric(
                                  aiTestAggregate.publishCompare.before.hasData ? aiTestAggregate.publishCompare.before.citedUrlCount : null,
                                ),
                                after: formatCountMetric(
                                  aiTestAggregate.publishCompare.after.hasData ? aiTestAggregate.publishCompare.after.citedUrlCount : null,
                                ),
                                change: formatDeltaCount(aiTestAggregate.publishCompare.changes.citedUrlCountDelta),
                              },
                            ].map(row => (
                              <tr key={row.label} className="border-b border-white/5">
                                <td className="py-3 pr-4 font-medium text-slate-300">{row.label}</td>
                                <td className="py-3 pr-4">{row.before}</td>
                                <td className="py-3 pr-4">{row.after}</td>
                                <td className="py-3 text-cyan-200">{row.change}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-200">分引擎结果</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      {aiTestAggregate.byEngine.map(engine => (
                        <Card key={engine.engineName} className="border-white/10 bg-white/[0.04]">
                          <CardContent className="space-y-2 pt-4 text-sm text-slate-300">
                            <p className="font-semibold text-white">{engine.engineName}</p>
                            <p>测试问题数量：{engine.questionCount}</p>
                            <p>品牌提及率：{Math.round(engine.mentionRate * 100)}%</p>
                            <p>品牌推荐率：{Math.round(engine.recommendRate * 100)}%</p>
                            <p>情感倾向：{sentimentLabelCn(engine.dominantSentiment)}</p>
                            <p>最近测试时间：{engine.lastTestedAt ? new Date(engine.lastTestedAt).toLocaleString() : "—"}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-200">关键证据样例</h3>
                    <div className="space-y-2">
                      {aiTestAggregate.keySamples.map(sample => (
                        <div
                          key={`${sample.monitoringRecordId}-${sample.resultIndex}`}
                          className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 text-sm text-slate-300">
                            <p className="line-clamp-1 font-medium text-white">{sample.question}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {sample.engineName} · 提及 {sample.mentionedBrand ? "是" : "否"} · 推荐 {sample.recommendedBrand ? "是" : "否"} ·{" "}
                              {sentimentLabelCn(sample.sentiment)}
                            </p>
                          </div>
                          {showEvidenceLinks && onNavigateEvidence ? (
                            <Button
                              size="sm"
                              className="shrink-0 bg-cyan-400 text-slate-950 hover:bg-cyan-300"
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
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="border-b border-white/10 pb-2 text-lg font-semibold text-white">下一步优化建议</h2>
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-300">
                <li>根据本轮 AI 搜索实测，优先补齐品牌在典型问答场景中的可引用内容与结构化表达。</li>
                <li>对已发布内容保持监测，在内容稳定收录后安排发布前与发布后复测，观察提及率与推荐率变化。</li>
                <li>若竞品在 AI 回答中占位上升，及时更新品牌叙事与对比材料，并在下一轮实测中验证效果。</li>
              </ol>
            </section>

            <p className="text-[11px] leading-relaxed text-slate-600">
              说明：样本量有限，不代表全网绝对排名；不承诺保证收录、排名或 AI 推荐；对外材料须以已确认事实为准；发布结果以平台审核与人工确认为准。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
