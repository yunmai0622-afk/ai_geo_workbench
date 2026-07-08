import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO V2.2 P2 sellable delivery loop", () => {
  it("keeps the sellable delivery loop model customer-facing", () => {
    const shared = read("shared/sellableDeliveryLoop.ts");
    expect(shared).toContain("buildSellableDeliveryLoopView");
    expect(shared).toContain("诊断");
    expect(shared).toContain("计划");
    expect(shared).toContain("复测");
    expect(shared).toContain("续费解释");
  });

  it("keeps the sellable loop component available without embedding it on /workspace", () => {
    const page = read("client/src/pages/EnterpriseWorkspacePage.tsx");
    const component = read("client/src/components/workspace/WorkspaceSellableDeliveryLoopCard.tsx");
    expect(page).toContain("geo.monthlyPlan.getOptimizationBrief");
    expect(page).not.toContain("buildSellableDeliveryLoopView");
    expect(page).not.toContain("WorkspaceSellableDeliveryLoopCard");
    expect(page).toContain("workspace-service-flow");
    expect(component).toContain("本月 GEO 交付闭环");
    expect(component).toContain("workspace-sellable-delivery-loop");
  });
});
