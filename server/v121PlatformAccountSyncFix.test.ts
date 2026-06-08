import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  LOCAL_AGENT_ACCOUNT_SYNC_PENDING_DISPLAY_NAME,
  isPendingAccountDisplayName,
  mapStoredSessionToLoginStatus,
  resolveSyncAccountDisplayName,
} from "@shared/localAgentAccountSync";
import {
  MP_NICKNAME_DOM_SELECTORS,
  MP_NICKNAME_FALLBACK_URLS,
  MP_PLATFORM_PENDING_LABEL,
} from "../local-agent/src/agent/platforms/mpAccountNicknameDetect";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-PlatformAccountSyncFix", () => {
  it("已登录但无昵称时 sessionStatus=active 可同步到 Web", () => {
    expect(mapStoredSessionToLoginStatus("active")).toBe("valid");
    expect(resolveSyncAccountDisplayName({ displayName: null })).toBe("账号已登录");
    expect(LOCAL_AGENT_ACCOUNT_SYNC_PENDING_DISPLAY_NAME).toBe("账号已登录");
  });

  it("basePublisher 检测失败不再把 sessionStatus 置 unknown", () => {
    const base = read("local-agent/src/agent/platforms/basePublisher.ts");
    expect(base).toContain('sessionStatus: "active"');
    expect(base).toContain("不影响发布与 Web 同步");
    expect(base).not.toMatch(/未能检测到账号昵称[\s\S]{0,120}sessionStatus:\s*"unknown"/);
  });

  it("百家号使用增强昵称选择器", () => {
    expect(MP_NICKNAME_DOM_SELECTORS.baijiahao).toContain(".user-name");
    expect(MP_NICKNAME_DOM_SELECTORS.baijiahao).toContain('[class*="userName"]');
    const src = read("local-agent/src/agent/platforms/baijiahaoPublisher.ts");
    expect(src).toContain("detectMpPlatformNickname");
  });

  it("各平台昵称选择器已集中定义", () => {
    const nick = read("local-agent/src/agent/platforms/mpAccountNicknameDetect.ts");
    expect(nick).toContain("MP_NICKNAME_PRIORITY_DOM_SELECTORS");
    expect(nick).toContain("MP_NICKNAME_FALLBACK_URLS");
    expect(nick).toContain("isInvalidMpNickname");
    expect(MP_NICKNAME_DOM_SELECTORS.sohu.length).toBeGreaterThan(3);
    expect(MP_NICKNAME_DOM_SELECTORS.baijiahao.length).toBeGreaterThan(5);
    expect(MP_NICKNAME_DOM_SELECTORS.toutiao).toContain('[class*="username"]');
    expect(MP_NICKNAME_DOM_SELECTORS.netease).toContain('[class*="nickname"]');
    expect(MP_NICKNAME_FALLBACK_URLS.sohu?.length).toBeGreaterThan(0);
    expect(MP_PLATFORM_PENDING_LABEL.sohu).toContain("昵称待识别");
  });

  it("mp 发布流在已登录时允许昵称占位继续", () => {
    const mp = read("local-agent/src/agent/platforms/mpPublishExtensions.ts");
    expect(mp).toContain("已登录，账号已登录，继续填稿");
    expect(mp).toContain('stored?.sessionStatus === "active"');
  });

  it("Web 端展示账号已登录占位", () => {
    const display = read("client/src/components/platformAccounts/accountDisplay.ts");
    expect(display).toContain('return "账号已登录"');
    expect(isPendingAccountDisplayName("账号已登录")).toBe(true);
  });
});
