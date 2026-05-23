import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C5-E diagnosis target questions UX", () => {
  const flow = read("client/src/pages/V12FlowPages.tsx");
  const router = read("server/routers.ts");
  const logic = read("server/geoArticleLogic.ts");

  it("passes exclude questions on regenerate and dedupes", () => {
    expect(router).toContain("excludeQuestions");
    expect(logic).toContain("excludeQuestions");
    expect(logic).toContain("dedupeTargetQuestionRows");
    expect(logic).toContain("痛点问题");
    expect(logic).toContain("价格与ROI");
  });

  it("uses card list without inner scroll for target questions", () => {
    expect(flow).toContain("展开全部");
    expect(flow).toContain("consoleQuestionsExpanded");
    expect(flow).toContain("buildTargetQuestionGenerateMessage");
    expect(flow).not.toContain("max-h-36");
    expect(flow).not.toContain("overflow-auto text-sm text-slate-400");
    expect(flow).toContain("诊断将产出");
  });

  it("keeps diagnosis pipeline handlers", () => {
    expect(flow).toContain("executeDiagnosisPipeline");
    expect(flow).toContain("handleRunDiagnosis");
  });
});
