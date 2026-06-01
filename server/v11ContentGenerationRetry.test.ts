import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Generation-Retry", () => {
  it("shared retry helpers cap at 3 failures", () => {
    const lib = read("shared/contentGenerationRetry.ts");
    expect(lib).toContain("MAX_CONTENT_GENERATION_CONSECUTIVE_FAILURES = 3");
    expect(lib).toContain("生成多次失败，请检查企业资料是否完整");
    expect(lib).toContain("重新生成");
  });

  it("weekly platform progress shows regenerate with stored params", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("platformGenerationRetry");
    expect(weekly).toContain("retryParams");
    expect(weekly).toContain("handlePlatformRegenerate");
    expect(weekly).toContain("onRegenerate");
    expect(weekly).toContain("resolveContentGenerationFailureDisplay");
  });

  it("AiTaskProgressCard exposes regenerate action on failure", () => {
    const card = read("client/src/components/geo/AiTaskProgressCard.tsx");
    expect(card).toContain("onRegenerate");
    expect(card).toContain("CONTENT_GENERATION_REGENERATE_LABEL");
    expect(card).toContain("-regenerate");
  });
});
