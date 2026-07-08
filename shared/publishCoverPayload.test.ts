import { describe, expect, it } from "vitest";
import { encodeStoredCoverBase64, encodeSvgStringToBase64 } from "./articleCoverBase64";
import {
  PUBLISH_TASK_COVER_IMAGE_URL_MAX_CHARS,
  buildPublishCoverImageUrl,
  buildPublishTaskCoverImageUrl,
} from "./publishCoverPayload";

describe("publishCoverPayload", () => {
  it("builds svg data url from stored svg prefix payload", () => {
    const b64 = encodeSvgStringToBase64("<svg></svg>");
    const stored = encodeStoredCoverBase64({ mime: "image/svg+xml", base64: b64 });
    expect(buildPublishCoverImageUrl(stored, null)).toBe(`data:image/svg+xml;base64,${b64}`);
  });

  it("falls back to lightweight cover when stored data url is too large for publish task row", () => {
    const largePng = "a".repeat(PUBLISH_TASK_COVER_IMAGE_URL_MAX_CHARS + 100);
    const fallback = encodeStoredCoverBase64({
      mime: "image/svg+xml",
      base64: encodeSvgStringToBase64("<svg><text>fallback</text></svg>"),
    });

    const payload = buildPublishTaskCoverImageUrl({
      coverBase64: largePng,
      fallbackCoverBase64: fallback,
    });

    expect(payload.originalTooLarge).toBe(true);
    expect(payload.source).toBe("fallback");
    expect(payload.coverImageUrl).toContain("data:image/svg+xml;base64,");
    expect(payload.coverImageUrl!.length).toBeLessThan(PUBLISH_TASK_COVER_IMAGE_URL_MAX_CHARS);
  });

  it("keeps external cover urls without applying data-url size cap", () => {
    const payload = buildPublishTaskCoverImageUrl({
      coverImageUrl: "https://cdn.example.com/cover.png",
    });
    expect(payload).toEqual({
      coverImageUrl: "https://cdn.example.com/cover.png",
      source: "external",
      originalTooLarge: false,
    });
  });
});
