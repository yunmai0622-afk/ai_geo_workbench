import type { EnhancementSuggestion } from "./brandSourceGraph";
import { resolveBrandSourcePlatformLabel } from "./brandSourceGraph";
import { resolveSourceTypeLabel, type SearchPoolLastTestResult, type SearchPoolQuestionRow } from "./questionSearchPool";

export type RetestRunSnapshot = {
  questionId: number;
  platform: string;
  recommendedCompany: boolean;
  mentionedCompany: boolean;
  competitorMentioned: boolean;
  sourceLinks?: string[] | null;
};

export type RetestComparisonSnapshot = {
  questionType: string;
  platform: string;
  changeDirection: string;
};

export type NextRoundSuggestion = {
  priority: "high" | "medium" | "low";
  type: "content" | "source" | "anchor";
  description: string;
  relatedQuestions: string[];
  relatedSources: string[];
  actionUrl: string;
};

export type RetestFeedbackSummary = {
  questionPoolUpdates: {
    improved: number;
    declined: number;
    newCompetitorWon: number;
  };
  sourceGraphUpdates: {
    newCitationsConfirmed: number;
    consistencyScoreChange: number;
  };
  nextRoundSuggestions: NextRoundSuggestion[];
  lastRetestAt: string | null;
  questionPoolCoveragePercent: number;
  sourceConsistencyScore: number;
};

const RESULT_SCORE: Record<SearchPoolLastTestResult, number> = {
  not_mentioned: 0,
  competitor_won: 1,
  mentioned: 2,
  recommended: 3,
};

export function aggregateRetestQuestionResult(
  runs: Pick<RetestRunSnapshot, "recommendedCompany" | "mentionedCompany" | "competitorMentioned">[],
): SearchPoolLastTestResult {
  if (runs.length === 0) return "not_mentioned";
  if (runs.some(run => run.recommendedCompany)) return "recommended";
  if (runs.some(run => run.mentionedCompany)) return "mentioned";
  if (runs.every(run => run.competitorMentioned)) return "competitor_won";
  return "not_mentioned";
}

