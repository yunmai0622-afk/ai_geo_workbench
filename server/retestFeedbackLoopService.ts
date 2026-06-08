import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  buildEnhancementSuggestions,
  computeConsistencyScore,
  type BrandSourceRecordRow,
} from "@shared/brandSourceGraph";
import {
  aggregateRetestQuestionResult,
  computeQuestionPoolCoveragePercent,
  computeQuestionPoolUpdates,
  mergeNextRoundSuggestions,
  sourceLinkMatchesRecordUrl,
  type RetestFeedbackSummary,
  type RetestRunSnapshot,
} from "@shared/retestFeedbackLoop";
import type { SearchPoolLastTestResult } from "@shared/questionSearchPool";
import { filterQuestionsRequiringSourceType } from "@shared/questionSearchPool";
import {
  aiTestRuns,
  brandSourceRecords,
  entityAnchors,
  questions,
  retestComparisons,
  testRounds,
} from "../drizzle/schema";
import type { DbConn } from "./projectAccess";
import { filterRowsWithNumericId } from "./trpcRowSanitize";

function isCompareRetestRound(roundType: string): boolean {
  return roundType === "T1_RETEST" || roundType === "T2_RETEST" || roundType === "T3_RETEST";
}

function collectCitationUrls(runs: RetestRunSnapshot[]): string[] {
  const urls = new Set<string>();
  for (const run of runs) {
    for (const link of run.sourceLinks ?? []) {
      const trimmed = link?.trim();
      if (trimmed) urls.add(trimmed);
    }
  }
  return [...urls];
}

export async function applyRetestFeedbackFromRound(
  db: DbConn,
  projectId: number,
  compareRoundId: string,
  completedAt: Date = new Date(),
): Promise<RetestFeedbackSummary> {
  const roundRows = await db
    .select()
    .from(testRounds)
    .where(and(eq(testRounds.id, compareRoundId), eq(testRounds.projectId, projectId)))
    .limit(1);
  const round = roundRows[0];
  if (!round) {
    throw new TRPCError({ code: "NOT_FOUND", message: "复测轮次不存在" });
  }
  if (!isCompareRetestRound(round.roundType)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "仅 T1/T2/T3 复测轮次可触发反馈闭环" });
  }

  const runRows = await db
    .select({
      questionId: aiTestRuns.questionId,
      platform: aiTestRuns.platform,
      recommendedCompany: aiTestRuns.recommendedCompany,
      mentionedCompany: aiTestRuns.mentionedCompany,
      competitorMentioned: aiTestRuns.competitorMentioned,
      sourceLinks: aiTestRuns.sourceLinks,
    })
    .from(aiTestRuns)
    .where(and(eq(aiTestRuns.roundId, compareRoundId), eq(aiTestRuns.projectId, projectId)));

  const runs: RetestRunSnapshot[] = runRows.map(row => ({
    questionId: row.questionId,
    platform: row.platform,
    recommendedCompany: Boolean(row.recommendedCompany),
    mentionedCompany: Boolean(row.mentionedCompany),
    competitorMentioned: Boolean(row.competitorMentioned),
    sourceLinks: row.sourceLinks,
  }));

  const questionIds = [...new Set(runs.map(run => run.questionId))];
  const questionRows =
    questionIds.length > 0
      ? await db
          .select({
            id: questions.id,
            lastTestResult: questions.lastTestResult,
          })
          .from(questions)
          .where(and(eq(questions.projectId, projectId), inArray(questions.id, questionIds)))
      : [];

  const beforeByQuestionId = new Map<number, SearchPoolLastTestResult | null | undefined>(
    questionRows.map(row => [row.id, row.lastTestResult as SearchPoolLastTestResult | null | undefined]),
  );

  const runsByQuestionId = new Map<number, RetestRunSnapshot[]>();
  for (const run of runs) {
    const bucket = runsByQuestionId.get(run.questionId) ?? [];
    bucket.push(run);
    runsByQuestionId.set(run.questionId, bucket);
  }

  const afterByQuestionId = new Map<number, SearchPoolLastTestResult>();
  for (const [questionId, questionRuns] of runsByQuestionId.entries()) {
    const nextResult = aggregateRetestQuestionResult(questionRuns);
    afterByQuestionId.set(questionId, nextResult);
    await db
      .update(questions)
      .set({
        lastTestResult: nextResult,
        lastTestedAt: completedAt,
      })
      .where(and(eq(questions.id, questionId), eq(questions.projectId, projectId)));
  }

  const sourceRecords = await db
    .select()
    .from(brandSourceRecords)
    .where(eq(brandSourceRecords.projectId, projectId));
  const scoreBefore = computeConsistencyScore(sourceRecords as BrandSourceRecordRow[]).totalScore;

  const citations = collectCitationUrls(runs);
  let newCitationsConfirmed = 0;
  for (const record of sourceRecords) {
    const recordUrl = record.url?.trim();
    if (!recordUrl || record.aiCitationConfirmed) continue;
    const matched = citations.some(citation => sourceLinkMatchesRecordUrl(citation, recordUrl));
    if (!matched) continue;
    await db
      .update(brandSourceRecords)
      .set({
        aiCitationConfirmed: true,
        lastVerifiedAt: completedAt,
      })
      .where(eq(brandSourceRecords.id, record.id));
    newCitationsConfirmed += 1;
  }

  const updatedSourceRecords = await db
    .select()
    .from(brandSourceRecords)
    .where(eq(brandSourceRecords.projectId, projectId));
  const scoreAfter = computeConsistencyScore(updatedSourceRecords as BrandSourceRecordRow[]).totalScore;

  return getRetestFeedbackSummary(db, projectId, compareRoundId, {
    questionPoolUpdates: computeQuestionPoolUpdates(beforeByQuestionId, afterByQuestionId),
    sourceGraphUpdates: {
      newCitationsConfirmed,
      consistencyScoreChange: scoreAfter - scoreBefore,
    },
    lastRetestAt: (round.finishedAt ?? completedAt).toISOString(),
    sourceConsistencyScore: scoreAfter,
  });
}

