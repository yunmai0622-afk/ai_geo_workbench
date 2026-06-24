import { and, desc, eq, inArray } from "drizzle-orm";
import {
  aiTestRuns,
  geoArticles,
  geoInclusionMonitoringRecords,
  questions,
  roundQuestions,
  testRounds,
} from "../drizzle/schema";
import {
  buildContentRetestAttributionView,
  type ContentRetestAttributionView,
  type StructuredRetestRunInput,
} from "@shared/contentRetestAttribution";
import { findLatestCompletedRound, type TestRoundSummary } from "@shared/retestComparisonDisplay";
import { normalizeEffectInclusionStatus } from "@shared/contentAssetEffectTracking";

type Db = NonNullable<Awaited<ReturnType<typeof import("./db").getDb>>>;

async function loadProjectRounds(db: Db, projectId: number): Promise<TestRoundSummary[]> {
  return db
    .select({
      id: testRounds.id,
      roundType: testRounds.roundType,
      roundName: testRounds.roundName,
      status: testRounds.status,
      platforms: testRounds.platforms,
      questionsCount: testRounds.questionsCount,
      runsPerQuestion: testRounds.runsPerQuestion,
      finishedAt: testRounds.finishedAt,
    })
    .from(testRounds)
    .where(eq(testRounds.projectId, projectId))
    .orderBy(desc(testRounds.finishedAt), desc(testRounds.createdAt)) as Promise<TestRoundSummary[]>;
}

function resolveLatestRetestRound(rounds: TestRoundSummary[]): TestRoundSummary | null {
  return (
    findLatestCompletedRound(rounds, "T1_RETEST") ??
    findLatestCompletedRound(rounds, "T2_RETEST") ??
    findLatestCompletedRound(rounds, "T3_RETEST")
  );
}

export async function resolveArticleQuestionId(
  db: Db,
  projectId: number,
  article: Pick<typeof geoArticles.$inferSelect, "id" | "targetQuestionId" | "generationBasis">,
): Promise<number | null> {
  const basis =
    article.generationBasis && typeof article.generationBasis === "object" && !Array.isArray(article.generationBasis)
      ? (article.generationBasis as Record<string, unknown>)
      : null;

  const sourceQuestionId = basis?.sourceQuestionId;
  if (typeof sourceQuestionId === "number" && sourceQuestionId > 0) return sourceQuestionId;
  if (typeof sourceQuestionId === "string" && /^\d+$/.test(sourceQuestionId)) {
    return Number(sourceQuestionId);
  }

  const roundQuestionId = article.targetQuestionId?.trim();
  if (roundQuestionId) {
    const rqRows = await db
      .select({ questionId: roundQuestions.questionId })
      .from(roundQuestions)
      .where(eq(roundQuestions.id, roundQuestionId))
      .limit(1);
    if (rqRows[0]?.questionId) return rqRows[0].questionId;
  }

  const entryQuestionText =
    typeof basis?.entryQuestionText === "string"
      ? basis.entryQuestionText.trim()
      : typeof basis?.customerQuestion === "string"
        ? basis.customerQuestion.trim()
        : "";
  if (!entryQuestionText) return null;

  const questionRows = await db
    .select({ id: questions.id, questionText: questions.questionText })
    .from(questions)
    .where(eq(questions.projectId, projectId));
  const exact = questionRows.find(row => row.questionText.trim() === entryQuestionText);
  if (exact) return exact.id;
  const lower = entryQuestionText.toLowerCase();
  const fuzzy = questionRows.find(row => {
    const text = row.questionText.trim().toLowerCase();
    return text.includes(lower) || lower.includes(text);
  });
  return fuzzy?.id ?? null;
}

async function loadStructuredRunsForQuestion(
  db: Db,
  projectId: number,
  roundId: string,
  questionId: number,
): Promise<StructuredRetestRunInput[]> {
  const rows = await db
    .select({
      mentionedCompany: aiTestRuns.mentionedCompany,
      recommendedCompany: aiTestRuns.recommendedCompany,
      rawAnswer: aiTestRuns.rawAnswer,
    })
    .from(aiTestRuns)
    .where(
      and(
        eq(aiTestRuns.projectId, projectId),
        eq(aiTestRuns.roundId, roundId),
        eq(aiTestRuns.questionId, questionId),
      ),
    );
  return rows.map(row => ({
    mentionedCompany: Boolean(row.mentionedCompany),
    recommendedCompany: Boolean(row.recommendedCompany),
    answerText: row.rawAnswer ?? "",
  }));
}

export type InclusionRetestAttributionInput = {
  articleId: number;
  aiTestResults?: unknown[] | null;
  aiMentionMonitorStatus?: string | null;
  effectInclusionStatus?: string | null;
  linkedDetectionQuestion?: string | null;
};

