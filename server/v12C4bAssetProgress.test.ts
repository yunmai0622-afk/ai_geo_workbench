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
      "平台适配发布",
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

  it("progress page renders AI search asset progress", () => {
    for (const text of [
      "资产进展看板",
      "资产进展总览",
      "内容资产漏斗",
      "平台覆盖",
      "AI 实测进展",
      "下一轮资产建设重点",
      "品牌提及率",
      "品牌推荐率",
    ]) {
      expect(progress).toContain(text);
    }
    expect(progress).toContain("inclusionMonitoringRecords");
    expect(progress).toContain("aggregateAiTestEvidence");
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
