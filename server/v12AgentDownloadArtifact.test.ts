import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("Agent-Mac-Zip-Artifact-Guard", () => {
  it("serveStatic must not SPA-fallback missing download artifacts", () => {
    const vite = read("server/_core/vite.ts");
    expect(vite).toContain("registerDownloadArtifactGuard");
    expect(vite).toContain("Download artifact not found");
    expect(vite).toMatch(/DOWNLOAD_ARTIFACT_RE/);
  });

  it("copy script validates mac zip before relative macZipUrl", () => {
    const copy = read("scripts/copy_local_agent_download.mjs");
    expect(copy).toContain("inspectMacZipArtifact");
    expect(copy).toContain("macZipSizeBytes");
    expect(copy).not.toContain("sourceDir");
  });

  it("copy script validates Windows zip and setup exe", () => {
    const copy = read("scripts/copy_local_agent_download.mjs");
    expect(copy).toContain("winZipSha256");
    expect(copy).toContain("winSetupSha256");
    expect(copy).toContain("AGENT_WIN_ZIP_URL");
  });
});
