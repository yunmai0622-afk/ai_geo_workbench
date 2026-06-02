import { DeliveryReportCompetitorSection } from "@/components/DeliveryReportCompetitorSection";
import { DeliveryReportShareRenewalReminderCard } from "@/components/delivery/DeliveryReportShareRenewalReminderCard";
import { GeoGrowthSuggestionsPanel } from "@/components/geo/GeoGrowthSuggestionsPanel";
import { GeoScoreTrendChart } from "@/components/geo/GeoScoreTrendChart";
import { GeoHealthBriefCard, type GeoHealthBriefCardProps } from "@/components/delivery/GeoHealthBriefCard";
import type { PublishRecordWeekRow } from "@shared/geoHealthBrief";
import { P0Card, P0MetricTile, P0Section } from "@/components/geo/P0UiPrimitives";
import { RetestComparisonPanel } from "@/components/RetestComparisonPanel";
import { Copy, FileText, Link2, QrCode } from "lucide-react";
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
import {
  buildNextActionLines,
  mapPublishRecordsToItems,
  resolveDeliveryReportVisibilityScore,
} from "@/lib/deliveryReportDisplay";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import { trpc } from "@/lib/trpc";
import { aggregateAiTestEvidence } from "@shared/aiTestEvidence";
import {
  buildDetectionScopeDisplay,
  buildT0BaselineSummary,
  DELIVERY_REPORT_UNCERTAINTY_DISCLAIMER,
} from "@shared/deliveryReportExperimentalDisplay";
import {
  buildGeoGrowthSuggestions,
  countDistinctPublishPlatforms,
  countUnpublishedArticles,
  findLatestT0FinishedAt,
} from "@shared/geoGrowthSuggestions";
import { hasCompletedT0Baseline, hasCompletedT1Retest } from "@shared/workspaceMainChain";
import { resolveT0T1ComparisonRows } from "@shared/retestComparisonDisplay";
import { downloadDeliveryReportCsv } from "@/lib/geoDataExportDownload";
import { downloadDeliveryReportPdf } from "@/lib/deliveryReportPdfExport";
import type { DetectionQuestionExportRow } from "@shared/geoDataExport";
import {
  formatPlatformDistributionLine,
  formatPublishSuccessRatePercent,
} from "@shared/deliveryReportPublishStats";
import {
  formatContentQualityPlatformDistributionLine,
  type DeliveryReportContentQualityFailedItem,
  type DeliveryReportContentQualityPriorityItem,
} from "@shared/deliveryReportContentQuality";
import { mapCompetitorAnalysisForDeliveryReport } from "@shared/deliveryReportCompetitor";
import { formatDeliveryReportShareExpiryLabel, resolveDeliveryReportShareRenewalReminder } from "@shared/deliveryReportPublicShare";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type MonitoringRecordLike = {
  id: number;
  articleId?: number | null;
  inclusionStatus?: string | null;
  aiTestResults?: unknown[] | null;
  articleTitle?: string | null;
  publishChannel?: string | null;
  lastAiTestedAt?: string | null;
};

