import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V2.1-P3 Delivery Command Center", () => {
  it("exposes command center API and shared view model", () => {
    expect(read("server/adminPlatformRouter.ts")).toContain("getCommandCenter:");
    expect(read("server/platformAdminService.ts")).toContain("getDeliveryCommandCenter");
    expect(read("shared/deliveryCommandCenter.ts")).toContain("buildDeliveryCommandCenterView");
  });

  it("renders delivery command center page modules", () => {
    const page = read("client/src/pages/admin/AdminDeliveryPage.tsx");
    expect(page).toContain("交付驾驶舱");
    expect(page).toContain("delivery-command-todos");
    expect(page).toContain("delivery-command-overview");
    expect(page).toContain("delivery-command-monthly-stats");
    expect(page).toContain("admin.delivery.getCommandCenter");
    expect(page).toContain("delivery-subscription-warning");
    expect(page).toContain("delivery-quick-menu-");
    expect(page).toContain("当前阶段");
    expect(page).toContain("内容资产");
  });

  it("redirects non-admin users to workspace", () => {
    expect(read("client/src/components/admin/AdminLayout.tsx")).toContain('Redirect to="/workspace"');
  });
});
