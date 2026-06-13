import { TRPCError } from "@trpc/server";
import {
  buildMaturityReport,
  calculateGeoMaturityScores,
  type GeoMaturityReport,
} from "@shared/geoMaturityScoring";
import { desc, eq } from "drizzle-orm";
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

async function fetchLatestMaturityRow(projectId: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(geoMaturityScores)
    .where(eq(geoMaturityScores.projectId, projectId))
    .orderBy(desc(geoMaturityScores.calculatedAt))
    .limit(1);
  return rows[0] ?? null;
}

function maturityScoresMatch(
  latest: typeof geoMaturityScores.$inferSelect,
  scores: ReturnType<typeof calculateGeoMaturityScores>,
): boolean {
  return (
    latest.totalScore === scores.totalScore &&
    (latest.brandIdentityScore ?? 0) === scores.brandIdentityScore &&
    (latest.categoryPositioningScore ?? 0) === scores.categoryPositioningScore &&
    (latest.questionCoverageScore ?? 0) === scores.questionCoverageScore &&
    (latest.sourceGraphScore ?? 0) === scores.sourceGraphScore &&
    (latest.trustEvidenceScore ?? 0) === scores.trustEvidenceScore &&
    (latest.aiTestPerformanceScore ?? 0) === scores.aiTestPerformanceScore
  );
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
      const latestRow = await fetchLatestMaturityRow(input.projectId);

      if (latestRow && maturityScoresMatch(latestRow, scores)) {
        await db
          .update(geoMaturityScores)
          .set({ calculatedAt: now })
          .where(eq(geoMaturityScores.id, latestRow.id));
        return buildMaturityReport({ scores, calculatedAt: now });
      }

      await db.insert(geoMaturityScores).values({
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
      });

      return buildMaturityReport({ scores, calculatedAt: now });
    }),

  getLatest: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx, input.projectId);
      return fetchLatestMaturityRow(input.projectId);
    }),

  getHistory: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx, input.projectId);
      const db = await requireDb();
      const limit = input.limit ?? 10;
      const rows = await db
        .select()
        .from(geoMaturityScores)
        .where(eq(geoMaturityScores.projectId, input.projectId))
        .orderBy(desc(geoMaturityScores.calculatedAt))
        .limit(limit);
      return rows;
    }),

  getMaturityReport: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx, input.projectId);
      const row = await fetchLatestMaturityRow(input.projectId);
      if (!row) return null;
      return rowToReport(row);
    }),
});
