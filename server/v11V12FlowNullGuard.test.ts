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

  it("V12FlowPages uses optional chaining for runtime .id access", () => {
    const page = read("client/src/pages/V12FlowPages.tsx");
    expect(page).not.toMatch(/[^?]\.id\b/);
    expect(page).toContain("typeof value?.id === \"number\"");
  });

  it("useActiveProjectSelection filters null projects and uses optional id", () => {
    const hook = read("client/src/hooks/useActiveProjectSelection.ts");
    expect(hook).toContain("projectsRaw");
    expect(hook).toContain(".filter(p => p != null");
    expect(hook).toContain("p?.id === contextProjectId");
    expect(hook).toContain("typeof p?.id === \"number\"");
  });

  it("ContentPublishingCenterPage filters list rows and uses optional id", () => {
    const page = read("client/src/pages/ContentPublishingCenterPage.tsx");
    expect(page).toContain("function filterListWithNumericId");
    expect(page).toContain("filterListWithNumericId(articlesQuery.data");
    expect(page).not.toMatch(/[^?]\.id\b/);
  });
});
