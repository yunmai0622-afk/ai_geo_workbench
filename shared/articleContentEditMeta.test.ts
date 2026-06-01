import { describe, expect, it } from "vitest";
import {
  CONTENT_MODIFIED_AFTER_PUBLISH_MESSAGE,
  formatContentEditedAtLabel,
  isContentModifiedAfterPublish,
  resolveContentLastModifiedAt,
} from "./articleContentEditMeta";

describe("GEO-V1.1-Content-Version article content edit meta", () => {
  it("uses contentEditedAt over updatedAt for last modified", () => {
    const at = resolveContentLastModifiedAt({
      contentEditedAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-06-02T12:00:00.000Z",
    });
    expect(at?.toISOString()).toBe("2026-06-01T10:00:00.000Z");
  });

  it("detects modification after publish only when contentEditedAt is after publish", () => {
    expect(
      isContentModifiedAfterPublish({
        contentEditedAt: "2026-06-02T12:00:00.000Z",
        lifecycleEvents: [{ status: "published", at: "2026-06-01T08:00:00.000Z", source: "agent_report" }],
      }),
    ).toBe(true);
    expect(
      isContentModifiedAfterPublish({
        contentEditedAt: "2026-05-31T12:00:00.000Z",
        lastPublishRecordAt: "2026-06-01T08:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      isContentModifiedAfterPublish({
        lastPublishRecordAt: "2026-06-01T08:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("formats last modified label for zh-CN display", () => {
    expect(formatContentEditedAtLabel("2026-06-01T10:30:00.000Z")).toMatch(/2026/);
    expect(CONTENT_MODIFIED_AFTER_PUBLISH_MESSAGE).toContain("重新发布");
  });
});
