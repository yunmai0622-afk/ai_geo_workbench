import { describe, expect, it } from "vitest";
import {
  getGeoQualityLabel,
  getGeoQualityRecommendation,
  normalizeGeoQualityReview,
  parseAndNormalizeGeoQualityReview,
  parseGeoQualityReviewJson,
} from "./geoQualityReview";

const validPayload = {
  scores: {
    brand_entity: { score: 18, reason: "品牌出现多次" },
    question_match: { score: 16, reason: "回答了目标问题" },
    ai_citable_structure: { score: 14, reason: "有要点段落" },
    case_evidence: { score: 10, reason: "有案例" },
    competitor_comparison: { score: 12, reason: "有对比" },
    platform_friendly: { score: 8, reason: "结构清晰" },
  },
  total: 50,
  recommendation: "publish",
  suggestions: ["补充数据"],
};

describe("geoQualityReview", () => {
  it("parses strict JSON", () => {
    const raw = JSON.stringify(validPayload);
    const parsed = parseGeoQualityReviewJson(raw);
    expect(parsed.scores?.brand_entity?.score).toBe(18);
  });

  it("parses fenced JSON", () => {
    const raw = "```json\n" + JSON.stringify(validPayload) + "\n```";
    const result = parseAndNormalizeGeoQualityReview(raw);
    expect(result.total).toBe(78);
    expect(result.recommendation).toBe("revise");
  });

  it("recalculates total from dimensions when model total differs", () => {
    const result = normalizeGeoQualityReview(validPayload);
    expect(result.total).toBe(78);
    expect(result.recommendation).toBe("revise");
  });

  it("maps recommendation thresholds", () => {
    expect(getGeoQualityRecommendation(85)).toBe("publish");
    expect(getGeoQualityRecommendation(70)).toBe("revise");
    expect(getGeoQualityRecommendation(55)).toBe("reject");
    expect(getGeoQualityLabel("publish")).toBe("建议发布");
    expect(getGeoQualityLabel("revise")).toBe("建议修改后发布");
    expect(getGeoQualityLabel("reject")).toBe("不建议发布");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseGeoQualityReviewJson("not json")).toThrow("质检结果格式异常");
  });
});
