import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1 publish account health check", () => {
  it("publish center refreshes account health on user action without auto-run on open", () => {
    const page = read("client/src/pages/ContentPublishingCenterPage.tsx");
    const hook = read("client/src/hooks/usePublishAccountHealthCheck.ts");
    const alert = read("client/src/components/publishing/PublishAccountSessionAlert.tsx");
    const shared = read("shared/publishAccountHealthCheck.ts");
    const publishUi =
      page +
      read("client/src/components/publishing/PublishStatusBar.tsx") +
      read("client/src/components/publishing/PublishAssistantPanel.tsx");

    expect(page).toContain("usePublishAccountHealthCheck");
    expect(page).toContain("runAccountHealthCheck");
    expect(page).toContain("refreshAgentHealth");
    expect(publishUi).toContain("刷新账号状态");
    expect(page).not.toContain("PublishAccountSessionAlert");
    expect(hook).not.toContain("useEffect");
    expect(hook).toContain("detectLocalAgentAccount");
    expect(hook).toContain("syncLocalAgentSnapshot");
    expect(alert).toContain("publish-account-session-alert");
    expect(alert).toContain("重新登录");
    expect(shared).toContain("lastLoginAt");
    expect(shared).toContain("collectExpiredPublishAccounts");
  });

  it("sync preserves lastLoginAt as last valid time on active bind", () => {
    const accounts = read("server/projectPlatformAccounts.ts");
    expect(accounts).toContain("lastLoginAt: sessionStatus === \"active\" ? now : null");
  });
});
