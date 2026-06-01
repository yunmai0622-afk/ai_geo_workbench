import { describe, expect, it } from "vitest";
import {
  formatPublishSuccessBody,
  formatPublishSuccessPlatformPhrase,
  PUBLISH_SUCCESS_NEXT_STEP,
  PUBLISH_SUCCESS_NOTIFICATION_TITLE,
  PUBLISH_SUCCESS_VIEW_ARTICLE_LABEL,
  resolvePublishSuccessArticleUrl,
} from "./publishSuccessNotification";

describe("publishSuccessNotification", () => {
  it("formats title, body, link label and next step", () => {
    expect(PUBLISH_SUCCESS_NOTIFICATION_TITLE).toBe("发布成功");
    expect(formatPublishSuccessBody("知乎")).toBe("文章已发布到知乎");
    expect(PUBLISH_SUCCESS_VIEW_ARTICLE_LABEL).toBe("点击查看文章");
    expect(PUBLISH_SUCCESS_NEXT_STEP).toBe("建议7天后执行复测");
  });

  it("joins multiple platform labels", () => {
    expect(formatPublishSuccessPlatformPhrase(["知乎", "百家号"])).toBe("知乎、百家号");
    expect(formatPublishSuccessPlatformPhrase(["知乎", "知乎"])).toBe("知乎");
  });

  it("resolves article url from task results", () => {
    expect(resolvePublishSuccessArticleUrl([null, "  ", "https://zhuanlan.zhihu.com/p/1"])).toBe(
      "https://zhuanlan.zhihu.com/p/1",
    );
    expect(resolvePublishSuccessArticleUrl(["zhuanlan.zhihu.com/p/2"])).toBe(
      "https://zhuanlan.zhihu.com/p/2",
    );
  });
});
