import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("drizzle/0074_versioned_understand_governance.sql", "utf8");
const schema = readFileSync("drizzle/schema.ts", "utf8");
const service = readFileSync("server/versionedUnderstandGovernanceService.ts", "utf8");
const baseline = readFileSync("drizzle/baselines/tidb_v0074.sql", "utf8");
const bootstrap = readFileSync("scripts/bootstrap_tidb_v0074.mjs", "utf8");

const tables = [
  "brand_fact_definitions", "brand_fact_definition_versions", "brand_fact_industry_template_versions", "brand_fact_industry_template_items",
  "understanding_question_set_versions", "understanding_question_versions", "understanding_methodology_registry", "understanding_methodology_versions",
  "understanding_methodology_dimension_weights", "understanding_extraction_version_registry", "understanding_rule_sets", "understanding_rule_versions",
  "brand_truth_profile_versions", "brand_truth_profile_version_facts",
  "understanding_assessments", "understanding_assessment_dimension_results", "understanding_assessment_rule_results", "understanding_assessment_manual_reviews",
];

describe("PR-03.6B versioned Understand governance", () => {
  it("creates every governance object with forward-only DDL", () => {
    for (const table of tables) {
      expect(migration).toContain(`CREATE TABLE \`${table}\``);
      expect(schema).toContain(`"${table}"`);
    }
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE|UPDATE)\b/i);
    expect(migration.match(/ALTER TABLE/g)).toHaveLength(2);
  });

  it("versions fact semantics, question snapshots, methodology, extraction and P0/P1/P2 rules", () => {
    for (const token of ["required','optional','not_applicable", "valueType", "cardinality", "temporalSemantics", "questionTextSnapshot", "scenarioSnapshot", "targetAudienceSnapshot", "purchaseIntent", "coveragePolicy", "confidencePolicy", "weightBasisPoints", "implementationVersion", "P0','P1','P2"]) {
      expect(migration).toContain(token);
    }
    for (const dimension of ["identity", "business", "capability", "boundary", "temporal", "evidence", "consistency", "uncertainty"]) expect(migration).toContain(`'${dimension}'`);
  });

  it("binds immutable Assessments to every required input version", () => {
    for (const column of ["extractionId", "truthProfileVersionId", "questionVersionId", "extractionVersionId", "methodologyVersionId", "primaryRuleVersionId", "coverageBasisPoints", "confidenceBasisPoints"]) expect(migration).toContain(`\`${column}\``);
    expect(migration).not.toContain("`truthProfileVersion` int");
    for (const constraint of [
      "understanding_assessments_observation_extraction_project_fk", "understanding_assessments_truth_profile_version_project_fk",
      "understanding_assessments_question_project_fk", "understanding_assessments_extraction_version_project_fk",
      "understanding_assessments_methodology_project_fk", "understanding_assessments_rule_project_fk",
    ]) expect(migration).toContain(`CONSTRAINT \`${constraint}\` FOREIGN KEY`);
    expect(migration).toContain("understanding_assessments_extraction_governance_unique");
    expect(service).toContain("await tx.insert(understandingAssessments)");
    expect(service).not.toMatch(/update\(understandingAssessments\)|delete\(understandingAssessments\)/);
  });

  it("snapshots exact fact versions and exposes no in-place mutation API", () => {
    expect(migration).toContain("brand_truth_profile_version_facts_fact_project_fk");
    expect(service).toContain("createTruthProfileVersion");
    expect(service).toContain("insert(brandTruthProfileVersionFacts)");
    expect(service).not.toMatch(/(?:update|delete)\((?:brandTruthProfileVersions|brandTruthProfileVersionFacts|understandingMethodologyVersions|understandingRuleVersions)\)/);
  });

  it("permits multiple methodology assessments without overwriting history", () => {
    expect(service).toContain("await tx.insert(understandingAssessments)");
    expect(service).not.toContain("onDuplicateKeyUpdate");
    expect(service).not.toMatch(/update\(understandingAssessments\)/);
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

  it("keeps the Observation Ledger feature flag default-off", () => {
    const ledgerService = readFileSync("server/aiObservationLedgerService.ts", "utf8");
    expect(ledgerService).toContain('process.env.AI_OBSERVATION_LEDGER_V2?.toLowerCase() === "true"');
  });

  it("provides a guarded TiDB v0074 baseline with real journal hashes", () => {
    for (const table of tables) expect(baseline).toContain(`CREATE TABLE \`${table}\``);
    expect(bootstrap).toContain("Baseline refused: database namespace contains");
    expect(bootstrap).toContain("Baseline refused: migration metadata already contains records");
    expect(bootstrap).toContain('createHash("sha256").update(sql).digest("hex")');
    expect(bootstrap).toContain("INSERT INTO");
    expect(bootstrap).not.toContain("210001");
  });
});
