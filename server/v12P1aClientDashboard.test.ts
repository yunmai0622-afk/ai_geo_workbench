import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("P1-A client dashboard", () => {
  it("clientDashboard listProjectsSummary returns project summaries", () => {
    const router = read("server/routers.ts");
    expect(router).toContain("clientDashboard: router({");
    expect(router).toContain("listProjectsSummary: protectedProcedure.query");
    expect(router).toContain("articleCountMap");
    expect(router).toContain("geoInclusionMonitoringRecords.aiTestResults");
    expect(router.indexOf("from(geoInclusionMonitoringRecords)", router.indexOf("clientDashboard"))).toBeGreaterThan(-1);
    const dashboardBlock = router.slice(router.indexOf("clientDashboard: router({"), router.indexOf("projects: router({"));
    expect(dashboardBlock).not.toContain("from(aiResponses)");
    expect(router).toContain("inArray(geoArticles.projectId, projectIds)");
  });

  it("clientDashboard does not mock project metrics", () => {
    const router = read("server/routers.ts");
    expect(router).not.toMatch(/mock.*articleCount/i);
    expect(router).toContain("from(projects)");
    expect(router).toContain("from(geoArticles)");
    expect(router).toContain("from(geoPublishRecords)");
  });

  it("clientDashboard is placed after publishRecords router", () => {
    const router = read("server/routers.ts");
    const publishIdx = router.indexOf("publishRecords: router({");
    const dashboardIdx = router.indexOf("clientDashboard: router({");
    const projectsIdx = router.indexOf("projects: router({", publishIdx);
    expect(publishIdx).toBeGreaterThan(-1);
    expect(dashboardIdx).toBeGreaterThan(publishIdx);
    expect(dashboardIdx).toBeLessThan(projectsIdx);
  });

  it("ClientDashboardPage contains 客户项目", () => {
    const page = read("client/src/pages/ClientDashboardPage.tsx");
    expect(page).toContain("客户项目");
    expect(page).toContain("进入工作台");
    expect(page).toContain("client-dashboard-search");
  });

  it("Sidebar contains 客户管理台", () => {
    const layout = read("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain("客户管理台");
    expect(layout).toContain("/clients");
    expect(layout).toContain("项目");
  });
});
