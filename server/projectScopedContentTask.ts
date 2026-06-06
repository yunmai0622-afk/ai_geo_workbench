import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { optimizationTasks } from "../drizzle/schema";
import { PROJECT_SCOPED_CONTENT_TASK_MISMATCH_MESSAGE } from "@shared/geoProjectScopedContentTask";
import type { TrpcContext } from "./_core/context";
import type { DbConn } from "./projectAccess";
import { requireProjectAccess } from "./projectAccess";

export async function assertProjectScopedContentTask(
  db: DbConn,
  ctx: TrpcContext,
  input: { projectId: number; contentTaskId: number },
): Promise<void> {
  await requireProjectAccess(ctx, input.projectId);
  const rows = await db
    .select({ id: optimizationTasks.id })
    .from(optimizationTasks)
    .where(and(eq(optimizationTasks.id, input.contentTaskId), eq(optimizationTasks.projectId, input.projectId)))
    .limit(1);
  if (!rows[0]) {
    throw new TRPCError({ code: "BAD_REQUEST", message: PROJECT_SCOPED_CONTENT_TASK_MISMATCH_MESSAGE });
  }
}
