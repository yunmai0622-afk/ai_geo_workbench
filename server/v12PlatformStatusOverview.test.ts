import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Platform-Status-Overview", () => {
  it("发布页顶部展示平台状态总览且数据来自 geo.platformAccounts.list", () => {
    const overview = read("client/src/components/platformAccounts/PlatformStatusOverview.tsx");
    const publish = read("client/src/pages/ContentPublishingCenterPage.tsx");
    const shared = read("shared/publishPlatformStatusOverview.ts");
    expect(overview).toContain("平台状态总览");
    expect(overview).toContain("geo.platformAccounts.list");
    expect(overview).toContain("最近发布时间");
    expect(shared).toContain("人工发布");
    expect(shared).toContain("小红书");
    expect(shared).toContain("公众号");
    expect(publish).toContain("PlatformStatusOverview");
  });
});
