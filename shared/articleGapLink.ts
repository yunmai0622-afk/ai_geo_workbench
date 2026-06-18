import { resolveQuestionTypeDisplayLabel } from "./retestComparisonDisplay";

export type ArticleGapLinkFields = {
  targetQuestionId?: string | null;
  targetGapType?: string | null;
};

export type ArticleGapLinkContext = {
  roundQuestionId: string;
  questionId: number;
  gapType: string;
  questionText: string;
};

export type QuestionMentionRateChange = {
  hasData: boolean;
  baseMentionRate: number | null;
  compareMentionRate: number | null;
  mentionRateDelta: number | null;
  baseRunCount: number;
  compareRunCount: number;
  summaryLine: string;
};

export function normalizeQuestionTextForMatch(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveGapTypeLabel(gapType: string | null | undefined): string {
  const raw = gapType?.trim();
  if (!raw) return "检测缺口";
  return resolveQuestionTypeDisplayLabel(raw);
}

export function buildArticleGapDisplayLine(gapType: string | null | undefined, questionText: string | null | undefined): string | null {
  const question = normalizeQuestionTextForMatch(questionText);
  if (!question) return null;
  const typeLabel = resolveGapTypeLabel(gapType);
  return `本文针对缺口：${typeLabel} - ${question}`;
}

export function buildArticleGapLinkContext(input: ArticleGapLinkFields & { questionText?: string | null }): {
  displayLine: string | null;
  gapTypeLabel: string | null;
  questionText: string | null;
} {
  const questionText = normalizeQuestionTextForMatch(input.questionText);
  const displayLine = buildArticleGapDisplayLine(input.targetGapType, questionText);
  return {
    displayLine,
    gapTypeLabel: input.targetGapType ? resolveGapTypeLabel(input.targetGapType) : null,
    questionText,
  };
}

export function computeQuestionMentionRateChange(input: {
  baseRuns: Array<{ mentionedCompany: boolean }>;
  compareRuns: Array<{ mentionedCompany: boolean }>;
}): QuestionMentionRateChange {
  const baseRunCount = input.baseRuns.length;
  const compareRunCount = input.compareRuns.length;
  const baseMentions = input.baseRuns.filter(run => run.mentionedCompany).length;
  const compareMentions = input.compareRuns.filter(run => run.mentionedCompany).length;

  const baseMentionRate = baseRunCount > 0 ? baseMentions / baseRunCount : null;
  const compareMentionRate = compareRunCount > 0 ? compareMentions / compareRunCount : null;
  const mentionRateDelta =
    baseMentionRate != null && compareMentionRate != null ? compareMentionRate - baseMentionRate : null;

  const hasData = baseRunCount > 0 && compareRunCount > 0;

  let summaryLine = "尚未完成优化前基线与 7天后复测对该问题的 AI 实测，暂无法对比提及率。";
  if (hasData && baseMentionRate != null && compareMentionRate != null && mentionRateDelta != null) {
    const basePct = Math.round(baseMentionRate * 100);
    const comparePct = Math.round(compareMentionRate * 100);
    const deltaPct = Math.round(mentionRateDelta * 100);
    if (deltaPct > 0) {
      summaryLine = `该问题提及率：优化前基线 ${basePct}% → 7天后复测 ${comparePct}%（↑ ${deltaPct} 个百分点）`;
    } else if (deltaPct < 0) {
      summaryLine = `该问题提及率：优化前基线 ${basePct}% → 7天后复测 ${comparePct}%（↓ ${Math.abs(deltaPct)} 个百分点）`;
    } else {
      summaryLine = `该问题提及率：优化前基线 ${basePct}% → 7天后复测 ${comparePct}%（→ 持平）`;
    }
  } else if (baseRunCount > 0 && compareRunCount === 0) {
    summaryLine = "优化前基线已有该问题实测，待完成 7天后复测后可对比提及率。";
  }

  return {
    hasData,
    baseMentionRate,
    compareMentionRate,
    mentionRateDelta,
    baseRunCount,
    compareRunCount,
    summaryLine,
  };
}
