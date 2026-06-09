import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Review-And-Enqueue-Atomic-Fix-P0", () => {
  const router = read("server/publishTasksRouter.ts");
  const weekly = read("client/src/pages/WeeklyContentPage.tsx");

  it("exposes reviewAndEnqueueArticle mutation with atomic validation order", () => {
    expect(router).toContain("reviewAndEnqueueArticle");
    expect(router).toContain("confirmManualReview: z.literal(true)");
    expect(router).toContain("assertPublishReadinessForCreate");
    expect(router).toContain("assertPrePublishChecklistForCreate");
    expect(router).toContain("assertNoDuplicatePublishQueueTask");
    expect(router).toContain("insertPublishTaskRecord");

    const block = router.slice(router.indexOf("reviewAndEnqueueArticle:"));
    const reviewUpdate = block.indexOf('contentReviewStatus: "已审核可发布"');
    const createTask = block.indexOf("insertPublishTaskRecord");
    expect(createTask).toBeGreaterThan(-1);
    expect(reviewUpdate).toBeGreaterThan(createTask);
  });

  it("maps server errors to customer-facing messages", () => {
    expect(router).toContain("mapReviewEnqueueCustomerMessage");
    expect(router).toContain("throwReviewEnqueueBadRequest");
    const errors = read("shared/reviewEnqueueErrors.ts");
    expect(errors).toContain("封面缺失：请配置封面");
    expect(errors).toContain("当前项目未绑定该平台账号：请先绑定发布账号");
    expect(errors).toContain("已存在发布任务：请到平台适配发布页查看");
  });

  it("frontend uses single reviewAndEnqueueArticle for review_and_enqueue", () => {
    const start = weekly.indexOf("const handleReviewConfirmSubmit");
    const end = weekly.indexOf("const handleBatchEnqueuePublish");
    const confirmFn = weekly.slice(start, end);
    expect(confirmFn).toContain("reviewAndEnqueueArticle.mutateAsync");
    expect(confirmFn).toContain("REVIEW_ENQUEUE_SUCCESS_MESSAGE");
    expect(confirmFn).not.toContain("enqueueArticleDirectly(reviewedArticle)");
    expect(confirmFn).not.toContain('toast.success("审核状态已更新")');
  });

  it("review_only still uses setContentReviewStatus only", () => {
    const start = weekly.indexOf("const handleReviewConfirmSubmit");
    const end = weekly.indexOf("const handleBatchEnqueuePublish");
    const confirmFn = weekly.slice(start, end);
    const reviewOnlyEnd = confirmFn.indexOf("const resolved = getArticlePublishPlatform");
    const reviewOnly = confirmFn.slice(confirmFn.indexOf('mode === "review_only"'), reviewOnlyEnd);
    expect(reviewOnly).toContain("setContentReviewStatus.mutateAsync");
    expect(reviewOnly).toContain("已标记为已审核可发布");
    expect(reviewOnly.indexOf("reviewAndEnqueueArticle")).toBe(-1);
  });

  it("setContentReviewStatus no longer auto-toasts on every success", () => {
    const mutationBlock = weekly.slice(
      weekly.indexOf("setContentReviewStatus = trpc.geo.articles.setContentReviewStatus.useMutation"),
      weekly.indexOf("const generateRewriteSuggestion"),
    );
    expect(mutationBlock).not.toContain('toast.success("审核状态已更新")');
  });

  it("failure path shows mapped customer error only once", () => {
    const start = weekly.indexOf("const handleReviewConfirmSubmit");
    const end = weekly.indexOf("const handleBatchEnqueuePublish");
    const confirmFn = weekly.slice(start, end);
    expect(confirmFn).toContain("mapReviewEnqueueCustomerMessage");
    expect(confirmFn).not.toContain("人工审核确认失败");
  });

  it("does not update review status when pre-create validations fail", () => {
    const block = router.slice(router.indexOf("reviewAndEnqueueArticle:"));
    const firstReviewUpdate = block.indexOf('contentReviewStatus: "已审核可发布"');
    const validations = [
      "assertPublishReadinessForCreate",
      "assertPrePublishChecklistForCreate",
      "assertNoDuplicatePublishQueueTask",
    ];
    for (const v of validations) {
      expect(block.indexOf(v)).toBeLessThan(firstReviewUpdate);
    }
  });

  it("duplicate task returns customer duplicate message path", () => {
    expect(router).toContain("PUBLISH_QUEUE_DUPLICATE_MESSAGE");
    expect(read("shared/reviewEnqueueErrors.ts")).toContain("duplicateTask");
  });

  it("logs structured server errors for review enqueue 500 diagnosis", () => {
    expect(router).toContain("logReviewEnqueueError");
    expect(router).toContain("formatReviewEnqueueError");
    expect(router).toContain("throwReviewEnqueueInternal");
    expect(router).toContain("update contentReviewStatus after publish task created");
    expect(router).toContain("appendArticleLifecycleEvent");
    expect(router).toContain("insert publish_tasks returned no id");
  });

  it("includes migration patch for review enqueue missing columns", () => {
    const migration = read("drizzle/0061_review_enqueue_schema_fix.sql");
    expect(migration).toContain("lifecycleStatus");
    expect(migration).toContain("lifecycleEvents");
    expect(migration).toContain("contentReviewStatus");
    expect(migration).toContain("localAgentId");
  });
});
