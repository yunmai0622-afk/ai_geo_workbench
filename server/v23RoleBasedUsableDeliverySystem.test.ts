import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf-8");

describe("GEO V2.3-P0-O role based usable delivery system", () => {
  it("keeps customer first navigation to five delivery pages and moves diagnosis to operator tools", () => {
    const layout = read("client/src/components/DashboardLayout.tsx");
    const customerGroup = layout.slice(
      layout.indexOf('title: "客户主流程"'),
      layout.indexOf('title: "运营工具"'),
    );
    const operatorGroup = layout.slice(layout.indexOf('title: "运营工具"'));

    expect(customerGroup).toContain('key: "workspace"');
    expect(customerGroup).toContain('key: "monthly-plan"');
    expect(customerGroup).toContain('key: "weekly-execution"');
    expect(customerGroup).toContain('key: "inclusion-monitoring"');
    expect(customerGroup).toContain('key: "delivery-reports"');
    expect(customerGroup).not.toContain('key: "ai-diagnosis"');
    expect(operatorGroup).toContain('key: "enterprise-profile"');
    expect(operatorGroup).toContain('key: "ai-diagnosis"');
    expect(operatorGroup).toContain('key: "content-production"');
    expect(operatorGroup).toContain("内部交付使用，不建议客户第一轮演示");
  });

  it("filters brand-customer navigation to the customer first path only", () => {
    const nav = read("shared/roleBasedNavigation.ts");

    expect(nav).toContain("export const OPERATOR_NAV_MAIN_FLOW_COUNT = 5;");
    expect(nav).toContain("export const OPERATOR_NAV_TOOL_COUNT = 7;");
    expect(nav).toContain('"/workspace"');
    expect(nav).not.toContain('"/ai-diagnosis",\n  "/monthly-plan"');
  });

  it("marks operator pages clearly as internal delivery surfaces", () => {
    const enterpriseProfile = read("client/src/pages/AssetCenter.tsx");
    const diagnosis = read("client/src/components/diagnosis/AiDiagnosisCustomerReport.tsx");
    const questions = read("client/src/pages/QuestionsLibraryPage.tsx");
    const sourceGraph = read("client/src/pages/SourceGraphPage.tsx");
    const publishing = read("client/src/pages/ContentPublishingCenterPage.tsx");
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");

    expect(enterpriseProfile).toContain("运营后台｜品牌资料建档");
    expect(enterpriseProfile).toContain("用于内部交付");
    expect(diagnosis).toContain("运营后台");
    expect(diagnosis).toContain("客户可读诊断问题页");
    expect(diagnosis).toContain("不建议客户第一轮演示");
    expect(questions).toContain("搜索问题挖掘");
    expect(sourceGraph).toContain("信源引用监测");
    expect(publishing).toContain("发布执行中心");
    expect(publishing).toContain("不进入客户第一轮演示");
    expect(weekly).toContain("运营工具 / 内容生产与发布");
    expect(weekly).toContain("运营后台 · 不进入客户第一轮演示");
  });

  it("keeps agency and customer pages focused on one clear next step", () => {
    const clients = read("client/src/pages/ClientDashboardPage.tsx");
    const workspace = read("client/src/pages/EnterpriseWorkspacePage.tsx");
    const monthly = read("client/src/pages/MonthlyPlanPage.tsx");
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    const inclusion = read("client/src/pages/InclusionMonitoringCenterPage.tsx");
    const delivery = read("client/src/pages/DeliveryReportsCenterPage.tsx");

    expect(clients).toContain("client-project-ai-visibility");
    expect(clients).toContain("进入服务首页");
    expect(clients).not.toContain("client-project-geo-score");
    expect(workspace).toContain('label: "查看本月服务计划"');
    expect(monthly).toContain('label: "查看执行进度"');
    expect(weekly).toContain('if (isCustomerExecutionView) return "查看收录与验证";');
    expect(inclusion).toContain('label: "查看交付报告"');
    expect(inclusion).not.toContain("先进入发布执行中心");
    expect(inclusion).not.toContain("发布与回填由运营后台继续处理");
    expect(delivery).toContain('data-testid="delivery-report-primary-cta"');
    expect(delivery).toContain("需要交付时再展开");
  });
});
