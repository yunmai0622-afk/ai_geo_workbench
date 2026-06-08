import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("Local agent account sync to web P0", () => {
  const router = read("server/agentRouter.ts");
  const syncSvc = read("server/localAgentAccountSync.ts");
  const sharedSync = read("shared/localAgentAccountSync.ts");
  const weekly = read("client/src/pages/WeeklyContentPage.tsx");
  const localMain = read("local-agent/src/main.ts");

  it("adds sync endpoint and server-side sync service", () => {
    expect(router).toContain("syncAccountStatuses");
    expect(syncSvc).toContain("syncLocalAgentAccountStatuses");
    expect(syncSvc).toContain("bindLocalAgentAccount");
  });

  it("does not include cookie/password/profilePath in payload schema", () => {
    expect(sharedSync).toContain("displayName");
    expect(sharedSync).toContain("loginStatus");
    expect(sharedSync).not.toMatch(/cookie|password|profilePath/i);
  });

  it("publish readiness supports ACCOUNT_STATUS_NOT_SYNCED", () => {
    const readiness = read("shared/publishReadiness.ts");
    expect(readiness).toContain("ACCOUNT_STATUS_NOT_SYNCED");
    expect(readiness).toContain("platformAccount:local_valid");
    expect(readiness).toContain("尚未同步到「");
  });

  it("weekly publish dialog supports refresh when status not synced", () => {
    const connHook = read("client/src/hooks/useLocalAgentConnection.ts");
    const publishing = read("client/src/pages/ContentPublishingCenterPage.tsx");
    expect(weekly).not.toContain("publish-readiness-refresh-status");
    expect(publishing).toContain("useLocalAgentConnection");
    expect(weekly).toContain("useLocalAgentConnection");
    expect(connHook).toContain("listLocalAgentAccountSnapshots");
    expect(weekly).toContain("hydratePublishDialogAgent");
    expect(weekly).toContain("evaluatePublishPreflight");
  });

  it("local agent detect triggers account status sync", () => {
    expect(localMain).toContain("syncAccountAfterDetect");
  });

  it("local agent writes server heartbeat when connected to GEO server", () => {
    const accountSync = read("local-agent/src/agent/accountSync.ts");
    const polling = read("local-agent/src/agent/pollingManager.ts");
    const taskClient = read("local-agent/src/agent/taskClient.ts");
    const connStatus = read("shared/localAgentConnectionStatus.ts");

    expect(accountSync).toContain("syncServerHeartbeatOnConnect");
    expect(accountSync).toContain("agent.syncAccountStatuses");
    expect(polling).toContain("syncServerHeartbeatOnConnect");
    expect(taskClient).toContain("syncServerHeartbeatOnConnect");
    expect(syncSvc).toContain("lastSessionCheckedAt");
    expect(connStatus).toContain("lastSessionCheckedAt");
    expect(connStatus).toContain("localAgentId");
    expect(connStatus).toContain('sessionStatus === "active"');
  });
});

