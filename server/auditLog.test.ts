import { describe, expect, it, vi } from "vitest";
import { AUDIT_LOG_ACTIONS } from "@shared/auditLogActions";
import { writeAuditLog } from "./auditLog";

describe("writeAuditLog", () => {
  it("inserts serialized detail without throwing", async () => {
    const insert = vi.fn().mockResolvedValue(undefined);
    const db = { insert: () => ({ values: insert }) } as never;

    await writeAuditLog(db, {
      userId: 1,
      projectId: 9,
      action: AUDIT_LOG_ACTIONS.contentPublish,
      detail: { articleId: 42 },
    });

    expect(insert).toHaveBeenCalledWith({
      userId: 1,
      projectId: 9,
      action: "content.publish",
      detail: JSON.stringify({ articleId: 42 }),
    });
  });

  it("swallows insert errors", async () => {
    const insert = vi.fn().mockRejectedValue(new Error("db down"));
    const db = { insert: () => ({ values: insert }) } as never;
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      writeAuditLog(db, {
        userId: 1,
        action: AUDIT_LOG_ACTIONS.userLogin,
        detail: { method: "email" },
      }),
    ).resolves.toBeUndefined();

    errSpy.mockRestore();
  });
});