export async function getRetestFeedbackSummary(
  db: DbConn,
  projectId: number,
  roundId?: string,
  partial?: Partial<RetestFeedbackSummary>,
): Promise<RetestFeedbackSummary> {
  const [allQuestions, sourceRecords, anchorRows, comparisonRows, retestRoundRows] = await Promise.all([
    db.select().from(questions).where(eq(questions.projectId, projectId)).orderBy(desc(questions.createdAt)),
    db.select().from(brandSourceRecords).where(eq(brandSourceRecords.projectId, projectId)),
    db.select().from(entityAnchors).where(eq(entityAnchors.projectId, projectId)).limit(1),
    roundId
      ? db
          .select({
            questionType: retestComparisons.questionType,
            platform: retestComparisons.platform,
            changeDirection: retestComparisons.changeDirection,
          })
          .from(retestComparisons)
          .where(
            and(
              eq(retestComparisons.projectId, projectId),
              eq(retestComparisons.compareRoundId, roundId),
            ),
          )
      : db
          .select({
            questionType: retestComparisons.questionType,
            platform: retestComparisons.platform,
            changeDirection: retestComparisons.changeDirection,
          })
          .from(retestComparisons)
          .where(eq(retestComparisons.projectId, projectId))
          .orderBy(desc(retestComparisons.createdAt))
          .limit(20),
    db
      .select({
        id: testRounds.id,
        roundType: testRounds.roundType,
        status: testRounds.status,
        finishedAt: testRounds.finishedAt,
      })
      .from(testRounds)
      .where(eq(testRounds.projectId, projectId))
      .orderBy(desc(testRounds.finishedAt), desc(testRounds.createdAt)),
  ]);

  const sanitizedQuestions = filterRowsWithNumericId(allQuestions);
  const weakQuestions = sanitizedQuestions.filter(
    q => q.lastTestResult === "not_mentioned" || q.lastTestResult === "competitor_won",
  );
  const enhancementSuggestions = buildEnhancementSuggestions(
    sourceRecords as BrandSourceRecordRow[],
    sanitizedQuestions,
    anchorRows[0] ?? null,
  ).map(suggestion => {
    if (!suggestion.platform) return suggestion;
    const related = filterQuestionsRequiringSourceType(sanitizedQuestions, suggestion.platform);
    return {
      ...suggestion,
      relatedQuestions: related.map(q => q.questionText).slice(0, 5),
    };
  });
  const nextRoundSuggestions = mergeNextRoundSuggestions(
    enhancementSuggestions,
    weakQuestions,
    comparisonRows,
    projectId,
  );

  const latestRetestRound =
    retestRoundRows.find(row => isCompareRetestRound(row.roundType) && row.status === "completed") ?? null;
  return {
    questionPoolUpdates: partial?.questionPoolUpdates ?? {
      improved: 0,
      declined: 0,
      newCompetitorWon: 0,
    },
    sourceGraphUpdates: partial?.sourceGraphUpdates ?? {
      newCitationsConfirmed: 0,
      consistencyScoreChange: 0,
    },
    nextRoundSuggestions,
    lastRetestAt:
      partial?.lastRetestAt ??
      (latestRetestRound?.finishedAt ? latestRetestRound.finishedAt.toISOString() : null),
    questionPoolCoveragePercent: computeQuestionPoolCoveragePercent(sanitizedQuestions),
    sourceConsistencyScore:
      partial?.sourceConsistencyScore ??
      computeConsistencyScore(sourceRecords as BrandSourceRecordRow[]).totalScore,
  };
}
