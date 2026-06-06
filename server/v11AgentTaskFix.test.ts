import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AGENT_PROCESSING_TIMEOUT_MINUTES,
  agentProcessingTimeoutMessage,
} from "@shared/agentPublishTaskTimeout";
import { PUBLISH_QUEUE_BLOCKING_STATUSES } from "@shared/publishQueueDedup";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-AgentTaskFix", () => {
  it("publishTasks.create dedupes by article+platform+platformAccountId", () => {
    const router = read("server/publishTasksRouter.ts");
    expect(router).toContain("eq(publishTasks.platformAccountId, input.platformAccountId)");
    expect(router).toContain("PUBLISH_QUEUE_DUPLICATE_RETRY_MESSAGE");
  });

  it("failed status blocks duplicate create", () => {
    expect(PUBLISH_QUEUE_BLOCKING_STATUSES).toContain("failed");
  });

  it("agent poll/list runs maintenance before returning tasks", () => {
    const svc = read("server/agentPublishTasks.ts");
    expect(svc).toContain("maintainAgentPublishTasks");
    const maint = read("server/agentPublishTaskMaintenance.ts");
    expect(maint).toContain("expireStuckAgentProcessingTasks");
    expect(maint).toContain("collapseDuplicatePendingAgentTasks");
  });

  it("processing timeout is 30 minutes", () => {
    expect(AGENT_PROCESSING_TIMEOUT_MINUTES).toBe(30);
    expect(agentProcessingTimeoutMessage()).toContain("30");
  });

  it("local agent overview passes failure time to recent activity", () => {
    const dash = read("local-agent/src/agent/dashboard.ts");
    expect(dash).toContain("createdAt: recentFailed.createdAt");
    const ui = read("local-agent/src/renderer/app.js");
    expect(ui).toContain("d.recentFailure.agentFinishedAt || d.recentFailure.createdAt");
    expect(ui).toMatch(/添加\$\{label\}环境|创建\$\{label\}账号环境/);
  });
});
