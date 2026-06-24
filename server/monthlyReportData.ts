import { and, desc, eq, gte } from "drizzle-orm";
import {
  aiTestRuns,
  brandSourceRecords,
  geoArticles,
  geoInclusionMonitoringRecords,
  geoPublishRecords,
  monthlyOptimizationPlans,
  monthlyOptimizationTasks,
  questions,
  trustEvidenceItems,
} from "../drizzle/schema";
import {
  buildMonthlyReportView,
  type MonthlyReportContentAssetEffectInput,
  type MonthlyReportContentItem,
  type MonthlyReportEvidenceItem,
  type MonthlyReportSourceItem,
} from "@shared/monthlyReportView";
import {
  computeMonthlyPlanProgress,
  resolveMonthlyPlanWorkspaceStage,
} from "@shared/monthlyPlanGeneration";
import { getDb } from "./db";

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("zh-CN", { hour12: false });
}

async function loadPlanTasks(planId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(monthlyOptimizationTasks)
    .where(eq(monthlyOptimizationTasks.planId, planId))
    .orderBy(monthlyOptimizationTasks.id);
}

async function loadPlanActionItems(
  projectId: number,
  planGeneratedAt: Date,
): Promise<{
  contentItems: MonthlyReportContentItem[];
  contentAssetEffectRows: MonthlyReportContentAssetEffectInput[];
  sourceItems: MonthlyReportSourceItem[];
  evidenceItems: MonthlyReportEvidenceItem[];
}> {
  const db = await getDb();
  if (!db) {
    return { contentItems: [], contentAssetEffectRows: [], sourceItems: [], evidenceItems: [] };
  }

  const [articles, publishRecords, monitoringRecords, questionRows, sourceRows, evidenceRows] = await Promise.all([
    db.select().from(geoArticles).where(eq(geoArticles.projectId, projectId)),
    db.select().from(geoPublishRecords).where(eq(geoPublishRecords.projectId, projectId)),
    db
      .select()
      .from(geoInclusionMonitoringRecords)
      .where(eq(geoInclusionMonitoringRecords.projectId, projectId)),
    db.select().from(questions).where(eq(questions.projectId, projectId)),
    db
      .select()
      .from(brandSourceRecords)
      .where(
        and(
          eq(brandSourceRecords.projectId, projectId),
          gte(brandSourceRecords.createdAt, planGeneratedAt),
        ),
      ),
    db
      .select()
      .from(trustEvidenceItems)
      .where(
        and(
          eq(trustEvidenceItems.projectId, projectId),
          gte(trustEvidenceItems.createdAt, planGeneratedAt),
        ),
      ),
  ]);

  const questionTextById = new Map<number, string>();
  for (const q of questionRows) {
    questionTextById.set(q.id, q.questionText);
  }

  const publishByArticleId = new Map<number, (typeof publishRecords)[number]>();
  const publishById = new Map<number, (typeof publishRecords)[number]>();
  for (const record of publishRecords) {
    publishById.set(record.id, record);
    if (record.publishedAt && record.publishedAt >= planGeneratedAt) {
      publishByArticleId.set(record.articleId, record);
    }
  }

  const articleById = new Map<number, (typeof articles)[number]>();
  for (const article of articles) {
    articleById.set(article.id, article);
  }

  const contentItems: MonthlyReportContentItem[] = [];
  for (const article of articles) {
    const publish = publishByArticleId.get(article.id);
    if (!publish && article.status !== "已发布") continue;
    const publishedAt = publish?.publishedAt ?? article.updatedAt ?? article.createdAt;
    if (publishedAt < planGeneratedAt) continue;
    const questionId = article.targetQuestionId ? Number(article.targetQuestionId) : null;
    contentItems.push({
      articleId: article.id,
      title: article.title,
      platform: String(publish?.publishChannel ?? "未标注平台"),
      publishedAt: toIso(publishedAt),
      questionText:
        questionId != null && !Number.isNaN(questionId)
          ? questionTextById.get(questionId) ?? null
          : null,
    });
  }

  const contentAssetEffectRows: MonthlyReportContentAssetEffectInput[] = [];
  for (const record of monitoringRecords) {
    const article = articleById.get(record.articleId);
    const publish = publishById.get(record.publishRecordId) ?? publishByArticleId.get(record.articleId);
    const publishedAt = publish?.publishedAt ?? article?.updatedAt ?? article?.createdAt ?? null;
    if (!publishedAt || publishedAt < planGeneratedAt) continue;
    const questionId = article?.targetQuestionId ? Number(article.targetQuestionId) : null;
    contentAssetEffectRows.push({
      id: record.id,
      articleId: record.articleId,
      title: article?.title?.trim() || publish?.publishTitle?.trim() || "未命名内容资产",
      platform: String(publish?.publishChannel ?? "未标注平台"),
      questionText:
        questionId != null && !Number.isNaN(questionId)
          ? questionTextById.get(questionId) ?? null
          : null,
      publishedAt,
      publicUrl: record.publicUrl || publish?.publishUrl || null,
      effectInclusionStatus: record.effectInclusionStatus,
      inclusionVerifiedAt: record.inclusionVerifiedAt,
      inclusionKeywords: record.inclusionKeywords ?? [],
      readCount: record.readCount,
      impressionCount: record.impressionCount,
      interactionCount: record.interactionCount,
      searchTriggerKeywords: record.searchTriggerKeywords ?? [],
      effectDataSource: record.effectDataSource,
      evidenceScreenshotUrl: record.evidenceScreenshotUrl,
    });
  }

  const sourceItems: MonthlyReportSourceItem[] = sourceRows.map(row => ({
    id: row.id,
    name: row.sourceName?.trim() || row.platformName?.trim() || row.platform,
    type: row.platform,
    adoptedAt: toIso(row.createdAt),
  }));

  const evidenceItems: MonthlyReportEvidenceItem[] = evidenceRows.map(row => ({
    id: row.id,
    title: row.title,
    type: row.evidenceType,
    addedAt: toIso(row.createdAt),
  }));

  return { contentItems, contentAssetEffectRows, sourceItems, evidenceItems };
}

