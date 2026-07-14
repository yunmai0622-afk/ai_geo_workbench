import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  mergeScheduledRetestResults,
  type AiTestEvidenceItem,
} from "@shared/aiTestEvidence";
import {
  assertIndependentRetestModelConfiguration,
  getAiMentionModelConfiguration,
} from "./geoAiMentionCheck";
import { SAMPLE_RETEST_MILESTONES, SAMPLE_RETEST_QUESTIONS } from "./scheduledSampleRetest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf-8");

function evidence(question: string, testedAt: string): AiTestEvidenceItem {
  return {
    engine: "doubao",
    engineName: "豆包",
    question,
    testedAt,
    answer: "真实回答",
    mentionsBrand: false,
    recommendsBrand: false,
    recommendationRank: null,
    rawAnswer: "真实回答",
    mentionedBrand: false,
    recommendedBrand: false,
    brandRank: null,
    citedUrls: [],
    sentiment: "neutral",
    competitorMentions: [],
    parseStatus: "success",
    testStage: "manual_check",
  };
}

describe("GEO V3.0 independent model and T2 readiness", () => {
  it("accepts only a distinct DeepSeek model and exposes safe trace metadata", () => {
    const config = assertIndependentRetestModelConfiguration({
      OPENAI_MODEL: "doubao-endpoint",
      ARK_DEEPSEEK_MODEL_ID: "deepseek-endpoint",
    });
    expect(config.independent).toBe(true);
    expect(config.doubao.source).toBe("OPENAI_MODEL");
    expect(config.deepseek.source).toBe("ARK_DEEPSEEK_MODEL_ID");
    expect(config.doubao.fingerprint).not.toBe(config.deepseek.fingerprint);
  });

  it("fails closed when DeepSeek is missing or reuses the Doubao model", () => {
    expect(() => assertIndependentRetestModelConfiguration({ OPENAI_MODEL: "same" }))
      .toThrow("ARK_DEEPSEEK_MODEL_ID 未配置");
    expect(() => assertIndependentRetestModelConfiguration({
      OPENAI_MODEL: "same",
      ARK_DEEPSEEK_MODEL_ID: "same",
    })).toThrow("与 OPENAI_MODEL 相同");
    expect(getAiMentionModelConfiguration({ OPENAI_MODEL: "same" }).independent).toBe(false);
  });

  it("preserves 07/12 light_t2 evidence when 07/16 formal T2 is written", () => {
    const lightT2 = evidence("07/12", "2026-07-12T12:00:00.000Z");
    const formalT2 = evidence("07/16", "2026-07-16T12:00:00.000Z");
    const merged = mergeScheduledRetestResults(
      [lightT2],
      [formalT2],
      "t2",
      "2026-07-16",
      "2026-07-12",
    );
    expect(merged.map(item => item.scheduledRetestKey)).toEqual(["light_t2", "t2"]);
    expect(merged.map(item => item.question)).toEqual(["07/12", "07/16"]);
  });

  it("keeps the four-question pool and formal T2/T3 schedule", () => {
    expect(SAMPLE_RETEST_QUESTIONS).toHaveLength(4);
    expect(SAMPLE_RETEST_MILESTONES).toMatchObject([
      { key: "light_t2", dueDate: "2026-07-12" },
      { key: "t2", dueDate: "2026-07-16", roundType: "T2_RETEST" },
      { key: "t3", dueDate: "2026-07-23", roundType: "T3_RETEST" },
    ]);
  });

  it("passes the independent model id through workflow and Railway without hardcoding it", () => {
    const scheduled = read(".github/workflows/scheduled-sample-retest.yml");
    const railway = read(".github/workflows/deploy-railway.yml");
    expect(scheduled).toContain("ARK_DEEPSEEK_MODEL_ID: ${{ vars.ARK_DEEPSEEK_MODEL_ID }}");
    expect(railway).toContain("ARK_DEEPSEEK_MODEL_ID: ${{ vars.ARK_DEEPSEEK_MODEL_ID }}");
    expect(railway).toContain("variables.ARK_DEEPSEEK_MODEL_ID");
  });

  it("does not claim independent channels when runtime configuration is incomplete", () => {
    const inclusion = read("client/src/pages/InclusionMonitoringCenterPage.tsx");
    const report = read("client/src/pages/DeliveryReportsCenterPage.tsx");
    expect(inclusion).toContain("已完成多通道 AI 复测，独立模型通道配置待完善");
    expect(report).toContain("已完成多通道 AI 复测，独立模型通道配置待完善");
  });
});
