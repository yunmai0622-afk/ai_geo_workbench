import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf-8");

describe("V1.2 可售卖版主流程静态回归", () => {
  it("将 AI GEO 增长工作台注册为首页，并保留项目管理兼容入口", () => {
    const appSource = readProjectFile("client/src/App.tsx");
    expect(appSource).toContain('import Home from "./pages/Home";');
    expect(appSource).toContain('<Route path="/" component={Home} />');
    expect(appSource).toContain('<Route path="/projects" component={ProjectsPage} />');
  });

  it("侧边栏只展示 V1.2 七个一级客户路径入口", () => {
    const layoutSource = readProjectFile("client/src/components/DashboardLayout.tsx");
    for (const label of ["总览", "企业档案", "AI 诊断", "内容生成", "内容发布", "收录监测", "交付报告"]) {
      expect(layoutSource).toContain(`label: "${label}"`);
    }
    for (const forbidden of ["内容策略", "平台优先级", "事实溯源", "一致性检查", "发布前检查", "第三方素材", "AI 可引用片段", "内容增长流水线", "平台发布", "报告中心"]) {
      expect(layoutSource).not.toContain(`label: "${forbidden}"`);
    }
  });

  it("首页作为唯一 6 步主流程入口展示项目、进度、任务、指标、风险和继续下一步", () => {
    const homeSource = readProjectFile("client/src/pages/Home.tsx");
    expect(homeSource).toContain("AI GEO 增长工作台");
    expect(homeSource).toContain("建档、诊断、内容、发布、监测、报告");
    for (const text of ["当前项目", "当前进度", "当前任务", "继续下一步", "6 步进度条", "核心指标", "当前风险提醒", "本轮试跑闭环已完成"]) {
      expect(homeSource).toContain(text);
    }
    for (const step of ["企业档案", "AI 诊断", "内容生成", "内容发布", "收录监测", "交付报告"]) {
      expect(homeSource).toContain(step);
    }
  });

  it("企业档案页只保留六类资料卡片和一个主动作", () => {
    const assetCenterSource = readProjectFile("client/src/pages/AssetCenter.tsx");
    for (const text of ["企业基础资料", "产品服务资料", "客户案例", "竞品资料", "合规规则", "发布策略"]) {
      expect(assetCenterSource).toContain(text);
    }
    expect(assetCenterSource).toContain("当前页面只保留一个主动作");
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
