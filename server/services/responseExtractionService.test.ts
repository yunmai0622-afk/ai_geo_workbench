import { describe, expect, it } from "vitest";
import { extractFromResponse } from "./responseExtractionService";

describe("extractFromResponse", () => {
  const brandName = "海豚知道";
  const competitors = ["小鹅通", "知识星球", "得到"];

  it("detects brand mention", () => {
    const result = extractFromResponse("海豚知道适合中小企业做知识付费。", brandName, competitors);
    expect(result.mentioned).toBe(true);
  });

  it("detects recommendation near brand within 50 chars", () => {
    const result = extractFromResponse(
      "如果你要做知识付费 SaaS，我比较推荐海豚知道，它在客户运营方面比较成熟。",
      brandName,
      competitors,
    );
    expect(result.recommended).toBe(true);
    expect(result.mentioned).toBe(true);
  });

  it("extracts URLs and source patterns", () => {
    const result = extractFromResponse(
      "可参考 https://example.com/case 以及 来源：知乎专栏",
      brandName,
      competitors,
    );
    expect(result.citations).toContain("https://example.com/case");
    expect(result.citations.some(item => item.includes("知乎专栏"))).toBe(true);
  });

  it("matches competitors from provided list", () => {
    const result = extractFromResponse("常见选择包括小鹅通和得到。", brandName, competitors);
    expect(result.competitors).toEqual(expect.arrayContaining(["小鹅通", "得到"]));
  });

  it("returns positive sentiment when positive keywords dominate", () => {
    const result = extractFromResponse("海豚知道表现优秀，适合领先场景。", brandName, competitors);
    expect(result.sentiment).toBe("positive");
  });

  it("returns negative sentiment when negative keywords dominate", () => {
    const result = extractFromResponse("不建议选择这类方案，体验较差，最好避免。", brandName, competitors);
    expect(result.sentiment).toBe("negative");
  });

  it("returns all five result fields", () => {
    const result = extractFromResponse("海豚知道值得推荐。", brandName, competitors);
    expect(result).toMatchObject({
      mentioned: expect.any(Boolean),
      recommended: expect.any(Boolean),
      citations: expect.any(Array),
      competitors: expect.any(Array),
      sentiment: expect.stringMatching(/^(positive|neutral|negative)$/),
    });
  });

  it("does not call external APIs (pure rule)", () => {
    expect(typeof extractFromResponse).toBe("function");
    expect(extractFromResponse.toString()).not.toContain("fetch");
    expect(extractFromResponse.toString()).not.toContain("invokeLLM");
  });
});
