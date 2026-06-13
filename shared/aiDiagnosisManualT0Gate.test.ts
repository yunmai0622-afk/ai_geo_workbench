import { describe, expect, it } from "vitest";
import {
  AI_DIAGNOSIS_RETEST_STAGE_COPY,
  AI_DIAGNOSIS_SOFT_RECOMMENDATION,
  buildAiDiagnosisRerunConfirmCopy,
  buildT0StartConfirmCopy,
  countEnabledQuestionsForT0,
  estimateT0DiagnosisMinutes,
  formatT0DurationText,
  T0_COMPLETION_OUTCOMES,
} from "./aiDiagnosisManualT0Gate";

describe("aiDiagnosisManualT0Gate", () => {
  it("estimates minutes from question and platform counts", () => {
    expect(estimateT0DiagnosisMinutes({ questionCount: 32, platformCount: 5, runsPerQuestion: 3 })).toBeGreaterThanOrEqual(5);
  });

  it("formats duration text for minutes and hours", () => {
    expect(formatT0DurationText(45)).toBe("约45分钟");
    expect(formatT0DurationText(90)).toBe("约1小时30分钟");
    expect(formatT0DurationText(124)).toBe("约2小时4分钟");
  });

  it("builds customer-friendly T0 start confirm copy", () => {
    const copy = buildT0StartConfirmCopy({ questionCount: 3, platformCount: 2, runsPerQuestion: 3 });
    expect(copy.title).toBe("开始 AI 推荐现状检测？");
    expect(copy.intro).toContain("优化前的基线");
    expect(copy.analysisCount).toBe(6);
    expect(copy.confirmLabel).toBe("创建 AI 现状检测任务");
    expect(copy.completionOutcomes).toEqual(T0_COMPLETION_OUTCOMES);

    const longCopy = buildT0StartConfirmCopy({ questionCount: 12, platformCount: 3, runsPerQuestion: 3 });
    expect(longCopy.backgroundMode).toBe(true);
    expect(longCopy.confirmLabel).toBe("创建 AI 现状检测任务");
    expect(longCopy.estimatedMinutesLabel).toContain("这是后台任务");
    expect(longCopy.estimatedMinutesLabel).toContain("无需停留等待");
  });

  it("defines retest stage copy with internal tags only as small labels", () => {
    expect(AI_DIAGNOSIS_RETEST_STAGE_COPY.map(stage => stage.title)).toEqual([
      "优化前检测",
      "7天后复测",
      "14天后复测",
      "30天后复测",
    ]);
    expect(AI_DIAGNOSIS_RETEST_STAGE_COPY[0]?.tag).toBe("T0");
  });

  it("builds rerun confirm copy", () => {
    expect(buildAiDiagnosisRerunConfirmCopy().confirmLabel).toBe("确认重新诊断");
  });

  it("counts enabled questions for T0 scope", () => {
    expect(countEnabledQuestionsForT0([{ enabled: 1 }, { enabled: 0 }, { enabled: 1 }])).toBe(2);
  });

  it("exposes soft recommendation copy for incomplete AI diagnosis", () => {
    expect(AI_DIAGNOSIS_SOFT_RECOMMENDATION).toContain("建议先完成 AI 现状检测");
    expect(AI_DIAGNOSIS_SOFT_RECOMMENDATION).toContain("可以随时进行");
  });
});
