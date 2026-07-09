import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_GEO_WEB_BASE_URL,
  LOCAL_AGENT_DEV_SERVER_URL,
  formatGeoServerConnectionError,
  isLegacyDevServerUrl,
  migrateAgentServerUrl,
  resolvePackagedDefaultServerUrl,
} from "@shared/localAgentServerUrl";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf-8");
}

describe("localAgentServerUrl", () => {
  it("development default is localhost", () => {
    expect(resolvePackagedDefaultServerUrl(null, false)).toBe(LOCAL_AGENT_DEV_SERVER_URL);
  });

  it("production default is online GEO Web", () => {
    expect(resolvePackagedDefaultServerUrl(null, true)).toBe(DEFAULT_GEO_WEB_BASE_URL);
  });

  it("migrates legacy 127.0.0.1:3000 in packaged app", () => {
    const r = migrateAgentServerUrl({
      serverUrl: "http://127.0.0.1:3000",
      serverUrlUserConfigured: false,
      isPackaged: true,
    });
    expect(r.migrated).toBe(true);
    expect(r.serverUrl).toBe(DEFAULT_GEO_WEB_BASE_URL);
  });

  it("migrates old Manus default when it was not user configured", () => {
    const r = migrateAgentServerUrl({
      serverUrl: "https://aigeoworkb-kzxhj9uy.manus.space",
      serverUrlUserConfigured: false,
      isPackaged: true,
    });
    expect(r.migrated).toBe(true);
    expect(r.serverUrl).toBe(DEFAULT_GEO_WEB_BASE_URL);
  });

  it("keeps user-configured serverUrl", () => {
    const custom = "https://custom.example.com";
    const r = migrateAgentServerUrl({
      serverUrl: custom,
      serverUrlUserConfigured: true,
      isPackaged: true,
    });
    expect(r.serverUrl).toBe(custom);
  });

  it("formats fetch failed for dev url", () => {
    const { userMessage, diagnosticDetail } = formatGeoServerConnectionError(
      new Error("fetch failed"),
      "http://127.0.0.1:3000",
    );
    expect(userMessage).toContain("本地开发地址");
    expect(diagnosticDetail).toContain("fetch failed");
    expect(userMessage).not.toBe("fetch failed");
  });

  it("manifest includes geoWebBaseUrl", () => {
    const manifest = read("client/public/downloads/manifest.json");
    expect(manifest).toContain("geoWebBaseUrl");
    expect(manifest).toContain("aigeoworkbench00-production.up.railway.app");
  });

  it("agentConfig uses migration and packaged defaults", () => {
    const cfg = read("local-agent/src/agent/agentConfig.ts");
    expect(cfg).toContain("migrateAgentServerUrl");
    expect(cfg).toContain("serverUrlUserConfigured");
    expect(cfg).toContain("readEmbeddedGeoWebBaseUrl");
  });
});

describe("localAgentServerUrl legacy detection", () => {
  it("detects localhost dev urls", () => {
    expect(isLegacyDevServerUrl("http://127.0.0.1:3000")).toBe(true);
    expect(isLegacyDevServerUrl("http://localhost:3000")).toBe(true);
    expect(isLegacyDevServerUrl(DEFAULT_GEO_WEB_BASE_URL)).toBe(false);
  });
});
