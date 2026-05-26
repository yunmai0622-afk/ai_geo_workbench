import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasLegacyChromeExtensionSource } from "./legacyExtensionTestGuard";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

const ui =
  read("client/src/components/PlatformAccountBindingSection.tsx") +
  read("client/src/components/platformAccounts/PlatformAccountMatrix.tsx") +
  read("client/src/components/platformAccounts/usePlatformAccountBinding.ts") +
  read("client/src/components/platformAccounts/PlatformAccountTable.tsx") +
  read("client/src/components/platformAccounts/accountDisplay.ts");

describe("P2-C strict plugin-only platform account binding", () => {
  const svc = read("server/projectPlatformAccounts.ts");
  const router = read("server/projectPlatformAccountsRouter.ts");
  const weekly = read("client/src/pages/WeeklyContentPage.tsx");

  it("does not render manual add or chrome plugin auth", () => {
    expect(ui).not.toContain("手动添加");
    expect(ui).not.toContain("手动录入");
    expect(ui).not.toContain("一键授权");
    expect(ui).not.toContain("GEO_START_AUTH");
    expect(ui).not.toContain("plugin_detected");
  });

  it("renders bind publish account via local agent", () => {
    expect(ui).toContain("bind-publish-account-");
    expect(ui).toContain("checkLocalAgentHealth");
  });

  it("bind dialog accountName is readonly", () => {
    expect(ui).toContain("平台显示昵称");
    expect(ui).toContain("readOnly");
    expect(ui).toContain("保存绑定账号");
  });

  it("plugin_detected create sets verified on server", () => {
    expect(svc).toContain('bindingSource === "plugin_detected"');
    expect(svc).toContain('verificationStatus: fromPlugin ? "verified" : "unknown"');
    expect(router).toContain('z.literal("plugin_detected")');
    expect(router).toContain("detectedAccountName");
    expect(router).toContain("accountName 必须等于 detectedAccountName");
  });

  it("purpose update cannot change accountName", () => {
    expect(svc).toContain("平台显示昵称不可修改");
    expect(router).toContain("purposeOnly");
    expect(ui).toContain("purposeOnly: true");
  });

  it("reverify uses local agent detect", () => {
    expect(ui).toContain("检测登录态");
    expect(ui).toContain("detectLocalAgentAccount");
    expect(svc).toContain("bindLocalAgentAccount");
    expect(ui).toContain("登录有效");
  });

  it("C7-B publish verification still exists", () => {
    expect(weekly).toContain("加入发布队列");
    expect(svc).toContain("verifyPublishTaskAccount");
    if (hasLegacyChromeExtensionSource()) {
      expect(read("content-growth-publish-extension/background.js")).toContain("verifyTaskAccountBeforePublish");
    }
  });

  it("does not save cookie or password", () => {
    expect(ui).toMatch(/不上传 Cookie|不保存密码/);
    expect(ui).not.toContain("secureCredentialRef");
    expect(ui).not.toContain("type=\"password\"");
  });

  it("does not add new router procedures", () => {
    expect(router).not.toContain("createFromPlugin:");
    expect(router).not.toContain("reverify:");
    expect(router).toContain("verify:");
    expect(router).toContain("create:");
    expect(router).toContain("update:");
  });

  it("schema unchanged for binding strict", () => {
    const schema = read("drizzle/schema.ts");
    expect(schema).toContain("project_platform_accounts");
    expect(schema).not.toContain("bindingSource");
  });
});
