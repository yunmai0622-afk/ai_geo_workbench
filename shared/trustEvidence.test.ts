import { describe, expect, it } from "vitest";
import { computeTrustEvidenceMaturityScore } from "./trustEvidence";

describe("computeTrustEvidenceMaturityScore", () => {
  it("returns 0 when no trust evidence and no customer cases", () => {
    const result = computeTrustEvidenceMaturityScore({
      verifiedCount: 0,
      draftCount: 0,
      rejectedCount: 0,
      totalTrustEvidenceCount: 0,
      customerCaseCount: 0,
    });
    expect(result.score).toBe(0);
    expect(result.breakdown.baseScore).toBe(0);
    expect(result.breakdown.customerCaseBonus).toBe(0);
  });

  it("returns 20 when only draft evidence exists", () => {
    const result = computeTrustEvidenceMaturityScore({
      verifiedCount: 0,
      draftCount: 2,
      rejectedCount: 0,
      totalTrustEvidenceCount: 2,
      customerCaseCount: 0,
    });
    expect(result.score).toBe(20);
    expect(result.breakdown.baseScore).toBe(20);
  });

  it("scores verified evidence tiers and caps at 100 with customer case bonus", () => {
    expect(
      computeTrustEvidenceMaturityScore({
        verifiedCount: 1,
        draftCount: 0,
        rejectedCount: 0,
        totalTrustEvidenceCount: 1,
        customerCaseCount: 0,
      }).score,
    ).toBe(50);

    expect(
      computeTrustEvidenceMaturityScore({
        verifiedCount: 3,
        draftCount: 0,
        rejectedCount: 0,
        totalTrustEvidenceCount: 3,
        customerCaseCount: 0,
      }).score,
    ).toBe(80);

    expect(
      computeTrustEvidenceMaturityScore({
        verifiedCount: 5,
        draftCount: 0,
        rejectedCount: 0,
        totalTrustEvidenceCount: 5,
        customerCaseCount: 0,
      }).score,
    ).toBe(100);

    expect(
      computeTrustEvidenceMaturityScore({
        verifiedCount: 5,
        draftCount: 0,
        rejectedCount: 0,
        totalTrustEvidenceCount: 5,
        customerCaseCount: 2,
      }).score,
    ).toBe(100);
  });

  it("adds customer case bonus when trust evidence is empty", () => {
    const result = computeTrustEvidenceMaturityScore({
      verifiedCount: 0,
      draftCount: 0,
      rejectedCount: 0,
      totalTrustEvidenceCount: 0,
      customerCaseCount: 1,
    });
    expect(result.score).toBe(10);
    expect(result.breakdown.customerCaseBonus).toBe(10);
  });
});
