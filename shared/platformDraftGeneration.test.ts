import { describe, expect, it } from "vitest";
import {
  applyPlatformDraftTimeoutIfNeeded,
  buildPlatformDraftStatusView,
  mergePlatformDraftGeneration,
  PLATFORM_DRAFT_GENERATION_TIMEOUT_MS,
  readPlatformDraftGeneration,
} from "./platformDraftGeneration";

describe("platformDraftGeneration", () => {
  it("reads and merges generation basis record", () => {
    const basis = mergePlatformDraftGeneration(null, {
      status: "generating",
      platform: "zhihu",
      startedAt: "2026-01-01T00:00:00.000Z",
    });
    const record = readPlatformDraftGeneration(basis);
    expect(record?.status).toBe("generating");
    expect(record?.platform).toBe("zhihu");
  });

  it("marks timed out in-flight jobs as failed with retry", () => {
    const startedAt = new Date(Date.now() - PLATFORM_DRAFT_GENERATION_TIMEOUT_MS - 1000).toISOString();
    const next = applyPlatformDraftTimeoutIfNeeded(
      { status: "generating", startedAt, platform: "zhihu" },
      Date.now(),
    );
    expect(next?.status).toBe("failed");
    expect(next?.errorCode).toBe("timeout");
    expect(next?.canRetry).toBe(true);
  });

  it("builds customer-facing status view", () => {
    const view = buildPlatformDraftStatusView(42, {
      status: "failed",
      errorCode: "timeout",
      errorMessage: "internal",
      canRetry: true,
      updatedAt: "2026-01-01T00:00:00.000Z",
    }, "zhihu");
    expect(view.articleId).toBe(42);
    expect(view.canRetry).toBe(true);
    expect(view.errorMessage).toContain("稍后重试");
  });
});
