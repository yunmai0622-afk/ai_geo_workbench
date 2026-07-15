import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("drizzle/0074_versioned_understand_governance.sql", "utf8");
const schema = readFileSync("drizzle/schema.ts", "utf8");
const service = readFileSync("server/versionedUnderstandGovernanceService.ts", "utf8");

const tables = [
  "brand_fact_definitions", "brand_fact_definition_versions", "brand_fact_industry_template_versions", "brand_fact_industry_template_items",
  "understanding_question_set_versions", "understanding_question_versions", "understanding_methodology_registry", "understanding_methodology_versions",
  "understanding_methodology_dimension_weights", "understanding_extraction_version_registry", "understanding_rule_sets", "understanding_rule_versions",
  "understanding_assessments", "understanding_assessment_dimension_results", "understanding_assessment_rule_results", "understanding_assessment_manual_reviews",
];

describe("PR-03.6B versioned Understand governance", () => {
  it("creates every governance object with forward-only DDL", () => {
    for (const table of tables) {
      expect(migration).toContain(`CREATE TABLE \`${table}\``);
      expect(schema).toContain(`"${table}"`);
    }
    expect(migration).not.toMatch(/\b(?:ALTER|DROP|TRUNCATE|DELETE|UPDATE)\b/i);
  });

  it("versions fact semantics, question snapshots, methodology, extraction and P0/P1/P2 rules", () => {
    for (const token of ["required','optional','not_applicable", "valueType", "cardinality", "temporalSemantics", "questionTextSnapshot", "scenarioSnapshot", "targetAudienceSnapshot", "purchaseIntent", "coveragePolicy", "confidencePolicy", "weightBasisPoints", "implementationVersion", "P0','P1','P2"]) {
      expect(migration).toContain(token);
    }
    for (const dimension of ["identity", "business", "capability", "boundary", "temporal", "evidence", "consistency", "uncertainty"]) expect(migration).toContain(`'${dimension}'`);
  });

  it("binds immutable Assessments to every required input version", () => {
    for (const column of ["extractionId", "truthProfileVersion", "questionVersionId", "extractionVersionId", "methodologyVersionId", "primaryRuleVersionId", "coverageBasisPoints", "confidenceBasisPoints"]) expect(migration).toContain(`\`${column}\``);
    expect(migration).toContain("understanding_assessments_extraction_governance_unique");
    expect(service).toContain("await tx.insert(understandingAssessments)");
    expect(service).not.toMatch(/update\(understandingAssessments\)|delete\(understandingAssessments\)/);
  });

  it("stores manual decisions separately and derives rather than overwrites the automatic result", () => {
    expect(migration).toContain("enum('confirmed','rejected','overridden')");
    expect(migration).toContain("`reviewedBy` int NOT NULL");
    expect(migration).toContain("`reviewedAt` timestamp NOT NULL");
    expect(migration).toContain("`reason` text NOT NULL");
    expect(migration).toContain("`evidenceSnapshot` json NOT NULL");
    expect(service).toContain("insert(understandingAssessmentManualReviews)");
    expect(service).toContain("effectiveOutcome");
    expect(service).not.toMatch(/update\(understandingAssessmentManualReviews\)|delete\(understandingAssessmentManualReviews\)/);
  });

  it("keeps legacy evaluations as an explicit read-only adapter", () => {
    expect(service).toContain('source: "legacy_understanding_evaluation"');
    expect(service).toContain("formalAssessmentId: null");
    expect(service).not.toMatch(/insert\(understandingEvaluations\)|update\(understandingEvaluations\)|delete\(understandingEvaluations\)/);
    expect(migration).not.toMatch(/understanding_evaluations/);
  });

  it("does not enter later scoring phases or sample execution", () => {
    expect(`${migration}\n${service}`).not.toContain("210001");
    expect(`${migration}\n${service}`).not.toMatch(/Trust Score|Recommendation Gap|Growth Validation/i);
  });
});
