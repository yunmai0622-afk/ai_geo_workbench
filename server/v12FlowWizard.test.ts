import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf-8");

describe("工作台 Flow 页（与首页同组件）", () => {
  it("将 /flow 注册为受保护路由，确保客户试跑向导可访问", () => {
    const appSource = readProjectFile("client/src/App.tsx");
    expect(appSource).toContain('path="/flow"');
    expect(appSource).toMatch(/path="\/flow"[\s\S]*Redirect to="\/workspace"/);
  });

  it("/flow 页面展示增长总览驾驶舱", () => {
    const source = readProjectFile("client/src/components/V1WorkbenchOverview.tsx");
    expect(source).toContain("AI 搜索增长总览");
    expect(source).toContain("核心状态");
    expect(source).toContain("生成内容资产");
    expect(source).toContain("品牌提及率");
    expect(source).toContain("BusinessPageProjectHeader");
    expect(source).toContain("selectedProject");
  });

  it("展示行动卡与最近进展区块", () => {
    const source = readProjectFile("client/src/components/V1WorkbenchOverview.tsx");
    expect(source).toContain("最近发布");
    expect(source).toContain("诊断与实测");
    expect(source).toContain("AiActionCard");
  });

  it("不展示旧版三步流程文案", () => {
    const source = readProjectFile("client/src/components/V1WorkbenchOverview.tsx");
    expect(source).not.toContain("V1.0 核心三步流程");
    expect(source).not.toContain("关键产物入口");
    expect(source).toMatch(/去完成内容诊断|进入内容资产生产/);
  });
});
