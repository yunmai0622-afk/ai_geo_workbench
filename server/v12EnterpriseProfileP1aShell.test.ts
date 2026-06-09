import { describe, expect, it } from "vitest";
import { readEnterpriseProfileUi } from "./enterpriseProfileTestBlob";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V2-P0-B Onboarding-Wizard", () => {
  const asset = read("client/src/pages/AssetCenter.tsx");
  const profileUi = readEnterpriseProfileUi();

  it("8-step wizard layout and save draft", () => {
    expect(profileUi).toContain("GEO 品牌资产建档");
    expect(asset).toContain("OnboardingWizardShell");
    expect(profileUi).toContain("wizard-step-nav");
    expect(profileUi).toContain("wizard-save-draft");
    expect(asset).toContain("upsertProfile.mutateAsync");
  });

  it("does not expose engineering fields", () => {
    expect(asset).not.toMatch(/projectId[：:]\s*["'{]/);
    expect(asset).not.toContain("ownerUserId");
    expect(asset).not.toContain("rawAnswer");
  });

  it("step panels cover brand entity and source graph", () => {
    const panels = read("client/src/components/enterpriseProfile/wizard/WizardStepPanels.tsx");
    expect(panels).toContain("wizard-step-1");
    expect(panels).toContain("wizard-manage-sources");
    expect(panels).toContain("/brand-source-graph");
  });
});
