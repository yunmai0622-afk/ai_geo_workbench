import { describe, expect, it } from "vitest";
import {
  buildRetestPlan,
  resolveRetestDueReminder,
  shouldShowT1RetestAutoTriggerReminderFromPlan,
} from "./retestPlan";
import { T1_RETEST_AFTER_PUBLISH_DAYS } from "./t1RetestAutoTrigger";

describe("retestPlan", () => {
  const now = new Date("2026-06-08T12:00:00Z");
  const publishAt = new Date(now.getTime() - 40 * 86_400_000).toISOString();

  const baseInput = {
    completedPublishTasks: [{ status: "completed", agentFinishedAt: publishAt }],
    testRounds: [{ roundType: "T0_BASELINE", status: "completed", finishedAt: publishAt }],
    now,
  };

  it("builds T1/T2/T3 schedule from latest publish", () => {
    const plan = buildRetestPlan(baseInput);
    expect(plan.milestones).toHaveLength(3);
    expect(plan.milestones[0]?.phase).toBe("T1");
    expect(plan.milestones[0]?.scheduleHint).toContain("7");
    expect(plan.milestones[1]?.scheduleHint).toContain("30");
    expect(plan.milestones[2]?.scheduleHint).toContain("90");
    expect(plan.publishAtLabel).toBeTruthy();
  });

  it("marks overdue milestones as due after publish elapsed", () => {
    const plan = buildRetestPlan(baseInput);
    expect(plan.milestones[0]?.status).toBe("due");
    expect(plan.milestones[1]?.status).toBe("due");
    expect(plan.milestones[2]?.status).toBe("scheduled");
  });

  it("suggests earliest incomplete milestone", () => {
    const plan = buildRetestPlan({
      ...baseInput,
      testRounds: [
        ...baseInput.testRounds,
        { roundType: "T1_RETEST", status: "completed", finishedAt: "2026-05-01" },
      ],
    });
    expect(plan.nextSuggestion?.phase).toBe("T2");
  });

  it("returns T1 due reminder before T1 completes", () => {
    expect(resolveRetestDueReminder(baseInput)?.phase).toBe("T1");
  });

  it("returns T2 due reminder after T1 completes and 30+ days", () => {
    expect(
      resolveRetestDueReminder({
        ...baseInput,
        testRounds: [
          ...baseInput.testRounds,
          { roundType: "T1_RETEST", status: "completed", finishedAt: "2026-05-01" },
        ],
      })?.phase,
    ).toBe("T2");
  });

  it("returns null when all milestones complete", () => {
    expect(
      resolveRetestDueReminder({
        ...baseInput,
        testRounds: [
          { roundType: "T1_RETEST", status: "completed" },
          { roundType: "T2_RETEST", status: "completed" },
          { roundType: "T3_RETEST", status: "completed" },
        ],
      }),
    ).toBeNull();
  });

  it("hides due reminder before publish threshold", () => {
    const recentPublish = new Date(now.getTime() - 5 * 86_400_000).toISOString();
    expect(
      resolveRetestDueReminder({
        completedPublishTasks: [{ status: "completed", agentFinishedAt: recentPublish }],
        testRounds: [],
        now,
      }),
    ).toBeNull();
  });

  it("aligns T1 auto trigger with plan due reminder", () => {
    const eightDaysAgo = new Date(
      now.getTime() - (T1_RETEST_AFTER_PUBLISH_DAYS + 1) * 86_400_000,
    ).toISOString();
    const input = {
      completedPublishTasks: [{ status: "completed", agentFinishedAt: eightDaysAgo }],
      testRounds: [{ roundType: "T0_BASELINE", status: "completed" }],
      now,
    };
    expect(shouldShowT1RetestAutoTriggerReminderFromPlan(input)).toBe(true);
    expect(resolveRetestDueReminder(input)?.phase).toBe("T1");
  });
});
