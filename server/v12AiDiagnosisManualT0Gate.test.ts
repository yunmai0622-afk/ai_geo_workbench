import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

function extractAiDiagnosisFlowPage(source: string): string {
  const start = source.indexOf("export function AiDiagnosisFlowPage()");
  const end = source.indexOf("export function ContentGenerationFlowPage", start);
  if (start < 0 || end < 0) return "";
  return source.slice(start, end);
}

describe("GEO-V1.1-AIDiagnosis-Manual-T0-Gate-P0", () => {
  const flow =
    extractAiDiagnosisFlowPage(read("client/src/pages/V12FlowPages.tsx")) +
    read("client/src/components/diagnosis/AiDiagnosisCustomerReport.tsx");

  it("does not auto-run T0 or diagnosis from useEffect", () => {
    const effectBlocks = flow.match(/useEffect\([\s\S]*?\n  \},/g) ?? [];
    for (const block of effectBlocks) {
      expect(block).not.toMatch(/createT0WithQuestions\.mutate/);
      expect(block).not.toMatch(/startT0Execution\.mutate/);
      expect(block).not.toMatch(/executeDiagnosisPipeline/);
      expect(block).not.toMatch(/handleStartT0Baseline/);
      expect(block).not.toMatch(/handleRunDiagnosis/);
    }
  });

  it("requires manual confirm before starting T0", () => {
    expect(flow).toContain("AiDiagnosisT0ConfirmDialog");
    expect(flow).toContain("requestStartT0Baseline");
    expect(flow).toContain("setT0ConfirmOpen(true)");
    expect(flow).toContain("ai-diagnosis-start-t0-gate");
    expect(flow).not.toMatch(/onClick=\{\(\) => void handleStartT0Baseline\(\)\}/);
  });

  it("requires confirm before re-running content diagnosis when results exist", () => {
    expect(flow).toContain("AiDiagnosisRerunConfirmDialog");
    expect(flow).toContain("requestRunContentDiagnosis");
    expect(flow).toContain("setRerunConfirmOpen(true)");
  });

  it("does not auto-run content diagnosis after generating target questions", () => {
    expect(flow).not.toContain("正在自动运行内容诊断");
    const generateStart = flow.indexOf("async function handleGenerateTargetQuestions");
    const nextHandler = flow.indexOf("function requestRunContentDiagnosis", generateStart);
    expect(generateStart).toBeGreaterThan(-1);
    expect(nextHandler).toBeGreaterThan(generateStart);
    expect(flow.slice(generateStart, nextHandler)).not.toContain("executeDiagnosisPipeline");
  });

  it("shows running state refresh without restarting detection", () => {
    expect(flow).toContain("ai-diagnosis-refresh-t0-status");
    expect(flow).toContain("refreshT0Status");
  });
});
