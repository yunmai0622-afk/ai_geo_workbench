import { describe, expect, it } from "vitest";
import { readEnterpriseProfileUi } from "./enterpriseProfileTestBlob";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("Enterprise-Profile-Simplify-V1", () => {
  it("uses 8-step wizard page structure", () => {
    const profileUi = readEnterpriseProfileUi();
    expect(profileUi).toContain("GEO 品牌资产建档");
    expect(profileUi).toContain("OnboardingWizardShell");
    expect(read("client/src/pages/AssetCenter.tsx")).not.toContain("ProductPositioningSection");
    expect(read("client/src/pages/AssetCenter.tsx")).not.toContain("CustomerScenarioSection");
  });

  it("wizard has eight navigable steps", () => {
    const shell = read("client/src/components/enterpriseProfile/wizard/OnboardingWizardShell.tsx");
    expect(shell).toContain("ONBOARDING_WIZARD_STEPS");
    expect(read("shared/onboardingWizardSteps.ts")).toContain("title: \"90 天 GEO 目标\"");
  });

  it("advanced case section remains available", () => {
    const advanced = read("client/src/components/enterpriseProfile/AdvancedMaterialsSection.tsx");
    expect(advanced).toContain("advanced-materials-collapsed");
    expect(read("client/src/pages/AssetCenter.tsx")).toContain("AdvancedMaterialsSection");
  });
});
