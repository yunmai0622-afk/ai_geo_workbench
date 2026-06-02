import { describe, expect, it } from "vitest";
import {
  buildStageActionUrl,
  formatStageActionLabel,
  resolveStageActionPath,
} from "./deliveryStage";

describe("formatStageActionLabel", () => {
  it("maps S1–S8 to stage-specific CTA labels", () => {
    expect(formatStageActionLabel("S1_PROFILE_INCOMPLETE")).toBe("继续建档");
    expect(formatStageActionLabel("S2_READY_FOR_DIAGNOSIS")).toBe("开始 AI 诊断");
    expect(formatStageActionLabel("S3_READY_FOR_CONTENT")).toBe("生成内容资产");
    expect(formatStageActionLabel("S4_READY_FOR_PUBLISH")).toBe("去发布内容");
    expect(formatStageActionLabel("S5_WAITING_LINKS")).toBe("去回填链接");
    expect(formatStageActionLabel("S6_READY_FOR_MONITORING")).toBe("执行复测");
    expect(formatStageActionLabel("S7_READY_FOR_REPORT")).toBe("生成交付报告");
    expect(formatStageActionLabel("S8_DELIVERED_OR_NEXT_ROUND")).toBe("查看报告");
  });
});

describe("resolveStageActionPath", () => {
  it("maps each stage to the P0 main-chain path", () => {
    expect(resolveStageActionPath("S1_PROFILE_INCOMPLETE")).toBe("/enterprise-profile");
    expect(resolveStageActionPath("S2_READY_FOR_DIAGNOSIS")).toBe("/ai-diagnosis");
    expect(resolveStageActionPath("S3_READY_FOR_CONTENT")).toBe("/weekly");
    expect(resolveStageActionPath("S4_READY_FOR_PUBLISH")).toBe("/content-publishing");
    expect(resolveStageActionPath("S5_WAITING_LINKS")).toBe("/content-publishing");
    expect(resolveStageActionPath("S6_READY_FOR_MONITORING")).toBe("/inclusion-monitoring");
    expect(resolveStageActionPath("S7_READY_FOR_REPORT")).toBe("/delivery-reports");
    expect(resolveStageActionPath("S8_DELIVERED_OR_NEXT_ROUND")).toBe("/delivery-reports");
  });
});

describe("buildStageActionUrl", () => {
  it("appends projectId and waiting_links filter for S5", () => {
    expect(buildStageActionUrl("S5_WAITING_LINKS", 42)).toBe(
      "/content-publishing?projectId=42&filter=waiting_links",
    );
    expect(buildStageActionUrl("S4_READY_FOR_PUBLISH", 7)).toBe("/content-publishing?projectId=7");
  });
});
