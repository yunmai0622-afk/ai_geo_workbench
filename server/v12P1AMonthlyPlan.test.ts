import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V2.0-P1-A Monthly Optimization Plan", () => {
  it("creates migration 0067 for monthly plan tables", () => {
    const migration = read("drizzle/0067_monthly_optimization_plans.sql");
    expect(migration).toContain("monthly_optimization_plans");
    expect(migration).toContain("monthly_optimization_tasks");
    expect(migration).toContain("content_generation");
    expect(migration).toContain("evidence_addition");
  });

  it("defines monthly plan tables in drizzle schema", () => {
    const schema = read("drizzle/schema.ts");
    expect(schema).toContain("export const monthlyOptimizationPlans = mysqlTable");
    expect(schema).toContain("export const monthlyOptimizationTasks = mysqlTable");
    expect(schema).toContain("MonthlyOptimizationPlan");
  });

  it("implements generateMonthlyPlan in shared and server layers", () => {
    const shared = read("shared/monthlyPlanGeneration.ts");
    expect(shared).toContain("buildMonthlyPlanTaskDrafts");
    expect(shared).toContain("trustEvidence");
    expect(shared).toContain("sourceGraph");
    expect(shared).toContain("content_generation");
    expect(shared).toContain("profile_completion");
    const router = read("server/geoMonthlyPlanRouter.ts");
    expect(router).toContain("export async function generateMonthlyPlan");
    expect(router).toContain("geoMonthlyPlanRouter");
  });

  it("exposes geo.monthlyPlan router procedures", () => {
    const routers = read("server/routers.ts");
    expect(routers).toContain("geoMonthlyPlanRouter");
    expect(routers).toContain("monthlyPlan: geoMonthlyPlanRouter");
    const router = read("server/geoMonthlyPlanRouter.ts");
    expect(router).toContain("generate:");
    expect(router).toContain("getCurrent:");
    expect(router).toContain("getHistory:");
    expect(router).toContain("completeTask:");
    expect(router).toContain("triggerRetest:");
    expect(router).toContain("getComparison:");
    expect(router).toContain("getReport:");
  });

  it("syncs monthly plan progress on publish and asset changes", () => {
    const sync = read("server/monthlyPlanSync.ts");
    expect(sync).toContain("syncMonthlyPlanProgressForProject");
    expect(sync).toContain("syncMonthlyPlanOnArticlePublished");
    expect(read("server/geoArticlePublishState.ts")).toContain("syncMonthlyPlanOnArticlePublished");
  });

  it("registers /monthly-plan page and navigation entry", () => {
    expect(read("client/src/App.tsx")).toContain('path="/monthly-plan"');
    expect(read("client/src/pages/MonthlyPlanPage.tsx")).toContain("monthly-plan-page");
    const layout = read("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain('label: "本月方案"');
    expect(layout).toContain('path: "/monthly-plan"');
  });

  it("updates workspace stage primary action for monthly plan phases", () => {
    const rules = read("shared/workspacePrimaryAction.ts");
    expect(rules).toContain("monthlyPlanStage");
    expect(rules).toContain("制定本月优化计划");
    expect(rules).toContain("执行本月优化计划");
    expect(rules).toContain("等待复测");
    expect(rules).toContain("本月成效与下月计划");
    expect(read("client/src/pages/EnterpriseWorkspacePage.tsx")).toContain("geo.monthlyPlan.getCurrent");
  });

  it("shows monthly plan label on weekly content task card", () => {
    expect(read("client/src/components/weekly/WeeklyContentTaskControlCard.tsx")).toContain(
      "weekly-monthly-plan-task-label",
    );
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("geo.contentTasks.getCurrentTaskView");
  });
});
