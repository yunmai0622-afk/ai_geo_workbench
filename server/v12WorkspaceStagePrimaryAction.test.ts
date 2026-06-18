import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveWorkspaceStagePrimaryAction } from "@shared/workspacePrimaryAction";

const root = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf-8");

describe("GEO-V2.0-UX-Followup-Stage-CTA-Nav", () => {
  it("工作台阶段与主按钮共用 resolveWorkspaceStagePrimaryAction", () => {
    const page = read("client/src/pages/EnterpriseWorkspacePage.tsx");
    expect(page).toContain("resolveWorkspaceStagePrimaryAction");
    expect(page).toContain("stagePrimaryAction?.stageHeadline");
    expect(page).toContain("stagePrimaryAction?.ctaLabel");
    expect(page).toContain("workspace-current-stage-headline");
    expect(page).toContain("workspace-primary-cta");
  });

  it("四条优先级规则文案与路径一致", () => {
    const rules = read("shared/workspacePrimaryAction.ts");
    for (const text of [
      "AI 现状检测",
      "开始 AI 现状检测",
      "AI 品牌成熟度评估",
      "查看 AI 品牌成熟度",
      "内容优化期",
      "去内容生产工作台",
      "发布内容到各平台",
      "去平台适配发布",
    ]) {
      expect(rules).toContain(text);
    }
  });

  it("T0 未完成时不因已有文章误进发布阶段", () => {
    const action = resolveWorkspaceStagePrimaryAction({
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

  it("资产管理分组仅保留问题库与品牌信源图谱，信任证据由建档第 6 步管理", () => {
    const layout = read("client/src/components/DashboardLayout.tsx");
    expect(layout).not.toContain('label: "信任证据库"');
    expect(layout).toContain('title: "资产管理"');
    expect(layout).toContain('label: "问题库"');
    expect(layout).toContain('label: "品牌信源图谱"');
    expect(read("client/src/components/enterpriseProfile/TrustEvidenceManager.tsx")).toContain("信任证据库");
  });

  it("workspaceSummary 聚合 pendingReviewCount", () => {
    const summary = read("server/workspaceSummary.ts");
    expect(summary).toContain("pendingReviewCount");
    expect(summary).toContain("isContentReviewPending");
  });
});
