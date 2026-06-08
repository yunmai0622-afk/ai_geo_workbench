import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Publish-Success-Toast", () => {
  it("shared copy matches product spec", () => {
    const shared = read("shared/publishSuccessNotification.ts");
    expect(shared).toContain('export const PUBLISH_SUCCESS_NOTIFICATION_TITLE = "发布成功"');
    expect(shared).toContain("文章已发布到");
    expect(shared).toContain('export const PUBLISH_SUCCESS_VIEW_ARTICLE_LABEL = "查看文章"');
    expect(shared).toContain('export const PUBLISH_SUCCESS_GO_TO_INCLUSION_LABEL = "去收录监测"');
    expect(shared).toContain('export const PUBLISH_SUCCESS_NEXT_STEP = "建议7天后执行复测"');
  });

  it("publish center and weekly content show prominent success notification card", () => {
    const card = read("client/src/components/publishing/PublishSuccessNotificationCard.tsx");
    const publishCenter = read("client/src/pages/ContentPublishingCenterPage.tsx");
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");

    expect(card).toContain("PublishSuccessNotificationCard");
    expect(card).toContain("publish-success-notification-card");
    expect(card).toContain("publish-success-notification-go-inclusion");
    expect(card).toContain("PUBLISH_SUCCESS_GO_TO_INCLUSION_LABEL");
    expect(card).toContain('role="alert"');

    expect(publishCenter).toContain("PublishSuccessNotificationCard");
    expect(publishCenter).toContain("onGoToInclusionMonitoring");
    expect(publishCenter).not.toContain("PostPublishReminderCard");

    expect(weekly).toContain("PublishSuccessNotificationCard");
    expect(weekly).toContain("publishSuccessNotice");
    expect(weekly).toContain("showPublishSuccessNotification");
  });
});
