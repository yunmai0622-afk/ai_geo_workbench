import { and, eq } from "drizzle-orm";
import {
  brandSourceRecords,
  geoArticles,
  geoPublishRecords,
  monthlyOptimizationPlans,
  monthlyOptimizationTasks,
  trustEvidenceItems,
} from "../drizzle/schema";
import { isMonthlyPlanRetestReady } from "@shared/monthlyPlanGeneration";
import { completeMonthlyPlanRetest } from "./monthlyPlanRetestCompletion";
import { getDb } from "./db";

const RETEST_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

function readTargetCount(metadata: Record<string, unknown> | null | undefined): number {
  const value = metadata?.targetCount;
  return typeof value === "number" && value > 0 ? value : 1;
}

function readBaselineCount(metadata: Record<string, unknown> | null | undefined): number {
  const value = metadata?.baselineCount;
  return typeof value === "number" && value >= 0 ? value : 0;
}

async function markTaskCompleted(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  taskId: number,
  linkedEntityId?: number | null,
) {
  const now = new Date();
  await db
    .update(monthlyOptimizationTasks)
    .set({
      status: "completed",
      completedAt: now,
      ...(linkedEntityId != null ? { linkedEntityId } : {}),
    })
    .where(eq(monthlyOptimizationTasks.id, taskId));
}

export async function syncMonthlyPlanProgressForProject(projectId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const planRows = await db
    .select()
    .from(monthlyOptimizationPlans)
    .where(and(eq(monthlyOptimizationPlans.projectId, projectId), eq(monthlyOptimizationPlans.status, "active")))
    .limit(1);
  const plan = planRows[0];
  if (!plan) return;

  const tasks = await db
    .select()
    .from(monthlyOptimizationTasks)
    .where(eq(monthlyOptimizationTasks.planId, plan.id));

  const pendingTasks = tasks.filter(t => t.status !== "completed");
  if (pendingTasks.length === 0) {
    await maybeScheduleRetest(db, plan.id, tasks);
    await maybeAutoCompleteRetest(plan.id, tasks, true);
    return;
  }

  const [trustRows, sourceRows, articleRows, publishRows] = await Promise.all([
    db.select().from(trustEvidenceItems).where(eq(trustEvidenceItems.projectId, projectId)),
    db.select().from(brandSourceRecords).where(eq(brandSourceRecords.projectId, projectId)),
    db.select().from(geoArticles).where(eq(geoArticles.projectId, projectId)),
    db.select().from(geoPublishRecords).where(eq(geoPublishRecords.projectId, projectId)),
  ]);

  const verifiedEvidenceCount = trustRows.filter(item => item.verificationStatus === "verified").length;
  const publishedArticleIds = new Set(
    articleRows.filter(a => a.status === "已发布").map(a => a.id),
  );
  const publishedQuestionIds = new Set<number>();
  for (const article of articleRows) {
    if (article.status !== "已发布") continue;
    const qid = article.targetQuestionId ? Number(article.targetQuestionId) : null;
    if (qid && !Number.isNaN(qid)) publishedQuestionIds.add(qid);
    if (publishedArticleIds.has(article.id) && article.targetQuestionId) {
      publishedQuestionIds.add(Number(article.targetQuestionId));
    }
  }

  for (const task of pendingTasks) {
    const metadata = (task.metadata as Record<string, unknown> | null) ?? {};
    if (task.taskType === "evidence_addition") {
      const target = readTargetCount(metadata);
      const baseline = readBaselineCount(metadata);
      if (verifiedEvidenceCount >= baseline + target) {
        await markTaskCompleted(db, task.id);
      }
      continue;
    }
    if (task.taskType === "source_discovery") {
      const target = readTargetCount(metadata);
      const baseline = readBaselineCount(metadata);
      if (sourceRows.length >= baseline + target) {
        await markTaskCompleted(db, task.id);
      }
      continue;
    }
    if (task.taskType === "content_generation") {
      const questionId = task.relatedQuestionId;
      if (questionId != null && publishedQuestionIds.has(questionId)) {
        const linkedArticle = articleRows.find(
          a =>
            a.status === "已发布" &&
            (a.targetQuestionId === String(questionId) || Number(a.targetQuestionId) === questionId),
        );
        await markTaskCompleted(db, task.id, linkedArticle?.id ?? null);
      }
    }
  }

  const refreshedTasks = await db
    .select()
    .from(monthlyOptimizationTasks)
    .where(eq(monthlyOptimizationTasks.planId, plan.id));
  await maybeScheduleRetest(db, plan.id, refreshedTasks, publishRows.length > 0);
  await maybeAutoCompleteRetest(plan.id, refreshedTasks, publishRows.length > 0);
}

