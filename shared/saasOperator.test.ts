import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  canAccessOperatorAdminConsole,
  isOperatorRole,
  isPlatformAdminRole,
  resolveCustomerCompanyOwnerUserId,
} from "./platformAdmin";

const root = path.resolve(import.meta.dirname, "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("SaaS operator roles", () => {
  it("identifies operator and admin console access", () => {
    expect(isPlatformAdminRole("admin")).toBe(true);
    expect(isOperatorRole("operator")).toBe(true);
    expect(canAccessOperatorAdminConsole("operator")).toBe(true);
    expect(canAccessOperatorAdminConsole("user")).toBe(false);
  });

  it("resolves customer company owner filter for operator", () => {
    expect(resolveCustomerCompanyOwnerUserId({ userId: 9, role: "admin" })).toBeUndefined();
    expect(resolveCustomerCompanyOwnerUserId({ userId: 9, role: "operator" })).toBe(9);
  });
});

describe("GEO-V2.3-P0 static wiring", () => {
  it("schema adds operator role and customer ownerUserId", () => {
    const schema = read("drizzle/schema.ts");
    expect(schema).toContain('"operator"');
    expect(schema).toContain("ownerUserId");
    expect(schema).toContain("operatorCompanyName");
    expect(fs.existsSync(path.join(root, "drizzle/0070_saas_operator_foundation.sql"))).toBe(true);
  });

  it("register flow supports operator account type", () => {
    expect(read("server/emailAuth.ts")).toContain("registerOperatorUser");
    expect(read("server/emailAuth.ts")).toContain('role: "operator"');
    expect(read("server/routers.ts")).toContain("registerOperatorUser");
    expect(read("client/src/pages/RegisterPage.tsx")).toContain("register-type-operator");
  });

  it("admin customers API uses operatorAdminProcedure and owner filter", () => {
    expect(read("server/_core/trpc.ts")).toContain("operatorAdminProcedure");
    expect(read("server/platformAdminService.ts")).toContain("assertCustomerCompanyAccess");
    expect(read("server/adminPlatformRouter.ts")).toContain("platformActorFromCtx");
  });

  it("admin UI exposes create customer and operator layout", () => {
    expect(read("client/src/pages/admin/AdminCustomersPage.tsx")).toContain("admin-customers-create-btn");
    expect(read("client/src/components/admin/AdminLayout.tsx")).toContain("canAccessOperatorAdminConsole");
  });
});
