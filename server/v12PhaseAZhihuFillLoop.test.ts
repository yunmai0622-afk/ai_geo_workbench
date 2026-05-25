import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("Phase A — 知乎 Local Agent 填稿闭环", () => {
  it("zhihuPublisher waits for editor before success", () => {
    const src = read("local-agent/src/agent/platforms/zhihuPublisher.ts");
    expect(src).toContain("waitForWriteEditor");
    expect(src).toContain("write_page_not_found");
    expect(src).not.toMatch(/mock|fake.*success/i);
  });

  it("basePublisher fill steps without auto fake draft_saved", () => {
    const base = read("local-agent/src/agent/platforms/basePublisher.ts");
    expect(base).toContain("fill_title");
    expect(base).toContain("fill_content");
    expect(base).toContain("manual_required");
    expect(base).toContain("未检测到保存草稿成功证据");
  });

  it("publishWorker logs report_result", () => {
    const pw = read("local-agent/src/agent/publishWorker.ts");
    expect(pw).toContain("report_result");
    expect(pw).toContain("reportPublishOutcome");
    expect(pw).not.toMatch(/draft_saved.*mock/i);
  });

  it("zhihu publish overrides base with fill steps", () => {
    const zh = read("local-agent/src/agent/platforms/zhihuPublisher.ts");
    expect(zh).toContain("override async publish");
    expect(zh).toContain("fillZhihuContent");
  });
});
