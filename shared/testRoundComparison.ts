import type { SearchPoolLastTestResult } from "@shared/questionSearchPool";
import type { AiTestRun } from "../drizzle/schema";

export type RoundRunSnapshot = Pick<
  AiTestRun,
  "questionId" | "platform" | "mentionedCompany" | "recommendedCompany" | "competitorNames"
>;

export type ComparisonCell = {
  mentioned: boolean;
  recommended: boolean;
  competitors: string[];
};

export type ComparisonTableRow = {
  questionId: number;
  questionText: string;
  platform: string;
  roundA: ComparisonCell;
  roundB: ComparisonCell;
  change: "up" | "down" | "flat";
};

export type RoundRateSummary = {
  mentionRate: number;
  recommendRate: number;
  competitorRate: number;
  totalRuns: number;
};

export type RoundComparisonResult = {
  roundAId: string;
  roundBId: string;
  summaryA: RoundRateSummary;
  summaryB: RoundRateSummary;
  mentionRateDelta: number;
  recommendRateDelta: number;
  competitorRateDelta: number;
  rows: ComparisonTableRow[];
};

function scoreCell(cell: ComparisonCell): number {
  if (cell.recommended) return 3;
  if (cell.mentioned) return 2;
  if (cell.competitors.length > 0) return 1;
  return 0;
}

export function resolveComparisonChange(roundA: ComparisonCell, roundB: ComparisonCell): "up" | "down" | "flat" {
  const delta = scoreCell(roundB) - scoreCell(roundA);
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

export function computeRoundRateSummary(runs: RoundRunSnapshot[]): RoundRateSummary {
  const totalRuns = runs.length;
  if (totalRuns === 0) {
    return { mentionRate: 0, recommendRate: 0, competitorRate: 0, totalRuns: 0 };
  }
  const mentionCount = runs.filter(run => run.mentionedCompany).length;
  const recommendCount = runs.filter(run => run.recommendedCompany).length;
  const competitorCount = runs.filter(run => (run.competitorNames ?? []).length > 0).length;
  return {
    mentionRate: mentionCount / totalRuns,
    recommendRate: recommendCount / totalRuns,
    competitorRate: competitorCount / totalRuns,
    totalRuns,
  };
}

export function buildRoundComparison(
  roundAId: string,
  roundBId: string,
  runsA: RoundRunSnapshot[],
  runsB: RoundRunSnapshot[],
  questionTextById: Map<number, string>,
): RoundComparisonResult {
  const summaryA = computeRoundRateSummary(runsA);
  const summaryB = computeRoundRateSummary(runsB);

  const key = (questionId: number, platform: string) => `${questionId}\0${platform}`;
  const mapA = new Map<string, ComparisonCell>();
  const mapB = new Map<string, ComparisonCell>();

  for (const run of runsA) {
    mapA.set(key(run.questionId, run.platform), {
      mentioned: run.mentionedCompany,
      recommended: run.recommendedCompany,
      competitors: run.competitorNames ?? [],
    });
  }
  for (const run of runsB) {
    mapB.set(key(run.questionId, run.platform), {
      mentioned: run.mentionedCompany,
      recommended: run.recommendedCompany,
      competitors: run.competitorNames ?? [],
    });
  }

  const keys = [...new Set([...mapA.keys(), ...mapB.keys()])].sort();
  const emptyCell: ComparisonCell = { mentioned: false, recommended: false, competitors: [] };
  const rows: ComparisonTableRow[] = keys.map(compositeKey => {
    const [questionIdRaw, platform] = compositeKey.split("\0");
    const questionId = Number(questionIdRaw);
    const roundA = mapA.get(compositeKey) ?? emptyCell;
    const roundB = mapB.get(compositeKey) ?? emptyCell;
    return {
      questionId,
      questionText: questionTextById.get(questionId) ?? `问题 #${questionId}`,
      platform,
      roundA,
      roundB,
      change: resolveComparisonChange(roundA, roundB),
    };
  });

  return {
    roundAId,
    roundBId,
    summaryA,
    summaryB,
    mentionRateDelta: summaryB.mentionRate - summaryA.mentionRate,
    recommendRateDelta: summaryB.recommendRate - summaryA.recommendRate,
    competitorRateDelta: summaryB.competitorRate - summaryA.competitorRate,
    rows,
  };
}

export function resolveQuestionLastTestResult(
  mentioned: boolean,
  recommended: boolean,
  competitors: string[],
): SearchPoolLastTestResult {
  if (recommended) return "recommended";
  if (mentioned) return "mentioned";
  if (competitors.length > 0) return "competitor_won";
  return "not_mentioned";
}

export function formatRatePercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function formatRateDelta(delta: number): string {
  const pct = Math.round(delta * 100);
  if (pct > 0) return `+${pct}%`;
  if (pct < 0) return `${pct}%`;
  return "0%";
}

export function formatComparisonChangeLabel(change: "up" | "down" | "flat"): string {
  if (change === "up") return "↑提升";
  if (change === "down") return "↓下降";
  return "— 持平";
}
