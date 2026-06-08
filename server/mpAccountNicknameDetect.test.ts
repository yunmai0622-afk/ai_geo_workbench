import { describe, expect, it } from "vitest";
import {
  MP_INVALID_NICKNAME_EXACT,
  MP_NICKNAME_FALLBACK_URLS,
  MP_NICKNAME_PRIORITY_DOM_SELECTORS,
  MP_PLATFORM_PENDING_LABEL,
  extractNicknameFieldsFromJsonValue,
  extractNicknameFromStorageText,
  isInvalidMpNickname,
  parseNicknameFromPageTitle,
  pickFirstValidMpNickname,
  resolveMpAccountDisplayLabel,
} from "../local-agent/src/agent/platforms/mpAccountNicknameDetect";

describe("mpAccountNicknameDetect P0", () => {
  it("搜狐号无效昵称过滤", () => {
    for (const word of ["搜狐号", "创作者中心", "账号环境", "昵称待识别", "  ", ""]) {
      expect(isInvalidMpNickname(word, "sohu")).toBe(true);
    }
    expect(isInvalidMpNickname("GEO测试账号", "sohu")).toBe(false);
    expect(isInvalidMpNickname("头条创作者B", "toutiao")).toBe(false);
  });

  it("百家号从 JSON storage 提取昵称", () => {
    const raw = JSON.stringify({
      userInfo: { displayName: "百家号运营A", authorName: "百家号" },
    });
    expect(extractNicknameFromStorageText(raw, "baijiahao")).toBe("百家号运营A");
  });

  it("头条号从嵌套 JSON 提取昵称", () => {
    const fields = extractNicknameFieldsFromJsonValue(
      { data: { user: { name: "头条创作者B" } } },
      "toutiao",
    );
    expect(pickFirstValidMpNickname(fields, "toutiao")).toBe("头条创作者B");
  });

  it("页面标题解析并过滤平台名", () => {
    expect(parseNicknameFromPageTitle("张三 - 搜狐号自媒体平台", "sohu")).toBe("张三");
    expect(parseNicknameFromPageTitle("百家号-创作者中心", "baijiahao")).toBeNull();
    expect(
      parseNicknameFromPageTitle("头条号后台管理系统首页导航栏超长标题超过二十四字限制", "toutiao"),
    ).toBeNull();
  });

  it("pickFirstValidMpNickname 跳过无效值取下一个", () => {
    expect(
      pickFirstValidMpNickname(["登录", "个人中心", "真实昵称C"], "toutiao"),
    ).toBe("真实昵称C");
  });

  it("resolveMpAccountDisplayLabel fallback 到平台占位文案", () => {
    expect(resolveMpAccountDisplayLabel("sohu", null)).toBe("搜狐号账号（昵称待识别）");
    expect(resolveMpAccountDisplayLabel("baijiahao", "创作者中心")).toBe("百家号账号（昵称待识别）");
    expect(resolveMpAccountDisplayLabel("toutiao", "头条运营D")).toBe("头条运营D");
  });

  it("三平台均有优先级选择器与 fallback URL", () => {
    for (const p of ["sohu", "baijiahao", "toutiao"] as const) {
      expect(MP_NICKNAME_PRIORITY_DOM_SELECTORS[p].length).toBeGreaterThan(3);
      expect(MP_NICKNAME_FALLBACK_URLS[p]?.length).toBeGreaterThan(0);
      expect(MP_PLATFORM_PENDING_LABEL[p]).toContain("昵称待识别");
    }
  });

  it("无效昵称列表包含任务要求项", () => {
    const required = [
      "账号环境",
      "创作者中心",
      "发布平台",
      "个人中心",
      "登录",
      "未登录",
      "进入发布页",
      "搜狐号",
      "百家号",
      "头条号",
      "昵称待识别",
    ];
    for (const word of required) {
      expect(MP_INVALID_NICKNAME_EXACT).toContain(word);
    }
  });
});
