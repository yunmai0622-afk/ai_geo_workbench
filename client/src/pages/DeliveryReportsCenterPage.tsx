import { P0Card, P0Section } from "@/components/geo/P0UiPrimitives";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { trpc } from "@/lib/trpc";
import { whiteLabel } from "@/lib/whiteLabel";
import {
  formatMonthlyReportMaturityChange,
  formatMonthlyReportMetricCount,
  formatMonthlyReportMetricPercent,
  formatMonthlyReportRateChange,
  MONTHLY_REPORT_CONTENT_ASSET_EMPTY_MESSAGE,
  type MonthlyReportView,
} from "@shared/monthlyReportView";
import { formatMonthlyReportImpactProofLine } from "@shared/contentRetestAttribution";
import { getBrandAssets } from "@shared/brandAssets";
import type { MonthlyOptimizationBrief, MonthlyOptimizationPriority } from "@shared/monthlyOptimizationBrief";
import { deriveRetestReportState, scheduledRetestStatusLabel } from "@shared/trustworthyState";
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

type EvidenceAccumulationItem = {
  title: string;
  text: string;
};

type ContinuousRetestPlanItem = {
  day: string;
  date: string;
  title: string;
  goal: string;
  check: string;
  decision: string;
};

const CONTINUOUS_RETEST_PLAN: ContinuousRetestPlanItem[] = [
  {
    day: "第 3 天",
    date: "07/12",
    title: "收录初查 + T2 轻量复测",
    goal: "确认公开 URL 是否仍可访问、是否出现搜索收录信号。",
    check: "检查 URL 是否仍可访问、搜索收录是否出现，并轻量复测是否提及海豚知道。",
    decision: "如仍未收录或未提及，继续观察，不写成效果提升。",
  },
  {
    day: "第 7 天",
    date: "07/16",
    title: "正式问题池 T2 复测",
    goal: "用同一问题池判断品牌提及、推荐和竞品占位是否发生变化。",
    check: "按同一问题池复测，对比 T0/T1/T2 的提及、推荐和竞品占位。",
    decision: "判断是否需要第二篇内容或补充信源证据。",
  },
  {
    day: "第 14 天",
    date: "07/23",
    title: "T3 复测 + 下月建议",
    goal: "判断第一轮内容是否被 AI 吸收，并形成下一轮服务建议。",
    check: "第三次检查收录和 AI 回答，判断第一轮内容是否被 AI 吸收。",
    decision: "输出下月继续优化建议，不伪造未来结果。",
  },
];

const DOLPHIN_THREE_DAY_EARLY_CHECK = {
  checkedAt: "2026-07-10",
  publishedAt: "2026-07-09 19:30",
  url: "https://zhuanlan.zhihu.com/p/2058633582978060994",
  title: "海豚知道是什么？它主要解决什么问题？",
  questions: [
    { question: "海豚知道是什么？", mentioned: true, explained: true, recommended: false },
    { question: "海豚知道主要解决什么问题？", mentioned: true, explained: true, recommended: false },
    { question: "知识付费 SaaS 系统有哪些推荐？", mentioned: true, explained: true, recommended: true },
    { question: "知识付费团队如何做系统化经营？", mentioned: false, explained: false, recommended: false },
  ],
} as const;

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

function hasContentLevelRetest(report: MonthlyReportView): boolean {
  return report.contentImpactProof.hasData && report.contentImpactProof.items.length > 0;
}

function contentLevelRetestLine(report: MonthlyReportView): string | null {
  const first = report.contentImpactProof.items[0];
  if (!first) return null;
  return formatMonthlyReportImpactProofLine(first);
}

