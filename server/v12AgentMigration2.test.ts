import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasLegacyChromeExtensionSource } from "./legacyExtensionTestGuard";

const root = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("Agent-Migration-2 local agent publish main path", () => {
  it("WeeklyContentPage has no Chrome extension main-flow copy", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).not.toMatch(/Chrome\s*插件|重载插件|下载插件|插件版本|插件核验/);
    expect(weekly).not.toContain("downloadExtension");
    expect(weekly).toContain("发布任务已发送至本地客户端");
    expect(weekly).toContain("publishBlockedNoLocalProfileMessage");
    expect(weekly).toContain("publishBlockedSessionExpiredMessage");
    expect(weekly).toContain("getPublishReadyAccountsForPlatform");
    expect(weekly).toContain("checkLocalAgentHealth");
  });

  it("publishTasks.create always pending_agent for binding platforms", () => {
    const router = read("server/publishTasksRouter.ts");
    expect(router).toContain('status: "pending_agent"');
    expect(router).toContain('publishMode: "local_agent"');
    expect(router).not.toContain('status: useLocalAgent ? "pending_agent" : "pending"');
    expect(router).not.toContain('publishMode: useLocalAgent ? ("local_agent"');
    expect(router).toContain("publishBlockedNoLocalProfileMessage");
    expect(router).toContain("publishBlockedSessionExpiredMessage");
    expect(router).toContain('boundAccount.sessionStatus !== "active"');
    expect(router).toContain("platformAccountId == null");
  });

  it.skipIf(!hasLegacyChromeExtensionSource())(
    "extension package exists but weekly does not import extension path",
    () => {
      expect(read("content-growth-publish-extension/manifest.json")).toContain("manifest_version");
      const weekly = read("client/src/pages/WeeklyContentPage.tsx");
      expect(weekly).not.toContain("content-growth-publish-extension");
      expect(weekly).not.toContain("verifyTaskAccountBeforePublish");
    },
  );

  it("C7-A C8-A publish guards preserved", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("blockPublishIfUnsaved");
    expect(weekly).toContain("blockPublishIfQualityReject");
    expect(weekly).toContain("account-group-mismatch-hint");
  });

  it("agent publish does not fake success", () => {
    expect(read("server/agentPublishTasks.ts")).toContain("draft_saved 必须提供");
    expect(read("server/agentPublishTasks.ts")).toContain("completed 状态必须提供 publicUrl");
  });

  it("legacy account hint remains in publish flow copy", () => {
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("旧账号需在企业档案重新绑定");
    const matrix =
      read("client/src/components/platformAccounts/PlatformAccountMatrix.tsx") +
      read("client/src/components/PlatformAccountBindingSection.tsx");
    expect(matrix).not.toMatch(/一键授权|重载插件/);
  });
});
