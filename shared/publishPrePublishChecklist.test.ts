import { describe, expect, it } from "vitest";
import {
  articleHasPublishableCover,
  evaluatePrePublishChecklist,
  formatPrePublishChecklistBlockMessage,
  getPublishPlatformMinBodyChars,
  getPublishPlatformTitleMaxChars,
  PUBLISH_PLATFORM_MIN_BODY_CHARS,
  PUBLISH_PLATFORM_TITLE_MAX_CHARS,
} from "./publishPrePublishChecklist";

const longBody = "字".repeat(2000);

describe("publishPrePublishChecklist", () => {
  it("exports platform title and body limits", () => {
    expect(PUBLISH_PLATFORM_TITLE_MAX_CHARS.zhihu).toBe(100);
    expect(PUBLISH_PLATFORM_MIN_BODY_CHARS.zhihu).toBe(2000);
    expect(getPublishPlatformTitleMaxChars("toutiao")).toBe(30);
    expect(getPublishPlatformMinBodyChars("baijiahao")).toBe(400);
  });

  it("passes when all five checks succeed", () => {
    const result = evaluatePrePublishChecklist({
      title: "知识付费平台怎么选",
      markdownContent: longBody,
      coverBase64: "abc123",
      platform: "zhihu",
      article: {
        geoQualityScore: 82,
        geoQualityRecommendation: "publish",
        geoQualityStale: false,
      },
      account: {
        platform: "zhihu",
        accountName: "测试号",
        isEnabled: 1,
        localProfileId: "p1",
        localAgentId: "a1",
        sessionStatus: "active",
      },
    });
    expect(result.allPassed).toBe(true);
    expect(result.items).toHaveLength(5);
    expect(result.items.every(i => i.passed)).toBe(true);
  });

  it("blocks title over platform limit with reason", () => {
    const result = evaluatePrePublishChecklist({
      title: "字".repeat(35),
      markdownContent: longBody,
      coverBase64: "x",
      platform: "toutiao",
      article: { geoQualityScore: 80, geoQualityRecommendation: "publish" },
      account: {
        platform: "toutiao",
        accountName: "a",
        isEnabled: 1,
        localProfileId: "p",
        localAgentId: "a",
        sessionStatus: "active",
      },
    });
    const titleItem = result.items.find(i => i.id === "title_within_limit");
    expect(titleItem?.passed).toBe(false);
    expect(titleItem?.reason).toContain("30");
  });

  it("blocks short body and missing cover", () => {
    const result = evaluatePrePublishChecklist({
      title: "短标题",
      markdownContent: "太短",
      platform: "zhihu",
      article: { geoQualityScore: 80, geoQualityRecommendation: "publish" },
      account: {
        platform: "zhihu",
        accountName: "a",
        isEnabled: 1,
        localProfileId: "p",
        localAgentId: "a",
        sessionStatus: "active",
      },
    });
    expect(result.items.find(i => i.id === "body_min_length")?.passed).toBe(false);
    expect(result.items.find(i => i.id === "has_cover")?.passed).toBe(false);
    expect(articleHasPublishableCover({ coverImageUrl: " https://cdn.example.com/c.png " })).toBe(true);
  });

  it("blocks failed quality and expired account", () => {
    const result = evaluatePrePublishChecklist({
      title: "标题",
      markdownContent: longBody,
      coverBase64: "c",
      platform: "zhihu",
      article: { geoQualityRecommendation: "reject", geoQualityScore: 40 },
      account: {
        platform: "zhihu",
        accountName: "a",
        isEnabled: 1,
        localProfileId: "p",
        localAgentId: "a",
        sessionStatus: "expired",
      },
    });
    expect(result.items.find(i => i.id === "quality_passed")?.passed).toBe(false);
    expect(result.items.find(i => i.id === "account_valid")?.passed).toBe(false);
    expect(formatPrePublishChecklistBlockMessage(result)).toContain("发布前检查未通过");
  });

  it("accepts local agent valid account when web row not synced", () => {
    const result = evaluatePrePublishChecklist({
      title: "标题",
      markdownContent: longBody,
      coverBase64: "c",
      platform: "zhihu",
      article: { geoQualityScore: 75, geoQualityRecommendation: "revise" },
      account: null,
      localAgentAccountValid: true,
    });
    expect(result.items.find(i => i.id === "account_valid")?.passed).toBe(true);
  });
});
