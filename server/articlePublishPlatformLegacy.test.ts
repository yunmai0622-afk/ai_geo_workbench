import { describe, expect, it } from "vitest";
import {
  getArticlePublishPlatform,
  resolveEffectiveArticlePublishPlatform,
} from "@shared/articlePublishPlatform";

describe("legacy article publish platform", () => {
  it("无 basis 时 recognized=false", () => {
    const r = getArticlePublishPlatform({ generationBasis: {} });
    expect(r.recognized).toBe(false);
    expect(r.weeklyPlatformKey).toBe("other");
  });

  it("手动指定 zhihu 可识别", () => {
    const r = resolveEffectiveArticlePublishPlatform({ generationBasis: {} }, "zhihu");
    expect(r.recognized).toBe(true);
    expect(r.slug).toBe("zhihu");
  });

  it("taskRecommendedPlatform 可推断", () => {
    const r = getArticlePublishPlatform({
      generationBasis: {},
      taskRecommendedPlatform: "知乎",
    });
    expect(r.recognized).toBe(true);
    expect(r.slug).toBe("zhihu");
  });
});
