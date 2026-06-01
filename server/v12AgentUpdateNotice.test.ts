import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Agent-Update-Notice", () => {
  it("compares client version against manifest semver", () => {
    const compare = read("shared/localAgentVersionCompare.ts");
    expect(compare).toContain("compareLocalAgentSemver");
    expect(compare).toContain("isLocalAgentClientOutdated");
  });

  it("publish center Local Agent status shows update notice", () => {
    const page = read("client/src/pages/ContentPublishingCenterPage.tsx");
    const card = read("client/src/components/publishing/LocalAgentStatusCard.tsx");
    expect(page).toContain("fetchLocalAgentDownloadManifest");
    expect(page).toContain("isLocalAgentClientOutdated");
    expect(page).toContain("updateNotice");
    expect(card).toContain("local-agent-update-notice");
    expect(card).toContain("有新版本可用，建议更新客户端");
    expect(card).toContain("local-agent-update-download");
  });
});
