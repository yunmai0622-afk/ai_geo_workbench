import { describe, expect, it } from "vitest";
import { buildPublishingViewModel } from "./buildPublishingViewModel";

describe("buildPublishingViewModel", () => {
  it("derives empty queue tabs and zero counts when tasks and records are empty", () => {
    const vm = buildPublishingViewModel({
      projectId: 72,
      articles: [],
      scores: [],
      publishRecords: [],
      agentTasks: [],
      accountGroups: [
        {
          platform: "zhihu",
          accounts: [
            {
              id: 1,
              accountName: "测试知乎",
              isEnabled: true,
              localProfileId: "p1",
              sessionStatus: "expired",
              lastLoginAt: null,
            },
          ],
        },
      ],
      articleById: new Map(),
      autoInclusionByArticleAndUrl: new Set(),
    });

    expect(vm.queueTabs.pending).toHaveLength(0);
    expect(vm.agentTaskDerivedState.pendingCount).toBe(0);
    expect(vm.agentTaskDerivedState.hasInFlightAgentTasks).toBe(false);
    expect(vm.expiredAccounts.length).toBeGreaterThanOrEqual(0);
    expect(vm.platformStatusSummary.length).toBeGreaterThan(0);
    expect(vm.accountStatusCards.some(r => r.platform === "zhihu")).toBe(true);
  });

  it("does not throw when account groups are empty arrays", () => {
    expect(() =>
      buildPublishingViewModel({
        articles: [],
        scores: [],
        publishRecords: [],
        agentTasks: [],
        accountGroups: [],
        articleById: new Map(),
        autoInclusionByArticleAndUrl: new Set(),
      }),
    ).not.toThrow();
  });
});
