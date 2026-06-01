import { describe, expect, it } from "vitest";
import { encodeStoredCoverBase64, encodeSvgStringToBase64 } from "./articleCoverBase64";
import { buildPublishCoverImageUrl } from "./publishCoverPayload";

describe("publishCoverPayload", () => {
  it("builds svg data url from stored svg prefix payload", () => {
    const b64 = encodeSvgStringToBase64("<svg></svg>");
    const stored = encodeStoredCoverBase64({ mime: "image/svg+xml", base64: b64 });
    expect(buildPublishCoverImageUrl(stored, null)).toBe(`data:image/svg+xml;base64,${b64}`);
  });
});
