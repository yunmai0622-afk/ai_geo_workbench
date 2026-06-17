import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Remove-AssetProgress-Route-P0", () => {
  const layout = read("client/src/components/DashboardLayout.tsx");
  const app = read("client/src/App.tsx");
  const redirect = read("client/src/components/LegacyAssetProgressRedirect.tsx");
  const delivery = read("client/src/pages/DeliveryReportsCenterPage.tsx");
  const weekly = read("client/src/pages/WeeklyContentPage.tsx");
  const pageNextActionSource = read("shared/pageNextActionSuggestion.ts");

  it("左侧菜单不展示资产进展、客户交付、有效动作、内容模板库", () => {
    for (const forbidden of ["资产进展", "客户交付", "有效动作", "内容模板库", "资产进展看板"]) {
      expect(layout).not.toContain(`label: "${forbidden}"`);
    }
    for (const allowed of [
      "企业项目",
      "项目工作台",
      "品牌资产建档",
      "AI 实测诊断",
      "问题库",
      "内容生产工作台",
      "平台适配发布",
      "收录监测",
      "AI 品牌成熟度月报",
      "使用指南",
    ]) {
      expect(layout).toContain(`label: "${allowed}"`);
    }
    expect(layout).toContain('title: "主流程"');
    expect(layout).toContain('title: "资产管理"');
    expect(layout).not.toContain('title: "增长总览"');
  });

  it("旧资产进展路径重定向到工作台或企业项目列表", () => {
    expect(redirect).toContain('buildProjectUrl("/workspace"');
    expect(redirect).toContain('Redirect to="/clients"');
    for (const path of ["/progress", "/asset-progress", "/assets-progress", "/asset-dashboard"]) {
      expect(app).toContain(`path="${path}"`);
      expect(app).toContain("LegacyAssetProgressRedirect");
    }
    expect(app).not.toContain("ProgressPage");
  });

  it("下一步建议文案不含资产进展入口", () => {
    expect(pageNextActionSource).not.toContain("资产进展");
    expect(pageNextActionSource).not.toContain('ctaPath: "/progress"');
  });

  it("交付报告与内容资产页移除有效动作、内容模板库客户入口", () => {
    expect(delivery).not.toContain("有效动作记录");
    expect(delivery).not.toContain("/effective-actions");
    expect(weekly).not.toContain("内容模板库");
    expect(weekly).not.toContain("weekly-open-templates-entry");
  });

  it("主链路页面路由仍注册", () => {
    for (const path of ["/workspace", "/weekly", "/delivery-reports"]) {
      expect(app).toContain(`path="${path}"`);
    }
  });
});
