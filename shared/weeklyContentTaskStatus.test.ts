import { describe, expect, it } from "vitest";
import {
  buildWeeklyContentAssistantBlockers,
  buildWeeklyContentAssistantNextSteps,
  formatWeeklyContentTaskProgress,
  resolveWeeklyPlatformContentStatus,
  weeklyContentTaskStatusLabel,
} from "./weeklyContentTaskStatus";

describe("weeklyContentTaskStatus", () => {
  it("maps platform content states to unified labels", () => {
    expect(weeklyContentTaskStatusLabel("UNGENERATED")).toBe("待生成");
    expect(weeklyContentTaskStatusLabel("PUBLISH_READY")).toBe("可入队");
    expect(
      resolveWeeklyPlatformContentStatus({ hasArticle: false, generating: false }),
    ).toBe("UNGENERATED");
    expect(
      resolveWeeklyPlatformContentStatus({ hasArticle: true, generating: true }),
    ).toBe("GENERATING");
    expect(
      resolveWeeklyPlatformContentStatus({
        hasArticle: true,
        published: true,
      }),
    ).toBe("PUBLISHED");
    expect(
      resolveWeeklyPlatformContentStatus({
        hasArticle: true,
        publishReady: true,
      }),
    ).toBe("PUBLISH_READY");
  });

  it("formats task progress line", () => {
    expect(
      formatWeeklyContentTaskProgress({
        generatedCount: 3,
        publishReadyCount: 2,
        pendingReviewCount: 1,
        enqueueReadyCount: 1,
        queuedCount: 1,
        publishedCount: 0,
      }),
    ).toBe(
      "已生成 3 篇 / 可入队 2 篇 / 待质检 1 篇 / 已入队 1 篇 / 已发布 0 篇",
    );
  });

  it("builds assistant blockers and next steps", () => {
    expect(
      buildWeeklyContentAssistantBlockers({
        ungeneratedPlatformCount: 3,
        qualityPendingCount: 2,
        publishReadyCount: 5,
      }),
    ).toEqual(["还有 3 个平台未生成内容", "2 篇内容待质检"]);
    expect(
      buildWeeklyContentAssistantNextSteps({
        nextUngeneratedPlatformLabel: "知乎",
        qualityPendingCount: 1,
        publishReadyCount: 5,
      }),
    ).toEqual(["生成知乎内容", "完成待质检内容确认", "将 5 篇可发布内容加入发布队列"]);
  });
});
