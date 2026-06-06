import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(import.meta.dirname, "..", rel), "utf-8");

describe("project scoped content task isolation", () => {
  it("server list queries require projectId and generate validates contentTaskId", () => {
    const routers = read("server/routers.ts");
    expect(routers).toContain("assertProjectScopedContentTask");
    expect(routers).toMatch(
      /tasks:\s*router\(\{[\s\S]*?list:\s*protectedProcedure\.input\(z\.object\(\{\s*projectId: z\.number\(\)\.int\(\)\.positive\(\)\s*\}\)\)/,
    );
    expect(routers).toMatch(
      /analysis:\s*router\(\{[\s\S]*?list:\s*protectedProcedure\.input\(z\.object\(\{\s*projectId: z\.number\(\)\.int\(\)\.positive\(\)\s*\}\)\)/,
    );
    expect(routers).toMatch(
      /articles:\s*router\(\{[\s\S]*?list:\s*protectedProcedure\.input\(z\.object\(\{\s*projectId: z\.number\(\)\.int\(\)\.positive\(\)\s*\}\)\)/,
    );
  });

  it("weekly page uses project-scoped list input and row guard", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("scopedListInput");
    expect(weekly).toContain("useProjectScopedQueryRows");
    expect(weekly).toContain("weekly-no-project-content-tasks");
  });

  it("publishTasks.create rejects cross-project article", () => {
    const publish = read("server/publishTasksRouter.ts");
    expect(publish).toContain("article.projectId !== input.projectId");
  });
});
