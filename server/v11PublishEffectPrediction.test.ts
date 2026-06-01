import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Effect-Prediction", () => {
  it("shows static effect expectation after enqueue in weekly publish dialog", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("PUBLISH_EFFECT_PREDICTION_LINES");
    expect(weekly).toContain("publish-effect-prediction");
    expect(weekly).toContain("发布后效果预期");
    expect(weekly).toContain("@shared/publishEffectPrediction");
  });

  it("surfaces effect expectation after batch enqueue success", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("formatPublishEffectPrediction");
    expect(weekly).toContain("notifyPublishEffectPrediction");
  });
});
