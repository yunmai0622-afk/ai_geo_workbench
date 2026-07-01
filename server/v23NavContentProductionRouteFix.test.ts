import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf-8");

describe("GEO V2.3-P0-M nav content production route fix", () => {
  it("separates weekly customer execution and operator content production active keys", () => {
    const layout = read("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain('key: "weekly-execution"');
    expect(layout).toContain('key: "content-production"');
    expect(layout).toContain('path: `/weekly?mode=${CONTENT_PRODUCTION_MODE}`');
    expect(layout).toContain('activeQuery: { mode: CONTENT_PRODUCTION_MODE }');
    expect(layout).toContain("function isNavItemActive");
    expect(layout).toContain("getSearchFromLocation");
    expect(layout).toContain('searchParams.get("mode") === CONTENT_PRODUCTION_MODE');
    expect(layout).toContain("<SidebarMenuItem key={item.key}>");
  });

  it("keeps weekly as the shared component while labeling the operator entry", () => {
    const weeklyPage = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weeklyPage).toContain("isContentProductionWorkbench");
    expect(weeklyPage).toContain("运营工具 / 内容生产工作台");
    expect(weeklyPage).toContain("客户主流程 / 执行进度");
    expect(weeklyPage).toContain("运营团队在这里围绕 AI 引用逻辑生成、质检并推进平台化内容。");
  });
});