export function normalizeUrlHost(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function sourceLinkMatchesRecordUrl(citation: string, recordUrl: string): boolean {
  const citeHost = normalizeUrlHost(citation);
  const recordHost = normalizeUrlHost(recordUrl);
  if (!citeHost || !recordHost) return false;
  if (citeHost === recordHost) return true;
  return citation.toLowerCase().includes(recordHost) || recordUrl.toLowerCase().includes(citeHost);
}

export function computeQuestionPoolCoveragePercent(questions: SearchPoolQuestionRow[]): number {
  if (questions.length === 0) return 0;
  const covered = questions.filter(
    q => q.lastTestResult === "mentioned" || q.lastTestResult === "recommended",
  ).length;
  return Math.round((covered / questions.length) * 100);
}

export function computeQuestionPoolUpdates(
  beforeByQuestionId: Map<number, SearchPoolLastTestResult | null | undefined>,
  afterByQuestionId: Map<number, SearchPoolLastTestResult>,
): RetestFeedbackSummary["questionPoolUpdates"] {
  let improved = 0;
  let declined = 0;
  let newCompetitorWon = 0;

  for (const [questionId, nextResult] of afterByQuestionId.entries()) {
    const prev = beforeByQuestionId.get(questionId) ?? null;
    const prevScore = prev && prev in RESULT_SCORE ? RESULT_SCORE[prev as SearchPoolLastTestResult] : -1;
    const nextScore = RESULT_SCORE[nextResult];
    if (nextScore > prevScore) improved += 1;
    if (nextScore < prevScore) declined += 1;
    if (prev !== "competitor_won" && nextResult === "competitor_won") newCompetitorWon += 1;
  }

  return { improved, declined, newCompetitorWon };
}

function resolveEnhancementPriority(kind: EnhancementSuggestion["kind"]): NextRoundSuggestion["priority"] {
  if (kind === "ai_citation" || kind === "brand_name") return "high";
  if (kind === "core_keywords" || kind === "accessibility") return "medium";
  return "low";
}

function resolveEnhancementType(kind: EnhancementSuggestion["kind"]): NextRoundSuggestion["type"] {
  if (kind === "ai_citation" || kind === "consistency") return "source";
  if (kind === "brand_name" || kind === "official_site") return "anchor";
  return "content";
}

function buildWeeklyActionUrl(projectId: number, gapType: string): string {
  const params = new URLSearchParams({ projectId: String(projectId), gapType });
  return `/weekly?${params.toString()}`;
}

export function mapEnhancementSuggestionToNextRound(
  suggestion: EnhancementSuggestion,
  projectId: number,
): NextRoundSuggestion {
  const platformLabel = suggestion.platform ? resolveSourceTypeLabel(suggestion.platform) : "信源";
  const gapType = suggestion.platform ?? suggestion.kind;
  return {
    priority: resolveEnhancementPriority(suggestion.kind),
    type: resolveEnhancementType(suggestion.kind),
    description:
      suggestion.platform != null
        ? `建议补充：${platformLabel} 平台的内容`
        : suggestion.description,
    relatedQuestions: suggestion.relatedQuestions,
    relatedSources: suggestion.affectedSources,
    actionUrl: buildWeeklyActionUrl(projectId, gapType),
  };
}

export function buildWeakQuestionSuggestions(
  questions: SearchPoolQuestionRow[],
  projectId: number,
): NextRoundSuggestion[] {
  const weak = questions.filter(
    q => q.lastTestResult === "not_mentioned" || q.lastTestResult === "competitor_won",
  );
  if (weak.length === 0) return [];

  const byPlatform = new Map<string, SearchPoolQuestionRow[]>();
  for (const question of weak) {
    for (const platform of question.requiredSourceTypes ?? []) {
      const bucket = byPlatform.get(platform) ?? [];
      bucket.push(question);
      byPlatform.set(platform, bucket);
    }
  }

  const suggestions: NextRoundSuggestion[] = [];
  for (const [platform, related] of byPlatform.entries()) {
    suggestions.push({
      priority: related.some(q => q.lastTestResult === "competitor_won") ? "high" : "medium",
      type: "content",
      description: `建议补充：${resolveSourceTypeLabel(platform)} 平台的内容以覆盖未提及问题`,
      relatedQuestions: related.map(q => q.questionText).slice(0, 5),
      relatedSources: [resolveSourceTypeLabel(platform)],
      actionUrl: buildWeeklyActionUrl(projectId, platform),
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      priority: "high",
      type: "content",
      description: "建议针对未覆盖问题补充 FAQ、案例或对比类内容",
      relatedQuestions: weak.map(q => q.questionText).slice(0, 5),
      relatedSources: [],
      actionUrl: buildWeeklyActionUrl(projectId, "not_mentioned"),
    });
  }

  return suggestions;
}

export function buildDeclinedComparisonSuggestions(
  comparisons: RetestComparisonSnapshot[],
  projectId: number,
): NextRoundSuggestion[] {
  return comparisons
    .filter(row => row.changeDirection === "down")
    .slice(0, 5)
    .map(row => ({
      priority: "high" as const,
      type: "content" as const,
      description: `最近复测在 ${row.platform} 上 ${row.questionType} 类问题提及频次下降，建议补强对应内容`,
      relatedQuestions: [],
      relatedSources: [resolveBrandSourcePlatformLabel(row.platform)],
      actionUrl: buildWeeklyActionUrl(projectId, row.questionType),
    }));
}

export function mergeNextRoundSuggestions(
  enhancementSuggestions: EnhancementSuggestion[],
  weakQuestions: SearchPoolQuestionRow[],
  declinedComparisons: RetestComparisonSnapshot[],
  projectId: number,
  limit = 8,
): NextRoundSuggestion[] {
  const merged = [
    ...enhancementSuggestions.map(item => mapEnhancementSuggestionToNextRound(item, projectId)),
    ...buildWeakQuestionSuggestions(weakQuestions, projectId),
    ...buildDeclinedComparisonSuggestions(declinedComparisons, projectId),
  ];

  const seen = new Set<string>();
  const unique: NextRoundSuggestion[] = [];
  for (const item of merged) {
    const key = `${item.type}:${item.description}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return unique.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]).slice(0, limit);
}

export function formatSuggestionPriorityLabel(priority: NextRoundSuggestion["priority"]): string {
  if (priority === "high") return "高";
  if (priority === "medium") return "中";
  return "低";
}
