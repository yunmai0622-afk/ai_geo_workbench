import { P0Card, P0Section } from "@/components/geo/P0UiPrimitives";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { trpc } from "@/lib/trpc";
import {
  formatMonthlyReportMaturityChange,
  formatMonthlyReportRateChange,
  MONTHLY_REPORT_PAGE_INTRO,
  MONTHLY_REPORT_PAGE_TITLE,
  type MonthlyReportView,
} from "@shared/monthlyReportView";
import { DELIVERY_REPORT_COMPETITOR_RATE_EXPLANATION } from "@shared/workspaceBrandValueOverview";
import { ArrowRight, ChevronDown, FileBarChart2, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

function formatPercent(rate: number | null): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

function ReportMetric({
  label,
  value,
  testId,
  hint,
}: {
  label: string;
  value: string;
  testId?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" data-testid={testId}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-gray-900">{value}</p>
      {hint ? <p className="mt-2 text-[11px] leading-4 text-gray-500">{hint}</p> : null}
    </div>
  );
}

function MonthlyMaturityReportSections({
  report,
  selectedProjectId,
  onGenerateNextPlan,
  generating,
  onSelectHistoryPlan,
  selectedPlanId,
}: {
  report: MonthlyReportView;
  selectedProjectId: number;
  onGenerateNextPlan: () => void;
  generating: boolean;
  onSelectHistoryPlan: (planId: number) => void;
  selectedPlanId: number | null;
}) {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-8">
      <section className="space-y-4" data-testid="monthly-report-summary">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">第一屏 · 本月成效摘要</h2>
          <p className="text-sm text-gray-500">基于月度计划基线与复测结果的成熟度与 AI 表现变化</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ReportMetric
            label="成熟度变化"
            value={formatMonthlyReportMaturityChange(
              report.summary.maturityBaseline,
              report.summary.maturityResult,
            )}
            testId="monthly-report-maturity-change"
          />
          <ReportMetric
            label="品牌提及率变化"
            value={formatMonthlyReportRateChange(
              report.summary.mentionRateBaseline,
              report.summary.mentionRateResult,
            )}
            testId="monthly-report-mention-change"
          />
          <ReportMetric
            label="AI 推荐率变化"
            value={formatMonthlyReportRateChange(
              report.summary.recommendRateBaseline,
              report.summary.recommendRateResult,
            )}
            testId="monthly-report-recommend-change"
          />
          {report.summary.competitorRateBaseline != null ? (
            <ReportMetric
              label="竞品出现率"
              value={formatMonthlyReportRateChange(
                report.summary.competitorRateBaseline,
                report.summary.competitorRateResult,
              )}
              testId="monthly-report-competitor-rate"
              hint={DELIVERY_REPORT_COMPETITOR_RATE_EXPLANATION}
            />
          ) : null}
        </div>
      </section>

      <section className="space-y-4" data-testid="monthly-report-weaknesses">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">第二屏 · 本月目标与短板</h2>
          <p className="text-sm text-gray-500">
            本月目标：提升 {report.focusSummary || "关键成熟度维度"}
          </p>
        </div>
        {report.weakDimensionChanges.length === 0 ? (
          <P0Card className="text-sm text-gray-500">暂无短板数据，请先生成本月优化计划。</P0Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.weakDimensionChanges.map(item => (
              <li
                key={item.key}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                data-testid={`monthly-report-weakness-${item.key}`}
              >
                <p className="font-medium text-gray-900">{item.label}</p>
                <p className="mt-2 text-sm text-gray-700">
                  {item.baselineScore} 分 → {item.currentScore} 分
                  <span className={item.improved ? " text-emerald-700" : " text-gray-500"}>
                    {item.improved ? "（有改善）" : item.delta === 0 ? "（持平）" : "（待提升）"}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4" data-testid="monthly-report-actions">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">第三屏 · 本月执行动作</h2>
        </div>
        <P0Section title="内容发布">
          <p className="mb-3 text-sm text-gray-600">
            发布了 {report.actions.contentCount} 篇内容，覆盖 {report.actions.questionCoverageCount} 个 AI 搜索问题
          </p>
          {report.actions.contentItems.length === 0 ? (
            <P0Card className="text-sm text-gray-500">本月暂无已发布内容记录。</P0Card>
          ) : (
            <ul className="space-y-2">
              {report.actions.contentItems.map(item => (
                <li
                  key={item.articleId}
                  className="rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm"
                  data-testid={`monthly-report-content-${item.articleId}`}
                >
                  <p className="font-medium text-gray-900">{item.title}</p>
                  <p className="mt-1 text-gray-600">
                    {item.platform}
                    {item.publishedAt ? ` · ${item.publishedAt}` : ""}
                    {item.questionText ? ` · 关联问题：${item.questionText}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </P0Section>
        <P0Section title="信源补充">
          <p className="mb-3 text-sm text-gray-600">新增 {report.actions.sourceCount} 条公开信源</p>
          {report.actions.sourceItems.length === 0 ? (
            <P0Card className="text-sm text-gray-500">本月暂无新增信源。</P0Card>
          ) : (
            <ul className="space-y-2">
              {report.actions.sourceItems.map(item => (
                <li
                  key={item.id}
                  className="rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm"
                  data-testid={`monthly-report-source-${item.id}`}
                >
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="mt-1 text-gray-600">
                    {item.type}
                    {item.adoptedAt ? ` · ${item.adoptedAt}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </P0Section>
        <P0Section title="证据补充">
          <p className="mb-3 text-sm text-gray-600">新增 {report.actions.evidenceCount} 条信任证据</p>
          {report.actions.evidenceItems.length === 0 ? (
            <P0Card className="text-sm text-gray-500">本月暂无新增信任证据。</P0Card>
          ) : (
            <ul className="space-y-2">
              {report.actions.evidenceItems.map(item => (
                <li
                  key={item.id}
                  className="rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm"
                  data-testid={`monthly-report-evidence-${item.id}`}
                >
                  <p className="font-medium text-gray-900">{item.title}</p>
                  <p className="mt-1 text-gray-600">
                    {item.type}
                    {item.addedAt ? ` · ${item.addedAt}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </P0Section>
      </section>

      {report.retest ? (
        <section className="space-y-4" data-testid="monthly-report-retest">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">第四屏 · AI 复测变化</h2>
            <p className="text-sm text-gray-500">
              复测时间：{report.retest.completedAt ? new Date(report.retest.completedAt).toLocaleString("zh-CN") : "—"}
              · 检测 {report.retest.questionCount} 次
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ReportMetric
              label="提及率变化"
              value={formatMonthlyReportRateChange(
                report.retest.mentionRateBaseline,
                report.retest.mentionRateResult,
              )}
            />
            <ReportMetric
              label="推荐率变化"
              value={formatMonthlyReportRateChange(
                report.retest.recommendRateBaseline,
                report.retest.recommendRateResult,
              )}
            />
          </div>
          {report.retest.platformChanges.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {report.retest.platformChanges.map(platform => (
                <li
                  key={platform.platform}
                  className="rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-sm"
                  data-testid={`monthly-report-platform-${platform.platform}`}
                >
                  <p className="font-medium text-gray-900">{platform.platform}</p>
                  <p className="mt-2 text-gray-700">
                    提及率 {formatPercent(platform.baselineMentionRate)} →{" "}
                    {formatPercent(platform.resultMentionRate)}
                  </p>
                  <p className="mt-1 text-gray-700">
                    推荐率 {formatPercent(platform.baselineRecommendRate)} →{" "}
                    {formatPercent(platform.resultRecommendRate)}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-4" data-testid="monthly-report-next-month">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">第五屏 · 下月优化计划</h2>
        </div>
        <P0Card testId="monthly-report-next-month-card">
          {report.nextMonth.weakDimensions.length > 0 ? (
            <p className="text-sm text-gray-700">
              下月重点短板：{report.nextMonth.weakDimensions.join("、")}
            </p>
          ) : (
            <p className="text-sm text-gray-700">完成本月复测后，系统将给出下月重点短板。</p>
          )}
          <ul className="mt-3 space-y-2 text-sm text-gray-700">
            {report.nextMonth.suggestions.map(line => (
              <li key={line} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                {line}
              </li>
            ))}
          </ul>
          <Button
            type="button"
            className={`mt-4 ${geoP0Brand.primary}`}
            data-testid="monthly-report-generate-next-plan"
            disabled={!report.nextMonth.canGenerateNextPlan || generating}
            onClick={onGenerateNextPlan}
          >
            {generating ? (
              <>
                <Spinner className="mr-2 size-4" />
                生成中…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" />
                生成下月优化计划
              </>
            )}
          </Button>
        </P0Card>
      </section>

      {report.history.length > 0 ? (
        <details className="rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="monthly-report-history">
          <summary className="flex cursor-pointer items-center gap-2 px-5 py-4 text-sm font-medium text-gray-800">
            <ChevronDown className="size-4" />
            历史月报（{report.history.length} 轮）
          </summary>
          <ul className="space-y-2 border-t border-gray-100 p-5">
            {report.history.map(item => (
              <li key={item.planId}>
                <button
                  type="button"
                  className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
                    selectedPlanId === item.planId
                      ? "border-blue-300 bg-blue-50 text-blue-900"
                      : "border-gray-100 bg-gray-50 text-gray-800 hover:border-gray-200"
                  }`}
                  data-testid={`monthly-report-history-${item.planId}`}
                  onClick={() => onSelectHistoryPlan(item.planId)}
                >
                  <p className="font-medium">
                    第 {item.roundNumber} 轮 · {item.periodLabel}
                  </p>
                  <p className="mt-1 text-gray-600">{item.summaryLine}</p>
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {report.showExecutingEmpty ? (
        <P0Card testId="monthly-report-executing-empty">
          <p className="text-sm leading-relaxed text-gray-700">{report.executingMessage}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              className={geoP0Brand.primary}
              data-testid="monthly-report-go-tasks"
              onClick={() => setLocation(buildProjectUrl("/monthly-plan", selectedProjectId))}
            >
              去执行本月任务
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="monthly-report-view-progress"
              onClick={() => setLocation(buildProjectUrl("/monthly-plan", selectedProjectId))}
            >
              查看进度
            </Button>
          </div>
        </P0Card>
      ) : null}
    </div>
  );
}

export function DeliveryReportsCenterPage() {
  const [, setLocation] = useLocation();
  const { selectedProjectId, selectedProject, enabled, projectsLoading } = useActiveProjectSelection();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const reportQuery = trpc.geo.monthlyPlan.getReport.useQuery(
    { projectId: selectedProjectId!, planId: selectedPlanId ?? undefined },
    { enabled: enabled && Boolean(selectedProjectId) },
  );

  const generateMutation = trpc.geo.monthlyPlan.generate.useMutation({
    onSuccess: () => {
      void utils.geo.monthlyPlan.getReport.invalidate({ projectId: selectedProjectId! });
      void utils.geo.monthlyPlan.getCurrent.invalidate({ projectId: selectedProjectId! });
    },
  });

  useEffect(() => {
    const name = selectedProject?.enterpriseName?.trim() || "企业";
    document.title = `${name} - ${MONTHLY_REPORT_PAGE_TITLE}`;
  }, [selectedProject?.enterpriseName]);

  if (!selectedProjectId && !projectsLoading) {
    return (
      <div data-testid="delivery-report-page">
        <ProjectContextEmptyState
          title={MONTHLY_REPORT_PAGE_TITLE}
          description="请先选择或创建项目后再查看 AI 品牌成熟度月报。"
        />
      </div>
    );
  }

  const report = reportQuery.data;

  return (
    <div className="space-y-6 pb-12" data-testid="delivery-report-page">
      <header className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <FileBarChart2 className="mt-1 size-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="monthly-report-title">
              {MONTHLY_REPORT_PAGE_TITLE}
            </h1>
            <p className="mt-1 text-sm font-medium text-blue-700" data-testid="monthly-report-subtitle">
              {report?.periodLabel ? `${report.periodLabel} 优化成效报告` : "优化成效报告"}
            </p>
            <p className="mt-3 max-w-3xl text-sm text-gray-600" data-testid="delivery-report-page-intro">
              {MONTHLY_REPORT_PAGE_INTRO}
            </p>
          </div>
        </div>
      </header>

      {reportQuery.isLoading ? (
        <div className="flex items-center gap-2 py-8 text-gray-500">
          <Spinner className="size-5 text-blue-600" />
          正在加载月报数据…
        </div>
      ) : null}

      {reportQuery.isError ? (
        <P0Card className="border-red-200 bg-red-50 text-sm text-red-700">
          月报数据加载失败，请稍后重试。
        </P0Card>
      ) : null}

      {report && report.planPhase === "no_plan" && !reportQuery.isLoading ? (
        <P0Card testId="monthly-report-no-plan">
          <div className="flex items-start gap-3">
            <TrendingUp className="mt-0.5 size-5 text-amber-600" />
            <div>
              <p className="text-sm text-gray-700">
                尚未生成本月优化计划。请先在「本月优化计划」制定计划并执行，完成后将自动生成本月成效报告。
              </p>
              <Button
                type="button"
                className={`mt-4 ${geoP0Brand.primary}`}
                data-testid="delivery-report-empty-cta"
                onClick={() =>
                  selectedProjectId && setLocation(buildProjectUrl("/monthly-plan", selectedProjectId))
                }
              >
                前往本月优化计划
                <ArrowRight className="ml-1.5 size-4" />
              </Button>
            </div>
          </div>
        </P0Card>
      ) : null}

      {report && report.planPhase !== "no_plan" ? (
        <MonthlyMaturityReportSections
          report={report}
          selectedProjectId={selectedProjectId!}
          selectedPlanId={selectedPlanId ?? report.planId}
          generating={generateMutation.isPending}
          onGenerateNextPlan={() => {
            if (!selectedProjectId) return;
            void generateMutation.mutateAsync({ projectId: selectedProjectId });
          }}
          onSelectHistoryPlan={planId => setSelectedPlanId(planId)}
        />
      ) : null}
    </div>
  );
}
