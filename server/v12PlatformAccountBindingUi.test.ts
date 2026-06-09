import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Platform-Account-Binding-UI", () => {
  it("网页端只读展示绑定状态并引导本地客户端", () => {
    const overview = read("client/src/components/platformAccounts/PublishPlatformAccountsOverview.tsx");
    const asset = read("client/src/pages/AssetCenter.tsx");
    const publish = read("client/src/pages/ContentPublishingCenterPage.tsx");
    expect(overview).toContain("管理发布账号");
    expect(overview).toContain("geo.platformAccounts.list");
    expect(overview).toContain("在本地客户端管理账号");
    expect(overview).toContain("LocalAgentDownloadCard");
    expect(overview).not.toContain("bindLocalAgentAccount");
    expect(overview).not.toContain("startBindPublishAccount");
    expect(publish).toContain("PublishPlatformAccountsOverview");
    expect(read("shared/publishPlatformAccountOverview.ts")).toContain("BINDING_PUBLISH_PLATFORMS");
  });
});
