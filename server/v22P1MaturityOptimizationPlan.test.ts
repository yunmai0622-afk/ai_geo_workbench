import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO V2.2 P1 maturity score and monthly optimization plan", () => {
  it("exposes customer-facing business maturity and optimization brief procedures", () => {
    const maturityRouter = read("server/geoMaturityRouter.ts");
    const monthlyRouter = read("server/geoMonthlyPlanRouter.ts");
    expect(maturityRouter).toContain("getBusinessReport:");
    expect(monthlyRouter).toContain("getOptimizationBrief:");
    expect(read("server/geoBusinessMaturityService.ts")).toContain("getGeoBusinessMaturityReport");
  });

  it("implements six customer-facing dimensions without adding a new migration", () => {
    const shared = read("shared/geoBusinessMaturity.ts");
    expect(shared).toContain("profile");
    expect(shared).toContain("questionCoverage");
    expect(shared).toContain("aiVisibility");
    expect(shared).toContain("sourceConsistency");
    expect(shared).toContain("contentExecution");
    expect(shared).toContain("retestDelivery");
    expect(shared).toContain("基础薄弱");
    expect(shared).toContain("高可见度品牌");
  });

  it("integrates the new report into workspace, diagnosis, monthly plan, and delivery reports", () => {
    expect(read("client/src/pages/EnterpriseWorkspacePage.tsx")).toContain("geo.maturity.getBusinessReport");
    expect(read("client/src/pages/V12FlowPages.tsx")).toContain("geo.maturity.getBusinessReport");
    expect(read("client/src/pages/MonthlyPlanPage.tsx")).toContain("geo.monthlyPlan.getOptimizationBrief");
    expect(read("client/src/pages/DeliveryReportsCenterPage.tsx")).toContain("geo.monthlyPlan.getOptimizationBrief");
    expect(read("client/src/components/maturity/GeoBusinessMaturityCard.tsx")).toContain("AI 品牌经营成熟度");
    expect(read("client/src/components/monthlyPlan/MonthlyOptimizationPrioritiesPanel.tsx")).toContain("本月 Top 3 优化优先级");
  });
});
