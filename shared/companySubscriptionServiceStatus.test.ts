import { describe, expect, it } from "vitest";
import {
  computeSubscriptionServiceStatus,
  isSubscriptionHighRenewalRisk,
} from "./companySubscriptionServiceStatus";

describe("companySubscriptionServiceStatus", () => {
  const now = new Date("2026-06-01T12:00:00Z");

  it("returns not_configured without subscription", () => {
    expect(computeSubscriptionServiceStatus(null, now)).toBe("not_configured");
  });

  it("returns pending_start when startedAt is in the future", () => {
    expect(
      computeSubscriptionServiceStatus(
        {
          status: "active",
          startedAt: new Date("2026-07-01"),
          expiresAt: new Date("2026-12-31"),
        },
        now,
      ),
    ).toBe("pending_start");
  });

  it("returns expiring_soon within 30 days", () => {
    expect(
      computeSubscriptionServiceStatus(
        {
          status: "active",
          startedAt: new Date("2026-01-01"),
          expiresAt: new Date("2026-06-25"),
        },
        now,
      ),
    ).toBe("expiring_soon");
  });

  it("returns expired after expiry date", () => {
    expect(
      computeSubscriptionServiceStatus(
        {
          status: "active",
          startedAt: new Date("2026-01-01"),
          expiresAt: new Date("2026-05-01"),
        },
        now,
      ),
    ).toBe("expired");
  });

  it("returns paused for manual pause", () => {
    expect(
      computeSubscriptionServiceStatus(
        {
          status: "paused",
          startedAt: new Date("2026-01-01"),
          expiresAt: new Date("2026-12-31"),
        },
        now,
      ),
    ).toBe("paused");
  });

  it("flags high renewal risk for expired or 7-day window", () => {
    expect(isSubscriptionHighRenewalRisk("expired", new Date("2026-05-01"), now)).toBe(true);
    expect(isSubscriptionHighRenewalRisk("expiring_soon", new Date("2026-06-05"), now)).toBe(true);
    expect(isSubscriptionHighRenewalRisk("in_service", new Date("2026-12-31"), now)).toBe(false);
  });
});
