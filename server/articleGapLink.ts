import { and, desc, eq, inArray } from "drizzle-orm";
import {
  aiTestRuns,
  analysisResults,
  geoArticles,
  questions,
  roundQuestions,
  testRounds,
  type AnalysisResult,
  type Question,
} from "../drizzle/schema";
import {
  buildArticleGapLinkContext,
  computeQuestionMentionRateChange,
  normalizeQuestionTextForMatch,
  type ArticleGapLinkContext,
  type QuestionMentionRateChange,
} from "@shared/articleGapLink";
import { findLatestCompletedRound, type TestRoundSummary } from "@shared/retestComparisonDisplay";
import { deriveQuestionDiagnosisMeta } from "./geoLogic";

type Db = NonNullable<Awaited<ReturnType<typeof import("./db").getDb>>>;

function readIssueTypeFromAnalysis(analysis: AnalysisResult): string | null {
  const raw = analysis.rawJson;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const diagnosis = record.questionDiagnosis;
  if (diagnosis && typeof diagnosis === "object" && !Array.isArray(diagnosis)) {
    const issueType = (diagnosis as Record<string, unknown>).issueType;
    if (typeof issueType === "string" && issueType.trim()) return issueType.trim();
  }
  for (const key of ["issueType", "questionType", "problemType"] as const) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function resolveGapTypeFromSources(input: {
  questionText: string;
  matchedQuestion?: Question | null;
  analyses: AnalysisResult[];
}): string {
  if (input.matchedQuestion?.questionType) return input.matchedQuestion.questionType;
  for (const analysis of input.analyses) {
    const fromRaw = readIssueTypeFromAnalysis(analysis);
    if (fromRaw) return fromRaw;
  }
  return deriveQuestionDiagnosisMeta({ questionText: input.questionText }).questionType;
}

function findQuestionByText(projectQuestions: Question[], questionText: string): Question | null {
  const normalizedTarget = normalizeQuestionTextForMatch(questionText);
  if (!normalizedTarget) return null;
  const exact = projectQuestions.find(q => normalizeQuestionTextForMatch(q.questionText) === normalizedTarget);
  if (exact) return exact;
  const targetLower = normalizedTarget.toLowerCase();
  return (
    projectQuestions.find(q => {
      const text = normalizeQuestionTextForMatch(q.questionText);
      if (!text) return false;
      return text.toLowerCase().includes(targetLower) || targetLower.includes(text.toLowerCase());
    }) ?? null
  );
}

async function findLatestBaselineRound(db: Db, projectId: number): Promise<TestRoundSummary | null> {
  const rounds = await db
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
    .orderBy(desc(testRounds.finishedAt), desc(testRounds.createdAt));
  return findLatestCompletedRound(rounds as TestRoundSummary[], "T0_BASELINE");
}

async function findLatestRetestRound(db: Db, projectId: number): Promise<TestRoundSummary | null> {
  const rounds = await db
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
    .orderBy(desc(testRounds.finishedAt), desc(testRounds.createdAt));
  return (
    findLatestCompletedRound(rounds as TestRoundSummary[], "T1_RETEST") ??
    findLatestCompletedRound(rounds as TestRoundSummary[], "T2_RETEST") ??
    findLatestCompletedRound(rounds as TestRoundSummary[], "T3_RETEST")
  );
}

export async function resolveArticleTargetGapLink(
  db: Db,
  input: {
    projectId: number;
    questionText?: string | null;
    sourceQuestionIds?: number[];
    analyses?: AnalysisResult[];
    projectQuestions?: Question[];
  },
): Promise<ArticleGapLinkContext | null> {
  const questionText = normalizeQuestionTextForMatch(input.questionText);
  if (!questionText) return null;

  const projectQuestions =
    input.projectQuestions ??
    (await db.select().from(questions).where(eq(questions.projectId, input.projectId)));

  let matchedQuestion: Question | null = null;
  const preferredIds = input.sourceQuestionIds ?? [];
  if (preferredIds.length > 0) {
    matchedQuestion = projectQuestions.find(q => preferredIds.includes(q.id)) ?? null;
  }
  if (!matchedQuestion) {
    matchedQuestion = findQuestionByText(projectQuestions, questionText);
  }

  const gapType = resolveGapTypeFromSources({
    questionText,
    matchedQuestion,
    analyses: input.analyses ?? [],
  });

  if (!matchedQuestion) {
    return {
      roundQuestionId: "",
      questionId: 0,
      gapType,
      questionText,
    };
  }

  const baselineRound = await findLatestBaselineRound(db, input.projectId);
  if (!baselineRound) {
    return {
      roundQuestionId: "",
      questionId: matchedQuestion.id,
      gapType,
      questionText: matchedQuestion.questionText.trim() || questionText,
    };
  }

  const rqRows = await db
    .select({ id: roundQuestions.id, questionId: roundQuestions.questionId })
    .from(roundQuestions)
    .where(and(eq(roundQuestions.roundId, baselineRound.id), eq(roundQuestions.questionId, matchedQuestion.id)))
    .limit(1);

  const roundQuestion = rqRows[0];
  if (!roundQuestion) {
    return {
      roundQuestionId: "",
      questionId: matchedQuestion.id,
      gapType,
      questionText: matchedQuestion.questionText.trim() || questionText,
    };
  }

  return {
    roundQuestionId: roundQuestion.id,
    questionId: matchedQuestion.id,
    gapType,
    questionText: matchedQuestion.questionText.trim() || questionText,
  };
}

export async function computeLinkedQuestionMentionRateChange(
  db: Db,
  input: { projectId: number; targetQuestionId: string | null | undefined },
): Promise<QuestionMentionRateChange | null> {
  const roundQuestionId = input.targetQuestionId?.trim();
  if (!roundQuestionId) return null;

  const rqRows = await db
    .select({ questionId: roundQuestions.questionId })
    .from(roundQuestions)
    .where(eq(roundQuestions.id, roundQuestionId))
    .limit(1);
  const questionId = rqRows[0]?.questionId;
  if (!questionId) return null;

  const [baseRound, compareRound] = await Promise.all([
    findLatestBaselineRound(db, input.projectId),
    findLatestRetestRound(db, input.projectId),
  ]);
  if (!baseRound || !compareRound) {
    return computeQuestionMentionRateChange({ baseRuns: [], compareRuns: [] });
  }

  const [baseRuns, compareRuns] = await Promise.all([
    db
      .select({ mentionedCompany: aiTestRuns.mentionedCompany })
      .from(aiTestRuns)
      .where(and(eq(aiTestRuns.projectId, input.projectId), eq(aiTestRuns.roundId, baseRound.id), eq(aiTestRuns.questionId, questionId))),
    db
      .select({ mentionedCompany: aiTestRuns.mentionedCompany })
      .from(aiTestRuns)
      .where(
        and(eq(aiTestRuns.projectId, input.projectId), eq(aiTestRuns.roundId, compareRound.id), eq(aiTestRuns.questionId, questionId)),
      ),
  ]);

  return computeQuestionMentionRateChange({ baseRuns, compareRuns });
}

type ArticleGapEnrichmentInput = {
  id: number;
  targetQuestionId?: string | null;
  targetGapType?: string | null;
  generationBasis?: Record<string, unknown> | null;
};

export async function enrichArticlesWithGapLink<T extends ArticleGapEnrichmentInput>(
  db: Db,
  projectId: number,
  articles: T[],
): Promise<Array<T & { gapLinkDisplay: string | null; questionMentionRateChange: QuestionMentionRateChange | null }>> {
  if (articles.length === 0) return [];

  const roundQuestionIds = Array.from(
    new Set(articles.map(a => a.targetQuestionId?.trim()).filter((id): id is string => Boolean(id))),
  );

  const questionTextByRoundQuestionId = new Map<string, string>();
  if (roundQuestionIds.length > 0) {
    const rqRows = await db
      .select({ id: roundQuestions.id, questionId: roundQuestions.questionId })
      .from(roundQuestions)
      .where(inArray(roundQuestions.id, roundQuestionIds));
    const questionIds = Array.from(new Set(rqRows.map(row => row.questionId)));
    const questionRows =
      questionIds.length > 0
        ? await db
            .select({ id: questions.id, questionText: questions.questionText })
            .from(questions)
            .where(and(eq(questions.projectId, projectId), inArray(questions.id, questionIds)))
        : [];
    const textByQuestionId = new Map(questionRows.map(row => [row.id, row.questionText] as const));
    for (const row of rqRows) {
      const text = textByQuestionId.get(row.questionId);
      if (text) questionTextByRoundQuestionId.set(row.id, text);
    }
  }

  const enriched = [];
  for (const article of articles) {
    const basis =
      article.generationBasis && typeof article.generationBasis === "object" ? article.generationBasis : null;
    const customerQuestion =
      typeof basis?.customerQuestion === "string" ? basis.customerQuestion : questionTextByRoundQuestionId.get(article.targetQuestionId?.trim() ?? "") ?? null;

    const { displayLine } = buildArticleGapLinkContext({
      targetQuestionId: article.targetQuestionId,
      targetGapType: article.targetGapType,
      questionText: customerQuestion,
    });

    const questionMentionRateChange = article.targetQuestionId
      ? await computeLinkedQuestionMentionRateChange(db, {
          projectId,
          targetQuestionId: article.targetQuestionId,
        })
      : null;

    enriched.push({
      ...article,
      gapLinkDisplay: displayLine,
      questionMentionRateChange,
    });
  }
  return enriched;
}

export async function loadLinkedQuestionTextForArticle(
  db: Db,
  article: Pick<typeof geoArticles.$inferSelect, "targetQuestionId" | "targetGapType" | "generationBasis">,
): Promise<string | null> {
  const basis =
    article.generationBasis && typeof article.generationBasis === "object" && !Array.isArray(article.generationBasis)
      ? (article.generationBasis as Record<string, unknown>)
      : null;
  const fromBasis = typeof basis?.customerQuestion === "string" ? basis.customerQuestion : null;
  if (fromBasis?.trim()) return fromBasis.trim();

  const roundQuestionId = article.targetQuestionId?.trim();
  if (!roundQuestionId) return null;

  const rqRows = await db
    .select({ questionId: roundQuestions.questionId })
    .from(roundQuestions)
    .where(eq(roundQuestions.id, roundQuestionId))
    .limit(1);
  const questionId = rqRows[0]?.questionId;
  if (!questionId) return null;

  const questionRows = await db.select({ questionText: questions.questionText }).from(questions).where(eq(questions.id, questionId)).limit(1);
  return questionRows[0]?.questionText?.trim() ?? null;
}
