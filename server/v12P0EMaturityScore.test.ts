import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V2.0-P0-E Maturity Score", () => {
  it("creates geo_maturity_scores migration 0064", () => {
    const migration = read("drizzle/0064_geo_maturity_scores.sql");
    expect(migration).toContain("geo_maturity_scores");
    expect(migration).toContain("brandIdentityScore");
    expect(migration).toContain("aiTestPerformanceScore");
    expect(migration).toContain("geo_maturity_scores_project_unique");
  });

  it("migration 0065 removes unique constraint for history support", () => {
    const migration = read("drizzle/0065_geo_maturity_scores_history.sql");
    expect(migration).toContain("DROP INDEX `geo_maturity_scores_project_unique`");
  });

  it("defines geoMaturityScores in drizzle schema", () => {
    const schema = read("drizzle/schema.ts");
    expect(schema).toContain('export const geoMaturityScores = mysqlTable');
    expect(schema).toContain("brandIdentityScore");
    expect(schema).toContain("GeoMaturityScore");
  });

  it("exposes geo.maturity router with maturity procedures", () => {
    const routers = read("server/routers.ts");
    expect(routers).toContain("geoMaturityRouter");
    expect(routers).toContain("maturity: geoMaturityRouter");
    const maturityRouter = read("server/geoMaturityRouter.ts");
    expect(maturityRouter).toContain("calculateAndSave:");
    expect(maturityRouter).toContain("getLatest:");
    expect(maturityRouter).toContain("getMaturityReport:");
    expect(maturityRouter).toContain("getHistory:");
  });

  it("implements 6-dimension scoring and stage definitions in shared layer", () => {
    const shared = read("shared/geoMaturityScoring.ts");
    expect(shared).toContain("calculateBrandIdentityScore");
    expect(shared).toContain("calculateCategoryPositioningScore");
    expect(shared).toContain("calculateQuestionCoverageScore");
    expect(shared).toContain("calculateSourceGraphScore");
    expect(shared).toContain("calculateTrustEvidenceDimensionScore");
    expect(shared).toContain("calculateAiTestPerformanceScore");
    expect(shared).toContain("resolveMaturityStage");
    expect(shared).toContain("AI盲区期");
    expect(shared).toContain("稳定推荐期");
    expect(shared).toContain("buildMaturityReport");
  });

  it("workspace command center shows core maturity metric and detailed hero in fold", () => {
    const workspace = read("client/src/pages/EnterpriseWorkspacePage.tsx");
    expect(workspace).toContain("geo.maturity.getMaturityReport");
    expect(workspace).toContain("workspace-command-center");
    expect(workspace).toContain("workspace-core-maturity");
    expect(workspace).toContain("workspace-maturity-hero");
    expect(workspace).toContain("AI 品牌成熟度");
    expect(workspace).toContain("workspace-maturity-dimension-");
    const commandIdx = workspace.indexOf("workspace-command-center");
    const maturityIdx = workspace.indexOf("workspace-maturity-hero");
    expect(commandIdx).toBeGreaterThan(-1);
    expect(maturityIdx).toBeGreaterThan(commandIdx);
  });

  it("ai diagnosis core summary shows maturity score alongside GEO score", () => {
    const diagnosis = read("client/src/pages/V12FlowPages.tsx");
    expect(diagnosis).toContain("geo.maturity.getMaturityReport");
    expect(diagnosis).toContain("ai-diagnosis-core-maturity-score");
    expect(diagnosis).toContain("AI 品牌成熟度");
  });
});
