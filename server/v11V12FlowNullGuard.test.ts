import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-V12FlowFix null guards", () => {
  it("AiDiagnosisFlowPage filters testRounds before accessing round.id", () => {
    const page = read("client/src/pages/V12FlowPages.tsx");
    expect(page).toContain("filterTestRounds(testRoundsQuery.data)");
    expect(page).toContain("function filterTestRounds");
    expect(page).not.toMatch(/const testRounds = testRoundsQuery\.data \?\? \[\]/);
  });

  it("shared list helpers strip null rows with numeric id", () => {
    const page = read("client/src/pages/V12FlowPages.tsx");
    expect(page).toContain("function filterListWithNumericId");
    expect(page).toContain("function filterAiTestRuns");
  });

  it("useProjectSelection filters projects before find by id", () => {
    const page = read("client/src/pages/V12FlowPages.tsx");
    expect(page).toContain("filterListWithNumericId(selection.projects)");
  });
});
