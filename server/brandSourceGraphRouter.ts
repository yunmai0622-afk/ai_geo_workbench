import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  brandSourceRecords,
  entityAnchors,
  entityConsistencyChecks,
  sourceEnhancementSuggestions,
} from "../drizzle/schema";
import {
  BRAND_SOURCE_PLATFORMS,
  computePageTopMetrics,
  computeConsistencyScore,
  deriveBrandSourceRisk,
  normalizeBrandSourceRecord,
  type BrandSourceRecordRow,
} from "@shared/brandSourceGraph";
import { getDb } from "./db";
import { requireProjectAccess } from "./projectAccess";
import { protectedProcedure, router } from "./_core/trpc";
import {
  createOptimizationTaskFromSuggestion,
  loadBrandSourceGraphContext,
  mapConsistencyChecksFromDb,
  syncSourceGraphDerivedData,
} from "./brandSourceGraphService";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
  return db;
}

const platformSchema = z.enum(BRAND_SOURCE_PLATFORMS.map(p => p.value) as [string, ...string[]]);

const brandSourceInputSchema = z.object({
  platform: platformSchema,
  sourceName: z.string().max(255).optional().nullable(),
  platformName: z.string().max(255).optional().nullable(),
  url: z.string().max(2000).optional().nullable(),
  isPubliclyAccessible: z.boolean(),
  containsBrandName: z.boolean(),
  containsBusinessDescription: z.boolean(),
  containsOfficialSite: z.boolean(),
  containsCoreKeywords: z.boolean(),
  aiCitationConfirmed: z.boolean(),
  notes: z.string().optional().nullable(),
  lastVerifiedAt: z.coerce.date().optional().nullable(),
});

const entityAnchorInputSchema = z.object({
  brandName: z.string().min(1, "请填写品牌名").max(255),
  companyName: z.string().min(1, "请填写公司名").max(255),
  coreBusiness: z.string().min(1, "请填写主营业务"),
  targetCustomer: z.string().min(1, "请填写目标客户"),
  coreKeywords: z.array(z.string().min(1)).min(1, "请至少填写一个核心关键词"),
  officialSite: z.string().min(1, "请填写官网").max(500),
  founderName: z.string().max(255).optional().nullable(),
  typicalCases: z.string().optional().nullable(),
});

async function requireBrandSourceAccess(ctx: Parameters<typeof requireProjectAccess>[0], id: number) {
  const db = await requireDb();
  const rows = await db
    .select({ projectId: brandSourceRecords.projectId })
    .from(brandSourceRecords)
    .where(eq(brandSourceRecords.id, id))
    .limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "信源记录不存在" });
  await requireProjectAccess(ctx, rows[0].projectId);
  return rows[0].projectId;
}

async function requireSuggestionAccess(ctx: Parameters<typeof requireProjectAccess>[0], id: number) {
  const db = await requireDb();
  const rows = await db
    .select({ projectId: sourceEnhancementSuggestions.projectId })
    .from(sourceEnhancementSuggestions)
    .where(eq(sourceEnhancementSuggestions.id, id))
    .limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "增强建议不存在" });
  await requireProjectAccess(ctx, rows[0].projectId);
  return rows[0].projectId;
}

function withDerivedRisk(input: z.infer<typeof brandSourceInputSchema>) {
  const draft: BrandSourceRecordRow = {
    id: 0,
    projectId: 0,
    platform: input.platform,
    sourceName: input.sourceName,
    platformName: input.platformName,
    url: input.url,
    isPubliclyAccessible: input.isPubliclyAccessible,
    containsBrandName: input.containsBrandName,
    containsBusinessDescription: input.containsBusinessDescription,
    containsOfficialSite: input.containsOfficialSite,
    containsCoreKeywords: input.containsCoreKeywords,
    aiCitationConfirmed: input.aiCitationConfirmed,
    isCrossSourceConsistent: false,
  };
  const risk = deriveBrandSourceRisk(draft);
  return {
    ...input,
    platformName: input.platform === "other" ? input.platformName ?? null : null,
    riskLevel: risk.riskLevel,
    riskNotes: risk.riskNotes,
    isCrossSourceConsistent: false,
  };
}

