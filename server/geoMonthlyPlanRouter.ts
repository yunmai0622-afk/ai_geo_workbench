import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  buildBaselineDimensionScores,
  buildMonthlyPlanComparison,
  buildMonthlyPlanFocusSummary,
  buildMonthlyPlanTaskDrafts,
  computeMonthlyPlanProgress,
  resolveMonthlyPlanWorkspaceStage,
  resolveTopWeakDimensions,
} from "@shared/monthlyPlanGeneration";
import {
  buildMaturityReport,
  calculateGeoMaturityScores,
  type GeoMaturityScores,
} from "@shared/geoMaturityScoring";
import {
  aiTestRuns,
  brandSourceRecords,
  customerCases,
  enterpriseGeoProfiles,
  entityConsistencyChecks,
  geoMaturityScores,
  monthlyOptimizationPlans,
  monthlyOptimizationTasks,
  questions,
  trustEvidenceItems,
} from "../drizzle/schema";
import { getDb } from "./db";
import { requireProjectAccess } from "./projectAccess";
import { protectedProcedure, router } from "./_core/trpc";
import { syncMonthlyPlanProgressForProject } from "./monthlyPlanSync";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
  return db;
}

async function loadLatestMaturityRow(projectId: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(geoMaturityScores)
    .where(eq(geoMaturityScores.projectId, projectId))
    .orderBy(desc(geoMaturityScores.calculatedAt))
    .limit(1);
  return rows[0] ?? null;
}

function rowToMaturityScores(row: typeof geoMaturityScores.$inferSelect): GeoMaturityScores {
  return {
    brandIdentityScore: row.brandIdentityScore ?? 0,
    categoryPositioningScore: row.categoryPositioningScore ?? 0,
    questionCoverageScore: row.questionCoverageScore ?? 0,
    sourceGraphScore: row.sourceGraphScore ?? 0,
    trustEvidenceScore: row.trustEvidenceScore ?? 0,
    aiTestPerformanceScore: row.aiTestPerformanceScore ?? 0,
    totalScore: row.totalScore,
    calculationDetail: (row.calculationDetail as Record<string, unknown>) ?? {},
  };
}

async function loadUncoveredQuestionIds(projectId: number): Promise<number[]> {
  const db = await requireDb();
  const rows = await db
    .select({ id: questions.id, enabled: questions.enabled, relatedContentTask: questions.relatedContentTask })
    .from(questions)
    .where(eq(questions.projectId, projectId));
  return rows
    .filter(q => Number(q.enabled) !== 0 && !q.relatedContentTask)
    .map(q => q.id);
}

async function loadActivePlan(projectId: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(monthlyOptimizationPlans)
    .where(and(eq(monthlyOptimizationPlans.projectId, projectId), eq(monthlyOptimizationPlans.status, "active")))
    .orderBy(desc(monthlyOptimizationPlans.roundNumber))
    .limit(1);
  return rows[0] ?? null;
}

async function loadPlanTasks(planId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(monthlyOptimizationTasks)
    .where(eq(monthlyOptimizationTasks.planId, planId))
    .orderBy(monthlyOptimizationTasks.id);
}

async function loadLatestPlan(projectId: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(monthlyOptimizationPlans)
    .where(eq(monthlyOptimizationPlans.projectId, projectId))
    .orderBy(desc(monthlyOptimizationPlans.roundNumber))
    .limit(1);
  return rows[0] ?? null;
}

async function resolveNextRoundNumber(projectId: number): Promise<number> {
  const latest = await loadLatestPlan(projectId);
  return (latest?.roundNumber ?? 0) + 1;
}

