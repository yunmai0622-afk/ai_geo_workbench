import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(projectRoot, rel), "utf-8");

const businessPages = [
  "client/src/pages/WeeklyContentPage.tsx",
  "client/src/pages/V12FlowPages.tsx",
  "client/src/components/V1WorkbenchOverview.tsx",
  "client/src/pages/ProgressPage.tsx",
  "client/src/pages/GeoPages.tsx",
] as const;

function assertNoProjectDropdown(source: string, label: string) {
  expect(source).not.toMatch(/<select[\s\S]*projects\.map/);
  expect(source).not.toContain("请选择项目");
  expect(source).not.toContain("ProjectSelector");
  expect(source).not.toContain("setSelectedProjectId(Number");
}

function assertUsesActiveProject(source: string, label: string) {
  expect(source).toMatch(/useActiveProjectSelection|useProjectSelection/);
  expect(source).toContain("enabled");
  expect(source).toContain("ProjectContextEmptyState");
}

describe("GEO-V1-E 业务页强制当前 activeProjectId", () => {
  it("WeeklyContentPage 不含项目下拉与 projects[0]", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    assertNoProjectDropdown(weekly, "weekly");
    expect(weekly).not.toContain("projects[0]");
    expect(weekly).not.toContain("BusinessPageProjectHeader");
    expect(read("client/src/components/DashboardLayout.tsx")).toContain("EnterpriseProjectShell");
    expect(weekly).toContain("内容任务推进");
    expect(weekly).toContain("CurrentContentTaskCard");
    expect(weekly).toContain("PlatformTaskBoard");
    expect(weekly).not.toMatch(/批量生成/);
    expect(weekly).toContain("不支持一稿多发");
    expect(weekly).toMatch(/if \(!enabled && !projectsLoading\)/);
    expect(weekly).toContain('buildProjectUrl("/ai-diagnosis"');
    expect(weekly).toContain('buildProjectUrl("/ai-diagnosis"');
  });

  it("AI 诊断页只使用 activeProjectId", () => {
    const v12 = read("client/src/pages/V12FlowPages.tsx");
    const report = read("client/src/components/diagnosis/AiDiagnosisCustomerReport.tsx");
    expect(v12).toContain("AiDiagnosisFlowPage");
    expect(report).toContain("AI_DIAGNOSIS_PAGE_SUBTITLE");
    expect(report).toContain("AI 当前怎么看你");
    expect(v12).toContain('buildProjectUrl("/monthly-plan"');
    expect(v12).not.toContain("diagnosis-project-header");
    assertNoProjectDropdown(v12, "v12");
  });

  it("发布中心 / 收录监测 / 交付报告只服务当前 project", () => {
    const v12 = read("client/src/pages/V12FlowPages.tsx");
    const publish =
      read("client/src/pages/ContentPublishingCenterPage.tsx") +
      read("client/src/components/publishing/LocalAgentStatusCard.tsx") +
      read("client/src/components/publishing/PublishTaskColumnBoard.tsx");
    expect(v12).toContain("ContentPublishingFlowPage");
    expect(v12).toContain("InclusionMonitoringFlowPage");
    expect(v12).toContain("DeliveryReportsFlowPage");
    expect(publish).toContain("发布执行中心");
    expect(publish).toContain("local-agent-status-card");
    expect(publish).toContain("publish-account-client-fold");
    expect(read("client/src/pages/InclusionMonitoringCenterPage.tsx")).toContain("收录复测中心");
    const report =
      read("client/src/pages/DeliveryReportsCenterPage.tsx") +
      read("shared/monthlyReportView.ts");
    expect(report).toContain("AI 品牌成熟度月报");
    expect(report).toContain("geo.monthlyPlan.getReport");
    expect(v12 + report).toContain('buildProjectUrl("/content-publishing"');
    expect(read("client/src/pages/InclusionMonitoringCenterPage.tsx")).toContain('buildProjectUrl("/delivery-reports"');
    expect(report).not.toContain('buildProjectUrl("/inclusion-monitoring"');
  });

  it("进展看板只使用 activeProjectId", () => {
    const progress = read("client/src/pages/ProgressPage.tsx");
    assertNoProjectDropdown(progress, "progress");
    expect(progress).not.toContain("projects[0]");
    expect(progress).toContain("查看当前企业的 GEO 增长进展");
    expect(progress).toContain('buildProjectUrl("/weekly"');
  });

  it("GeoPages 遗留页不再独立切换项目", () => {
    const geo = read("client/src/pages/GeoPages.tsx");
    assertNoProjectDropdown(geo, "geo");
    expect(geo).toContain("BusinessPageProjectHeader");
    expect(geo).toContain("useActiveProjectSelection");
    expect(geo).toContain('buildProjectUrl("/enterprise-profile"');
  });

  it("增长总览与业务页复用 ProjectContextEmptyState", () => {
    const workbench = read("client/src/components/V1WorkbenchOverview.tsx");
    expect(workbench).toContain("useActiveProjectSelection");
    expect(workbench).toContain("ProjectContextEmptyState");
    expect(workbench).toContain("BusinessPageProjectHeader");
    for (const file of businessPages) {
      expect(read(file)).toContain("ProjectContextEmptyState");
    }
  });

  it("主链路跳转保留 projectId", () => {
    const blob = businessPages.map(read).join("\n");
    const paths = ["/weekly", "/ai-diagnosis", "/content-publishing", "/inclusion-monitoring", "/delivery-reports", "/enterprise-profile"];
    for (const p of paths) {
      expect(blob).toContain(`buildProjectUrl("${p}"`);
    }
  });

  it("无 activeProjectId 时不应裸跳业务路径（写操作依赖 projectId）", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toMatch(/if \(!selectedProjectId\) return/);
    const v12 = read("client/src/pages/V12FlowPages.tsx");
    expect(v12).toMatch(/enabled: selection\.enabled|enabled \}/);
  });

  it("不恢复 Chrome 插件主文案、不改 schema", () => {
    const blob = businessPages.map(read).join("\n");
    expect(blob).not.toMatch(/下载 Chrome 插件|browser-extension\.zip/);
    expect(read("drizzle/schema.ts")).not.toContain("forceProjectOnly");
  });
});
