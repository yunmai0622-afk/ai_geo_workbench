import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("GEO-V1.1-System-Announcement", () => {
  it("migration 0051 adds announcement columns to geo_system_config", () => {
    const sql = read("drizzle/0051_geo_system_config_announcement.sql");
    expect(sql).toContain("geo_system_config");
    expect(sql).toContain("systemAnnouncementEnabled");
    expect(sql).toContain("systemAnnouncementBody");
    expect(sql).toContain("systemAnnouncementUpdatedAt");
  });

  it("admin config router exposes announcement endpoints", () => {
    const router = read("server/adminConfigRouter.ts");
    expect(router).toContain("updateAnnouncement:");
    expect(router).toContain("systemAnnouncement:");
    expect(router).toContain("adminProcedure");
    expect(router).toContain("protectedProcedure");
  });

  it("admin config page includes announcement form", () => {
    const page = read("client/src/pages/AdminConfigPage.tsx");
    expect(page).toContain("updateAnnouncement");
    expect(page).toContain("admin-config-announcement");
  });

  it("dashboard layout shows announcement banner", () => {
    const layout = read("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain("SystemAnnouncementBanner");
  });

  it("banner uses localStorage dismiss key", () => {
    const banner = read("client/src/components/SystemAnnouncementBanner.tsx");
    expect(banner).toContain("writeDismissedAnnouncementVersion");
    expect(banner).toContain("system-announcement-banner");
  });
});
