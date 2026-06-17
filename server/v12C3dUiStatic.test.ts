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
    const marketing = read("client/src/components/auth/authMarketing.ts");
    const indexHtml = read("client/index.html");
    expect(marketing).toContain("AI 品牌经营系统");
    expect(marketing).toContain("持续提升企业在 AI 搜索中的识别、信任与推荐");
    for (const legacy of ["GEO 增长工作台", "GEO增长工作台", "AI 搜索增长系统", "AI搜索增长系统"]) {
      expect(marketing).not.toContain(legacy);
      expect(layout).not.toContain(legacy);
      expect(indexHtml).not.toContain(legacy);
    }
    expect(layout).toContain("PLATFORM_PRODUCT_NAME");
    expect(layout).toContain("PLATFORM_PRODUCT_SUBTITLE");
    expect(layout).toContain("geoP0Surfaces.pageProject");
  });

  it("uses AiPageHeader on primary pages", () => {
    const pages = [
      read("client/src/components/V1WorkbenchOverview.tsx"),
      read("client/src/pages/V12FlowPages.tsx"),
      read("client/src/pages/WeeklyContentPage.tsx"),
      read("client/src/pages/EnterpriseWorkspacePage.tsx"),
      read("client/src/pages/DeliveryReportsCenterPage.tsx"),
      read("shared/monthlyReportView.ts"),
    ].join("\n");
    for (const text of [
      "AI 搜索增长总览",
      "内容诊断",
      "内容任务推进",
      "项目工作台",
      "AI 品牌成熟度月报",
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

  it("C3-D-Fix monthly report page uses customer-facing light layout", () => {
    const report = read("client/src/pages/DeliveryReportsCenterPage.tsx");
    expect(report).toContain("monthly-report-title");
    expect(report).not.toContain("bg-slate-900");
    expect(report).not.toContain("bg-cyan-400 text-slate-950");
  });
});
