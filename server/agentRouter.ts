import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { claimAgentTask, listAgentTasksForClient, pollAgentTasks, reportAgentTaskResult } from "./agentPublishTasks";
import { requireDbConn } from "./projectPlatformAccounts";

export const agentRouter = router({
  pollTasks: publicProcedure
    .input(z.object({ localAgentId: z.string().trim().min(1).max(100) }))
    .query(async ({ input }) => {
      const db = await requireDbConn();
      return pollAgentTasks(db, input.localAgentId, 3);
    }),

  listTasks: publicProcedure
    .input(
      z.object({
        localAgentId: z.string().trim().min(1).max(100),
        limit: z.number().int().min(1).max(100).optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = await requireDbConn();
      return listAgentTasksForClient(db, input.localAgentId, input.limit ?? 50);
    }),

  claimTask: publicProcedure
    .input(
      z.object({
        taskId: z.number().int().positive(),
        localAgentId: z.string().trim().min(1).max(100),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDbConn();
      return claimAgentTask(db, input);
    }),

  reportTaskResult: publicProcedure
    .input(
      z.object({
        taskId: z.number().int().positive(),
        localAgentId: z.string().trim().min(1).max(100),
        status: z.enum([
          "draft_saved",
          "completed",
          "failed",
          "session_expired",
          "manual_required",
        ]),
        publicUrl: z.string().max(500).optional().nullable(),
        draftUrl: z.string().max(500).optional().nullable(),
        errorType: z.string().max(50).optional().nullable(),
        errorMessage: z.string().max(2000).optional().nullable(),
        logs: z.array(z.string()).optional().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDbConn();
      return reportAgentTaskResult(db, input);
    }),
});
