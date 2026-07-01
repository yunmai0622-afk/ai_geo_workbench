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
  formatMonthlyReportMetricCount,
  formatMonthlyReportMetricPercent,
  formatMonthlyReportRateChange,
  MONTHLY_REPORT_CONTENT_ASSET_EMPTY_MESSAGE,
  type MonthlyReportView,
} from "@shared/monthlyReportView";
import { formatMonthlyReportImpactProofLine } from "@shared/contentRetestAttribution";
import type { MonthlyOptimizationBrief, MonthlyOptimizationPriority } from "@shared/monthlyOptimizationBrief";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Eye,
  FileBarChart2,
  FileText,
  RefreshCw,
  Share2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type RenewalPrimaryCta = {
  label: string;
  hint: string;
  path?: string;
  action?: "generateNextPlan";
};

type RenewalCompletionItem = {
  title: string;
  status: string;
  description: string;
  value: string;
};

type RenewalIssue = {
  title: string;
  impact: string;
  nextStep: string;
};

type RenewalNextSuggestion = {
  title: string;
  reason: string;
  shortcoming: string;
  verify: string;
  value: string;
};

function formatPercent(rate: number | null): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

function reportCount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "暂无";
  return value.toLocaleString("zh-CN");
}

function currentRateLabel(value: number | null): string {
  if (value == null) return "暂无基线";
  return `当前 ${formatPercent(value)}`;
}

function customerValueForReportDimension(key: MonthlyOptimizationPriority["relatedDimensionKey"]): string {
  const valueByDimension: Record<MonthlyOptimizationPriority["relatedDimensionKey"], string> = {
    profile: "让 AI 和客户看到一致、清楚的品牌介绍，减少理解偏差。",
    questionCoverage: "让用户常问的问题都有内容承接，提高被 AI 发现的机会。",
    aiVisibility: "提高品牌在 AI 回答中被准确识别和主动推荐的概率。",
    sourceConsistency: "让 AI 有更多公开证据判断品牌可信，推荐理由更充分。",
    contentExecution: "把方案变成可被搜索和 AI 读取的公开内容资产。",
    retestDelivery: "用复测和报告证明本月服务是否带来可解释变化。",
  };
  return valueByDimension[key];
}

function buildRenewalReportConclusion(report: MonthlyReportView): string {
  if (report.planPhase === "no_plan") {
    return "当前尚未生成本月服务方案，报告仍处于待建立阶段；建议先完成本月方案与执行动作，再形成续费证明。";
  }
  if (report.hasRetestData) {
    const maturityChange = formatMonthlyReportMaturityChange(
      report.summary.maturityBaseline,
      report.summary.maturityResult,
    );
    const recommendChange = formatMonthlyReportRateChange(
      report.summary.recommendRateBaseline,
      report.summary.recommendRateResult,
    );
    return `本月已完成阶段复测，AI 品牌成熟度变化为 ${maturityChange}，AI 推荐表现为 ${recommendChange}；下月应继续扩大内容覆盖和可信证据。`;
  }
  if (report.progress.totalCount > 0 && report.progress.completedCount < report.progress.totalCount) {
    return `当前仍处于基础建设阶段，本月服务事项完成 ${report.progress.completedCount}/${report.progress.totalCount} 项；暂无可确认增长，建议先补齐执行和发布后验证。`;
  }
  if (report.actions.contentCount > 0 || report.actions.contentAssetProof.hasInclusionData) {
    return "本月已形成部分内容和公开资产，但尚未完成完整复测；建议继续观察收录与 AI 回答变化，再判断增长效果。";
  }
  return "当前暂无可确认增长，报告仍需等待内容发布、收录监测和 AI 复测形成证据。";
}

