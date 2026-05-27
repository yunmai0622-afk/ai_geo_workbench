import { describe, expect, it } from "vitest";
import {
  isBlockedZhihuDisplayName,
  resolveLocalAgentDisplayNameFields,
  ZHIHU_NICKNAME_DENYLIST,
} from "./zhihuNicknameDenylist";

describe("zhihuNicknameDenylist", () => {
  it("denylist includes 广告", () => {
    expect(ZHIHU_NICKNAME_DENYLIST).toContain("广告");
    expect(isBlockedZhihuDisplayName("广告")).toBe(true);
  });

  it("legacy accountName 广告 without verified → displayName null", () => {
    const fields = resolveLocalAgentDisplayNameFields({
      accountName: "广告",
      displayNameVerified: undefined,
    });
    expect(fields.displayNameVerified).toBe(false);
    expect(fields.displayName).toBeNull();
  });

  it("verified true with real name → kept", () => {
    const fields = resolveLocalAgentDisplayNameFields({
      accountName: "真实用户",
      displayNameVerified: true,
    });
    expect(fields.displayNameVerified).toBe(true);
    expect(fields.displayName).toBe("真实用户");
  });
});
