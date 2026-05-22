import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf-8");

describe("V1.0 客户主路径静态回归", () => {
  it("将企业 GEO 内容增长工作台注册为首页，并保留项目管理兼容入口", () => {
    const appSource = readProjectFile("client/src/App.tsx");
    expect(appSource).toContain('import Home from "./pages/Home";');
    expect(appSource).toContain('<Route path="/" component={Home} />');
    expect(appSource).toContain('<Route path="/projects" component={ProjectsPage} />');
  });

  it("侧边栏展示客户主入口（含内容进展占位），并把旧路径作为兼容别名", () => {
    const layoutSource = readProjectFile("client/src/components/DashboardLayout.tsx");
    for (const label of ["工作台", "我的信息", "内容诊断", "本周内容", "发布记录", "内容进展", "效果报告"]) {
      expect(layoutSource).toContain(`label: "${label}"`);
    }
    expect(layoutSource).toContain('path: "/progress"');
    expect(layoutSource).toContain('path: "/progress"');
    expect(layoutSource).not.toContain("即将上线");
    for (const forbidden of ["总览", "内容生成", "内容发布", "收录监测", "内容策略", "平台优先级", "事实溯源", "一致性检查", "发布前检查", "第三方素材", "AI 可引用片段", "内容增长流水线", "报告中心"]) {
      expect(layoutSource).not.toContain(`label: "${forbidden}"`);
    }
    for (const alias of ["/projects", "/assets", "/diagnosis", "/questions", "/responses", "/analysis", "/scores", "/weekly", "/content-generation", "/articles", "/publish", "/monitoring", "/inclusion-monitoring", "/reports"]) {
      expect(layoutSource).toContain(alias);
    }
  });

  it("首页展示今日概览、本周任务与累计进展", () => {
    const homeSource = readProjectFile("client/src/pages/Home.tsx") + readProjectFile("client/src/components/V1WorkbenchOverview.tsx");
    expect(homeSource).toContain("企业 AI 搜索增长工作台");
    expect(homeSource).toContain("今日概览与本周任务");
    for (const text of ["你好", "本周内容任务", "最近发布", "内容诊断", "累计发布篇数", "覆盖问题场景", "内容覆盖评分", "较上次变化"]) {
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

  it("企业档案页为 Section 结构并保留资料完整度提示", () => {
    const assetCenterSource = readProjectFile("client/src/pages/AssetCenter.tsx");
    for (const text of ["Section 1 · 基本身份", "Section 2 · 你的客户", "Section 3 · 有什么证明", "保存基本身份", "保存客户信息"]) {
      expect(assetCenterSource).toContain(text);
    }
    expect(assetCenterSource).toContain("资料完整度");
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
