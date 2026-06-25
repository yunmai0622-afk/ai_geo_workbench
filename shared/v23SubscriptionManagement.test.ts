import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("GEO-V2.3-P1 subscription management static wiring", () => {
  it("exposes subscription service status helpers", () => {
    expect(read("shared/companySubscriptionServiceStatus.ts")).toContain(
      "computeSubscriptionServiceStatus",
    );
    expect(read("server/platformAdminService.ts")).toContain("enrichSubscriptionView");
  });

  it("subscriptions API supports startedAt and operator access", () => {
    expect(read("server/adminPlatformRouter.ts")).toContain("startedAt: z.date().optional()");
    expect(read("server/adminPlatformRouter.ts")).toContain("operatorAdminProcedure");
  });

  it("admin customers and clients show subscription status", () => {
    expect(read("client/src/pages/admin/AdminCustomersPage.tsx")).toContain("serviceStatusLabel");
    expect(read("client/src/pages/ClientDashboardPage.tsx")).toContain("client-project-subscription");
  });

  it("delivery command center splits expiry todos by urgency", () => {
    const dc = read("shared/deliveryCommandCenter.ts");
    expect(dc).toContain("expiring-month");
    expect(dc).toContain("expired");
  });
});
