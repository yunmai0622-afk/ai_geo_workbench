import { describe, expect, it } from "vitest";
import {
  COVER_SVG_STORED_PREFIX,
  buildCoverDataUrlFromStored,
  encodeStoredCoverBase64,
  encodeSvgStringToBase64,
  isValidStoredCoverBase64,
  parseStoredCoverBase64,
  resolveArticleCoverBase64ForPublish,
  synthesizeSvgCoverBase64,
} from "./articleCoverBase64";

describe("articleCoverBase64", () => {
  it("round-trips png raw base64", () => {
    const raw = Buffer.from("png-bytes").toString("base64");
    expect(parseStoredCoverBase64(raw)?.mime).toBe("image/png");
    expect(buildCoverDataUrlFromStored(raw)).toBe(`data:image/png;base64,${raw}`);
    expect(isValidStoredCoverBase64(raw)).toBe(true);
  });

  it("stores svg with prefix and builds svg data url", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>测</text></svg>';
    const b64 = encodeSvgStringToBase64(svg);
    const stored = encodeStoredCoverBase64({ mime: "image/svg+xml", base64: b64 });
    expect(stored.startsWith(COVER_SVG_STORED_PREFIX)).toBe(true);
    expect(parseStoredCoverBase64(stored)?.mime).toBe("image/svg+xml");
    expect(buildCoverDataUrlFromStored(stored)).toBe(`data:image/svg+xml;base64,${b64}`);
  });

  it("synthesizes cover for publish when article row has no coverBase64", () => {
    const stored = resolveArticleCoverBase64ForPublish(
      { coverBase64: null, coverTemplate: "ai-tech", title: "GEO 封面测试" },
      "海豚知道",
    );
    expect(stored?.startsWith(COVER_SVG_STORED_PREFIX)).toBe(true);
    expect(isValidStoredCoverBase64(stored)).toBe(true);
    const synthesized = synthesizeSvgCoverBase64({ title: "另一标题", brandName: "品牌" });
    expect(synthesized).toContain(COVER_SVG_STORED_PREFIX);
  });
});
