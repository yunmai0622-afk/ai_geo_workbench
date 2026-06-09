import { TRPCError } from "@trpc/server";
import {
  buildMaturityReport,
  calculateGeoMaturityScores,
  type GeoMaturityReport,
} from "@shared/geoMaturityScoring";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  aiTestRuns,
  brandSourceRecords,
  customerCases,
  enterpriseGeoProfiles,
  entityConsistencyChecks,
  geoMaturityScores,
  questions,
  trustEvidenceItems,
} from "../drizzle/schema";
import { getDb } from "./db";
import { requireProjectAccess } from "./projectAccess";
import { protectedProcedure, router } from "./_core/trpc";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
  return db;
}

async function loadMaturityScoringContext(projectId: number) {
  const db = await requireDb();
  const [
    profileRows,
    entityCheckRows,
    brandSourceRows,
    questionRows,
    trustEvidenceRows,
    customerCaseRows,
    aiTestRunRows,
  ] = await Promise.all([
    db
      .select()
      .from(enterpriseGeoProfiles)
      .where(eq(enterpriseGeoProfiles.projectId, projectId))
      .limit(1),
    db
      .select()
      .from(entityConsistencyChecks)
      .where(eq(entityConsistencyChecks.projectId, projectId)),
    db.select().from(brandSourceRecords).where(eq(brandSourceRecords.projectId, projectId)),
    db.select().from(questions).where(eq(questions.projectId, projectId)),
    db.select().from(trustEvidenceItems).where(eq(trustEvidenceItems.projectId, projectId)),
    db.select().from(customerCases).where(eq(customerCases.projectId, projectId)),
    db.select().from(aiTestRuns).where(eq(aiTestRuns.projectId, projectId)),
  ]);

  const trustItems = trustEvidenceRows;
  const verifiedCount = trustItems.filter(item => item.verificationStatus === "verified").length;
  const draftCount = trustItems.filter(item => item.verificationStatus === "draft").length;
  const rejectedCount = trustItems.filter(item => item.verificationStatus === "rejected").length;

  return {
    profile: profileRows[0] ?? null,
    entityChecks: entityCheckRows,
    brandSources: brandSourceRows,
    questions: questionRows,
    trustEvidence: {
      verifiedCount,
      draftCount,
      rejectedCount,
      totalTrustEvidenceCount: trustItems.length,
      customerCaseCount: customerCaseRows.length,
    },
    aiTestRuns: aiTestRunRows,
  };
}

function rowToReport(row: typeof geoMaturityScores.$inferSelect): GeoMaturityReport {
  const scores = {
    brandIdentityScore: row.brandIdentityScore ?? 0,
    categoryPositioningScore: row.categoryPositioningScore ?? 0,
    questionCoverageScore: row.questionCoverageScore ?? 0,
    sourceGraphScore: row.sourceGraphScore ?? 0,
    trustEvidenceScore: row.trustEvidenceScore ?? 0,
    aiTestPerformanceScore: row.aiTestPerformanceScore ?? 0,
    totalScore: row.totalScore,
    calculationDetail: (row.calculationDetail as Record<string, unknown>) ?? {},
  };
  return buildMaturityReport({ scores, calculatedAt: row.calculatedAt });
}

export const geoMaturityRouter = router({
  calculateAndSave: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx, input.projectId);
      const db = await requireDb();
      const context = await loadMaturityScoringContext(input.projectId);
      const scores = calculateGeoMaturityScores(context);
      const now = new Date();

      const existing = await db
        .select({ id: geoMaturityScores.id })
        .from(geoMaturityScores)
        .where(eq(geoMaturityScores.projectId, input.projectId))
        .limit(1);

      const values = {
        projectId: input.projectId,
        totalScore: scores.totalScore,
        brandIdentityScore: scores.brandIdentityScore,
        categoryPositioningScore: scores.categoryPositioningScore,
        questionCoverageScore: scores.questionCoverageScore,
        sourceGraphScore: scores.sourceGraphScore,
        trustEvidenceScore: scores.trustEvidenceScore,
        aiTestPerformanceScore: scores.aiTestPerformanceScore,
        calculationDetail: scores.calculationDetail,
        calculatedAt: now,
      };

      if (existing[0]) {
        await db
          .update(geoMaturityScores)
          .set(values)
          .where(eq(geoMaturityScores.id, existing[0].id));
      } else {
        await db.insert(geoMaturityScores).values(values);
      }

      return buildMaturityReport({ scores, calculatedAt: now });
    }),

  getLatest: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx, input.projectId);
      const db = await requireDb();
      const rows = await db
        .select()
        .from(geoMaturityScores)
        .where(eq(geoMaturityScores.projectId, input.projectId))
        .limit(1);
      if (!rows[0]) return null;
      return rows[0];
    }),

  getMaturityReport: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx, input.projectId);
      const db = await requireDb();
      const rows = await db
        .select()
        .from(geoMaturityScores)
        .where(eq(geoMaturityScores.projectId, input.projectId))
        .limit(1);
      if (!rows[0]) return null;
      return rowToReport(rows[0]);
    }),
});
