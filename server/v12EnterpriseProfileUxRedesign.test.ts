import { describe, expect, it } from "vitest";
import { readEnterpriseProfileUi } from "./enterpriseProfileTestBlob";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf-8");

describe("Enterprise-Profile-UX-Redesign 静态验收", () => {
  const asset = readProjectFile("client/src/pages/AssetCenter.tsx");
  const profileUi = readEnterpriseProfileUi();
  const panels = readProjectFile("client/src/components/enterpriseProfile/wizard/WizardStepPanels.tsx");
  const caseLib = readProjectFile("client/src/components/enterpriseProfile/CustomerCaseLibrarySection.tsx");
  const binding =
    readProjectFile("client/src/components/PlatformAccountBindingSection.tsx") +
    readProjectFile("client/src/components/platformAccounts/PlatformAccountMatrix.tsx") +
    readProjectFile("client/src/components/platformAccounts/usePlatformAccountBinding.ts") +
    readProjectFile("client/src/components/platformAccounts/PlatformAccountTable.tsx");
  const downloadCard = readProjectFile("client/src/components/LocalAgentDownloadCard.tsx");

  it("页面标题与 8 步向导首屏", () => {
    expect(profileUi).toContain("GEO 品牌资产建档");
    expect(profileUi).toContain("OnboardingWizardShell");
    expect(profileUi).toContain("wizard-step-nav");
  });

  it("本地客户端下载与账号绑定文案", () => {
    expect(downloadCard).toContain("下载 Mac 客户端");
    expect(downloadCard).toContain("检测客户端");
    expect(binding).toContain("绑定${PUBLISH_PLATFORM_LABELS[selectedPlatform]}账号");
    expect(binding).toContain("账号详情");
    expect(asset).not.toMatch(/下载 Chrome 插件|browser-extension\.zip/);
  });

  it("向导步骤包含核心建档字段", () => {
    for (const text of ["品牌名称", "核心产品/服务", "目标客户", "竞品对比示例"]) {
      expect(panels).toContain(text);
    }
    expect(profileUi).toContain("wizard-save-draft");
    expect(asset).not.toContain("保存企业基础信息");
  });

  it("高级素材折叠与案例库弹窗编辑", () => {
    const advanced = readProjectFile("client/src/components/enterpriseProfile/AdvancedMaterialsSection.tsx");
    expect(asset).toContain("AdvancedMaterialsSection");
    expect(advanced).toContain("advanced-materials-collapsed");
    expect(caseLib).toContain("customer-case-editor-fields");
    expect(asset).not.toContain("保存本条案例");
  });

  it("主视觉不暴露 profileId", () => {
    expect(asset).not.toContain('data-testid="enterprise-profile-step-nav"');
    expect(asset).not.toMatch(/profileId[：:]\s*["'{]/);
  });
});
