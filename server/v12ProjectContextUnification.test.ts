import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(projectRoot, rel), "utf-8");

describe("GEO-V1-A Project 上下文统一", () => {
  it("ClientDashboard 进入工作台携带 projectId", () => {
    const src = read("client/src/pages/ClientDashboardPage.tsx");
    expect(src).toContain("activateProject(projectId)");
    expect(src).toContain('buildProjectUrl("/workspace", projectId)');
    expect(src).not.toMatch(/handleEnter[\s\S]*setLocation\("\/"\)/);
  });

  it("activeProject 工具层：URL 与 sessionStorage", () => {
    const lib = read("client/src/lib/activeProject.ts");
    expect(lib).toContain("getActiveProjectId");
    expect(lib).toContain("setActiveProjectId");
    expect(lib).toContain("clearActiveProjectId");
    expect(lib).toContain("buildProjectUrl");
    expect(lib).toContain("sessionStorage");
    expect(lib).toContain("projectId");
    expect(lib).toContain("inspectActiveProjectContext");
    expect(lib).toContain("activateProject");
    expect(read("client/src/lib/projectContextCache.ts")).toContain('PROJECT_CONTEXT_CACHE_VERSION = "v2"');
    expect(read("client/src/main.tsx")).toContain("nukeStaleProjectContextCache");
    expect(read("client/src/App.tsx")).toContain("nukeStaleProjectContextCache");
  });

  it("DashboardLayout 显示当前客户与切换入口", () => {
    const layout = read("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain("当前客户");
    expect(layout).toContain("未选择");
    expect(layout).toContain("切换客户");
    expect(layout).toContain('setLocation("/clients")');
    expect(layout).toContain("buildProjectUrl");
    expect(layout).not.toContain("项目 ID:");
  });

  it("业务页不再静默 projects[0]", () => {
    for (const file of [
      "client/src/pages/AssetCenter.tsx",
      "client/src/pages/WeeklyContentPage.tsx",
      "client/src/pages/V12FlowPages.tsx",
      "client/src/components/V1WorkbenchOverview.tsx",
      "client/src/pages/ProgressPage.tsx",
      "client/src/pages/GeoPages.tsx",
    ]) {
      const src = read(file);
      expect(src, file).not.toContain("projects[0]?.id");
      expect(src, file).not.toMatch(/setSelectedProjectId\(projects\[0\]/);
    }
  });

  it("无 activeProjectId 时展示请先选择客户项目", () => {
    const empty = read("client/src/components/ProjectContextEmptyState.tsx");
    expect(empty).toContain("请先选择客户项目");
    expect(empty).toContain("去客户管理台");
    expect(empty).toContain('setLocation("/clients")');
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("ProjectContextEmptyState");
    expect(read("client/src/components/V1WorkbenchOverview.tsx")).toContain("ProjectContextEmptyState");
  });

  it("App onboarding 不再仅用 projects[0] 门禁", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain("getActiveProjectId");
    expect(app).not.toMatch(/const projectId = projects\[0\]/);
    expect(app).toContain('pathname !== "/clients"');
    expect(app).toContain('buildProjectUrl("/enterprise-profile"');
  });

  it("主链路页面支持 projectId 查询参数", () => {
    const hook = read("client/src/hooks/useActiveProjectSelection.ts");
    expect(hook).toContain("inspectActiveProjectContext");
    expect(hook).toContain("buildProjectUrl");
    expect(read("client/src/App.tsx")).toContain('path="/workspace"');
  });

  it("不改数据库 schema、不恢复 Chrome 插件主文案", () => {
    const schema = read("drizzle/schema.ts");
    expect(schema).not.toContain("activeProjectId");
    const clientBlob =
      read("client/src/pages/WeeklyContentPage.tsx") +
      read("client/src/components/DashboardLayout.tsx") +
      read("client/src/pages/ClientDashboardPage.tsx");
    expect(clientBlob).not.toMatch(/下载 Chrome 插件|browser-extension\.zip/);
  });
});
