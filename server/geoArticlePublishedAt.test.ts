import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("GEO-V1.1-Post-Publish-QC publishedAt", () => {
  it("schema and publish paths record geo_articles.publishedAt", () => {
    expect(read("drizzle/schema.ts")).toContain('publishedAt: timestamp("publishedAt")');
    expect(read("drizzle/0047_geo_articles_published_at.sql")).toContain("publishedAt");
    expect(read("server/geoArticlePublishState.ts")).toContain("markGeoArticlePublishedAt");
    expect(read("server/publishTasksRouter.ts")).toContain("markGeoArticlePublishedAt");
    expect(read("server/routers.ts")).toContain("markGeoArticlePublishedAt");
    expect(read("server/articleLifecycleService.ts")).toContain('publishedAt: new Date()');
  });

  it("weekly content card shows published-at label", () => {
    expect(read("client/src/components/weekly/WeeklyPlatformArticleCard.tsx")).toContain("publishedAtLabel");
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("formatArticlePublishedAtSentence");
  });
});
