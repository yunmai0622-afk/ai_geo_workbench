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

function slicePublishPage(flow: string): string {
  const start = flow.indexOf("export function ContentPublishingFlowPage");
  const end = flow.indexOf("export function InclusionMonitoringFlowPage");
  if (start < 0 || end < 0) return flow;
  return flow.slice(start, end);
}

describe("C4-B publish records and progress value display", () => {
  const progress = read("client/src/pages/ProgressPage.tsx");
  const flow = read("client/src/pages/V12FlowPages.tsx");
  const publishSection = slicePublishPage(flow);

  it("publish records render as AI search asset records", () => {
    for (const text of [
      "资产发布记录",
      "发布资产概览",
      "平台分布",
      "发布记录列表",
      "下一步发布动作",
      "查看文章",
      "retestHintForRecord",
    ]) {
      expect(publishSection).toContain(text);
    }
    expect(publishSection).toContain("aiMetricCard");
    expect(publishSection).not.toContain("aiDataTable");
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

  it("publish and progress pages do not expose internal field labels", () => {
    const progressForbidden = ["articleId", "recordId", "publicUrl", "rawAnswer", "provider", "mock", "schema", "aiTestResults", "JSON"] as const;
    for (const token of progressForbidden) {
      expect(progress).not.toContain(token);
    }
    for (const token of FORBIDDEN_UI) {
      expect(publishSection).not.toContain(`"${token}"`);
      expect(publishSection).not.toContain(`'${token}'`);
      expect(publishSection).not.toContain(`>${token}<`);
    }
  });
});
