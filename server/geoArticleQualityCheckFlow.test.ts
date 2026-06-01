import { afterEach, describe, expect, it } from "vitest";
import { resolveGeoQcFlowMaxMs, resolveGeoQcRewriteTimeoutMs } from "./geoArticleQualityCheckFlow";

describe("geoArticleQualityCheckFlow timing config", () => {
  const prevFlow = process.env.GEO_QC_FLOW_MAX_MS;
  const prevRewrite = process.env.GEO_QC_REWRITE_TIMEOUT_MS;

  afterEach(() => {
    if (prevFlow === undefined) delete process.env.GEO_QC_FLOW_MAX_MS;
    else process.env.GEO_QC_FLOW_MAX_MS = prevFlow;
    if (prevRewrite === undefined) delete process.env.GEO_QC_REWRITE_TIMEOUT_MS;
    else process.env.GEO_QC_REWRITE_TIMEOUT_MS = prevRewrite;
  });

  it("defaults QC flow and rewrite timeouts", () => {
    delete process.env.GEO_QC_FLOW_MAX_MS;
    delete process.env.GEO_QC_REWRITE_TIMEOUT_MS;
    expect(resolveGeoQcFlowMaxMs()).toBe(30_000);
    expect(resolveGeoQcRewriteTimeoutMs()).toBe(25_000);
  });

  it("reads env overrides when positive", () => {
    process.env.GEO_QC_FLOW_MAX_MS = "12000";
    process.env.GEO_QC_REWRITE_TIMEOUT_MS = "8000";
    expect(resolveGeoQcFlowMaxMs()).toBe(12_000);
    expect(resolveGeoQcRewriteTimeoutMs()).toBe(8_000);
  });
});
