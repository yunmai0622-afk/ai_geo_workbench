import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1-UI-P1-A Profile-Shell-Compatibility", () => {
  const asset = read("client/src/pages/AssetCenter.tsx");
  const basic = read("client/src/components/enterpriseProfile/FiveMinuteBasicOnboardingSection.tsx");

  it("5 分钟建档首屏与主按钮", () => {
    expect(asset).toContain("用 5 分钟补齐");
    expect(asset).toContain("用 5 分钟补齐 AI 理解企业所需的核心信息");
    expect(asset).toContain("建档完成度");
    expect(asset).toContain("ProfileAiUnderstandingPreview");
    expect(asset).toContain("save-profile-start-diagnosis");
    expect(asset).toContain("保存并开始 AI 实测诊断");
    expect(asset).toContain('buildProjectUrl("/ai-diagnosis"');
  });

  it("不与统一顶栏重复的企业头", () => {
    expect(asset).not.toContain("enterprise-profile-current-project-header");
    expect(asset).not.toContain("AiPageHero");
    expect(asset).not.toContain("BusinessPageProjectHeader");
  });

  it("8 项核心建档字段", () => {
    for (const label of [
      "企业名称",
      "一句话介绍",
      "所属行业",
      "核心产品 / 服务",
      "目标客户",
      "主要解决的问题",
      "核心优势",
      "希望被 AI 推荐的关键词",
    ]) {
      expect(basic).toContain(label);
    }
    const count = (basic.match(/testId="p0-field-/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(8);
    expect(count).toBeLessThanOrEqual(10);
  });

  it("发布环境轻提示、高级素材默认折叠", () => {
    const hint = read("client/src/components/enterpriseProfile/ProfilePublishEnvLightHint.tsx");
    expect(asset).toContain("ProfilePublishEnvLightHint");
    expect(hint).toContain("发布环境未配置不影响建档");
    expect(hint).toContain("稍后去平台适配发布");
    expect(read("client/src/components/enterpriseProfile/AdvancedMaterialsSection.tsx")).toContain(
      "advanced-materials-collapsed",
    );
  });

  it("保留 upsertProfile 保存能力", () => {
    expect(asset).toContain("upsertProfile.mutateAsync");
    expect(asset).toContain("basePayloadWithExtras");
  });

  it("不暴露工程字段", () => {
    expect(asset).not.toMatch(/projectId[：:]\s*["'{]/);
    expect(asset).not.toContain("ownerUserId");
    expect(asset).not.toContain("rawAnswer");
  });
});
