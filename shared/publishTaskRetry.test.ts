import { describe, expect, it } from "vitest";
import {
  canRetryPublishTask,
  isPublishRetryExhausted,
  MAX_PUBLISH_TASK_RETRIES,
  parsePublishTaskRetryLog,
} from "./publishTaskRetry";

describe("publishTaskRetry", () => {
  it("allows retry while count below max", () => {
    expect(canRetryPublishTask({ status: "failed", retryCount: 0 })).toBe(true);
    expect(canRetryPublishTask({ status: "failed", retryCount: 2 })).toBe(true);
    expect(canRetryPublishTask({ status: "failed", retryCount: MAX_PUBLISH_TASK_RETRIES })).toBe(false);
    expect(canRetryPublishTask({ status: "completed", retryCount: 0 })).toBe(false);
  });

  it("marks exhausted after max retries", () => {
    expect(isPublishRetryExhausted({ status: "failed", retryCount: 3 })).toBe(true);
    expect(isPublishRetryExhausted({ status: "failed", retryCount: 2 })).toBe(false);
  });

  it("parses retry log entries", () => {
    const log = parsePublishTaskRetryLog([
      { at: "2026-06-01T00:00:00.000Z", reason: "网络超时", previousError: "timeout" },
      { bad: true },
    ]);
    expect(log).toHaveLength(1);
    expect(log[0]?.reason).toBe("网络超时");
  });
});
