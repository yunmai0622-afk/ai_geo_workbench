import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-BackfillVerify — 发布记录回填链接", () => {
  const page = read("client/src/pages/ContentPublishingCenterPage.tsx");
  const queueTable = read("client/src/components/publishing/PublishTaskQueueTable.tsx");
  const executionTabs = read("client/src/lib/publishExecutionTabs.ts");
  const publishTasksRouter = read("server/publishTasksRouter.ts");
  const routers = read("server/routers.ts");
  const monitoring = read("server/publishRecordMonitoring.ts");

  it("已发布/待回填队列展示回填链接入口", () => {
    expect(executionTabs).toContain("publish-queue-tab-published");
    expect(executionTabs).toContain("publish-queue-tab-waiting-links");
    expect(page).toContain("handleBackfillTaskLink");
    expect(page).toContain("handleBackfillFromTable");
    expect(queueTable).toContain("回填链接");
    expect(page).toContain("backfillPublicUrl");
  });

  it("人工发布记录也可回填", () => {
    expect(page).toContain("card.recordId");
    expect(page).toContain("updateManualPublishRecord");
    expect(page).toContain("handleSaveRowLink");
  });

  it("回填后写入收录监测计划", () => {
    expect(publishTasksRouter).toContain("backfillPublicUrl");
    expect(publishTasksRouter).toContain("ensureInclusionMonitoringRecordForPublishRecord");
    expect(routers).toContain("ensureInclusionMonitoringRecordForPublishRecord");
    expect(monitoring).toContain("buildInitialInclusionMonitoringRecord");
    expect(page).toContain("已回填公开链接，并已生成收录监测计划");
  });
});
