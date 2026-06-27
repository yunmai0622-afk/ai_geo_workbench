import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("P1-A client dashboard", () => {
  it("clientDashboard listProjectsSummary returns project summaries", () => {
    const router = read("server/routers.ts");
    expect(router).toContain("clientDashboard: router({");
    expect(router).toContain("listProjectsSummary: protectedProcedure");
    expect(router).toContain('archived: z.boolean().optional()');
    expect(router).toContain("articleCountMap");
    expect(router).toContain("geoInclusionMonitoringRecords.aiTestResults");
    expect(router).toContain("aggregateAiTestEvidence");
    expect(router.indexOf("from(geoInclusionMonitoringRecords)", router.indexOf("clientDashboard"))).toBeGreaterThan(-1);
    const dashboardBlock = router.slice(router.indexOf("clientDashboard: router({"), router.indexOf("projects: router({"));
    expect(dashboardBlock).not.toContain("from(aiResponses)");
    expect(router).toContain("completionScore");
    expect(router).toContain("hasCompletedT0Baseline");
    expect(router).toContain("hasActiveMonthlyPlan");
    expect(router).toContain("monthlyOptimizationPlans");
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

  it("ClientDashboardPage contains 客户经营看板", () => {
    const page = read("client/src/pages/ClientDashboardPage.tsx");
    expect(page).toContain("客户经营看板");
    expect(page).toContain("client-business-metrics");
    expect(page).toContain("client-project-main-problem");
    expect(page).toContain("client-project-risk-tags");
    expect(page).toContain("resolveClientProjectCardPrimaryAction");
    expect(page).toContain("client-dashboard-search");
  });

  it("Sidebar does not duplicate 企业项目 entry", () => {
    const layout = read("client/src/components/DashboardLayout.tsx");
    expect(layout).not.toContain('label: "企业项目"');
    expect(layout).toContain("/clients");
    expect(layout).toContain("客户主流程");
  });
});
