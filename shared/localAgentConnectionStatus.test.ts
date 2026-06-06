import { describe, expect, it } from "vitest";
import {
  inferServerHeartbeatFromPlatformAccounts,
  isLocalAgentResolvedConnected,
  localAgentConnectionCheckFeedback,
  localAgentConnectionCopy,
  localAgentConnectionRiskHint,
  localAgentDownloadCardConnectionDetail,
  LOCAL_AGENT_SERVER_ONLINE_LOCAL_HTTP_FAILED_MESSAGE,
  LOCAL_AGENT_SERVER_ONLINE_READY_MESSAGE,
  resolveConnectionStatusAfterHealthProbe,
  resolveLocalAgentConnectionState,
} from "./localAgentConnectionStatus";
import { buildWorkspacePublishRiskHints } from "./publishReadiness";

const activeAccount = {
  localAgentId: "agent-1",
  localProfileId: "profile-1",
  sessionStatus: "active",
  lastSessionCheckedAt: new Date().toISOString(),
};

describe("localAgentConnectionStatus", () => {
  it("UNKNOWN primary button", () => {
    expect(localAgentConnectionCopy("UNKNOWN").primaryButton).toBe("检测本地客户端连接");
  });

  it("CHECKING title", () => {
    expect(localAgentConnectionCopy("CHECKING").title).toMatch(/正在检测/);
  });

  it("CONNECTED title", () => {
    expect(localAgentConnectionCopy("CONNECTED").title).toBe("本地客户端已连接");
  });

  it("account not synced", () => {
    expect(localAgentConnectionCopy("CONNECTED_ACCOUNT_NOT_SYNCED").primaryButton).toBe("刷新账号状态");
  });

  it("DISCONNECTED", () => {
    expect(localAgentConnectionCopy("DISCONNECTED").title).toBe("未检测到本地客户端");
  });

  it("ERROR troubleshooting", () => {
    expect(localAgentConnectionCopy("ERROR").description).toMatch(/本地 HTTP/);
  });

  it("workspace risk by status", () => {
    expect(
      buildWorkspacePublishRiskHints({
        p0ProfileComplete: true,
        boundPublishAccountCount: 0,
        localAgentConnectionStatus: "UNKNOWN",
      })[0],
    ).toMatch(/尚未检测/);
  });

  it("resolve probe status", () => {
    expect(
      resolveConnectionStatusAfterHealthProbe({
        ok: true,
        accountSnapshotCount: 0,
        boundPublishAccountCount: 1,
      }),
    ).toBe("CONNECTED_ACCOUNT_NOT_SYNCED");
  });

  it("server heartbeat without local HTTP → connected by server", () => {
    const state = resolveLocalAgentConnectionState({
      platformAccounts: [activeAccount],
      localHttpCheckResult: false,
      boundPublishAccountCount: 1,
    });
    expect(state).toBe("CONNECTED_BY_SERVER_HEARTBEAT");
    expect(isLocalAgentResolvedConnected(state)).toBe(true);
    expect(localAgentConnectionCheckFeedback(state, { localHttpCheckResult: false }).kind).toBe(
      "info",
    );
    expect(localAgentConnectionCheckFeedback(state, { localHttpCheckResult: false }).message).toBe(
      LOCAL_AGENT_SERVER_ONLINE_LOCAL_HTTP_FAILED_MESSAGE,
    );
    expect(localAgentConnectionCheckFeedback(state, { localHttpCheckResult: false }).message).not.toMatch(
      /未检测到/,
    );
  });

  it("active server session without recent heartbeat timestamp still online", () => {
    const staleAccount = {
      ...activeAccount,
      lastSessionCheckedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    };
    const state = resolveLocalAgentConnectionState({
      platformAccounts: [staleAccount],
      localHttpCheckResult: false,
      boundPublishAccountCount: 0,
    });
    expect(isLocalAgentResolvedConnected(state)).toBe(true);
    expect(localAgentDownloadCardConnectionDetail({ state, hasCheckedLocalHttp: true })).toBe(
      LOCAL_AGENT_SERVER_ONLINE_READY_MESSAGE,
    );
  });

  it("server heartbeat + local HTTP → confirmed", () => {
    const state = resolveLocalAgentConnectionState({
      platformAccounts: [activeAccount],
      localHttpCheckResult: true,
    });
    expect(state).toBe("CONNECTED_CONFIRMED");
  });

  it("no server state and local HTTP failed → disconnected", () => {
    const state = resolveLocalAgentConnectionState({
      platformAccounts: [],
      localHttpCheckResult: false,
    });
    expect(state).toBe("DISCONNECTED");
    expect(localAgentConnectionCheckFeedback(state).kind).toBe("error");
  });

  it("valid account snapshot implies server sync", () => {
    const state = resolveLocalAgentConnectionState({
      localHttpCheckResult: false,
      localAgentAccountSnapshot: [
        {
          platform: "zhihu",
          profileId: "p1",
          displayName: "昵称待识别",
          displayNameVerified: false,
          loginStatus: "valid",
          lastCheckedAt: new Date().toISOString(),
        },
      ],
    });
    expect(isLocalAgentResolvedConnected(state)).toBe(true);
  });

  it("inferServerHeartbeatFromPlatformAccounts", () => {
    expect(inferServerHeartbeatFromPlatformAccounts([activeAccount]).connected).toBe(true);
    expect(inferServerHeartbeatFromPlatformAccounts([]).connected).toBe(false);
  });

  it("CONNECTED risk hint with bound accounts", () => {
    expect(
      localAgentConnectionRiskHint("CONNECTED", { boundPublishAccountCount: 1 }),
    ).toBeNull();
  });
});
