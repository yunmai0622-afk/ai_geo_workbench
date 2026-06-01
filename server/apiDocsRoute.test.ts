import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { API_DOC_SECTIONS } from "./apiDocs";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1 API docs page", () => {
  it("registers GET /api/docs on server boot with session auth", () => {
    expect(read("server/apiDocsRoute.ts")).toContain('app.get("/api/docs"');
    expect(read("server/apiDocsRoute.ts")).toContain("authenticateRequest");
    expect(read("server/_core/index.ts")).toContain("registerApiDocsRoute");
  });

  it("covers main tRPC areas", () => {
    const ids = API_DOC_SECTIONS.map(s => s.id);
    expect(ids).toEqual(["auth", "projects", "content", "publish", "ai-check"]);
    const paths = API_DOC_SECTIONS.flatMap(s => s.entries.map(e => e.path));
    expect(paths).toContain("auth.loginWithEmail");
    expect(paths).toContain("geo.projects.list");
    expect(paths).toContain("geo.articles.generate");
    expect(paths).toContain("publishTasks.create");
    expect(paths).toContain("geo.aiMentionCheck.run");
  });
});
