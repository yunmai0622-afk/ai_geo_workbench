import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("Phase C — 发布后复测队列与重写池", () => {
  it("post publish workflow module", () => {
    expect(read("server/postPublishWorkflow.ts")).toContain("listPostPublishRetestQueue");
    expect(read("server/postPublishWorkflow.ts")).toContain("listRewritePool");
  });

  it("geo router exposes retestQueue and rewritePool", () => {
    const routers = read("server/routers.ts");
    expect(routers).toContain("retestQueue:");
    expect(routers).toContain("rewritePool:");
    expect(routers).toContain("triggerReview:");
    expect(routers).toContain("generateRewriteSuggestion:");
    expect(routers).toContain("listPostPublishRetestQueue");
  });

  it("DB-backed review and rewrite services", () => {
    expect(read("server/reviewQueueService.ts")).toContain("geoReviewQueue");
    expect(read("server/rewritePoolService.ts")).toContain("geoRewritePool");
  });

  it("inclusion monitoring page focuses on content asset effect tracking", () => {
    const ui = read("client/src/pages/InclusionMonitoringCenterPage.tsx");
    expect(ui).toContain("内容资产列表");
    expect(ui).toContain("加入AI复测");
    expect(ui).toContain("content-asset-retest-ready");
  });
});
