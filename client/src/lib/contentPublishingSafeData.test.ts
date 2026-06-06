import { describe, expect, it } from "vitest";
import { asArray, PUBLISH_QUEUE_EMPTY_LABELS } from "./contentPublishingSafeData";

describe("contentPublishingSafeData", () => {
  it("normalizes null and non-array values to empty arrays", () => {
    expect(asArray(null)).toEqual([]);
    expect(asArray(undefined)).toEqual([]);
    expect(asArray("tasks")).toEqual([]);
    expect(asArray([1, 2])).toEqual([1, 2]);
  });

  it("defines customer-facing empty labels per queue tab", () => {
    expect(PUBLISH_QUEUE_EMPTY_LABELS.pending).toBe("暂无待发布任务");
    expect(PUBLISH_QUEUE_EMPTY_LABELS.active).toBe("暂无发布中任务");
    expect(PUBLISH_QUEUE_EMPTY_LABELS.needs_attention).toBe("暂无需要处理的任务");
    expect(PUBLISH_QUEUE_EMPTY_LABELS.failed).toBe("暂无失败任务");
    expect(PUBLISH_QUEUE_EMPTY_LABELS.completed).toBe("暂无已完成任务");
  });
});
