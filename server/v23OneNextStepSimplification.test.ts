import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf-8");

describe("GEO V2.3-P0-N one next step simplification", () => {
  it("keeps the client card focused on service home instead of operational metrics", () => {
    const page = read("client/src/pages/ClientDashboardPage.tsx");
    expect(page).toContain("client-project-service-summary");
    expect(page).toContain("进入服务首页");
    expect(page).toContain('buildProjectUrl("/workspace", project.id)');
    expect(page).not.toContain("client-project-geo-score");
    expect(page).not.toContain("client-project-mention-rate");
    expect(page).not.toContain("client-project-overview-link");
  });

  it("fixes the customer path to one next page at each step", () => {
    const workspace = read("client/src/pages/EnterpriseWorkspacePage.tsx");
    const monthly = read("client/src/pages/MonthlyPlanPage.tsx");
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    const inclusion = read("client/src/pages/InclusionMonitoringCenterPage.tsx");

    expect(workspace).toContain('label: "查看本月服务计划"');
    expect(workspace).toContain('path: buildProjectUrl("/monthly-plan", selectedProjectId)');
    expect(monthly).toContain('label: "查看执行进度"');
    expect(monthly).toContain('path: "/weekly"');
    expect(weekly).toContain('if (isCustomerExecutionView) return "查看收录与验证";');
    expect(weekly).toContain('buildProjectUrl("/inclusion-monitoring", selectedProjectId)');
    expect(inclusion).toContain('label: "查看交付报告"');
    expect(inclusion).toContain('path: "/delivery-reports"');
  });

  it("keeps operator workbenches available but out of the customer first path", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    const workspace = read("client/src/pages/EnterpriseWorkspacePage.tsx");
    const delivery = read("client/src/pages/DeliveryReportsCenterPage.tsx");

    expect(weekly).toContain("运营后台 · 不进入客户第一轮演示");
    expect(weekly).toContain("{isContentProductionWorkbench && !isSingleTaskProgression ? (");
    expect(weekly).toContain('id="weekly-operational-workbench"');
    expect(workspace).not.toContain("运营参考，客户首屏不展开");
    expect(workspace).not.toContain("运营详情，仅内部参考");
    expect(delivery).toContain("需要交付时再展开");
  });

  it("removes shared shell action panels from the customer first path", () => {
    const shell = read("client/src/components/project/EnterpriseProjectShell.tsx");

    expect(shell).toContain("const isWeeklySingleTaskProgression = isWeeklyPage && Boolean(routeSearchParams.get(\"questionId\"));");
    expect(shell).toContain('(routeSearchParams.get("mode") === "content-production" || isWeeklySingleTaskProgression);');
    expect(shell).toContain('const isWeeklyCustomerExecutionPage = pathname === "/weekly" && !isContentProductionMode;');
    expect(shell).toContain("const isCustomerFirstPath =");
    expect(shell).toContain("isMonthlyPlanPage");
    expect(shell).toContain("isWeeklyCustomerExecutionPage");
    expect(shell).toContain("isDeliveryReportsPage");
    expect(shell).toContain("const hideDesktopAssistantPanel = isCustomerFirstPath || isAiDiagnosisPage;");
    expect(shell).toContain("ctaStage={isCustomerFirstPath ? null : ctaStageForTopBar}");
    expect(shell).toContain("isMobile && !isCustomerFirstPath && publishBindMobileLabel");
  });
});
