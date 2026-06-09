import { describe, expect, it } from "vitest";
import {
  buildAiDiagnosisRerunConfirmCopy,
  buildT0StartConfirmCopy,
  countEnabledQuestionsForT0,
  estimateT0DiagnosisMinutes,
} from "./aiDiagnosisManualT0Gate";

describe("aiDiagnosisManualT0Gate", () => {
  it("estimates minutes from question and platform counts", () => {
    expect(estimateT0DiagnosisMinutes({ questionCount: 32, platformCount: 5, runsPerQuestion: 3 })).toBeGreaterThanOrEqual(5);
  });

  it("builds T0 start confirm copy with scope fields", () => {
    const copy = buildT0StartConfirmCopy({ questionCount: 3, platformCount: 2, runsPerQuestion: 3 });
    expect(copy.title).toContain("T0");
    expect(copy.confirmLabel).toBe("确认开始检测");
    const longCopy = buildT0StartConfirmCopy({ questionCount: 12, platformCount: 3, runsPerQuestion: 3 });
    expect(longCopy.backgroundMode).toBe(true);
    expect(longCopy.confirmLabel).toBe("创建检测任务并在后台执行");
  });

  it("builds rerun confirm copy", () => {
    expect(buildAiDiagnosisRerunConfirmCopy().confirmLabel).toBe("确认重新诊断");
  });

  it("counts enabled questions for T0 scope", () => {
    expect(countEnabledQuestionsForT0([{ enabled: 1 }, { enabled: 0 }, { enabled: 1 }])).toBe(2);
  });
});
