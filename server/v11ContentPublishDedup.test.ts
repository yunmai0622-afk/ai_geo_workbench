import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Content-Dedup publish queue", () => {
  it("blocks duplicate article+platform enqueue on server", () => {
    const router = read("server/publishTasksRouter.ts");
    expect(router).toContain("assertNoDuplicatePublishQueueTask");
    expect(router).toContain("PUBLISH_QUEUE_DUPLICATE_MESSAGE");
    expect(router).toContain("inArray(publishTasks.status");
  });

  it("defines blocking statuses in shared module", () => {
    const dedup = read("shared/publishQueueDedup.ts");
    expect(dedup).toContain("该内容已在发布队列中");
    expect(dedup).toContain("pending_agent");
    expect(dedup).toContain("failed");
    expect(dedup).toContain("platformAccountId");
    expect(dedup).toContain("completed");
  });
});
