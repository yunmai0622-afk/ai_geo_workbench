import { GeoScoreTrendChart } from "@/components/geo/GeoScoreTrendChart";
import { P0Card, P0MetricTile, P0Section } from "@/components/geo/P0UiPrimitives";
import { RetestComparisonPanel } from "@/components/RetestComparisonPanel";
import { FileText, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import {
  buildDeliveryCoreMetrics,
  buildDeliveryReportMeta,
  computeCitationRateFromItems,
  metricHint,
  NO_PUBLIC_LINK_HINT,
  visibilityScoreDisplay,
} from "@/lib/deliveryReportProductDisplay";
import { mapPublishRecordsToItems, resolveDeliveryReportVisibilityScore } from "@/lib/deliveryReportDisplay";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import { trpc } from "@/lib/trpc";
import { aggregateAiTestEvidence } from "@shared/aiTestEvidence";
import {
  buildDetectionScopeDisplay,
  buildT0BaselineSummary,
  DELIVERY_REPORT_UNCERTAINTY_DISCLAIMER,
} from "@shared/deliveryReportExperimentalDisplay";
import { resolveT0T1ComparisonRows } from "@shared/retestComparisonDisplay";
import { downloadDeliveryReportCsv } from "@/lib/geoDataExportDownload";
import type { DetectionQuestionExportRow } from "@shared/geoDataExport";
import { formatDeliveryReportShareExpiryLabel } from "@shared/deliveryReportPublicShare";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type MonitoringRecordLike = {
  id: number;
  inclusionStatus?: string | null;
  aiTestResults?: unknown[] | null;
  articleTitle?: string | null;
  publishChannel?: string | null;
};

const CONFIRM_DISABLE_CUSTOMER_REPORT_LINK =
  "确定要禁用当前客户报告链接吗？禁用后，客户将无法通过原链接查看报告和证据。";
const CONFIRM_REGENERATE_CUSTOMER_REPORT_LINK =
  "确定要重新生成客户报告链接吗？重新生成后，旧链接将立即失效，请将新链接发送给对应客户。";

export function DeliveryReportsCenterPage() {
  const [, setLocation] = useLocation();
  const reportRef = useRef<HTMLDivElement>(null);
  const { selectedProjectId, selectedProject, projectInput, enabled, projectsLoading } =
    useActiveProjectSelection();

  const createShareLink = trpc.geo.reports.createShareLink.useMutation();
  const disableShareLink = trpc.geo.reports.disableShareLink.useMutation();
  const regenerateShareLink = trpc.geo.reports.regenerateShareLink.useMutation();
  const shareLinkBusy = createShareLink.isPending || disableShareLink.isPending || regenerateShareLink.isPending;

  const scoreQuery = trpc.geo.scores.latest.useQuery(projectInput, { enabled });
  const scoreTrendQuery = trpc.geo.scores.recent.useQuery(projectInput, { enabled });
  const summaryQuery = trpc.geo.assetLibrary.summary.useQuery(projectInput, { enabled });
  const analysisQuery = trpc.geo.analysis.list.useQuery(projectInput, { enabled });
  const tasksQuery = trpc.geo.tasks.list.useQuery(projectInput, { enabled });
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const publishRecordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });
  const monitoringQuery = trpc.geo.articles.inclusionMonitoringRecords.useQuery(projectInput, { enabled });
  const retestQueueQuery = trpc.geo.articles.retestQueue.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const rewritePoolQuery = trpc.geo.articles.rewritePool.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const testRoundsQuery = trpc.geo.testRounds.list.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const retestComparisonsQuery = trpc.geo.retestComparisons.listByProject.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const questionsQuery = trpc.geo.questions.list.useQuery(projectInput, { enabled });

  const scoreTrendPoints = useMemo(
    () =>
      (scoreTrendQuery.data ?? []).map(row => ({
        totalScore: row.totalScore,
        createdAt: row.createdAt,
      })),
    [scoreTrendQuery.data],
  );

  const loading =
    scoreQuery.isLoading ||
    scoreTrendQuery.isLoading ||
    analysisQuery.isLoading ||
    articlesQuery.isLoading ||
    publishRecordsQuery.isLoading ||
    monitoringQuery.isLoading;

  const score = scoreQuery.data as Record<string, unknown> | null | undefined;
  const analyses = (analysisQuery.data ?? []) as Array<Record<string, unknown>>;
  const tasks = (tasksQuery.data ?? []) as Array<Record<string, unknown>>;
  const articles = (articlesQuery.data ?? []) as Array<Record<string, unknown>>;
  const publishRecords = (publishRecordsQuery.data ?? []) as Array<Record<string, unknown>>;
  const monitoringRows = (monitoringQuery.data ?? []) as MonitoringRecordLike[];

  const aiTestAggregate = useMemo(() => {
    return aggregateAiTestEvidence(
      monitoringRows.map(r => ({
        monitoringRecordId: r.id,
        results: r.aiTestResults ?? [],
      })),
    );
  }, [monitoringRows]);

  const citationRate = useMemo(
    () => computeCitationRateFromItems(aiTestAggregate.items ?? []),
    [aiTestAggregate.items],
  );

  const visibilityScore = resolveDeliveryReportVisibilityScore(score);
  const hasAiTestData = aiTestAggregate.questionCount > 0;

  const articleTitleById = useMemo(() => {
    const m = new Map<number, string>();
    for (const a of articles) {
      if (typeof a.id === "number" && a.title) m.set(a.id, String(a.title));
    }
    return m;
  }, [articles]);

  const publishedItems = useMemo(
    () => mapPublishRecordsToItems(publishRecords, articleTitleById),
    [publishRecords, articleTitleById],
  );

  const publishWithLinkCount = publishedItems.filter(i => (i.url ?? "").trim().length > 0).length;

  const firstAnalysis = analyses[0];
  const contentGapPrimary = String(firstAnalysis?.contentGap ?? firstAnalysis?.content_gap ?? "").trim();
  const notRecommendedPrimary = String(
    firstAnalysis?.notRecommendedReason ?? firstAnalysis?.not_recommended_reason ?? "",
  ).trim();
  const maxProblemLine =
    [notRecommendedPrimary, contentGapPrimary].filter(Boolean)[0] ||
    "暂无诊断结论，请先在内容诊断完成一轮诊断。";

  const profile = summaryQuery.data?.profile as Record<string, unknown> | undefined;
  const enterpriseName =
    (typeof profile?.brandName === "string" && profile.brandName.trim()) ||
    selectedProject?.enterpriseName ||
    "当前企业";

  const reportGeneratedAt = (() => {
    const scoreAt = score?.createdAt ?? score?.created_at;
    if (scoreAt) return new Date(scoreAt as string | Date);
    return null;
  })();

  const reportMeta = useMemo(
    () =>
      buildDeliveryReportMeta({
        enterpriseName,
        reportGeneratedAt,
        analysisCount: analyses.length,
        hasAiTestData,
        hasPublishWithLink: publishWithLinkCount > 0,
        visibilityScore,
        mentionRate: aiTestAggregate.mentionRate,
        recommendRate: aiTestAggregate.recommendRate,
        maxProblemLine,
      }),
    [
      enterpriseName,
      reportGeneratedAt,
      analyses.length,
      hasAiTestData,
      publishWithLinkCount,
      visibilityScore,
      aiTestAggregate.mentionRate,
      aiTestAggregate.recommendRate,
      maxProblemLine,
    ],
  );

  const pendingOptimizeCount =
    (retestQueueQuery.data?.items?.length ?? 0) + (rewritePoolQuery.data?.items?.length ?? 0) + tasks.length;

  const coreMetrics = useMemo(
    () =>
      buildDeliveryCoreMetrics({
        aggregate: aiTestAggregate,
        monitoringRows,
        pendingOptimizeCount,
        citationRate,
      }),
    [aiTestAggregate, monitoringRows, pendingOptimizeCount, citationRate],
  );

  const nextSuggestions = useMemo(
    () =>
      buildNextActionLines(
        aiTestAggregate.mentionRate,
        aiTestAggregate.recommendRate,
        publishRecords.length,
        hasAiTestData,
      ),
    [aiTestAggregate.mentionRate, aiTestAggregate.recommendRate, publishRecords.length, hasAiTestData],
  );

  const { baseRound, compareRound, rows: t0t1Rows } = useMemo(() => {
    const comparisons = retestComparisonsQuery.data ?? [];
    const rounds = testRoundsQuery.data ?? [];
    return resolveT0T1ComparisonRows(comparisons, rounds);
  }, [retestComparisonsQuery.data, testRoundsQuery.data]);

  const detectionQuestionRows = useMemo((): DetectionQuestionExportRow[] => {
    const questionRows = (questionsQuery.data ?? []) as Array<Record<string, unknown>>;
    if (questionRows.length > 0) {
      return questionRows.map(q => ({
        questionText: String(q.questionText ?? q.question_text ?? "").trim() || "—",
        questionType: String(q.questionType ?? q.question_type ?? "—"),
        enabled: Number(q.enabled ?? 1) !== 0,
      }));
    }
    const seen = new Set<string>();
    const fromTests: DetectionQuestionExportRow[] = [];
    for (const item of aiTestAggregate.items ?? []) {
      const text = item.question.trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      fromTests.push({ questionText: text, questionType: "实测问题", enabled: true });
    }
    return fromTests;
  }, [questionsQuery.data, aiTestAggregate.items]);

  const projectExportName = selectedProject?.enterpriseName ?? enterpriseName;

  function handleExportDeliveryCsv() {
    if (loading) {
      toast.message("报告数据加载中，请稍后再导出");
      return;
    }
    downloadDeliveryReportCsv({
      projectName: projectExportName,
      detectionQuestions: detectionQuestionRows,
      aggregate: aiTestAggregate,
      t0t1: { baseRound, compareRound, rows: t0t1Rows },
    });
    toast.success("交付报告 CSV 已开始下载");
  }

  const detectionScope = useMemo(
    () =>
      buildDetectionScopeDisplay({
        baseRound,
        compareRound,
        fallbackQuestionCount: aiTestAggregate.questionCount,
        fallbackPlatformCount: aiTestAggregate.engineCount,
      }),
    [baseRound, compareRound, aiTestAggregate.questionCount, aiTestAggregate.engineCount],
  );

  const t0BaselineSummary = useMemo(
    () => buildT0BaselineSummary(testRoundsQuery.data ?? [], retestComparisonsQuery.data ?? []),
    [testRoundsQuery.data, retestComparisonsQuery.data],
  );

  const completedItems = useMemo(() => {
    const lines: string[] = [];
    if (analyses.length > 0) lines.push(`完成 ${analyses.length} 项 AI 内容诊断`);
    if (articles.length > 0) lines.push(`生成 ${articles.length} 篇平台化内容资产`);
    if (publishRecords.length > 0) lines.push(`登记 ${publishRecords.length} 条发布记录（含 ${publishWithLinkCount} 条已回填公开链接）`);
    if (hasAiTestData) lines.push(`完成 ${aiTestAggregate.questionCount} 次 AI 搜索实测（覆盖 ${aiTestAggregate.engineCount} 个引擎）`);
    return lines;
  }, [
    analyses.length,
    articles.length,
    publishRecords.length,
    publishWithLinkCount,
    hasAiTestData,
    aiTestAggregate.questionCount,
    aiTestAggregate.engineCount,
  ]);

  if (!enabled && !projectsLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" data-testid="delivery-report-page">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center max-w-md shadow-sm">
          <FileText className="mx-auto h-10 w-10 text-blue-600" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">交付报告</h2>
          <p className="mt-2 text-sm text-gray-500">请先选择一个企业项目，再查看交付报告。</p>
          <Button className="mt-5 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setLocation("/clients")}>前往企业项目</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12" data-testid="delivery-report-page">
      <Tabs defaultValue="report" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2 print:hidden">
          <TabsTrigger value="report">交付报告</TabsTrigger>
          <TabsTrigger value="comparison" data-testid="retest-comparison-tab">
            检测对比
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comparison" className="mt-0 print:hidden">
          {selectedProjectId ? (
            <RetestComparisonPanel projectId={selectedProjectId} enabled={enabled} />
          ) : null}
        </TabsContent>

        <TabsContent value="report" className="mt-0 space-y-8">
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-gray-500">
          <Spinner className="size-5 text-blue-600" />
          正在加载交付报告数据…
        </div>
      ) : null}

      <div ref={reportRef} className="space-y-8 print:space-y-6">
        <header className="space-y-3" data-testid="delivery-report-hero">
          <h1 className="text-2xl font-bold text-gray-900">{reportMeta.reportTitle}</h1>
          <dl className="grid gap-2 text-sm text-gray-600 sm:grid-cols-3">
            <div>
              <dt className="text-gray-500">报告周期</dt>
              <dd className="font-medium text-gray-800">{reportMeta.reportPeriod}</dd>
            </div>
            <div>
              <dt className="text-gray-500">当前轮次</dt>
              <dd className="font-medium text-gray-800">{reportMeta.reportRound}</dd>
            </div>
            <div>
              <dt className="text-gray-500">AI 搜索可见度评分</dt>
              <dd className="font-medium text-gray-800">{visibilityScoreDisplay(visibilityScore)}</dd>
            </div>
          </dl>
        </header>

        <section className="space-y-4" data-testid="delivery-report-detection-scope">
          <div className="space-y-1">
            <h2 className={geoP0Surfaces.sectionTitle}>本期检测范围</h2>
            <p className={geoP0Surfaces.muted}>基于当前项目已配置的测试问题、AI 平台与检测轮次汇总。</p>
          </div>
          {!detectionScope.hasData ? (
            <P0Card className="text-sm text-gray-500">{metricHint("--")}</P0Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <P0MetricTile label="检测问题数" value={detectionScope.questionCount} />
              <P0MetricTile label="AI 平台数" value={detectionScope.platformCount} />
              <P0MetricTile label="每题检测轮次" value={detectionScope.detectionRounds} />
            </div>
          )}
        </section>

        <section className="space-y-4" data-testid="delivery-report-t0-baseline">
          <div className="space-y-1">
            <h2 className={geoP0Surfaces.sectionTitle}>T0 基线结果摘要</h2>
            <p className={geoP0Surfaces.muted}>T0 基线检测完成后的汇总，用于与 T1 复测对照。</p>
          </div>
          {!t0BaselineSummary.hasData ? (
            <P0Card className="text-sm text-gray-500">暂无 T0 基线数据，请先完成 T0 基线检测。</P0Card>
          ) : (
            <P0Card testId="delivery-report-t0-baseline-card">
              <p className="text-sm text-gray-600">
                {t0BaselineSummary.roundName}
                {t0BaselineSummary.finishedAtLabel !== "—"
                  ? ` · 完成于 ${t0BaselineSummary.finishedAtLabel}`
                  : ""}
              </p>
              <ul className="mt-3 space-y-2 text-sm text-gray-800">
                {t0BaselineSummary.summaryLines.map(line => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </P0Card>
          )}
        </section>

        <P0Card testId="delivery-report-conclusion" className="border-sky-100 bg-sky-50/40">
          <p className={geoP0Surfaces.sectionTitle}>一句话经营结论</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-800">{reportMeta.conclusionLine}</p>
        </P0Card>

        <P0Section title="GEO 分数趋势" description="最近 5 次内容诊断评分变化，便于对照交付周期内的提升。">
          <P0Card testId="delivery-report-score-trend">
            <GeoScoreTrendChart points={scoreTrendPoints} loading={loading} variant="light" />
          </P0Card>
        </P0Section>

        <section data-testid="delivery-report-core-metrics">
          <h2 className={`mb-3 ${geoP0Surfaces.sectionTitle}`}>核心指标</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <P0MetricTile label="品牌提及率" value={coreMetrics.mentionRate} hint={metricHint(coreMetrics.mentionRate)} />
            <P0MetricTile label="AI 推荐率" value={coreMetrics.recommendRate} hint={metricHint(coreMetrics.recommendRate)} />
            <P0MetricTile label="内容引用率" value={coreMetrics.citationRate} hint={metricHint(coreMetrics.citationRate)} />
            <P0MetricTile
              label="收录成功数"
              value={coreMetrics.inclusionSuccessCount}
              hint={metricHint(coreMetrics.inclusionSuccessCount)}
            />
            <P0MetricTile
              label="待优化内容数"
              value={coreMetrics.pendingOptimizeCount}
              hint={metricHint(coreMetrics.pendingOptimizeCount)}
            />
          </div>
        </section>

        <section className="space-y-4" data-testid="delivery-report-t0t1-comparison">
          <div className="space-y-1">
            <h2 className={geoP0Surfaces.sectionTitle}>T0/T1 变化对比</h2>
            <p className={geoP0Surfaces.muted}>复用检测对比面板，展示基线与复测之间的提及频次变化。</p>
          </div>
          {selectedProjectId ? (
            <RetestComparisonPanel projectId={selectedProjectId} enabled={enabled} />
          ) : null}
        </section>

        <P0Card testId="delivery-report-next-actions">
          <p className={geoP0Surfaces.sectionTitle}>下一轮建议</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-700">
            {nextSuggestions.map(line => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </P0Card>

        <div className="flex flex-wrap gap-3 print:hidden" data-testid="delivery-report-actions">
          <Button
            type="button"
            className={geoP0Brand.primary}
            onClick={() => selectedProjectId && setLocation(buildProjectUrl("/weekly", selectedProjectId))}
          >
            生成下一轮内容计划
          </Button>
          <Button
            type="button"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            onClick={() =>
              selectedProjectId && setLocation(buildProjectUrl("/content-publishing", selectedProjectId))
            }
          >
            进入优化池
          </Button>
          <Button
            type="button"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            onClick={() => window.print()}
          >
            导出报告
          </Button>
          <Button
            type="button"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            data-testid="delivery-report-export-csv"
            disabled={loading}
            onClick={handleExportDeliveryCsv}
          >
            导出 CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            data-testid="delivery-report-effective-actions-link"
            onClick={() =>
              selectedProjectId && setLocation(buildProjectUrl("/effective-actions", selectedProjectId))
            }
          >
            有效动作记录
          </Button>
        </div>

        <P0Section title="本轮完成事项" description="基于本项目中已发生的真实业务动作汇总，不含模拟数据。">
          {completedItems.length === 0 ? (
            <P0Card className="text-sm text-gray-500">暂无数据，完成对应步骤后展示。</P0Card>
          ) : (
            <ul className="space-y-2 text-sm text-gray-700">
              {completedItems.map(line => (
                <li key={line} className="rounded-lg border border-gray-100 bg-white px-4 py-3">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </P0Section>

        <P0Section title="AI 平台表现" description="来自收录监测中的 AI 搜索实测结果，按引擎汇总。">
          {!hasAiTestData ? (
            <P0Card className="text-sm text-gray-500">{metricHint("--")}</P0Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {aiTestAggregate.byEngine
                .filter(e => e.questionCount > 0)
                .map(engine => (
                  <li key={engine.engineName} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="font-medium text-gray-900">{engine.engineName}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      实测 {engine.questionCount} 题 · 提及率 {Math.round(engine.mentionRate * 100)}% · 推荐率{" "}
                      {Math.round(engine.recommendRate * 100)}%
                    </p>
                  </li>
                ))}
            </ul>
          )}
        </P0Section>

        <P0Section title="发布内容清单" description="已登记并回填公开链接的发布文章列表。">
          {publishedItems.length === 0 ? (
            <P0Card className="text-sm text-gray-500">暂无发布记录</P0Card>
          ) : (
            <ul className="space-y-3">
              {publishedItems.map((item, index) => (
                <li
                  key={`${item.title}-${item.platform}-${index}`}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <p className="font-medium text-gray-900">{item.title}</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {item.platform}
                    {item.publishedAt ? ` · ${item.publishedAt}` : ""}
                  </p>
                  {(item.url ?? "").trim() ? (
                    <a
                      href={item.url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm text-blue-600 hover:underline break-all"
                    >
                      查看公开链接
                    </a>
                  ) : (
                    <p className="mt-2 text-sm text-amber-800">{NO_PUBLIC_LINK_HINT}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </P0Section>

        <P0Section title="收录与复测结果" description="展示收录状态与复测队列概况，不承诺收录或排名。">
          {monitoringRows.length === 0 ? (
            <P0Card className="text-sm text-gray-500">暂无收录监测记录，请先完成发布并进入收录监测。</P0Card>
          ) : (
            <ul className="space-y-2 text-sm text-gray-700">
              {monitoringRows.slice(0, 8).map(row => (
                <li key={row.id} className="rounded-lg border border-gray-100 bg-white px-4 py-3">
                  {(row.articleTitle ?? "未命名内容").trim()} · {row.publishChannel ?? "—"} · 收录：
                  {(row.inclusionStatus ?? "").trim() || "未检测"}
                </li>
              ))}
              {(retestQueueQuery.data?.items?.length ?? 0) > 0 ? (
                <li className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sky-900">
                  待复测队列 {retestQueueQuery.data!.items!.length} 条，请在发布中心安排复测。
                </li>
              ) : null}
            </ul>
          )}
        </P0Section>

        <P0Section title="当前问题" description="来自最新诊断与待办任务，不含技术字段。">
          <P0Card className="space-y-2 text-sm text-gray-700">
            <p>
              <span className="text-gray-500">优先缺口：</span>
              {maxProblemLine}
            </p>
            {tasks.length > 0 ? (
              <p>
                <span className="text-gray-500">待处理优化任务：</span>
                {tasks.length} 项（含 P0{" "}
                {tasks.filter(t => t.priority === "P0").length} 项）
              </p>
            ) : (
              <p className="text-gray-500">暂无优化任务清单</p>
            )}
          </P0Card>
        </P0Section>

        <P0Section title="下一轮优化建议">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
            {nextSuggestions.map(line => (
              <li key={`next-${line}`}>{line}</li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-gray-500">
            不承诺保证收录、排名或 AI 推荐；报告仅引用已确认事实与实测样本。
          </p>
        </P0Section>

        <P0Card testId="delivery-report-uncertainty" className="border-amber-100 bg-amber-50/60">
          <p className={geoP0Surfaces.sectionTitle}>不确定性说明</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-700">{DELIVERY_REPORT_UNCERTAINTY_DISCLAIMER}</p>
        </P0Card>
      </div>

      {selectedProjectId ? (
        <details className="rounded-xl border border-gray-200 bg-white shadow-sm print:hidden" data-testid="delivery-report-share-fold">
          <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-gray-800">
            客户报告链接（对外分享）
          </summary>
          <div className="flex flex-wrap gap-2 border-t border-gray-100 p-5">
            <Button
              type="button"
              variant="outline"
              className={geoP0Brand.primaryOutline}
              disabled={shareLinkBusy}
              onClick={() => {
                void (async () => {
                  try {
                    const { sharePath } = await createShareLink.mutateAsync({ projectId: selectedProjectId });
                    await navigator.clipboard.writeText(`${window.location.origin}${sharePath}`);
                    toast.success("客户报告链接已复制");
                  } catch {
                    toast.error("复制失败，请稍后重试");
                  }
                })();
              }}
            >
              复制客户报告链接
            </Button>
            <Button
              type="button"
              variant="outline"
              className={geoP0Brand.primaryOutline}
              disabled={shareLinkBusy}
              onClick={() => {
                void (async () => {
                  if (!window.confirm(CONFIRM_REGENERATE_CUSTOMER_REPORT_LINK)) return;
                  try {
                    const { sharePath } = await regenerateShareLink.mutateAsync({ projectId: selectedProjectId });
                    await navigator.clipboard.writeText(`${window.location.origin}${sharePath}`);
                    toast.success("新链接已生成并复制，旧链接已失效");
                  } catch {
                    toast.error("操作失败，请稍后重试");
                  }
                })();
              }}
            >
              重新生成链接
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-amber-200 text-amber-900"
              disabled={shareLinkBusy}
              onClick={() => {
                void (async () => {
                  if (!window.confirm(CONFIRM_DISABLE_CUSTOMER_REPORT_LINK)) return;
                  try {
                    const result = await disableShareLink.mutateAsync({ projectId: selectedProjectId });
                    if (!result.disabled) toast.message("当前暂无可禁用的链接");
                    else toast.success("客户报告链接已禁用");
                  } catch {
                    toast.error("操作失败，请稍后重试");
                  }
                })();
              }}
            >
              禁用链接
            </Button>
          </div>
        </details>
      ) : null}

      <details className="rounded-xl border border-gray-200 bg-gray-100/80 shadow-sm print:hidden" data-testid="delivery-report-internal-fold">
        <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-gray-700">
          内部交付工作区（团队）
        </summary>
        <div className="space-y-4 border-t border-gray-200 p-5 text-sm text-gray-600">
          <p>详细诊断条目、任务卡片与文章表格请在对应业务页查看，避免与客户报告首屏混排。</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => selectedProjectId && setLocation(buildProjectUrl("/ai-diagnosis", selectedProjectId))}
            >
              内容诊断结果
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => selectedProjectId && setLocation(buildProjectUrl("/weekly", selectedProjectId))}
            >
              已生成内容
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                selectedProjectId && setLocation(buildProjectUrl("/inclusion-monitoring", selectedProjectId))
              }
            >
              收录监测
            </Button>
          </div>
        </div>
      </details>
        </TabsContent>
      </Tabs>
    </div>
  );
}
