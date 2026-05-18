import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");

describe("V1.0 UI 与客户路径硬验收脚本", () => {
  it("通过首页、导航、核心三步流程、状态引导条、内容生产、平台发布和报告中心静态验收", () => {
    const output = execFileSync("node", ["scripts/v12_ui_acceptance_check.mjs"], {
      cwd: projectRoot,
      encoding: "utf-8",
    });
    expect(output).toContain("V1.0 UI 硬验收通过");
  });
});
