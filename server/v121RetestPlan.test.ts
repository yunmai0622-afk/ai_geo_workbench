import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-T2-T3-Retest-Plan", () => {
  it("shared retest plan defines T1/T2/T3 milestones and due reminder", () => {
    const logic = read("shared/retestPlan.ts");
    expect(logic).toContain("T1_RETEST_PLAN_DAYS = 7");
    expect(logic).toContain("T2_RETEST_PLAN_DAYS = 30");
    expect(logic).toContain("T3_RETEST_PLAN_DAYS = 90");
    expect(logic).toContain("buildRetestPlan");
    expect(logic).toContain("resolveRetestDueReminder");
  });

  it("workspace summary exposes retest plan and inclusion monitoring renders plan panel", () => {
    const summary = read("server/workspaceSummary.ts");
    const monitoring = read("client/src/pages/InclusionMonitoringCenterPage.tsx");
    expect(summary).toContain("retestPlan");
    expect(summary).toContain("retestDueReminder");
    expect(monitoring).toContain("inclusion-monitoring-retest-due-reminder");
    expect(monitoring).toContain("下一次复测时间");
  });
});
