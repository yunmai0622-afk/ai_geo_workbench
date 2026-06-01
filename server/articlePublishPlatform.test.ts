import { describe, expect, it } from "vitest";
import { buildPlatformContentStrategyMeta, buildDefaultPlatformStrategy } from "@shared/platformContentRules";
import {
  getArticlePublishPlatform,
  normalizePublishPlatform,
  resolveArticleListPublishFields,
} from "@shared/articlePublishPlatform";

describe("articlePublishPlatform", () => {
  it("maps 知乎 generation basis to zhihu publish queue", () => {
    const strategy = buildDefaultPlatformStrategy({
      targetPublishPlatform: "zhihu",
      targetQuestion: "如何选型？",
    });
    const meta = buildPlatformContentStrategyMeta(strategy);
    const resolved = getArticlePublishPlatform({
      generationBasis: { platformContentStrategy: meta as unknown as Record<string, unknown> },
      targetPlatform: null,
    });
    expect(resolved.slug).toBe("zhihu");
    expect(resolved.label).toBe("知乎");
    expect(resolved.publishQueueSlug).toBe("zhihu");
    expect(resolved.supportedByLocalAgent).toBe(true);
    expect(resolved.recognized).toBe(true);
    expect(resolved.queueBlockedReason).toBeNull();
  });

  it("maps 搜狐号 from label when list only has task card platform", () => {
    const resolved = normalizePublishPlatform("搜狐号");
    expect(resolved.slug).toBe("sohu");
    expect(resolved.publishQueueSlug).toBe("sohu");
    expect(resolved.recognized).toBe(true);
  });

  it("maps xiaohongshu with local agent unsupported hint", () => {
    const resolved = normalizePublishPlatform("小红书");
    expect(resolved.slug).toBe("xiaohongshu");
    expect(resolved.publishQueueSlug).toBeNull();
    expect(resolved.supportedByLocalAgent).toBe(false);
    expect(resolved.queueBlockedReason).toMatch(/小红书/);
  });

  it("does not treat 其他平台 as unknown when basis has toutiao", () => {
    const strategy = buildDefaultPlatformStrategy({
      targetPublishPlatform: "toutiao",
      targetQuestion: "科普问题",
    });
    const fields = resolveArticleListPublishFields({
      generationBasis: {
        platformContentStrategy: buildPlatformContentStrategyMeta(strategy) as unknown as Record<string, unknown>,
      },
      taskRecommendedPlatform: "其他平台",
    });
    expect(fields.publishPlatform).toBe("toutiao");
    expect(fields.targetPlatform).toBe("头条号");
  });

  it("returns unknown with actionable message when all fields missing", () => {
    const resolved = getArticlePublishPlatform({});
    expect(resolved.recognized).toBe(false);
    expect(resolved.queueBlockedReason).toMatch(/内容策略/);
  });

  it("maps netease as local-agent publish platform", () => {
    const resolved = normalizePublishPlatform("网易号");
    expect(resolved.slug).toBe("netease");
    expect(resolved.publishQueueSlug).toBe("netease");
    expect(resolved.supportedByLocalAgent).toBe(true);
    expect(resolved.queueBlockedReason).toBeNull();
  });
});