type EngineReportRow = {
  label: string;
  status: "已实测" | "增强目标" | "未接入";
  mentionRate: number | null;
  recommendRate: number | null;
  testedQuestions: number;
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
  const renewShareLink = trpc.geo.reports.renewShareLink.useMutation();
  const shareLinkStatusQuery = trpc.geo.reports.shareLinkStatus.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const shareLinkBusy =
    createShareLink.isPending ||
    disableShareLink.isPending ||
    regenerateShareLink.isPending ||
    renewShareLink.isPending;
  const [shareExpiresAtHint, setShareExpiresAtHint] = useState<string | null>(null);
  const [sharePathHint, setSharePathHint] = useState<string | null>(null);
  const [showShareQrCode, setShowShareQrCode] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    setShareExpiresAtHint(null);
    setSharePathHint(null);
    setShowShareQrCode(false);
  }, [selectedProjectId]);

  const shareLinkUrl = useMemo(() => {
    const sharePath = sharePathHint ?? shareLinkStatusQuery.data?.sharePath ?? null;
    if (!sharePath) return null;
    return `${window.location.origin}${sharePath}`;
  }, [sharePathHint, shareLinkStatusQuery.data?.sharePath]);

  const shareExpiryDisplay = useMemo(() => {
    if (!shareExpiresAtHint && !shareLinkStatusQuery.data?.hasActiveLink) return null;
    const iso = shareExpiresAtHint ?? shareLinkStatusQuery.data?.shareExpiresAt ?? null;
    return formatDeliveryReportShareExpiryLabel(iso);
  }, [shareExpiresAtHint, shareLinkStatusQuery.data]);

  const shareRenewalReminder = useMemo(() => {
    if (!shareLinkStatusQuery.data?.hasActiveLink) return null;
    const iso = shareExpiresAtHint ?? shareLinkStatusQuery.data?.shareExpiresAt ?? null;
    return resolveDeliveryReportShareRenewalReminder(iso);
  }, [shareExpiresAtHint, shareLinkStatusQuery.data]);

  async function renewCustomerShareLink(projectId: number) {
    try {
      const { shareExpiresAt } = await renewShareLink.mutateAsync({ projectId });
      setShareExpiresAtHint(shareExpiresAt);
      void shareLinkStatusQuery.refetch();
      const expiryHint = shareExpiresAt ? formatDeliveryReportShareExpiryLabel(shareExpiresAt) : "链接长期有效";
      toast.success(`链接已续期（${expiryHint}），客户仍可使用原链接访问`);
    } catch {
      toast.error("续期失败，请稍后重试");
    }
  }

  async function copyCustomerShareLink(projectId: number) {
    try {
      const { sharePath, shareExpiresAt } = await createShareLink.mutateAsync({ projectId });
      setSharePathHint(sharePath);
      setShareExpiresAtHint(shareExpiresAt);
      void shareLinkStatusQuery.refetch();
      const expiryHint = shareExpiresAt ? formatDeliveryReportShareExpiryLabel(shareExpiresAt) : "链接长期有效";
      toast.success(`客户报告链接已生成（${expiryHint}）`);
    } catch {
      toast.error("生成失败，请稍后重试");
    }
  }

  async function handleCopyShareLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("客户报告链接已复制");
    } catch {
      toast.error("复制失败，请稍后重试");
    }
  }

  const scoreQuery = trpc.geo.scores.latest.useQuery(projectInput, { enabled });
  const scoreTrendQuery = trpc.geo.scores.recent.useQuery(projectInput, { enabled });
  const t0MetricsQuery = trpc.geo.scores.t0Metrics.useQuery(projectInput, { enabled });
  const summaryQuery = trpc.geo.assetLibrary.summary.useQuery(projectInput, { enabled });
  const analysisQuery = trpc.geo.analysis.list.useQuery(projectInput, { enabled });
  const tasksQuery = trpc.geo.tasks.list.useQuery(projectInput, { enabled });
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const publishRecordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });
  const publishStatsQuery = trpc.publishTasks.projectStats.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const contentQualityQuery = trpc.geo.reports.contentQualitySummary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
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
  const competitorSummaryQuery = trpc.geo.assetLibrary.competitorAnalysisSummary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );

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
    publishStatsQuery.isLoading ||
    contentQualityQuery.isLoading ||
    monitoringQuery.isLoading ||
    competitorSummaryQuery.isLoading;

  const score = scoreQuery.data as Record<string, unknown> | null | undefined;
  const analyses = (analysisQuery.data ?? []) as Array<Record<string, unknown>>;
  const tasks = (tasksQuery.data ?? []) as Array<Record<string, unknown>>;
  const articles = (articlesQuery.data ?? []) as Array<Record<string, unknown>>;
  const publishRecords = (publishRecordsQuery.data ?? []) as Array<Record<string, unknown>>;
  const monitoringRows = (monitoringQuery.data ?? []).filter(
    r => r != null && typeof r?.id === "number",
  ) as MonitoringRecordLike[];

  const aiTestAggregate = useMemo(() => {
    return aggregateAiTestEvidence(
      monitoringRows.map(r => ({
        monitoringRecordId: r?.id,
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
      if (typeof a?.id === "number" && a.title) m.set(a?.id, String(a.title));
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

  const growthSuggestions = useMemo(() => {
    const rounds = testRoundsQuery.data ?? [];
    const mentionRate = hasAiTestData ? aiTestAggregate.mentionRate : null;
    const recommendRate = hasAiTestData ? aiTestAggregate.recommendRate : null;
    return buildGeoGrowthSuggestions({
      mentionRate,
      recommendRate,
      distinctPublishPlatformCount: countDistinctPublishPlatforms(
        publishRecords as Array<{ publishChannel?: string | null }>,
      ),
      unpublishedArticleCount: countUnpublishedArticles(
        articles as Array<{ status?: string | null }>,
      ),
      hasCompletedT0Baseline: hasCompletedT0Baseline(rounds),
      hasCompletedT1Retest: hasCompletedT1Retest(rounds),
      t0FinishedAt: findLatestT0FinishedAt(rounds),
    });
  }, [
    testRoundsQuery.data,
    hasAiTestData,
    aiTestAggregate.mentionRate,
    aiTestAggregate.recommendRate,
    publishRecords,
    articles,
  ]);

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

  async function handleExportDeliveryPdf() {
    if (loading) {
      toast.message("报告数据加载中，请稍后再导出");
      return;
    }
    const target = reportRef.current;
    if (!target) {
      toast.error("未找到报告内容，请刷新页面后重试");
      return;
    }
    setExportingPdf(true);
    try {
      await downloadDeliveryReportPdf(target, projectExportName);
      toast.success("交付报告 PDF 已开始下载");
    } catch {
      toast.error("PDF 导出失败，请稍后重试");
    } finally {
      setExportingPdf(false);
    }
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

  const competitorComparison = useMemo(() => {
    const summary = competitorSummaryQuery.data;
    if (!summary || summary.competitors.length === 0) return null;
    return mapCompetitorAnalysisForDeliveryReport(summary);
  }, [competitorSummaryQuery.data]);

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

  const initialGeoScore = scoreTrendPoints.length > 0 ? scoreTrendPoints[0]?.totalScore ?? null : null;
  const currentGeoScore = scoreTrendPoints.length > 0 ? scoreTrendPoints[scoreTrendPoints.length - 1]?.totalScore ?? null : null;
  const geoScoreDelta =
    initialGeoScore != null && currentGeoScore != null ? currentGeoScore - initialGeoScore : null;
  const mentionRateDelta =
    t0MetricsQuery.data?.mentionRate != null && hasAiTestData
      ? aiTestAggregate.mentionRate - t0MetricsQuery.data.mentionRate
      : null;
  const recommendRateDelta =
    t0MetricsQuery.data?.recommendRate != null && hasAiTestData
      ? aiTestAggregate.recommendRate - t0MetricsQuery.data.recommendRate
      : null;
  const retestedCount = monitoringRows.filter(row => Boolean(row.lastAiTestedAt)).length;
  const hasEnoughDataForFullReport =
    publishWithLinkCount > 0 && hasAiTestData && currentGeoScore != null && t0MetricsQuery.data != null;

  const publishStatusByArticleId = useMemo(() => {
    const map = new Map<number, MonitoringRecordLike>();
    for (const row of monitoringRows) {
      const anyRow = row as MonitoringRecordLike & { articleId?: number | null };
      if (typeof anyRow.articleId === "number" && !map.has(anyRow.articleId)) {
        map.set(anyRow.articleId, anyRow);
      }
    }
    return map;
  }, [monitoringRows]);

  const contentListRows = useMemo(() => {
    return publishRecords.map((record, index) => {
      const articleId = typeof record.articleId === "number" ? record.articleId : null;
      const article = articleId != null ? articles.find(a => a.id === articleId) : null;
      const monitoring = articleId != null ? publishStatusByArticleId.get(articleId) : null;
      const publishStatus = String(record.publishStatus ?? "待发布");
      const qualityStatus =
        article != null
          ? String(article.status ?? "").includes("质检") || String(article.status ?? "").includes("审核")
            ? String(article.status)
            : "待质检"
          : "待质检";
      const retestStatus = monitoring?.lastAiTestedAt ? "已复测" : "待复测";
      return {
        key: `${record.id ?? index}`,
        title: String(record.publishTitle ?? record.title ?? (article?.title as string) ?? `内容 ${index + 1}`),
        platform: String(record.publishChannel ?? "未标注平台"),
        publishStatus,
        publicUrl: typeof record.publishUrl === "string" && record.publishUrl.trim() ? record.publishUrl : "",
        qualityStatus,
        retestStatus,
      };
    });
  }, [publishRecords, articles, publishStatusByArticleId]);

  const engineReportRows = useMemo<EngineReportRow[]>(() => {
    const targets = [
      { label: "豆包", aliases: ["doubao", "豆包"] },
      { label: "Kimi", aliases: ["kimi"] },
      { label: "DeepSeek", aliases: ["deepseek", "deep seek"] },
      { label: "通义千问", aliases: ["tongyi", "qwen", "通义千问"] },
      { label: "文心一言", aliases: ["wenxin", "yiyan", "文心一言"] },
    ];
    return targets.map(target => {
      const hit = aiTestAggregate.byEngine.find(engine => {
        const text = `${engine.engineName}`.toLowerCase();
        return target.aliases.some(alias => text.includes(alias.toLowerCase()));
      });
      if (!hit || hit.questionCount <= 0) {
        return {
          label: target.label,
          status: "未接入",
          mentionRate: null,
          recommendRate: null,
          testedQuestions: 0,
        };
      }
      const weak = hit.mentionRate < 0.4 || hit.recommendRate < 0.25;
      return {
        label: target.label,
        status: weak ? "增强目标" : "已实测",
        mentionRate: hit.mentionRate,
        recommendRate: hit.recommendRate,
        testedQuestions: hit.questionCount,
      };
    });
  }, [aiTestAggregate.byEngine]);

  const attributionLaggingIndicators = useMemo(() => {
    const lines: string[] = [];
    if (publishWithLinkCount === 0) lines.push("公开链接回填不足，导致发布结果无法进入完整监测链路。");
    if (!hasAiTestData) lines.push("尚未完成 AI 实测，提及率与推荐率无法形成稳定结论。");
    if (mentionRateDelta != null && mentionRateDelta < 0) lines.push("品牌提及率较 T0 下降，需优先补齐覆盖核心问题的内容。");
    if (recommendRateDelta != null && recommendRateDelta < 0) lines.push("品牌推荐率较 T0 下降，需强化证据型内容与平台匹配。");
    if (lines.length === 0) lines.push("当前关键指标无明显拖后项，建议继续扩大覆盖问题与发布平台。");
    return lines;
  }, [publishWithLinkCount, hasAiTestData, mentionRateDelta, recommendRateDelta]);

  const geoAttributionLines = useMemo(() => {
    const lines: string[] = [];
    lines.push(
      currentGeoScore != null
        ? `当前 GEO 分为 ${currentGeoScore}，由最近一轮内容诊断与发布后监测共同决定。`
        : "当前缺少可用的 GEO 分数据，需先完成内容诊断与评分。",
    );
    if (geoScoreDelta != null) {
      lines.push(`较本轮起始分 ${initialGeoScore} 变化 ${geoScoreDelta >= 0 ? "+" : ""}${geoScoreDelta}。`);
    }
    lines.push(
      completedItems.length > 0
        ? `本轮已完成动作：${completedItems.slice(0, 3).join("；")}。`
        : "本轮尚无可归因的执行动作记录。",
    );
    lines.push(`当前内容缺口：${maxProblemLine}`);
    return lines;
  }, [currentGeoScore, geoScoreDelta, initialGeoScore, completedItems, maxProblemLine]);

  const nextRoundFocus = useMemo(() => {
    const lines: string[] = [];
    if (growthSuggestions.length > 0) {
      for (const suggestion of growthSuggestions.slice(0, 5)) {
        lines.push(suggestion.message);
      }
    }
    if (lines.length < 3) lines.push("下轮内容主题：围绕当前高意向问题补齐对比与证据型文章。");
    if (lines.length < 4) lines.push("推荐发布平台：优先补齐未形成稳定提及的平台。");
    if (lines.length < 5) lines.push("需要复测的问题：优先复测未提及或未推荐的问题集。");
    return lines.slice(0, 5);
  }, [growthSuggestions]);

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
      {selectedProjectId && shareRenewalReminder ? (
        <DeliveryReportShareRenewalReminderCard
          reminder={shareRenewalReminder}
          renewing={renewShareLink.isPending}
          onRenew={() => void renewCustomerShareLink(selectedProjectId)}
        />
      ) : null}
      {selectedProjectId ? (
        <div
          className="flex flex-col gap-3 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-white p-5 shadow-sm print:hidden"
          data-testid="delivery-report-share-primary"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-gray-900">对外分享交付报告</p>
              <p className="text-sm text-gray-600">
                生成只读链接发给客户，展示企业名称、GEO 评分与主要检测结论，不含内部工程字段。
              </p>
              {shareExpiryDisplay ? (
                <p className="text-xs text-sky-800" data-testid="delivery-report-share-expiry-hint">
                  当前链接：{shareExpiryDisplay}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ai"
              size="lg"
              className="h-12 shrink-0 px-6 text-base shadow-md"
              disabled={shareLinkBusy || loading}
              onClick={() => void copyCustomerShareLink(selectedProjectId)}
            >
              <Link2 className="mr-2 size-5" aria-hidden />
              生成分享链接
            </Button>
          </div>
          {shareLinkUrl ? (
            <div className="rounded-xl border border-sky-100 bg-white/80 p-3" data-testid="delivery-report-share-link-preview">
              <p className="text-xs text-gray-500">客户分享链接</p>
              <p className="mt-1 break-all text-sm text-gray-800">{shareLinkUrl}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={geoP0Brand.primaryOutline}
                  onClick={() => void handleCopyShareLink(shareLinkUrl)}
                >
                  <Copy className="mr-2 size-4" aria-hidden />
                  复制链接
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={geoP0Brand.primaryOutline}
                  onClick={() => setShowShareQrCode(prev => !prev)}
                >
                  <QrCode className="mr-2 size-4" aria-hidden />
                  {showShareQrCode ? "隐藏二维码" : "显示二维码（可选）"}
                </Button>
              </div>
              {showShareQrCode ? (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareLinkUrl)}`}
                  alt="客户报告分享二维码"
                  className="mt-3 h-[180px] w-[180px] rounded-lg border border-gray-200 bg-white p-2"
                  loading="lazy"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

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

        {!hasEnoughDataForFullReport ? (
          <P0Card className="border-amber-200 bg-amber-50 text-amber-900">
            暂无足够数据生成完整报告，请先完成发布与复测。
          </P0Card>
        ) : null}

        <P0Section title="模块1：本轮交付摘要" description="回答本轮做了什么、结果如何。">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <P0MetricTile label="客户名称" value={enterpriseName} />
            <P0MetricTile label="交付周期" value={reportMeta.reportPeriod} />
            <P0MetricTile label="初始 GEO 分" value={initialGeoScore != null ? String(initialGeoScore) : "—"} />
            <P0MetricTile label="当前 GEO 分" value={currentGeoScore != null ? String(currentGeoScore) : "—"} />
            <P0MetricTile
              label="品牌提及率变化"
              value={
                mentionRateDelta != null
                  ? `${mentionRateDelta >= 0 ? "+" : ""}${Math.round(mentionRateDelta * 100)}%`
                  : "—"
              }
            />
            <P0MetricTile
              label="推荐率变化"
              value={
                recommendRateDelta != null
                  ? `${recommendRateDelta >= 0 ? "+" : ""}${Math.round(recommendRateDelta * 100)}%`
                  : "—"
              }
            />
            <P0MetricTile label="内容资产数" value={String(articles.length)} />
            <P0MetricTile label="已发布 / 已复测" value={`${publishRecords.length} / ${retestedCount}`} />
          </div>
        </P0Section>

        <P0Section title="模块2：本轮执行动作" description="真实执行动作回放（无模拟数据）。">
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="rounded-lg border border-gray-100 bg-white px-4 py-3">
              完成 AI 实测诊断：{hasAiTestData ? `是（${aiTestAggregate.questionCount} 题）` : "否"}
            </li>
            <li className="rounded-lg border border-gray-100 bg-white px-4 py-3">
              生成内容资产：{articles.length} 篇
            </li>
            <li className="rounded-lg border border-gray-100 bg-white px-4 py-3">
              已发布平台：{countDistinctPublishPlatforms(publishRecords as Array<{ publishChannel?: string | null }>)}
            </li>
            <li className="rounded-lg border border-gray-100 bg-white px-4 py-3">
              已回填链接：{publishWithLinkCount} 条
            </li>
            <li className="rounded-lg border border-gray-100 bg-white px-4 py-3">
              已完成复测：{retestedCount} 条
            </li>
          </ul>
        </P0Section>

        <P0Section title="模块3：发布内容清单" description="标题 / 平台 / 发布状态 / 公开链接 / 质检状态 / 复测状态。">
          {contentListRows.length === 0 ? (
            <P0Card className="text-sm text-gray-500">暂无发布记录</P0Card>
          ) : (
            <ul className="space-y-3">
              {contentListRows.map(row => (
                <li key={row.key} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="font-medium text-gray-900">{row.title}</p>
                  <p className="mt-1 text-sm text-gray-600">平台：{row.platform}</p>
                  <p className="mt-1 text-sm text-gray-600">发布状态：{row.publishStatus}</p>
                  <p className="mt-1 text-sm text-gray-600">质检状态：{row.qualityStatus}</p>
                  <p className="mt-1 text-sm text-gray-600">复测状态：{row.retestStatus}</p>
                  {row.publicUrl ? (
                    <a href={row.publicUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-blue-600 hover:underline break-all">
                      公开链接
                    </a>
                  ) : (
                    <p className="mt-2 text-sm text-amber-800">{NO_PUBLIC_LINK_HINT}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </P0Section>

        <P0Section title="模块4：AI 可见度变化" description="豆包 / Kimi / DeepSeek / 通义千问 / 文心一言。">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {engineReportRows.map(row => (
              <li key={row.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="font-medium text-gray-900">{row.label}</p>
                <p className="mt-1 text-sm text-gray-600">状态：{row.status}</p>
                <p className="mt-1 text-sm text-gray-600">
                  提及率：{row.mentionRate != null ? `${Math.round(row.mentionRate * 100)}%` : "未实测"}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  推荐率：{row.recommendRate != null ? `${Math.round(row.recommendRate * 100)}%` : "未实测"}
                </p>
              </li>
            ))}
          </ul>
        </P0Section>

        <P0Section title="模块5：GEO 分归因" description="为什么当前是这个分、拖后项与本轮影响。">
          <P0Card className="space-y-2 text-sm text-gray-700">
            {geoAttributionLines.map(line => (
              <p key={line}>{line}</p>
            ))}
          </P0Card>
          <P0Card className="space-y-2 text-sm text-gray-700">
            <p className="font-medium text-gray-900">当前拖后腿指标</p>
            <ul className="space-y-1">
              {attributionLaggingIndicators.map(line => (
                <li key={line}>- {line}</li>
              ))}
            </ul>
          </P0Card>
        </P0Section>

        <P0Section title="模块6：下一轮优化建议" description="输出 3-5 条，直接可执行。">
          <ul className="space-y-2 text-sm text-gray-700">
            {nextRoundFocus.map(line => (
              <li key={line} className="rounded-lg border border-gray-100 bg-white px-4 py-3">
                {line}
              </li>
            ))}
          </ul>
        </P0Section>

        <GeoHealthBriefCard
          enterpriseName={enterpriseName}
          publishRecords={publishRecords as PublishRecordWeekRow[]}
          articles={articles as Array<{ status?: string | null }>}
          testRounds={(testRoundsQuery.data ?? []) as GeoHealthBriefCardProps["testRounds"]}
          t0MentionRate={t0MetricsQuery.data?.mentionRate ?? null}
          t0RecommendRate={t0MetricsQuery.data?.recommendRate ?? null}
          monitoringMentionRate={hasAiTestData ? aiTestAggregate.mentionRate : null}
          monitoringRecommendRate={hasAiTestData ? aiTestAggregate.recommendRate : null}
          contentGapLine={maxProblemLine}
          disabled={loading || t0MetricsQuery.isLoading}
        />

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

        <P0Section
          title="竞品对比"
          description="对比本品牌与主要竞品在 AI 实测中的提及情况，以及竞品公开内容分布。"
        >
          <div data-testid="delivery-report-competitor">
            {competitorComparison ? (
              <DeliveryReportCompetitorSection data={competitorComparison} />
            ) : (
              <P0Card className="text-sm text-gray-500" testId="delivery-report-competitor-empty">
                暂无竞品档案。完成品牌建档并补充主要竞品后，可在此查看 AI 实测提及对比与内容分布建议。
              </P0Card>
            )}
          </div>
        </P0Section>

        <GeoGrowthSuggestionsPanel
          projectId={selectedProjectId}
          suggestions={growthSuggestions}
          loading={loading}
          className="print:break-inside-avoid"
        />

        <p
          className="text-sm text-gray-600 print:hidden"
          data-testid="delivery-report-export-backup-hint"
        >
          建议定期导出报告数据备份。
          <br />
          点击「导出CSV」保存本地副本。
        </p>

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
            data-testid="delivery-report-export-pdf"
            disabled={loading || exportingPdf}
            onClick={() => void handleExportDeliveryPdf()}
          >
            {exportingPdf ? "导出中…" : "导出报告"}
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

        <P0Section
          title="内容质量"
          description="基于已生成内容与 GEO 质检评分汇总，反映内容生产阶段质量，不承诺发布或收录结果。"
        >
          <div className="space-y-4" data-testid="delivery-report-content-quality">
            <div className="grid gap-3 sm:grid-cols-3">
              <P0MetricTile
                label="平均质检分"
                value={
                  contentQualityQuery.data?.averageScore != null
                    ? String(contentQualityQuery.data.averageScore)
                    : "—"
                }
                hint={
                  contentQualityQuery.data
                    ? `已评分 ${contentQualityQuery.data.scoredArticleCount} / 已生成 ${contentQualityQuery.data.generatedArticleCount} 篇`
                    : "完成内容生成与质检后展示"
                }
              />
              <P0MetricTile
                label="已生成内容"
                value={String(contentQualityQuery.data?.generatedArticleCount ?? 0)}
                hint="不含仍为「待生成」的选题占位"
              />
              <P0MetricTile
                label="质检未通过"
                value={String(contentQualityQuery.data?.failedItems.length ?? 0)}
                hint="低于参考线、合规阻断或状态为未通过"
              />
            </div>
            <P0Card testId="delivery-report-content-quality-platforms">
              <p className="text-xs font-medium text-gray-500">各平台内容质量分布</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-800">
                {formatContentQualityPlatformDistributionLine(
                  contentQualityQuery.data?.platformDistribution ?? [],
                )}
              </p>
            </P0Card>
            <P0Card testId="delivery-report-content-quality-failed">
              <p className="text-xs font-medium text-gray-500">质检未通过内容</p>
              {(contentQualityQuery.data?.failedItems.length ?? 0) === 0 ? (
                <p className="mt-2 text-sm text-gray-600">当前无质检未通过内容。</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-gray-800">
                  {contentQualityQuery.data!.failedItems.map((item: DeliveryReportContentQualityFailedItem) => (
                    <li
                      key={item.articleId}
                      className="rounded-lg border border-red-100 bg-red-50/50 px-4 py-3"
                    >
                      <p className="font-medium text-gray-900">
                        {item.title}
                        {item.totalScore != null ? ` · ${item.totalScore} 分` : ""}
                      </p>
                      <p className="mt-1 text-gray-600">{item.platformLabel}</p>
                      <p className="mt-1 text-red-900/90">{item.reasons.join("；")}</p>
                    </li>
                  ))}
                </ul>
              )}
            </P0Card>
            <P0Card testId="delivery-report-content-quality-priority">
              <p className="text-xs font-medium text-gray-500">建议优先优化</p>
              {(contentQualityQuery.data?.priorityItems.length ?? 0) === 0 ? (
                <p className="mt-2 text-sm text-gray-600">暂无待优先优化的低分内容。</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-gray-800">
                  {contentQualityQuery.data!.priorityItems.map((item: DeliveryReportContentQualityPriorityItem) => (
                    <li
                      key={item.articleId}
                      className="rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3"
                    >
                      <p className="font-medium text-gray-900">
                        {item.title} · {item.totalScore} 分
                      </p>
                      <p className="mt-1 text-gray-600">{item.platformLabel}</p>
                      <p className="mt-1 text-amber-950/90">{item.suggestion}</p>
                    </li>
                  ))}
                </ul>
              )}
            </P0Card>
          </div>
        </P0Section>

        <P0Section
          title="发布统计"
          description="基于发布任务（publish_tasks）汇总，反映自动/客户端发布尝试与成功情况。"
        >
          <div className="space-y-4" data-testid="delivery-report-publish-stats">
            <div className="grid gap-3 sm:grid-cols-3">
              <P0MetricTile
                label="总发布次数"
                value={String(publishStatsQuery.data?.totalPublishCount ?? 0)}
                hint="项目下全部发布任务数"
              />
              <P0MetricTile
                label="发布成功率"
                value={formatPublishSuccessRatePercent(publishStatsQuery.data?.successRatePercent ?? null)}
                hint={
                  publishStatsQuery.data &&
                  publishStatsQuery.data.completedCount + publishStatsQuery.data.failedCount > 0
                    ? `成功 ${publishStatsQuery.data.completedCount} / 失败 ${publishStatsQuery.data.failedCount}`
                    : "暂无已完成或失败的任务"
                }
              />
              <P0MetricTile
                label="本周发布数量"
                value={String(publishStatsQuery.data?.weekPublishCount ?? 0)}
                hint={publishStatsQuery.data?.weekRangeLabel ?? "当前自然周"}
              />
            </div>
            <P0Card testId="delivery-report-publish-stats-platforms">
              <p className="text-xs font-medium text-gray-500">各平台发布分布</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-800">
                {formatPlatformDistributionLine(publishStatsQuery.data?.platformDistribution ?? [])}
              </p>
            </P0Card>
          </div>
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
                <li key={row?.id} className="rounded-lg border border-gray-100 bg-white px-4 py-3">
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

        <P0Section title="下一轮优化建议" description="基于品牌提及率、推荐率、发布平台与 T0/T1 进度自动生成，不含 LLM 推断。">
          <GeoGrowthSuggestionsPanel
            projectId={selectedProjectId}
            suggestions={growthSuggestions}
            loading={loading}
          />
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
                if (shareLinkUrl) {
                  void handleCopyShareLink(shareLinkUrl);
                  return;
                }
                void copyCustomerShareLink(selectedProjectId);
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
                    const { sharePath, shareExpiresAt } = await regenerateShareLink.mutateAsync({
                      projectId: selectedProjectId,
                    });
                    setSharePathHint(sharePath);
                    setShareExpiresAtHint(shareExpiresAt);
                    setShowShareQrCode(false);
                    void shareLinkStatusQuery.refetch();
                    toast.success("新链接已生成，旧链接已失效");
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
                    setShareExpiresAtHint(null);
                    setSharePathHint(null);
                    setShowShareQrCode(false);
                    void shareLinkStatusQuery.refetch();
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
