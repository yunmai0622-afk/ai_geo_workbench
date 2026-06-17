import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Publish-Stats", () => {
  it("shared stats builder and API are wired", () => {
    const shared = read("shared/deliveryReportPublishStats.ts");
    expect(shared).toContain("buildDeliveryReportPublishStats");

    const router = read("server/publishTasksRouter.ts");
    expect(router).toContain("projectStats: protectedProcedure");
    expect(router).toContain("buildDeliveryReportPublishStats");
    expect(router).toContain("publishTasks");
  });

  it("monthly report page shows plan execution actions instead of legacy publish stats", () => {
    const page = read("client/src/pages/DeliveryReportsCenterPage.tsx");
    for (const text of [
      "monthly-report-actions",
      "内容发布",
      "信源补充",
      "证据补充",
      "geo.monthlyPlan.getReport",
    ]) {
      expect(page).toContain(text);
    }
  });
});
