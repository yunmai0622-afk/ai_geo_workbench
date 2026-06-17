import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { buildContentOptimizationTaskView } from "@shared/contentOptimizationTaskView";
import {
  geoArticles,
  monthlyOptimizationPlans,
  monthlyOptimizationTasks,
  publishTasks,
  questions,
  testRounds,
} from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { requireProjectAccess } from "./projectAccess";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
  return db;
}

function questionIdMatch(questionId: number) {
  return eq(geoArticles.targetQuestionId, String(questionId));
}

async function loadQuestion(projectId: number, questionId: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(questions)
    .where(and(eq(questions.projectId, projectId), eq(questions.id, questionId)))
    .limit(1);
  return rows[0] ?? null;
}

async function loadArticlesForQuestion(projectId: number, questionId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(geoArticles)
    .where(and(eq(geoArticles.projectId, projectId), questionIdMatch(questionId)))
    .orderBy(desc(geoArticles.createdAt));
}

async function loadPublishTasksForArticles(articleIds: number[]) {
  if (articleIds.length === 0) return [];
  const db = await requireDb();
  return db
    .select({
      articleId: publishTasks.articleId,
      platform: publishTasks.platform,
      status: publishTasks.status,
      agentFinishedAt: publishTasks.agentFinishedAt,
      updatedAt: publishTasks.updatedAt,
      createdAt: publishTasks.createdAt,
    })
    .from(publishTasks)
    .where(inArray(publishTasks.articleId, articleIds))
    .orderBy(desc(publishTasks.createdAt));
}

async function loadMonthlyPlanContext(projectId: number, questionId: number) {
  const db = await requireDb();
  const plans = await db
    .select()
    .from(monthlyOptimizationPlans)
    .where(
      and(
        eq(monthlyOptimizationPlans.projectId, projectId),
        eq(monthlyOptimizationPlans.status, "active"),
      ),
    )
    .orderBy(desc(monthlyOptimizationPlans.roundNumber))
    .limit(1);
  const plan = plans[0];
  if (!plan) return null;

  const tasks = await db
    .select()
    .from(monthlyOptimizationTasks)
    .where(
      and(
        eq(monthlyOptimizationTasks.planId, plan.id),
        eq(monthlyOptimizationTasks.relatedQuestionId, questionId),
        eq(monthlyOptimizationTasks.taskType, "content_generation"),
      ),
    )
    .limit(1);
  const task = tasks[0];
  if (!task) return null;

  const meta = (task.metadata as Record<string, unknown> | null) ?? {};
  return {
    planId: plan.id,
    planTitle: `第 ${plan.roundNumber} 轮本月优化计划`,
    taskTitle: task.title,
    taskReason: task.reason,
    targetDimension: task.targetDimension,
    actionLabel: `所属本月计划：动作 ${meta.actionIndex ?? "—"} - ${task.title}`,
  };
}

async function loadTestRounds(projectId: number) {
  const db = await requireDb();
  return db
    .select({
      id: testRounds.id,
      roundType: testRounds.roundType,
      status: testRounds.status,
      finishedAt: testRounds.finishedAt,
    })
    .from(testRounds)
    .where(eq(testRounds.projectId, projectId))
    .orderBy(desc(testRounds.createdAt));
}

export async function buildCurrentContentOptimizationTaskView(
  projectId: number,
  questionId: number,
) {
  const question = await loadQuestion(projectId, questionId);
  if (!question) {
    throw new TRPCError({ code: "NOT_FOUND", message: "未找到该搜索问题" });
  }

  const [articles, monthlyPlan] = await Promise.all([
    loadArticlesForQuestion(projectId, questionId),
    loadMonthlyPlanContext(projectId, questionId),
  ]);
  const articleIds = articles.map(article => article.id);
  const publishTaskRows = await loadPublishTasksForArticles(articleIds);
  const testRoundRows = await loadTestRounds(projectId);

  const completedPublishTasks = publishTaskRows
    .filter(task => task.status === "completed")
    .map(task => ({
      status: task.status,
      agentFinishedAt: task.agentFinishedAt,
      updatedAt: task.updatedAt,
      createdAt: task.createdAt,
    }));

  return buildContentOptimizationTaskView({
    projectId,
    question: {
      id: question.id,
      questionText: question.questionText,
      questionType: question.questionType,
      searchPoolType: question.searchPoolType,
      relatedGeoGap: question.relatedGeoGap,
      contentGapTags: question.contentGapTags ?? undefined,
    },
    monthlyPlan,
    articles: articles.map(article => ({
      id: article.id,
      title: article.title,
      markdownContent: article.markdownContent,
      status: article.status,
      lifecycleStatus: article.lifecycleStatus,
      lifecycleEvents: article.lifecycleEvents,
      geoQualityScore: article.geoQualityScore,
      geoQualityRecommendation: article.geoQualityRecommendation,
      geoQualityStale: article.geoQualityStale,
      contentReviewStatus: article.contentReviewStatus,
      publishedAt: article.publishedAt,
      generationBasis: article.generationBasis ?? undefined,
    })),
    publishTasks: publishTaskRows.map(task => ({
      articleId: task.articleId,
      platform: task.platform,
      status: task.status,
    })),
    completedPublishTasks,
    testRounds: testRoundRows,
  });
}

export const geoContentTasksRouter = router({
  getCurrentTaskView: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        questionId: z.number().int().positive(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx, input.projectId);
      return buildCurrentContentOptimizationTaskView(input.projectId, input.questionId);
    }),
});
