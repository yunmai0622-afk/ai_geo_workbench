import { describe, expect, it } from "vitest";
import {
  formatZhihuAccountCardTitle,
  isBlockedZhihuNickname,
  pickZhihuVerifiedNickname,
} from "../local-agent/src/agent/zhihuAccountDisplay";

describe("zhihuAccountDisplay", () => {
  it("屏蔽默认假昵称博丽灵梦", () => {
    expect(isBlockedZhihuNickname("博丽灵梦")).toBe(true);
    const pick = pickZhihuVerifiedNickname([
      { priority: 0, source: "header img[alt]", text: "博丽灵梦" },
    ]);
    expect(pick.displayNameVerified).toBe(false);
    expect(pick.displayName).toBeNull();
  });

  it("候选昵称为广告 → 不视为已验证昵称", () => {
    expect(isBlockedZhihuNickname("广告")).toBe(true);
    const pick = pickZhihuVerifiedNickname([
      { priority: 0, source: "header img[alt]", text: "广告" },
      { priority: 2, source: "profile link", text: "广告" },
    ]);
    expect(pick.displayNameVerified).toBe(false);
    expect(pick.displayName).toBeNull();
  });

  it("可信 profile link 提取成功", () => {
    const pick = pickZhihuVerifiedNickname([
      { priority: 2, source: "profile link", text: "真实用户昵称" },
    ]);
    expect(pick.displayNameVerified).toBe(true);
    expect(pick.displayName).toBe("真实用户昵称");
  });

  it("登录有效但昵称未识别时不显示假名", () => {
    const title = formatZhihuAccountCardTitle("知乎", {
      accountName: "博丽灵梦",
      displayNameVerified: false,
      sessionStatus: "active",
    });
    expect(title).toBe("知乎账号（昵称待识别）");
  });

  it("已验证昵称显示真实名称", () => {
    const title = formatZhihuAccountCardTitle("知乎", {
      accountName: "张三",
      displayNameVerified: true,
      sessionStatus: "active",
    });
    expect(title).toBe("张三");
  });
});
