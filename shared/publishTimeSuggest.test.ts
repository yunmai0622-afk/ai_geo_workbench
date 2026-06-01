import { describe, expect, it } from "vitest";
import {
  getPublishTimeSuggest,
  PUBLISH_TIME_SUGGEST_BAIJIAHAO,
  PUBLISH_TIME_SUGGEST_DEFAULT,
  PUBLISH_TIME_SUGGEST_SOHU,
  PUBLISH_TIME_SUGGEST_ZHIHU,
} from "./publishTimeSuggest";

describe("GEO-V1.1-Publish-Time-Suggest", () => {
  it("returns platform-specific static suggestions", () => {
    expect(getPublishTimeSuggest("zhihu")).toBe(PUBLISH_TIME_SUGGEST_ZHIHU);
    expect(getPublishTimeSuggest("sohu")).toBe(PUBLISH_TIME_SUGGEST_SOHU);
    expect(getPublishTimeSuggest("baijiahao")).toBe(PUBLISH_TIME_SUGGEST_BAIJIAHAO);
  });

  it("falls back to weekday daytime for other platforms", () => {
    expect(getPublishTimeSuggest("toutiao")).toBe(PUBLISH_TIME_SUGGEST_DEFAULT);
    expect(getPublishTimeSuggest("netease")).toBe(PUBLISH_TIME_SUGGEST_DEFAULT);
    expect(getPublishTimeSuggest("wechat")).toBe(PUBLISH_TIME_SUGGEST_DEFAULT);
    expect(getPublishTimeSuggest("unknown")).toBe(PUBLISH_TIME_SUGGEST_DEFAULT);
  });
});
