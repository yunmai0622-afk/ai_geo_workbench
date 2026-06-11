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
  const questionGuideStep = readProjectFile(
    "client/src/components/enterpriseProfile/wizard/WizardQuestionGuideStep.tsx",
  );
  const wizardSteps = readProjectFile("shared/onboardingWizardSteps.ts");
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
    for (const text of ["品牌名称", "核心产品/服务", "目标客户"]) {
      expect(panels).toContain(text);
    }
    expect(wizardSteps).toContain("客户会怎么问 AI？");
    for (const text of ["客户直接搜你", "客户找同类服务", "客户拿你和竞品对比"]) {
      expect(wizardSteps).toContain(text);
    }
    expect(questionGuideStep).toContain("根据资料生成问题");
    expect(questionGuideStep).toContain("wizard-question-auto-generate");
    expect(panels).toContain("WizardQuestionGuideStep");
    expect(profileUi).toContain("wizard-save-draft");
    expect(profileUi).toContain("wizard-save-and-continue");
    expect(profileUi).toContain("保存并继续");
    expect(profileUi).toContain("完成建档");
    expect(asset).not.toContain("保存企业基础信息");
  });

  it("Step8 提及率/推荐率改为系统建议展示，不再手填", () => {
    expect(panels).toContain("wizard-step8-mention-suggestion");
    expect(panels).toContain("基于最近实测");
    expect(panels).toContain("建议本轮目标：提升至");
    expect(panels).not.toContain("目标提及率 %");
    expect(panels).not.toContain("onFormChange({ targetMentionRate");
    expect(asset).toContain("buildWizardStep8GeoGoalSuggestions");
    expect(asset).toContain("geo.workspace.summary.useQuery");
  });

  it("Step8 剩余字段：平台/竞品/月内容/负责人/备注", () => {
    expect(wizardSteps).toContain("文心一言");
    expect(wizardSteps).not.toMatch(/"文心",/);
    expect(panels).toContain("你最希望在哪些 AI 平台被推荐？");
    expect(panels).toContain("选择本轮重点超越的竞品");
    expect(panels).toContain("请先在 Step5 填写竞品信息");
    expect(panels).toContain("wizard-step8-go-competitor-step");
    expect(panels).toContain("WIZARD_STEP8_MONTHLY_CONTENT_OPTIONS");
    expect(readProjectFile("shared/wizardStep8MonthlyContentCapacity.ts")).toContain("1-3篇（轻量配合）");
    expect(panels).toContain("内部负责人（选填）");
    expect(panels).toContain("其他补充说明（选填）");
    expect(panels).not.toContain("希望超越的竞品");
    expect(panels).not.toContain("每月可配合发布内容数");
    expect(panels).not.toContain("90 天目标备注");
    expect(asset).toContain("monthlyContentCapacityValueFromOptionId");
    expect(asset).toContain("normalizeWizardTargetPlatforms");
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