export async function generateMonthlyPlan(projectId: number) {
  const db = await requireDb();
  const existingActive = await loadActivePlan(projectId);
  if (existingActive) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "当前已有进行中的月度优化计划，请先完成复测或继续执行" });
  }

  const latestMaturity = await loadLatestMaturityRow(projectId);
  if (!latestMaturity || latestMaturity.totalScore <= 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "请先完成 AI 品牌成熟度评估后再生成本月优化计划" });
  }

  const maturityScores = rowToMaturityScores(latestMaturity);
  const [trustRows, sourceRows, uncoveredQuestionIds] = await Promise.all([
    db.select().from(trustEvidenceItems).where(eq(trustEvidenceItems.projectId, projectId)),
    db.select().from(brandSourceRecords).where(eq(brandSourceRecords.projectId, projectId)),
    loadUncoveredQuestionIds(projectId),
  ]);
  const verifiedEvidenceCount = trustRows.filter(item => item.verificationStatus === "verified").length;

  const drafts = buildMonthlyPlanTaskDrafts({
    maturityScores,
    verifiedEvidenceCount,
    brandSourceCount: sourceRows.length,
    uncoveredQuestionIds,
  });
  if (drafts.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "当前成熟度各维度已达标，暂无需生成优化计划" });
  }

  const roundNumber = await resolveNextRoundNumber(projectId);
  const baselineDimensionScores = buildBaselineDimensionScores(maturityScores);
  const weakDimensions = resolveTopWeakDimensions(maturityScores);
  const focusSummary = buildMonthlyPlanFocusSummary(weakDimensions);

  const insertedPlan = await db.insert(monthlyOptimizationPlans).values({
    projectId,
    roundNumber,
    status: "active",
    baselineMaturityScore: maturityScores.totalScore,
    baselineDimensionScores,
  }).$returningId();
  const planId = insertedPlan[0]?.id;
  if (!planId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "创建月度计划失败" });

  if (drafts.length > 0) {
    await db.insert(monthlyOptimizationTasks).values(
      drafts.map((draft, index) => ({
        planId,
        projectId,
        taskType: draft.taskType,
        targetDimension: draft.targetDimension,
        relatedQuestionId: draft.relatedQuestionId ?? null,
        title: draft.title,
        reason: draft.reason,
        actionUrl: draft.actionUrl,
        metadata: { ...draft.metadata, actionIndex: index + 1, focusSummary },
        status: "pending" as const,
      })),
    );
  }

  const plan = (await db.select().from(monthlyOptimizationPlans).where(eq(monthlyOptimizationPlans.id, planId)).limit(1))[0]!;
  const tasks = await loadPlanTasks(planId);
  return { plan, tasks, focusSummary };
}

function enrichPlanView(
  plan: typeof monthlyOptimizationPlans.$inferSelect,
  tasks: Array<typeof monthlyOptimizationTasks.$inferSelect>,
) {
  const progress = computeMonthlyPlanProgress(tasks);
  const focusSummary =
    (tasks[0]?.metadata as Record<string, unknown> | null)?.focusSummary?.toString() ??
    buildMonthlyPlanFocusSummary(
      resolveTopWeakDimensions({
        brandIdentityScore: plan.baselineDimensionScores.brandIdentity ?? 0,
        categoryPositioningScore: plan.baselineDimensionScores.categoryPositioning ?? 0,
        questionCoverageScore: plan.baselineDimensionScores.questionCoverage ?? 0,
        sourceGraphScore: plan.baselineDimensionScores.sourceGraph ?? 0,
        trustEvidenceScore: plan.baselineDimensionScores.trustEvidence ?? 0,
        aiTestPerformanceScore: plan.baselineDimensionScores.aiTestPerformance ?? 0,
        totalScore: plan.baselineMaturityScore,
        calculationDetail: {},
      }),
    );
  const planPhase = resolveMonthlyPlanWorkspaceStage({
    hasActivePlan: plan.status === "active",
    latestPlanStatus: plan.status,
    allTasksCompleted: progress.completedCount === progress.totalCount && progress.totalCount > 0,
    retestScheduledAt: plan.retestScheduledAt,
    retestCompletedAt: plan.retestCompletedAt,
  });
  return { plan, tasks, progress, focusSummary, planPhase };
}

