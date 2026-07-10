import type { AiTestEvidenceAggregate } from "@shared/aiTestEvidence";
import {
  buildNextActionLines,
  buildReportSummaryLines,
  formatDeliveryReportVisibilityScore,
  showPublishCompareSection,
} from "@/lib/deliveryReportDisplay";
import { whiteLabel } from "@/lib/whiteLabel";

export const DELIVERY_REPORT_SERVICE_PROVIDER = whiteLabel.reportBrandName;

export function buildDisplayReportNumber(params: {
  projectId?: number;
  reportGeneratedAt: Date | null;
  fallbackSeed?: string;
}): string {
  const d = params.reportGeneratedAt ?? new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  let suffix = "000";
  if (params.projectId != null && params.projectId > 0) {
    suffix = String(params.projectId).padStart(3, "0").slice(-3);
  } else if (params.fallbackSeed) {
    const digits = params.fallbackSeed.replace(/\D/g, "");
    suffix = (digits.slice(-3) || "001").padStart(3, "0");
  }
  return `GEO-${y}${m}-${suffix}`;
}

export function formatReportDateTime(d: Date | null): string {
  if (!d || Number.isNaN(d.getTime())) return "待更新";
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type VisibilityScoreTier = {
  label: string;
  description: string;
};

export function resolveVisibilityScoreTier(score: number | null): VisibilityScoreTier {
  if (score == null) {
    return { label: "待建立基线", description: "完成实测后将给出分档说明与优化方向。" };
  }
  if (score <= 30) return { label: "起步阶段", description: "品牌 AI 搜索信号仍在建立，本轮重点是补齐内容与实测基线。" };
  if (score <= 60) return { label: "初步可见", description: "AI 已能部分识别品牌，建议持续补充可引用内容并安排复测。" };
  if (score <= 80) return { label: "部分可见", description: "品牌在典型问题下已有可见度，可围绕高意图场景继续强化。" };
  return { label: "稳定可见", description: "品牌在 AI 搜索中已形成较稳定信号，建议保持更新与周期性复测。" };
}

export function formatBaselinePercent(rate: number, hasAiTestData: boolean): string {
  if (!hasAiTestData) return "待实测";
  const pct = Math.round(rate * 100);
  if (pct === 0) return "基线阶段（0%）";
  return `${pct}%`;
}

export function mentionRateNarrative(mentionRate: number, hasAiTestData: boolean): string {
  if (!hasAiTestData) {
    return "尚未完成 AI 搜索实测，建议先建立可对照的可见度基线。";
  }
  if (Math.round(mentionRate * 100) === 0) {
    return "当前处于基线阶段，AI 尚未稳定识别品牌，这是本轮优化的起点。建议补充品牌认知与场景化内容，并在 7–14 天后复测。";
  }
  return `当前品牌在实测问题中的提及率为 ${Math.round(mentionRate * 100)}%，可作为后续优化与复测的对照。`;
}

export function recommendRateNarrative(recommendRate: number, hasAiTestData: boolean): string {
  if (!hasAiTestData) return "完成实测后将展示推荐率表现。";
  if (Math.round(recommendRate * 100) === 0) {
    return "当前处于基线阶段，AI 暂未形成稳定推荐信号。建议强化差异化案例与可引用内容。";
  }
  return `当前品牌推荐率为 ${Math.round(recommendRate * 100)}%。`;
}

export function buildBossThreePoints(params: {
  brandName: string;
  publishCount: number;
  questionCount: number;
  engineCount: number;
  mentionRate: number;
  recommendRate: number;
  hasAiTestData: boolean;
  visibilityScore: number | null;
}): [string, string, string] {
  return buildReportSummaryLines({
    publishCount: params.publishCount,
    questionCount: params.questionCount,
    engineCount: params.engineCount,
    mentionRate: params.mentionRate,
    recommendRate: params.recommendRate,
    hasAiTestData: params.hasAiTestData,
    visibilityScore: params.visibilityScore,
  });
}

export function buildValueSettlementItems(params: {
  contentAssetCount: number;
  publishCount: number;
  questionCount: number;
  engineCount: number;
  evidenceCount: number;
  hasAiTestData: boolean;
  publishCompare: AiTestEvidenceAggregate["publishCompare"];
}): Array<{ label: string; value: string }> {
  const { contentAssetCount, publishCount, questionCount, engineCount, evidenceCount, hasAiTestData, publishCompare } =
    params;
  const retestStatus = publishCompare.after.hasData
    ? "已具备发布后样本，可对照变化"
    : publishCompare.before.hasData
      ? "已记录发布前基线，待发布后复测"
      : hasAiTestData
        ? "建议 7–14 天后安排复测"
        : "待完成实测后安排复测";

  return [
    { label: "生成内容资产", value: contentAssetCount > 0 ? `${contentAssetCount} 篇` : "本轮以实测与策略为主" },
    { label: "已发布内容", value: `${publishCount} 篇` },
    { label: "实测问题", value: hasAiTestData ? `${questionCount} 个` : "待实测" },
    { label: "覆盖 AI 引擎", value: hasAiTestData ? `${engineCount} 个` : "待实测" },
    { label: "关键证据", value: evidenceCount > 0 ? `${evidenceCount} 条` : "待积累" },
    { label: "发布后复测", value: retestStatus },
  ];
}

export function publishCompareBaselineNote(compare: AiTestEvidenceAggregate["publishCompare"]): string | null {
  if (!showPublishCompareSection(compare)) return null;
  const beforeM = compare.before.mentionRate ?? 0;
  const afterM = compare.after.mentionRate ?? 0;
  if (compare.before.hasData && compare.after.hasData && beforeM === 0 && afterM === 0) {
    return "当前仍处于基线阶段，需要继续补充品牌认知内容，并在 7–14 天后复测。";
  }
  if (!compare.before.hasData && !compare.after.hasData) {
    return "当前仍处于基线阶段，需要继续补充品牌认知内容，并在 7–14 天后复测。";
  }
  return null;
}

export function formatVisibilityScoreDisplay(score: number | null): string {
  const s = formatDeliveryReportVisibilityScore(score);
  if (score == null) return s;
  return `${s} 分`;
}

export type PublishRetestHeroContent =
  | {
      kind: "comparison";
      beforePct: number;
      afterPct: number;
      deltaPoints: number;
    }
  | {
      kind: "waiting_t1";
      t0BaselinePct: number;
    };

export function resolvePublishRetestMentionPercent(
  stage: AiTestEvidenceAggregate["publishCompare"]["before"],
): number {
  if (!stage.hasData || stage.mentionRate == null) return 0;
  return Math.round(stage.mentionRate * 100);
}

export function formatMentionRateDeltaPoints(delta: number): string {
  const points = Math.round(delta * 100);
  if (points > 0) return `+${points}个百分点`;
  if (points < 0) return `${points}个百分点`;
  return "持平";
}

/** 交付报告顶部复测对比：有 T1（发布后）样本则展示前后对比，否则展示 T0 等待态 */
export function buildPublishRetestHeroContent(
  compare: AiTestEvidenceAggregate["publishCompare"],
): PublishRetestHeroContent {
  if (compare.after.hasData) {
    const beforePct = resolvePublishRetestMentionPercent(compare.before);
    const afterPct = resolvePublishRetestMentionPercent(compare.after);
    const delta =
      compare.changes.mentionRateDelta ??
      (compare.after.mentionRate ?? 0) - (compare.before.mentionRate ?? 0);
    return {
      kind: "comparison",
      beforePct,
      afterPct,
      deltaPoints: Math.round(delta * 100),
    };
  }

  return {
    kind: "waiting_t1",
    t0BaselinePct: resolvePublishRetestMentionPercent(compare.before),
  };
}
