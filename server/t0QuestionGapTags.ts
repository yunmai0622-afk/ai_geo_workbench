import { and, eq, inArray } from "drizzle-orm";
import { aiTestRuns, questions } from "../drizzle/schema";
import { buildT0QuestionGapTagsByQuestionId } from "@shared/t0QuestionGapTags";

type DbConn = NonNullable<Awaited<ReturnType<typeof import("./db").getDb>>>;

/** T0 轮次完成后，根据 ai_test_runs 为项目问题库写入内容缺口标签。 */
export async function applyT0QuestionGapTagsForRound(
  db: DbConn,
  projectId: number,
  roundId: string,
): Promise<{ taggedCount: number }> {
  const runs = await db
    .select({
      questionId: aiTestRuns.questionId,
      mentionedCompany: aiTestRuns.mentionedCompany,
      recommendedCompany: aiTestRuns.recommendedCompany,
      competitorMentioned: aiTestRuns.competitorMentioned,
    })
    .from(aiTestRuns)
    .where(and(eq(aiTestRuns.roundId, roundId), eq(aiTestRuns.projectId, projectId)));

  const projectQuestions = await db
    .select({ id: questions.id, questionType: questions.questionType })
    .from(questions)
    .where(eq(questions.projectId, projectId));

  if (projectQuestions.length === 0) {
    return { taggedCount: 0 };
  }

  const questionTypeByQuestionId = new Map(
    projectQuestions.map(row => [row.id, row.questionType]),
  );

  const tagsByQuestionId = buildT0QuestionGapTagsByQuestionId(
    runs,
    questionTypeByQuestionId,
    projectQuestions.map(row => row.id),
  );

  let taggedCount = 0;
  for (const row of projectQuestions) {
    const tags = tagsByQuestionId.get(row.id) ?? [];
    await db.update(questions).set({ contentGapTags: tags }).where(eq(questions.id, row.id));
    if (tags.length > 0) taggedCount += 1;
  }

  return { taggedCount };
}
