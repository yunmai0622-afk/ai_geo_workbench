import { describe, expect, it } from "vitest";
import { aggregateT0AiTestRunMetrics } from "./t0AiTestRunMetrics";

describe("aggregateT0AiTestRunMetrics", () => {
  it("空样本返回 null", () => {
    expect(aggregateT0AiTestRunMetrics([])).toBeNull();
  });

  it("按 mentionedCompany / recommendedCompany 计算比率", () => {
    const metrics = aggregateT0AiTestRunMetrics([
      { mentionedCompany: true, recommendedCompany: true },
      { mentionedCompany: true, recommendedCompany: false },
      { mentionedCompany: false, recommendedCompany: false },
      { mentionedCompany: false, recommendedCompany: true },
    ]);

    expect(metrics).toEqual({
      totalRuns: 4,
      mentionedCount: 2,
      recommendedCount: 2,
      mentionRate: 0.5,
      recommendRate: 0.5,
    });
  });
});
