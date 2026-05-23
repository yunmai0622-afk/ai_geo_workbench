import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C5-A global product UI overhaul", () => {
  it("defines product component system", () => {
    const ui = read("client/src/components/ai/ProductUi.tsx");
    for (const name of ["AiPageShell", "AiPageHero", "AiMetricCard", "AiActionCard", "AiAssetCard", "AiFunnelRail", "AiEmptyState"]) {
      expect(ui).toContain(name);
    }
  });

  it("uses grouped product navigation labels", () => {
    const layout = read("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain("让品牌被 AI 看见、理解和推荐");
    expect(layout).toContain("增长总览");
    expect(layout).toContain("内容资产生产");
    expect(layout).toContain("资产发布记录");
    expect(layout).toContain("资产进展看板");
    expect(layout).toContain("客户交付报告");
  });

  it("main pages use cockpit layout structure", () => {
    const pages = [
      read("client/src/components/V1WorkbenchOverview.tsx"),
      read("client/src/pages/ProgressPage.tsx"),
      read("client/src/pages/WeeklyContentPage.tsx"),
    ].join("\n");
    expect(pages).toContain("AiPageShell");
    expect(pages).toContain("AiPageHero");
    expect(pages).toContain("AI 搜索增长总览");
    expect(pages).toContain("资产进展看板");
    expect(pages).toContain("内容资产生产");
  });

  it("report cover uses enhanced delivery styling", () => {
    expect(read("client/src/components/DeliveryReportCustomerView.tsx")).toContain("ai-report-cover");
  });
});
