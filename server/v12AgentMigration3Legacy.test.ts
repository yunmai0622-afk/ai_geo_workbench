import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasLegacyChromeExtensionSource } from "./legacyExtensionTestGuard";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

const mainUiFiles = [
  "client/src/pages/WeeklyContentPage.tsx",
  "client/src/components/PlatformAccountBindingSection.tsx",
  "client/src/components/LocalAgentDownloadCard.tsx",
  "client/src/pages/V12FlowPages.tsx",
  "client/src/pages/AssetCenter.tsx",
];

describe("Agent-Migration-3 legacy cleanup", () => {
  it("main UI has no Chrome extension primary copy", () => {
    const blob = mainUiFiles.map(read).join("\n");
    expect(blob).not.toMatch(/Chrome\s*插件|浏览器插件|重载插件|下载插件|安装插件|插件版本|插件核验|一键授权/);
    expect(blob).not.toContain("browser-extension.zip");
    expect(blob).not.toContain("downloadExtension");
  });

  it("main UI promotes local agent client", () => {
    const blob = mainUiFiles.map(read).join("\n");
    expect(blob).toContain("本地发布客户端");
    expect(blob).toContain("检测客户端");
    expect(read("client/src/components/LocalAgentDownloadCard.tsx")).toContain("download-mac-agent");
  });

  it("README_LEGACY exists and extension source kept when on-tree", () => {
    if (!hasLegacyChromeExtensionSource()) {
      expect(read("server/publishTasksRouter.ts")).toContain("@legacy");
      expect(read("server/publishTasksRouter.ts")).toContain("downloadExtension");
      return;
    }
    expect(existsSync(resolve(root, "content-growth-publish-extension/README_LEGACY.md"))).toBe(true);
    expect(existsSync(resolve(root, "content-growth-publish-extension/manifest.json"))).toBe(true);
    expect(read("content-growth-publish-extension/README_LEGACY.md")).toContain("Local Agent");
  });

  it("downloadExtension API marked legacy not required in client", () => {
    expect(read("server/publishTasksRouter.ts")).toContain("@legacy");
    expect(read("server/publishTasksRouter.ts")).toContain("downloadExtension");
    expect(mainUiFiles.map(read).join("")).not.toContain("publishTasks.downloadExtension");
  });

  it("publish status labels keep historical pending label", () => {
    expect(read("shared/publishTaskErrors.ts")).toContain("历史");
    expect(read("shared/publishTaskErrors.ts")).toContain("pending_agent");
  });
});
