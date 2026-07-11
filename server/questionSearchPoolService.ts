import { desc, eq, and, isNull } from "drizzle-orm";
import {
  type QuestionArticleLink,
} from "@shared/questionBankIntentMap";
import { GEO_OPTIMIZATION_TASK_CARD_MARK } from "@shared/geoContentTaskSource";
import {
  buildQuestionPoolGapOverview,
  buildSearchPoolGroupStats,
  inferSearchPoolType,
  mapLegacyTypeToSearchPoolType,
  resolveQuestionSearchPoolType,
  sortSearchPoolQuestions,
  type QuestionPoolGapOverview,
  type SearchPoolGroupStats,
  type SearchPoolQuestionRow,
  type SearchPoolQuestionType,
} from "@shared/questionSearchPool";
import {
  buildQuestionOpportunityOverview,
  computeQuestionCompetitorRates,
} from "@shared/questionOpportunityMap";
import {
  enrichSearchPoolQuestion,
  type AiTestRunSnapshot,
  type EnrichedSearchPoolQuestion,
} from "@shared/questionSearchPoolEnrichment";
import {
  aiTestRuns,
  enterpriseGeoProfiles,
  geoArticles,
  geoInclusionMonitoringRecords,
  geoPublishRecords,
  monthlyOptimizationPlans,
  monthlyOptimizationTasks,
  optimizationTasks,
  projects,
  publishTasks,
  questions,
  testRounds,
} from "../drizzle/schema";
import type { DbConn } from "./projectAccess";
import { filterRowsWithNumericId } from "./trpcRowSanitize";

const QUESTION_TASK_MARKER_PREFIX = "关联问题#";

export function questionTaskMarker(questionId: number): string {
  return `${QUESTION_TASK_MARKER_PREFIX}${questionId}`;
}

export function questionHasContentTask(
  question: {
    id: number;
    questionText: string;
    relatedContentTask?: boolean | null;
  },
  tasks: Array<{ taskName: string; generationReason: string; executionSuggestion: string }>,
  articles: QuestionArticleLink[],
): boolean {
  if (question.relatedContentTask) return true;
  const normalizedQuestion = question.questionText.trim();
  const linked = articles.some(article => {
    const customerQuestion =
      typeof article.generationBasis?.customerQuestion === "string"
        ? article.generationBasis.customerQuestion.trim()
        : "";
    return customerQuestion.length > 0 && customerQuestion === normalizedQuestion;
  });
  if (linked) return true;
  const marker = questionTaskMarker(question.id);
  return tasks.some(
    task =>
      task.generationReason.includes(marker) ||
      task.taskName.includes(normalizedQuestion) ||
      task.executionSuggestion.includes(marker),
  );
}

function resolveArticleStatusForLink(
  article: { id: number; status: string | null },
  publishedArticleIds: ReadonlySet<number>,
): string | null {
  if (publishedArticleIds.has(article.id)) return "已发布";
  return article.status;
}

export type SearchPoolEnrichedPayload = {
  questions: EnrichedSearchPoolQuestion[];
  hasDiagnosisData: boolean;
  contentTaskCount: number;
  overview: QuestionPoolGapOverview;
  groupStats: Record<SearchPoolQuestionType, SearchPoolGroupStats>;
};

export type SearchPoolInferContext = {
  brandName?: string | null;
  competitorNames?: string[];
};

export async function loadSearchPoolInferContext(
  db: DbConn,
  projectId: number,
): Promise<SearchPoolInferContext> {
  const [projectRows, profileRows] = await Promise.all([
    db.select({ enterpriseName: projects.enterpriseName }).from(projects).where(eq(projects.id, projectId)).limit(1),
    db
      .select({ enterpriseName: enterpriseGeoProfiles.enterpriseName, competitorDifference: enterpriseGeoProfiles.competitorDifference })
      .from(enterpriseGeoProfiles)
      .where(eq(enterpriseGeoProfiles.projectId, projectId))
      .orderBy(desc(enterpriseGeoProfiles.updatedAt))
      .limit(1),
  ]);
  const profile = profileRows[0] ?? null;
  const brandName = profile?.enterpriseName?.trim() || projectRows[0]?.enterpriseName?.trim() || null;
  const competitorNames =
    profile?.competitorDifference
      ?.split(/[,，、/|；;\n]/)
      .map(part => part.trim())
      .filter(Boolean) ?? [];
  return { brandName, competitorNames };
}

