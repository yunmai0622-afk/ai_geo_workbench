import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertNoMockReviewResult, REVIEW_TYPES } from "@shared/reviewQueue";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-P0-C — 复测队列与重写池", () => {
  it("defines review types and blocks mock results", () => {
    expect(REVIEW_TYPES).toContain("ai_test");
    expect(() => assertNoMockReviewResult({ indexed: true })).toThrow(/禁止 mock/);
    expect(() => assertNoMockReviewResult({ outcome: "pending_manual" })).not.toThrow();
  });

  it("enqueues review after manual_required / draft_saved", () => {
    const svc = read("server/articleLifecycleService.ts");
    expect(svc).toContain("enqueueReviewAfterPublishSignal");
    expect(read("server/reviewQueueService.ts")).toContain("manual_required");
  });

  it("failed and reject enter rewrite pool", () => {
    expect(read("server/rewritePoolService.ts")).toContain("publish_failed");
    expect(read("server/geoArticleQualityCheckFlow.ts")).toContain("recordRewriteFromQualityReject");
    expect(read("server/geoQualityReviewService.ts")).toContain('recommendation === "reject"');
  });

  it("frontend shows pending review and rewrite badges", () => {
    const page = read("client/src/pages/WeeklyContentPage.tsx");
    expect(page).toContain("badge-pending-review");
    expect(page).toContain("badge-needs-rewrite");
    expect(page).toContain("生成新版内容建议");
  });
});
