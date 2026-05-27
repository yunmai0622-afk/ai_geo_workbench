import { describe, expect, it } from "vitest";
import { isPendingAccountDisplayName } from "./localAgentAccountSync";
import { matchPlatformAccountNames } from "./platformAccountVerify";

describe("platformAccountVerify nickname gate", () => {
  it("昵称待识别占位名不参与昵称比对阻断", () => {
    const r = matchPlatformAccountNames("昵称待识别", "任意检测名");
    expect(r.matched).toBe(true);
    expect(r.status).toBe("matched");
  });

  it("真实昵称不一致仍判定 mismatched", () => {
    const r = matchPlatformAccountNames("企业绑定账号A", "企业绑定账号B");
    expect(r.matched).toBe(false);
    expect(r.status).toBe("mismatched");
  });

  it("isPendingAccountDisplayName 识别待识别文案", () => {
    expect(isPendingAccountDisplayName("昵称待识别")).toBe(true);
    expect(isPendingAccountDisplayName("知乎账号（昵称待识别）")).toBe(true);
    expect(isPendingAccountDisplayName("真实昵称")).toBe(false);
  });
});