export async function backfillNullSearchPoolTypes(
  db: DbConn,
  projectId: number,
  context?: SearchPoolInferContext,
): Promise<number> {
  const inferContext = context ?? (await loadSearchPoolInferContext(db, projectId));
  const nullRows = await db
    .select({
      id: questions.id,
      questionText: questions.questionText,
      questionType: questions.questionType,
      targetKeywords: questions.targetKeywords,
    })
    .from(questions)
    .where(and(eq(questions.projectId, projectId), isNull(questions.searchPoolType)));

  let updated = 0;
  for (const row of nullRows) {
    const poolType = resolveQuestionSearchPoolType({
      questionText: row.questionText,
      questionType: row.questionType,
      searchPoolType: null,
      targetKeywords: row.targetKeywords,
      brandName: inferContext.brandName,
      competitorNames: inferContext.competitorNames,
    });
    await db.update(questions).set({ searchPoolType: poolType }).where(eq(questions.id, row.id));
    updated += 1;
  }
  return updated;
}

export async function backfillAllNullSearchPoolTypes(db: DbConn): Promise<number> {
  const nullRows = await db
    .select({
      id: questions.id,
      projectId: questions.projectId,
      questionText: questions.questionText,
      questionType: questions.questionType,
      targetKeywords: questions.targetKeywords,
    })
    .from(questions)
    .where(isNull(questions.searchPoolType));

  const contextByProject = new Map<number, SearchPoolInferContext>();
  let updated = 0;
  for (const row of nullRows) {
    let context = contextByProject.get(row.projectId);
    if (!context) {
      context = await loadSearchPoolInferContext(db, row.projectId);
      contextByProject.set(row.projectId, context);
    }
    const poolType = resolveQuestionSearchPoolType({
      questionText: row.questionText,
      questionType: row.questionType,
      searchPoolType: null,
      targetKeywords: row.targetKeywords,
      brandName: context.brandName,
      competitorNames: context.competitorNames,
    });
    await db.update(questions).set({ searchPoolType: poolType }).where(eq(questions.id, row.id));
    updated += 1;
  }
  return updated;
}

export { inferSearchPoolType, resolveQuestionSearchPoolType };

