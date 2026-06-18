import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf-8");

describe("V1.0 客户主路径静态回归", () => {
  it("根路径导向客户管理台，并保留项目管理兼容入口", () => {
    const appSource = readProjectFile("client/src/App.tsx");
    expect(appSource).toMatch(/path="\/"[\s\S]*Redirect to="\/clients"/);
    expect(appSource).toMatch(/path="\/home"[\s\S]*Redirect to="\/clients"/);
    expect(appSource).toContain('<Route path="/projects" component={ProjectsPage} />');
  });

  it("侧边栏展示客户主入口（含内容进展占位），并把旧路径作为兼容别名", () => {
    const layoutSource = readProjectFile("client/src/components/DashboardLayout.tsx");
    for (const label of [
      "品牌资产建档",
      "AI 实测诊断",
      "内容生产工作台",
      "平台适配发布",
      "收录监测",
      "AI 品牌成熟度月报",
    ]) {
      expect(layoutSource).toContain(`label: "${label}"`);
    }
    expect(layoutSource).toContain('path: "/inclusion-monitoring"');
    expect(layoutSource).not.toContain("即将上线");
    for (const forbidden of ["总览", "内容生成", "内容发布", "内容策略", "平台优先级", "事实溯源", "一致性检查", "发布前检查", "第三方素材", "AI 可引用片段", "内容增长流水线", "报告中心", "资产进展看板"]) {
      expect(layoutSource).not.toContain(`label: "${forbidden}"`);
    }
    for (const alias of ["/projects", "/assets", "/diagnosis", "/questions", "/responses", "/analysis", "/scores", "/weekly", "/content-generation", "/articles", "/publish", "/monitoring", "/inclusion-monitoring", "/reports"]) {
      expect(layoutSource).toContain(alias);
    }
  });

  it("首页展示增长总览、核心指标与行动卡", () => {
    const homeSource = readProjectFile("client/src/components/V1WorkbenchOverview.tsx");
    expect(homeSource).toContain("AI 搜索增长总览");
    for (const text of ["核心状态", "下一步动作", "最近进展", "品牌提及率", "AI 搜索可见度评分"]) {
      expect(homeSource).toContain(text);
    }
    expect(homeSource).toContain("geo.scores.latest");
    expect(homeSource).toContain("geo.tasks.list");
    expect(homeSource).toContain("geo.articles.list");
    expect(homeSource).toContain("geo.articles.publishRecords");
    for (const forbidden of ["V1.0 核心三步流程", "关键产物入口", "GEO 可见度", "推演", "资产库", "analysis_results", "geo_scores"]) {
      expect(homeSource).not.toContain(forbidden);
    }
  });

  it("企业档案页为档案配置台结构并保留保存入口", () => {
    const assetCenterSource = readProjectFile("client/src/pages/AssetCenter.tsx");
    const profileUi =
      assetCenterSource +
      readProjectFile("shared/onboardingWizardSteps.ts") +
      readProjectFile("client/src/components/enterpriseProfile/wizard/WizardStepFooter.tsx");
    for (const text of ["GEO 品牌资产建档", "OnboardingWizardShell", "wizard-save-draft", "AdvancedMaterialsSection"]) {
      expect(profileUi).toContain(text);
    }
    expect(assetCenterSource).not.toContain("内容风格");
    expect(assetCenterSource).not.toContain("平台授权配置占位");
  });

  it("公开内容页保持正式文章体验，审计信息默认折叠", () => {
    const publicPageSource = readProjectFile("client/src/pages/GeoPublicContent.tsx");
    expect(publicPageSource).toContain("文章正文");
    expect(publicPageSource).not.toContain("正式文章正文");
    expect(publicPageSource).toContain("AI 可引用摘要");
    expect(publicPageSource).toContain("企业实体信息");
    expect(publicPageSource).toContain("查看生成依据与事实溯源");
    expect(publicPageSource).toContain("<details");
    expect(publicPageSource).not.toContain("<details open");
  });
});
