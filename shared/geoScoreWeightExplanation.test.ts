import { describe, expect, it } from "vitest";
import {
  formatGeoScoreWeightExplanationLine,
  GEO_SCORE_WEIGHT_EXPLANATION_ITEMS,
} from "./geoScoreWeightExplanation";

describe("GEO_SCORE_WEIGHT_EXPLANATION_ITEMS", () => {
  it("包含四项权重且合计 100%", () => {
    expect(GEO_SCORE_WEIGHT_EXPLANATION_ITEMS).toHaveLength(4);
    const total = GEO_SCORE_WEIGHT_EXPLANATION_ITEMS.reduce((sum, item) => sum + item.weightPercent, 0);
    expect(total).toBe(100);
    expect(GEO_SCORE_WEIGHT_EXPLANATION_ITEMS[0]?.label).toBe("品牌识别率");
    expect(GEO_SCORE_WEIGHT_EXPLANATION_ITEMS[3]?.label).toBe("AI推荐率");
  });

  it("formatGeoScoreWeightExplanationLine 输出客户可读文案", () => {
    const line = formatGeoScoreWeightExplanationLine(GEO_SCORE_WEIGHT_EXPLANATION_ITEMS[0]!);
    expect(line).toBe("品牌识别率（30%）：AI是否知道你的品牌");
  });
});
