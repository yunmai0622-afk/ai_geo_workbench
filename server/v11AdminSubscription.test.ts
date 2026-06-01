import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("GEO-V1.1-AdminBypass admin subscription", () => {
  it("migration adds users.subscriptionPlanId", () => {
    const sql = read("drizzle/0056_users_subscription_plan.sql");
    expect(sql).toContain("subscriptionPlanId");
    expect(sql).toContain("enum('basic','professional','enterprise')");
  });

  it("server resolves plan from database for limits", () => {
    const limits = read("server/subscriptionLimits.ts");
    expect(limits).toContain("resolveUserSubscriptionPlanIdFromDb");
    expect(limits).not.toContain("resolveSubscriptionPlanIdForUser");
  });

  it("admin subscription router uses adminProcedure", () => {
    const router = read("server/adminSubscriptionRouter.ts");
    expect(router).toContain("adminProcedure");
    expect(router).toContain("setUserPlan");
    expect(router).toContain("listUsers");
  });

  it("app registers /admin/subscription route", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain("/admin/subscription");
    expect(app).toContain("AdminSubscriptionPage");
  });

  it("admin subscription page guards role=admin", () => {
    const page = read("client/src/pages/AdminSubscriptionPage.tsx");
    expect(page).toContain('user.role !== "admin"');
    expect(page).toContain("trpc.adminSubscription.listUsers");
  });
});
