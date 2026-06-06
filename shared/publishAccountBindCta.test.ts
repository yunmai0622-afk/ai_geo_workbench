import { describe, expect, it } from "vitest";
import {
  publishAccountBindCtaLabel,
  resolvePublishAccountBindCtaState,
} from "./publishAccountBindCta";

describe("resolvePublishAccountBindCtaState", () => {
  it("已绑定账号时返回 bound", () => {
    expect(
      resolvePublishAccountBindCtaState({
        localAgentConnectionStatus: "CONNECTED",
        localAgentConnectedOnline: true,
        boundPublishAccountCount: 2,
      }),
    ).toBe("bound");
  });

  it("本地客户端未连接时返回 not_connected", () => {
    expect(
      resolvePublishAccountBindCtaState({
        localAgentConnectionStatus: "DISCONNECTED",
        localAgentConnectedOnline: false,
        boundPublishAccountCount: 0,
      }),
    ).toBe("not_connected");
  });

  it("已连接但账号未同步时返回 not_synced", () => {
    expect(
      resolvePublishAccountBindCtaState({
        localAgentConnectionStatus: "CONNECTED_ACCOUNT_NOT_SYNCED",
        localAgentConnectedOnline: true,
        boundPublishAccountCount: 0,
      }),
    ).toBe("not_synced");
  });

  it("已连接但无平台账号时返回 not_bound", () => {
    expect(
      resolvePublishAccountBindCtaState({
        localAgentConnectionStatus: "CONNECTED",
        localAgentConnectedOnline: true,
        boundPublishAccountCount: 0,
      }),
    ).toBe("not_bound");
  });
});

describe("publishAccountBindCtaLabel", () => {
  it("各状态对应正确文案", () => {
    expect(publishAccountBindCtaLabel("not_connected")).toBe("检测客户端连接");
    expect(publishAccountBindCtaLabel("not_synced")).toBe("刷新账号状态");
    expect(publishAccountBindCtaLabel("not_bound")).toBe("绑定发布账号");
    expect(publishAccountBindCtaLabel("bound")).toBe("查看可发布账号");
  });
});
