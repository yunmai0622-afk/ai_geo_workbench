import { describe, expect, it } from "vitest";
import {
  formatPublishEnqueueAccountOptionLabel,
  formatPublishEnqueueLastPublishedAt,
  publishEnqueueAccountStorageKey,
  publishEnqueueLoginStatusLabel,
} from "./publishEnqueueAccountSelect";

describe("publishEnqueueAccountSelect", () => {
  it("maps session status to enqueue labels", () => {
    expect(publishEnqueueLoginStatusLabel("active")).toBe("有效");
    expect(publishEnqueueLoginStatusLabel("expired")).toBe("需重新登录");
    expect(publishEnqueueLoginStatusLabel(null)).toBe("未检测");
  });

  it("formats account option with name status and last publish", () => {
    const label = formatPublishEnqueueAccountOptionLabel({
      accountName: "官方号",
      sessionStatus: "active",
      lastLoginAt: "2026-06-01T10:00:00.000Z",
    });
    expect(label).toContain("官方号");
    expect(label).toContain("有效");
    expect(label).toContain("最近发布");
    expect(formatPublishEnqueueLastPublishedAt(null)).toBe("暂无");
  });

  it("builds stable storage key", () => {
    expect(publishEnqueueAccountStorageKey(12, "zhihu")).toBe("geo.publish.enqueueAccount:12:zhihu");
  });
});
