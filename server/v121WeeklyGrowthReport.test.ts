import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SYSTEM_NOTIFICATION_TYPE_LABELS } from "../shared/systemNotificationDisplay";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Weekly-Growth-Report", () => {
  it("extends notification type and labels", () => {
    expect(SYSTEM_NOTIFICATION_TYPE_LABELS.weekly_growth_report).toBe("GEO 增长周报");
    expect(read("drizzle/schema.ts")).toContain("weekly_growth_report");
    expect(read("drizzle/0054_system_notifications_weekly_growth.sql")).toContain("weekly_growth_report");
  });

  it("wires Monday scheduler and rule-based report builder", () => {
    expect(read("server/_core/index.ts")).toContain("startWeeklyGrowthReportScheduler");
    expect(read("server/scheduledWeeklyGrowthReport.ts")).toContain('now.getDay() !== 1');
    expect(read("server/weeklyGrowthReport.ts")).toContain("createSystemNotification");
    expect(read("shared/weeklyGrowthReport.ts")).toContain("pickNextWeekHealthBriefPriority");
    expect(read("shared/weeklyGrowthReport.ts")).not.toContain("llm");
  });

  it("notification bell supports weekly growth type label", () => {
    expect(read("client/src/components/notifications/NotificationBell.tsx")).toContain(
      "SYSTEM_NOTIFICATION_TYPE_LABELS",
    );
  });
});