export async function loadMonthlyReportData(
  projectId: number,
  planId?: number,
  latestMaturity?: {
    totalScore: number;
    dimensionScores: Record<string, number>;
  } | null,
) {
  const db = await getDb();
  if (!db) return null;

  let plan = null;
  if (planId) {
    const rows = await db
      .select()
      .from(monthlyOptimizationPlans)
      .where(and(eq(monthlyOptimizationPlans.id, planId), eq(monthlyOptimizationPlans.projectId, projectId)))
      .limit(1);
    plan = rows[0] ?? null;
  } else {
    const activeRows = await db
      .select()
      .from(monthlyOptimizationPlans)
      .where(and(eq(monthlyOptimizationPlans.projectId, projectId), eq(monthlyOptimizationPlans.status, "active")))
      .orderBy(desc(monthlyOptimizationPlans.roundNumber))
      .limit(1);
    plan = activeRows[0] ?? null;
    if (!plan) {
      const latestRows = await db
        .select()
        .from(monthlyOptimizationPlans)
        .where(eq(monthlyOptimizationPlans.projectId, projectId))
        .orderBy(desc(monthlyOptimizationPlans.roundNumber))
        .limit(1);
      plan = latestRows[0] ?? null;
    }
  }

  const historyPlans = await db
    .select()
    .from(monthlyOptimizationPlans)
    .where(eq(monthlyOptimizationPlans.projectId, projectId))
    .orderBy(desc(monthlyOptimizationPlans.roundNumber))
    .limit(20);

  const historyWithProgress = await Promise.all(
    historyPlans.map(async entry => {
      const tasks = await loadPlanTasks(entry.id);
      return {
        plan: entry,
        progress: computeMonthlyPlanProgress(tasks),
      };
    }),
  );

  const aiTestRunRows = await db
    .select({
      questionId: aiTestRuns.questionId,
      mentionedCompany: aiTestRuns.mentionedCompany,
      recommendedCompany: aiTestRuns.recommendedCompany,
      competitorMentioned: aiTestRuns.competitorMentioned,
      platform: aiTestRuns.platform,
      testedAt: aiTestRuns.testedAt,
    })
    .from(aiTestRuns)
    .where(eq(aiTestRuns.projectId, projectId));

  const questionRows = await db
    .select({
      id: questions.id,
      enabled: questions.enabled,
      relatedContentTask: questions.relatedContentTask,
      questionType: questions.questionType,
      searchPoolType: questions.searchPoolType,
    })
    .from(questions)
    .where(eq(questions.projectId, projectId));

  const questionTypeByQuestionId = new Map<number, string>();
  let uncoveredQuestionCount = 0;
  for (const question of questionRows) {
    const type = question.searchPoolType?.trim() || question.questionType?.trim() || "指定问题";
    questionTypeByQuestionId.set(question.id, type);
    if (Number(question.enabled) !== 0 && !question.relatedContentTask) {
      uncoveredQuestionCount += 1;
    }
  }

  const sortedPlans = [...historyPlans].sort((a, b) => a.roundNumber - b.roundNumber);
  const currentPlanIndex = plan ? sortedPlans.findIndex(entry => entry.id === plan.id) : -1;
  const previousPlan = currentPlanIndex > 0 ? sortedPlans[currentPlanIndex - 1] : null;
  const nextPlan =
    currentPlanIndex >= 0 && currentPlanIndex < sortedPlans.length - 1
      ? sortedPlans[currentPlanIndex + 1]
      : null;

  if (!plan) {
    return buildMonthlyReportView({
      plan: null,
      tasks: [],
      planPhase: "no_plan",
      aiTestRuns: aiTestRunRows,
      contentItems: [],
      contentAssetEffectRows: [],
      sourceItems: [],
      evidenceItems: [],
      latestTotalScore: latestMaturity?.totalScore ?? null,
      latestDimensionScores: latestMaturity?.dimensionScores ?? null,
      historyPlans: historyWithProgress,
    });
  }

  const tasks = await loadPlanTasks(plan.id);
  const progress = computeMonthlyPlanProgress(tasks);
  const planPhase =
    resolveMonthlyPlanWorkspaceStage({
      hasActivePlan: plan.status === "active",
      latestPlanStatus: plan.status,
      allTasksCompleted: progress.completedCount === progress.totalCount && progress.totalCount > 0,
      retestScheduledAt: plan.retestScheduledAt,
      retestCompletedAt: plan.retestCompletedAt,
    }) ?? "no_plan";

  const generatedAt =
    plan.generatedAt instanceof Date ? plan.generatedAt : new Date(plan.generatedAt);
  const actionItems = await loadPlanActionItems(projectId, generatedAt);

  return buildMonthlyReportView({
    plan,
    tasks,
    planPhase,
    aiTestRuns: aiTestRunRows,
    contentItems: actionItems.contentItems,
    contentAssetEffectRows: actionItems.contentAssetEffectRows,
    sourceItems: actionItems.sourceItems,
    evidenceItems: actionItems.evidenceItems,
    latestTotalScore: latestMaturity?.totalScore ?? plan.resultMaturityScore,
    latestDimensionScores:
      latestMaturity?.dimensionScores ?? plan.resultDimensionScores ?? plan.baselineDimensionScores,
    uncoveredQuestionCount,
    questionTypeByQuestionId,
    previousPlanGeneratedAt: previousPlan?.generatedAt ?? null,
    nextPlanGeneratedAt: nextPlan?.generatedAt ?? null,
    historyPlans: historyWithProgress,
  });
}