function buildRenewalCompletionItems(report: MonthlyReportView): RenewalCompletionItem[] {
  const progressDone =
    report.progress.totalCount > 0 && report.progress.completedCount >= report.progress.totalCount;
  return [
    {
      title: "诊断与方案",
      status:
        report.planPhase === "no_plan"
          ? "待完成"
          : progressDone
            ? "已完成"
            : report.progress.totalCount > 0
              ? "执行中"
              : "待完善",
      value:
        report.progress.totalCount > 0
          ? `${report.progress.completedCount}/${report.progress.totalCount} 项`
          : "暂无服务事项",
      description:
        report.planPhase === "no_plan"
          ? "尚未形成本月服务方案。"
          : "已把诊断短板转成本月服务事项，并用于后续执行与验证。",
    },
    {
      title: "内容与发布",
      status: report.actions.contentCount > 0 ? "已推进" : "待完成",
      value: `${reportCount(report.actions.contentCount)} 篇内容`,
      description:
        report.actions.contentCount > 0
          ? `覆盖 ${reportCount(report.actions.questionCoverageCount)} 个 AI 搜索问题。`
          : "本月暂无已发布内容记录。",
    },
    {
      title: "品牌资料与信源",
      status: report.actions.sourceCount + report.actions.evidenceCount > 0 ? "已补充" : "待补充",
      value: `${reportCount(report.actions.sourceCount + report.actions.evidenceCount)} 条证据`,
      description:
        report.actions.sourceCount + report.actions.evidenceCount > 0
          ? "已补充公开信源或信任证据，帮助 AI 判断品牌可信度。"
          : "信源和信任证据还需要继续补齐。",
    },
    {
      title: "收录与复测",
      status: report.hasRetestData
        ? "已验证"
        : report.actions.contentAssetProof.retestReadyCount > 0
          ? "可复测"
          : "待验证",
      value: report.hasRetestData
        ? "已完成复测"
        : `${reportCount(report.actions.contentAssetProof.includedCount)} 篇已收录`,
      description: report.hasRetestData
        ? "已经形成阶段复测结果，可用于说明效果变化。"
        : "需要继续观察内容是否被搜索和 AI 看见。",
    },
  ];
}

function buildRenewalIssues(report: MonthlyReportView): RenewalIssue[] {
  const issues: RenewalIssue[] = [];
  const recommendRate = report.summary.recommendRateResult ?? report.summary.recommendRateBaseline;
  if (recommendRate == null || recommendRate < 0.5) {
    issues.push({
      title: "AI 推荐意愿仍不稳定",
      impact: "用户询问相关问题时，AI 可能知道品牌，但还不愿意主动推荐。",
      nextStep: "下月继续补推荐理由、案例证据和高价值问题内容。",
    });
  }
  if (report.actions.sourceCount + report.actions.evidenceCount === 0 || report.weakDimensionChanges.some(item => /信源|证据/.test(item.label))) {
    issues.push({
      title: "公开信任证据仍不足",
      impact: "AI 推荐品牌时需要公开资料、第三方信源和一致表达作为判断依据。",
      nextStep: "继续补齐官网、媒体、案例、口碑和可验证信源。",
    });
  }
  if (!report.actions.contentAssetProof.hasInclusionData || report.actions.contentAssetProof.includedCount < report.actions.contentCount) {
    issues.push({
      title: "收录数据仍待观察",
      impact: "内容没有被搜索引擎和 AI 读取前，很难证明它影响了 AI 回答。",
      nextStep: "继续回填公开链接，跟踪收录、阅读和关键词触发。",
    });
  }
  if (!report.hasRetestData) {
    issues.push({
      title: "发布后尚未完成复测",
      impact: "没有复测前，只能说明动作已执行，还不能确认 AI 是否发生变化。",
      nextStep: "内容发布后按 7/14/30 天节奏完成效果验证。",
    });
  }
  if (report.progress.totalCount > 0 && report.progress.completedCount < report.progress.totalCount) {
    issues.push({
      title: "本月服务事项未全部完成",
      impact: "执行未闭环时，报告证据会偏弱，续费沟通也缺少完整链路。",
      nextStep: "优先完成剩余服务事项，再进入复测与报告沉淀。",
    });
  }
  if (report.weakDimensionChanges.some(item => /问题|覆盖/.test(item.label))) {
    issues.push({
      title: "部分问题场景缺少内容覆盖",
      impact: "用户常问的问题没有内容承接时，AI 更容易引用竞品或泛泛回答。",
      nextStep: "继续围绕高价值 AI 搜索问题生成内容资产。",
    });
  }
  return issues.slice(0, 3);
}

