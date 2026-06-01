import { describe, expect, it } from "vitest";
import {
  daysSincePublish,
  findLatestCompletedPublishAt,
  shouldShowT1RetestAutoTriggerReminder,
  T1_RETEST_AFTER_PUBLISH_DAYS,
} from "./t1RetestAutoTrigger";

describe("t1RetestAutoTrigger", () => {
  const now = new Date("2026-06-08T12:00:00Z");
  const eightDaysAgo = new Date(now.getTime() - (T1_RETEST_AFTER_PUBLISH_DAYS + 1) * 86_400_000).toISOString();
  const sixDaysAgo = new Date(now.getTime() - 6 * 86_400_000).toISOString();

  it("finds latest completed publish timestamp", () => {
    expect(
      findLatestCompletedPublishAt([
        { status: "completed", agentFinishedAt: "2026-01-01" },
        { status: "completed", agentFinishedAt: "2026-02-01" },
        { status: "failed", agentFinishedAt: "2026-03-01" },
      ]),
    ).toBe("2026-02-01");
  });

  it("falls back to updatedAt when agentFinishedAt is missing", () => {
    expect(
      findLatestCompletedPublishAt([{ status: "completed", updatedAt: "2026-03-01" }]),
    ).toBe("2026-03-01");
  });

  it("shows reminder when publish is older than 7 days and T1 is incomplete", () => {
    expect(
      shouldShowT1RetestAutoTriggerReminder({
        completedPublishTasks: [{ status: "completed", agentFinishedAt: eightDaysAgo }],
        testRounds: [{ roundType: "T0_BASELINE", status: "completed", finishedAt: eightDaysAgo }],
        now,
      }),
    ).toBe(true);
  });

  it("hides reminder within 7 days of publish", () => {
    expect(
      shouldShowT1RetestAutoTriggerReminder({
        completedPublishTasks: [{ status: "completed", agentFinishedAt: sixDaysAgo }],
        testRounds: [],
        now,
      }),
    ).toBe(false);
  });

  it("hides reminder when T1 retest is completed", () => {
    expect(
      shouldShowT1RetestAutoTriggerReminder({
        completedPublishTasks: [{ status: "completed", agentFinishedAt: eightDaysAgo }],
        testRounds: [{ roundType: "T1_RETEST", status: "completed", finishedAt: "2026-06-01" }],
        now,
      }),
    ).toBe(false);
  });

  it("hides reminder without completed publish tasks", () => {
    expect(
      shouldShowT1RetestAutoTriggerReminder({
        completedPublishTasks: [{ status: "failed", agentFinishedAt: eightDaysAgo }],
        testRounds: [],
        now,
      }),
    ).toBe(false);
  });

  it("computes elapsed days since publish", () => {
    expect(daysSincePublish("2026-06-01T12:00:00Z", now)).toBeCloseTo(7, 0);
  });
});
