import { describe, expect, it } from "vitest";
import {
  aggregateAiTestEvidence,
  buildPublishBeforeAfterCompare,
  mergeAiTestResultsByStage,
  normalizeAiTestResult,
  resolveTestStage,
  type AiTestEvidenceItem,
  type AiTestStage,
} from "@shared/aiTestEvidence";
import {
  analyzeCompetitorMentions,
  analyzeSentiment,
  enrichAiTestResult,
  extractCitedUrls,
} from "./geoAiMentionEvidence";

function stubEvidenceItem(stage: AiTestStage, question: string, testedAt = "2026-01-01T00:00:00.000Z"): AiTestEvidenceItem {
  return {
    engine: "doubao",
    engineName: "豆包",
    question,
    answer: "回答",
    testedAt,
    mentionsBrand: true,
    recommendsBrand: false,
    recommendationRank: null,
    rawAnswer: "回答",
    mentionedBrand: true,
    recommendedBrand: false,
    brandRank: null,
    citedUrls: [],
    sentiment: "neutral",
    competitorMentions: [],
    parseStatus: "success",
    testStage: stage,
  };
}

describe("geoAiMentionEvidence", () => {
  it("aiTestResults preserves other stages when saving new stage results", () => {
    const legacy = { engine: "doubao", engineName: "豆包", question: "旧人工", answer: "A", mentionsBrand: true, recommendsBrand: false, recommendationRank: null, testedAt: "2026-01-01T00:00:00.000Z" };
    const existing = [stubEvidenceItem("before_publish", "发布前Q1"), legacy];

    const afterFirst = mergeAiTestResultsByStage(existing, [stubEvidenceItem("after_publish", "发布后Q1")], "after_publish");
    expect(afterFirst.filter(r => r.testStage === "before_publish")).toHaveLength(1);
    expect(afterFirst.filter(r => r.testStage === "manual_check")).toHaveLength(1);
    expect(afterFirst.filter(r => r.testStage === "after_publish")).toHaveLength(1);

    const afterSecond = mergeAiTestResultsByStage(afterFirst, [stubEvidenceItem("after_publish", "发布后Q2", "2026-01-02T00:00:00.000Z")], "after_publish");
    expect(afterSecond.filter(r => r.testStage === "before_publish")).toHaveLength(1);
    expect(afterSecond.filter(r => r.testStage === "manual_check")).toHaveLength(1);
    expect(afterSecond.filter(r => r.testStage === "after_publish")).toHaveLength(1);
    expect(afterSecond.find(r => r.testStage === "after_publish")?.question).toBe("发布后Q2");

    const afterManual = mergeAiTestResultsByStage(afterSecond, [stubEvidenceItem("manual_check", "新人工")], "manual_check");
    expect(afterManual.filter(r => r.testStage === "manual_check")).toHaveLength(1);
    expect(afterManual.find(r => r.testStage === "manual_check")?.question).toBe("新人工");
    expect(afterManual.filter(r => r.testStage === "before_publish")).toHaveLength(1);
    expect(afterManual.filter(r => r.testStage === "after_publish")).toHaveLength(1);
  });

  it("extracts cited urls from answer", () => {
    const urls = extractCitedUrls("详见 https://example.com/a 与 http://foo.cn/b。");
    expect(urls).toContain("https://example.com/a");
    expect(urls).toContain("http://foo.cn/b");
  });

  it("detects competitor mention with context", () => {
    const rows = analyzeCompetitorMentions("小鹅通适合教培，海豚知道也不错。", ["小鹅通", "海豚知道"]);
    const xet = rows.find(r => r.name === "小鹅通");
    expect(xet?.mentioned).toBe(true);
    expect(xet?.context).toContain("小鹅通");
  });

  it("sentiment is neutral when brand not mentioned", () => {
    expect(analyzeSentiment("可以考虑小鹅通。", ["海豚知道"], false, false)).toBe("neutral");
  });

  it("normalizes legacy aiTestResults without new fields", () => {
    const item = normalizeAiTestResult({
      engine: "doubao",
      engineName: "豆包",
      question: "哪家好？",
      answer: "推荐海豚知道。",
      mentionsBrand: true,
      recommendsBrand: true,
      recommendationRank: 1,
      testedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(item?.rawAnswer).toBe("推荐海豚知道。");
    expect(item?.competitorMentions).toEqual([]);
    expect(item?.parseStatus).toBe("success");
    expect(item?.testStage).toBe("manual_check");
    expect(resolveTestStage({})).toBe("manual_check");
  });

  it("aggregates monitoring rows for delivery report", () => {
    const agg = aggregateAiTestEvidence([
      {
        monitoringRecordId: 1,
        results: [
          {
            engine: "doubao",
            engineName: "豆包",
            question: "Q1",
            answer: "A1",
            mentionsBrand: true,
            recommendsBrand: false,
            recommendationRank: null,
            testedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    ]);
    expect(agg.questionCount).toBe(1);
    expect(agg.keySamples).toHaveLength(1);
  });

  it("enriches test result with evidence fields", () => {
    const item = enrichAiTestResult(
      {
        engine: "doubao",
        engineName: "豆包",
        question: "哪家好？",
        answer: "推荐海豚知道，官网 https://a.com",
        mentionsBrand: true,
        recommendsBrand: true,
        recommendationRank: 1,
        testedAt: new Date().toISOString(),
      },
      ["小鹅通"],
      ["海豚知道"],
    );
    expect(item.rawAnswer).toContain("海豚知道");
    expect(item.parseStatus).toBe("success");
    expect(item.testStage).toBe("manual_check");
    expect(item.citedUrls.length).toBeGreaterThan(0);
    expect(item.competitorMentions.some(c => c.name === "小鹅通")).toBe(true);
  });

  it("builds publish before/after compare without fake zeros", () => {
    const compare = buildPublishBeforeAfterCompare([
      {
        engine: "doubao",
        engineName: "豆包",
        question: "Q1",
        answer: "A",
        testedAt: "2026-01-01",
        mentionsBrand: true,
        recommendsBrand: false,
        recommendationRank: 2,
        rawAnswer: "A",
        mentionedBrand: true,
        recommendedBrand: false,
        brandRank: 2,
        citedUrls: ["https://a.com"],
        sentiment: "neutral",
        competitorMentions: [],
        parseStatus: "success",
        testStage: "before_publish",
      },
      {
        engine: "doubao",
        engineName: "豆包",
        question: "Q2",
        answer: "B",
        testedAt: "2026-01-02",
        mentionsBrand: true,
        recommendsBrand: true,
        recommendationRank: 1,
        rawAnswer: "B",
        mentionedBrand: true,
        recommendedBrand: true,
        brandRank: 1,
        citedUrls: ["https://a.com", "https://b.com"],
        sentiment: "positive",
        competitorMentions: [],
        parseStatus: "success",
        testStage: "after_publish",
      },
    ]);
    expect(compare.before.hasData).toBe(true);
    expect(compare.after.hasData).toBe(true);
    expect(compare.before.mentionRate).toBe(1);
    expect(compare.after.recommendRate).toBe(1);
    expect(compare.changes.recommendRateDelta).toBe(1);
    expect(compare.changes.citedUrlCountDelta).toBe(1);
    expect(enrichAiTestResult(
      {
        engine: "doubao",
        engineName: "豆包",
        question: "Q",
        answer: "A",
        mentionsBrand: false,
        recommendsBrand: false,
        recommendationRank: null,
        testedAt: new Date().toISOString(),
      },
      [],
      ["品牌"],
      "before_publish",
    ).testStage).toBe("before_publish");
  });
});
