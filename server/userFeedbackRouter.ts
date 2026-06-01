import { z } from "zod";
import { userFeedbacks } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import { getCurrentUserId } from "./projectAccess";
import { requireDbConn } from "./projectPlatformAccounts";

const feedbackTypeSchema = z.enum(["bug", "suggestion", "other"]);

export const userFeedbackRouter = router({
  submit: protectedProcedure
    .input(
      z.object({
        type: feedbackTypeSchema,
        description: z.string().trim().min(1, "请填写反馈描述").max(5000, "描述过长，请精简后提交"),
        projectId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDbConn();
      const userId = getCurrentUserId(ctx);
      await db.insert(userFeedbacks).values({
        userId,
        projectId: input.projectId ?? null,
        type: input.type,
        description: input.description,
      });
      return { success: true as const };
    }),
});
