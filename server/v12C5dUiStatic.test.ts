import { describe, expect, it } from "vitest";
import { readEnterpriseProfileUi } from "./enterpriseProfileTestBlob";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C5-D enterprise profile page product UI", () => {
  const page = read("client/src/pages/AssetCenter.tsx");
  const profileUi = readEnterpriseProfileUi();

  it("uses 8-step GEO wizard layout", () => {
    expect(profileUi).toContain("GEO 品牌资产建档");
    expect(profileUi).toContain("OnboardingWizardShell");
    expect(profileUi).toContain("wizard-step-nav");
    expect(profileUi).toContain("AdvancedMaterialsSection");
    expect(page).not.toContain("Section 1 · 基本身份");
    expect(page).not.toContain("GeoStatusGuide");
  });

  it("keeps save handlers", () => {
    expect(page).toContain("upsertProfile.mutateAsync");
    expect(profileUi).toContain("wizard-save-draft");
  });
});
