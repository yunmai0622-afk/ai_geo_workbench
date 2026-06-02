import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { publishTasks } from "../drizzle/schema";
import { adminProcedure, router } from "./_core/trpc";
import { getDb } from "./db";

const adminPublishTaskStatusSchema = z.enum(["pending", "processing", "completed", "failed"]);

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库连接不可用" });
  }
  return db;
}

export const adminPublishTasksRouter = router({
  list: adminProcedure
    .input(
      z
        .object({
          status: adminPublishTaskStatusSchema.optional(),
          platform: z.string().trim().min(1).max(50).optional(),
          limit: z.number().int().min(1).max(200).default(100),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = await requireDb();
      const status = input?.status;
      const platform = input?.platform?.trim();
      const limit = input?.limit ?? 100;

      const whereClause =
        status && platform
          ? and(eq(publishTasks.status, status), eq(publishTasks.platform, platform))
          : status
            ? eq(publishTasks.status, status)
            : platform
              ? eq(publishTasks.platform, platform)
              : undefined;

      const rows = await db
        .select({
          id: publishTasks.id,
          projectName: publishTasks.projectName,
          platform: publishTasks.platform,
          status: publishTasks.status,
          createdAt: publishTasks.createdAt,
          updatedAt: publishTasks.updatedAt,
          errorMessage: publishTasks.errorMessage,
          agentErrorMessage: publishTasks.agentErrorMessage,
        })
        .from(publishTasks)
        .where(whereClause)
        .orderBy(desc(publishTasks.id))
        .limit(limit);

      const platforms = Array.from(new Set(rows.map(row => row.platform).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "zh-CN"),
      );

      return {
        tasks: rows.map(row => ({
          ...row,
          failureReason: row.agentErrorMessage ?? row.errorMessage ?? null,
          enterpriseName: row.projectName?.trim() || "未命名企业",
        })),
        platforms,
      } as const;
    }),
});
