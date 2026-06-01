import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("Agent-2 Web publish task + local agent loop", () => {
  it("schema and migration add agent publish columns", () => {
    expect(read("drizzle/schema.ts")).toContain("localAgentId");
    expect(read("drizzle/schema.ts")).toContain("agentLog");
    expect(read("drizzle/0026_agent_publish_tasks.sql")).toContain("localProfileId");
  });

  it("publishTasks.create routes bound account to pending_agent only", () => {
    const router = read("server/publishTasksRouter.ts");
    expect(router).toContain('status: "pending_agent"');
    expect(router).toContain('publishMode: "local_agent"');
    expect(router).toContain("localProfileId");
    expect(router).toContain("publishBlockedNoLocalProfileMessage");
    expect(router).toContain("publishBlockedSessionExpiredMessage");
  });

  it("agent router exposes poll claim report", () => {
    expect(read("server/agentRouter.ts")).toContain("pollTasks");
    expect(read("server/agentRouter.ts")).toContain("claimTask");
    expect(read("server/agentRouter.ts")).toContain("reportTaskResult");
    expect(read("server/routers.ts")).toContain("agent: agentRouter");
  });

  it("agentPublishTasks enforces real draft_saved and completed evidence", () => {
    const svc = read("server/agentPublishTasks.ts");
    expect(svc).not.toContain("local-agent");
    expect(svc).toContain('eq(publishTasks.status, "pending_agent")');
    expect(svc).toContain("draft_saved 必须提供");
    expect(svc).toContain("completed 状态必须提供 publicUrl");
  });

  it("local-agent has task client worker and platform publishers", () => {
    expect(read("local-agent/src/agent/taskClient.ts")).toContain("agent.pollTasks");
    expect(read("local-agent/src/agent/publishWorker.ts")).toContain("publishWithPlatform");
    expect(read("local-agent/src/agent/pollingManager.ts")).toContain("runPublishTask");
    expect(read("local-agent/src/agent/platforms/basePublisher.ts")).toContain("cover_upload_skipped");
    expect(read("local-agent/src/agent/platforms/zhihuPublisher.ts")).not.toMatch(/mock|假装|fake/i);
  });

  it("does not mock success or store cookies", () => {
    expect(read("local-agent/src/agent/storage.ts")).not.toMatch(/password|cookie/i);
    expect(read("local-agent/src/agent/platforms/zhihuPublisher.ts")).not.toMatch(/mock|fake.*success/i);
  });

  it("C7-A C8-A publish guards preserved without extension create path", () => {
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("blockPublishIfUnsaved");
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("blockPublishIfQualityReject");
    const createBlock = read("server/publishTasksRouter.ts").slice(
      read("server/publishTasksRouter.ts").indexOf("create: protectedProcedure"),
      read("server/publishTasksRouter.ts").indexOf("verifyPublishTask:"),
    );
    expect(createBlock).not.toContain(': "pending"');
  });

  it("publish status labels include agent states", () => {
    expect(read("shared/publishTaskErrors.ts")).toContain("pending_agent");
    expect(read("shared/publishTaskErrors.ts")).toContain("manual_required");
    expect(read("client/src/pages/ContentPublishingCenterPage.tsx")).toContain("listRecentByProject");
    expect(read("client/src/lib/publishCenterDisplay.ts")).toContain("已自动进入收录监测");
  });
});
