import { describe, expect, it } from "vitest";
import {
  CONTENT_REVIEW_PENDING_ENQUEUE_HINT,
  DEFAULT_CONTENT_REVIEW_STATUS,
  isContentReviewPending,
  normalizeContentReviewStatus,
} from "./contentReviewStatus";

describe("GEO-V1.1-Content-Review-Status", () => {
  it("defaults unknown values to pending review", () => {
    expect(normalizeContentReviewStatus(null)).toBe(DEFAULT_CONTENT_REVIEW_STATUS);
    expect(normalizeContentReviewStatus("invalid")).toBe(DEFAULT_CONTENT_REVIEW_STATUS);
  });

  it("recognizes approved and needs-revision states", () => {
    expect(normalizeContentReviewStatus("已审核可发布")).toBe("已审核可发布");
    expect(normalizeContentReviewStatus("需要修改")).toBe("需要修改");
    expect(isContentReviewPending("需要修改")).toBe(false);
    expect(isContentReviewPending("待审核")).toBe(true);
  });

  it("exposes non-blocking enqueue hint", () => {
    expect(CONTENT_REVIEW_PENDING_ENQUEUE_HINT).toContain("已审核可发布");
  });
});
