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

  it("delivery report page shows publish stats module", () => {
    const page = read("client/src/pages/DeliveryReportsCenterPage.tsx");
    for (const text of [
      "delivery-report-publish-stats",
      "发布统计",
      "总发布次数",
      "发布成功率",
      "本周发布数量",
      "delivery-report-publish-stats-platforms",
      "publishTasks.projectStats",
    ]) {
      expect(page).toContain(text);
    }
  });
});
