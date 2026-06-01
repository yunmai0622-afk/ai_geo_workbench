import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-T1-Auto-Trigger", () => {
  it("shared logic and workspace summary expose T1 retest reminder flag", () => {
    const logic = read("shared/t1RetestAutoTrigger.ts");
    const summary = read("server/workspaceSummary.ts");
    expect(logic).toContain("T1_RETEST_AFTER_PUBLISH_DAYS = 7");
    expect(logic).toContain("shouldShowT1RetestAutoTriggerReminder");
    expect(logic).toContain("hasCompletedT1Retest");
    expect(summary).toContain("showT1RetestAutoTriggerReminder");
    expect(summary).toContain('eq(publishTasks.status, "completed")');
  });

  it("workbench and inclusion monitoring show reminder with CTA to ai-diagnosis", () => {
    const workspace = read("client/src/pages/EnterpriseWorkspacePage.tsx");
    const monitoring = read("client/src/pages/V12FlowPages.tsx");
    const card = read("client/src/components/diagnosis/T1RetestReminderCard.tsx");
    expect(workspace).toContain("RetestDueReminderCard");
    expect(workspace).toContain("retestDueReminder");
    expect(workspace).toContain("workspace-retest-due-reminder");
    expect(monitoring).toContain("inclusion-monitoring-retest-due-reminder");
    expect(monitoring).toContain("RetestPlanPanel");
    expect(monitoring).toContain("geo.workspace.summary");
    expect(card).toContain("T1_RETEST_AUTO_TRIGGER_MESSAGE");
    expect(card).toContain("T1_RETEST_AUTO_TRIGGER_CTA_LABEL");
    expect(card).toContain("t1-retest-reminder-go-diagnosis");
  });
});
