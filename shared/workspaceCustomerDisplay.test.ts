import { describe, expect, it } from "vitest";
import {
  resolveWorkspaceCustomerStatusLabel,
  workspaceHasAiTestData,
} from "./workspaceCustomerDisplay";

describe("workspaceCustomerDisplay", () => {
  it("shows monthly plan executing status when active plan exists", () => {
    expect(
      resolveWorkspaceCustomerStatusLabel({
        stageId: "ai_diagnosis",
        monthlyPlanStage: "executing",
        hasAiTestData: true,
        hasCompletedT0Baseline: true,
      }),
    ).toBe("本月计划执行中");
  });

  it("does not show pending diagnosis when ai test data exists without monthly plan", () => {
    expect(
      resolveWorkspaceCustomerStatusLabel({
        stageId: "ai_diagnosis",
        monthlyPlanStage: null,
        hasAiTestData: true,
        hasCompletedT0Baseline: true,
      }),
    ).toBe("实测已完成");
  });

  it("detects ai test data from mention rate or counts", () => {
    expect(workspaceHasAiTestData({ aiTestResultCount: 0, brandMentionRate: 0.41 })).toBe(true);
    expect(workspaceHasAiTestData({ aiTestResultCount: 3, brandMentionRate: null })).toBe(true);
    expect(workspaceHasAiTestData({ aiTestResultCount: 0, brandMentionRate: null })).toBe(false);
  });
});
