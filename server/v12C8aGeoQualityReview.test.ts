import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildQualityReviewPrompt } from "./geoQualityPrompt";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C8-A GEO content quality review", () => {
  it("buildQualityReviewPrompt includes six GEO dimensions", () => {
    const { systemPrompt, userPrompt } = buildQualityReviewPrompt({
      title: "测试标题",
      body: "正文",
      brandName: "海豚知道",
      targetQuestion: "如何选择 GEO 工具",
      contentType: "场景指南",
    });
    expect(systemPrompt).toContain("GEO");
    expect(userPrompt).toContain("brand_entity");
    expect(userPrompt).toContain("question_match");
    expect(userPrompt).toContain("ai_citable_structure");
    expect(userPrompt).toContain("case_evidence");
    expect(userPrompt).toContain("competitor_comparison");
    expect(userPrompt).toContain("platform_friendly");
  });

  it("contentQualityReview writes score fields to article", () => {
    const router = read("server/routers.ts");
    const service = read("server/geoQualityReviewService.ts");
    expect(router).toContain("contentQualityReview");
    expect(service).toContain("geoQualityScore");
    expect(service).toContain("geoQualityDetail");
    expect(service).toContain("geoQualityRecommendation");
  });

  it("publish task still includes projectId and expectedAccountName", () => {
    const publishRouter = read("server/publishTasksRouter.ts");
    expect(publishRouter).toContain("projectId: input.projectId");
    expect(publishRouter).toContain("expectedAccountName: boundAccount.accountName");
  });

  it("GeoQualityScore embedded in editor with stale hint", () => {
    expect(read("client/src/components/ArticleAssetEditorSheet.tsx")).toContain("GeoQualityScore");
    expect(read("client/src/components/GeoQualityScore.tsx")).toContain("geo-quality-stale-hint");
    expect(read("drizzle/schema.ts")).toContain("geoQualityStale");
  });

  it("schema has geo quality fields on geo_articles", () => {
    expect(read("drizzle/schema.ts")).toContain("geoQualityScore");
    expect(read("drizzle/0021_geo_quality_review.sql")).toContain("geoQualityScore");
  });
});
