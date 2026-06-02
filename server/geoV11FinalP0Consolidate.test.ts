import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1 Final P0 consolidate", () => {
  it("publish center normalizes API arrays without blocking load-error banner", () => {
    const page = read("client/src/pages/ContentPublishingCenterPage.tsx");
    expect(page).toContain("contentPublishingSafeData");
    expect(page).not.toContain("publish-center-load-failed");
    expect(page).not.toContain("发布任务暂时无法加载，请稍后重试");
  });

  it("enterprise profile loads failures silently without red banner", () => {
    const page = read("client/src/pages/AssetCenter.tsx");
    expect(page).toContain("enterpriseProfileLoadDisplay");
    expect(page).toContain("profileSaveFailureMessage");
    expect(page).not.toContain("enterprise-profile-core-load-failed");
    expect(page).not.toContain("enterprise-profile-summary-load-hint");
    expect(page).not.toContain("border-red-200 bg-red-50");
  });
});
