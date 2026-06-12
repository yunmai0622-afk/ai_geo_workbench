import { describe, expect, it } from "vitest";
import { resolveWorkspaceStagePrimaryAction } from "./workspacePrimaryAction";

const base = {
  hasCompletedT0Baseline: true,
  articleCount: 2,
  pendingPublishContentCount: 1,
  publishRecordCount: 0,
  publishTaskCount: 0,
  lowQualityArticleCount: 0,
  rewriteOpenCount: 0,
  maturityTotalScore: 72,
  pendingReviewCount: 0,
};

describe("resolveWorkspaceStagePrimaryAction", () => {
  it("规则1：未完成 T0 时阶段与按钮一致指向 AI 现状检测", () => {
    const action = resolveWorkspaceStagePrimaryAction({
      ...base,
      hasCompletedT0Baseline: false,
      articleCount: 5,
      pendingPublishContentCount: 3,
    });
    expect(action?.stageHeadline).toBe("AI 现状检测");
    expect(action?.ctaLabel).toBe("开始 AI 现状检测");
    expect(action?.ctaPath).toBe("/ai-diagnosis");
  });

  it("规则2：T0 完成但成熟度未计算或为 0 时指向成熟度页", () => {
    expect(resolveWorkspaceStagePrimaryAction({ ...base, maturityTotalScore: null })?.ctaLabel).toBe(
      "查看 AI 品牌成熟度",
    );
    expect(resolveWorkspaceStagePrimaryAction({ ...base, maturityTotalScore: 0 })?.stageHeadline).toBe(
      "AI 品牌成熟度评估",
    );
    expect(resolveWorkspaceStagePrimaryAction({ ...base, maturityTotalScore: 0 })?.ctaPath).toBe("/maturity");
  });

  it("规则3：成熟度已计算但无内容/待审核/低质/重写时指向内容生产", () => {
    expect(
      resolveWorkspaceStagePrimaryAction({ ...base, articleCount: 0, pendingPublishContentCount: 0 })
        ?.ctaLabel,
    ).toBe("去内容生产工作台");
    expect(
      resolveWorkspaceStagePrimaryAction({ ...base, pendingReviewCount: 2 })?.stageHeadline,
    ).toBe("内容优化期");
    expect(
      resolveWorkspaceStagePrimaryAction({ ...base, lowQualityArticleCount: 1 })?.ctaPath,
    ).toBe("/weekly");
  });

  it("规则4：有可入队内容时阶段与按钮一致指向发布", () => {
    const action = resolveWorkspaceStagePrimaryAction(base);
    expect(action?.stageHeadline).toBe("发布内容到各平台");
    expect(action?.ctaLabel).toBe("去平台适配发布");
    expect(action?.ctaPath).toBe("/content-publishing");
  });

  it("T0 未完成时不应因已有文章误显示发布阶段", () => {
    const action = resolveWorkspaceStagePrimaryAction({
      ...base,
      hasCompletedT0Baseline: false,
      articleCount: 3,
      publishRecordCount: 0,
      publishTaskCount: 0,
    });
    expect(action?.id).toBe("ai_diagnosis");
    expect(action?.stageHeadline).not.toBe("发布内容到各平台");
  });
});
