import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C5-C AI diagnosis page product UI", () => {
  const flow = read("client/src/pages/V12FlowPages.tsx");

  it("uses diagnosis console layout with conclusion and collapsed details", () => {
    expect(flow).toContain("诊断流程控制台");
    expect(flow).toContain("核心诊断结论");
    expect(flow).toContain("内容缺口与目标问题");
    expect(flow).toContain("下一步内容资产动作");
    expect(flow).toContain("完整诊断明细");
    expect(flow).toContain("去生成内容资产");
    expect(flow).toContain("开始 AI 内容诊断");
    expect(flow).toContain("<details");
    expect(flow).not.toContain("诊断工作区");
  });

  it("keeps diagnosis pipeline handlers unchanged", () => {
    expect(flow).toContain("executeDiagnosisPipeline");
    expect(flow).toContain("handleGenerateTargetQuestions");
    expect(flow).toContain("handleRunDiagnosis");
    expect(flow).toMatch(/runAnalysis\.mutateAsync/);
  });
});
