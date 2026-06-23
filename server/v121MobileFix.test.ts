import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-MobileFix", () => {
  it("下一步建议面板：移动端底部折叠 + 主区 CTA，桌面保留右侧栏", () => {
    const shell = read("client/src/components/project/EnterpriseProjectShell.tsx");
    const dock = read("client/src/components/project/ProjectNextActionMobileDock.tsx");
    expect(shell).toContain("ProjectNextActionMobileDock");
    expect(shell).toContain("next-action-mobile-inline-cta");
    expect(shell).toContain("hidden shrink-0 lg:block");
    expect(shell).toContain("useIsMobile");
    expect(dock).toContain("project-next-action-mobile-dock");
    expect(dock).toContain("lg:hidden");
  });

  it("平台化内容资产页：平台矩阵首屏 + 历史内容默认折叠", () => {
    const board = read("client/src/components/weekly/PlatformContentBoard.tsx");
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    const auxiliary = read("client/src/components/weekly/WeeklyAuxiliarySections.tsx");
    const collapsible = read("client/src/components/weekly/WeeklyCollapsibleSection.tsx");
    expect(board).toContain("weekly-platform-matrix-grid");
    expect(board).toContain("grid-cols-1");
    expect(board).toContain("lg:grid-cols-2");
    expect(weekly).toContain("CurrentContentTaskCard");
    expect(weekly).toContain("PlatformTaskBoard");
    expect(auxiliary).toContain("历史内容记录");
    expect(collapsible).toMatch(/open=\{defaultOpen \? undefined : false\}/);
    expect(weekly).toContain("WeeklyContentDetailSheet");
  });
});
