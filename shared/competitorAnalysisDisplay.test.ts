import { describe, expect, it } from "vitest";
import {
  aggregateCompetitorMentionCounts,
  buildCompetitorAnalysisRows,
  buildCompetitorContentSuggestions,
} from "./competitorAnalysisDisplay";

describe("aggregateCompetitorMentionCounts", () => {
  it("counts fuzzy matches for profile competitor names", () => {
    const counts = aggregateCompetitorMentionCounts(
      ["小鹅通", "有赞教育"],
      [["小鹅通", "千聊"], ["有赞教育版"], ["小鹅通 SaaS"]],
    );
    expect(counts["小鹅通"]).toBe(2);
    expect(counts["有赞教育"]).toBe(1);
  });
});

describe("buildCompetitorContentSuggestions", () => {
  it("suggests comparison page when mention count is high", () => {
    const suggestions = buildCompetitorContentSuggestions({
      brandName: "海豚知道",
      totalAiTestRuns: 10,
      aiMentionCounts: { 小鹅通: 5 },
      competitors: [
        {
          id: 1,
          competitorName: "小鹅通",
          strengths: "课程交付链路成熟",
          contentAssets: JSON.stringify({ platforms: { zhihu: true, sohu: false, baijiahao: true, toutiao: false, wechat: false }, note: "" }),
        },
      ],
    });
    expect(suggestions.some(s => s.includes("竞品对比页"))).toBe(true);
    expect(suggestions.some(s => s.includes("知乎"))).toBe(true);
  });
});

describe("buildCompetitorAnalysisRows", () => {
  it("maps strengths to advantage description", () => {
    const rows = buildCompetitorAnalysisRows({
      brandName: "测试品牌",
      totalAiTestRuns: 1,
      aiMentionCounts: { 竞品A: 1 },
      competitors: [{ id: 1, competitorName: "竞品A", strengths: "品牌认知高" }],
    });
    expect(rows[0]?.advantageDescription).toBe("品牌认知高");
    expect(rows[0]?.aiMentionCount).toBe(1);
  });
});