export const geoMonthlyPlanRouter = router({
  generate: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx, input.projectId);
      return generateMonthlyPlan(input.projectId);
    }),

  getCurrent: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx, input.projectId);
      await syncMonthlyPlanProgressForProject(input.projectId);
      const plan = await loadActivePlan(input.projectId);
      if (!plan) {
        const latest = await loadLatestPlan(input.projectId);
        if (!latest || latest.status !== "completed") return null;
        const tasks = await loadPlanTasks(latest.id);
        return enrichPlanView(latest, tasks);
      }
      const tasks = await loadPlanTasks(plan.id);
      return enrichPlanView(plan, tasks);
    }),

  getHistory: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        limit: z.number().int().min(1).max(20).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx, input.projectId);
      const db = await requireDb();
      const limit = input.limit ?? 10;
      const plans = await db
        .select()
        .from(monthlyOptimizationPlans)
        .where(eq(monthlyOptimizationPlans.projectId, input.projectId))
        .orderBy(desc(monthlyOptimizationPlans.roundNumber))
        .limit(limit);
      return Promise.all(
        plans.map(async plan => {
          const tasks = await loadPlanTasks(plan.id);
          const progress = computeMonthlyPlanProgress(tasks);
          return {
            plan,
            progress,
            summary:
              plan.resultMaturityScore != null
                ? `成熟度 ${plan.baselineMaturityScore} → ${plan.resultMaturityScore} 分`
                : `基线 ${plan.baselineMaturityScore} 分，完成 ${progress.completedCount}/${progress.totalCount} 项`,
          };
        }),
      );
    }),

  completeTask: protectedProcedure
    .input(z.object({ taskId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const rows = await db
        .select()
        .from(monthlyOptimizationTasks)
        .where(eq(monthlyOptimizationTasks.id, input.taskId))
        .limit(1);
      const task = rows[0];
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
      await requireProjectAccess(ctx, task.projectId);
      const now = new Date();
      await db
        .update(monthlyOptimizationTasks)
        .set({ status: "completed", completedAt: now })
        .where(eq(monthlyOptimizationTasks.id, task.id));
      await syncMonthlyPlanProgressForProject(task.projectId);
      return { success: true as const };
    }),

  triggerRetest: protectedProcedure
    .input(z.object({ planId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const planRows = await db
        .select()
        .from(monthlyOptimizationPlans)
        .where(eq(monthlyOptimizationPlans.id, input.planId))
        .limit(1);
      const plan = planRows[0];
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "月度计划不存在" });
      await requireProjectAccess(ctx, plan.projectId);

      const [
        profileRows,
        entityCheckRows,
        brandSourceRows,
        questionRows,
        trustEvidenceRows,
        customerCaseRows,
        aiTestRunRows,
      ] = await Promise.all([
        db.select().from(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.projectId, plan.projectId)).limit(1),
        db.select().from(entityConsistencyChecks).where(eq(entityConsistencyChecks.projectId, plan.projectId)),
        db.select().from(brandSourceRecords).where(eq(brandSourceRecords.projectId, plan.projectId)),
        db.select().from(questions).where(eq(questions.projectId, plan.projectId)),
        db.select().from(trustEvidenceItems).where(eq(trustEvidenceItems.projectId, plan.projectId)),
        db.select().from(customerCases).where(eq(customerCases.projectId, plan.projectId)),
        db.select().from(aiTestRuns).where(eq(aiTestRuns.projectId, plan.projectId)),
      ]);

      const trustItems = trustEvidenceRows;
      const scores = calculateGeoMaturityScores({
        profile: profileRows[0] ?? null,
        entityChecks: entityCheckRows,
        brandSources: brandSourceRows,
        questions: questionRows,
        trustEvidence: {
          verifiedCount: trustItems.filter(item => item.verificationStatus === "verified").length,
          draftCount: trustItems.filter(item => item.verificationStatus === "draft").length,
          rejectedCount: trustItems.filter(item => item.verificationStatus === "rejected").length,
          totalTrustEvidenceCount: trustItems.length,
          customerCaseCount: customerCaseRows.length,
        },
        aiTestRuns: aiTestRunRows,
      });

      const now = new Date();
      await db.insert(geoMaturityScores).values({
        projectId: plan.projectId,
        totalScore: scores.totalScore,
        brandIdentityScore: scores.brandIdentityScore,
        categoryPositioningScore: scores.categoryPositioningScore,
        questionCoverageScore: scores.questionCoverageScore,
        sourceGraphScore: scores.sourceGraphScore,
        trustEvidenceScore: scores.trustEvidenceScore,
        aiTestPerformanceScore: scores.aiTestPerformanceScore,
        calculationDetail: scores.calculationDetail,
        calculatedAt: now,
      });

      const resultDimensionScores = buildBaselineDimensionScores(scores);
      await db
        .update(monthlyOptimizationPlans)
        .set({
          status: "completed",
          retestCompletedAt: now,
          completedAt: now,
          resultMaturityScore: scores.totalScore,
          resultDimensionScores,
        })
        .where(eq(monthlyOptimizationPlans.id, plan.id));

      return {
        report: buildMaturityReport({ scores, calculatedAt: now }),
        comparison: buildMonthlyPlanComparison({
          baselineMaturityScore: plan.baselineMaturityScore,
          baselineDimensionScores: plan.baselineDimensionScores,
          resultMaturityScore: scores.totalScore,
          resultDimensionScores,
        }),
      };
    }),

  getComparison: protectedProcedure
    .input(z.object({ planId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      const planRows = await db
        .select()
        .from(monthlyOptimizationPlans)
        .where(eq(monthlyOptimizationPlans.id, input.planId))
        .limit(1);
      const plan = planRows[0];
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "月度计划不存在" });
      await requireProjectAccess(ctx, plan.projectId);
      return buildMonthlyPlanComparison({
        baselineMaturityScore: plan.baselineMaturityScore,
        baselineDimensionScores: plan.baselineDimensionScores,
        resultMaturityScore: plan.resultMaturityScore,
        resultDimensionScores: plan.resultDimensionScores ?? null,
      });
    }),

  findTaskForArticle: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        questionId: z.number().int().positive().optional(),
        articleId: z.number().int().positive().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx, input.projectId);
      const plan = await loadActivePlan(input.projectId);
      if (!plan) return null;
      const tasks = await loadPlanTasks(plan.id);
      if (input.questionId) {
        const match = tasks.find(
          t => t.taskType === "content_generation" && t.relatedQuestionId === input.questionId,
        );
        if (match) {
          const meta = (match.metadata as Record<string, unknown> | null) ?? {};
          return {
            task: match,
            label: `所属本月计划：动作 ${meta.actionIndex ?? "—"} - ${match.title}`,
          };
        }
      }
      if (input.articleId) {
        const match = tasks.find(t => t.linkedEntityId === input.articleId);
        if (match) {
          const meta = (match.metadata as Record<string, unknown> | null) ?? {};
          return {
            task: match,
            label: `所属本月计划：动作 ${meta.actionIndex ?? "—"} - ${match.title}`,
          };
        }
      }
      return null;
    }),
});

export async function listMonthlyPlanTasksByQuestionIds(projectId: number, questionIds: number[]) {
  if (questionIds.length === 0) return new Map<number, typeof monthlyOptimizationTasks.$inferSelect>();
  const plan = await loadActivePlan(projectId);
  if (!plan) return new Map<number, typeof monthlyOptimizationTasks.$inferSelect>();
  const db = await requireDb();
  const tasks = await db
    .select()
    .from(monthlyOptimizationTasks)
    .where(
      and(
        eq(monthlyOptimizationTasks.planId, plan.id),
        inArray(monthlyOptimizationTasks.relatedQuestionId, questionIds),
      ),
    );
  return new Map(tasks.filter(t => t.relatedQuestionId != null).map(t => [t.relatedQuestionId!, t]));
}
