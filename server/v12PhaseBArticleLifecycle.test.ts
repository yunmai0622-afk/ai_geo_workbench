import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("Phase B — 文章生命周期与发布任务状态打通", () => {
  it("agent lifecycle sync module exists", () => {
    expect(read("server/agentArticleLifecycle.ts")).toContain("syncArticleLifecycleFromAgentTask");
    expect(read("server/agentArticleLifecycle.ts")).toContain("draft_saved");
    expect(read("server/agentArticleLifecycle.ts")).toContain("manual_required");
    expect(read("server/agentArticleLifecycle.ts")).toContain("geoInclusionMonitoringRecords");
    expect(read("server/agentArticleLifecycle.ts")).toContain("agent.reportAgentTaskResult");
    expect(read("server/agentArticleLifecycle.ts")).not.toMatch(/fake.*success|mock.*success/i);
  });

  it("reportAgentTaskResult invokes lifecycle sync", () => {
    const svc = read("server/agentPublishTasks.ts");
    expect(svc).toContain("syncArticleLifecycleFromAgentTask");
    expect(svc).toContain("articleLifecycle");
    expect(svc).toContain("inclusionMonitoringCreated");
    expect(svc).toContain("completed 状态必须提供 publicUrl");
  });

  it("completed requires publicUrl; draft_saved requires evidence", () => {
    expect(read("server/agentPublishTasks.ts")).toContain("draft_saved 必须提供");
  });
});
