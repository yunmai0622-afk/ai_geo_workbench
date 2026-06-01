import { and, desc, eq, inArray } from "drizzle-orm";
import { aiTestRuns, questions, roundQuestions, testRounds } from "../drizzle/schema";
import {
  buildT0ContentGapSuggestions,
  type T0ContentGapSuggestionsResult,
} from "@shared/t0ContentGapSuggestions";
import { findLatestCompletedRound, type TestRoundSummary } from "@shared/retestComparisonDisplay";

type DbConn = NonNullable<Awaited<ReturnType<typeof import("./db").getDb>>>;

/** 读取最近一次已完成 T0 的 ai_test_runs 并生成内容缺口建议。 */
export async function resolveT0ContentGapSuggestions(
  db: DbConn,
  projectId: number,
): Promise<T0ContentGapSuggestionsResult | null> {
  const rounds = await db
    .select()
    .from(testRounds)
    .where(eq(testRounds.projectId, projectId))
    .orderBy(desc(testRounds.createdAt));

  const baseRound = findLatestCompletedRound(rounds as TestRoundSummary[], "T0_BASELINE");
  if (!baseRound) return null;

  const runs = await db
    .select({
      questionId: aiTestRuns.questionId,
      platform: aiTestRuns.platform,
      mentionedCompany: aiTestRuns.mentionedCompany,
      recommendedCompany: aiTestRuns.recommendedCompany,
      competitorMentioned: aiTestRuns.competitorMentioned,
      competitorNames: aiTestRuns.competitorNames,
    })
    .from(aiTestRuns)
    .where(and(eq(aiTestRuns.roundId, baseRound.id), eq(aiTestRuns.projectId, projectId)));

  if (runs.length === 0) return null;

  const links = await db
    .select({ questionId: roundQuestions.questionId })
    .from(roundQuestions)
    .where(eq(roundQuestions.roundId, baseRound.id));

  const questionTypeByQuestionId = new Map<number, string>();
  if (links.length > 0) {
    const qRows = await db
      .select({ id: questions.id, questionType: questions.questionType })
      .from(questions)
      .where(
        inArray(
          questions.id,
          links.map(link => link.questionId),
        ),
      );
    for (const row of qRows) {
      questionTypeByQuestionId.set(row.id, row.questionType);
    }
  }

  return buildT0ContentGapSuggestions(runs, questionTypeByQuestionId, baseRound.id);
}
