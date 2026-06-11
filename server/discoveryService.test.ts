import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDiscoveryProviderStatus } from "./discoveryService";
import { isWebSearchConfigured } from "./services/webSearchService";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("discoveryService provider parity", () => {
  const discoveryService = read("server/discoveryService.ts");

  it("discoverSources and discoverTrustEvidence share runDiscovery and webSearchService", () => {
    expect(discoveryService).toContain("async function runDiscovery(");
    expect(discoveryService).toContain('return runDiscovery(db, projectId, "source", queries);');
    expect(discoveryService).toContain('return runDiscovery(db, projectId, "trust_evidence", queries);');
    expect(discoveryService).toContain("searchWeb(query, 3)");
    expect(discoveryService).toContain("isWebSearchConfigured()");
  });

  it("getDiscoveryProviderStatus uses the same Tavily key probe as mutations", () => {
    const sourceStatus = getDiscoveryProviderStatus("source");
    const trustStatus = getDiscoveryProviderStatus("trust_evidence");
    const globalStatus = getDiscoveryProviderStatus();

    expect(sourceStatus.configured).toBe(isWebSearchConfigured());
    expect(trustStatus.configured).toBe(isWebSearchConfigured());
    expect(globalStatus.configured).toBe(isWebSearchConfigured());
    expect(sourceStatus.configured).toBe(trustStatus.configured);
  });

  it("returns trust-evidence specific copy when Tavily is missing", () => {
    if (isWebSearchConfigured()) return;
    const trustStatus = getDiscoveryProviderStatus("trust_evidence");
    expect(trustStatus.message).toContain("信任证据");
  });
});
