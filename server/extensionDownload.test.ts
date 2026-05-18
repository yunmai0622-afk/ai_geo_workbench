import { describe, expect, it } from "vitest";
import AdmZip from "adm-zip";
import { buildCustomExtensionZip } from "./extensionDownload";

describe("buildCustomExtensionZip", () => {
  it("injects auto config into background.js", () => {
    const buf = buildCustomExtensionZip("https://example.com", "testapikey12345678");
    const zip = new AdmZip(buf);
    const bg = zip.getEntry("background.js")?.getData().toString("utf8") ?? "";
    expect(bg).toContain("// 自动配置（安装时生成）");
    expect(bg).toContain("serverUrl: 'https://example.com'");
    expect(bg).toContain("apiKey: 'testapikey12345678'");
    expect(bg).toContain("const PLATFORM_URLS");
  });
});
