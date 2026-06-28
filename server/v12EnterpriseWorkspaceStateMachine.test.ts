import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isP0GeoProfileComplete, resolveWorkspaceStage, WORKSPACE_STAGES } from "@shared/workspaceStateMachine";

const root = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf-8");

describe("GEO-V1-C 企业工作台状态机", () => {
  it("/workspace 页面存在并注册路由", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain('path="/workspace"');
    expect(app).toContain("EnterpriseWorkspacePage");
    expect(read("client/src/pages/EnterpriseWorkspacePage.tsx")).toContain("GEO 服务首页");
  });

  it("无 activeProjectId 显示 ProjectContextEmptyState", () => {
    const page = read("client/src/pages/EnterpriseWorkspacePage.tsx");
    expect(page).toContain("ProjectContextEmptyState");
    expect(page).toContain("workspace-empty");
    expect(page).toMatch(/if \(!enabled && !projectsLoading\)/);
    expect(page).toContain("useActiveProjectSelection");
  });

  it("有 projectId 显示当前客户项目与阶段", () => {
    const page = read("client/src/pages/EnterpriseWorkspacePage.tsx");
    expect(page).toContain("workspace-command-center");
    expect(page).toContain("workspace-customer-conclusion");
    expect(page).toContain("workspace-enterprise-name");
    expect(page).toContain("selectedProject?.enterpriseName");
    expect(page).toContain("resolveWorkspaceCustomerStatusLabel");
  });

  it("状态机阶段文案齐全", () => {
    const sm = read("shared/workspaceStateMachine.ts");
    for (const label of [
      "待绑定发布环境",
      "待完成品牌建档",
      "待 AI 现状诊断",
      "待生成内容",
      "待发布",
      "待收录监测",
      "待优化",
      "可生成报告",
    ]) {
      expect(sm).toContain(label);
    }
    expect(WORKSPACE_STAGES.length).toBe(8);
  });

  it("CTA 跳转带 projectId", () => {
    const page = read("client/src/pages/EnterpriseWorkspacePage.tsx");
    expect(page).toContain("workspaceCtaUrl");
    expect(page).toContain("buildProjectUrl");
    expect(page).toContain("workspace-primary-cta");
    expect(read("client/src/pages/ClientDashboardPage.tsx")).toContain('buildProjectUrl("/workspace"');
  });

  it("工作台展示收录监测明细区块", () => {
    const page = read("client/src/pages/EnterpriseWorkspacePage.tsx");
    const section = read("client/src/components/workspace/WorkspaceInclusionMonitoringSection.tsx");
    expect(page).toContain("WorkspaceInclusionMonitoringSection");
    expect(section).toContain("workspace-inclusion-monitoring-section");
    expect(section).toContain("收录监测明细");
    expect(read("shared/workspaceInclusionMonitoring.ts")).toContain("buildWorkspaceInclusionPlatformRows");
  });

  it("展示进度指标且不暴露工程字段", () => {
    const page = read("client/src/pages/EnterpriseWorkspacePage.tsx");
    expect(page).toContain("workspace-customer-core-metric");
    expect(page).toContain("workspace-top-issues");
    expect(page).toContain("workspace-monthly-top3");
    expect(page).toContain("workspace-service-flow");
    expect(page).toContain("workspace-dashboard-overview");
    expect(page).toContain("WorkspaceDashboardOverviewCards");
    expect(page).toContain("workspace-header-card");
    expect(page).toContain("workspace-main-chain-progress");
    for (const label of ["品牌提及率", "内容资产", "GEO 分", "发布记录"]) {
      expect(page).toContain(label);
    }
    for (const label of ["发布次数", "AI提及率", "GEO评分"]) {
      expect(read("client/src/components/project/WorkspaceDashboardOverviewCards.tsx")).toContain(label);
    }
    expect(page).toContain("resolveMainChainSteps");
    expect(page).not.toContain("localAgentId");
    expect(page).not.toContain("rawJson");
    expect(page).not.toContain("profileId");
  });

  it("服务端 workspace.summary 按 projectId 聚合", () => {
    expect(read("server/routers.ts")).toContain("workspace:");
    expect(read("server/routers.ts")).toContain("fetchWorkspaceSummaryMetrics");
    expect(read("server/workspaceSummary.ts")).toContain("projectId");
    expect(read("server/workspaceSummary.ts")).toContain("completedPublishTaskCount");
    expect(read("server/workspaceSummary.ts")).toContain("retestComparisons");
    expect(read("server/workspaceSummary.ts")).toContain("reports");
    expect(read("server/workspaceSummary.ts")).toContain("pendingReviewCount");
    expect(read("client/src/pages/EnterpriseWorkspacePage.tsx")).toContain("geo.workspace.summary");
  });

  it("不恢复 Chrome 插件、无 mock、无 projects[0]", () => {
    const blob =
      read("client/src/pages/EnterpriseWorkspacePage.tsx") +
      read("server/workspaceSummary.ts") +
      read("shared/workspaceStateMachine.ts");
    expect(blob).not.toMatch(/下载 Chrome 插件|browser-extension\.zip/);
    expect(blob).not.toContain("projects[0]");
    expect(blob).not.toMatch(/\bmock数据\b|fake.*成功/i);
  });

  it("状态机按优先级解析阶段", () => {
    const base = {
      profileCompletionPercent: 80,
      boundPublishAccountCount: 1,
      expiredSessionAccountCount: 0,
      articleCount: 3,
      publishRecordCount: 2,
      publishRecordWithPublicUrlCount: 2,
      waitingPublicLinkCount: 0,
      publishTaskCount: 1,
      completedPublishTaskCount: 1,
      retestPendingCount: 0,
      rewriteOpenCount: 0,
      aiTestResultCount: 5,
      monitoringRecordCount: 2,
      retestComparisonCount: 1,
      reportCount: 0,
      geoScore: 72,
      brandMentionRate: 0.4,
      recommendRate: 0.2,
      lowQualityArticleCount: 0,
      hasAnalysis: true,
      hasGeoScore: true,
      hasCompletedT0Baseline: true,
      hasCompletedT1Retest: false,
      p0ProfileComplete: true,
      localAgentOnline: true,
    };
    expect(resolveWorkspaceStage({ ...base, boundPublishAccountCount: 0 }).currentStageId).toBe("bind_publish_env");
    expect(resolveWorkspaceStage({ ...base, p0ProfileComplete: false }).currentStageId).toBe("complete_geo_profile");
    expect(
      resolveWorkspaceStage({ ...base, hasAnalysis: false, hasGeoScore: false }).currentStageId,
    ).toBe("delivery_report");
    expect(resolveWorkspaceStage({ ...base, articleCount: 0 }).currentStageId).toBe("generate_content");
    expect(
      resolveWorkspaceStage({ ...base, publishRecordCount: 0, publishTaskCount: 0 }).currentStageId,
    ).toBe("publish_content");
    expect(resolveWorkspaceStage({ ...base, retestPendingCount: 2 }).currentStageId).toBe("retest_queue");
    expect(resolveWorkspaceStage({ ...base, rewriteOpenCount: 1 }).currentStageId).toBe("optimize");
  });

  it("P0 建档完整性判断", () => {
    expect(isP0GeoProfileComplete(null)).toBe(false);
    expect(
      isP0GeoProfileComplete({
        brandName: "测试品牌",
        industryTag: "软件",
        oneLiner: "一句话介绍",
        productDesc: "核心产品",
        targetCustomer: "中小企业",
        customerPains: ["获客难"],
        keyPoints: ["交付快"],
        keywords: ["GEO"],
      }),
    ).toBe(true);
  });
});
