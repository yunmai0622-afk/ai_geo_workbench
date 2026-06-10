import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NOTIFICATION_POLL_INTERVAL_MS, SYSTEM_NOTIFICATION_TYPE_LABELS, formatNotificationTime } from "../shared/systemNotificationDisplay";
const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");
describe("GEO-V1.1-Notifications", () => {
  it("defines notification types including weekly growth report", () => {
    expect(SYSTEM_NOTIFICATION_TYPE_LABELS.t0_complete).toBe("AI 现状检测完成");
    expect(SYSTEM_NOTIFICATION_TYPE_LABELS.weekly_growth_report).toBe("GEO 增长周报");
    expect(NOTIFICATION_POLL_INTERVAL_MS).toBe(30_000);
    expect(formatNotificationTime("2026-06-01T10:00:00.000Z")).toContain("2026");
  });
  it("wires backend and frontend", () => {
    expect(read("drizzle/schema.ts")).toContain("system_notifications");
    expect(read("server/routers.ts")).toContain("notifications: systemNotificationsRouter");
    expect(read("client/src/components/notifications/NotificationBell.tsx")).toContain("refetchInterval: NOTIFICATION_POLL_INTERVAL_MS");
  });

  it("sends email on T0 complete and publish success", () => {
    const notifications = read("server/systemNotifications.ts");
    expect(notifications).toContain("notifyOwnerByEmail");
    expect(notifications).toContain("sendSimpleEmail");
    expect(notifications).toContain("GEO_WEB_PATH_AI_DIAGNOSIS");
    expect(notifications).toContain("GEO_WEB_PATH_PUBLISH_RECORDS");
    expect(read(".env.example")).toContain("SMTP_HOST");
  });
});