function contentLevelRetestStatusLine(
  item: MonthlyReportView["contentImpactProof"]["items"][number],
): string {
  const mentionLine =
    item.afterMentionRate == null
      ? "T1 提及状态待确认"
      : item.afterMentionRate > 0
        ? `T1 已提及（${formatPercent(item.afterMentionRate)}）`
        : "T1 未提及";
  const recommendLine =
    item.afterRecommendRate == null
      ? "T1 推荐状态待确认"
      : item.afterRecommendRate > 0
        ? `T1 已推荐（${formatPercent(item.afterRecommendRate)}）`
        : "T1 未推荐";
  return `${mentionLine}，${recommendLine}`;
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
    return "当前尚未生成月度优化计划，报告仍处于待建立阶段；建议先完成月度优化计划与执行动作，再形成续费证明。";
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
  if (hasContentLevelRetest(report)) {
    const proofLine = contentLevelRetestLine(report);
    return `本月已完成 ${report.contentImpactProof.items.length} 条内容级发布后 AI 复测${proofLine ? `：${proofLine}` : ""}；但收录仍待观察，月度轮次复测尚未闭环，不能证明 AI 推荐率提升。`;
  }
  if (report.progress.totalCount > 0 && report.progress.completedCount < report.progress.totalCount) {
    return `当前仍处于基础建设阶段，本月服务事项完成 ${report.progress.completedCount}/${report.progress.totalCount} 项；暂无可确认增长，建议先补齐执行和发布后验证。`;
  }
  if (report.actions.contentCount > 0 || report.actions.contentAssetProof.hasInclusionData) {
    return "本月已形成部分内容和公开资产，但尚未完成完整复测；建议继续观察收录与 AI 回答变化，再判断增长效果。";
  }
  return "当前暂无可确认增长，报告仍需等待内容发布、收录监测和 AI 复测形成证据。";
}

function needsEvidenceAccumulationNotice(report: MonthlyReportView): boolean {
  if (report.planPhase === "no_plan") return true;
  if (!report.hasRetestData) return true;
  if (!report.actions.contentAssetProof.hasInclusionData) return true;
  if (report.actions.contentAssetProof.includedCount < report.actions.contentCount) return true;
  return report.progress.totalCount > 0 && report.progress.completedCount < report.progress.totalCount;
}

function buildEvidenceGapLine(report: MonthlyReportView): string {
  const gaps: string[] = [];
  if (report.actions.contentCount === 0) gaps.push("公开发布记录");
  if (!report.actions.contentAssetProof.hasInclusionData) gaps.push("收录验证");
  if (!report.hasRetestData && !hasContentLevelRetest(report)) gaps.push("AI 复测");
  if (!report.hasRetestData && hasContentLevelRetest(report)) gaps.push("月度轮次复测");
  if (report.progress.totalCount > 0 && report.progress.completedCount < report.progress.totalCount) {
    gaps.push("本月服务事项闭环");
  }
  if (gaps.length === 0) return "继续补充更多真实发布、收录和复测样本，让续费判断更稳。";
  return `还缺 ${gaps.join("、")}，当前重点是完成发布、链接回填、收录验证和 AI 复测，形成可用于续费判断的月度证据。`;
}

