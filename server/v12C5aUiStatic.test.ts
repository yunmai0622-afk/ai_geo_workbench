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
    const marketing = read("client/src/components/auth/authMarketing.ts");
    expect(marketing).toContain("持续提升企业在 AI 搜索中的识别、信任与推荐");
    expect(layout).toContain("PLATFORM_PRODUCT_SUBTITLE");
    expect(layout).toContain('label: "总览"');
    expect(layout).toContain('label: "本月方案"');
    expect(layout).toContain('label: "执行进度"');
    expect(layout).toContain("内容生产工作台");
    expect(layout).toContain("发布执行中心");
    expect(layout).toContain("效果验证");
    expect(layout).toContain("效果报告");
    expect(layout).toContain("使用指南");
  });

  it("main pages use cockpit layout structure", () => {
    const pages = [
      read("client/src/components/V1WorkbenchOverview.tsx"),
      read("client/src/pages/ProgressPage.tsx"),
      read("client/src/pages/WeeklyContentPage.tsx"),
    ].join("\n");
    expect(pages).toContain("AiPageShell");
    expect(pages).toContain("AI 搜索增长总览");
    expect(read("client/src/components/LegacyAssetProgressRedirect.tsx")).toContain('buildProjectUrl("/workspace"');
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("内容任务推进");
  });

  it("report cover uses enhanced delivery styling", () => {
    expect(read("client/src/components/DeliveryReportCustomerView.tsx")).toContain("ai-report-cover");
  });
});
