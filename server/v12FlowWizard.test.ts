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
      assetLibrary: {
        summary: {
          useQuery: () => ({ isLoading: false, data: { completionScore: 40, riskReminders: ["需先完成企业档案再推进后续环节。"] } }),
        },
      },
      analysis: { list: { useQuery: () => ({ isLoading: false, data: [] }) } },
      articles: {
        list: { useQuery: () => ({ isLoading: false, data: [] }) },
        publishRecords: { useQuery: () => ({ isLoading: false, data: [] }) },
      },
      reports: { latest: { useQuery: () => ({ isLoading: false, data: null }) } },
    },
  },
}));

import GeoFlowWizardPage from "../client/src/pages/GeoFlowWizard";

describe("V1.2 客户试跑向导页", () => {
  const renderHtml = () => renderToStaticMarkup(React.createElement(GeoFlowWizardPage));
  const readProjectFile = (relativePath: string) => readFileSync(resolve(__dirname, "..", relativePath), "utf-8");

  it("将 /flow 注册为受保护路由，确保客户试跑向导可访问", () => {
    const appSource = readProjectFile("client/src/App.tsx");
    expect(appSource).toContain('import GeoFlowWizardPage from "./pages/GeoFlowWizard";');
    expect(appSource).toContain('<Route path="/flow" component={GeoFlowWizardPage} />');
  });

  it("/flow 页面展示标题、副标题、当前项目、当前步骤和继续当前步骤主按钮", () => {
    const html = renderHtml();
    expect(html).toContain("AI GEO 试跑向导");
    expect(html).toContain("按 6 步完成一次企业 AI 搜索诊断、内容生成、发布监测和交付报告");
    expect(html).toContain("海豚知道｜知识付费 SaaS");
    expect(html).toContain("当前步骤 1/6");
    expect(html).toContain("继续当前步骤");
  });

  it("展示 6 个步骤卡片，并且每张卡都有状态、完成标准和唯一主按钮", () => {
    const html = renderHtml();
    for (const step of ["企业档案", "AI 诊断", "内容生成", "内容发布", "收录监测", "交付报告"]) {
      expect(html).toContain(step);
    }
    expect((html.match(/第 [1-6] 步/g) ?? []).length).toBe(6);
    expect((html.match(/完成标准/g) ?? []).length).toBe(6);
    expect(html).toContain("进行中");
    expect(html).toContain("有风险");
    expect((html.match(/<button/g) ?? []).length).toBe(7);
  });

  it("未解锁步骤显示需先完成上一环节，且高级能力只作为状态信号展示", () => {
    const html = renderHtml();
    expect(html).toContain("需先完成上一环节");
    for (const signal of ["事实溯源", "一致性检查", "发布前检查", "第三方素材", "AI 可引用片段"]) {
      expect(html).toContain(signal);
    }
    expect(html).toContain("高级能力仅作为状态信号展示，不作为本页主入口");
  });
});
