import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getContentQualityGateStatus, isContentQualityPassed } from "@shared/contentQualityGate";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf-8");
}

describe("contentQualityGate", () => {
  it("passes when geoQualityRecommendation is publish", () => {
    const gate = getContentQualityGateStatus({
      geoQualityScore: 85,
      geoQualityRecommendation: "publish",
    });
    expect(gate.passed).toBe(true);
    expect(gate.reason).toBe("passed");
  });

  it("passes when geoQualityRecommendation is revise", () => {
    expect(
      isContentQualityPassed({
        geoQualityScore: 70,
        geoQualityRecommendation: "revise",
      }),
    ).toBe(true);
  });

  it("missing when no qa signals", () => {
    const gate = getContentQualityGateStatus({
      lifecycleStatus: "generated",
      status: "已生成",
    });
    expect(gate.passed).toBe(false);
    expect(gate.reason).toBe("missing");
    expect(gate.message).toContain("尚未进行发布前质检");
  });

  it("failed when geoQualityRecommendation is reject", () => {
    const gate = getContentQualityGateStatus({
      geoQualityScore: 40,
      geoQualityRecommendation: "reject",
    });
    expect(gate.passed).toBe(false);
    expect(gate.reason).toBe("failed");
    expect(gate.message).toContain("未通过");
  });

  it("failed when lifecycle is needs_revision", () => {
    const gate = getContentQualityGateStatus({
      lifecycleStatus: "needs_revision",
      status: "质检未通过",
    });
    expect(gate.passed).toBe(false);
    expect(gate.reason).toBe("failed");
  });
});

describe("contentQualityGate publish integration", () => {
  it("recognizes auto-rewrite quality_checked lifecycle as passed", () => {
    const gate = getContentQualityGateStatus({
      lifecycleStatus: "quality_checked",
      lifecycleEvents: [
        {
          status: "quality_checked",
          at: "2026-05-26T08:00:00.000Z",
          source: "quality_check",
          message: "GEO 质检通过（自动重写后）",
        },
      ],
      status: "质检通过",
    });
    expect(gate.passed).toBe(true);
    expect(gate.reason).toBe("passed");
  });

  it("publishTasksRouter uses unified publish preflight", () => {
    const router = read("server/publishTasksRouter.ts");
    expect(router).toContain("evaluatePublishPreflight");
    expect(router).toContain("assertPublishReadinessForCreate");
    expect(router).toContain("formatPublishPreflightBlockMessage");
  });

  it("WeeklyContentPage uses unified publish readiness for dialog", () => {
    const page = read("client/src/pages/WeeklyContentPage.tsx");
    expect(page).toContain("evaluatePublishPreflight");
    expect(page).toContain("publish-readiness-block");
    expect(page).toContain("border-amber-200 bg-amber-50");
    expect(page).toContain("text-amber-800");
    expect(page).not.toContain("AiStatusBadge tone=\"success\"");
  });
});
