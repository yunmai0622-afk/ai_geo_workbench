import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Project-Archive", () => {
  it("migration 0042 adds archivedAt to projects", () => {
    expect(read("drizzle/0043_projects_archived_at.sql")).toContain("archivedAt");
    expect(read("drizzle/schema.ts")).toContain('archivedAt: timestamp("archivedAt")');
  });

  it("projects archive and unarchive mutations are wired", () => {
    const router = read("server/routers.ts");
    expect(router).toContain("archive: protectedProcedure");
    expect(router).toContain("unarchive: protectedProcedure");
    expect(router).toContain("archivedAt: new Date()");
    expect(router).toContain("archivedAt: null");
  });

  it("list endpoints filter by archivedAt", () => {
    const router = read("server/routers.ts");
    expect(router).toContain("isNull(projects.archivedAt)");
    expect(router).toContain("isNotNull(projects.archivedAt)");
    expect(router).toContain('archived: z.boolean().optional()');
  });

  it("ClientDashboardPage supports archive UI", () => {
    const page = read("client/src/pages/ClientDashboardPage.tsx");
    expect(page).toContain("已归档");
    expect(page).toContain("client-project-archive");
    expect(page).toContain("client-project-unarchive");
    expect(page).toContain("geo.projects.archive");
    expect(page).toContain("geo.projects.unarchive");
  });
});
