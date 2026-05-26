import { describe, expect, it } from "vitest";
import { readEnterpriseProfileUi } from "./enterpriseProfileTestBlob";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C5-D enterprise profile page product UI", () => {
  const page = read("client/src/pages/AssetCenter.tsx");
  const profileUi = readEnterpriseProfileUi();

  it("uses simplified GEO onboarding layout with publish env on top", () => {
    expect(profileUi).toContain("品牌资产建档");
    expect(profileUi).toContain("FiveMinuteBasicOnboardingSection");
    expect(profileUi).toContain("ProfileUploadAssistSection");
    expect(profileUi).toContain("AdvancedMaterialsSection");
    expect(profileUi).toContain("ProfilePublishEnvLightHint");
    expect(page).not.toContain("Section 1 · 基本身份");
    expect(page).not.toContain("GeoStatusGuide");
  });

  it("keeps save handlers unchanged", () => {
    expect(page).toContain("upsertProfile.mutateAsync");
    expect(page).toContain("createCustomerCase.mutateAsync");
    expect(page).toContain("保存并开始 AI 实测诊断");
    expect(profileUi).toContain("EnterprisePublishEnvironmentSection");
  });
});
