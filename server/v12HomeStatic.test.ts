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
});
