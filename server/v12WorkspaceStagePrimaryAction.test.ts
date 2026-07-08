import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveWorkspaceStagePrimaryAction } from "@shared/workspacePrimaryAction";

const root = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf-8");

describe("GEO-V2.0-UX-Followup-Stage-CTA-Nav", () => {
  it("工作台主按钮收敛为客户服务首页的唯一下一步", () => {
    const page = read("client/src/pages/EnterpriseWorkspacePage.tsx");
    expect(page).not.toContain("resolveWorkspaceStagePrimaryAction");
    expect(page).toContain("customerConclusion");
    expect(page).toContain("customerMainCta");
    expect(page).toContain('label: "查看本月服务计划"');
    expect(page).toContain("workspace-current-stage-headline");
    expect(page).toContain("workspace-primary-cta");
  });

  it("四条优先级规则文案与路径一致", () => {
    const rules = read("shared/workspacePrimaryAction.ts");
    const clientRules = read("shared/clientProjectCardPrimaryAction.ts");
    for (const text of [
      "完成品牌建档",
      "品牌建档期",
      "AI 现状检测",
      "开始 AI 现状检测",
      "生成本月优化计划",
      "继续执行本月计划",
    ]) {
      expect(rules + clientRules).toContain(text);
    }
  });

  it("建档未完成时工作台与客户卡片均引导完成品牌建档", () => {
    const action = resolveWorkspaceStagePrimaryAction({
      profileCompletionPercent: 50,
      hasCompletedT0Baseline: false,
      articleCount: 0,
      pendingPublishContentCount: 0,
      publishRecordCount: 0,
      publishTaskCount: 0,
      lowQualityArticleCount: 0,
      rewriteOpenCount: 0,
      maturityTotalScore: null,
    });
    expect(action?.stageHeadline).toBe("品牌建档期");
    expect(action?.ctaLabel).toBe("完成品牌建档");
    expect(action?.ctaPath).toBe("/enterprise-profile");
  });

  it("T0 未完成时不因已有文章误进发布阶段", () => {
    const action = resolveWorkspaceStagePrimaryAction({
      profileCompletionPercent: 85,
      hasCompletedT0Baseline: false,
      articleCount: 4,
      pendingPublishContentCount: 2,
      publishRecordCount: 0,
      publishTaskCount: 0,
      lowQualityArticleCount: 0,
      rewriteOpenCount: 0,
      maturityTotalScore: 80,
    });
    expect(action?.stageHeadline).toBe("AI 现状检测");
    expect(action?.ctaLabel).toBe("开始 AI 现状检测");
    expect(action?.ctaPath).toBe("/ai-diagnosis");
  });

  it("运营工具分组保留 AI 问题池与信源证据库，信任证据由建档第 6 步管理", () => {
    const layout = read("client/src/components/DashboardLayout.tsx");
    expect(layout).not.toContain('label: "信任证据库"');
    expect(layout).toContain('title: "运营工具"');
    expect(layout).toContain('label: "AI 问题池"');
    expect(layout).toContain('label: "信源与证据库"');
    expect(read("client/src/components/enterpriseProfile/TrustEvidenceManager.tsx")).toContain("信任证据库");
  });

  it("workspaceSummary 聚合 pendingReviewCount", () => {
    const summary = read("server/workspaceSummary.ts");
    expect(summary).toContain("pendingReviewCount");
    expect(summary).toContain("isContentReviewPending");
  });
});
