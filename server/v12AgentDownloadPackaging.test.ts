import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("Agent-Client-Download-Packaging", () => {
  it("local-agent has package scripts", () => {
    const pkg = read("local-agent/package.json");
    expect(pkg).toContain("package:mac");
    expect(pkg).toContain("package:win");
    expect(pkg).toContain("electron-builder");
  });

  it("Web binding section includes download card", () => {
    const publish =
      read("client/src/components/enterpriseProfile/EnterprisePublishEnvironmentSection.tsx") +
      read("client/src/components/platformAccounts/PlatformAccountMatrix.tsx");
    expect(publish).toContain("LocalAgentDownloadCard");
    expect(read("client/src/components/LocalAgentDownloadCard.tsx")).toContain("download-mac-agent");
    expect(read("client/src/components/LocalAgentDownloadCard.tsx")).toContain("detect-local-agent");
    expect(read("client/src/components/LocalAgentDownloadCard.tsx")).toContain("checkLocalAgentHealth");
    expect(read("client/src/lib/localAgentClient.ts")).toContain("/health");
  });

  it("Mac download files exist in public/downloads", () => {
    const dmg = resolve(root, "client/public/downloads/geo-local-agent-mac.dmg");
    const zip = resolve(root, "client/public/downloads/geo-local-agent-mac.zip");
    expect(existsSync(dmg) || existsSync(zip)).toBe(true);
  });
});
