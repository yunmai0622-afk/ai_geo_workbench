import { describe, expect, it } from "vitest";
import {
  computeContentTagStats,
  formatContentTagsInput,
  normalizeContentTags,
  parseContentTagsInput,
  articleMatchesContentTagFilter,
} from "./geoArticleContentTags";

describe("GEO-V1.1-Content-Tags", () => {
  it("normalizes and dedupes tags", () => {
    expect(normalizeContentTags(["主推产品", " 竞品对比 ", "主推产品", 1, ""])).toEqual([
      "主推产品",
      "竞品对比",
    ]);
  });

  it("parses comma-separated input", () => {
    expect(parseContentTagsInput("主推产品，竞品对比、品牌故事")).toEqual([
      "主推产品",
      "竞品对比",
      "品牌故事",
    ]);
  });

  it("formats tags for display input", () => {
    expect(formatContentTagsInput(["品牌故事", "主推产品"])).toBe("品牌故事、主推产品");
  });

  it("computes tag stats", () => {
    const stats = computeContentTagStats([
      { contentTags: ["主推产品", "竞品对比"] },
      { contentTags: ["主推产品"] },
      { contentTags: null },
    ]);
    expect(stats.find(s => s.tag === "主推产品")?.count).toBe(2);
    expect(stats.find(s => s.tag === "竞品对比")?.count).toBe(1);
  });

  it("filters by tag", () => {
    expect(articleMatchesContentTagFilter({ contentTags: ["主推产品"] }, "主推产品")).toBe(true);
    expect(articleMatchesContentTagFilter({ contentTags: ["主推产品"] }, "品牌故事")).toBe(false);
    expect(articleMatchesContentTagFilter({ contentTags: ["主推产品"] }, "all")).toBe(true);
  });
});
