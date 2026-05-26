import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasLegacyChromeExtensionSource } from "./legacyExtensionTestGuard";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C7-C platform publish adapters", () => {
  it.skipIf(!hasLegacyChromeExtensionSource())("platform adapter blocks when account mismatch via background verify", () => {
    const bg = read("content-growth-publish-extension/background.js");
    expect(bg).toContain("verifyTaskAccountBeforePublish");
    expect(bg).toContain("mismatched");
  });

  it.skipIf(!hasLegacyChromeExtensionSource())("platform adapter blocks when account unknown", () => {
    expect(read("content-growth-publish-extension/background.js")).toContain("无法识别当前登录账号");
  });

  it("publish task uses latest title content cover from router", () => {
    const router = read("server/publishTasksRouter.ts");
    expect(router).toContain("article.title");
    expect(router).toContain("article.markdownContent");
    expect(router).toContain("buildPublishCoverImageUrl");
  });

  it.skipIf(!hasLegacyChromeExtensionSource())("baijiahao adapter reports editor_not_found with step", () => {
    const adapter = read("content-growth-publish-extension/platforms/baijiahao.js");
    expect(adapter).toContain("wait_editor_ready");
    expect(read("content-growth-publish-extension/platforms/common.js")).toContain("editor_not_found");
  });

  it.skipIf(!hasLegacyChromeExtensionSource())("toutiao adapter reports editor_not_found with step", () => {
    expect(read("content-growth-publish-extension/platforms/toutiao.js")).toContain("findEditorInIframes");
    expect(read("content-growth-publish-extension/platforms/toutiao.js")).toContain("fill_content");
  });

  it.skipIf(!hasLegacyChromeExtensionSource())("sohu adapter reports category_required when needed", () => {
    expect(read("content-growth-publish-extension/platforms/sohu.js")).toContain("category_required");
  });

  it("failure message is customer friendly via shared publishTaskErrors", () => {
    expect(read("shared/publishTaskErrors.ts")).toContain("customerMessage");
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("publishTaskStatusCustomerLabel");
  });

  it.skipIf(!hasLegacyChromeExtensionSource())("zhihu adapter still available", () => {
    expect(read("content-growth-publish-extension/platforms/zhihu.js")).toContain("PlatformAdapters.zhihu");
    expect(read("content-growth-publish-extension/platforms/zhihu.js")).toContain(".public-DraftEditor-content");
    expect(read("content-growth-publish-extension/manifest.json")).toContain("platforms/zhihu.js");
  });

  it("supports draft_saved status without marking article published", () => {
    const router = read("server/publishTasksRouter.ts");
    expect(router).toContain('"draft_saved"');
    expect(router).toContain("draftSaved: true");
  });
});
