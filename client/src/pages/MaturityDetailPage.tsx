import { PageAnchorNav } from "@/components/geo/PageAnchorNav";
import { P0Card } from "@/components/geo/P0UiPrimitives";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { useMaturityAutoCalculate } from "@/hooks/useMaturityAutoCalculate";
import { buildProjectUrl } from "@/lib/activeProject";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  buildMaturityDimensionDetailCards,
  buildMaturityNextActionItems,
  buildTopWeaknessHighlights,
  resolveMaturityDimensionStatus,
  resolveMaturityWeakestPrimaryCtaLabel,
  resolveWeakestDimensionAction,
} from "@shared/maturityDetailDisplay";
import { GEO_MATURITY_DIMENSION_META } from "@shared/geoMaturityScoring";
import {
  ArrowRight,
  ChevronDown,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";

const ANCHOR_ITEMS = [
  { id: "maturity-overview", label: "总览" },
  { id: "maturity-dimensions", label: "6 维分析" },
  { id: "maturity-trend", label: "变化历史" },
  { id: "maturity-next-actions", label: "优化建议" },
];

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function statusBadgeClass(status: string): string {
  if (status === "优秀") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "良好") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "待改善") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-gray-200 bg-gray-50 text-gray-600";
}

export default function MaturityDetailPage() {
  const [, setLocation] = useLocation();
  const { selectedProjectId, selectedProject, enabled, projectsLoading } = useActiveProjectSelection();
  const { triggerMaturityCalculate, isCalculating } = useMaturityAutoCalculate(selectedProjectId);

  const reportQuery = trpc.geo.maturity.getMaturityReport.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const latestQuery = trpc.geo.maturity.getLatest.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const historyQuery = trpc.geo.maturity.getHistory.useQuery(
    { projectId: selectedProjectId!, limit: 10 },
    { enabled: enabled && Boolean(selectedProjectId) },
  );

  useEffect(() => {
    const name = selectedProject?.enterpriseName?.trim() || "企业";
    document.title = `${name} - AI 品牌成熟度`;
  }, [selectedProject?.enterpriseName]);

  const report = reportQuery.data;
  const calculationDetail = (latestQuery.data?.calculationDetail as Record<string, unknown> | null) ?? null;
  const dimensionCards = useMemo(
    () => (report ? buildMaturityDimensionDetailCards(report, calculationDetail) : []),
    [report, calculationDetail],
  );
  const nextActions = useMemo(() => (report ? buildMaturityNextActionItems(report) : []), [report]);
  const topWeaknesses = useMemo(
    () => (report ? buildTopWeaknessHighlights(report, calculationDetail, 3) : []),
    [report, calculationDetail],
  );
  const weakestAction = useMemo(
    () => (report ? resolveWeakestDimensionAction(report, calculationDetail) : null),
    [report, calculationDetail],
  );
  const historyRows = historyQuery.data ?? [];

  const handleRecalculate = () => {
    if (!selectedProjectId) return;
    void triggerMaturityCalculate({ silent: false });
  };

  if (!selectedProjectId && !projectsLoading) {
    return (
      <div className="space-y-6" data-testid="maturity-detail-page">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">AI 品牌成熟度</h1>
          <p className="mt-1 text-sm text-gray-500">基于建档、问题池、信源、证据与实测的 6 维综合评估</p>
        </header>
        <ProjectContextEmptyState description="请先选择企业项目后查看 AI 品牌成熟度。" testId="maturity-empty" />
      </div>
    );
  }

  const loading = enabled && (reportQuery.isLoading || latestQuery.isLoading) && !report;

  return (
    <div className="space-y-8 pb-12" data-testid="maturity-detail-page">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI 品牌成熟度</h1>
          <p className="mt-1 text-sm text-gray-500">
            综合建档完整度、问题覆盖、信源图谱、信任证据与 AI 实测表现，评估品牌在 AI 搜索中的可见成熟度。
          </p>
        </div>
        <PageAnchorNav items={ANCHOR_ITEMS} testId="maturity-anchor-nav" />
      </header>

      {loading ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-gray-500">
          <Spinner className="size-6 text-blue-600" />
          <p className="text-sm">正在加载成熟度报告…</p>
        </div>
      ) : (
        <>
          <section id="maturity-overview" className="scroll-mt-24" data-testid="maturity-screen-overview">
            <P0Card
              className="border-2 border-blue-100 bg-gradient-to-br from-blue-50/80 via-white to-white"
              testId="maturity-overview-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-blue-600">成熟度总分</p>
                  <p className="mt-1 text-5xl font-bold tabular-nums text-blue-700" data-testid="maturity-total-score">
                    {isCalculating ? "计算中…" : report ? report.totalScore : "—"}
                  </p>
                  {report ? (
                    <>
                      <p className="mt-3 text-lg font-semibold text-gray-900" data-testid="maturity-stage">
                        {report.stage}
                      </p>
                      <p className="mt-1 max-w-xl text-sm text-gray-600">{report.stageDesc}</p>
                      <p className="mt-3 text-xs text-gray-500" data-testid="maturity-calculated-at">
                        最近计算：{formatDateTime(report.calculatedAt)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-gray-500">完成建档或点击「重新计算」生成首次成熟度评分</p>
                  )}
                </div>
                <Button
                  type="button"
                  className={cn("rounded-xl", geoP0Brand.primary)}
                  disabled={!selectedProjectId || isCalculating}
                  data-testid="maturity-recalculate"
                  onClick={handleRecalculate}
                >
                  <RefreshCw className="mr-1.5 size-4" />
                  {isCalculating ? "计算中…" : "重新计算成熟度"}
                </Button>
              </div>

              {report && topWeaknesses.length > 0 ? (
                <div className="mt-6" data-testid="maturity-top-weaknesses">
                  <h2 className="text-sm font-semibold text-gray-900">最影响推荐的 3 个短板</h2>
                  <p className="mt-1 text-xs text-gray-500">按分数从低到高排序，优先补齐最弱项可更快提升 AI 推荐表现</p>
                  <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white">
                    {topWeaknesses.map((item, index) => (
                      <li
                        key={item.key}
                        className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
                        data-testid={`maturity-top-weakness-${item.key}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            <span className="mr-2 text-xs font-semibold text-amber-600">#{index + 1}</span>
                            {item.label}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-600">{item.conclusion}</p>
                        </div>
                        <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-amber-800">
                          {item.score} 分
                        </span>
                      </li>
                    ))}
                  </ul>
                  {weakestAction && selectedProjectId ? (
                    <Button
                      type="button"
                      className={cn("mt-4 rounded-xl", geoP0Brand.primary)}
                      data-testid="maturity-weakest-cta"
                      onClick={() => setLocation(buildProjectUrl(weakestAction.path, selectedProjectId))}
                    >
                      {resolveMaturityWeakestPrimaryCtaLabel(weakestAction.key)}
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </P0Card>
          </section>

          <section id="maturity-dimensions" className="scroll-mt-24 space-y-4" data-testid="maturity-screen-dimensions">
            <h2 className="text-lg font-semibold text-gray-900">6 维详细分析</h2>
            {!report ? (
              <p className="text-sm text-gray-500">暂无维度分析，请先完成建档并触发成熟度计算。</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {dimensionCards.map(card => (
                  <div
                    key={card.key}
                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                    data-testid={`maturity-dimension-card-${card.key}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{card.label}</h3>
                        <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
                          {card.score}
                          <span className="text-base font-normal text-gray-400"> / {card.maxScore}</span>
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          statusBadgeClass(card.status),
                        )}
                      >
                        {card.status}
                      </span>
                    </div>
                    <p
                      className="mt-3 text-sm font-medium text-gray-800"
                      data-testid={`maturity-dimension-conclusion-${card.key}`}
                    >
                      {card.conclusion}
                    </p>
                    <div className="mt-4 space-y-2 text-sm">
                      <p className="font-medium text-gray-700">主要缺口</p>
                      <ul className="list-inside list-disc text-gray-600">
                        {card.gaps.map(gap => (
                          <li key={gap}>{gap}</li>
                        ))}
                      </ul>
                      <p className="font-medium text-gray-700">建议动作</p>
                      <p className="text-gray-600">{card.action}</p>
                    </div>
                    {selectedProjectId ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        data-testid={`maturity-dimension-cta-${card.key}`}
                        onClick={() => setLocation(buildProjectUrl(card.path, selectedProjectId))}
                      >
                        {card.ctaLabel}
                        <ArrowRight className="ml-1 size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section id="maturity-trend" className="scroll-mt-24" data-testid="maturity-screen-trend">
            <details className="group rounded-2xl border border-gray-200 bg-white shadow-sm" data-testid="maturity-trend-details">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2">
                  <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
                  <TrendingUp className="size-4 text-blue-600" />
                  成熟度变化历史
                </span>
              </summary>
              <div className="border-t border-gray-100 px-5 pb-5 pt-4">
                {historyRows.length <= 1 ? (
                  <div
                    className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-6 text-sm text-gray-600"
                    data-testid="maturity-trend-empty"
                  >
                    首次计算成熟度后，这里会显示变化历史。
                    <br />
                    每次完成内容发布或 AI 复测后建议重新计算。
                  </div>
                ) : (
                  <div className="space-y-4" data-testid="maturity-trend-timeline">
                    {[...historyRows].reverse().map((row, index, arr) => {
                      const prev = index > 0 ? arr[index - 1] : null;
                      const delta = prev ? row.totalScore - prev.totalScore : null;
                      return (
                        <div
                          key={row.id}
                          className="relative rounded-xl border border-gray-200 bg-white p-4 pl-8 shadow-sm"
                          data-testid={`maturity-trend-item-${row.id}`}
                        >
                          <span className="absolute left-3 top-5 h-2.5 w-2.5 rounded-full bg-blue-500" />
                          <p className="text-xs text-gray-500">{formatDateTime(row.calculatedAt)}</p>
                          <p className="mt-1 text-xl font-bold tabular-nums text-gray-900">
                            总分 {row.totalScore}
                            {delta != null ? (
                              <span
                                className={cn(
                                  "ml-2 text-sm font-medium",
                                  delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-gray-500",
                                )}
                              >
                                {delta > 0 ? `+${delta}` : delta}
                              </span>
                            ) : null}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {GEO_MATURITY_DIMENSION_META.map(meta => {
                              const field = meta.field;
                              const score = (row[field] as number | null) ?? 0;
                              return (
                                <span
                                  key={meta.key}
                                  className="rounded-md border border-gray-100 bg-gray-50 px-2 py-1 text-xs text-gray-600"
                                >
                                  {meta.label} {score}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </details>
          </section>

          <section id="maturity-next-actions" className="scroll-mt-24 space-y-4" data-testid="maturity-screen-next-actions">
            <h2 className="text-lg font-semibold text-gray-900">下一步优化建议</h2>
            {!report || nextActions.length === 0 ? (
              <p className="text-sm text-gray-500">完成首次成熟度计算后，将展示 3 条优先优化建议。</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {nextActions.map((action, index) => (
                  <div
                    key={action.dimensionKey}
                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                    data-testid={`maturity-next-action-${index}`}
                  >
                    <p className="text-xs font-medium text-blue-600">优先建议 {index + 1}</p>
                    <h3 className="mt-2 font-semibold text-gray-900">{action.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600">{action.description}</p>
                    {selectedProjectId ? (
                      <Button
                        type="button"
                        size="sm"
                        className={`mt-4 ${geoP0Brand.primary}`}
                        data-testid={`maturity-next-action-cta-${index}`}
                        onClick={() => setLocation(buildProjectUrl(action.path, selectedProjectId))}
                      >
                        {action.ctaLabel}
                        <ArrowRight className="ml-1.5 size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

    </div>
  );
}
