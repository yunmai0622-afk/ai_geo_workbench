import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  getCurrentUserId,
  listAccessibleProjectIds,
  PROJECT_ACCESS_FORBIDDEN_MSG,
  requireProjectAccess,
} from "./projectAccess";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

const root = path.resolve(import.meta.dirname, "..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function mockCtx(user: Partial<User> & { id: number }): TrpcContext {
  return {
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    user: {
      id: user.id,
      openId: user.openId ?? "test-open-id",
      name: user.name ?? "Test",
      email: user.email ?? null,
      loginMethod: "test",
      role: user.role ?? "user",
      extensionApiKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  };
}

describe("GEO-V1-H Tenant Isolation P0", () => {
  it("projects schema 包含 ownerUserId", () => {
    const schema = read("drizzle/schema.ts");
    const block = schema.slice(schema.indexOf('export const projects = mysqlTable("projects"'), schema.indexOf("export const questions"));
    expect(block).toContain('ownerUserId: int("ownerUserId").notNull()');
  });

  it("projects.create 写入 ownerUserId", () => {
    const routers = read("server/routers.ts");
    const block = routers.slice(routers.indexOf("projects: router"), routers.indexOf("questions: router"));
    expect(block).toContain("ownerUserId");
    expect(block).toContain("getCurrentUserId(ctx)");
    expect(block).toMatch(/eq\(projects\.ownerUserId,\s*userId\)/);
  });

  it("projects.list 按 owner 过滤", () => {
    const routers = read("server/routers.ts");
    const block = routers.slice(routers.indexOf("projects: router"), routers.indexOf("questions: router"));
    expect(block).not.toMatch(/list:\s*protectedProcedure[\s\S]*?\.from\(projects\)\)\.orderBy/);
    expect(block).toContain("eq(projects.ownerUserId, userId)");
  });

  it("clientDashboard 使用 listAccessibleProjectIds", () => {
    const routers = read("server/routers.ts");
    const dash = routers.slice(routers.indexOf("clientDashboard"), routers.indexOf("projects: router"));
    expect(dash).toContain("listAccessibleProjectIds(ctx)");
    expect(dash).toContain("inArray(projects.id, accessibleIds)");
  });

  it("requireProjectAccess 与 getCurrentUserId 导出", () => {
    expect(typeof requireProjectAccess).toBe("function");
    expect(typeof getCurrentUserId).toBe("function");
    expect(typeof listAccessibleProjectIds).toBe("function");
    expect(PROJECT_ACCESS_FORBIDDEN_MSG).toContain("无权");
  });

  it("未登录时 getCurrentUserId 抛 UNAUTHORIZED", () => {
    expect(() => getCurrentUserId({ req: {} as TrpcContext["req"], res: {} as TrpcContext["res"], user: null })).toThrow();
  });

  it("enterprise profile / platformAccounts / publishTasks 静态 guard", () => {
    expect(read("server/routers.ts")).toContain("await requireProjectAccess(ctx, input.projectId)");
    expect(read("server/projectPlatformAccountsRouter.ts")).toContain("requireProjectAccess(ctx, input.projectId)");
    expect(read("server/publishTasksRouter.ts")).toContain("requireProjectAccessConn");
  });

  it("ensure 脚本与 migration 存在", () => {
    expect(fs.existsSync(path.join(root, "scripts/ensure_project_owner_user_id.mjs"))).toBe(true);
    expect(fs.existsSync(path.join(root, "drizzle/0030_projects_owner_user_id.sql"))).toBe(true);
  });

  it("Agent router 仍为 publicProcedure", () => {
    const agent = read("server/agentRouter.ts");
    expect(agent).toContain("publicProcedure");
    expect(agent).not.toContain("requireProjectAccess");
  });

  it("publishTasks 状态枚举未改", () => {
    const pt = read("server/publishTasksRouter.ts");
    expect(pt).toContain("pending_agent");
    expect(pt).toContain("status: \"pending_agent\"");
  });
});
