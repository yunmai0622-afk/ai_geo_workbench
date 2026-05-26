import { describe, expect, it } from "vitest";
import { readEnterpriseProfileUi } from "./enterpriseProfileTestBlob";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("Enterprise-Profile-Simplify-V1", () => {
  it("uses simplified page structure", () => {
    const profileUi = readEnterpriseProfileUi();
    expect(profileUi).toContain("品牌资产建档");
    expect(profileUi).toContain("FiveMinuteBasicOnboardingSection");
    expect(profileUi).toContain("ProfileUploadAssistSection");
    expect(profileUi).toContain("AdvancedMaterialsSection");
    expect(read("client/src/pages/AssetCenter.tsx")).not.toContain("ProductPositioningSection");
    expect(read("client/src/pages/AssetCenter.tsx")).not.toContain("CustomerScenarioSection");
  });

  it("five minute onboarding has bounded P0 fields", () => {
    const basic = read("client/src/components/enterpriseProfile/FiveMinuteBasicOnboardingSection.tsx");
    expect(read("client/src/pages/AssetCenter.tsx")).toContain("保存并开始 AI 实测诊断");
    const count = (basic.match(/testId="p0-field-/g) ?? []).length;
    expect(count).toBeLessThanOrEqual(10);
    expect(count).toBeGreaterThanOrEqual(8);
  });

  it("advanced section is collapsed by default", () => {
    const advanced = read("client/src/components/enterpriseProfile/AdvancedMaterialsSection.tsx");
    expect(advanced).toContain("advanced-materials-collapsed");
    expect(advanced).toContain("advanced-fold-faq");
  });

  it("AI 理解预览在首屏", () => {
    expect(read("client/src/components/enterpriseProfile/ProfileAiUnderstandingPreview.tsx")).toContain(
      "AI 当前会这样理解你的企业",
    );
  });
});
