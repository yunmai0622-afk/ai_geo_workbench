import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AI_OBSERVATION_LEDGER_FEATURE_FLAG, LEGACY_UNDERSTANDING_EVALUATION_BOUNDARY, isAiObservationLedgerV2Enabled } from "./aiObservationLedgerService";
const schema = readFileSync("drizzle/schema.ts", "utf8");
const migration = readFileSync("drizzle/0073_ai_observation_ledger.sql", "utf8");
const service = readFileSync("server/aiObservationLedgerService.ts", "utf8");

describe("PR-03.6A AI Observation Ledger", () => {
  it("creates six explicit project-owned domain tables", () => {
    for (const table of ["ai_observation_runs","ai_observation_answers","ai_observation_extractions","ai_extracted_brand_facts","ai_recommendation_results","ai_citation_results"]) {
      expect(migration).toContain(`CREATE TABLE \`${table}\``);
      expect(schema).toContain(`"${table}"`);
    }
    expect(migration.match(/`projectId` int NOT NULL/g)).toHaveLength(6);
  });
  it("stores answer snapshots, retries and nullable provider measurements", () => {
    for (const field of ["questionTextSnapshot","questionVersionSnapshot","scenarioSnapshot","attemptNumber","providerResponseId","rawAnswer","rawProviderMetadata","answerContentHash","latencyMs","inputTokens","outputTokens","totalTokens"]) expect(schema).toContain(field);
    expect(migration).toContain("`providerResponseId` varchar(255) NULL");
    expect(migration).toContain("`latencyMs` int NULL");
  });
  it("has database append-only triggers for answer, extraction and every child result", () => {
    for (const table of ["ai_observation_answers","ai_observation_extractions","ai_extracted_brand_facts","ai_recommendation_results","ai_citation_results"]) {
      expect(migration).toContain(`CREATE TRIGGER \`${table}_no_update\``);
      expect(migration).toContain(`CREATE TRIGGER \`${table}_no_delete\``);
    }
  });
  it("uses composite project foreign keys at every parent-child boundary", () => {
    expect(migration.match(/FOREIGN KEY \(`[^`]+`,`projectId`\)/g)).toHaveLength(5);
    expect(migration.match(/REFERENCES `ai_/g)).toHaveLength(5);
  });
  it("keeps mention, candidate, recommendation, rank and citation independent", () => {
    for (const field of ["mentionStatus","candidateStatus","recommendationStatus","recommendationRank","citationStatus"]) expect(schema).toContain(field);
    expect(schema).toContain('["detected", "not_detected", "unknown"]');
    expect(schema).toContain('["entered", "not_entered", "unknown"]');
    expect(schema).toContain('["recommended", "not_recommended", "unknown"]');
  });
  it("allows multiple extraction versions and attempts without overwrite", () => {
    expect(migration).toContain("ai_observation_extractions_answer_attempt_unique");
    expect(service).toContain("await tx.insert(aiObservationExtractions)");
    expect(service).not.toMatch(/update\(aiObservationExtractions\)|delete\(aiObservationExtractions\)/);
  });
  it("preserves failed/unsupported states without collapsing to not_detected", () => {
    expect(schema).toContain('"extraction_failed"');
    expect(schema).toContain('"unsupported"');
    expect(service).toContain("citation unsupported cannot be stored as not_detected");
    expect(service).toContain("citation extraction_failed cannot be stored as not_detected");
  });
  it("defaults the feature flag off and never writes legacy evaluations", () => {
    delete process.env.AI_OBSERVATION_LEDGER_V2;
    expect(AI_OBSERVATION_LEDGER_FEATURE_FLAG).toBe("ai_observation_ledger_v2");
    expect(isAiObservationLedgerV2Enabled()).toBe(false);
    expect(LEGACY_UNDERSTANDING_EVALUATION_BOUNDARY).toBe("legacy-read-only-no-observation-dual-write");
    expect(service).not.toContain("understandingEvaluations");
  });
});
