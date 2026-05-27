import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { matchPlatformAccountNames } from "@shared/platformAccountVerify";
import { hasLegacyChromeExtensionSource } from "./legacyExtensionTestGuard";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

const describeLegacy = hasLegacyChromeExtensionSource() ? describe : describe.skip;

describe("C7-B project platform account binding", () => {
  it("scopes accounts by projectId in schema and routers", () => {
    expect(read("drizzle/schema.ts")).toContain("project_platform_accounts");
    expect(read("server/projectPlatformAccountsRouter.ts")).toContain("list:");
    expect(read("server/publishTasksRouter.ts")).toContain("expectedAccountName");
    expect(read("server/publishTasksRouter.ts")).toContain("resolvePublishPlatformAccount");
  });

  it("blocks publish when no platform account bound", () => {
    expect(read("server/projectPlatformAccounts.ts")).toContain("publishBlockedNoAccountMessage");
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("publishBlockedNoAccountMessage");
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("publish-readiness-open-accounts");
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("focusLocalAgentAccountsTab");
  });

  it("publish confirm shows project and expected account", () => {
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("selectedProject?.enterpriseName");
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toMatch(/发布账号：|选择发布账号/);
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("加入发布队列");
  });

  describeLegacy("legacy extension verification", () => {
    it("extension verifies account before publish", () => {
      expect(read("content-growth-publish-extension/background.js")).toContain("verifyTaskAccountBeforePublish");
      expect(read("content-growth-publish-extension/content-scripts/accountDetect.js")).toContain("detectZhihuAccountName");
      expect(read("content-growth-publish-extension/background.js")).toContain("[发布核验]");
    });
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
    expect(read("client/src/components/enterpriseProfile/EnterprisePublishEnvironmentSection.tsx")).toContain(
      "PlatformAccountBindingSection",
    );
    expect(read("client/src/components/platformAccounts/usePlatformAccountBinding.ts")).toContain(
      "绑定${PUBLISH_PLATFORM_LABELS[selectedPlatform]}账号",
    );
    expect(read("client/src/pages/AssetCenter.tsx")).toContain("ProfilePublishEnvLightHint");
  });

  it("C7-B-Fix: migration and rollout hints", () => {
    const migration = read("drizzle/0020_project_platform_accounts.sql");
    const schema = read("drizzle/schema.ts");
    expect(migration).toContain("project_platform_accounts");
    expect(migration).toContain("accountVerificationStatus");
    expect(migration).toContain("expectedAccountName");
    expect(schema).toContain("project_platform_accounts");
    expect(schema).toContain("accountVerificationStatus");

    const binding =
      read("client/src/components/PlatformAccountBindingSection.tsx") +
      read("client/src/components/platformAccounts/PlatformAccountMatrix.tsx");
    expect(binding).toContain("本地");
    expect(binding).toContain("PlatformAccountMatrix");
    expect(binding).toContain("LOCAL_AGENT_BASE_URL");
    expect(binding).not.toContain("GEO_START_AUTH");
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("发布任务已发送至本地客户端");
    expect(weekly).toContain("checkLocalAgentHealth");
    expect(weekly).not.toMatch(/Chrome\s*插件|重载插件/);
    expect(read("drizzle/meta/_journal.json")).toContain("0020_project_platform_accounts");
  });
});
