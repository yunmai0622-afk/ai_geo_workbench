import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { effectiveActions } from "../drizzle/schema";
import { getDb } from "./db";
import {
  EFFECTIVE_ACTION_CHANGE_DIRECTIONS,
  EFFECTIVE_ACTION_EFFECT_LEVELS,
  EFFECTIVE_ACTION_TYPES,
} from "./effectiveActions";
import { requireProjectAccess } from "./projectAccess";
import { protectedProcedure, router } from "./_core/trpc";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
  return db;
}

const actionTypeSchema = z.enum(EFFECTIVE_ACTION_TYPES);
const changeDirectionSchema = z.enum(EFFECTIVE_ACTION_CHANGE_DIRECTIONS);
const effectLevelSchema = z.enum(EFFECTIVE_ACTION_EFFECT_LEVELS);

export const effectiveActionsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        industry: z.string().min(1).max(255),
        customerType: z.string().min(1).max(255),
        questionType: z.string().min(1).max(64),
        actionType: actionTypeSchema,
        actionName: z.string().min(1).max(255),
        platform: z.string().min(1).max(64),
        publishedUrl: z.string().max(2000).optional(),
        executedAt: z.coerce.date(),
        baseRoundId: z.string().uuid().optional(),
        compareRoundId: z.string().uuid().optional(),
        baseMentionCount: z.number().int().min(0).optional(),
        compareMentionCount: z.number().int().min(0).optional(),
        changeDirection: changeDirectionSchema.optional(),
        effectLevel: effectLevelSchema,
        manualConclusion: z.string().optional(),
        applicableCondition: z.string().optional(),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      const id = randomUUID();
      await db.insert(effectiveActions).values({
        id,
        projectId: input.projectId,
        industry: input.industry,
        customerType: input.customerType,
        questionType: input.questionType,
        actionType: input.actionType,
        actionName: input.actionName,
        platform: input.platform,
        publishedUrl: input.publishedUrl ?? null,
        executedAt: input.executedAt,
        baseRoundId: input.baseRoundId ?? null,
        compareRoundId: input.compareRoundId ?? null,
        baseMentionCount: input.baseMentionCount ?? null,
        compareMentionCount: input.compareMentionCount ?? null,
        changeDirection: input.changeDirection ?? null,
        effectLevel: input.effectLevel,
        manualConclusion: input.manualConclusion ?? null,
        applicableCondition: input.applicableCondition ?? null,
        note: input.note ?? null,
      });
      return { success: true, id } as const;
    }),

  listByProject: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      return db
        .select()
        .from(effectiveActions)
        .where(eq(effectiveActions.projectId, input.projectId))
        .orderBy(desc(effectiveActions.executedAt), desc(effectiveActions.createdAt));
    }),

  update: protectedProcedure
    .input(
      z
        .object({
          id: z.string().uuid(),
          projectId: z.number().int().positive(),
          effectLevel: effectLevelSchema.optional(),
          manualConclusion: z.string().nullable().optional(),
        })
        .refine(data => data.effectLevel !== undefined || data.manualConclusion !== undefined, {
          message: "至少更新 effectLevel 或 manualConclusion 之一",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      const rows = await db
        .select()
        .from(effectiveActions)
        .where(and(eq(effectiveActions.id, input.id), eq(effectiveActions.projectId, input.projectId)))
        .limit(1);
      if (!rows[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "有效动作记录不存在" });
      }
      const patch: Partial<typeof effectiveActions.$inferInsert> = {};
      if (input.effectLevel !== undefined) patch.effectLevel = input.effectLevel;
      if (input.manualConclusion !== undefined) patch.manualConclusion = input.manualConclusion;
      await db.update(effectiveActions).set(patch).where(eq(effectiveActions.id, input.id));
      return { success: true } as const;
    }),
});
