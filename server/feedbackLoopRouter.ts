import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "./db";
import { requireProjectAccess } from "./projectAccess";
import { protectedProcedure, router } from "./_core/trpc";
import { getRetestFeedbackSummary } from "./retestFeedbackLoopService";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
  return db;
}

export const feedbackLoopRouter = router({
  getRetestFeedbackSummary: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        roundId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      return getRetestFeedbackSummary(db, input.projectId, input.roundId);
    }),
});
