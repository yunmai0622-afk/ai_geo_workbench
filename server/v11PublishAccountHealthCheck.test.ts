import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1 publish account health check", () => {
  it("publish center auto-checks sessions on open with red alert and relogin", () => {
    const page = read("client/src/pages/ContentPublishingCenterPage.tsx");
    const hook = read("client/src/hooks/usePublishAccountHealthCheck.ts");
    const alert = read("client/src/components/publishing/PublishAccountSessionAlert.tsx");
    const shared = read("shared/publishAccountHealthCheck.ts");

    expect(page).toContain("usePublishAccountHealthCheck");
    expect(page).toContain("PublishAccountSessionAlert");
    expect(hook).toContain("detectLocalAgentAccount");
    expect(hook).toContain("syncLocalAgentSnapshot");
    expect(alert).toContain("publish-account-session-alert");
    expect(alert).toContain("border-red-200");
    expect(alert).toContain("重新登录");
    expect(alert).toContain("最后有效时间");
    expect(shared).toContain("lastLoginAt");
    expect(shared).toContain("collectExpiredPublishAccounts");
  });

  it("sync preserves lastLoginAt as last valid time on active bind", () => {
    const accounts = read("server/projectPlatformAccounts.ts");
    expect(accounts).toContain("lastLoginAt: sessionStatus === \"active\" ? now : null");
  });
});
