import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Content-Gap-Link", () => {
  it("persists targetQuestionId and targetGapType on geo_articles", () => {
    expect(read("drizzle/schema.ts")).toContain("targetQuestionId");
    expect(read("drizzle/schema.ts")).toContain("targetGapType");
    expect(read("drizzle/0052_geo_articles_target_question_link.sql")).toContain("targetQuestionId");
  });

  it("records gap link on article generate", () => {
    const router = read("server/routers.ts");
    expect(router).toContain("resolveArticleTargetGapLink");
    expect(router).toContain("targetQuestionId: gapLink?.roundQuestionId");
    expect(router).toContain("targetGapType: gapLink?.gapType");
  });

  it("articles list and monitoring expose gap link display", () => {
    expect(read("server/routers.ts")).toContain("enrichArticlesWithGapLink");
    expect(read("server/routers.ts")).toContain("gapLinkDisplay");
    expect(read("server/routers.ts")).toContain("linkedDetectionQuestion");
    expect(read("shared/articleGapLink.ts")).toContain("本文针对缺口：");
  });

  it("content card renders gap link line", () => {
    const card = read("client/src/components/weekly/WeeklyPlatformArticleCard.tsx");
    expect(card).toContain("weekly-card-gap-link");
    expect(card).toContain("gapLinkDisplay");
    expect(card).toContain("weekly-card-mention-rate-change");
  });

  it("inclusion monitoring shows linked question and T1 mention rate", () => {
    const page = read("client/src/pages/InclusionMonitoringCenterPage.tsx");
    expect(page).toContain("inclusion-monitoring-content-table");
    expect(page).toContain("linkedDetectionQuestion");
    expect(page).toContain("关联问题");
    expect(read("server/routers.ts")).toContain("linkedDetectionQuestion");
  });

  it("ai mention check prefers article linked question", () => {
    const router = read("server/routers.ts");
    expect(router).toContain("loadLinkedQuestionTextForArticle");
    const runFn = router.slice(router.indexOf("aiMentionCheck: router"));
    expect(runFn).toContain("loadLinkedQuestionTextForArticle");
  });
});
