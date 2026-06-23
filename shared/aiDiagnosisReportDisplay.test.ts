import { describe, expect, it } from "vitest";
import {
  buildAiDiagnosisReportActionSuggestions,
  buildAiDiagnosisReportConclusion,
  resolveAiDiagnosisFirstScreenState,
  resolveAiRecognitionStatus,
  resolveAiRecommendStatus,
} from "./aiDiagnosisReportDisplay";

describe("aiDiagnosisReportDisplay", () => {
  it("resolves first screen state", () => {
    expect(
      resolveAiDiagnosisFirstScreenState({
        isT0Running: true,
        t0Starting: false,
        hasT0BaselineResult: false,
        hasAiTestMetrics: false,
      }),
    ).toBe("running");
    expect(
      resolveAiDiagnosisFirstScreenState({
        isT0Running: false,
        t0Starting: false,
        hasT0BaselineResult: true,
        hasAiTestMetrics: true,
      }),
    ).toBe("completed");
    expect(
      resolveAiDiagnosisFirstScreenState({
        isT0Running: false,
        t0Starting: false,
        hasT0BaselineResult: false,
        hasAiTestMetrics: false,
      }),
    ).toBe("before");
  });

  it("resolves recognition and recommend status labels", () => {
    expect(resolveAiRecognitionStatus(60)).toBe("是");
    expect(resolveAiRecognitionStatus(30)).toBe("部分认识");
    expect(resolveAiRecognitionStatus(0)).toBe("否");
    expect(resolveAiRecommendStatus(25)).toBe("是");
    expect(resolveAiRecommendStatus(10)).toBe("偶尔");
    expect(resolveAiRecommendStatus(0)).toBe("否");
  });

  it("builds conclusion copy from mention and recommend rates", () => {
    expect(buildAiDiagnosisReportConclusion(60, 30)).toContain("识别");
    expect(buildAiDiagnosisReportConclusion(60, 10)).toContain("推荐意愿偏弱");
    expect(buildAiDiagnosisReportConclusion(40, 30)).toContain("有一定认知");
  });

  it("builds 1-2 action suggestions", () => {
    const low = buildAiDiagnosisReportActionSuggestions(30, 5);
    expect(low.length).toBeGreaterThanOrEqual(1);
    expect(low.length).toBeLessThanOrEqual(2);
    expect(low[0]).toContain("品牌基础");
  });
});
