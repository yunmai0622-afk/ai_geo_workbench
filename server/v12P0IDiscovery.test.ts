import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V2.0-P0-I Auto Source Evidence Discovery", () => {
  const schema = read("drizzle/schema.ts");
  const migration = read("drizzle/0066_discovery_candidates.sql");
  const webSearch = read("server/services/webSearchService.ts");
  const discoveryService = read("server/discoveryService.ts");
  const discoveryRouter = read("server/discoveryRouter.ts");
  const routers = read("server/routers.ts");
  const sourcePage = read("client/src/pages/SourceGraphPage.tsx");
  const trustManager = read("client/src/components/enterpriseProfile/TrustEvidenceManager.tsx");
  const panel = read("client/src/components/discovery/DiscoveryCandidatesPanel.tsx");
  const shared = read("shared/discoveryLogic.ts");

  it("schema and migration add discovery_candidates table", () => {
    expect(schema).toContain("discovery_candidates");
    expect(schema).toContain("discoveryCandidateTypeEnum");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `discovery_candidates`");
    expect(migration).toContain("enum('source','trust_evidence')");
    expect(migration).toContain("enum('pending','accepted','ignored')");
  });

  it("webSearchService wraps Tavily with not-configured guard", () => {
    expect(webSearch).toContain("searchWeb");
    expect(webSearch).toContain("SEARCH_PROVIDER_NOT_CONFIGURED");
    expect(webSearch).toContain("api.tavily.com/search");
    expect(webSearch).not.toContain("VITE_");
  });

  it("discovery service and router expose required endpoints with project isolation", () => {
    expect(discoveryService).toContain("discoverSources");
    expect(discoveryService).toContain("discoverTrustEvidence");
    expect(discoveryService).toContain("listDiscoveryCandidates");
    expect(discoveryService).toContain("acceptDiscoveryCandidate");
    expect(discoveryService).toContain("ignoreDiscoveryCandidate");
    expect(discoveryService).toContain("eq(discoveryCandidates.projectId, projectId)");
    expect(discoveryRouter).toContain("discoverSources");
    expect(discoveryRouter).toContain("discoverTrustEvidence");
    expect(discoveryRouter).toContain("getProviderStatus");
    expect(discoveryService).toContain('return runDiscovery(db, projectId, "trust_evidence", queries);');
    expect(discoveryRouter).toContain("listCandidates");
    expect(discoveryRouter).toContain("acceptCandidate");
    expect(discoveryRouter).toContain("ignoreCandidate");
    expect(discoveryRouter).toContain("requireProjectAccess");
    expect(routers).toContain("discovery: discoveryRouter");
  });

  it("query generation covers source and trust evidence templates", () => {
    expect(shared).toContain("buildSourceDiscoveryQueries");
    expect(shared).toContain("buildTrustEvidenceDiscoveryQueries");
    expect(shared).toContain("知乎");
    expect(shared).toContain("客户案例");
    expect(shared).toContain("classifySourceRecordType");
    expect(shared).toContain("classifyTrustEvidenceRecordType");
  });

  it("pages embed auto-discovery panels with accept and ignore actions", () => {
    expect(sourcePage).toContain("DiscoveryCandidatesPanel");
    expect(sourcePage).toContain("AI 自动发现信源");
    expect(sourcePage).toContain("开始发现信源");
    expect(sourcePage).toContain("手动添加信源");
    expect(trustManager).toContain("DiscoveryCandidatesPanel");
    expect(trustManager).toContain("AI 自动发现信任证据");
    expect(trustManager).toContain("开始发现证据");
    expect(trustManager).toContain("手动添加证据");
    expect(panel).toContain("discovery-not-configured");
    expect(panel).toContain("getProviderStatus.useQuery(providerQueryInput");
    expect(panel).toContain("discoverTrustEvidence.useMutation()");
    expect(panel).toContain("discovery-accept-");
    expect(panel).toContain("discovery-ignore-");
  });
});
