import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Post-Publish-Reminder", () => {
  it("publish center shows post-publish reminder card with next steps", () => {
    const page = read("client/src/pages/ContentPublishingCenterPage.tsx");
    const card = read("client/src/components/publishing/PostPublishReminderCard.tsx");
    expect(page).toContain("PostPublishReminderCard");
    expect(page).toContain("showPostPublishReminder");
    expect(page).toContain("buildProjectUrl(\"/inclusion-monitoring\"");
    expect(card).toContain("内容已发布成功");
    expect(card).toContain("等待 7 天让 AI 平台收录内容");
    expect(card).toContain("在收录监测页执行 AI 实测");
    expect(card).toContain("对比发布前后的品牌提及率变化");
    expect(card).toContain("去收录监测");
    expect(card).toContain("知道了");
    expect(card).toContain("post-publish-reminder-go-monitoring");
    expect(card).toContain("post-publish-reminder-dismiss");
  });
});
