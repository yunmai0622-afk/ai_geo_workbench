import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1 Final P0 consolidate", () => {
  it("publish center normalizes API arrays and shows load failure hint", () => {
    const page = read("client/src/pages/ContentPublishingCenterPage.tsx");
    expect(page).toContain("contentPublishingSafeData");
    expect(page).toContain("publish-center-load-failed");
    expect(page).toContain("发布状态暂时无法加载，请稍后重试");
  });

  it("enterprise profile distinguishes core failure from non-critical summary errors", () => {
    const page = read("client/src/pages/AssetCenter.tsx");
    expect(page).toContain("enterprise-profile-core-load-failed");
    expect(page).toContain("enterprise-profile-summary-load-hint");
    expect(page).not.toContain("{error ?");
  });
});
