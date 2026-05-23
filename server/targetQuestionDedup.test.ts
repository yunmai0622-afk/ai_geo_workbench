import { describe, expect, it } from "vitest";
import {
  dedupeTargetQuestionRows,
  isExactDuplicateQuestion,
  isSimilarQuestion,
  normalizeQuestionKey,
} from "@shared/targetQuestionDedup";

describe("targetQuestionDedup", () => {
  it("normalizes punctuation and spaces", () => {
    expect(normalizeQuestionKey("直播转化低，怎么办？")).toBe(normalizeQuestionKey("直播转化低 怎么办"));
  });

  it("detects exact and normalized duplicates", () => {
    expect(isExactDuplicateQuestion("私域没复购怎么办", "私域没复购，怎么办？")).toBe(true);
  });

  it("detects high similarity", () => {
    expect(isSimilarQuestion("直播间转化率很低怎么办", "直播间转化率低怎么办")).toBe(true);
  });

  it("dedupes against exclude list", () => {
    const { kept, filteredCount } = dedupeTargetQuestionRows(
      [
        { questionText: "怎么选知识付费系统" },
        { questionText: "怎么选知识付费系统？" },
        { questionText: "ROI 怎么算才划算" },
      ],
      ["私域没复购怎么办"],
    );
    expect(kept).toHaveLength(2);
    expect(kept.some(r => r.questionText.includes("ROI"))).toBe(true);
    expect(filteredCount).toBe(1);
  });
});
