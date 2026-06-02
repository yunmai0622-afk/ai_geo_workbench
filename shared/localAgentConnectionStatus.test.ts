import { describe, expect, it } from "vitest";
import {
  localAgentConnectionCopy,
  localAgentConnectionRiskHint,
  resolveConnectionStatusAfterHealthProbe,
} from "./localAgentConnectionStatus";
import { buildWorkspacePublishRiskHints } from "./publishReadiness";

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
});
