import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1 P0 consolidate regressions", () => {
  it("publish center normalizes API arrays without blocking load-error banner", () => {
    const page = read("client/src/pages/ContentPublishingCenterPage.tsx");
    expect(page).toContain("contentPublishingSafeData");
    expect(page).toContain("asArray");
    expect(page).toContain("PUBLISH_QUEUE_EMPTY_LABELS");
    expect(page).not.toContain("publish-center-load-failed");
    expect(page).not.toContain("发布任务暂时无法加载，请稍后重试");
    expect(page).toContain("useMemo");
  });

  it("enterprise profile loads failures silently without red banner", () => {
    const page = read("client/src/pages/AssetCenter.tsx");
    expect(page).toContain("enterpriseProfileLoadDisplay");
    expect(page).toContain("profileSaveFailureMessage");
    expect(page).not.toContain("enterprise-profile-core-load-failed");
    expect(page).not.toContain("enterprise-profile-summary-load-hint");
    expect(page).not.toContain("border-red-200 bg-red-50");
  });

  it("client dashboard uses stage CTA labels and mention rate display", () => {
    const page = read("client/src/pages/ClientDashboardPage.tsx");
    expect(page).toContain("buildStageActionUrl");
    expect(page).toContain("formatClientProjectMentionRate");
    expect(page).toContain("未实测");
    expect(page).not.toContain('formatBrandMentionRate(project.t0BrandMentionRate)');
  });

  it("sidebar keeps P0 main-chain only", () => {
    const layout = read("client/src/components/DashboardLayout.tsx");
    expect(layout).not.toContain('label: "项目工作台"');
    for (const forbidden of ["资产进展", "客户交付", "有效动作", "内容模板库", "Chrome"]) {
      expect(layout).not.toContain(`label: "${forbidden}"`);
    }
    expect(layout).toContain('label: "问题库"');
  });
});