function buildEvidenceAccumulationItems(report: MonthlyReportView): EvidenceAccumulationItem[] {
  return [
    {
      title: "本月做了什么",
      text:
        report.planPhase === "no_plan"
          ? "尚未形成月度优化计划，报告会先提示补齐方案。"
          : `已围绕 ${report.focusSummary || "关键 GEO 短板"} 推进本月服务，当前完成 ${report.progress.completedCount}/${report.progress.totalCount} 项。`,
    },
    {
      title: "发布了什么",
      text:
        report.actions.contentCount > 0
          ? `已形成 ${reportCount(report.actions.contentCount)} 篇内容记录，覆盖 ${reportCount(report.actions.questionCoverageCount)} 个 AI 搜索问题。`
          : "本月还缺可验证的公开发布记录，不能把未发布内容当成效果证明。",
    },
    {
      title: "验证了什么",
      text: report.hasRetestData
        ? "已形成阶段复测，可以查看 AI 回答变化摘要。"
        : hasContentLevelRetest(report)
          ? `已完成 ${report.contentImpactProof.items.length} 条内容级发布后 AI 复测，但结果不代表整体趋势，不能承诺 AI 推荐率提升。`
          : "当前尚未完成 AI 复测，只能说明服务动作正在推进，不能承诺 AI 推荐率提升。",
    },
    {
      title: "还缺什么",
      text: buildEvidenceGapLine(report),
    },
    {
      title: "下月继续做什么",
      text:
        report.nextMonth.suggestions[0] ??
        "继续补齐公开证据、发布链接、收录验证和复测样本，让月度报告更适合续费判断。",
    },
  ];
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
          ? "尚未形成月度优化计划。"
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
        : hasContentLevelRetest(report)
          ? "已复测"
        : report.actions.contentAssetProof.retestReadyCount > 0
          ? "可复测"
          : "待验证",
      value: report.hasRetestData
        ? "已完成复测"
        : hasContentLevelRetest(report)
          ? `${report.contentImpactProof.items.length} 条内容级复测`
        : `${reportCount(report.actions.contentAssetProof.includedCount)} 篇已收录`,
      description: report.hasRetestData
        ? "已经形成阶段复测结果，可用于说明效果变化。"
        : hasContentLevelRetest(report)
          ? "已形成发布后 AI 回答证据，但收录和月度轮次复测仍需继续观察。"
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
  if (!report.hasRetestData && !hasContentLevelRetest(report)) {
    issues.push({
      title: "发布后尚未完成复测",
      impact: "没有复测前，只能说明动作已执行，还不能确认 AI 是否发生变化。",
      nextStep: "内容发布后按 7/14/30 天节奏完成收录与 AI 复测。",
    });
  }
  if (!report.hasRetestData && hasContentLevelRetest(report)) {
    issues.push({
      title: "月度轮次复测尚未闭环",
      impact: "已有内容级发布后复测，但样本量仍少，不能代表整体 AI 推荐趋势。",
      nextStep: "继续观察收录，并按同一问题池完成 T1/T2/T3 轮次复测。",
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
    verify: "通过收录监测、AI 复测和下月交付报告判断是否产生变化。",
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
        : hasContentLevelRetest(report)
          ? `${report.contentImpactProof.items.length} 条内容级复测`
        : currentRateLabel(report.summary.mentionRateBaseline),
      hint: report.hasRetestData
        ? "基于本月复测对比。"
        : hasContentLevelRetest(report)
          ? "已有发布后回答证据，完整趋势仍看月度轮次复测。"
          : "暂无复测对比，建议完成下一次复测后判断。",
    },
    {
      label: "AI 是否更愿意推荐你",
      value: report.hasRetestData
        ? formatMonthlyReportRateChange(report.summary.recommendRateBaseline, report.summary.recommendRateResult)
        : hasContentLevelRetest(report)
          ? "未证明提升"
        : currentRateLabel(report.summary.recommendRateBaseline),
      hint: report.hasRetestData
        ? "推荐率越稳定，越容易形成可解释价值。"
        : hasContentLevelRetest(report)
          ? "内容级复测只记录真实回答，不承诺推荐率提升。"
          : "当前仅展示基线，不伪造增长。",
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
      label: "生成月度优化计划",
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
      label: "去收录与 AI 复测",
      hint: "执行完成后需要复测，才能证明 AI 回答是否发生变化。",
      path: "/inclusion-monitoring",
    };
  }
  if (report.nextMonth.canGenerateNextPlan) {
    return {
      label: "生成下月方案",
      hint: "基于本月交付报告，继续生成下一轮优化计划。",
      action: "generateNextPlan",
    };
  }
  return {
    label: "返回服务首页",
    hint: "回到服务首页查看整体服务状态。",
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
  const showEvidenceAccumulationNotice = needsEvidenceAccumulationNotice(report);
  const evidenceAccumulationItems = buildEvidenceAccumulationItems(report);
  const firstPublishedAsset = report.actions.contentAssetProof.items[0] ?? null;
  const scheduledRetestQuery = trpc.geo.inclusionMonitoring.scheduledRetestStatus.useQuery(
    { projectId: 210001 },
    { enabled: selectedProjectId === 210001 },
  );
  const trustworthyState = deriveRetestReportState({
    hasRetestRecord: report.hasRetestData || hasContentLevelRetest(report),
    currentRetestReadyCount: report.actions.contentAssetProof.retestReadyCount,
    automaticStatus: scheduledRetestQuery.data?.currentStatus,
    retryRequired: scheduledRetestQuery.data?.retryRequired,
    reportPageAvailable: true,
    formalMonthlyReportGenerated: report.hasRetestData && report.planPhase === "completed",
    effectLoopCompleted: report.hasRetestData
      && report.planPhase === "completed"
      && report.actions.contentAssetProof.includedCount > 0
      && report.summary.recommendRateResult != null,
  });

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
      <P0Card testId="delivery-report-brand-assets-summary" className="space-y-4">
        <div><h2 className="text-lg font-semibold text-gray-900">本月品牌资产建设总结</h2><p className="text-sm text-gray-500">本总结区分建设动作、公开证据和 AI 效果验证，不把文章发布写成效果提升。</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3"><p className="text-sm font-medium text-gray-900">本月新增资产</p><p className="mt-1 text-sm text-gray-600">新增一条业务定义资产与 AI 问题占位资产，围绕“海豚知道是什么？”形成公开内容。</p></div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3"><p className="text-sm font-medium text-gray-900">已形成公开证据</p><p className="mt-1 text-sm text-gray-600">真实知乎 URL 已回填；仅证明内容公开发布，不代表已收录、被引用或被推荐。</p></div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3"><p className="text-sm font-medium text-gray-900">当前 AI 复测结论与未闭环原因</p><p className="mt-1 text-sm text-gray-600">轻量核验未显示稳定提及、推荐或文章引用；正式 T2/T3 尚待执行，因此不能判断效果提升。</p></div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3"><p className="text-sm font-medium text-gray-900">下月资产建设建议</p><p className="mt-1 text-sm text-gray-600">补强官网同主题定义页和第三方可信信源，继续既定复测计划，并建设推荐类问题占位。</p></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3" data-testid="delivery-report-trustworthy-state">
          <div className="rounded-xl border border-gray-100 bg-white p-3"><p className="text-xs font-semibold text-gray-700">复测记录 / 当前可执行</p><p className="mt-1 text-sm text-gray-900">{trustworthyState.retestRecordLabel} · 当前 {trustworthyState.currentRetestReadyCount} 条</p></div>
          <div className="rounded-xl border border-gray-100 bg-white p-3"><p className="text-xs font-semibold text-gray-700">报告状态</p><p className="mt-1 text-sm text-gray-900">页面可预览 · 正式月报{trustworthyState.formalMonthlyReportGenerated ? "已生成" : "待生成"}</p></div>
          <div className="rounded-xl border border-gray-100 bg-white p-3"><p className="text-xs font-semibold text-gray-700">效果闭环</p><p className="mt-1 text-sm text-gray-900">{trustworthyState.effectLoopCompleted ? "已完成" : "尚未完成"}</p></div>
        </div>
      </P0Card>
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

        {showEvidenceAccumulationNotice ? (
          <div
            className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4"
            data-testid="delivery-report-evidence-accumulation"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-700">
                当前仍处于样板交付积累阶段
              </span>
              <span className="text-sm font-semibold text-amber-900">本月证据仍在积累中</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-amber-900">
              当前重点是完成发布、链接回填、收录验证和 AI 复测，形成可用于续费判断的月度证据。报告只展示已发生的服务动作和待补齐证据，不承诺 AI 推荐率提升。
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              {evidenceAccumulationItems.map(item => (
                <div key={item.title} className="rounded-xl border border-amber-100 bg-white/75 p-3">
                  <p className="text-xs font-semibold text-amber-800">{item.title}</p>
                  <p className="mt-2 text-xs leading-5 text-gray-700">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {(report.actions.contentAssetProof.items.length > 0 || hasContentLevelRetest(report)) ? (
          <div
            className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4"
            data-testid="delivery-report-real-evidence-update"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-blue-700">
                真实证据更新
              </span>
              <span className="text-sm font-semibold text-blue-950">
                已展示真实发布、收录状态和发布后复测结果
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {report.actions.contentAssetProof.items.slice(0, 3).map(item => (
                <div key={item.id} className="rounded-xl border border-blue-100 bg-white/80 p-3">
                  <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {item.platform} · {item.inclusionStatusLabel}
                  </p>
                  {item.publicUrl ? (
                    <a
                      className="mt-2 block break-all text-xs font-medium text-blue-700 hover:text-blue-800"
                      href={item.publicUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.publicUrl}
                    </a>
                  ) : null}
                </div>
              ))}
              {hasContentLevelRetest(report) ? (
                <div className="rounded-xl border border-blue-100 bg-white/80 p-3 md:col-span-2">
                  <p className="text-sm font-semibold text-gray-900">AI T1 发布后复测</p>
                  <ul className="mt-2 space-y-2 text-xs leading-5 text-gray-700">
                    {report.contentImpactProof.items.slice(0, 3).map(item => (
                      <li key={item.articleId}>
                        {formatMonthlyReportImpactProofLine(item)}
                        <span className="mt-1 block font-medium text-blue-800">
                          {contentLevelRetestStatusLine(item)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs leading-5 text-gray-500">
                    该结果来自真实发布后的 AI 回答记录；当前不承诺推荐率提升，完整趋势仍需同一问题池的月度轮次复测。
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {firstPublishedAsset ? (
          selectedProjectId === 210001 ? (
            <div
              className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4"
              data-testid="delivery-report-sample-project-status"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-sky-700">真实样板项目状态</p>
                  <p className="mt-1 text-sm font-semibold text-sky-950">
                    第一轮公开证据建设已完成，进入收录观察与 AI 复测阶段
                  </p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-sky-700">效果闭环进行中</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-sky-100 bg-white/80 p-3">
                  <p className="text-xs font-semibold text-sky-800">已完成真实动作</p>
                  <p className="mt-2 text-xs leading-5 text-gray-700">知乎内容已发布 · 真实 URL 已回填 · T1 已复测 · 已进入 3/7/14 天复查计划</p>
                </div>
                <div className="rounded-xl border border-sky-100 bg-white/80 p-3">
                  <p className="text-xs font-semibold text-sky-800">当前真实结果</p>
                  <p className="mt-2 text-xs leading-5 text-gray-700">收录待观察；T1 未稳定提及、未形成推荐，也未引用本次知乎文章。</p>
                </div>
                <div className="rounded-xl border border-sky-100 bg-white/80 p-3">
                  <p className="text-xs font-semibold text-sky-800">当前结论</p>
                  <p className="mt-2 text-xs leading-5 text-gray-700">第一轮公开证据建设已完成，但单篇内容通常不足以立即改变 AI 推荐，仍需收录观察、信源补强和多轮复测。</p>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-sky-100 bg-white/80 p-3 text-xs leading-5 text-gray-700" data-testid="delivery-report-automatic-retest-status">
                <p className="font-semibold text-sky-900">自动复测已启用 · {scheduledRetestQuery.data?.frequency ?? "每天 20:30（Asia/Shanghai）"}</p>
                <p>健康状态：{scheduledRetestQuery.data?.healthStatus === "needs_attention" ? "需处理" : scheduledRetestQuery.data?.healthStatus === "running" ? "执行中" : "正常"}</p>
                <p>当前状态：{scheduledRetestStatusLabel(scheduledRetestQuery.data?.currentStatus)}</p>
                {scheduledRetestQuery.data?.retryRequired ? <p className="font-medium text-amber-800">处置建议：补跑失败节点；后续计划不变。</p> : null}
                {scheduledRetestQuery.data?.nextMilestone ? <p>下一计划节点：{scheduledRetestQuery.data.nextMilestone.dueDate}</p> : null}
                {scheduledRetestQuery.data?.lastResultCount != null ? <p>最近结果：{scheduledRetestQuery.data.lastResultCount} 条真实 AI 回答；提及率 {Math.round((scheduledRetestQuery.data.lastMentionRate ?? 0) * 100)}%，推荐率 {Math.round((scheduledRetestQuery.data.lastRecommendRate ?? 0) * 100)}%。</p> : <p>最近结果：尚无自动复测结果</p>}
                {scheduledRetestQuery.data?.lastError ? <p className="text-red-700">失败原因：{scheduledRetestQuery.data.lastError}</p> : null}
              </div>
            </div>
          ) : null
        ) : null}

        {firstPublishedAsset ? (
          <div
            className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"
            data-testid="delivery-report-continuous-retest-plan"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700">
                持续复测计划
              </span>
              <span className="text-sm font-semibold text-emerald-950">
                第一轮证据建设已完成，AI 推荐仍需持续优化
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-emerald-900">
              当前收录状态仍为待观察，AI T1 结果尚未提及或推荐品牌。后续只在真实检查完成后记录结果，不提前写成已收录或已提升。
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {CONTINUOUS_RETEST_PLAN.map((item, index) => {
                return (
                  <div key={item.day} className="rounded-xl border border-emerald-100 bg-white/80 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        {item.day}
                      </span>
                      <span className="text-xs font-semibold text-gray-700">{item.date}</span>
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {scheduledRetestStatusLabel(scheduledRetestQuery.data?.milestones[index]?.status)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-gray-900">{item.title}</p>
                    <p className="mt-2 text-xs leading-5 text-gray-700"><span className="font-medium">复查目标：</span>{item.goal}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-700"><span className="font-medium">验证内容：</span>{item.check}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500"><span className="font-medium">后续判断：</span>{item.decision}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {selectedProjectId === 210001 ? (
          <div
            className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4"
            data-testid="delivery-report-sample-evidence-chain"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-cyan-700">
                AI 问题占位证据链
              </span>
              <span className="text-sm font-semibold text-cyan-950">围绕一个 AI 搜索问题完成一次公开证据建设</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-cyan-900">
              不是简单发布文章，而是围绕一个用户会问 AI 的问题，建设公开证据，并持续验证 AI 是否开始识别。
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              {[
                { label: "目标问题", value: "海豚知道是什么？" },
                { label: "本轮动作", value: "围绕该问题发布知乎公开内容，补充品牌解释和业务定位。" },
                { label: "公开证据", value: DOLPHIN_THREE_DAY_EARLY_CHECK.url, link: true },
                { label: "当前验证", value: "已发布；收录待观察；T1 暂未提及、未推荐；不代表已产生效果提升。" },
                { label: "下一步", value: "执行 3/7/14 天持续复查；如仍未收录或未提及，补强官网信源和第二篇内容。" },
              ].map(item => (
                <div key={item.label} className="rounded-xl border border-cyan-100 bg-white/80 p-3">
                  <p className="text-xs font-semibold text-cyan-800">{item.label}</p>
                  {item.link ? (
                    <a
                      className="mt-2 block break-all text-xs leading-5 text-cyan-700 hover:text-cyan-800"
                      href={item.value}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.value}
                    </a>
                  ) : (
                    <p className="mt-2 text-xs leading-5 text-gray-700">{item.value}</p>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-gray-600">
              这条证据链证明公开内容建设动作已完成，不代表文章已经收录，也不代表 AI 提及或推荐已经提升。
            </p>
          </div>
        ) : null}

        {selectedProjectId === 210001 ? (
          <div className="grid gap-3 lg:grid-cols-2" data-testid="delivery-report-sample-service-playbook">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-semibold text-gray-900">下一步代运营服务动作</p>
              <div className="mt-3 space-y-3">
                {[
                  { title: "补跑过期节点", why: "07/12 自动复测未成功，失败记录必须保留并补跑。", verify: "补跑时检查 URL、标题精确搜索和品牌词触发。", decide: "补跑结果写入后再判断，不把失败节点改写成成功。" },
                  { title: "信源补强", why: "统一公开表达能帮助搜索与 AI 稳定识别品牌实体。", verify: "核对官网、知乎和公开平台的品牌介绍与业务定位是否一致。", decide: "07/16 正式 T2 后判断是否继续补第三方信源。" },
                  { title: "内容补强", why: "单篇内容可能不足以覆盖泛问题和推荐理由。", verify: "观察第 7 天收录状态及泛问题是否开始提及品牌。", decide: "若仍未收录或泛问题未提及，再启动第二篇内容。" },
                ].map(item => (
                  <div key={item.title} className="rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-700">
                    <p className="font-semibold text-gray-900">{item.title}</p>
                    <p>为什么做：{item.why}</p><p>怎么验证：{item.verify}</p><p>何时判断：{item.decide}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">这个样板案例怎么讲给客户听？</p>
              <p className="mt-3 text-sm leading-7 text-gray-700">
                我们不是只发文章，而是先找到一个用户会问 AI 的问题，围绕这个问题建设公开内容；发布后继续观察搜索收录，再用同一组问题复测 AI。即使暂时没有提升，也能根据证据告诉客户下一步该补信源还是补内容——这就是 GEO 代运营和普通发稿的区别。
              </p>
            </div>
          </div>
        ) : null}

        {selectedProjectId === 210001 ? (
          <div
            className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4"
            data-testid="delivery-report-three-day-t2-check"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-violet-700">
                3 天收录初查（提前检查）
              </span>
              <span className="text-sm font-semibold text-violet-950">T2 轻量复测已记录</span>
            </div>
            <p className="mt-3 text-xs leading-5 text-violet-900">
              文章页面显示发布于 {DOLPHIN_THREE_DAY_EARLY_CHECK.publishedAt}，本次检查时间为 {DOLPHIN_THREE_DAY_EARLY_CHECK.checkedAt}，
              尚未满 3 天。本结果只作为提前初查，不替代满 3 天或第 7 天正式复测。
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-violet-100 bg-white/80 p-3">
                <p className="text-sm font-semibold text-gray-900">收录初查</p>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-gray-700">
                  <li>URL：浏览器可正常打开，标题与正文可见。</li>
                  <li>标题精确搜索：Bing 未找到结果。</li>
                  <li>品牌词“海豚知道是什么”：可找到官网及既有第三方信源，未找到本次知乎文章。</li>
                  <li>当前状态：待观察；没有证据证明该 URL 已被搜索引擎收录。</li>
                </ul>
                <a
                  className="mt-2 block break-all text-xs font-medium text-violet-700 hover:text-violet-800"
                  href={DOLPHIN_THREE_DAY_EARLY_CHECK.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {DOLPHIN_THREE_DAY_EARLY_CHECK.url}
                </a>
              </div>
              <div className="rounded-xl border border-violet-100 bg-white/80 p-3">
                <p className="text-sm font-semibold text-gray-900">AI T2 轻量复测（Bing AI 搜索，4 题）</p>
                <ul className="mt-2 space-y-2 text-xs leading-5 text-gray-700">
                  {DOLPHIN_THREE_DAY_EARLY_CHECK.questions.map(item => (
                    <li key={item.question}>
                      <span className="font-medium text-gray-900">{item.question}</span>
                      <span className="block text-gray-600">
                        {item.mentioned ? "提及" : "未提及"} · {item.explained ? "解释基本正确" : "未解释品牌"} · {item.recommended ? "列入场景推荐" : "未推荐"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-violet-100 bg-white/70 p-3 text-xs leading-5 text-gray-700">
              <p>
                T1/T2 对比：T1 为未提及、未推荐；本次 T2 轻量样本为 3/4 题提及、1/4 题列入场景推荐。
                这是单一 AI 搜索平台的小样本变化，不能直接写成整体推荐率提升。
              </p>
              <p className="mt-1">
                引用核验：4 个回答均未引用本次知乎文章 URL，也没有足够证据证明回答吸收了该文章内容；回答引用的是官网、百度百科及其他既有知乎/媒体信源。
              </p>
              <p className="mt-1 font-medium text-violet-900">
                下一步：继续等到满 3 天复查收录，并进入第 7 天同问题池正式复测；暂不立即补第二篇，先补强可验证官网/第三方信源证据，第 7 天仍未收录或泛问题仍不提及时再决定第二篇内容。
              </p>
            </div>
          </div>
        ) : null}

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

        <details className="rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="delivery-report-effect-changes">
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-gray-900">
            <span className="inline-flex items-center gap-2">
              <TrendingUp className="size-4 text-blue-600" />
              效果变化明细
            </span>
            <span className="text-xs font-normal text-gray-500">未完成复测前默认收起，不承诺固定提升</span>
          </summary>
          <div className="grid gap-3 border-t border-gray-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {effectChanges.map(item => (
              <ReportMetric key={item.label} label={item.label} value={item.value} hint={item.hint} />
            ))}
          </div>
        </details>
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

      <details
        className="rounded-2xl border border-gray-200 bg-white shadow-sm"
        data-testid="delivery-report-service-and-evidence-summary"
      >
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900">
          <span>本月服务与证据摘要</span>
          <span className="text-xs font-normal text-gray-500">详细证据默认收起</span>
        </summary>
        <div className="grid gap-6 border-t border-gray-100 p-5 lg:grid-cols-[1fr_1fr]">
          <P0Card className="space-y-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="size-4 text-blue-600" />
              <p className="text-sm font-semibold text-gray-900">本月服务明细</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { title: "诊断与方案", desc: report.planPhase === "no_plan" ? "待生成服务方案。" : `本月围绕 ${report.focusSummary || "关键短板"} 推进。`, path: "/monthly-plan" },
                { title: "内容与发布", desc: `发布 ${reportCount(report.actions.contentCount)} 篇内容，覆盖 ${reportCount(report.actions.questionCoverageCount)} 个问题。`, path: "/weekly" },
                { title: "收录与复测", desc: report.hasRetestData ? "已完成 AI 复测并形成对比。" : hasContentLevelRetest(report) ? "已完成内容级发布后复测，收录仍待观察。" : "等待收录数据和下一次复测。", path: "/inclusion-monitoring" },
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
                value={report.hasRetestData ? "已完成" : hasContentLevelRetest(report) ? "内容级已复测" : "待完成"}
                hint={report.hasRetestData ? "可查看复测变化摘要。" : hasContentLevelRetest(report) ? "完整趋势仍需月度轮次复测。" : "完成验证后再判断趋势。"}
              />
              <ReportMetric
                label="续费证明"
                value={report.renewalJustification.hasData ? "已有依据" : "待完善"}
                hint="基于执行、收录、竞品和推荐率综合判断。"
              />
            </div>
          </P0Card>
        </div>
      </details>

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
      <section className="space-y-4" data-testid="monthly-report-brand-assets-summary">
        <div><h2 className="text-lg font-semibold text-gray-900">本月品牌资产建设总结</h2><p className="text-sm text-gray-500">报告记录公开证据和验证进度，不把文章发布等同于效果提升。</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <P0Card><p className="text-sm font-medium text-gray-900">本月新增资产与公开证据</p><p className="mt-2 text-sm text-gray-600">已发布内容、公开信源和信任证据以本报告实际记录为准；没有 URL 或核验记录的资料不计为已完成公开资产。</p></P0Card>
          <P0Card><p className="text-sm font-medium text-gray-900">当前 AI 复测结论</p><p className="mt-2 text-sm text-gray-600">{report.retest ? "已形成本轮复测数据，提及、推荐和引用结果分别展示，不互相替代。" : "正式复测尚未形成，当前不能判断提及、推荐或效果提升。"}</p></P0Card>
          <P0Card><p className="text-sm font-medium text-gray-900">未完成效果闭环的原因</p><p className="mt-2 text-sm text-gray-600">公开内容仍需经历可访问性、收录观察、AI 提及/引用/推荐核验；任一环节缺少证据都不写成已提升。</p></P0Card>
          <P0Card><p className="text-sm font-medium text-gray-900">下月资产建设建议</p><p className="mt-2 text-sm text-gray-600">优先补强官网定义页与第三方可信信源，并按既定计划完成复测后再决定下一轮问题占位。</p></P0Card>
        </div>
      </section>
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
    document.title = `${name} - 品牌资产增长报告`;
  }, [selectedProject?.enterpriseName]);

  if (!selectedProjectId && !projectsLoading) {
    return (
      <div data-testid="delivery-report-page">
        <ProjectContextEmptyState
          title="品牌资产增长报告"
          description="请先选择或创建项目后再查看品牌资产增长报告。"
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
              品牌资产增长报告
            </h1>
            <p className="mt-1 text-sm font-medium text-blue-700" data-testid="monthly-report-subtitle">
              汇总本月新增了哪些 AI 品牌资产、形成哪些公开证据、AI 是否开始变化。
            </p>
            <p className="mt-3 max-w-3xl text-sm text-gray-600" data-testid="delivery-report-page-intro">
              报告区分资产建设、公开发布、收录与 AI 复测；没有收录就写未收录，没有推荐就写未推荐。
            </p>
            <p className="mt-2 text-xs text-gray-500" data-testid="delivery-report-service-agency">
              本报告由 {whiteLabel.reportBrandName} 为客户生成
            </p>
          </div>
        </div>
      </header>

      {selectedProjectId ? <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="delivery-report-six-asset-growth">
        <h2 className="text-lg font-semibold text-gray-900">6 类资产增长明细</h2>
        <p className="mt-1 text-sm text-gray-500">状态基于当前公开证据与复测记录计算，发布完成不等于效果提升。</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{getBrandAssets(selectedProjectId).map(asset => <article key={asset.key} className="rounded-xl border border-gray-100 bg-gray-50 p-4"><div className="flex justify-between gap-2"><h3 className="text-sm font-semibold text-gray-900">{asset.name}</h3><span className="text-xs font-medium text-blue-700">{asset.status}</span></div><p className="mt-2 text-xs leading-5 text-gray-600">证据：{asset.evidence}</p><p className="mt-1 text-xs leading-5 text-gray-600">缺口：{asset.gap}</p></article>)}</div>
      </section> : null}

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
