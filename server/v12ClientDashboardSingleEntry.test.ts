import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(projectRoot, rel), "utf-8");

describe("GEO-V1-B 客户管理台唯一新建/选择入口", () => {
  it("ClientDashboardPage 有新建客户项目与弹窗", () => {
    const src = read("client/src/pages/ClientDashboardPage.tsx");
    expect(src).toContain("新建企业项目");
    expect(src).toContain("create-client-project-dialog");
    expect(src).toContain("create-client-project-button");
    expect(src).toContain("当前账号暂无可管理客户项目");
    expect(src).toContain('buildProjectUrl("/onboarding"');
    expect(src).toContain("activateProject(created.id)");
    expect(src).toContain('setLocation(buildProjectUrl("/onboarding"');
  });

  it("AssetCenter 移除新建企业与项目切换", () => {
    const src = read("client/src/pages/AssetCenter.tsx");
    expect(src).not.toContain("handleCreateProject");
    expect(src).not.toContain("geo.projects.create");
    expect(src).not.toContain("新建第一个企业项目");
    expect(src).not.toContain("创建企业项目");
    expect(src).not.toContain("新增企业项目");
    expect(src).not.toContain("创建企业");
    expect(src).not.toMatch(/<select[\s\S]*切换企业/);
    expect(src).toContain("enterprise-profile-empty");
    expect(src).toContain("品牌资产建档必须归属一个客户项目");
    expect(src).toContain("客户管理台");
  });

  it("Onboarding 3 步引导：无项目时展示，已有项目跳转客户管理台", () => {
    const onboarding = read("client/src/pages/OnboardingPage.tsx");
    expect(onboarding).toContain("onboarding-step-1");
    expect(onboarding).toContain("onboarding-step-2");
    expect(onboarding).toContain("onboarding-step-3");
    expect(onboarding).toContain("continuingProjectId");
    expect(onboarding).toContain('Redirect to="/clients"');
    expect(onboarding).toContain("generateTargetQuestions");
    expect(onboarding).toContain('buildProjectUrl("/ai-diagnosis"');
    const register = read("client/src/pages/RegisterPage.tsx");
    expect(register).toContain('setLocation("/onboarding")');
    const app = read("client/src/App.tsx");
    expect(app).toContain('pathname !== "/clients"');
    expect(app).toContain("projects.length === 0");
    expect(app).toContain('Redirect to="/onboarding"');
    expect(app).toContain('projects.length === 0 ? "/onboarding" : "/clients"');
    expect(app).toContain('path="/onboarding" component={OnboardingPage}');
  });

  it("DashboardLayout 运营工具保留品牌资料入口", () => {
    const layout = read("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain('label: "品牌资料"');
    expect(layout).toContain("补齐企业被 AI 理解的基础信息");
    expect(layout).not.toContain('label: "企业档案"');
  });

  it("业务页空状态指向客户管理台", () => {
    const v12 = read("client/src/pages/V12FlowPages.tsx");
    expect(v12).toContain("客户管理台");
    expect(v12).not.toContain("企业档案页面创建");
  });

  it("不改 schema、无 Chrome 插件主文案", () => {
    expect(read("drizzle/schema.ts")).not.toContain("clientDashboard");
    const blob = read("client/src/pages/ClientDashboardPage.tsx") + read("client/src/pages/AssetCenter.tsx");
    expect(blob).not.toMatch(/下载 Chrome 插件|browser-extension\.zip/);
  });
});
