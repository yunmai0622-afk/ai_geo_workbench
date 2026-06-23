import { describe, expect, it } from "vitest";
import {
  shouldDisablePlatformGenerateButton,
  showSerialGenerationHint,
  WEEKLY_SERIAL_GENERATION_HINT,
} from "./weeklyContentTaskBoard";

describe("weeklyContentTaskBoard serial generation", () => {
  it("uses updated serial hint copy", () => {
    expect(WEEKLY_SERIAL_GENERATION_HINT).toBe("当前已有平台稿正在生成，稍后可继续");
  });

  it("disables other platforms when only DB in-flight key is known", () => {
    expect(
      shouldDisablePlatformGenerateButton({
        status: "UNGENERATED",
        boardBusy: false,
        generatingPlatformKey: null,
        activeInFlightPlatformKey: "zhihu",
        platformKey: "wechat",
        anyGenerating: true,
      }),
    ).toBe(true);
  });

  it("shows serial hint when in-flight platform differs", () => {
    expect(
      showSerialGenerationHint({
        anyGenerating: true,
        generatingPlatformKey: null,
        activeInFlightPlatformKey: "zhihu",
        platformKey: "wechat",
        actionKind: "generate",
      }),
    ).toBe(true);
  });
});
