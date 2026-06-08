import { describe, expect, it } from "vitest";
import {
  PUBLISH_EXECUTION_EMPTY_HINTS,
  resolveDefaultPublishExecutionTab,
  resolveRecentPublishSidebarSummary,
} from "../client/src/lib/publishExecutionTabs";

describe("publishExecutionTabs", () => {
  it("resolves default tab by recent publish, waiting links, then pending", () => {
    expect(
      resolveDefaultPublishExecutionTab({
        publishedCount: 0,
        waitingLinksCount: 0,
      }),
    ).toBe("pending");
    expect(
      resolveDefaultPublishExecutionTab({
        publishedCount: 0,
        waitingLinksCount: 2,
      }),
    ).toBe("waiting_links");
    expect(
      resolveDefaultPublishExecutionTab({
        publishedCount: 1,
        waitingLinksCount: 2,
      }),
    ).toBe("published");
    expect(
      resolveDefaultPublishExecutionTab({
        publishedCount: 0,
        waitingLinksCount: 0,
        hasActiveSuccessNotice: true,
      }),
    ).toBe("published");
  });

  it("uses customer-facing pending empty copy", () => {
    expect(PUBLISH_EXECUTION_EMPTY_HINTS.pending.reason).toContain("当前没有待发布任务");
    expect(PUBLISH_EXECUTION_EMPTY_HINTS.pending.reason).toContain("收录状态");
  });

  it("summarizes recent publish for sidebar", () => {
    expect(
      resolveRecentPublishSidebarSummary({
        agentTasks: [],
        publishRecords: [],
      }),
    ).toBeNull();

    const summary = resolveRecentPublishSidebarSummary({
      agentTasks: [
        {
          articleId: 1,
          status: "completed",
          platform: "zhihu",
          resultUrl: "https://zhuanlan.zhihu.com/p/1",
          agentFinishedAt: "2026-06-07T10:00:00.000Z",
        },
      ],
      publishRecords: [],
    });
    expect(summary?.recentLabel).toContain("知乎");
    expect(summary?.recentLabel).toContain("已发布");
    expect(summary?.nextStepLabel).toBe("7天后复测");
  });
});
