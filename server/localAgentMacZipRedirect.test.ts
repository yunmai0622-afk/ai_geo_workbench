import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readMacZipRedirectUrl } from "./localAgentMacZipRedirect";

const root = resolve(__dirname, "..");

describe("localAgentMacZipRedirect", () => {
  it("reads HTTPS macZipUrl from client manifest", () => {
    const url = readMacZipRedirectUrl(root);
    const manifest = JSON.parse(
      readFileSync(resolve(root, "client/public/downloads/manifest.json"), "utf-8"),
    ) as { macZipUrl?: string };
    expect(url).toBe(manifest.macZipUrl);
    expect(url).toContain("geo-local-agent-v1.0.18");
  });

  it("server index registers manifest-driven redirect", () => {
    const index = readFileSync(resolve(root, "server/_core/index.ts"), "utf-8");
    expect(index).toContain("readMacZipRedirectUrl");
    expect(index).toContain("/downloads/geo-local-agent-mac.zip");
  });
});