async function maybeAutoCompleteRetest(
  planId: number,
  tasks: Array<typeof monthlyOptimizationTasks.$inferSelect>,
  hasPublishedContent: boolean,
) {
  const db = await getDb();
  if (!db) return;

  const planRows = await db
    .select()
    .from(monthlyOptimizationPlans)
    .where(eq(monthlyOptimizationPlans.id, planId))
    .limit(1);
  const plan = planRows[0];
  if (!plan || plan.status !== "active" || plan.retestCompletedAt) return;

  const allCompleted = tasks.length > 0 && tasks.every(t => t.status === "completed");
  if (!allCompleted || !hasPublishedContent || !plan.retestScheduledAt) return;
  if (!isMonthlyPlanRetestReady({ retestScheduledAt: plan.retestScheduledAt })) return;

  try {
    await completeMonthlyPlanRetest(planId);
  } catch {
    // 复测自动完成失败时不阻断同步流程
  }
}

async function maybeScheduleRetest(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  planId: number,
  tasks: Array<typeof monthlyOptimizationTasks.$inferSelect>,
  hasPublishedContent = true,
) {
  const contentTasks = tasks.filter(t => t.taskType === "content_generation");
  const allContentDone =
    contentTasks.length === 0 || contentTasks.every(t => t.status === "completed");
  if (!allContentDone || !hasPublishedContent) return;

  const planRows = await db
    .select()
    .from(monthlyOptimizationPlans)
    .where(eq(monthlyOptimizationPlans.id, planId))
    .limit(1);
  const plan = planRows[0];
  if (!plan || plan.retestScheduledAt) return;

  const retestScheduledAt = new Date(Date.now() + RETEST_DELAY_MS);
  await db
    .update(monthlyOptimizationPlans)
    .set({ retestScheduledAt })
    .where(eq(monthlyOptimizationPlans.id, planId));
}

export async function syncMonthlyPlanOnArticlePublished(projectId: number, articleId: number): Promise<void> {
  await syncMonthlyPlanProgressForProject(projectId);
  const db = await getDb();
  if (!db) return;
  const articleRows = await db
    .select()
    .from(geoArticles)
    .where(eq(geoArticles.id, articleId))
    .limit(1);
  const article = articleRows[0];
  if (!article?.targetQuestionId) return;

  const planRows = await db
    .select()
    .from(monthlyOptimizationPlans)
    .where(and(eq(monthlyOptimizationPlans.projectId, projectId), eq(monthlyOptimizationPlans.status, "active")))
    .limit(1);
  const plan = planRows[0];
  if (!plan) return;

  const questionId = Number(article.targetQuestionId);
  if (Number.isNaN(questionId)) return;

  const taskRows = await db
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
  const task = taskRows[0];
  if (task && task.status !== "completed") {
    await markTaskCompleted(db, task.id, articleId);
    await syncMonthlyPlanProgressForProject(projectId);
  }
}

export async function syncMonthlyPlanOnProfileSaved(projectId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const planRows = await db
    .select()
    .from(monthlyOptimizationPlans)
    .where(and(eq(monthlyOptimizationPlans.projectId, projectId), eq(monthlyOptimizationPlans.status, "active")))
    .limit(1);
  const plan = planRows[0];
  if (!plan) return;

  const tasks = await db
    .select()
    .from(monthlyOptimizationTasks)
    .where(
      and(
        eq(monthlyOptimizationTasks.planId, plan.id),
        eq(monthlyOptimizationTasks.taskType, "profile_completion"),
      ),
    );
  for (const task of tasks) {
    if (task.status !== "completed") {
      await markTaskCompleted(db, task.id);
    }
  }
  await syncMonthlyPlanProgressForProject(projectId);
}

export async function syncMonthlyPlanOnTrustOrSourceChanged(projectId: number): Promise<void> {
  await syncMonthlyPlanProgressForProject(projectId);
}
