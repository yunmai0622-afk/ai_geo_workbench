import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Post-Publish-Reminder", () => {
  it("publish success notification superseded legacy post-publish reminder card", () => {
    const page = read("client/src/pages/ContentPublishingCenterPage.tsx");
    const card = read("client/src/components/publishing/PublishSuccessNotificationCard.tsx");
    expect(page).toContain("PublishSuccessNotificationCard");
    expect(page).not.toContain("PostPublishReminderCard");
    expect(card).toContain("PUBLISH_SUCCESS_NOTIFICATION_TITLE");
    expect(card).toContain("PUBLISH_SUCCESS_NEXT_STEP");
    expect(card).toContain("PUBLISH_SUCCESS_VIEW_ARTICLE_LABEL");
  });
});
