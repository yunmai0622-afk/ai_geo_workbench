import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("GEO V2.3 indexability and content generation optimization", () => {
  it("adds deterministic indexability results to existing quality JSON without schema changes", () => {
    const service = read("server/geoQualityReviewService.ts");
    const schema = read("drizzle/schema.ts");
    expect(service).toContain("evaluateContentIndexability");
    expect(service).toContain("result.indexability");
    expect(schema).not.toContain("indexabilityScore");
  });

  it("forces target question, direct definition, standard expression, FAQ and restrained claims in generation", () => {
    const logic = read("server/geoArticleLogic.ts");
    for (const marker of [
      "GEO 收录与 AI 引用友好硬性要求",
      "首段直接回答",
      "标准品牌表达必须完整出现",
      "增加 3–5 个 FAQ",
      "便于引用的总结",
      "不承诺保证收录",
    ]) expect(logic).toContain(marker);
    expect(logic).not.toContain("标题和文章前两段：不出现品牌名");
  });

  it("shows operator guidance on weekly quality, questions and source graph only", () => {
    expect(read("client/src/components/GeoQualityScore.tsx")).toContain("GEO 收录友好度");
    expect(read("client/src/pages/QuestionsLibraryPage.tsx")).toContain("questions-indexability-guidance");
    expect(read("client/src/pages/SourceGraphPage.tsx")).toContain("source-graph-indexability-guidance");
    expect(read("client/src/pages/EnterpriseWorkspacePage.tsx")).not.toContain("GEO 收录友好度");
  });

  it("keeps honest post-publish advice and scheduled retest intact", () => {
    const report = read("client/src/pages/DeliveryReportsCenterPage.tsx");
    const scheduled = read("server/scheduledSampleRetest.ts");
    for (const marker of ["07/12", "07/16", "07/23", "不承诺 AI 推荐率提升"]) expect(report).toContain(marker);
    expect(scheduled).toContain("SAMPLE_RETEST_PROJECT_ID = 210001");
    expect(scheduled).toContain('dueDate: "2026-07-12"');
  });
});
