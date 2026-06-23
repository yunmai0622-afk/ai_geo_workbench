/**
 * GEO-V2.1-P0：工作台 AI 品牌价值总览与月度计划完成收益（纯展示逻辑）
 */

import { AI_DIAGNOSIS_METRIC_EXPLANATIONS } from "./aiDiagnosisReportDisplay";

export const AI_BRAND_STATUS_SECTION_TITLE = "AI 品牌当前状态";

export const AI_BRAND_STATUS_EMPTY_TITLE = "还没有AI品牌体检结果";

export const AI_BRAND_STATUS_EMPTY_BULLETS = [
  "AI是否知道你的品牌",
  "AI是否推荐你",
  "竞品是否更容易被AI提到",
  "当前最需要优化的3个问题",
] as const;

export const MONTHLY_PLAN_COMPLETION_BENEFITS_TITLE = "完成本月计划，你将获得：";

export const MONTHLY_PLAN_COMPLETION_BENEFITS_FOOTNOTE =
  "这些不是普通文章，而是帮助AI理解、引用并推荐你品牌的公开内容资产。";

export const DELIVERY_REPORT_COMPETITOR_RATE_EXPLANATION =
  "AI在回答行业相关问题时，提到竞品的比例。比例越高，说明竞品在AI认知中占位越强，你的推荐机会相对越少。";

export const WORKSPACE_METRIC_HINTS = {
  maturity: "综合评估 AI 对品牌的识别、推荐与信源覆盖情况",
  mentionRate: AI_DIAGNOSIS_METRIC_EXPLANATIONS.mentionRate,
  recommendRate: AI_DIAGNOSIS_METRIC_EXPLANATIONS.recommendRate,
  competitorRate:
    "AI回答中出现竞品的比例，越高说明竞品AI占位越强",
} as const;

export type AiBrandRatePercents = {
  mentionRatePct: number | null;
  recommendRatePct: number | null;
  competitorRatePct: number | null;
};

export function rateToPercent(rate: number | null | undefined): number | null {
  if (rate == null || Number.isNaN(rate)) return null;
  return Math.round(rate * 100);
}

export function resolveAiBrandStatusConclusion(input: AiBrandRatePercents): string {
  const mention = input.mentionRatePct ?? 0;
  const recommend = input.recommendRatePct ?? 0;
  const competitor = input.competitorRatePct ?? 0;

  if (recommend > 40 && competitor < 50) {
    return "当前AI已能识别并推荐你的品牌，保持内容更新可巩固优势。";
  }
  if (recommend > 20 && competitor >= 50) {
    return "当前AI已能识别你的品牌，但在推荐场景中竞品占位更强。";
  }
  if (recommend <= 20 && mention > 30) {
    return "AI对你的品牌有一定认知，但缺少足够的推荐理由。";
  }
  if (mention <= 30) {
    return "当前AI对你品牌的认知不足，推荐场景中竞品更容易被提到。";
  }
  return "AI对你的品牌有一定认知，但缺少足够的推荐理由。";
}

export function buildCompetitivePressureCopy(input: AiBrandRatePercents): string | null {
  const recommend = input.recommendRatePct ?? 0;
  const competitor = input.competitorRatePct ?? 0;
  if (competitor <= recommend) return null;
  return `AI在行业推荐问题中，竞品出现率${competitor}%，高于你的推荐率${recommend}%。这意味着潜在客户通过AI找方案时，机会更容易流向竞品。`;
}

export function formatAiBrandRatePercent(rate: number | null | undefined): string {
  const pct = rateToPercent(rate);
  return pct != null ? `${pct}%` : "--";
}

export type MonthlyPlanCompletionBenefitsInput = {
  progress: { totalCount: number };
  tasks: Array<{ relatedQuestionId?: number | null; taskType?: string | null }>;
  boundPublishAccountCount?: number | null;
};

export type MonthlyPlanCompletionBenefitLine = {
  key: string;
  text: string;
};

export function buildMonthlyPlanCompletionBenefitLines(
  input: MonthlyPlanCompletionBenefitsInput,
): MonthlyPlanCompletionBenefitLine[] {
  const lines: MonthlyPlanCompletionBenefitLine[] = [];

  if (input.progress.totalCount > 0) {
    lines.push({
      key: "task-total",
      text: `本月计划共 ${input.progress.totalCount} 个优化任务`,
    });
  }

  const relatedQuestionCount = new Set(
    input.tasks
      .map(task => task.relatedQuestionId)
      .filter((id): id is number => typeof id === "number" && id > 0),
  ).size;
  if (relatedQuestionCount > 0) {
    lines.push({
      key: "question-count",
      text: `覆盖 ${relatedQuestionCount} 个高价值AI搜索问题`,
    });
  }

  const platformCount = input.boundPublishAccountCount ?? 0;
  if (platformCount > 0) {
    lines.push({
      key: "platform-count",
      text: `涉及 ${platformCount} 个内容发布平台`,
    });
  }

  lines.push({
    key: "retest-basis",
    text: "形成7/14/30天AI复测依据",
  });
  lines.push({
    key: "content-assets",
    text: "沉淀一批可被AI读取的公开内容资产",
  });

  return lines;
}
