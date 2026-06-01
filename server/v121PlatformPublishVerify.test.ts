import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

const MP_FLOW_STEPS = [
  "open_home",
  "detect_account",
  "open_write",
  "fill_title",
  "fill_content",
  "upload_cover",
  "click_publish_button",
  "confirm_publish_dialog",
  "wait_publish_success",
  "extract_public_url",
  "publish_article",
] as const;

describe("GEO-V1.1 Platform publish verify (sohu/baijiahao/toutiao)", () => {
  const mp = read("local-agent/src/agent/platforms/mpPublishExtensions.ts");

  it("mp publish flow logs all required steps", () => {
    for (const step of MP_FLOW_STEPS) {
      expect(mp).toContain(`"${step}"`);
    }
    expect(mp).toContain("formatMpSelectorMiss");
    expect(mp).toContain("subSteps");
  });

  it("sohu publisher has full mp chain and category risk hint", () => {
    const src = read("local-agent/src/agent/platforms/sohuPublisher.ts");
    expect(src).toContain("executeMpPublishTask");
    expect(src).toContain("extractSohuPublicUrl");
    expect(src).toContain("请选择分类");
    expect(src).not.toContain("skipCover: true");
  });

  it("baijiahao publisher has cover upload and public url extract", () => {
    const src = read("local-agent/src/agent/platforms/baijiahaoPublisher.ts");
    expect(src).toContain("uploadPlatformCover");
    expect(src).toContain("extractBaijiahaoPublicUrl");
    expect(src).not.toContain("skipCover: true");
  });

  it("toutiao publisher skips cover but uses iframe fill", () => {
    const src = read("local-agent/src/agent/platforms/toutiaoPublisher.ts");
    expect(src).toContain("skipCover: true");
    expect(src).toContain("fillFirstSelectorInPageOrFrames");
    expect(src).toContain("extractToutiaoPublicUrl");
  });

  it("each platform tags errors with platformTag in mp config", () => {
    for (const file of [
      "local-agent/src/agent/platforms/sohuPublisher.ts",
      "local-agent/src/agent/platforms/baijiahaoPublisher.ts",
      "local-agent/src/agent/platforms/toutiaoPublisher.ts",
    ]) {
      const src = read(file);
      expect(src).toMatch(/platformTag:\s*"(sohu|baijiahao|toutiao)"/);
    }
  });
});
