import { readFileSync } from "node:fs"; import { dirname, join } from "node:path"; import { fileURLToPath } from "node:url"; import { describe, expect, it } from "vitest";
const root = join(dirname(fileURLToPath(import.meta.url)), ".."); const read = (rel: string) => readFileSync(join(root, rel), "utf8");
describe("GEO-V1.1-Content-Templates", () => {
  it("route and router", () => { expect(read("client/src/App.tsx")).toContain('path="/templates"'); expect(read("server/routers.ts")).toContain("questionTemplates: router({"); });
  it("builtin templates", () => { expect(read("shared/questionContentTemplates.ts")).toContain("zhihu-brand-awareness"); });
});
