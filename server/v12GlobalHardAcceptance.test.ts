import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

function loadScanSources() {
  return {
    clients: read("client/src/pages/ClientDashboardPage.tsx"),
    workspace: read("client/src/pages/EnterpriseWorkspacePage.tsx"),
    profile: read("client/src/pages/AssetCenter.tsx"),
    weekly: read("client/src/pages/WeeklyContentPage.tsx"),
    publish:
      read("client/src/pages/ContentPublishingCenterPage.tsx") +
      read("client/src/components/publishing/PublishTaskColumnBoard.tsx"),
    delivery: read("client/src/pages/DeliveryReportsCenterPage.tsx"),
  };
}

const USER_VISIBLE_FORBIDDEN = [
  "ownerUserId",
  "rawAnswer",
  "provider",
  "adapter",
  "mock",
  "JSON.stringify",
  "workspaceStage",
  "下载 Chrome 插件",
  "browser-extension.zip",
  "任务 #",
  "当前企业：",
  "BusinessPageProjectHeader",
  "localProfileId?.slice",
];

describe("Phase5 global hard acceptance scan (static)", () => {
  const sources = loadScanSources();

  for (const [page, source] of Object.entries(sources)) {
    it(`${page} page avoids engineering labels in customer UI`, () => {
      for (const token of USER_VISIBLE_FORBIDDEN) {
        expect(source, `${page} should not contain ${token}`).not.toContain(token);
      }
    });
  }

  it("weekly and publish state no multi-platform single draft on main CTA", () => {
    expect(sources.weekly).toContain("不支持一稿多发");
  });

  it("publish chrome entry is folded only", () => {
    expect(sources.publish).toContain("publish-account-client-fold");
    expect(sources.publish).not.toContain("downloadExtension");
  });

  it("delivery report uses insufficient-data conclusion copy", () => {
    expect(read("client/src/lib/deliveryReportProductDisplay.ts")).toContain(
      "当前数据不足，完成发布后复测后将生成本轮 GEO 增长结论。",
    );
  });

  it("platform account detail dialog hides profileId labels", () => {
    const dialog = read("client/src/components/platformAccounts/PlatformAccountTechnicalDialog.tsx");
    expect(dialog).not.toContain("localProfileId");
    expect(dialog).not.toContain("localAgentId");
    expect(dialog).toContain("账号详情");
  });
});
