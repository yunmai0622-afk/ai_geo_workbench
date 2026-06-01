import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("GEO-V1.1-System-Config", () => {
  it("migration 0046 creates geo_system_config table", () => {
    const sql = read("drizzle/0046_geo_system_config.sql");
    expect(sql).toContain("CREATE TABLE `geo_system_config`");
    expect(sql).toContain("contentGenerationPerMinuteLimit");
    expect(sql).toContain("t0DetectionPerHourLimit");
    expect(sql).toContain("qualityMinPassScore");
    expect(sql).toContain("defaultPublishPlatforms");
  });

  it("admin config router uses adminProcedure", () => {
    const router = read("server/adminConfigRouter.ts");
    expect(router).toContain("adminProcedure");
    expect(router).toContain("get:");
    expect(router).toContain("update:");
  });

  it("admin config page guards role=admin", () => {
    const page = read("client/src/pages/AdminConfigPage.tsx");
    expect(page).toContain('user.role !== "admin"');
    expect(page).toContain("trpc.adminConfig.get");
  });

  it("app registers /admin/config route", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain("/admin/config");
    expect(app).toContain("AdminConfigPage");
  });
});
