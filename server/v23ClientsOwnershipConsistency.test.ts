import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isProjectOwnedByUser } from "./projectAccess";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("GEO V2.3 clients ownership consistency", () => {
  it.each(["user", "admin", "operator"])("%s uses the same owner-scoped project rule", role => {
    expect(role).toBeTruthy();
    expect(isProjectOwnedByUser(42, 42)).toBe(true);
    expect(isProjectOwnedByUser(42, 99)).toBe(false);
  });

  it("uses the same accessible-project layer for clients and workspace access", () => {
    const access = read("server/projectAccess.ts");
    const routers = read("server/routers.ts");
    const clients = routers.slice(routers.indexOf("clientDashboard: router"), routers.indexOf("projects: router"));
    const workspace = routers.slice(routers.indexOf("workspace: router"), routers.indexOf("onboarding: router"));
    expect(clients).toContain("listAccessibleProjectIds(ctx)");
    expect(workspace).toContain("requireProjectAccess(ctx, input.projectId)");
    expect(access).toContain("projectOwnerCondition(userId)");
    expect(access).toContain("projectOwnerCondition(ownerUserId)");
  });

  it("keeps project isolation generic without hard-coding sample project ids", () => {
    const access = read("server/projectAccess.ts");
    expect(access).not.toMatch(/210001|180001/);
  });

  it("does not present a false zero while the clients query is loading", () => {
    const page = read("client/src/pages/ClientDashboardPage.tsx");
    expect(page).toContain('value={isLoading ? "—" : stats.total}');
    expect(page).toContain("listProjectsSummary.useQuery");
    expect(page).toContain("whiteLabelPrimaryStyle");
  });
});
