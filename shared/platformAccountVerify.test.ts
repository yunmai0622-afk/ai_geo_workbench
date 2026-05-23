import { describe, expect, it } from "vitest";
import { matchPlatformAccountNames, publishBlockedNoAccountMessage } from "./platformAccountVerify";

describe("platformAccountVerify", () => {
  it("matches equal names case-insensitively", () => {
    const r = matchPlatformAccountNames("海豚知道官方", " 海豚知道官方 ");
    expect(r.matched).toBe(true);
    expect(r.status).toBe("matched");
  });

  it("blocks when detected is empty", () => {
    const r = matchPlatformAccountNames("A企业号", "");
    expect(r.matched).toBe(false);
    expect(r.status).toBe("login_required");
  });

  it("blocks mismatched accounts", () => {
    const r = matchPlatformAccountNames("企业A知乎", "企业B知乎");
    expect(r.matched).toBe(false);
    expect(r.status).toBe("mismatched");
  });

  it("unknown detected does not match loosely", () => {
    const r = matchPlatformAccountNames("AB", "XY");
    expect(r.matched).toBe(false);
  });

  it("no account message includes platform label", () => {
    expect(publishBlockedNoAccountMessage("zhihu")).toContain("知乎");
  });
});
