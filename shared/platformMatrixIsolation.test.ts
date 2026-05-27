import { describe, expect, it } from "vitest";
import { PUBLISH_PLATFORM_IDS, getPlatformSpecificOutline, PLATFORM_CONTENT_RULES } from "./platformContentRules";

describe("platform matrix isolation P0", () => {
  it("platform ids cover matrix", () => {
    for (const id of ["xiaohongshu", "zhihu", "sohu", "netease", "wechat", "baijiahao", "toutiao", "other"] as const) {
      expect(PUBLISH_PLATFORM_IDS).toContain(id);
      expect(PLATFORM_CONTENT_RULES[id]).toBeTruthy();
    }
  });

  it("platform outlines are platform-specific (not all zhihu)", () => {
    const brand = "示例品牌";
    const xhs = getPlatformSpecificOutline("xiaohongshu", brand);
    const sohu = getPlatformSpecificOutline("sohu", brand);
    const zhihu = getPlatformSpecificOutline("zhihu", brand);
    expect(xhs).not.toBe(zhihu);
    expect(sohu).not.toBe(zhihu);
  });
});

