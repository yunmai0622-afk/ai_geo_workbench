import { describe, expect, it } from "vitest";
import { buildPublishPlatformAccountOverview } from "./publishPlatformAccountOverview";

describe("buildPublishPlatformAccountOverview", () => {
  it("covers all binding platforms in fixed order", () => {
    const rows = buildPublishPlatformAccountOverview([]);
    expect(rows.map(r => r.platform)).toEqual(["zhihu", "sohu", "toutiao", "baijiahao", "netease"]);
    expect(rows.every(r => !r.bound && r.accountNames.length === 0)).toBe(true);
  });

  it("marks bound platforms and prefers enabled account names", () => {
    const rows = buildPublishPlatformAccountOverview([
      {
        platform: "zhihu",
        accounts: [
          { accountName: "官方知乎", isEnabled: true },
          { accountName: "备用号", isEnabled: false },
        ],
      },
      {
        platform: "sohu",
        accounts: [{ accountName: "搜狐草稿", isEnabled: false }],
      },
    ]);
    const zhihu = rows.find(r => r.platform === "zhihu");
    const sohu = rows.find(r => r.platform === "sohu");
    expect(zhihu?.bound).toBe(true);
    expect(zhihu?.accountNames).toEqual(["官方知乎"]);
    expect(sohu?.bound).toBe(true);
    expect(sohu?.accountNames).toEqual(["搜狐草稿"]);
  });
});