function fallbackRenewalSuggestions(report: MonthlyReportView): RenewalNextSuggestion[] {
  const suggestions = report.nextMonth.suggestions.length > 0
    ? report.nextMonth.suggestions.slice(0, 3)
    : ["继续覆盖更多高价值 AI 问题", "补充推荐理由和可信信源", "完成发布后 AI 复测"];
  return suggestions.map((line, index) => ({
    title: line.replace(/^·\s*/, ""),
    reason: "这是基于当前报告数据的下月建议，不代表已经排期完成。",
    shortcoming: report.nextMonth.weakDimensions[index] ?? "当前仍需扩大 AI 可见度与推荐理由。",
    verify: "通过收录监测、AI 复测和下月效果报告判断是否产生变化。",
    value: "让客户看到持续服务不是重复发内容，而是在持续补齐 AI 推荐所需证据。",
  }));
}

function buildRenewalSuggestions(
  report: MonthlyReportView,
  brief?: MonthlyOptimizationBrief | null,
): RenewalNextSuggestion[] {
  if (brief?.priorities?.length) {
    return brief.priorities.slice(0, 3).map(priority => ({
      title: priority.title,
      reason: priority.reason,
      shortcoming: priority.shortcoming || priority.relatedDimensionName,
      verify: priority.retestMethod,
      value: customerValueForReportDimension(priority.relatedDimensionKey),
    }));
  }
  return fallbackRenewalSuggestions(report);
}

function buildEffectChanges(report: MonthlyReportView): Array<{ label: string; value: string; hint: string }> {
  return [
    {
      label: "AI 是否更知道你",
      value: report.hasRetestData
        ? formatMonthlyReportRateChange(report.summary.mentionRateBaseline, report.summary.mentionRateResult)
        : currentRateLabel(report.summary.mentionRateBaseline),
      hint: report.hasRetestData ? "基于本月复测对比。" : "暂无复测对比，建议完成下一次复测后判断。",
    },
    {
      label: "AI 是否更愿意推荐你",
      value: report.hasRetestData
        ? formatMonthlyReportRateChange(report.summary.recommendRateBaseline, report.summary.recommendRateResult)
        : currentRateLabel(report.summary.recommendRateBaseline),
      hint: report.hasRetestData ? "推荐率越稳定，越容易形成可解释价值。" : "当前仅展示基线，不伪造增长。",
    },
    {
      label: "AI 成熟度是否变化",
      value: formatMonthlyReportMaturityChange(report.summary.maturityBaseline, report.summary.maturityResult),
      hint: report.summary.maturityResult == null ? "复测完成后生成对比。" : "成熟度变化来自本月复测。",
    },
    {
      label: "内容是否被看见",
      value: `${reportCount(report.actions.contentAssetProof.includedCount)} 篇已收录`,
      hint:
        report.actions.contentAssetProof.hasInclusionData
          ? `本月发布 ${reportCount(report.actions.contentCount)} 篇，${reportCount(report.actions.contentAssetProof.retestReadyCount)} 篇可进入 AI 复测。`
          : "暂无可确认收录数据。",
    },
  ];
}

