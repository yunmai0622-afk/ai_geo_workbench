import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Content-Review-Status", () => {
  it("persists contentReviewStatus on geo_articles", () => {
    expect(read("drizzle/schema.ts")).toContain("contentReviewStatus");
    expect(read("drizzle/0050_geo_articles_content_review_status.sql")).toContain("待审核");
  });

  it("exposes setContentReviewStatus mutation", () => {
    const router = read("server/routers.ts");
    expect(router).toContain("setContentReviewStatus");
    expect(router).toContain("CONTENT_REVIEW_STATUSES");
  });

  it("content card renders manual review selector", () => {
    const card = read("client/src/components/weekly/WeeklyPlatformArticleCard.tsx");
    expect(card).toContain("weekly-card-content-review-status");
    expect(card).toContain("contentReviewStatus");
  });

  it("enqueue publish warns but does not block pending review", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("CONTENT_REVIEW_PENDING_ENQUEUE_HINT");
    const openFn = weekly.slice(weekly.indexOf("const openPublishDialog"));
    expect(openFn.indexOf("isContentReviewPending")).toBeGreaterThan(-1);
    expect(openFn.indexOf("setPublishDialogOpen(true)")).toBeGreaterThan(
      openFn.indexOf("isContentReviewPending"),
    );
    const confirmFn = weekly.slice(weekly.indexOf("const handleConfirmPublish"));
    expect(confirmFn.indexOf("isContentReviewPending")).toBeGreaterThan(-1);
    const pendingHintIdx = confirmFn.indexOf("CONTENT_REVIEW_PENDING_ENQUEUE_HINT");
    expect(pendingHintIdx).toBeGreaterThan(-1);
    expect(confirmFn.indexOf("createPublishTask.mutateAsync")).toBeGreaterThan(pendingHintIdx);
  });
});