export async function loadSearchPoolEnriched(db: DbConn, projectId: number): Promise<SearchPoolEnrichedPayload> {
  const inferContext = await loadSearchPoolInferContext(db, projectId);
  await backfillNullSearchPoolTypes(db, projectId, inferContext);
  const [
    questionRows,
    taskRows,
    articleRows,
    publishTaskRows,
    publishRecordRows,
    inclusionRows,
    aiRunRows,
    roundRows,
    monthlyPlanRows,
    monthlyPlanTaskRows,
  ] = await Promise.all([
    db
      .select()
      .from(questions)
      .where(eq(questions.projectId, projectId))
      .orderBy(desc(questions.createdAt)),
    db.select().from(optimizationTasks).where(eq(optimizationTasks.projectId, projectId)),
    db
      .select({
        id: geoArticles.id,
        status: geoArticles.status,
        generationBasis: geoArticles.generationBasis,
        targetQuestionId: geoArticles.targetQuestionId,
      })
      .from(geoArticles)
      .where(eq(geoArticles.projectId, projectId)),
    db
      .select({ id: publishTasks.id, articleId: publishTasks.articleId, status: publishTasks.status })
      .from(publishTasks)
      .where(eq(publishTasks.projectId, projectId)),
    db
      .select({ articleId: geoPublishRecords.articleId })
      .from(geoPublishRecords)
      .where(eq(geoPublishRecords.projectId, projectId)),
    db
      .select({ id: geoInclusionMonitoringRecords.id })
      .from(geoInclusionMonitoringRecords)
      .where(eq(geoInclusionMonitoringRecords.projectId, projectId)),
    db
      .select({
        questionId: aiTestRuns.questionId,
        testedAt: aiTestRuns.testedAt,
        mentionedCompany: aiTestRuns.mentionedCompany,
        recommendedCompany: aiTestRuns.recommendedCompany,
        competitorMentioned: aiTestRuns.competitorMentioned,
        competitorNames: aiTestRuns.competitorNames,
      })
      .from(aiTestRuns)
      .where(eq(aiTestRuns.projectId, projectId)),
    db
      .select({ id: testRounds.id, status: testRounds.status, roundType: testRounds.roundType })
      .from(testRounds)
      .where(eq(testRounds.projectId, projectId)),
    db
      .select({ id: monthlyOptimizationPlans.id })
      .from(monthlyOptimizationPlans)
      .where(and(eq(monthlyOptimizationPlans.projectId, projectId), eq(monthlyOptimizationPlans.status, "active")))
      .orderBy(desc(monthlyOptimizationPlans.roundNumber))
      .limit(1),
    db
      .select({ relatedQuestionId: monthlyOptimizationTasks.relatedQuestionId })
      .from(monthlyOptimizationTasks)
      .innerJoin(
        monthlyOptimizationPlans,
        eq(monthlyOptimizationTasks.planId, monthlyOptimizationPlans.id),
      )
      .where(
        and(
          eq(monthlyOptimizationPlans.projectId, projectId),
          eq(monthlyOptimizationPlans.status, "active"),
        ),
      ),
  ]);

  void inclusionRows;
  void publishTaskRows;
  void monthlyPlanRows;

  const monthlyFocusQuestionIds = new Set<number>();
  for (const row of monthlyPlanTaskRows) {
    if (row.relatedQuestionId != null) monthlyFocusQuestionIds.add(row.relatedQuestionId);
  }

  const competitorRatesByQuestionId = computeQuestionCompetitorRates(aiRunRows);

  const publishedArticleIds = new Set<number>();
  for (const row of publishRecordRows) {
    if (row.articleId != null) publishedArticleIds.add(row.articleId);
  }
  for (const row of publishTaskRows) {
    if (row.articleId != null && (row.status === "published" || row.status === "success")) {
      publishedArticleIds.add(row.articleId);
    }
  }

  const articleLinks: QuestionArticleLink[] = articleRows.map(article => ({
    status: resolveArticleStatusForLink(article, publishedArticleIds),
    generationBasis: article.generationBasis,
  }));

  const runsByQuestionId = new Map<number, AiTestRunSnapshot[]>();
  for (const run of aiRunRows) {
    const bucket = runsByQuestionId.get(run.questionId) ?? [];
    bucket.push({
      questionId: run.questionId,
      testedAt: run.testedAt,
      mentionedCompany: Boolean(run.mentionedCompany),
      recommendedCompany: Boolean(run.recommendedCompany),
      competitorMentioned: Boolean(run.competitorMentioned),
      competitorNames: run.competitorNames ?? [],
    });
    runsByQuestionId.set(run.questionId, bucket);
  }

  const hasDiagnosisData =
    roundRows.some(round => round.status === "completed") ||
    aiRunRows.length > 0 ||
    inclusionRows.length > 0;

  const baseQuestions = filterRowsWithNumericId(questionRows) as SearchPoolQuestionRow[];
  const enrichedQuestions = sortSearchPoolQuestions(
    baseQuestions.map(question => {
      const hasContentTask = questionHasContentTask(question, taskRows, articleLinks);
      return enrichSearchPoolQuestion({
        question,
        runs: runsByQuestionId.get(question.id) ?? [],
        articles: articleLinks,
        hasContentTask,
        hasDiagnosisData,
        competitorRate: competitorRatesByQuestionId.get(question.id),
        monthlyFocusQuestionIds,
      });
    }),
  );

  const opportunityOverview = buildQuestionOpportunityOverview({ questions: enrichedQuestions });
  const baseOverview = buildQuestionPoolGapOverview({
    questions: enrichedQuestions,
    contentTaskCount: taskRows.length,
    hasDiagnosisData,
  });

  return {
    questions: enrichedQuestions,
    hasDiagnosisData,
    contentTaskCount: taskRows.length,
    overview: {
      ...baseOverview,
      coveredContentQuestions: opportunityOverview.coveredContentQuestions,
      competitorOccupiedQuestions: opportunityOverview.competitorOccupiedQuestions,
      monthlyFocusQuestions: opportunityOverview.monthlyFocusQuestions,
    },
    groupStats: buildSearchPoolGroupStats(enrichedQuestions, hasDiagnosisData, inferContext),
  };
}

export function buildQuestionContentTaskCard(question: {
  questionText: string;
  targetKeywords?: string[] | null;
}) {
  return JSON.stringify({
    articleTitle: question.questionText.trim().slice(0, 25),
    keyPoints: ["", "", ""],
    targetKeywords: question.targetKeywords ?? [],
    recommendedPlatform: ["知乎"],
    contentType: "场景指南",
  });
}

export function buildQuestionContentTaskExecutionSuggestion(question: {
  questionText: string;
  targetKeywords?: string[] | null;
}) {
  const card = buildQuestionContentTaskCard(question);
  return [
    "请内容编辑围绕以下搜索问题产出行业文章：",
    `目标问题：${question.questionText.trim()}`,
    `目标关键词：${(question.targetKeywords ?? []).join("、") || "（待补充）"}`,
    `内容类型：场景指南`,
    "生成要求：问题式标题；首段直接定义品牌；使用标准品牌表达；说明适用客户、解决的问题及与普通工具的区别；包含 FAQ、不承诺项和可引用总结段。",
    "验证口径：以上结构用于提高被搜索和 AI 识别、引用的概率，不保证收录或 AI 推荐。",
    "",
    GEO_OPTIMIZATION_TASK_CARD_MARK,
    card,
  ].join("\n");
}
