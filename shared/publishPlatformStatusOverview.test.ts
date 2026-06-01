import { describe, expect, it } from "vitest";
import {
  buildPublishPlatformStatusOverview,
  formatPlatformStatusLastPublished,
} from "./publishPlatformStatusOverview";

describe("buildPublishPlatformStatusOverview", () => {
  it("lists binding platforms then manual-only platforms", () => {
    const rows = buildPublishPlatformStatusOverview([]);
    expect(rows.map(r => ("platform" in r ? r.platform : r.key))).toEqual([
      "zhihu",
      "sohu",
      "toutiao",
      "baijiahao",
      "netease",
      "xiaohongshu",
      "wechat",
    ]);
    const manuals = rows.filter(r => r.kind === "manual");
    expect(manuals).toHaveLength(2);
    expect(manuals.every(r => r.detail === "人工发布")).toBe(true);
  });

  it("marks zhihu bound and picks latest lastLoginAt for display", () => {
    const rows = buildPublishPlatformStatusOverview([
      {
        platform: "zhihu",
        accounts: [
          { accountName: "A", isEnabled: true, lastLoginAt: "2026-01-01T10:00:00.000Z" },
          { accountName: "B", isEnabled: true, lastLoginAt: "2026-02-01T10:00:00.000Z" },
        ],
      },
    ]);
    const zhihu = rows.find(r => r.kind === "binding" && r.platform === "zhihu");
    expect(zhihu?.kind).toBe("binding");
    if (zhihu?.kind !== "binding") throw new Error("expected binding row");
    expect(zhihu.bound).toBe(true);
    expect(zhihu.lastPublishedAt).toBe("2026-02-01T10:00:00.000Z");
    expect(formatPlatformStatusLastPublished(zhihu.lastPublishedAt)).not.toBe("暂无");
  });
});
