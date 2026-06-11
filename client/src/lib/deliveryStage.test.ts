import { describe, expect, it } from "vitest";
import {
  buildStageActionUrl,
  buildWorkspaceDeliveryConclusion,
  formatDeliveryStageCustomerLabel,
  formatStageActionLabel,
  resolveDeliveryPhaseCustomerView,
  resolveDeliveryPhaseId,
  resolveStageActionPath,
} from "./deliveryStage";

describe("formatDeliveryStageCustomerLabel", () => {
  it("maps S1–S8 engineering enums to customer-facing status labels", () => {
    expect(formatDeliveryStageCustomerLabel("S1_PROFILE_INCOMPLETE")).toBe("待完善企业档案");
    expect(formatDeliveryStageCustomerLabel("S2_READY_FOR_DIAGNOSIS")).toBe("待启动 AI 诊断");
    expect(formatDeliveryStageCustomerLabel("S3_READY_FOR_CONTENT")).toBe("待生成内容");
    expect(formatDeliveryStageCustomerLabel("S4_READY_FOR_PUBLISH")).toBe("待发布内容");
    expect(formatDeliveryStageCustomerLabel("S5_WAITING_LINKS")).toBe("内容发布中");
    expect(formatDeliveryStageCustomerLabel("S6_READY_FOR_MONITORING")).toBe("待收录复测");
    expect(formatDeliveryStageCustomerLabel("S7_READY_FOR_REPORT")).toBe("待生成交付报告");
    expect(formatDeliveryStageCustomerLabel("S8_DELIVERED_OR_NEXT_ROUND")).toBe("已完成交付");
    expect(formatDeliveryStageCustomerLabel("S4_READY_FOR_PUBLISH")).not.toContain("S4_");
  });
});

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

describe("delivery phase customer mapping", () => {
  it("maps S1–S8 to six customer delivery phases", () => {
    expect(resolveDeliveryPhaseId("S1_PROFILE_INCOMPLETE")).toBe("profile");
    expect(resolveDeliveryPhaseId("S2_READY_FOR_DIAGNOSIS")).toBe("ai_detection");
    expect(resolveDeliveryPhaseId("S3_READY_FOR_CONTENT")).toBe("content_optimization");
    expect(resolveDeliveryPhaseId("S4_READY_FOR_PUBLISH")).toBe("publish_execution");
    expect(resolveDeliveryPhaseId("S6_READY_FOR_MONITORING")).toBe("retest_validation");
    expect(resolveDeliveryPhaseId("S7_READY_FOR_REPORT")).toBe("report_delivery");
    const phase = resolveDeliveryPhaseCustomerView("S2_READY_FOR_DIAGNOSIS");
    expect(phase.phaseTitle).toBe("AI检测期");
    expect(phase.phaseDescription).toBe("检测AI目前是否推荐你");
    expect(phase.currentStageHeadline).toBe("AI 现状检测");
    expect(phase.currentStageHeadline).not.toContain("S2_");
  });

  it("builds workspace conclusion from main chain reason first", () => {
    const line = buildWorkspaceDeliveryConclusion(
      { stageDescription: "desc", blockingReasons: ["阻断"] },
      { mainChainReason: "品牌资料已初步建立，但还缺少AI实测数据" },
    );
    expect(line).toBe("品牌资料已初步建立，但还缺少AI实测数据");
  });
});
