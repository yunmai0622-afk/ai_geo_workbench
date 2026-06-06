import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C3-D global AI product UI", () => {
  it("defines shared glass and canvas utilities", () => {
    const css = read("client/src/index.css");
    const layout = read("client/src/components/DashboardLayout.tsx");
    expect(css).toContain("ai-app-canvas");
    expect(css).toContain("ai-glass-card");
    expect(css).toContain("ai-metric-card");
    expect(layout).toContain("AI 搜索增长系统");
    expect(layout).toContain("geoP0Surfaces.pageProject");
  });

  it("uses AiPageHeader on primary pages", () => {
    const pages = [
      read("client/src/components/V1WorkbenchOverview.tsx"),
      read("client/src/pages/V12FlowPages.tsx"),
      read("client/src/pages/WeeklyContentPage.tsx"),
      read("client/src/pages/EnterpriseWorkspacePage.tsx"),
    ].join("\n");
    for (const text of [
      "AI 搜索增长总览",
      "内容诊断",
      "内容生产与审核工作台",
      "项目工作台",
      "客户交付报告",
    ]) {
      expect(pages).toContain(text);
    }
    expect(read("client/src/components/AiPageHeader.tsx")).toContain("AiPageHeader");
  });

  it("preserves C3-B delivery report structure", () => {
    const report = read("client/src/components/DeliveryReportCustomerView.tsx");
    for (const text of ["经营结论", "本轮报告摘要", "下一轮优化动作", "本轮新增 AI 搜索资产"]) {
      expect(report).toContain(text);
    }
  });

  it("C3-D-Fix weakens internal delivery zone on report page", () => {
    const report = read("client/src/pages/DeliveryReportsCenterPage.tsx");
    expect(report).toContain("内部交付工作区");
    expect(report).not.toContain("bg-slate-900");
    expect(report).not.toContain("bg-cyan-400 text-slate-950");
  });
});
