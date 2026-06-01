import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

const matrix = read("client/src/components/platformAccounts/PlatformAccountMatrix.tsx");
const binding = read("client/src/components/PlatformAccountBindingSection.tsx");
const hook = read("client/src/components/platformAccounts/usePlatformAccountBinding.ts");
const shared = read("shared/platformAccountVerify.ts");
const tabs = read("client/src/components/platformAccounts/PlatformTabs.tsx");
const sidebar = read("client/src/components/platformAccounts/AccountGroupSidebar.tsx");
const constants = read("client/src/components/platformAccounts/constants.ts");
const table = read("client/src/components/platformAccounts/PlatformAccountTable.tsx");
const tech = read("client/src/components/platformAccounts/PlatformAccountTechnicalDialog.tsx");

describe("Enterprise-Account-Matrix-Redesign", () => {
  it("binding platforms include zhihu/sohu/toutiao/baijiahao/netease", () => {
    for (const p of ["zhihu", "sohu", "toutiao", "baijiahao", "netease"]) {
      expect(shared).toContain(`"${p}"`);
    }
  });

  it("matrix UI strings and layout hooks", () => {
    expect(matrix).toContain("平台账号矩阵");
    expect(tabs).toContain("PUBLISH_PLATFORM_LABELS");
    expect(shared).toContain("知乎");
    expect(shared).toContain("搜狐号");
    expect(shared).toContain("头条号");
    expect(shared).toContain("百家号");
    expect(shared).toContain("网易号");
    expect(constants).toContain("全部账号");
    expect(constants).toContain("官方账号组");
    expect(hook).toContain("绑定${PUBLISH_PLATFORM_LABELS[selectedPlatform]}账号");
    expect(shared).toContain("pending_verify");
    expect(tech).toContain("账号详情");
    expect(table).toContain("platform-account-technical");
  });

  it("uses selectedPlatform state, not vertical stack of all platforms", () => {
    expect(hook).toContain("selectedPlatform");
    expect(hook).toContain("filteredAccounts");
    expect(matrix).not.toMatch(/BINDING_PUBLISH_PLATFORMS\.map/);
    expect(binding).toContain("PlatformAccountMatrix");
    expect(binding).not.toMatch(/BINDING_PUBLISH_PLATFORMS\.map/);
  });

  it("hides profileId/localAgentId from main table", () => {
    expect(table).not.toMatch(/profileId|localAgentId/);
    expect(matrix).not.toMatch(/<th[^>]*>.*profileId/);
  });

  it("LocalAgentDownloadCard above matrix when shown", () => {
    const idxCard = matrix.indexOf("LocalAgentDownloadCard");
    const idxMatrix = matrix.indexOf("platform-account-matrix");
    expect(idxCard).toBeGreaterThan(-1);
    expect(idxMatrix).toBeGreaterThan(idxCard);
  });

  it("no Chrome extension copy in matrix flow", () => {
    const blob = matrix + binding + hook;
    expect(blob).not.toMatch(/下载 Chrome 插件|重载插件|browser-extension\.zip|一键授权/);
  });
});
