import { describe, expect, it } from "vitest";
import {
  buildSystemConclusion,
  resolveChangeDirection,
  resolveConfidenceLevel,
} from "./geoRetestCalculator";

describe("geoRetestCalculator", () => {
  describe("resolveChangeDirection", () => {
    it("returns unknown when either mention count is below 3", () => {
      expect(resolveChangeDirection(2, 5)).toBe("unknown");
      expect(resolveChangeDirection(5, 2)).toBe("unknown");
      expect(resolveChangeDirection(0, 0)).toBe("unknown");
    });

    it("returns up, down, or flat when both counts are at least 3", () => {
      expect(resolveChangeDirection(3, 4)).toBe("up");
      expect(resolveChangeDirection(5, 3)).toBe("down");
      expect(resolveChangeDirection(4, 4)).toBe("flat");
    });
  });

  describe("resolveConfidenceLevel", () => {
    it("returns high when both sides have at least 15 runs", () => {
      expect(resolveConfidenceLevel(15, 16, "unknown")).toBe("high");
    });

    it("returns medium when runs >= 9 and direction is known", () => {
      expect(resolveConfidenceLevel(9, 10, "up")).toBe("medium");
      expect(resolveConfidenceLevel(12, 9, "flat")).toBe("medium");
    });

    it("returns observe_more when runs are insufficient or direction is unknown", () => {
      expect(resolveConfidenceLevel(8, 10, "up")).toBe("observe_more");
      expect(resolveConfidenceLevel(10, 10, "unknown")).toBe("observe_more");
    });
  });

  describe("buildSystemConclusion", () => {
    it("uses customer-readable wording without engineering terms", () => {
      const text = buildSystemConclusion({
        questionType: "品牌认知",
        platform: "doubao",
        baseMentionCount: 3,
        compareMentionCount: 6,
        changeDirection: "up",
      });
      expect(text).toContain("品牌识别类问题");
      expect(text).toContain("从 3 次上升至 6 次");
      expect(text).not.toContain("mentionedCompany");
      expect(text).not.toMatch(/已证明有效/);
    });
  });
});
