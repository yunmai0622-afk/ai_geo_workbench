import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("GEO-V1.1-Usage-Stats", () => {
  it("admin stats router uses adminProcedure and aggregates existing tables", () => {
    const router = read("server/adminStatsRouter.ts");
    expect(router).toContain("adminProcedure");
    expect(router).toContain("summary:");
    expect(router).toContain("from(users)");
    expect(router).toContain("from(projects)");
    expect(router).toContain("isNull(projects.archivedAt)");
    expect(router).toContain("from(geoPublishRecords)");
    expect(router).toContain("from(geoArticles)");
    expect(router).toContain("DATE(${users.lastSignedIn}) = CURDATE()");
  });

  it("admin stats page guards role=admin", () => {
    const page = read("client/src/pages/AdminStatsPage.tsx");
    expect(page).toContain('user.role !== "admin"');
    expect(page).toContain("trpc.adminStats.summary");
  });

  it("app registers /admin/stats route", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain("/admin/stats");
    expect(app).toContain("AdminStatsPage");
  });
});
