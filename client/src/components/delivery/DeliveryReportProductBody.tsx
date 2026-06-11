import { Button } from "@/components/ui/button";
import { P0Card, P0Section } from "@/components/geo/P0UiPrimitives";
import { geoP0Brand } from "@/lib/geoP0Visual";
import type {
  DeliveryReportProductSnapshot,
  DeliveryReportViewMode,
} from "@shared/deliveryReportReadability";
import { DELIVERY_REPORT_PAGE_INTRO } from "@/lib/deliveryReportProductDisplay";
import { computeDeliveryDataCompleteness, T0_ONLY_TREND_INSUFFICIENT_MESSAGE } from "@shared/deliveryReportReadability";
import { ArrowLeft, FileDown, Link2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

const NO_PUBLIC_LINK_LABEL = "待回填链接";

type NavigateHandler = (path: string) => void;
type BuildProjectPath = (path: string) => string;

export function DeliveryReportStickyToolbar({
  enterpriseName,
  geoScoreLabel,
  reportStatusLabel,
  dataCompletenessLabel,
  shareLinkBusy,
  loading,
  exportingPdf,
  shareLinkUrl,
  onBack,
  onCopyShareLink,
  onExportPdf,
}: {
  enterpriseName: string;
  geoScoreLabel: string;
  reportStatusLabel: string;
  dataCompletenessLabel?: string;
  shareLinkBusy: boolean;
  loading: boolean;
  exportingPdf: boolean;
  shareLinkUrl: string | null;
  onBack: () => void;
  onCopyShareLink: () => void;
  onExportPdf: () => void;
}) {
  return (
    <div
      className="sticky top-0 z-20 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-sm backdrop-blur print:hidden sm:flex-row sm:items-center sm:justify-between"
      data-testid="delivery-report-sticky-toolbar"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="shrink-0">
          <ArrowLeft className="mr-1 size-4" aria-hidden />
          返回
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{enterpriseName}</p>
          <p className="text-xs text-gray-500">
            GEO 分 {geoScoreLabel} · {reportStatusLabel}
          </p>
          {dataCompletenessLabel ? <p className="text-xs text-gray-500">{dataCompletenessLabel}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className={geoP0Brand.primaryOutline}
          disabled={shareLinkBusy || loading}
          onClick={onCopyShareLink}
        >
          <RefreshCw className="mr-2 size-4" aria-hidden />
          {shareLinkUrl ? "更新报告" : "生成/更新报告"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={geoP0Brand.primaryOutline}
          disabled={shareLinkBusy || loading}
          onClick={onCopyShareLink}
        >
          <Link2 className="mr-2 size-4" aria-hidden />
          复制客户分享链接
        </Button>
        <Button
          type="button"
          variant="ai"
          disabled={loading || exportingPdf}
          data-testid="delivery-report-export-pdf"
          onClick={onExportPdf}
        >
          <FileDown className="mr-2 size-4" aria-hidden />
          {exportingPdf ? "导出中…" : "导出 PDF"}
        </Button>
      </div>
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-gray-900">{value}</p>
    </div>
  );
}

function BossSummarySection({ snapshot }: { snapshot: DeliveryReportProductSnapshot }) {
  const { bossSummary } = snapshot;
  return (
    <P0Card testId="delivery-report-boss-summary" className="border-sky-100 bg-gradient-to-br from-sky-50/80 to-white">
      <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">{bossSummary.title}</h1>
      {bossSummary.insufficientBanner ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
          {bossSummary.insufficientBanner}
        </p>
      ) : null}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryField label="交付周期" value={bossSummary.deliveryPeriod} />
        <SummaryField label="本轮目标" value={bossSummary.roundGoal} />
        <SummaryField label="当前 GEO 分" value={bossSummary.geoScoreLabel} />
        <SummaryField label="品牌提及率" value={bossSummary.mentionRateLabel} />
        <SummaryField label="品牌推荐率" value={bossSummary.recommendRateLabel} />
        <SummaryField label="本轮完成动作" value={bossSummary.completedActions} />
        <SummaryField label="当前核心结论" value={bossSummary.coreConclusion} />
        <SummaryField label="下一步重点" value={bossSummary.nextStepFocus} />
      </div>
    </P0Card>
  );
}

function OutcomeCardsSection({ snapshot }: { snapshot: DeliveryReportProductSnapshot }) {
  return (
    <P0Section title="本轮交付成果" description="从 AI 实测、内容资产、发布执行与复测监测四个维度汇总本轮交付。">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="delivery-report-outcome-cards">
        {snapshot.outcomeCards.map(card => (
          <P0Card key={card.id} className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">{card.title}</h3>
            <dl className="grid grid-cols-2 gap-3">
              {card.metrics.map(metric => (
                <div key={metric.label}>
                  <dt className="text-xs text-gray-500">{metric.label}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900">{metric.value}</dd>
                </div>
              ))}
            </dl>
          </P0Card>
        ))}
      </div>
    </P0Section>
  );
}

function GeoAttributionSection({ snapshot }: { snapshot: DeliveryReportProductSnapshot }) {
  const { geoAttribution } = snapshot;
  return (
    <P0Section title="AI 可见度与 GEO 分归因" description="说明当前 GEO 分的形成原因与优先提升方向。">
      <P0Card testId="delivery-report-geo-attribution" className="space-y-4">
        <p className="text-sm leading-relaxed text-gray-800">{geoAttribution.scoreExplanation}</p>
        {geoAttribution.trendMessage ? (
          <p className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            {geoAttribution.trendMessage === T0_ONLY_TREND_INSUFFICIENT_MESSAGE
              ? T0_ONLY_TREND_INSUFFICIENT_MESSAGE
              : geoAttribution.trendMessage}
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-emerald-700">拉高指标</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-700">
              {geoAttribution.positiveLines.map(line => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-amber-800">拖低指标</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-700">
              {geoAttribution.laggingLines.map(line => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="text-sm text-gray-700">
          <span className="font-medium">下一步优先提升：</span>
          {geoAttribution.nextPriority}
        </p>
      </P0Card>
    </P0Section>
  );
}

function ContentEvidenceSection({
  snapshot,
  mode,
  buildProjectPath,
  onNavigate,
}: {
  snapshot: DeliveryReportProductSnapshot;
  mode: DeliveryReportViewMode;
  buildProjectPath?: BuildProjectPath;
  onNavigate?: NavigateHandler;
}) {
  const rows = snapshot.contentEvidence;
  const isInternal = mode === "internal";

  return (
    <P0Section title="内容与发布证据" description="展示已发布内容与公开链接、质检与复测状态。">
      <P0Card testId="delivery-report-content-evidence" className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <div className="p-5 text-sm leading-relaxed text-gray-600">
            <p className="font-medium text-gray-800">暂无发布内容记录</p>
            <p className="mt-2">原因：尚未登记发布内容。下一步：完成内容生成后在发布页登记发布记录。</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                  <th className="px-4 py-3 font-medium">内容标题</th>
                  <th className="px-4 py-3 font-medium">对应问题</th>
                  <th className="px-4 py-3 font-medium">发布平台</th>
                  <th className="px-4 py-3 font-medium">发布状态</th>
                  <th className="px-4 py-3 font-medium">公开链接</th>
                  <th className="px-4 py-3 font-medium">质检状态</th>
                  <th className="px-4 py-3 font-medium">复测状态</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const hasUrl = row.publicUrl.trim().length > 0;
                  return (
                    <tr key={row.key} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-gray-900">{row.title}</td>
                      <td className="px-4 py-3 text-gray-700">{row.questionText}</td>
                      <td className="px-4 py-3 text-gray-700">{row.platform}</td>
                      <td className="px-4 py-3 text-gray-700">{row.publishStatus}</td>
                      <td className="px-4 py-3">
                        {hasUrl ? (
                          <a
                            href={row.publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all text-sky-700 underline-offset-2 hover:underline"
                          >
                            查看链接
                          </a>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-amber-800">{NO_PUBLIC_LINK_LABEL}</span>
                            <p className="text-xs text-gray-500">原因：发布完成后尚未回填链接</p>
                            {isInternal && buildProjectPath && onNavigate ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-1 h-8"
                                onClick={() => onNavigate(buildProjectPath("/content-publishing"))}
                              >
                                去回填链接
                              </Button>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{row.qualityStatus}</td>
                      <td className="px-4 py-3 text-gray-700">{row.retestStatus}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </P0Card>
    </P0Section>
  );
}

function RetestStagesSection({ snapshot }: { snapshot: DeliveryReportProductSnapshot }) {
  return (
    <P0Section title="AI 复测与收录结果" description="按优化前基线与发布后复测节点展示品牌提及、推荐与引用证据。">
      <div className="space-y-4" data-testid="delivery-report-retest-stages">
        {snapshot.retestStages.map(stage => (
          <P0Card key={stage.stageKey} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900">{stage.stageLabel}</h3>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                {stage.statusLabel}
              </span>
            </div>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-gray-500">是否提及品牌</dt>
                <dd className="mt-0.5 text-gray-800">{stage.brandMentioned}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">是否推荐品牌</dt>
                <dd className="mt-0.5 text-gray-800">{stage.brandRecommended}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">是否引用内容</dt>
                <dd className="mt-0.5 text-gray-800">{stage.contentCited}</dd>
              </div>
            </dl>
            <p className="text-sm leading-relaxed text-gray-700">{stage.evidenceSummary}</p>
            {stage.emptyReason ? (
              <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                {stage.emptyReason}
              </p>
            ) : null}
            {stage.expectedAtLabel ? (
              <p className="text-xs text-gray-500">{stage.expectedAtLabel}</p>
            ) : null}
          </P0Card>
        ))}
      </div>
    </P0Section>
  );
}

function NextRoundPlanSection({ snapshot }: { snapshot: DeliveryReportProductSnapshot }) {
  return (
    <P0Section title="下一轮优化计划" description="基于当前诊断与实测结果，给出 3–5 条可执行建议。">
      <div className="space-y-3" data-testid="delivery-report-next-round-plan">
        {snapshot.nextRoundPlan.map(item => (
          <P0Card key={item.priority} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                P{item.priority}
              </span>
              <p className="text-sm font-semibold text-gray-900">{item.action}</p>
            </div>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-gray-500">对应问题</dt>
                <dd className="mt-0.5 text-gray-700">{item.question}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">推荐平台</dt>
                <dd className="mt-0.5 text-gray-700">{item.platform}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">预期影响</dt>
                <dd className="mt-0.5 text-gray-700">{item.expectedImpact}</dd>
              </div>
            </dl>
          </P0Card>
        ))}
      </div>
    </P0Section>
  );
}

export function DeliveryReportProductBody({
  snapshot,
  mode,
  onNavigate,
  buildProjectPath,
}: {
  snapshot: DeliveryReportProductSnapshot;
  mode: DeliveryReportViewMode;
  onNavigate?: NavigateHandler;
  buildProjectPath?: BuildProjectPath;
}) {
  return (
    <div className="space-y-8">
      <p className="text-sm leading-relaxed text-gray-600" data-testid="delivery-report-page-intro">
        {DELIVERY_REPORT_PAGE_INTRO}
      </p>
      <BossSummarySection snapshot={snapshot} />
      <OutcomeCardsSection snapshot={snapshot} />
      <GeoAttributionSection snapshot={snapshot} />
      <ContentEvidenceSection
        snapshot={snapshot}
        mode={mode}
        buildProjectPath={buildProjectPath}
        onNavigate={onNavigate}
      />
      <RetestStagesSection snapshot={snapshot} />
      <NextRoundPlanSection snapshot={snapshot} />
    </div>
  );
}

export function DeliveryReportInternalChecklist({
  snapshot,
  onNavigate,
  buildProjectPath,
}: {
  snapshot: DeliveryReportProductSnapshot;
  onNavigate: NavigateHandler;
  buildProjectPath: BuildProjectPath;
}) {
  const completeness = computeDeliveryDataCompleteness(
    snapshot.checklist
      .filter(item => item.status === "待完成" && item.blockReason)
      .map(item => item.blockReason as string),
  );
  return (
    <aside
      className="sticky top-24 h-fit rounded-2xl border border-gray-200 bg-white p-4 shadow-sm print:hidden"
      data-testid="delivery-report-internal-checklist"
    >
      <h2 className="text-sm font-semibold text-gray-900">内部交付检查清单</h2>
      <p className="mt-1 text-xs text-gray-500">仅内部可见，客户分享页不展示。</p>
      <p className="mt-2 text-xs text-gray-600" data-testid="delivery-report-data-completeness">
        {completeness.label}
      </p>
      <ul className="mt-4 space-y-3">
        {snapshot.checklist.map(item => (
          <li key={item.id} className="rounded-lg border border-gray-100 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-gray-800">{item.label}</p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  item.status === "已完成"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-900"
                }`}
              >
                {item.status}
              </span>
            </div>
            {item.blockReason ? (
              <p className="mt-2 text-xs leading-relaxed text-gray-600">阻断：{item.blockReason}</p>
            ) : null}
            {item.status === "待完成" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 h-8 w-full"
                onClick={() => onNavigate(buildProjectPath(item.ctaPath))}
              >
                {item.ctaLabel}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function DeliveryReportProductShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}
