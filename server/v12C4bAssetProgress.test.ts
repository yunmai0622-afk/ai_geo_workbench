import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

const FORBIDDEN_UI = [
  "articleId",
  "recordId",
  "projectId",
  "publicUrl",
  "rawAnswer",
  "provider",
  "mock",
  "schema",
  "aiTestResults",
  "JSON",
] as const;

describe("C4-B publish records and progress value display", () => {
  const progress = read("client/src/pages/ProgressPage.tsx");
  const publishSection =
    read("client/src/pages/ContentPublishingCenterPage.tsx") +
    read("client/src/components/publishing/PublishTaskColumnBoard.tsx") +
    read("client/src/components/publishing/LocalAgentStatusCard.tsx") +
    read("client/src/components/publishing/LocalAgentPublishStepsPanel.tsx");

  it("publish center renders Local Agent task board", () => {
    for (const text of [
      "发布执行中心",
      "publish-task-columns",
      "local-agent-status-card",
      "publish-center-steps-panel",
      "updateManualPublishRecord",
      "createManualPublishRecord",
    ]) {
      expect(publishSection).toContain(text);
    }
    expect(publishSection).not.toContain("aiDataTable");
    expect(publishSection).not.toContain("资产发布记录");
  });

  it("legacy progress routes redirect to workspace without mounting ProgressPage", () => {
    const app = read("client/src/App.tsx");
    const redirect = read("client/src/components/LegacyAssetProgressRedirect.tsx");
    expect(app).toContain("LegacyAssetProgressRedirect");
    expect(app).not.toContain("ProgressPage");
    expect(redirect).toContain('buildProjectUrl("/workspace"');
    for (const text of [
      "资产进展总览",
      "内容资产漏斗",
      "inclusionMonitoringRecords",
      "aggregateAiTestEvidence",
    ]) {
      expect(progress).toContain(text);
    }
  });

  it("publish and progress pages do not expose internal field labels in customer copy", () => {
    const progressForbidden = ["articleId", "recordId", "publicUrl", "rawAnswer", "provider", "mock", "schema", "aiTestResults", "JSON"] as const;
    for (const token of progressForbidden) {
      expect(progress).not.toContain(token);
    }
    for (const token of FORBIDDEN_UI) {
      expect(publishSection).not.toContain(`>${token}<`);
    }
    expect(publishSection).not.toContain("localProfileId");
    expect(publishSection).not.toContain("agentLog");
  });
});
