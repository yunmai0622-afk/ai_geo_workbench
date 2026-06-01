import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");
const NO_PUBLIC_LINK = "暂无公开链接，请先完成发布并回填链接。";

describe("Phase4 delivery report productization", () => {
  const page = read("client/src/pages/DeliveryReportsCenterPage.tsx");
  const display = read("client/src/lib/deliveryReportProductDisplay.ts");
  const flow = read("client/src/pages/V12FlowPages.tsx");

  it("re-exports from V12FlowPages", () => {
    expect(flow).toContain(
      'export { DeliveryReportsCenterPage as DeliveryReportsFlowPage } from "./DeliveryReportsCenterPage"',
    );
    expect(flow).not.toContain("export function DeliveryReportsFlowPage");
  });

  it("first screen is customer delivery report", () => {
    for (const text of [
      "delivery-report-page",
      "GEO 实验型交付报告",
      "delivery-report-hero",
      "delivery-report-detection-scope",
      "本期检测范围",
      "delivery-report-t0-baseline",
      "T0 基线结果摘要",
      "一句话经营结论",
      "delivery-report-core-metrics",
      "delivery-report-t0t1-comparison",
      "T0/T1 变化对比",
      "RetestComparisonPanel",
      "品牌提及率",
      "AI 推荐率",
      "内容引用率",
      "收录成功数",
      "待优化内容数",
      "delivery-report-next-actions",
      "发布内容清单",
      "delivery-report-uncertainty",
      "不确定性说明",
      "生成下一轮内容计划",
      "进入优化池",
      "导出报告",
      "window.print",
    ]) {
      expect(page + display).toContain(text);
    }
    expect(display).toContain("当前数据不足，完成发布后复测后将生成本轮 GEO 增长结论。");
    expect(display).toContain(NO_PUBLIC_LINK);
  });

  it("report body has experimental and customer sections", () => {
    const shared = read("shared/deliveryReportExperimentalDisplay.ts");
    for (const text of [
      "本轮完成事项",
      "AI 平台表现",
      "发布内容清单",
      "收录与复测结果",
      "当前问题",
      "下一轮优化建议",
      "DELIVERY_REPORT_UNCERTAINTY_DISCLAIMER",
    ]) {
      expect(page).toContain(text);
    }
    expect(shared).toContain("不承诺单次优化必然带来推荐率提升");
  });

  it("does not fabricate or expose engineering fields", () => {
    expect(page).not.toContain("mock");
    expect(page).not.toContain("rawAnswer");
    expect(page).not.toContain("provider");
    expect(page).not.toContain("taskId");
    expect(page).not.toContain("JSON.stringify");
    expect(page).not.toContain("AiPageHero");
    expect(page).not.toContain("资产发布记录");
  });

  it("share and internal areas are folded", () => {
    expect(page).toContain("delivery-report-share-fold");
    expect(page).toContain("delivery-report-internal-fold");
    expect(page).toContain("createShareLink");
  });
});
