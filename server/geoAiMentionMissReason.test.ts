import { describe, expect, it } from "vitest";
import {
  inferMissReason,
  isAiTestMissReason,
  missReasonLabelCn,
  normalizeAiTestResult,
} from "@shared/aiTestEvidence";
import { buildAiMentionSuggestion } from "./geoAiMentionCheck";
import { enrichAiTestResult } from "./geoAiMentionEvidence";

describe("ai mention miss reason (C1-G)", () => {
  it("adds missReason when brand is not mentioned", () => {
    const item = enrichAiTestResult(
      {
        engine: "doubao",
        engineName: "豆包",
        question: "知识付费平台怎么选？",
        answer: "可以考虑小鹅通或有赞。",
        mentionsBrand: false,
        recommendsBrand: false,
        recommendationRank: null,
        testedAt: "2026-05-20T10:00:00.000Z",
      },
      ["小鹅通"],
      ["海豚知道"],
      "manual_check",
      { articlePublishedAt: "2026-05-18T10:00:00.000Z" },
    );
    expect(item.mentionedBrand).toBe(false);
    expect(item.missReason).toBeDefined();
    expect(isAiTestMissReason(item.missReason)).toBe(true);
    expect(item.missReason).toBe("fresh_content_delay");
    expect(missReasonLabelCn(item.missReason)).toContain("内容刚发布");
  });

  it("does not add missReason when brand is mentioned", () => {
    const item = enrichAiTestResult(
      {
        engine: "doubao",
        engineName: "豆包",
        question: "哪家好？",
        answer: "推荐海豚知道。",
        mentionsBrand: true,
        recommendsBrand: true,
        recommendationRank: 1,
        testedAt: new Date().toISOString(),
      },
      [],
      ["海豚知道"],
    );
    expect(item.missReason).toBeUndefined();
  });

  it("old aiTestResults without missReason remain compatible", () => {
    const item = normalizeAiTestResult({
      engine: "doubao",
      engineName: "豆包",
      question: "Q",
      answer: "无品牌",
      mentionsBrand: false,
      recommendsBrand: false,
      testedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(item?.missReason).toBeUndefined();
    expect(missReasonLabelCn(item?.missReason)).toBeNull();
    expect(item).not.toHaveProperty("missReason");
  });

  it("zero mention advice explains likely reasons", () => {
    const text = buildAiMentionSuggestion({ mentionRate: 0, recommendRate: 0 });
    for (const phrase of ["问题较泛", "品牌实体信号", "品牌认知类", "竞品对比类", "7-14 天后复测"]) {
      expect(text).toContain(phrase);
    }
    expect(text).not.toContain("建议优先发布更多 GEO 内容");
  });

  it("infers question_too_generic for generic questions without brand name", () => {
    const reason = inferMissReason({
      question: "知识付费业务增长乏力怎么办？",
      citedUrls: ["https://example.com/a"],
      testedAt: "2026-05-20T10:00:00.000Z",
      brandNames: ["海豚知道"],
    });
    expect(reason).toBe("question_too_generic");
    expect(missReasonLabelCn(reason)).toContain("问题较泛");
  });
});
