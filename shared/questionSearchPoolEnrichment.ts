import {
  resolveQuestionContentStatus,
  type QuestionArticleLink,
  type QuestionBankRow,
  type QuestionContentStatus,
} from "./questionBankIntentMap";
import {
  enrichQuestionOpportunityFields,
  type QuestionOpportunityLabel,
} from "./questionOpportunityMap";
import {
  resolveLastTestResultLabel,
  resolveQuestionPoolAiPerformanceLabel,
  type QuestionPoolAiPerformanceLabel,
  type SearchPoolLastTestResult,
  type SearchPoolQuestionRow,
} from "./questionSearchPool";
import { resolveQuestionLastTestResult } from "./testRoundComparison";

export type AiTestRunSnapshot = {
  questionId: number;
  testedAt: Date | string;
  mentionedCompany: boolean;
  recommendedCompany: boolean;
  competitorMentioned: boolean;
  competitorNames: string[];
};

export type LastAiTestDisplay = {
  result: SearchPoolLastTestResult | null;
  label: string;
  testedAt: Date | string | null;
};

export type EnrichedSearchPoolQuestion = SearchPoolQuestionRow & {
  diagnosisGap: string;
  contentStatus: QuestionContentStatus;
  aiPerformanceLabel: QuestionPoolAiPerformanceLabel;
  lastTestDisplay: LastAiTestDisplay;
  hasContentTask: boolean;
  competitorOccupied: boolean;
  contentPublished: boolean;
  hasContentPending: boolean;
  monthlyFocus: boolean;
  opportunityLabel: QuestionOpportunityLabel | null;
};

export function pickLatestAiTestRun(runs: AiTestRunSnapshot[]): AiTestRunSnapshot | null {
  if (runs.length === 0) return null;
  return [...runs].sort((a, b) => {
    const aTime = new Date(a.testedAt).getTime();
    const bTime = new Date(b.testedAt).getTime();
    return bTime - aTime;
  })[0] ?? null;
}

export function toLastAiTestDisplay(input: {
  runs: AiTestRunSnapshot[];
  storedResult?: string | null;
  storedTestedAt?: Date | string | null;
}): LastAiTestDisplay {
  const latest = pickLatestAiTestRun(input.runs);
  if (latest) {
    const competitors = latest.competitorMentioned
      ? latest.competitorNames.filter(name => name.trim().length > 0)
      : [];
    const result = resolveQuestionLastTestResult(
      latest.mentionedCompany,
      latest.recommendedCompany,
      competitors,
    );
    return {
      result,
      label: resolveLastTestResultLabel(result),
      testedAt: latest.testedAt,
    };
  }
  const stored = input.storedResult as SearchPoolLastTestResult | null | undefined;
  return {
    result: stored ?? null,
    label: resolveLastTestResultLabel(stored),
    testedAt: input.storedTestedAt ?? null,
  };
}

export function resolveDiagnosisGap(question: SearchPoolQuestionRow, lastTestDisplay: LastAiTestDisplay): string {
  const explicit = question.relatedGeoGap?.trim();
  if (explicit) return explicit;
  if (lastTestDisplay.result === "competitor_won") return "竞品对比语境下品牌处于劣势";
  if (lastTestDisplay.result === "not_mentioned") return "AI 回答未稳定提及品牌";
  if (lastTestDisplay.result === "mentioned") return "已提及品牌，可继续强化推荐";
  if (lastTestDisplay.result === "recommended") return "已获得推荐，可扩大内容覆盖";
  return "待实测确认诊断缺口";
}

export function resolveSearchPoolContentStatus(
  question: QuestionBankRow,
  articles: QuestionArticleLink[],
  hasContentTask: boolean,
): QuestionContentStatus {
  if (hasContentTask) {
    const linkedStatus = resolveQuestionContentStatus(question, articles);
    return linkedStatus === "未生成" ? "已生成" : linkedStatus;
  }
  return resolveQuestionContentStatus(question, articles);
}

export function enrichSearchPoolQuestion(input: {
  question: SearchPoolQuestionRow;
  runs: AiTestRunSnapshot[];
  articles: QuestionArticleLink[];
  hasContentTask: boolean;
  hasDiagnosisData: boolean;
  competitorRate?: number;
  monthlyFocusQuestionIds?: ReadonlySet<number>;
}): EnrichedSearchPoolQuestion {
  const lastTestDisplay = toLastAiTestDisplay({
    runs: input.runs,
    storedResult: input.question.lastTestResult,
    storedTestedAt: input.question.lastTestedAt,
  });
  const lastTestResult = lastTestDisplay.result ?? input.question.lastTestResult ?? null;
  const diagnosisGap = resolveDiagnosisGap(input.question, lastTestDisplay);
  const contentStatus = resolveSearchPoolContentStatus(
    input.question,
    input.articles,
    input.hasContentTask,
  );
  const opportunityFields = enrichQuestionOpportunityFields({
    question: input.question,
    contentStatus,
    hasContentTask: input.hasContentTask,
    competitorRate: input.competitorRate,
    monthlyFocusQuestionIds: input.monthlyFocusQuestionIds ?? new Set<number>(),
  });
  return {
    ...input.question,
    lastTestResult,
    lastTestedAt: lastTestDisplay.testedAt ?? input.question.lastTestedAt ?? null,
    relatedContentTask: input.hasContentTask,
    relatedGeoGap: diagnosisGap,
    diagnosisGap,
    contentStatus,
    aiPerformanceLabel: resolveQuestionPoolAiPerformanceLabel({
      lastTestResult,
      hasDiagnosisData: input.hasDiagnosisData,
    }),
    lastTestDisplay,
    hasContentTask: input.hasContentTask,
    ...opportunityFields,
  };
}
