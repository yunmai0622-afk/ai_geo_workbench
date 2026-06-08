import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.2-P1-B-Source-Graph-MVP", () => {
  const schema = read("drizzle/schema.ts");
  const migration = read("drizzle/0058_brand_source_graph.sql");
  const router = read("server/brandSourceGraphRouter.ts");
  const routers = read("server/routers.ts");
  const page = read("client/src/pages/SourceGraphPage.tsx");
  const nav = read("client/src/components/DashboardLayout.tsx");
  const shell = read("client/src/components/project/EnterpriseProjectShell.tsx");
  const assistant = read("client/src/components/source-graph/SourceGraphAssistantPanel.tsx");

  it("schema and migration add brand source graph tables", () => {
    expect(schema).toContain("brand_source_records");
    expect(schema).toContain("entity_anchors");
    expect(schema).toContain("isPubliclyAccessible");
    expect(schema).toContain("entity_anchors_project_id_unique");
    expect(migration).toContain("CREATE TABLE `brand_source_records`");
    expect(migration).toContain("CREATE TABLE `entity_anchors`");
  });

  it("brandSourceGraph router exposes CRUD, anchors, scoring and suggestions", () => {
    expect(router).toContain("getBrandSources");
    expect(router).toContain("createBrandSource");
    expect(router).toContain("updateBrandSource");
    expect(router).toContain("deleteBrandSource");
    expect(router).toContain("getEntityAnchors");
    expect(router).toContain("upsertEntityAnchors");
    expect(router).toContain("getConsistencyScore");
    expect(router).toContain("getEnhancementSuggestions");
    expect(router).toContain("filterQuestionsRequiringSourceType");
    expect(routers).toContain("brandSourceGraph: brandSourceGraphRouter");
  });

  it("/source-graph page has four-screen structure and drawer", () => {
    expect(page).toContain("source-graph-page");
    expect(page).toContain("source-graph-overview");
    expect(page).toContain("entity-anchors-card");
    expect(page).toContain("source-graph-list");
    expect(page).toContain("source-graph-suggestions");
    expect(page).toContain("BrandSourceDrawer");
    expect(page).toContain('buildProjectUrl("/weekly"');
  });

  it("sidebar nav and assistant panel are wired", () => {
    expect(nav).toContain("品牌信源图谱");
    expect(nav).toContain('path: "/source-graph"');
    expect(shell).toContain("SourceGraphAssistantPanel");
    expect(assistant).toContain("sidebar-consistency-score");
    expect(assistant).toContain("sidebar-incomplete-count");
    expect(assistant).toContain("sidebar-latest-verified");
    expect(assistant).toContain("sidebar-main-gaps");
    expect(assistant).not.toContain("GeoGrowthSuggestionsPanel");
  });
});
