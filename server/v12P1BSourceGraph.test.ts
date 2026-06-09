import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.2-P1-B-Source-Graph-MVP", () => {
  const schema = read("drizzle/schema.ts");
  const migration58 = read("drizzle/0058_brand_source_graph.sql");
  const migration60 = read("drizzle/0060_source_graph_p1b_extend.sql");
  const router = read("server/brandSourceGraphRouter.ts");
  const service = read("server/brandSourceGraphService.ts");
  const routers = read("server/routers.ts");
  const page = read("client/src/pages/SourceGraphPage.tsx");
  const nav = read("client/src/components/DashboardLayout.tsx");
  const app = read("client/src/App.tsx");
  const shell = read("client/src/components/project/EnterpriseProjectShell.tsx");
  const assistant = read("client/src/components/source-graph/SourceGraphAssistantPanel.tsx");

  it("schema and migration add brand source graph tables", () => {
    expect(schema).toContain("brand_source_records");
    expect(schema).toContain("entity_anchors");
    expect(schema).toContain("entity_consistency_checks");
    expect(schema).toContain("source_enhancement_suggestions");
    expect(schema).toContain("containsBusinessDescription");
    expect(schema).toContain("entity_anchors_project_id_unique");
    expect(migration58).toContain("CREATE TABLE `brand_source_records`");
    expect(migration58).toContain("CREATE TABLE `entity_anchors`");
    expect(migration60).toContain("CREATE TABLE `entity_consistency_checks`");
    expect(migration60).toContain("CREATE TABLE `source_enhancement_suggestions`");
  });

  it("brandSourceGraph router exposes CRUD, checks, metrics, suggestions and content task", () => {
    expect(router).toContain("getBrandSources");
    expect(router).toContain("createBrandSource");
    expect(router).toContain("updateBrandSource");
    expect(router).toContain("deleteBrandSource");
    expect(router).toContain("getEntityConsistencyChecks");
    expect(router).toContain("getPageMetrics");
    expect(router).toContain("getEnhancementSuggestions");
    expect(router).toContain("createContentTaskFromSuggestion");
    expect(service).toContain("syncSourceGraphDerivedData");
    expect(routers).toContain("brandSourceGraph: brandSourceGraphRouter");
  });

  it("/brand-source-graph page has four sections and content task linkage", () => {
    expect(page).toContain("source-graph-page");
    expect(page).toContain("source-graph-overview");
    expect(page).toContain("entity-consistency-section");
    expect(page).toContain("source-graph-list");
    expect(page).toContain("source-graph-suggestions");
    expect(page).toContain("BrandSourceDrawer");
    expect(page).toContain("生成该平台内容");
    expect(page).toContain("buildWeeklyContentEntryUrl");
    expect(page).toContain("source-graph-empty-sources");
    expect(page).toContain("entity-consistency-empty");
    expect(page).toContain("source-graph-suggestions-empty");
  });

  it("sidebar nav, route alias and assistant panel are wired", () => {
    expect(nav).toContain("品牌信源图谱");
    expect(nav).toContain('path: "/brand-source-graph"');
    expect(app).toContain('path="/brand-source-graph"');
    expect(app).toContain('Redirect to="/brand-source-graph"');
    expect(shell).toContain("SourceGraphAssistantPanel");
    expect(assistant).toContain("sidebar-consistency-score");
    expect(assistant).toContain("sidebar-incomplete-count");
    expect(assistant).toContain("sidebar-latest-verified");
    expect(assistant).toContain("sidebar-main-gaps");
  });
});
