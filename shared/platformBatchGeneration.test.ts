import { describe, expect, it } from "vitest";
import {
  buildPlatformBatchQueue,
  countPlatformBatchCompleted,
  countPlatformBatchFinished,
  formatPlatformBatchProgress,
  platformBatchStatusLabel,
  updatePlatformBatchItemStatus,
} from "./platformBatchGeneration";

describe("platformBatchGeneration", () => {
  const platforms = [
    { key: "zhihu", label: "知乎" },
    { key: "xiaohongshu", label: "小红书" },
  ];

  it("builds pending queue for all platforms", () => {
    const queue = buildPlatformBatchQueue(platforms);
    expect(queue).toEqual([
      { platformKey: "zhihu", label: "知乎", status: "pending" },
      { platformKey: "xiaohongshu", label: "小红书", status: "pending" },
    ]);
  });

  it("updates item status and counts progress", () => {
    let queue = buildPlatformBatchQueue(platforms);
    queue = updatePlatformBatchItemStatus(queue, "zhihu", { status: "running" });
    queue = updatePlatformBatchItemStatus(queue, "zhihu", { status: "completed" });
    queue = updatePlatformBatchItemStatus(queue, "xiaohongshu", {
      status: "failed",
      errorMessage: "暂无可用生成任务",
    });
    expect(countPlatformBatchCompleted(queue)).toBe(1);
    expect(countPlatformBatchFinished(queue)).toBe(2);
    expect(formatPlatformBatchProgress(1, 2)).toBe("已完成 1/2 个平台");
    expect(platformBatchStatusLabel("running")).toBe("进行中");
    expect(platformBatchStatusLabel("failed")).toBe("失败");
  });
});
