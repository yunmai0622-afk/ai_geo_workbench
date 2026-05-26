import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf-8");

describe("Enterprise-Profile-UX-Redesign 静态验收", () => {
  const asset = readProjectFile("client/src/pages/AssetCenter.tsx");
  const publishEnv = readProjectFile("client/src/components/enterpriseProfile/EnterprisePublishEnvironmentSection.tsx");
  const caseLib = readProjectFile("client/src/components/enterpriseProfile/CustomerCaseLibrarySection.tsx");
  const geoPreview = readProjectFile("client/src/components/enterpriseProfile/GeoMaterialPreviewSection.tsx");
  const binding =
    readProjectFile("client/src/components/PlatformAccountBindingSection.tsx") +
    readProjectFile("client/src/components/platformAccounts/PlatformAccountMatrix.tsx") +
    readProjectFile("client/src/components/platformAccounts/usePlatformAccountBinding.ts") +
    readProjectFile("client/src/components/platformAccounts/PlatformAccountTable.tsx");
  const downloadCard = readProjectFile("client/src/components/LocalAgentDownloadCard.tsx");

  it("页面标题与首屏 5 分钟建档", () => {
    expect(asset).toContain("5 分钟 GEO 建档");
    expect(asset).toContain("ProfilePublishEnvLightHint");
    expect(asset.indexOf("<FiveMinuteBasicOnboardingSection")).toBeLessThan(
      asset.indexOf("<EnterprisePublishEnvironmentSection"),
    );
    expect(publishEnv.indexOf("LocalAgentDownloadCard")).toBeLessThan(publishEnv.indexOf("PlatformAccountBindingSection"));
  });

  it("本地客户端下载与账号绑定文案", () => {
    expect(downloadCard).toContain("下载 Mac 客户端");
    expect(downloadCard).toContain("检测客户端");
    expect(binding).toContain("绑定${PUBLISH_PLATFORM_LABELS[selectedPlatform]}账号");
    expect(binding).toContain("账号详情");
    expect(asset).not.toMatch(/下载 Chrome 插件|browser-extension\.zip/);
  });

  it("5 分钟建档包含核心 P0 字段", () => {
    const basic = readProjectFile("client/src/components/enterpriseProfile/FiveMinuteBasicOnboardingSection.tsx");
    for (const text of [
      "企业名称",
      "所属行业",
      "一句话介绍",
      "核心产品 / 服务",
      "目标客户",
      "主要解决的问题",
      "核心优势",
      "希望被 AI 推荐的关键词",
    ]) {
      expect(basic).toContain(text);
    }
    expect(asset).toContain("保存并开始 AI 诊断");
    expect(asset).not.toContain("保存企业基础信息");
  });

  it("高级素材折叠与案例库弹窗编辑", () => {
    const advanced = readProjectFile("client/src/components/enterpriseProfile/AdvancedMaterialsSection.tsx");
    expect(asset).toContain("AdvancedMaterialsSection");
    expect(advanced).toContain("advanced-materials-collapsed");
    expect(caseLib).toContain("customer-case-editor-fields");
    expect(asset).not.toContain("保存本条案例");
  });

  it("AI 理解预览", () => {
    expect(readProjectFile("client/src/components/enterpriseProfile/ProfileAiUnderstandingPreview.tsx")).toContain(
      "AI 理解预览",
    );
    expect(asset).not.toContain("GeoMaterialPreviewSection");
  });

  it("主视觉不暴露 profileId", () => {
    expect(asset).not.toContain('data-testid="enterprise-profile-step-nav"');
    expect(asset).not.toMatch(/profileId[：:]\s*["'{]/);
  });
});
