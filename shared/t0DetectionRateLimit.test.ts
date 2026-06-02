import { describe, expect, it } from "vitest";
import {
  PROFESSIONAL_T0_DETECTION_PER_HOUR_LIMIT,
  resolveT0DetectionPerHourLimit,
} from "./t0DetectionRateLimit";

describe("resolveT0DetectionPerHourLimit", () => {
  const base = { configuredBasicLimit: 1 };

  it("exempts admin regardless of plan", () => {
    expect(resolveT0DetectionPerHourLimit({ ...base, isAdmin: true, planId: "basic" })).toBeNull();
    expect(
      resolveT0DetectionPerHourLimit({ ...base, isAdmin: true, planId: "professional" }),
    ).toBeNull();
  });

  it("uses 5/hour for professional and enterprise", () => {
    expect(
      resolveT0DetectionPerHourLimit({ ...base, isAdmin: false, planId: "professional" }),
    ).toBe(PROFESSIONAL_T0_DETECTION_PER_HOUR_LIMIT);
    expect(
      resolveT0DetectionPerHourLimit({ ...base, isAdmin: false, planId: "enterprise" }),
    ).toBe(PROFESSIONAL_T0_DETECTION_PER_HOUR_LIMIT);
  });

  it("uses configured limit for basic plan", () => {
    expect(resolveT0DetectionPerHourLimit({ ...base, isAdmin: false, planId: "basic" })).toBe(1);
    expect(
      resolveT0DetectionPerHourLimit({
        isAdmin: false,
        planId: "basic",
        configuredBasicLimit: 2,
      }),
    ).toBe(2);
  });
});
