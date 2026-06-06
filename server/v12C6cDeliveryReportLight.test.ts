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
    const productBody = read("client/src/components/delivery/DeliveryReportProductBody.tsx");
    const flow = read("client/src/pages/V12FlowPages.tsx");

    expect(publicPage).toContain('variant="light"');
    expect(sharePage).toContain('variant="light"');
    expect(publicPage).toContain("reportNumberSeed");
    expect(sharePage).toContain("reportNumberSuffix={projectId}");
    expect(customerView).toContain('variant?: "dark" | "light"');
    expect(customerView).toContain("DeliveryReportCustomerLightView");
    expect(flow).toContain("DeliveryReportsCenterPage");
    expect(flow).not.toContain('variant="light"');

    expect(lightView).toContain("GEO 增长交付报告");
    expect(productBody).toContain("delivery-report-boss-summary");
    expect(lightView).toContain("报告编号");
    expect(lightView).toContain("查看原始 AI 回答证据");
    expect(lightView).not.toContain("老板先看这 3 点");
    expect(lightView).not.toContain("本轮你获得了什么");
    expect(lightView).not.toContain("AI 搜索可见度评分");

    expect(lightView).toContain("bg-gray-100");
    expect(lightView).not.toContain("ai-app-canvas");
    expect(customerView).toContain("ai-app-canvas");
    expect(publicPage).toContain("bg-gray-100");
  });
});
