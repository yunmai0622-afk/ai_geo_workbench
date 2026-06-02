import { describe, expect, it } from "vitest";
import {
  resolvePageShellRoute,
  shouldShowPublishBindNav,
  shouldShowPublishBindTopChrome,
} from "./globalNavVisibility";

describe("GEO-V1.1-GlobalNavFix globalNavVisibility", () => {
  it("仅在项目工作台与平台适配发布页展示绑定发布导航", () => {
    expect(shouldShowPublishBindNav("/workspace")).toBe(true);
    expect(shouldShowPublishBindNav("/content-publishing")).toBe(true);
    expect(shouldShowPublishBindNav("/enterprise-profile")).toBe(false);
    expect(shouldShowPublishBindNav("/ai-diagnosis")).toBe(false);
    expect(shouldShowPublishBindNav("/questions")).toBe(false);
  });

  it("待绑定发布顶栏信息在非发布页隐藏", () => {
    expect(
      shouldShowPublishBindTopChrome("/enterprise-profile", "bind_publish_env", "待绑定发布"),
    ).toBe(false);
    expect(
      shouldShowPublishBindTopChrome("/content-publishing", "bind_publish_env", "待绑定发布"),
    ).toBe(true);
    expect(shouldShowPublishBindTopChrome("/ai-diagnosis", "complete_geo_profile", "待建档")).toBe(
      true,
    );
  });

  it("解析页面壳层路由", () => {
    expect(resolvePageShellRoute("/enterprise-profile")).toBe("enterprise_profile");
    expect(resolvePageShellRoute("/ai-diagnosis")).toBe("ai_diagnosis");
    expect(resolvePageShellRoute("/weekly")).toBe("content_assets");
  });
});
