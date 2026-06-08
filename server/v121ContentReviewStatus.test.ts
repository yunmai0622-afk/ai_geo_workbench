import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Content-Review-Status", () => {
  it("persists contentReviewStatus on geo_articles", () => {
    expect(read("drizzle/schema.ts")).toContain("contentReviewStatus");
    expect(read("drizzle/0049_geo_articles_content_review_status.sql")).toContain("待审核");
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

  it("enqueue publish opens review confirm dialog when pending", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    const publishableList = read("client/src/components/weekly/WeeklyPublishableContentList.tsx");
    const reviewDialog = read("client/src/components/weekly/WeeklyContentReviewConfirmDialog.tsx");

    expect(weekly).toContain("requestEnqueuePublish");
    expect(weekly).toContain("WeeklyContentReviewConfirmDialog");
    expect(reviewDialog).toContain("确认人工审核");
    expect(reviewDialog).toContain("weekly-review-confirm-checkbox");
    expect(read("shared/weeklyPublishableDisplay.ts")).toContain("审核并加入队列");

    const requestFn = weekly.slice(weekly.indexOf("const requestEnqueuePublish"));
    expect(requestFn.indexOf("isContentReviewPending")).toBeGreaterThan(-1);
    expect(requestFn.indexOf("review_and_enqueue")).toBeGreaterThan(-1);

    const confirmFn = weekly.slice(weekly.indexOf("const handleReviewConfirmSubmit"));
    expect(confirmFn).toContain("reviewAndEnqueueArticle.mutateAsync");
    expect(confirmFn).toContain('mode === "review_only"');
    expect(confirmFn).toContain("setContentReviewStatus.mutateAsync");
  });
});
