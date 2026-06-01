import { auditLogs } from "../drizzle/schema";
import type { AuditLogAction } from "@shared/auditLogActions";
import type { DbConn } from "./projectAccess";

export type WriteAuditLogInput = {
  userId: number;
  projectId?: number | null;
  action: AuditLogAction;
  detail?: Record<string, unknown> | string | null;
};

function serializeDetail(detail: WriteAuditLogInput["detail"]): string | null {
  if (detail == null) return null;
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

/** 写入审计日志；失败仅打日志，不阻断主流程。 */
export async function writeAuditLog(db: DbConn, input: WriteAuditLogInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: input.userId,
      projectId: input.projectId ?? null,
      action: input.action,
      detail: serializeDetail(input.detail),
    });
  } catch (err) {
    console.error("[audit-log] write failed", input.action, err);
  }
}
