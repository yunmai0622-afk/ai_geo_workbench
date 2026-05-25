import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("GEO-V1-H1 Tenant Isolation Hardening", () => {
  it("questionId update/delete 反查 projectId", () => {
    const routers = read("server/routers.ts");
    const block = routers.slice(routers.indexOf("questions: router"), routers.indexOf("aiResponses: router"));
    expect(block).toContain("requireQuestionAccess(ctx, input.id)");
    expect(block).toContain("requireQuestionAccess(ctx, id)");
  });

  it("非 owner 静态：requireQuestionAccess 走 ownerUserId", () => {
    const access = read("server/projectAccess.ts");
    expect(access).toContain("eq(projects.ownerUserId, userId)");
    expect(access).toContain("requireQuestionAccess");
  });

  it("articleId 间接访问 guard", () => {
    expect(read("server/projectAccess.ts")).toContain("requireArticleAccess");
    expect(read("server/routers.ts")).toContain("requireArticleAccess(ctx, input.articleId)");
  });

  it("publishTaskId 间接 guard helper 存在", () => {
    expect(read("server/projectAccess.ts")).toContain("requirePublishTaskAccessConn");
    expect(read("server/publishTasksRouter.ts")).toContain("requireProjectAccessConn");
  });

  it("delivery report share token 只读公开", () => {
    const routers = read("server/routers.ts");
    expect(routers).toContain("publicShare: publicProcedure");
    expect(routers).toContain("publicEvidence: publicProcedure");
    expect(read("server/deliveryReportPublicShare.ts")).toContain("randomBytes(32)");
    expect(read("shared/deliveryReportPublicShare.ts")).toContain("DeliveryReportPublicSharePayload");
  });

  it("clientDashboard 双用户隔离逻辑", () => {
    const dash = read("server/routers.ts").slice(
      read("server/routers.ts").indexOf("clientDashboard"),
      read("server/routers.ts").indexOf("projects: router"),
    );
    expect(dash).toContain("listAccessibleProjectIds(ctx)");
  });

  it("Agent task 创建前 owner guard", () => {
    expect(read("server/publishTasksRouter.ts")).toContain("requireProjectAccessConn");
    expect(read("server/agentPublishTasks.ts")).toContain('task.localAgentId !== input.localAgentId');
  });

  it("不改 Local Agent 状态逻辑", () => {
    expect(read("server/agentPublishTasks.ts")).toContain("pending_agent");
    expect(read("server/publishTasksRouter.ts")).toContain("pending_agent");
  });

  it("不恢复 Chrome 插件主链路", () => {
    expect(read("server/agentRouter.ts")).not.toContain("Chrome");
  });

  it("idor e2e 与 h1 acceptance 脚本存在", () => {
    expect(fs.existsSync(path.join(root, "scripts/tenant_isolation_idor_e2e.mjs"))).toBe(true);
    expect(fs.existsSync(path.join(root, "scripts/tenant_isolation_h1_acceptance.mjs"))).toBe(true);
  });
});
