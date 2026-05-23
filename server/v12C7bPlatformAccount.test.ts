import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { matchPlatformAccountNames } from "@shared/platformAccountVerify";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C7-B project platform account binding", () => {
  it("scopes accounts by projectId in schema and routers", () => {
    expect(read("drizzle/schema.ts")).toContain("project_platform_accounts");
    expect(read("server/projectPlatformAccountsRouter.ts")).toContain("list:");
    expect(read("server/publishTasksRouter.ts")).toContain("expectedAccountName");
    expect(read("server/publishTasksRouter.ts")).toContain("publishBlockedNoAccountMessage");
  });

  it("blocks publish when no platform account bound", () => {
    expect(read("server/publishTasksRouter.ts")).toContain("getEnabledPlatformAccount");
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("publishBlockedNoAccountMessage");
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("去绑定账号");
  });

  it("publish confirm shows project and expected account", () => {
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("当前企业：");
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("应使用账号：");
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("开始核验并发布");
  });

  it("extension verifies account before publish", () => {
    expect(read("content-growth-publish-extension/background.js")).toContain("verifyTaskAccountBeforePublish");
    expect(read("content-growth-publish-extension/content-scripts/accountDetect.js")).toContain("detectZhihuAccountName");
    expect(read("content-growth-publish-extension/background.js")).toContain("[发布核验]");
  });

  it("account verification blocks mismatched account", () => {
    const r = matchPlatformAccountNames("客户A官方号", "客户B官方号");
    expect(r.matched).toBe(false);
    expect(r.status).toBe("mismatched");
  });

  it("unknown detected account does not continue publishing", () => {
    const r = matchPlatformAccountNames("客户A", null);
    expect(r.matched).toBe(false);
    expect(["login_required", "unknown"]).toContain(r.status);
  });

  it("asset center has platform binding section", () => {
    expect(read("client/src/pages/AssetCenter.tsx")).toContain("PlatformAccountBindingSection");
    expect(read("client/src/components/PlatformAccountBindingSection.tsx")).toContain("平台账号绑定");
  });

  it("C7-B-Fix: migration and rollout hints", () => {
    const migration = read("drizzle/0020_project_platform_accounts.sql");
    const schema = read("drizzle/schema.ts");
    expect(migration).toContain("project_platform_accounts");
    expect(migration).toContain("accountVerificationStatus");
    expect(migration).toContain("expectedAccountName");
    expect(schema).toContain("project_platform_accounts");
    expect(schema).toContain("accountVerificationStatus");

    const binding = read("client/src/components/PlatformAccountBindingSection.tsx");
    expect(binding).toMatch(/重新加载.*插件|最新版发布插件/);
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("核验当前浏览器登录账号");
    expect(weekly).toMatch(/支持.*账号核验.*版本/);
    expect(read("content-growth-publish-extension/manifest.json")).toMatch(/"version": "1\.[12]\.0"/);
    expect(read("drizzle/meta/_journal.json")).toContain("0020_project_platform_accounts");
  });
});
