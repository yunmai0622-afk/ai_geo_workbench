import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-V12FlowRoot data-layer null sanitization", () => {
  it("sanitizes ai-diagnosis tRPC list payloads in routers", () => {
    const routers = read("server/routers.ts");
    expect(routers).toContain('from "./trpcRowSanitize"');
    expect(routers).toContain("filterTestRoundRows(rows)");
    expect(routers).toContain("filterAiTestRunRows(rows)");
    expect(routers).toContain("filterRoundQuestionLinks(withQuestion)");
    expect(routers).toContain("return filterRowsWithNumericId(rows)");
  });

  it("trpcRowSanitize drops orphan round_question links (question null)", () => {
    const mod = read("server/trpcRowSanitize.ts");
    expect(mod).toContain("filterRoundQuestionLinks");
    expect(mod).toContain("question != null");
  });

  it("AiDiagnosisFlowPage does not re-filter lists client-side", () => {
    const page = read("client/src/pages/V12FlowPages.tsx");
    expect(page).toContain("const testRounds = testRoundsQuery.data ?? []");
    expect(page).not.toContain("function filterTestRounds");
    expect(page).not.toContain("function filterListWithNumericId");
    expect(page).not.toContain("function filterAiTestRuns");
  });

  it("useActiveProjectSelection trusts geo.projects.list sanitization", () => {
    const hook = read("client/src/hooks/useActiveProjectSelection.ts");
    expect(hook).not.toContain(".filter(p => p != null");
    expect(hook).toContain("projectsRaw.map(p => ({ id: p.id");
  });
});
