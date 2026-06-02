import { describe, expect, it } from "vitest";
import {
  computeDeliveryReportShareExpiresAt,
  DELIVERY_REPORT_SHARE_RENEWAL_REMINDER_DAYS,
  DELIVERY_REPORT_SHARE_VALIDITY_DAYS,
  resolveDeliveryReportShareRenewalReminder,
} from "./deliveryReportPublicShare";

describe("delivery report share renewal reminder", () => {
  const now = new Date("2026-06-01T12:00:00.000Z");

  it("returns null when share link has no expiry", () => {
    expect(resolveDeliveryReportShareRenewalReminder(null, now)).toBeNull();
  });

  it("returns null when more than reminder window days remain", () => {
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + DELIVERY_REPORT_SHARE_RENEWAL_REMINDER_DAYS + 1);
    expect(resolveDeliveryReportShareRenewalReminder(expiresAt, now)).toBeNull();
  });

  it("returns reminder when within reminder window", () => {
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 3);
    const reminder = resolveDeliveryReportShareRenewalReminder(expiresAt, now);
    expect(reminder).not.toBeNull();
    expect(reminder?.daysRemaining).toBe(3);
    expect(reminder?.ctaLabel).toBe("一键续期");
    expect(reminder?.message).toContain("3 天后过期");
  });

  it("returns reminder on the last day before expiry", () => {
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 1);
    const reminder = resolveDeliveryReportShareRenewalReminder(expiresAt, now);
    expect(reminder?.daysRemaining).toBe(1);
  });

  it("returns null when already expired", () => {
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() - 1);
    expect(resolveDeliveryReportShareRenewalReminder(expiresAt, now)).toBeNull();
  });

  it("computeDeliveryReportShareExpiresAt extends validity by configured days", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const expiresAt = computeDeliveryReportShareExpiresAt(from);
    expect(expiresAt.getTime() - from.getTime()).toBe(DELIVERY_REPORT_SHARE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
  });
});
