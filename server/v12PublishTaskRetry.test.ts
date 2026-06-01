import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Publish-Retry", () => {
  it("migration 0040 adds retryCount to publish_tasks", () => {
    expect(read("drizzle/0041_publish_tasks_retry.sql")).toContain("retryCount");
    expect(read("drizzle/schema.ts")).toContain('retryCount: int("retryCount")');
    expect(read("drizzle/schema.ts")).toContain("retryLog");
  });

  it("retry service resets to pending_agent and caps at 3", () => {
    const svc = read("server/publishTaskRetryService.ts");
    expect(svc).toContain('status: "pending_agent"');
    expect(svc).toContain("MAX_PUBLISH_TASK_RETRIES");
    expect(svc).toContain("请人工处理");
    expect(svc).toContain("retryLog");
  });

  it("publishTasks.retry mutation is wired", () => {
    const router = read("server/publishTasksRouter.ts");
    expect(router).toContain("retry: protectedProcedure");
    expect(router).toContain("retryFailedPublishTask");
    expect(router).toContain("canRetry");
    expect(router).toContain("retryExhausted");
  });

  it("publish center shows retry button and exhausted hint", () => {
    expect(read("client/src/components/publishing/PublishTaskColumnBoard.tsx")).toContain("重试");
    expect(read("client/src/components/publishing/PublishTaskColumnBoard.tsx")).toContain("请人工处理");
    expect(read("client/src/pages/ContentPublishingCenterPage.tsx")).toContain("publishTasks.retry");
  });
});
