import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Account-Select-Polish", () => {
  it("enqueue dialog shows account name login status and last publish in select", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    const labels = read("shared/publishEnqueueAccountSelect.ts");
    expect(weekly).toContain("formatPublishEnqueueAccountOptionLabel");
    expect(labels).toContain("publishEnqueueLoginStatusLabel");
    expect(labels).toContain("最近发布");
    expect(labels).toContain("需重新登录");
  });

  it("remembers last selected publish account per project and platform", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("readLastEnqueuePublishAccountId");
    expect(weekly).toContain("writeLastEnqueuePublishAccountId");
  });

  it("guides relogin when session expired", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("PUBLISH_ENQUEUE_SESSION_EXPIRED_HINT");
    expect(weekly).toContain("publish-enqueue-relogin");
    expect(weekly).toContain("focusLocalAgentAccountsTab");
  });
});
