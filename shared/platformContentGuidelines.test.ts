import { describe, expect, it } from "vitest";
import {
  formatPlatformContentGuidelineLine,
  getPlatformContentGuideline,
  getPlatformContentGuidelineByPublishId,
  PLATFORM_CONTENT_GUIDELINES,
} from "./platformContentGuidelines";

describe("platformContentGuidelines", () => {
  it("covers six publish platforms", () => {
    expect(PLATFORM_CONTENT_GUIDELINES).toHaveLength(6);
  });

  it("resolves by label", () => {
    const g = getPlatformContentGuideline("知乎");
    expect(g?.style).toBe("问答体");
    expect(formatPlatformContentGuidelineLine(g!)).toContain("2000 字以上");
  });

  it("resolves by publish id", () => {
    expect(getPlatformContentGuidelineByPublishId("xiaohongshu")?.label).toBe("小红书");
    expect(getPlatformContentGuidelineByPublishId("netease")).toBeNull();
  });
});
