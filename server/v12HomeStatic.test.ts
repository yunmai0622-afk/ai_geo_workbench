import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf-8");

describe("V1.2 首页增长指挥舱静态回归", () => {
  it("将 AI GEO 增长指挥舱注册为首页，并保留项目管理独立入口", () => {
    const appSource = readProjectFile("client/src/App.tsx");
    expect(appSource).toContain('import Home from "./pages/Home";');
    expect(appSource).toContain('<Route path="/" component={Home} />');
    expect(appSource).toContain('<Route path="/projects" component={ProjectsPage} />');
  });

  it("侧边栏展示中文增长指挥舱、项目管理和企业资料中心入口", () => {
    const layoutSource = readProjectFile("client/src/components/DashboardLayout.tsx");
    expect(layoutSource).toContain('label: "增长指挥舱", path: "/"');
    expect(layoutSource).toContain('label: "项目管理", path: "/projects"');
    expect(layoutSource).toContain('label: "企业资料中心", path: "/assets"');
  });

  it("首页指挥舱呈现 Sprint 1 核心指标和边界约束", () => {
    const homeSource = readProjectFile("client/src/pages/Home.tsx");
    expect(homeSource).toContain("增长指挥舱");
    expect(homeSource).toContain("企业资料完整度");
    expect(homeSource).toContain("资料来源");
    expect(homeSource).toContain("真实案例");
    expect(homeSource).toContain("竞品资料");
    expect(homeSource).toContain("不保存明文平台凭证");
    expect(homeSource).toContain("不把文件字节写入数据库");
    expect(homeSource).toContain("不自动代发第三方平台");
  });

  it("企业资料中心覆盖七类资料保存入口和后端读取接口", () => {
    const assetCenterSource = readProjectFile("client/src/pages/AssetCenter.tsx");
    const routerSource = readProjectFile("server/routers.ts");
    expect(assetCenterSource).toContain("企业基础信息与产品服务资料");
    expect(assetCenterSource).toContain("客户案例");
    expect(assetCenterSource).toContain("竞品资料");
    expect(assetCenterSource).toContain("合规规则");
    expect(assetCenterSource).toContain("内容风格");
    expect(assetCenterSource).toContain("发布策略");
    expect(assetCenterSource).toContain("平台授权");
    expect(routerSource).toContain("upsertProfile");
    expect(routerSource).toContain("addTextSource");
    expect(routerSource).toContain("createCustomerCase");
    expect(routerSource).toContain("createCompetitor");
    expect(routerSource).toContain("createComplianceRule");
    expect(routerSource).toContain("createStyleProfile");
    expect(routerSource).toContain("createPublishStrategy");
    expect(routerSource).toContain("createPlatformAuthorization");
  });

  it("文章详情与公开页显式展示六类资产库生成依据", () => {
    const articlePageSource = readProjectFile("client/src/pages/GeoPages.tsx");
    const publicPageSource = readProjectFile("client/src/pages/GeoPublicContent.tsx");
    for (const source of [articlePageSource, publicPageSource]) {
      expect(source).toContain("使用了哪些企业资料");
      expect(source).toContain("使用了哪些竞品资料");
      expect(source).toContain("是否使用客户案例");
      expect(source).toContain("是否使用合规规则");
      expect(source).toContain("是否使用内容风格");
      expect(source).toContain("是否使用发布策略");
    }
  });
});
