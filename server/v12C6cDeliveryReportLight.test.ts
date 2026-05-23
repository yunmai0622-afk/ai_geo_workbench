import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf-8");

describe("C6-C delivery report light customer view", () => {
  it("uses light variant on public/share pages and keeps internal dark view", () => {
    const publicPage = read("client/src/pages/DeliveryReportPublicPage.tsx");
    const sharePage = read("client/src/pages/DeliveryReportSharePage.tsx");
    const customerView = read("client/src/components/DeliveryReportCustomerView.tsx");
    const lightView = read("client/src/components/DeliveryReportCustomerLightView.tsx");
    const lightLib = read("client/src/lib/deliveryReportLightDisplay.ts");
    const flow = read("client/src/pages/V12FlowPages.tsx");

    expect(publicPage).toContain('variant="light"');
    expect(sharePage).toContain('variant="light"');
    expect(publicPage).toContain("reportNumberSeed");
    expect(sharePage).toContain("reportNumberSuffix={projectId}");
    expect(customerView).toContain('variant?: "dark" | "light"');
    expect(customerView).toContain("DeliveryReportCustomerLightView");
    expect(flow).toContain("DeliveryReportCustomerView");
    expect(flow).not.toContain('variant="light"');

    for (const text of [
      "GEO AI 搜索可见度优化交付报告",
      "老板先看这 3 点",
      "本轮你获得了什么",
      "海豚知道",
      "报告编号",
      "查看原始 AI 回答证据",
      "当前处于基线阶段，AI 尚未稳定识别品牌",
      "基线阶段（0%）",
    ]) {
      expect(lightView + lightLib).toContain(text);
    }

    expect(lightView).toContain("bg-slate-100");
    expect(lightView).not.toContain("ai-app-canvas");
    expect(customerView).toContain("ai-app-canvas");
    expect(publicPage).toContain("bg-slate-100");
  });
});
