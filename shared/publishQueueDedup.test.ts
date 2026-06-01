import { describe, expect, it } from "vitest";
import {
  isPublishQueueBlockingStatus,
  PUBLISH_QUEUE_BLOCKING_STATUSES,
  PUBLISH_QUEUE_DUPLICATE_MESSAGE,
} from "./publishQueueDedup";

describe("publishQueueDedup", () => {
  it("exposes duplicate queue message for API and UI", () => {
    expect(PUBLISH_QUEUE_DUPLICATE_MESSAGE).toContain("该内容已在发布队列中");
  });

  it("blocks pending, failed and completed family statuses", () => {
    expect(PUBLISH_QUEUE_BLOCKING_STATUSES).toContain("pending_agent");
    expect(PUBLISH_QUEUE_BLOCKING_STATUSES).toContain("completed");
    expect(PUBLISH_QUEUE_BLOCKING_STATUSES).toContain("failed");
    expect(isPublishQueueBlockingStatus("pending_agent")).toBe(true);
    expect(isPublishQueueBlockingStatus("completed")).toBe(true);
    expect(isPublishQueueBlockingStatus("manual_required")).toBe(true);
    expect(isPublishQueueBlockingStatus("failed")).toBe(true);
  });
});
