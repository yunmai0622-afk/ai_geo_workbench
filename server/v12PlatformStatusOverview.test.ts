import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Platform-Status-Overview", () => {
  it("发布页顶部展示本周概览与平台卡片且数据来自文章与账号列表", () => {
    const overviewBar = read("client/src/components/publishing/PublishWeeklyOverviewBar.tsx");
    const cardGrid = read("client/src/components/publishing/PublishPlatformCardGrid.tsx");
    const publish = read("client/src/pages/ContentPublishingCenterPage.tsx");
    const layout = read("shared/publishPageLayout.ts");
    expect(overviewBar).toContain("本周内容概览");
    expect(overviewBar).toContain("上次发布时间");
    expect(cardGrid).toContain("平台发布状态");
    expect(cardGrid).toContain("失败原因");
    expect(layout).toContain("PUBLISH_PAGE_PLATFORM_ORDER");
    expect(layout).toContain("小红书");
    expect(layout).toContain("公众号");
    expect(publish).toContain("PublishWeeklyOverviewBar");
    expect(publish).toContain("PublishPlatformCardGrid");
    expect(publish).toContain("buildWeeklyPublishOverviewStats");
  });
});
