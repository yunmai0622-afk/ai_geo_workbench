import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyLegacyEvaluation, deterministicLegacyId, legacyConfidenceBasisPoints } from "./legacyUnderstandingMigrationService";
import { composeUnderstandRead, effectiveRollout, executeExclusiveUnderstandWrite, LEGACY_PRESENTATION } from "./understandReadService";

const complete = {
  id: "legacy-1", projectId: 10, rawAnswer: "原始完整回答", testedModel: "real-model", testedChannel: "real-channel",
  testedAt: new Date("2026-01-01"), extractedFacts: { actual: true }, ruleResults: {}, semanticJudgement: { confidence: 0.83 },
} as never;
const governance = { questionText: "原始问题", questionVersionId: "qv", questionVersion: 1, extractionVersionId: "ev", methodologyVersionId: "mv", ruleVersionId: "rv", truthProfileVersionId: "tv" };

describe("legacy understanding cutover", () => {
  it("defaults every project to legacy-only while the global flag is false", () => {
    expect(effectiveRollout(false, { readMode: "v2_only", writePath: "v2" })).toEqual({ readMode: "legacy_only", writePath: "legacy" });
    expect(effectiveRollout(true, null)).toEqual({ readMode: "legacy_only", writePath: "legacy" });
    expect(effectiveRollout(true, { readMode: "shadow_read", writePath: "v2" })).toEqual({ readMode: "shadow_read", writePath: "legacy" });
    expect(effectiveRollout(true, { readMode: "v2_primary", writePath: "legacy" })).toEqual({ readMode: "v2_primary", writePath: "v2" });
  });
  it("routes each real run to exactly one write path", async () => {
    expect([effectiveRollout(false, null).writePath]).toHaveLength(1);
    expect([effectiveRollout(true, { readMode: "v2_only", writePath: "v2" }).writePath]).toEqual(["v2"]);
    const calls: string[] = [];
    await executeExclusiveUnderstandWrite("v2", { legacy: async () => calls.push("legacy"), v2: async () => calls.push("v2") });
    expect(calls).toEqual(["v2"]);
  });
  it("preserves legacy display but excludes it from formal trends", () => {
    const result = composeUnderstandRead("v2_primary", [{ id: "legacy" }], [{ id: "formal" }]);
    expect(result.legacyHistory[0]).toMatchObject({ presentation: LEGACY_PRESENTATION });
    expect(result.trend).toEqual([{ id: "formal" }]);
    expect(LEGACY_PRESENTATION.directlyComparableToFormalAssessment).toBe(false);
  });
  it("shadow reads compare both sources while customers still receive legacy primary", () => {
    const result = composeUnderstandRead("shadow_read", [{ id: "legacy" }], [{ id: "formal" }]);
    expect(result.primary[0]).toMatchObject({ id: "legacy" });
    expect(result.shadowComparison).toEqual({ legacyCount: 1, v2Count: 1 });
  });
  it("only fully restorable records create formal assessments", () => {
    expect(classifyLegacyEvaluation(complete, governance)).toMatchObject({ status: "migratable", createAssessment: true });
    expect(classifyLegacyEvaluation({ ...complete, semanticJudgement: null } as never, governance)).toMatchObject({ status: "partially_migratable", createAssessment: false, missingFields: ["assessmentConfidence"] });
    expect(classifyLegacyEvaluation({ ...complete, rawAnswer: "" } as never, governance)).toMatchObject({ status: "legacy_non_reproducible", createObservation: false });
  });
  it("never invents a confidence value and preserves deterministic target identity", () => {
    expect(legacyConfidenceBasisPoints(null)).toBeNull();
    expect(legacyConfidenceBasisPoints({ confidence: 0.83 })).toBe(8300);
    expect(deterministicLegacyId(10, "legacy-1", "answer")).toBe(deterministicLegacyId(10, "legacy-1", "answer"));
  });
  it("0075 is additive and the migration service never mutates the legacy table", () => {
    const sql = readFileSync("drizzle/0075_legacy_understanding_cutover.sql", "utf8");
    expect(sql).not.toMatch(/^\s*(?:ALTER|DROP|UPDATE|DELETE|INSERT)\b/im);
    const service = readFileSync("server/legacyUnderstandingMigrationService.ts", "utf8");
    expect(service).not.toMatch(/(?:update|delete)\(understandingEvaluations\)/);
    expect(service).toContain("eq(understandingEvaluations.projectId, projectId)");
  });
  it("dry-run remains SELECT-only and preserves the original answer on execute", () => {
    const service = readFileSync("server/legacyUnderstandingMigrationService.ts", "utf8");
    const dryRunBody = service.slice(service.indexOf("async dryRun"), service.indexOf("async migrateProject"));
    expect(dryRunBody).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
    expect(service).toContain("rawAnswer: row.rawAnswer");
    expect(service).toContain("providerResponseId: null");
    expect(service).toContain("latencyMs: null");
  });
});
