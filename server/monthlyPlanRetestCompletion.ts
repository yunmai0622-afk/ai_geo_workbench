import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import {
  buildBaselineDimensionScores,
  buildMonthlyPlanComparison,
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
  questions,
  trustEvidenceItems,
} from "../drizzle/schema";
import { getDb } from "./db";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
  return db;
}

export async function completeMonthlyPlanRetest(planId: number) {
  const db = await requireDb();
  const planRows = await db
    .select()
    .from(monthlyOptimizationPlans)
    .where(eq(monthlyOptimizationPlans.id, planId))
    .limit(1);
  const plan = planRows[0];
  if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "月度计划不存在" });
  if (plan.status === "completed" && plan.retestCompletedAt) {
    const completedScores: GeoMaturityScores = {
      brandIdentityScore: plan.resultDimensionScores?.brandIdentity ?? 0,
      categoryPositioningScore: plan.resultDimensionScores?.categoryPositioning ?? 0,
      questionCoverageScore: plan.resultDimensionScores?.questionCoverage ?? 0,
      sourceGraphScore: plan.resultDimensionScores?.sourceGraph ?? 0,
      trustEvidenceScore: plan.resultDimensionScores?.trustEvidence ?? 0,
      aiTestPerformanceScore: plan.resultDimensionScores?.aiTestPerformance ?? 0,
      totalScore: plan.resultMaturityScore ?? plan.baselineMaturityScore,
      calculationDetail: {},
    };
    return {
      report: buildMaturityReport({
        scores: completedScores,
        calculatedAt: plan.retestCompletedAt,
      }),
      comparison: buildMonthlyPlanComparison({
        baselineMaturityScore: plan.baselineMaturityScore,
        baselineDimensionScores: plan.baselineDimensionScores,
        resultMaturityScore: plan.resultMaturityScore,
        resultDimensionScores: plan.resultDimensionScores ?? null,
      }),
      alreadyCompleted: true as const,
    };
  }

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
    alreadyCompleted: false as const,
  };
}
