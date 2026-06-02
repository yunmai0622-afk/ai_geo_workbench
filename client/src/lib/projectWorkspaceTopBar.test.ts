import { describe, expect, it } from "vitest";
import { resolveProjectTopBarPresentation } from "./projectWorkspaceTopBar";
import type { WorkspaceStageDefinition } from "@shared/workspaceStateMachine";

const bindStage: WorkspaceStageDefinition = {
  id: "bind_publish_env",
  label: "待绑定发布环境",
  blockerHint: "",
  ctaLabel: "去绑定发布账号",
  ctaPath: "/enterprise-profile",
  ctaHash: "#publish-platform-accounts",
};

describe("resolveProjectTopBarPresentation", () => {
  it("有 CTA 时隐藏阶段徽标，只保留操作按钮文案", () => {
    expect(resolveProjectTopBarPresentation("待绑定发布", bindStage)).toEqual({
      stageBadgeLabel: null,
      actionLabel: "去绑定发布账号",
    });
  });

  it("无 CTA 时仅展示阶段徽标", () => {
    expect(resolveProjectTopBarPresentation("待建档", null)).toEqual({
      stageBadgeLabel: "待建档",
      actionLabel: null,
    });
  });
});
