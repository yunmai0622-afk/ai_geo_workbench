import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  brandSourceRecords,
  entityAnchors,
  questions,
} from "../drizzle/schema";
import {
  BRAND_SOURCE_PLATFORMS,
  buildEnhancementSuggestions,
  computeConsistencyScore,
} from "@shared/brandSourceGraph";
import { filterQuestionsRequiringSourceType } from "@shared/questionSearchPool";
import { getDb } from "./db";
import { requireProjectAccess } from "./projectAccess";
import { protectedProcedure, router } from "./_core/trpc";
import { filterRowsWithNumericId } from "./trpcRowSanitize";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
  return db;
}

const platformSchema = z.enum(BRAND_SOURCE_PLATFORMS.map(p => p.value) as [string, ...string[]]);

const brandSourceInputSchema = z.object({
  platform: platformSchema,
  platformName: z.string().max(255).optional().nullable(),
  url: z.string().max(2000).optional().nullable(),
  isPubliclyAccessible: z.boolean(),
  containsBrandName: z.boolean(),
  containsOfficialSite: z.boolean(),
  containsCoreKeywords: z.boolean(),
  aiCitationConfirmed: z.boolean(),
  isCrossSourceConsistent: z.boolean(),
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

export const brandSourceGraphRouter = router({
  getBrandSources: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      return db
        .select()
        .from(brandSourceRecords)
        .where(eq(brandSourceRecords.projectId, input.projectId))
        .orderBy(desc(brandSourceRecords.updatedAt));
    }),

  createBrandSource: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), data: brandSourceInputSchema }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      const inserted = await db
        .insert(brandSourceRecords)
        .values({
          projectId: input.projectId,
          ...input.data,
          platformName: input.data.platform === "other" ? input.data.platformName ?? null : null,
        })
        .$returningId();
      const id = inserted[0]?.id;
      if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "创建信源失败" });
      return { success: true as const, id };
    }),

  updateBrandSource: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), data: brandSourceInputSchema }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireBrandSourceAccess(ctx, input.id);
      await db
        .update(brandSourceRecords)
        .set({
          ...input.data,
          platformName: input.data.platform === "other" ? input.data.platformName ?? null : null,
        })
        .where(eq(brandSourceRecords.id, input.id));
      return { success: true as const };
    }),

  deleteBrandSource: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireBrandSourceAccess(ctx, input.id);
      await db.delete(brandSourceRecords).where(eq(brandSourceRecords.id, input.id));
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
        return { success: true as const, id: existing[0].id };
      }

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
      return { success: true as const, id };
    }),

  getConsistencyScore: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      const records = await db
        .select()
        .from(brandSourceRecords)
        .where(eq(brandSourceRecords.projectId, input.projectId));
      return computeConsistencyScore(records);
    }),

  getEnhancementSuggestions: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      const [records, anchorRows, questionRows] = await Promise.all([
        db
          .select()
          .from(brandSourceRecords)
          .where(eq(brandSourceRecords.projectId, input.projectId)),
        db
          .select()
          .from(entityAnchors)
          .where(eq(entityAnchors.projectId, input.projectId))
          .limit(1),
        db
          .select()
          .from(questions)
          .where(eq(questions.projectId, input.projectId))
          .orderBy(desc(questions.createdAt)),
      ]);

      const sanitizedQuestions = filterRowsWithNumericId(questionRows);
      const anchors = anchorRows[0] ?? null;
      const suggestions = buildEnhancementSuggestions(records, sanitizedQuestions, anchors);

      const enriched = await Promise.all(
        suggestions.map(async suggestion => {
          if (!suggestion.platform) return suggestion;
          const related = filterQuestionsRequiringSourceType(sanitizedQuestions, suggestion.platform);
          return {
            ...suggestion,
            relatedQuestions: related.map(q => q.questionText).slice(0, 5),
          };
        }),
      );

      return enriched;
    }),
});
