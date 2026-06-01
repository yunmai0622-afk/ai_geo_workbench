import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("P2-B-Verify-Fix inclusion monitoring", () => {
  it("schema contains expected monitoring columns", () => {
    const schema = read("drizzle/schema.ts");
    for (const col of [
      "inclusionMonitorStatus",
      "aiMentionMonitorStatus",
      "aiRecommendMonitorStatus",
      "aiTestResults",
      "lastAiTestedAt",
      "publishRecordId",
      "publicUrl",
    ]) {
      expect(schema).toContain(col);
    }
    expect(schema).not.toMatch(/inclusionStatus:\s*inclusionMonitorStatusEnum/);
  });

  it("ensure_inclusion_monitoring_columns script exists", () => {
    const script = resolve(root, "scripts/ensure_inclusion_monitoring_columns.mjs");
    expect(existsSync(script)).toBe(true);
    const text = read("scripts/ensure_inclusion_monitoring_columns.mjs");
    expect(text).toContain("information_schema.COLUMNS");
    expect(text).toContain("geo_inclusion_monitoring_records");
    expect(text).not.toContain("DROP TABLE");
    expect(text).not.toContain("DROP COLUMN");
  });

  it("migration 0025 adds ai test columns without table rebuild", () => {
    const sql = read("drizzle/0028_fix_inclusion_monitoring_columns.sql");
    expect(sql).toContain("aiTestResults");
    expect(sql).toContain("lastAiTestedAt");
    expect(sql).not.toContain("DROP TABLE");
    expect(sql).not.toContain("CREATE TABLE");
  });

  it("inclusionMonitoringRecords maps API aliases without new router procedure", () => {
    const router = read("server/routers.ts");
    expect(router).toContain("inclusionMonitoringRecords:");
    expect(router).toContain("mapInclusionMonitoringRecordForApi");
    expect(router).not.toMatch(/inclusion:\s*protectedProcedure/);
  });
});
