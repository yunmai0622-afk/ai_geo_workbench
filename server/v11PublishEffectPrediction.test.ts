import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Effect-Prediction", () => {
  it("shows static effect expectation after batch enqueue success", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("formatPublishEffectPrediction");
    expect(weekly).toContain("notifyPublishEffectPrediction");
    expect(weekly).not.toContain("publish-effect-prediction");
  });
});
