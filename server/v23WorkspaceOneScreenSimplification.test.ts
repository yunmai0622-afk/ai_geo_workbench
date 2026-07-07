import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf-8");

describe("GEO V2.3-P0-Q workspace one screen simplification", () => {
  const page = read("client/src/pages/EnterpriseWorkspacePage.tsx");

  it("keeps /workspace focused on the four customer service blocks", () => {
    for (const marker of [
      "workspace-customer-conclusion",
      "workspace-core-metrics",
      "workspace-service-flow",
      "workspace-recent-progress",
      "workspace-customer-risks",
    ]) {
      expect(page).toContain(marker);
    }

    expect(page).toContain("当前最大问题");
    expect(page).toContain("客户只看当前状态、服务进度和下一步动作");
    expect(page).toContain('label: "查看本月服务计划"');
    expect(page).not.toContain("workspace-monthly-top3");
  });

  it("keeps operational modules behind one default-closed internal reference entry", () => {
    expect(page).toContain('data-testid="workspace-operator-details"');
    expect(page).toContain("运营详情，仅内部参考");
    expect(page).toContain("默认关闭，不进入客户第一轮演示");
    expect(page).toContain("诊断详情、成熟度、趋势、监测明细和运营建议保留给内部交付复盘");

    const operatorDetailsStart = page.indexOf('data-testid="workspace-operator-details"');
    const firstOperationalModule = page.indexOf("AI 品牌成熟度详情");
    expect(operatorDetailsStart).toBeGreaterThan(-1);
    expect(firstOperationalModule).toBeGreaterThan(operatorDetailsStart);
  });
});
