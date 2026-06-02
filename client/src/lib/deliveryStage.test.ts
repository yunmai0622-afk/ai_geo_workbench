import { describe, expect, it } from "vitest";
import { formatStageActionLabel } from "./deliveryStage";

describe("formatStageActionLabel", () => {
  it("maps S3–S7 to stage-specific CTA labels", () => {
    expect(formatStageActionLabel("S3_READY_FOR_CONTENT")).toBe("去生成内容");
    expect(formatStageActionLabel("S4_READY_FOR_PUBLISH")).toBe("去发布内容");
    expect(formatStageActionLabel("S5_WAITING_LINKS")).toBe("去回填链接");
    expect(formatStageActionLabel("S6_READY_FOR_MONITORING")).toBe("去执行复测");
    expect(formatStageActionLabel("S7_READY_FOR_REPORT")).toBe("去生成报告");
  });

  it("uses 进入工作台 for other stages", () => {
    expect(formatStageActionLabel("S1_PROFILE_INCOMPLETE")).toBe("进入工作台");
    expect(formatStageActionLabel("S2_READY_FOR_DIAGNOSIS")).toBe("进入工作台");
    expect(formatStageActionLabel("S8_DELIVERED_OR_NEXT_ROUND")).toBe("进入工作台");
  });
});
