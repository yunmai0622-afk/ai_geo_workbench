import { describe, expect, it } from "vitest";
import { readEnterpriseProfileUi } from "./enterpriseProfileTestBlob";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("Profile UX enterprise archive console", () => {
  const page = read("client/src/pages/AssetCenter.tsx");
  const profileUi = readEnterpriseProfileUi();
  const panel = read("client/src/components/enterpriseProfile/ProfileIntakePanel.tsx");

  it("uses customer-facing archive title and intake copy", () => {
    expect(profileUi).toContain("品牌资产建档");
    expect(panel).toContain("先上传企业资料");
    expect(page).toContain("FiveMinuteBasicOnboardingSection");
    expect(page).toContain("AdvancedMaterialsSection");
    expect(read("client/src/components/enterpriseProfile/EnterprisePublishEnvironmentSection.tsx")).toContain(
      "发布环境与账号绑定",
    );
  });

  it("does not expose engineering section titles", () => {
    expect(page).not.toContain("Section 1");
    expect(page).not.toContain("Section 2");
    expect(page).not.toContain("Section 3");
  });

  it("keeps platform binding matrix without chrome plugin auth", () => {
    expect(profileUi).toContain("EnterprisePublishEnvironmentSection");
    const matrix = read("client/src/components/platformAccounts/PlatformAccountMatrix.tsx");
    expect(matrix).toContain("平台账号矩阵");
    expect(read("client/src/components/platformAccounts/usePlatformAccountBinding.ts")).toContain(
      "绑定${PUBLISH_PLATFORM_LABELS[selectedPlatform]}账号",
    );
    expect(matrix).not.toMatch(/一键授权|Chrome\s*插件/);
  });

  it("does not add schema migration or new router procedures", () => {
    const journal = read("drizzle/meta/_journal.json");
    expect(journal).not.toContain("profile_ux");
    expect(read("server/routers.ts")).not.toContain("profileUx");
  });

  it("keeps industry pain options linked", () => {
    expect(read("client/src/components/enterpriseProfile/CustomerScenarioSection.tsx")).toContain("getPainOptionsForIndustry");
  });
});
