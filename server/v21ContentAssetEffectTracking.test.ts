import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V2.1-P1 Content Asset Effect Tracking", () => {
  const inclusionPage = read("client/src/pages/InclusionMonitoringCenterPage.tsx");
  const fillPanel = read("client/src/components/inclusion-monitoring/ContentAssetEffectFillPanel.tsx");
  const assistant = read("client/src/components/inclusion-monitoring/InclusionMonitoringAssistantPanel.tsx");
  const shared = read("shared/contentAssetEffectTracking.ts");
  const schema = read("drizzle/schema.ts");
  const migration = read("drizzle/0069_content_asset_effect_tracking.sql");
  const router = read("server/routers.ts");

  it("page title and modules are customer-facing", () => {
    expect(inclusionPage).toContain("内容资产效果");
    expect(inclusionPage).toContain("追踪已发布内容的收录、曝光与 AI 复测价值");
    expect(inclusionPage).toContain('data-testid="inclusion-monitoring-overview"');
    expect(inclusionPage).toContain('data-testid="inclusion-monitoring-content-table"');
    expect(inclusionPage).toContain('data-testid="content-asset-platform-summary"');
    expect(inclusionPage).toContain('data-testid="content-asset-retest-ready"');
    expect(inclusionPage).toContain("已发布内容数");
    expect(inclusionPage).toContain("已收录内容数");
    expect(inclusionPage).toContain("收录率");
    expect(inclusionPage).toContain("可进入AI复测数");
    expect(inclusionPage).toContain("加入AI复测");
    expect(inclusionPage).toContain("收录验证后3天可进入AI复测");
    expect(inclusionPage).not.toContain("effectInclusionStatus");
    expect(inclusionPage).not.toContain("publish_tasks");
    expect(inclusionPage).not.toContain("geo_articles");
    expect(inclusionPage).not.toContain("effectInclusionStatus");
    expect(inclusionPage).not.toContain("undefined");
  });

  it("manual fill panel exposes effect fields", () => {
    expect(fillPanel).toContain("填写效果数据");
    expect(fillPanel).toContain("收录验证关键词");
    expect(fillPanel).toContain("数据来源");
    expect(fillPanel).toContain("updateEffectData");
  });

  it("shared logic computes retest eligibility after 3 days", () => {
    expect(shared).toContain("computeCanEnterAiRetest");
    expect(shared).toContain("RETEST_WAIT_DAYS = 3");
    expect(shared).toContain("pending: \"待收录\"");
    expect(shared).toContain("failed: \"收录失败\"");
  });

  it("schema and migration add effect tracking columns", () => {
    expect(schema).toContain("effectInclusionStatus");
    expect(schema).toContain("inclusionVerifiedAt");
    expect(schema).toContain("readCount");
    expect(schema).toContain("impressionCount");
    expect(migration).toContain("effectInclusionStatus");
    expect(migration).toContain("evidenceScreenshotUrl");
  });

  it("API exposes update and quick mark mutations", () => {
    expect(router).toContain("updateEffectData:");
    expect(router).toContain("markEffectIncluded:");
    expect(router).toContain("markEffectIgnored:");
  });

  it("assistant panel shows effect summary", () => {
    expect(assistant).toContain("内容资产效果摘要");
    expect(assistant).toContain("收录率");
    expect(assistant).toContain("可进入AI复测数");
  });
});
