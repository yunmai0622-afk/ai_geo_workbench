import { describe, expect, it } from "vitest";
import {
  buildDisplayReportNumber,
  formatBaselinePercent,
  mentionRateNarrative,
  resolveVisibilityScoreTier,
} from "./deliveryReportLightDisplay";

describe("deliveryReportLightDisplay", () => {
  it("builds display report number from projectId and date", () => {
    const n = buildDisplayReportNumber({
      projectId: 72,
      reportGeneratedAt: new Date("2026-05-22T10:00:00"),
    });
    expect(n).toBe("GEO-202605-072");
  });

  it("formats zero mention as baseline", () => {
    expect(formatBaselinePercent(0, true)).toBe("基线阶段（0%）");
    expect(mentionRateNarrative(0, true)).toContain("基线阶段");
  });

  it("resolves score tiers", () => {
    expect(resolveVisibilityScoreTier(20).label).toBe("起步阶段");
    expect(resolveVisibilityScoreTier(50).label).toBe("初步可见");
    expect(resolveVisibilityScoreTier(70).label).toBe("部分可见");
    expect(resolveVisibilityScoreTier(90).label).toBe("稳定可见");
  });
});
