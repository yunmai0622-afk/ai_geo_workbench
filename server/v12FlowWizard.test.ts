import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const navigateMock = vi.fn();

vi.mock("wouter", () => ({
  useLocation: () => ["/flow", navigateMock],
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    geo: {
      projects: {
        list: {
          useQuery: () => ({
            isLoading: false,
            data: [{ id: 1, enterpriseName: "海豚知道", industry: "知识付费 SaaS", status: "created", website: "https://haitunzhidao.com" }],
          }),
        },
      },
      scores: { latest: { useQuery: () => ({ isLoading: false, data: null, isError: false }) } },
      tasks: { list: { useQuery: () => ({ isLoading: false, data: [], isError: false }) } },
      articles: {
        list: { useQuery: () => ({ isLoading: false, data: [], isError: false }) },
        publishRecords: { useQuery: () => ({ isLoading: false, data: [], isError: false }) },
      },
    },
  },
}));

import GeoFlowWizardPage from "../client/src/pages/GeoFlowWizard";

describe("工作台 Flow 页（与首页同组件）", () => {
  const renderHtml = () => renderToStaticMarkup(React.createElement(GeoFlowWizardPage));
  const readProjectFile = (relativePath: string) => readFileSync(resolve(__dirname, "..", relativePath), "utf-8");

  it("将 /flow 注册为受保护路由，确保客户试跑向导可访问", () => {
    const appSource = readProjectFile("client/src/App.tsx");
    expect(appSource).toContain('import GeoFlowWizardPage from "./pages/GeoFlowWizard";');
    expect(appSource).toContain('<Route path="/flow" component={GeoFlowWizardPage} />');
  });

  it("/flow 页面展示今日概览、问候语与项目选择", () => {
    const html = renderHtml();
    expect(html).toContain("内容增长工作台");
    expect(html).toContain("今日概览与本周任务");
    expect(html).toContain("你好");
    expect(html).toContain("当前项目");
    expect(html).toContain("海豚知道");
  });

  it("展示本周任务、核心数字与诊断入口", () => {
    const html = renderHtml();
    expect(html).toContain("本周内容任务");
    expect(html).toMatch(/开始生成本周文章|先去获取本周建议/);
    expect(html).toContain("累计发布篇数");
    expect(html).toContain("内容诊断");
    expect(html).toContain("最近发布");
  });

  it("无诊断时引导立即诊断，且不展示旧版三步流程文案", () => {
    const html = renderHtml();
    expect(html).toContain("立即诊断");
    expect(html).not.toContain("V1.0 核心三步流程");
    expect(html).not.toContain("关键产物入口");
  });
});
