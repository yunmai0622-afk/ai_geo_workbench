import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasLegacyChromeExtensionSource } from "./legacyExtensionTestGuard";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("P2-B one-click auth account detect", () => {
  it.skipIf(!hasLegacyChromeExtensionSource())("manifest contains authBridge content script", () => {
    const manifest = read("content-growth-publish-extension/manifest.json");
    expect(manifest).toContain("content-scripts/authBridge.js");
    expect(manifest).toContain("http://localhost/*");
    expect(manifest).toContain("https://*.manus.space/*");
    expect(manifest).toContain("https://geo.jixingzhijian.com/*");
  });

  it.skipIf(!hasLegacyChromeExtensionSource())("authBridge file exists", () => {
    const bridge = read("content-growth-publish-extension/content-scripts/authBridge.js");
    const manifest = read("content-growth-publish-extension/manifest.json");
    expect(bridge).toContain("GEO_START_AUTH");
    expect(bridge).toContain("GEO_AUTH_RESULT");
    expect(bridge).toContain("[authBridge] injected");
    expect(bridge).toMatch(/\[\^\/\]\+\\.manus\\.space/);
    expect(bridge).toContain("window.location.origin");
    expect(manifest).toMatch(/"version": "1\.2\.4"/);
    expect(manifest).toContain("https://*.zhihu.com/*");
  });

  it.skipIf(!hasLegacyChromeExtensionSource())("background contains startAuthDetect handler", () => {
    const bg = read("content-growth-publish-extension/background.js");
    expect(bg).toContain('message.action === "startAuthDetect"');
    expect(bg).toContain("handleStartAuthDetect");
    expect(bg).toContain("AUTH_HOME_URLS");
    expect(bg).toContain("authDetectResult");
    expect(bg).toContain("isWebAppUrl");
    expect(bg).toMatch(/\[\^\/\]\+\\.manus\\.space/);
  });

  it("WeeklyContentPage uses local agent publish path not extension UI", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).not.toMatch(/Chrome\s*插件|重载插件|下载插件/);
    expect(weekly).toContain("发布任务已发送至本地客户端");
    expect(weekly).toContain("checkLocalAgentHealth");
  });

  it("platform account matrix uses local agent HTTP not extension auth", () => {
    const ui =
      read("client/src/components/platformAccounts/usePlatformAccountBinding.ts") +
      read("client/src/components/platformAccounts/PlatformAccountMatrix.tsx");
    expect(ui).toContain("bind-publish-account-");
    expect(ui).toContain("checkLocalAgentHealth");
    expect(ui).not.toContain("GEO_START_AUTH");
    expect(ui).not.toContain("一键授权");
  });

  it("Web bind flow opens confirm after local detect", () => {
    const ui =
      read("client/src/components/platformAccounts/usePlatformAccountBinding.ts") +
      read("client/src/components/platformAccounts/PlatformAccountMatrix.tsx");
    expect(ui).toContain("detectLocalAgentAccount");
    expect(ui).toContain("bindLocalAgentAccount");
    expect(ui).toMatch(/我已完成登录，检测账号/);
  });

  it("does not change router or schema for P2-B", () => {
    const router = read("server/projectPlatformAccountsRouter.ts");
    expect(router).not.toContain("startAuthDetect");
    const schema = read("drizzle/schema.ts");
    expect(schema).not.toContain("authBridge");
  });

  it("legacy browser-extension.zip not exposed in main UI", () => {
    const ui = [
      read("client/src/pages/WeeklyContentPage.tsx"),
      read("client/src/components/LocalAgentDownloadCard.tsx"),
      read("client/src/components/PlatformAccountBindingSection.tsx"),
    ].join("\n");
    expect(ui).not.toContain("browser-extension");
    if (!hasLegacyChromeExtensionSource()) {
      expect(read("server/publishTasksRouter.ts")).toContain("@legacy");
      return;
    }
    expect(read("content-growth-publish-extension/README_LEGACY.md")).toContain("Local Agent");
  });

  it.skipIf(!hasLegacyChromeExtensionSource())("accountDetect still supports four binding platforms", () => {
    const detect = read("content-growth-publish-extension/content-scripts/accountDetect.js");
    for (const p of ["zhihu", "baijiahao", "toutiao", "sohu"]) {
      expect(detect).toContain(`case "${p}"`);
    }
    expect(detect).toContain("detectedAccountName");
    expect(detect).toContain("[accountDetect] detectAccount request");
  });

  it.skipIf(!hasLegacyChromeExtensionSource())("background logs 授权助手 startAuthDetect", () => {
    const bg = read("content-growth-publish-extension/background.js");
    expect(bg).toContain("[授权助手] startAuthDetect");
  });
});
