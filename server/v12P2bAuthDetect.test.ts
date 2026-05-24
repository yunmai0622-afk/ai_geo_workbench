import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("P2-B one-click auth account detect", () => {
  it("manifest contains authBridge content script", () => {
    const manifest = read("content-growth-publish-extension/manifest.json");
    expect(manifest).toContain("content-scripts/authBridge.js");
    expect(manifest).toContain("http://localhost/*");
    expect(manifest).toContain("https://*.manus.space/*");
    expect(manifest).toContain("https://geo.jixingzhijian.com/*");
  });

  it("authBridge file exists", () => {
    expect(existsSync(resolve(root, "content-growth-publish-extension/content-scripts/authBridge.js"))).toBe(true);
    const bridge = read("content-growth-publish-extension/content-scripts/authBridge.js");
    expect(bridge).toContain("GEO_START_AUTH");
    expect(bridge).toContain("GEO_AUTH_RESULT");
    expect(bridge).toContain("startAuthDetect");
  });

  it("background contains startAuthDetect handler", () => {
    const bg = read("content-growth-publish-extension/background.js");
    expect(bg).toContain('message.action === "startAuthDetect"');
    expect(bg).toContain("handleStartAuthDetect");
    expect(bg).toContain("AUTH_HOME_URLS");
    expect(bg).toContain("authDetectResult");
  });

  it("PlatformAccountBindingSection renders 一键授权", () => {
    const ui = read("client/src/components/PlatformAccountBindingSection.tsx");
    expect(ui).toContain("一键授权");
    expect(ui).toContain("GEO_START_AUTH");
    expect(ui).toContain("GEO_AUTH_RESULT");
    expect(ui).toContain("handleStartAuth");
  });

  it("Web page opens add dialog after GEO_AUTH_RESULT success", () => {
    const ui = read("client/src/components/PlatformAccountBindingSection.tsx");
    expect(ui).toContain("setEditOpen(true)");
    expect(ui).toContain("setFormAccountName(accountName)");
    expect(ui).toMatch(/请确认身份和账号组后保存/);
  });

  it("does not change router or schema for P2-B", () => {
    const router = read("server/projectPlatformAccountsRouter.ts");
    expect(router).not.toContain("startAuthDetect");
    const schema = read("drizzle/schema.ts");
    expect(schema).not.toContain("authBridge");
  });

  it("browser-extension.zip exists", () => {
    expect(existsSync(resolve(root, "client/public/browser-extension.zip"))).toBe(true);
  });

  it("accountDetect still supports four binding platforms", () => {
    const detect = read("content-growth-publish-extension/content-scripts/accountDetect.js");
    for (const p of ["zhihu", "baijiahao", "toutiao", "sohu"]) {
      expect(detect).toContain(`case "${p}"`);
    }
    expect(detect).toContain("detectedAccountName");
  });
});
