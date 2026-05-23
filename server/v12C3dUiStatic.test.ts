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
    expect(layout).toContain("ai-app-canvas");
  });

  it("uses AiPageHeader on primary pages", () => {
    const pages = [
      read("client/src/components/V1WorkbenchOverview.tsx"),
      read("client/src/pages/V12FlowPages.tsx"),
      read("client/src/pages/WeeklyContentPage.tsx"),
      read("client/src/pages/ProgressPage.tsx"),
    ].join("\n");
    for (const text of [
      "AI 搜索增长总览",
      "AI 内容诊断",
      "内容资产生产",
      "资产发布记录",
      "资产进展看板",
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
    const flow = read("client/src/pages/V12FlowPages.tsx");
    expect(flow).toContain("内部交付工作区");
    expect(flow).toContain('variant="ai"');
    expect(flow).not.toContain("bg-slate-900");
    expect(flow).not.toContain("bg-cyan-400 text-slate-950");
  });
});
