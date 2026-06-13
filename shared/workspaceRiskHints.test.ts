import { describe, expect, it } from "vitest";
import { buildQualityRewriteRiskHint } from "./workspaceRiskHints";

describe("workspaceRiskHints", () => {
  it("uses customer-facing quality rewrite copy", () => {
    expect(buildQualityRewriteRiskHint(3)).toBe("有 3 篇内容质检未通过，建议重新生成");
  });
});
