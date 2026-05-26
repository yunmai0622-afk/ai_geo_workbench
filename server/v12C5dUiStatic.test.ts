import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C5-D enterprise profile page product UI", () => {
  const page = read("client/src/pages/AssetCenter.tsx");

  it("uses simplified GEO onboarding layout with publish env on top", () => {
    expect(page).toContain("品牌资产建档");
    expect(page).toContain("FiveMinuteBasicOnboardingSection");
    expect(page).toContain("ProfileUploadAssistSection");
    expect(page).toContain("ProfilePublishEnvLightHint");
    expect(page).toContain("AdvancedMaterialsSection");
    expect(page).toContain("ProfileAiUnderstandingPreview");
    expect(page).not.toContain("Section 1 · 基本身份");
    expect(page).not.toContain("GeoStatusGuide");
  });

  it("keeps save handlers unchanged", () => {
    expect(page).toContain("upsertProfile.mutateAsync");
    expect(page).toContain("createCustomerCase.mutateAsync");
    expect(page).toContain("saveFiveMinuteAndStartDiagnosis");
    expect(page).toContain("ProfilePublishEnvLightHint");
  });
});
