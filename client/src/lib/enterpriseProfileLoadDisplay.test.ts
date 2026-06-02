import { describe, expect, it } from "vitest";
import { GENERIC_LOAD_FAILED_MESSAGE } from "@shared/userFacingErrors";
import {
  PROFILE_CORE_LOAD_FAILED_MESSAGE,
  profileSaveFailureMessage,
  shouldShowProfileCoreLoadFailure,
  shouldShowProfileNonCriticalSummaryHint,
} from "./enterpriseProfileLoadDisplay";

describe("enterpriseProfileLoadDisplay", () => {
  it("shows core failure only when summary missing and no renderable profile", () => {
    expect(
      shouldShowProfileCoreLoadFailure({
        summaryError: true,
        hasSummaryData: false,
        isFetched: true,
        hasRenderableProfile: false,
      }),
    ).toBe(true);
    expect(
      shouldShowProfileCoreLoadFailure({
        summaryError: true,
        hasSummaryData: false,
        isFetched: true,
        hasRenderableProfile: true,
      }),
    ).toBe(false);
  });

  it("does not show non-critical hint at 100% completeness", () => {
    expect(
      shouldShowProfileNonCriticalSummaryHint({
        summaryError: true,
        hasRenderableProfile: true,
        profileCompletenessPercent: 100,
      }),
    ).toBe(false);
  });

  it("allows non-critical hint when profile is usable but summary errored", () => {
    expect(
      shouldShowProfileNonCriticalSummaryHint({
        summaryError: true,
        hasRenderableProfile: true,
        profileCompletenessPercent: 80,
      }),
    ).toBe(true);
  });

  it("maps save failures without swallowing", () => {
    expect(profileSaveFailureMessage("字段校验失败")).toBe("字段校验失败");
    expect(profileSaveFailureMessage(GENERIC_LOAD_FAILED_MESSAGE)).toBe("保存失败，请稍后重试。");
  });

  it("uses customer-facing core load copy", () => {
    expect(PROFILE_CORE_LOAD_FAILED_MESSAGE).toContain("企业资料暂时无法加载");
  });
});
