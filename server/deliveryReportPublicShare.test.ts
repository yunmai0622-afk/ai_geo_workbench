import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { aggregateAiTestEvidence } from "@shared/aiTestEvidence";
import { buildDeliveryReportPublicEvidencePath, buildDeliveryReportPublicPath, mapItemToPublicEvidence } from "@shared/deliveryReportPublicShare";
import {
  assertMonitoringRecordForShareProject,
  generateDeliveryReportShareToken,
  toPublicAiTestAggregate,
} from "./deliveryReportPublicShare";

describe("delivery report public share", () => {
  it("generates unpredictable share tokens", () => {
    const a = generateDeliveryReportShareToken();
    const b = generateDeliveryReportShareToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("builds public path for anonymous route", () => {
    expect(buildDeliveryReportPublicPath("abc123")).toBe("/delivery-reports/public/abc123");
  });

  it("builds public evidence path under share token", () => {
    expect(buildDeliveryReportPublicEvidencePath("tok123", 5, 2)).toBe("/delivery-reports/public/tok123/evidence/5/2");
  });

  it("rejects monitoring record outside shared project", () => {
    expect(() => assertMonitoringRecordForShareProject(2, 1)).toThrow(TRPCError);
    expect(() => assertMonitoringRecordForShareProject(2, 1)).toThrow(/证据链接无效或已失效/);
    expect(() => assertMonitoringRecordForShareProject(1, 1)).not.toThrow();
  });

  it("maps evidence to customer-safe fields only", () => {
    const payload = mapItemToPublicEvidence(
      {
        engine: "doubao",
        engineName: "豆包",
        question: "哪家好用？",
        testedAt: "2026-01-01T00:00:00.000Z",
        answer: "推荐某品牌",
        mentionsBrand: true,
        recommendsBrand: true,
        recommendationRank: 1,
        rawAnswer: "推荐某品牌",
        mentionedBrand: true,
        recommendedBrand: true,
        brandRank: 1,
        citedUrls: ["https://example.com"],
        sentiment: "positive",
        competitorMentions: [],
        parseStatus: "success",
        testStage: "before_publish",
      },
      { brandName: "测试品牌", enterpriseName: "测试企业", competitorConfigured: false },
    );
    const serialized = JSON.stringify(payload);
    for (const forbidden of ["rawAnswer", "taskId", "provider", "mock", "schema", "testStage", "aiTestResults", "projectId"]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(payload.aiAnswerText).toContain("推荐某品牌");
    expect(payload.stageLabel).toBe("发布前测试");
  });

  it("strips internal item list from aggregate payload", () => {
    const agg = aggregateAiTestEvidence([
      {
        monitoringRecordId: 1,
        results: [
          {
            engine: "doubao",
            engineName: "豆包",
            question: "测试问题",
            testedAt: new Date().toISOString(),
            answer: "回答",
            mentionsBrand: true,
            recommendsBrand: false,
            recommendationRank: 2,
            citedUrls: [],
            sentiment: "neutral",
            competitorMentions: [],
            parseStatus: "success",
            testStage: "before_publish",
          },
        ],
      },
    ]);
    const pub = toPublicAiTestAggregate(agg);
    expect(pub.questionCount).toBe(1);
    expect("items" in pub).toBe(false);
    const serialized = JSON.stringify(pub);
    for (const forbidden of ["rawAnswer", "taskId", "provider", "mock", "schema", "testStage", "aiTestResults"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