function buildReportPrimaryCta(report: MonthlyReportView): RenewalPrimaryCta {
  if (report.planPhase === "no_plan") {
    return {
      label: "生成本月方案",
      hint: "先制定服务方案，才能形成客户可读的月度报告。",
      path: "/monthly-plan",
    };
  }
  if (report.progress.totalCount > 0 && report.progress.completedCount < report.progress.totalCount) {
    return {
      label: "补齐执行/验证",
      hint: "本月报告还不完整，先补齐执行事项和验证证据。",
      path: "/monthly-plan",
    };
  }
  if (!report.hasRetestData) {
    return {
      label: "去效果验证",
      hint: "执行完成后需要复测，才能证明 AI 回答是否发生变化。",
      path: "/inclusion-monitoring",
    };
  }
  if (report.nextMonth.canGenerateNextPlan) {
    return {
      label: "生成下月方案",
      hint: "基于本月效果报告，继续生成下一轮优化计划。",
      action: "generateNextPlan",
    };
  }
  return {
    label: "返回客户总览",
    hint: "回到客户总览查看整体服务状态。",
    path: "/workspace",
  };
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

function MonthlyContentAssetSection({ report }: { report: MonthlyReportView }) {
  const proof = report.actions.contentAssetProof;

  if (!proof.hasInclusionData) {
    return (
      <section className="space-y-4" data-testid="monthly-report-content-asset">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">本月内容资产成果</h2>
          <p className="text-sm text-gray-500">基于已发布内容的收录、触达与 AI 复测准备情况</p>
        </div>
        <P0Card className="text-sm text-gray-600" testId="monthly-report-content-asset-empty">
          {MONTHLY_REPORT_CONTENT_ASSET_EMPTY_MESSAGE}
        </P0Card>
      </section>
    );
  }

  const exposureParts: string[] = [];
  if (proof.totalReadCount != null) {
    exposureParts.push(`阅读 ${formatMonthlyReportMetricCount(proof.totalReadCount)}`);
  }
  if (proof.totalImpressionCount != null) {
    exposureParts.push(`曝光 ${formatMonthlyReportMetricCount(proof.totalImpressionCount)}`);
  }
  const exposureValue =
    exposureParts.length > 0 ? exposureParts.join(" / ") : formatMonthlyReportMetricCount(null);

  return (
    <section className="space-y-4" data-testid="monthly-report-content-asset">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">本月内容资产成果</h2>
        <p className="text-sm text-gray-500">基于已发布内容的收录、触达与 AI 复测准备情况</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ReportMetric
          label="本月新增发布内容数"
          value={formatMonthlyReportMetricCount(proof.publishedCount)}
          testId="monthly-report-asset-published-count"
        />
        <ReportMetric
          label="已收录内容数"
          value={formatMonthlyReportMetricCount(proof.includedCount)}
          testId="monthly-report-asset-included-count"
        />
        <ReportMetric
          label="收录率"
          value={
            proof.inclusionRate == null
              ? "--"
              : formatMonthlyReportMetricPercent(proof.inclusionRate / 100)
          }
          testId="monthly-report-asset-inclusion-rate"
          hint={
            proof.averageInclusionDays != null
              ? `平均收录时间 ${proof.averageInclusionDays} 天`
              : undefined
          }
        />
        <ReportMetric
          label="可进入 AI 复测内容数"
          value={formatMonthlyReportMetricCount(proof.retestReadyCount)}
          testId="monthly-report-asset-retest-ready"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ReportMetric
          label="累计阅读/曝光量"
          value={exposureValue}
          testId="monthly-report-asset-traffic"
        />
        <ReportMetric
          label="有搜索关键词触发的内容数"
          value={formatMonthlyReportMetricCount(proof.keywordTriggeredContentCount)}
          testId="monthly-report-asset-keyword-triggered"
        />
      </div>
    </section>
  );
}

function MonthlyRenewalJustificationSection({ report }: { report: MonthlyReportView }) {
  const renewal = report.renewalJustification;

  return (
    <section className="space-y-4" data-testid="monthly-report-renewal-justification">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">为什么下月还值得继续做</h2>
      </div>
      {!renewal.hasData ? (
        <P0Card className="text-sm text-gray-600" testId="monthly-report-renewal-empty">
          {renewal.emptyMessage}
        </P0Card>
      ) : (
        <P0Card testId="monthly-report-renewal-body" className="space-y-4 border-emerald-100 bg-emerald-50/40">
          <p className="text-sm font-medium text-gray-900">{renewal.introLine}</p>
          <ul className="space-y-1 text-sm text-gray-800">
            {renewal.completedLines.map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="text-sm font-medium text-gray-900">但AI推荐场景仍有这些机会未占住：</p>
          <ul className="space-y-1 text-sm text-gray-800">
            {renewal.opportunityLines.map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="text-sm font-medium text-gray-900">下月继续做，可以：</p>
          <ul className="space-y-1 text-sm text-gray-800">
            {renewal.nextMonthLines.map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </P0Card>
      )}
    </section>
  );
}

function RenewalDeliveryReportHero({
  report,
  brief,
  selectedProjectId,
  generating,
  onGenerateNextPlan,
}: {
  report: MonthlyReportView;
  brief?: MonthlyOptimizationBrief | null;
  selectedProjectId: number;
  generating: boolean;
  onGenerateNextPlan: () => void;
}) {
  const [, setLocation] = useLocation();
  const conclusion = buildRenewalReportConclusion(report);
  const completedItems = buildRenewalCompletionItems(report);
  const effectChanges = buildEffectChanges(report);
  const issues = buildRenewalIssues(report);
  const suggestions = buildRenewalSuggestions(report, brief);
  const primaryCta = buildReportPrimaryCta(report);

  const handlePrimaryCta = () => {
    if (primaryCta.action === "generateNextPlan") {
      onGenerateNextPlan();
      return;
    }
    if (!primaryCta.path) return;
    setLocation(buildProjectUrl(primaryCta.path, selectedProjectId));
  };

  return (
    <div className="space-y-6" data-testid="delivery-report-renewal-overview">
      <P0Card testId="delivery-report-renewal-hero" className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-blue-600" />
              <p className="text-sm font-semibold text-gray-900">本月报告结论</p>
            </div>
            <p className="mt-3 text-lg font-semibold leading-8 text-gray-900" data-testid="delivery-report-renewal-conclusion">
              {conclusion}
            </p>
            <p className="mt-3 text-sm leading-6 text-gray-600">{primaryCta.hint}</p>
          </div>
          <Button
            type="button"
            className={geoP0Brand.primary}
            data-testid="delivery-report-primary-cta"
            disabled={primaryCta.action === "generateNextPlan" && generating}
            onClick={handlePrimaryCta}
          >
            {primaryCta.action === "generateNextPlan" && generating ? (
              <>
                <Spinner className="mr-2 size-4" />
                生成中…
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 size-4" />
                {primaryCta.label}
              </>
            )}
          </Button>
        </div>

        <div data-testid="delivery-report-completed-items">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <p className="text-sm font-semibold text-gray-900">本月完成事项</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {completedItems.map(item => (
              <div key={item.title} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600">
                    {item.status}
                  </span>
                </div>
                <p className="mt-2 text-lg font-bold tabular-nums text-blue-700">{item.value}</p>
                <p className="mt-2 text-xs leading-5 text-gray-500">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div data-testid="delivery-report-effect-changes">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="size-4 text-blue-600" />
            <p className="text-sm font-semibold text-gray-900">效果变化</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {effectChanges.map(item => (
              <ReportMetric key={item.label} label={item.label} value={item.value} hint={item.hint} />
            ))}
          </div>
        </div>
      </P0Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]" data-testid="delivery-report-renewal-reasons">
        <P0Card testId="delivery-report-open-issues" className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600" />
            <p className="text-sm font-semibold text-gray-900">仍需优化的问题</p>
          </div>
          {issues.length === 0 ? (
            <p className="text-sm leading-6 text-gray-600">暂无明显阻断，建议继续按下月建议扩大问题覆盖和验证频次。</p>
          ) : (
            <ul className="space-y-3">
              {issues.map(issue => (
                <li key={issue.title} className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                  <p className="text-sm font-semibold text-amber-900">{issue.title}</p>
                  <p className="mt-1 text-sm leading-6 text-amber-800">
                    <span className="font-medium">为什么影响推荐：</span>
                    {issue.impact}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-amber-800">
                    <span className="font-medium">下月怎么做：</span>
                    {issue.nextStep}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </P0Card>

        <P0Card testId="delivery-report-next-month-renewal" className="space-y-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="size-4 text-blue-600" />
            <p className="text-sm font-semibold text-gray-900">下月建议 / 续费理由</p>
          </div>
          <div className="space-y-3">
            {suggestions.map((item, index) => (
              <article key={`${item.title}-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-medium text-blue-600">建议 {index + 1}</p>
                <h3 className="mt-1 text-sm font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-xs leading-5 text-gray-600">
                  <span className="font-medium text-gray-800">为什么继续做：</span>
                  {item.reason}
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-600">
                  <span className="font-medium text-gray-800">关联短板：</span>
                  {item.shortcoming}
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-600">
                  <span className="font-medium text-gray-800">做完怎么看效果：</span>
                  {item.verify}
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-600">
                  <span className="font-medium text-gray-800">客户价值：</span>
                  {item.value}
                </p>
              </article>
            ))}
          </div>
        </P0Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]" data-testid="delivery-report-service-and-evidence-summary">
        <P0Card className="space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-4 text-blue-600" />
            <p className="text-sm font-semibold text-gray-900">本月服务明细</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { title: "诊断与方案", desc: report.planPhase === "no_plan" ? "待生成服务方案。" : `本月围绕 ${report.focusSummary || "关键短板"} 推进。`, path: "/monthly-plan" },
              { title: "内容与发布", desc: `发布 ${reportCount(report.actions.contentCount)} 篇内容，覆盖 ${reportCount(report.actions.questionCoverageCount)} 个问题。`, path: "/weekly" },
              { title: "收录与复测", desc: report.hasRetestData ? "已完成 AI 复测并形成对比。" : "等待收录数据和下一次复测。", path: "/inclusion-monitoring" },
              { title: "报告与下月建议", desc: "沉淀本月服务价值和下月续费理由。", path: "/delivery-reports" },
            ].map(item => (
              <div
                key={item.title}
                className="rounded-xl border border-gray-200 bg-white p-3 text-left"
              >
                <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </P0Card>

        <P0Card className="space-y-4" testId="delivery-report-evidence-summary">
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-blue-600" />
            <p className="text-sm font-semibold text-gray-900">效果证据摘要</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ReportMetric
              label="成熟度变化"
              value={formatMonthlyReportMaturityChange(report.summary.maturityBaseline, report.summary.maturityResult)}
              hint="复测完成后用于证明整体变化。"
            />
            <ReportMetric
              label="发布/收录证据"
              value={`${reportCount(report.actions.contentCount)} / ${reportCount(report.actions.contentAssetProof.includedCount)}`}
              hint="发布内容数 / 已收录内容数。"
            />
            <ReportMetric
              label="AI 复测"
              value={report.hasRetestData ? "已完成" : "待完成"}
              hint={report.hasRetestData ? "可查看复测变化摘要。" : "完成验证后再判断趋势。"}
            />
            <ReportMetric
              label="续费证明"
              value={report.renewalJustification.hasData ? "已有依据" : "待完善"}
              hint="基于执行、收录、竞品和推荐率综合判断。"
            />
          </div>
        </P0Card>
      </div>

      <details className="rounded-2xl border border-gray-200 bg-white shadow-sm" data-testid="delivery-report-share-entry">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900">
          <span className="inline-flex items-center gap-2">
            <Share2 className="size-4 text-blue-600" />
            客户分享 / 导出入口
          </span>
          <span className="text-xs font-normal text-gray-500">需要交付时再展开</span>
        </summary>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 p-5">
          <p className="text-sm leading-6 text-gray-600">
            如需给客户查看，可使用客户报告预览或已有分享链接入口；本轮不新增导出系统。
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation(`/delivery-reports/share/${selectedProjectId}`)}
          >
            查看客户报告预览
            <ArrowRight className="ml-1.5 size-4" />
          </Button>
        </div>
      </details>
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
          <ReportMetric
            label="竞品出现率"
            value={formatMonthlyReportRateChange(
              report.summary.competitorRateBaseline,
              report.summary.competitorRateResult,
            )}
            testId="monthly-report-competitor-rate"
            hint={report.summary.competitorRateExplanation}
          />
        </div>
      </section>

      <MonthlyContentAssetSection report={report} />

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

      <section className="space-y-4" data-testid="monthly-report-content-impact-proof">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">内容影响证明</h2>
          <p className="text-sm text-gray-500">展示本月已发布且已完成 AI 复测的内容，对品牌回答的实际影响</p>
        </div>
        {!report.contentImpactProof.hasData ? (
          <P0Card className="text-sm text-gray-600" testId="monthly-report-content-impact-empty">
            {report.contentImpactProof.emptyMessage}
          </P0Card>
        ) : (
          <ul className="space-y-3">
            {report.contentImpactProof.items.map(item => (
              <li
                key={item.articleId}
                className="rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-sm"
                data-testid={`monthly-report-impact-proof-${item.articleId}`}
              >
                <p className="whitespace-pre-line leading-relaxed text-gray-800">
                  {formatMonthlyReportImpactProofLine(item)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

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

      <MonthlyRenewalJustificationSection report={report} />

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
  const optimizationBriefQuery = trpc.geo.monthlyPlan.getOptimizationBrief.useQuery(
    { projectId: selectedProjectId! },
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
    document.title = `${name} - 效果报告`;
  }, [selectedProject?.enterpriseName]);

  if (!selectedProjectId && !projectsLoading) {
    return (
      <div data-testid="delivery-report-page">
        <ProjectContextEmptyState
          title="效果报告 / 续费型交付报告"
          description="请先选择或创建项目后再查看本月效果报告。"
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
              效果报告 / 续费型交付报告
            </h1>
            <p className="mt-1 text-sm font-medium text-blue-700" data-testid="monthly-report-subtitle">
              {report?.periodLabel ? `${report.periodLabel} 优化成效报告` : "优化成效报告"}
            </p>
            <p className="mt-3 max-w-3xl text-sm text-gray-600" data-testid="delivery-report-page-intro">
              本页用于向客户说明本月做了什么、产生了什么变化、哪些问题仍需继续，以及下月为什么值得续费。
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

      {report && !reportQuery.isLoading ? (
        <RenewalDeliveryReportHero
          report={report}
          brief={optimizationBriefQuery.data}
          selectedProjectId={selectedProjectId!}
          generating={generateMutation.isPending}
          onGenerateNextPlan={() => {
            if (!selectedProjectId) return;
            void generateMutation.mutateAsync({ projectId: selectedProjectId });
          }}
        />
      ) : null}

      {report && report.planPhase === "no_plan" && !reportQuery.isLoading ? (
        <P0Card testId="monthly-report-no-plan">
          <div className="flex items-start gap-3">
            <TrendingUp className="mt-0.5 size-5 text-amber-600" />
            <div>
              <p className="text-sm text-gray-700">
                尚未生成本月优化计划。请先在「本月优化计划」制定计划并执行，完成后将自动生成本月成效报告。
              </p>
            </div>
          </div>
        </P0Card>
      ) : null}

      {report && report.planPhase !== "no_plan" ? (
        <>
          <details className="rounded-2xl border border-gray-200 bg-white shadow-sm" data-testid="delivery-report-evidence-details">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900">
              <span className="inline-flex items-center gap-2">
                <ChevronDown className="size-4" />
                证据详情与完整月报
              </span>
              <span className="text-xs font-normal text-gray-500">原始数据、历史记录和详细证明已降级展示</span>
            </summary>
            <div className="border-t border-gray-100 p-5">
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
            </div>
          </details>
        </>
      ) : null}
    </div>
  );
}