export async function buildRetestAttributionForInclusionRecords(
  db: Db,
  projectId: number,
  records: InclusionRetestAttributionInput[],
): Promise<Map<number, ContentRetestAttributionView>> {
  const result = new Map<number, ContentRetestAttributionView>();
  if (records.length === 0) return result;

  const articleIds = Array.from(new Set(records.map(record => record.articleId)));
  const articleRows = await db
    .select({
      id: geoArticles.id,
      targetQuestionId: geoArticles.targetQuestionId,
      generationBasis: geoArticles.generationBasis,
    })
    .from(geoArticles)
    .where(and(eq(geoArticles.projectId, projectId), inArray(geoArticles.id, articleIds)));

  const articleById = new Map(articleRows.map(row => [row.id, row] as const));
  const questionIdByArticleId = new Map<number, number | null>();
  for (const article of articleRows) {
    questionIdByArticleId.set(article.id, await resolveArticleQuestionId(db, projectId, article));
  }

  const questionIds = Array.from(
    new Set(
      Array.from(questionIdByArticleId.values()).filter((id): id is number => typeof id === "number"),
    ),
  );

  const rounds = await loadProjectRounds(db, projectId);
  const baseRound = findLatestCompletedRound(rounds, "T0_BASELINE");
  const compareRound = resolveLatestRetestRound(rounds);

  const baseRunsByQuestionId = new Map<number, StructuredRetestRunInput[]>();
  const compareRunsByQuestionId = new Map<number, StructuredRetestRunInput[]>();

  if (questionIds.length > 0 && baseRound) {
    for (const questionId of questionIds) {
      baseRunsByQuestionId.set(
        questionId,
        await loadStructuredRunsForQuestion(db, projectId, baseRound.id, questionId),
      );
    }
  }
  if (questionIds.length > 0 && compareRound) {
    for (const questionId of questionIds) {
      compareRunsByQuestionId.set(
        questionId,
        await loadStructuredRunsForQuestion(db, projectId, compareRound.id, questionId),
      );
    }
  }

  const questionTextById = new Map<number, string>();
  if (questionIds.length > 0) {
    const questionRows = await db
      .select({ id: questions.id, questionText: questions.questionText })
      .from(questions)
      .where(and(eq(questions.projectId, projectId), inArray(questions.id, questionIds)));
    for (const row of questionRows) {
      questionTextById.set(row.id, row.questionText);
    }
  }

  for (const record of records) {
    const article = articleById.get(record.articleId);
    const questionId = questionIdByArticleId.get(record.articleId) ?? null;
    const questionText =
      record.linkedDetectionQuestion?.trim() ||
      (questionId != null ? questionTextById.get(questionId)?.trim() : null) ||
      null;
    const included = normalizeEffectInclusionStatus(record.effectInclusionStatus) === "included";

    const view = buildContentRetestAttributionView({
      questionText,
      baseRuns: questionId != null ? baseRunsByQuestionId.get(questionId) ?? [] : [],
      compareRuns: questionId != null ? compareRunsByQuestionId.get(questionId) ?? [] : [],
      aiTestResults: record.aiTestResults,
      aiMentionMonitorStatus: record.aiMentionMonitorStatus,
      included,
    });
    result.set(record.articleId, view);
  }

  return result;
}

export async function buildRetestAttributionForArticles(
  db: Db,
  projectId: number,
  articleIds: number[],
): Promise<Map<number, ContentRetestAttributionView>> {
  if (articleIds.length === 0) return new Map();

  const monitoringRows = await db
    .select({
      articleId: geoInclusionMonitoringRecords.articleId,
      aiTestResults: geoInclusionMonitoringRecords.aiTestResults,
      aiMentionMonitorStatus: geoInclusionMonitoringRecords.aiMentionMonitorStatus,
      effectInclusionStatus: geoInclusionMonitoringRecords.effectInclusionStatus,
    })
    .from(geoInclusionMonitoringRecords)
    .where(
      and(
        eq(geoInclusionMonitoringRecords.projectId, projectId),
        inArray(geoInclusionMonitoringRecords.articleId, articleIds),
      ),
    )
    .orderBy(desc(geoInclusionMonitoringRecords.updatedAt));

  const latestMonitoringByArticleId = new Map<number, (typeof monitoringRows)[number]>();
  for (const row of monitoringRows) {
    if (!latestMonitoringByArticleId.has(row.articleId)) {
      latestMonitoringByArticleId.set(row.articleId, row);
    }
  }

  const records: InclusionRetestAttributionInput[] = articleIds.map(articleId => {
    const monitoring = latestMonitoringByArticleId.get(articleId);
    return {
      articleId,
      aiTestResults: monitoring?.aiTestResults ?? [],
      aiMentionMonitorStatus: monitoring?.aiMentionMonitorStatus ?? null,
      effectInclusionStatus: monitoring?.effectInclusionStatus ?? null,
      linkedDetectionQuestion: null,
    };
  });

  return buildRetestAttributionForInclusionRecords(db, projectId, records);
}
