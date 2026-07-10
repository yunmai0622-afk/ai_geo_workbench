import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("GEO V2.3 delivery flow map", () => {
  const workspace = read("client/src/pages/EnterpriseWorkspacePage.tsx");
  const clients = read("client/src/pages/ClientDashboardPage.tsx");

  it("renders the fixed six-step customer delivery map with navigable destinations", () => {
    expect(workspace).toContain('data-testid="workspace-delivery-flow-map"');
    for (const label of [
      "品牌建档",
      "AI 能见度诊断",
      "月度优化计划",
      "内容生产与发布",
      "收录与 AI 复测",
      "交付报告",
    ]) {
      expect(workspace).toContain(`label: "${label}"`);
    }
    for (const path of [
      "/enterprise-profile",
      "/ai-diagnosis",
      "/monthly-plan",
      "/weekly?mode=content-production",
      "/inclusion-monitoring",
      "/delivery-reports",
    ]) {
      expect(workspace).toContain(path);
    }
  });

  it("keeps sample project 210001 in truthful scheduled retest progress", () => {
    expect(workspace).toContain("selectedProjectId === 210001");
    expect(workspace).toContain("07/12 执行收录初查与 T2 轻量复测。");
    expect(workspace).toContain("已围绕“海豚知道是什么？”完成知乎公开内容建设");
    expect(clients).toContain('project.id === 210001 && project.publishCount > 0');
    expect(clients).toContain('"收录与 AI 复测"');
    expect(clients).toContain('"07/12 收录初查与 T2 轻量复测"');
  });

  it("keeps internal operations secondary and free of technical identifiers", () => {
    expect(workspace).toContain('data-testid="workspace-operator-entry-points"');
    expect(workspace).not.toContain("taskId");
    expect(workspace).not.toContain("sourceType");
  });
});