export const brandSourceGraphRouter = router({
  getBrandSources: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      const rows = await db
        .select()
        .from(brandSourceRecords)
        .where(eq(brandSourceRecords.projectId, input.projectId))
        .orderBy(desc(brandSourceRecords.updatedAt));
      return rows.map(row => normalizeBrandSourceRecord(row as BrandSourceRecordRow));
    }),

  createBrandSource: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), data: brandSourceInputSchema }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      const payload = withDerivedRisk(input.data);
      const inserted = await db
        .insert(brandSourceRecords)
        .values({
          projectId: input.projectId,
          ...payload,
        })
        .$returningId();
      const id = inserted[0]?.id;
      if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "创建信源失败" });
      await syncSourceGraphDerivedData(db, input.projectId);
      return { success: true as const, id };
    }),

  updateBrandSource: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), data: brandSourceInputSchema }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const projectId = await requireBrandSourceAccess(ctx, input.id);
      const payload = withDerivedRisk(input.data);
      await db
        .update(brandSourceRecords)
        .set(payload)
        .where(eq(brandSourceRecords.id, input.id));
      await syncSourceGraphDerivedData(db, projectId);
      return { success: true as const };
    }),

  deleteBrandSource: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const projectId = await requireBrandSourceAccess(ctx, input.id);
      await db.delete(brandSourceRecords).where(eq(brandSourceRecords.id, input.id));
      await syncSourceGraphDerivedData(db, projectId);
      return { success: true as const };
    }),

  markBrandSourceVerified: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireBrandSourceAccess(ctx, input.id);
      await db
        .update(brandSourceRecords)
        .set({ lastVerifiedAt: new Date() })
        .where(eq(brandSourceRecords.id, input.id));
      return { success: true as const };
    }),

  getEntityAnchors: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      const rows = await db
        .select()
        .from(entityAnchors)
        .where(eq(entityAnchors.projectId, input.projectId))
        .limit(1);
      return rows[0] ?? null;
    }),

  upsertEntityAnchors: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), data: entityAnchorInputSchema }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      const existing = await db
        .select({ id: entityAnchors.id })
        .from(entityAnchors)
        .where(eq(entityAnchors.projectId, input.projectId))
        .limit(1);

      if (existing[0]) {
        await db
          .update(entityAnchors)
          .set({
            ...input.data,
            founderName: input.data.founderName ?? null,
            typicalCases: input.data.typicalCases ?? null,
          })
          .where(eq(entityAnchors.id, existing[0].id));
      } else {
        const inserted = await db
          .insert(entityAnchors)
          .values({
            projectId: input.projectId,
            ...input.data,
            founderName: input.data.founderName ?? null,
            typicalCases: input.data.typicalCases ?? null,
          })
          .$returningId();
        const id = inserted[0]?.id;
        if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "保存实体锚点失败" });
      }
      await syncSourceGraphDerivedData(db, input.projectId);
      return { success: true as const };
    }),

  getConsistencyScore: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      const { records } = await loadBrandSourceGraphContext(db, input.projectId);
      return computeConsistencyScore(records);
    }),

  getEntityConsistencyChecks: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      const rows = await db
        .select()
        .from(entityConsistencyChecks)
        .where(eq(entityConsistencyChecks.projectId, input.projectId));
      if (rows.length === 0) {
        await syncSourceGraphDerivedData(db, input.projectId);
        const refreshed = await db
          .select()
          .from(entityConsistencyChecks)
          .where(eq(entityConsistencyChecks.projectId, input.projectId));
        return mapConsistencyChecksFromDb(refreshed);
      }
      return mapConsistencyChecksFromDb(rows);
    }),

  getPageMetrics: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      const { records } = await loadBrandSourceGraphContext(db, input.projectId);
      const checkRows = await db
        .select()
        .from(entityConsistencyChecks)
        .where(eq(entityConsistencyChecks.projectId, input.projectId));
      const checks =
        checkRows.length > 0
          ? mapConsistencyChecksFromDb(checkRows)
          : mapConsistencyChecksFromDb(
              (await syncSourceGraphDerivedData(db, input.projectId)).checks.map(item => ({
                anchorType: item.anchorType,
                standardValue: item.standardValue === "—" ? null : item.standardValue,
                observedValues: item.observedValues,
                status: item.status,
                score: item.score,
                issueSummary: item.issueSummary,
                suggestion: item.suggestion,
              })),
            );
      return computePageTopMetrics(records, checks);
    }),

  getEnhancementSuggestions: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      const rows = await db
        .select()
        .from(sourceEnhancementSuggestions)
        .where(eq(sourceEnhancementSuggestions.projectId, input.projectId))
        .orderBy(desc(sourceEnhancementSuggestions.updatedAt));
      if (rows.length === 0) {
        await syncSourceGraphDerivedData(db, input.projectId);
        return db
          .select()
          .from(sourceEnhancementSuggestions)
          .where(eq(sourceEnhancementSuggestions.projectId, input.projectId))
          .orderBy(desc(sourceEnhancementSuggestions.updatedAt));
      }
      return rows;
    }),

  createContentTaskFromSuggestion: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), suggestionId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      await requireSuggestionAccess(ctx, input.suggestionId);
      try {
        return await createOptimizationTaskFromSuggestion(db, input.projectId, input.suggestionId);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "创建内容任务失败",
        });
      }
    }),

  syncDerivedData: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      await syncSourceGraphDerivedData(db, input.projectId);
      return { success: true as const };
    }),
});
