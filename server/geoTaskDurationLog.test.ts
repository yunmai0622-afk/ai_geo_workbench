import { describe, expect, it, vi, afterEach } from "vitest";
import { logGeoAnalysisRunDuration, logGeoArticlesGenerateDuration } from "./geoTaskDurationLog";

describe("geoTaskDurationLog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs geo.analysis.run with required fields", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    logGeoAnalysisRunDuration({
      projectId: 12,
      provider: "openai",
      model: "gpt-test",
      startedAt: new Date().toISOString(),
      durationMs: 1200,
      success: true,
      errorCode: null,
    });
    expect(info).toHaveBeenCalled();
    const payload = JSON.parse(String(info.mock.calls[0]?.[1]));
    expect(payload).toMatchObject({
      action: "geo.analysis.run",
      projectId: 12,
      provider: "openai",
      model: "gpt-test",
      durationMs: 1200,
      success: true,
      errorCode: null,
    });
  });

  it("logs geo.articles.generate failures to stderr", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    logGeoArticlesGenerateDuration({
      projectId: 3,
      platform: "zhihu",
      provider: "openai",
      model: "gpt-test",
      startedAt: new Date().toISOString(),
      durationMs: 900,
      success: false,
      errorCode: "timeout",
    });
    expect(error).toHaveBeenCalled();
    const payload = JSON.parse(String(error.mock.calls[0]?.[1]));
    expect(payload.action).toBe("geo.articles.generate");
    expect(payload.platform).toBe("zhihu");
    expect(payload.success).toBe(false);
    expect(payload.errorCode).toBe("timeout");
  });

  it("logs geo.articles.generate step timings when provided", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    logGeoArticlesGenerateDuration({
      projectId: 5,
      platform: null,
      provider: "openai",
      model: "gpt-test",
      startedAt: new Date().toISOString(),
      durationMs: 58_000,
      success: true,
      errorCode: null,
      stepTimings: {
        dbPrefetchMs: 320,
        draftGenerationMs: 41_000,
        dbPersistMs: 85,
        qualityCheckMs: 16_500,
        autoRewriteCount: 1,
      },
    });
    const payload = JSON.parse(String(info.mock.calls[0]?.[1]));
    expect(payload.stepTimings.draftGenerationMs).toBe(41_000);
    expect(payload.stepTimings.autoRewriteCount).toBe(1);
  });
});
