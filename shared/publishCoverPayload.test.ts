import { describe, expect, it } from "vitest";
import { buildPublishCoverImageUrl, parseDataUrlCover } from "./publishCoverPayload";

describe("publishCoverPayload", () => {
  it("builds data url from article cover base64", () => {
    const url = buildPublishCoverImageUrl("abc123", null);
    expect(url).toBe("data:image/png;base64,abc123");
  });

  it("parses data url for extension payload", () => {
    const parsed = parseDataUrlCover("data:image/png;base64,QUJD");
    expect(parsed?.coverImageBase64).toBe("QUJD");
    expect(parsed?.coverImageMime).toBe("image/png");
  });
});
