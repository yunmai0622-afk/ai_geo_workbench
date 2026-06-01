import { describe, expect, it } from "vitest";
import {
  formatPublishEffectPrediction,
  PUBLISH_EFFECT_PREDICTION_LINE_INDEXING,
  PUBLISH_EFFECT_PREDICTION_LINE_MULTI_PLATFORM,
  PUBLISH_EFFECT_PREDICTION_LINE_RETEST,
  PUBLISH_EFFECT_PREDICTION_LINES,
} from "./publishEffectPrediction";

describe("GEO-V1.1-Effect-Prediction", () => {
  it("exposes fixed post-publish expectation copy", () => {
    expect(PUBLISH_EFFECT_PREDICTION_LINES).toHaveLength(3);
    expect(PUBLISH_EFFECT_PREDICTION_LINE_INDEXING).toContain("7-14天");
    expect(PUBLISH_EFFECT_PREDICTION_LINE_RETEST).toContain("第7天和第14天");
    expect(PUBLISH_EFFECT_PREDICTION_LINE_MULTI_PLATFORM).toContain("多平台");
  });

  it("formats lines for display surfaces", () => {
    expect(formatPublishEffectPrediction()).toBe(PUBLISH_EFFECT_PREDICTION_LINES.join("\n"));
  });
});
