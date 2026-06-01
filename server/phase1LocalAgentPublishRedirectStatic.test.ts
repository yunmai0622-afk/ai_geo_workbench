import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  GEO_WEB_PATH_LEGACY_ASSET_CENTER,
  GEO_WEB_PATH_PLATFORM_ACCOUNTS,
  GEO_WEB_PATH_PUBLISH_RECORDS,
  buildGeoWebUrl,
  buildGeoWebUrlForTarget,
} from "@shared/geoWebPaths";

const root = resolve(import.meta.dirname, "..");

function read(rel: string) {
  return readFileSync(resolve(root, rel), "utf-8");
}

describe("Phase1 Local Agent publish redirect", () => {
  it("buildGeoWebUrl uses valid SPA paths", () => {
    expect(buildGeoWebUrl("http://127.0.0.1:3000", GEO_WEB_PATH_PUBLISH_RECORDS)).toBe(
      "http://127.0.0.1:3000/content-publishing",
    );
    expect(buildGeoWebUrlForTarget("http://localhost:3000/", "platformAccounts")).toBe(
      `http://localhost:3000${GEO_WEB_PATH_PLATFORM_ACCOUNTS}`,
    );
    expect(GEO_WEB_PATH_LEGACY_ASSET_CENTER).toBe("/asset-center");
  });

  it("local-agent opens external browser with canonical paths", () => {
    const main = read("local-agent/src/main.ts");
    const preload = read("local-agent/src/preload.ts");
    const appJs = read("local-agent/src/renderer/app.js");
    const nav = read("local-agent/src/agent/geoWebNavigation.ts");

    expect(main).toContain("shell.openExternal");
    expect(main).toContain("agent:openGeoWeb");
    expect(preload).toContain("openGeoWeb");
    expect(appJs).toContain("openGeoWeb");
    expect(appJs).toContain("publishRecords");
    expect(nav).toContain(GEO_WEB_PATH_PUBLISH_RECORDS);
    expect(nav).not.toContain("/asset-center");
    expect(appJs).not.toMatch(/\/asset-center/);
  });

  it("web fixes legacy asset-center publish bind link", () => {
    const app = read("client/src/App.tsx");
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    const asset = read("client/src/pages/AssetCenter.tsx");

    expect(app).toContain(GEO_WEB_PATH_LEGACY_ASSET_CENTER);
    expect(weekly).toContain('buildProjectUrl("/enterprise-profile"');
    expect(weekly).toContain("#publish-platform-accounts");
    expect(weekly).not.toMatch(/setLocation\("\/asset-center/);
    expect(read("client/src/components/platformAccounts/PublishPlatformAccountsOverview.tsx")).toContain(
      'id="publish-platform-accounts"',
    );
    expect(asset).toContain("publish-platform-accounts");
  });
});
