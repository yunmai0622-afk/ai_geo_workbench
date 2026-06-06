import { describe, expect, it } from "vitest";
import {
  geoScorePercentToRate,
  resolveBrandMentionRate,
  resolveRecommendRate,
} from "./brandMentionRateResolver";

describe("brandMentionRateResolver", () => {
  it("将 GEO 诊断分百分比转为 0–1 比率", () => {
    expect(geoScorePercentToRate(38)).toBe(0.38);
    expect(geoScorePercentToRate(null)).toBeNull();
  });

  it("优先使用 GEO 诊断分，与诊断页展示一致", () => {
    expect(
      resolveBrandMentionRate({
        t0MentionRate: null,
        monitoringQuestionCount: 0,
        monitoringMentionRate: null,
        geoScoreMentionRate: 0.38,
        analysisMentionRate: 0.2,
      }),
    ).toBe(0.38);
  });

  it("T0 实测优先于诊断分", () => {
    expect(
      resolveBrandMentionRate({
        t0MentionRate: 0.5,
        monitoringQuestionCount: 0,
        monitoringMentionRate: null,
        geoScoreMentionRate: 0.38,
        analysisMentionRate: 0.2,
      }),
    ).toBe(0.5);
  });

  it("推荐率解析顺序与提及率一致", () => {
    expect(
      resolveRecommendRate({
        t0RecommendRate: null,
        monitoringQuestionCount: 0,
        monitoringRecommendRate: null,
        geoScoreRecommendRate: 0.25,
        analysisRecommendRate: 0.1,
      }),
    ).toBe(0.25);
  });
});
