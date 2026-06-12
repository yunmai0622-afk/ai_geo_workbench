import { describe, expect, it } from "vitest";
import {
  articleHasAssignedTargetPublishPlatform,
  formatWeeklyArticleCustomerTitle,
  parseWeeklyVariantTitleSuffix,
} from "./weeklyArticleCustomerTitle";

describe("weeklyArticleCustomerTitle", () => {
  it("parses extension variant suffix", () => {
    expect(parseWeeklyVariantTitleSuffix("工业泵选型指南 · 延伸篇2")).toEqual({
      baseTitle: "工业泵选型指南",
      variantNumber: 2,
    });
    expect(parseWeeklyVariantTitleSuffix("普通标题")).toEqual({
      baseTitle: "普通标题",
      variantNumber: null,
    });
  });

  it("strips variant suffix when platform is assigned", () => {
    expect(
      formatWeeklyArticleCustomerTitle({
        title: "工业泵选型指南 · 延伸篇3",
        generationBasis: {
          platformContentStrategy: { targetPublishPlatform: "zhihu" },
        },
        targetPlatform: "知乎",
      }),
    ).toBe("工业泵选型指南");
  });

  it("shows alternate version label for unassigned platform variants", () => {
    expect(
      formatWeeklyArticleCustomerTitle({
        title: "工业泵选型指南 · 延伸篇2",
        generationBasis: {},
      }),
    ).toBe("工业泵选型指南（备选版本2）");
  });

  it("detects assigned target publish platform in generation basis", () => {
    expect(
      articleHasAssignedTargetPublishPlatform({
        platformContentStrategy: { targetPublishPlatform: "xiaohongshu" },
      }),
    ).toBe(true);
    expect(articleHasAssignedTargetPublishPlatform({})).toBe(false);
  });
});
