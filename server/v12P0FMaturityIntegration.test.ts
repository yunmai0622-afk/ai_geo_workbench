import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V2.0-P0-F Maturity Integration", () => {
  it("creates migration 0065 to drop project unique and add history index", () => {
    const migration = read("drizzle/0065_geo_maturity_scores_history.sql");
    expect(migration).toContain("DROP INDEX `geo_maturity_scores_project_unique`");
    expect(migration).toContain("geo_maturity_scores_project_calculated_idx");
  });

  it("schema allows multiple maturity rows per project", () => {
    const schema = read("drizzle/schema.ts");
    expect(schema).toContain("geo_maturity_scores_project_calculated_idx");
    expect(schema).not.toContain("geo_maturity_scores_project_unique");
  });

  it("geoMaturityRouter exposes getHistory and inserts on calculateAndSave", () => {
    const router = read("server/geoMaturityRouter.ts");
    expect(router).toContain("getHistory:");
    expect(router).toContain("db.insert(geoMaturityScores)");
    expect(router).toContain("orderBy(desc(geoMaturityScores.calculatedAt))");
    expect(router).toContain("maturityScoresMatch");
    expect(router).toContain(".update(geoMaturityScores)");
  });

  it("registers /maturity route and keeps maturity page reachable", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain('path="/maturity"');
    expect(app).toContain("MaturityDetailPage");

    const layout = read("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain('label: "服务首页"');
    expect(layout).toContain('"/maturity"');
  });

  it("maturity detail page has action-oriented overview and dimension entry CTAs", () => {
    const page = read("client/src/pages/MaturityDetailPage.tsx");
    expect(page).toContain("maturity-screen-overview");
    expect(page).toContain("maturity-screen-dimensions");
    expect(page).toContain("maturity-screen-trend");
    expect(page).toContain("maturity-screen-next-actions");
    expect(page).toContain("maturity-top-weaknesses");
    expect(page).toContain("maturity-weakest-cta");
    expect(page).toContain("生成本月优化计划");
    expect(page).toContain("查看本月优化计划");
    expect(page).toContain("geo.monthlyPlan.getCurrent");
    expect(page).toContain("geo.monthlyPlan.generate");
    expect(page).toContain("maturity-dimension-conclusion-${card.key}");
    expect(page).toContain("maturity-dimension-cta-${card.key}");
    expect(page).toContain("maturity-trend-details");
    expect(page).toContain("成熟度变化历史");
    expect(page).toContain("maturity-trend-empty");
    expect(page).toContain("geo.maturity.getHistory");
  });

  it("maturity assistant panel is wired in project shell", () => {
    const shell = read("client/src/components/project/EnterpriseProjectShell.tsx");
    expect(shell).toContain("MaturityAssistantPanel");
    expect(shell).toContain('pathname === "/maturity"');
  });

  it("auto-triggers maturity calculate on wizard save, trust evidence, source graph, ai test", () => {
    const asset = read("client/src/pages/AssetCenter.tsx");
    expect(asset).toContain("useMaturityAutoCalculate");
    expect(asset).toContain("triggerMaturityCalculate");
    expect(asset).toContain("wizard-completion-panel");
    expect(asset).toContain("去做AI现状检测");
    expect(asset).toContain('buildProjectUrl("/maturity"');

    const trust = read("client/src/components/enterpriseProfile/TrustEvidenceManager.tsx");
    expect(trust).toContain("triggerMaturityCalculate");

    const source = read("client/src/pages/SourceGraphPage.tsx");
    expect(source).toContain("triggerMaturityCalculate");

    const diagnosis = read("client/src/pages/V12FlowPages.tsx");
    expect(diagnosis).toContain("triggerMaturityCalculate");

    const pool = read("client/src/components/diagnosis/QuestionPoolTestPanel.tsx");
    expect(pool).toContain("triggerMaturityCalculate");
  });

  it("maturity detail stays reachable without embedding maturity details on /workspace", () => {
    const app = read("client/src/App.tsx");
    const workspace = read("client/src/pages/EnterpriseWorkspacePage.tsx");
    expect(app).toContain('path="/maturity"');
    expect(workspace).not.toContain('buildProjectUrl("/maturity"');
    expect(workspace).not.toContain("/maturity-report");
    expect(workspace).not.toContain("workspace-maturity-hero");
  });
});
