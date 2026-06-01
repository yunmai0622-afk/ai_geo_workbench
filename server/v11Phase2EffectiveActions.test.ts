import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EFFECTIVE_ACTION_EFFECT_LEVELS,
  suggestEffectiveActions,
} from "./effectiveActions";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

describe("GEO V1.1 Phase 2 effective_actions", () => {
  it("schema 含 effective_actions 表定义", () => {
    const schema = read("drizzle/schema.ts");
    expect(schema).toContain('mysqlTable("effective_actions"');
    expect(schema).toContain("projectId: int");
    expect(schema).toContain("effectLevel: varchar");
  });

  it("migration 0033 仅建 effective_actions", () => {
    const sql = read("drizzle/0036_v11_phase2_effective_actions.sql");
    expect(sql).toContain("CREATE TABLE `effective_actions`");
    expect(sql).not.toContain("DROP TABLE");
  });

  it("三个路由经 requireProjectAccess", () => {
    const router = read("server/effectiveActionsRouter.ts");
    expect(router).toContain("requireProjectAccess(ctx, input.projectId)");
    expect(router).toContain("create:");
    expect(router).toContain("listByProject:");
    expect(router).toContain("update:");
  });

  it("geo 路由挂载 effectiveActions", () => {
    expect(read("server/routers.ts")).toContain("effectiveActions: effectiveActionsRouter");
  });

  it("suggestEffectiveActions 存在且草稿固定 watching", () => {
    const src = read("server/effectiveActions.ts");
    expect(typeof suggestEffectiveActions).toBe("function");
    expect(src).toContain('effectLevel: "watching"');
    expect(src).not.toContain('effectLevel: "A_obvious"');
    expect(EFFECTIVE_ACTION_EFFECT_LEVELS).toContain("watching");
  });
});
