import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("GEO-V1.1-Audit-Log", () => {
  it("migration 0042 creates audit_logs table", () => {
    const sql = read("drizzle/0042_audit_logs.sql");
    expect(sql).toContain("CREATE TABLE `audit_logs`");
    expect(sql).toContain("`userId`");
    expect(sql).toContain("`projectId`");
    expect(sql).toContain("`action`");
    expect(sql).toContain("`detail`");
    expect(sql).toContain("`createdAt`");
  });

  it("routers write audit logs at key mutations", () => {
    const routers = read("server/routers.ts");
    expect(routers).toContain("writeAuditLog");
    expect(routers).toContain('AUDIT_LOG_ACTIONS.userLogin');
    expect(routers).toContain('AUDIT_LOG_ACTIONS.userLogout');
    expect(routers).toContain('AUDIT_LOG_ACTIONS.projectCreate');
    expect(routers).toContain('AUDIT_LOG_ACTIONS.t0Start');
    expect(routers).toContain('AUDIT_LOG_ACTIONS.contentPublish');
    expect(routers).toContain('AUDIT_LOG_ACTIONS.deliveryReportGenerate');
  });
});
