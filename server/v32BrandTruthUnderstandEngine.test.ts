import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("drizzle/schema.ts", "utf8");
const migration = readFileSync("drizzle/0071_brand_truth_understand_engine.sql", "utf8");
const acceptanceMigration = readFileSync("drizzle/0072_brand_truth_understand_acceptance_gate.sql", "utf8");
const router = readFileSync("server/brandTruthRouter.ts", "utf8");
const service = readFileSync("server/brandTruthService.ts", "utf8");
const app = readFileSync("client/src/App.tsx", "utf8");
const customerPage = readFileSync("client/src/pages/AIUnderstandingPage.tsx", "utf8");
const operationsPage = readFileSync("client/src/pages/BrandTruthOperationsPage.tsx", "utf8");

describe("GEO V3.2 Brand Truth and Understand Engine acceptance", () => {
  it("has forward-only migration for all formal data layers without touching existing production tables", () => {
    for (const table of ["brand_truth_profiles", "brand_truth_facts", "brand_truth_fact_versions", "brand_truth_evidence", "brand_truth_fact_evidence_links", "brand_truth_conflicts", "understanding_question_sets", "understanding_questions", "understanding_evaluations", "understanding_dimension_results", "understanding_correction_tasks", "understanding_rule_configs"]) {
      expect(migration).toContain(`CREATE TABLE \`${table}\``);
      expect(schema).toContain(`"${table}"`);
    }
    expect(migration).not.toMatch(/^(ALTER TABLE|DROP TABLE|TRUNCATE|DELETE FROM|UPDATE )/im);
  });

  it("stores projectId on every project-owned table and binds evaluation versions", () => {
    const createBlocks = migration.split("CREATE TABLE ").slice(1);
    for (const block of createBlocks) expect(block).toContain("`projectId` int NOT NULL");
    expect(schema).toContain("truthProfileVersion");
    expect(schema).toContain("questionSetVersion");
    expect(schema).toContain("extractionVersion");
    expect(schema).toContain("evaluationVersion");
  });

  it("adds immutable methodology and coverage snapshot fields without rewriting history", () => {
    for (const column of ["methodologyVersion", "dimensionWeights", "ruleVersion", "assessmentStatus", "plannedQuestionCount", "runQuestionCount", "verifiedFactCount", "extractionCoverage", "assessmentCoverage"]) {
      expect(acceptanceMigration).toContain(`\`${column}\``);
      expect(schema).toContain(column);
    }
    expect(acceptanceMigration).toContain("MODIFY COLUMN `severity` enum('P0','P1','P2') NULL");
    expect(acceptanceMigration).not.toMatch(/UPDATE\s+`?understanding_evaluations/i);
    expect(acceptanceMigration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
  });

  it("guards every API with project access and write APIs with operator/admin role", () => {
    expect(router).toContain("await requireProjectAccess(ctx, input.projectId)");
    expect(router.match(/operatorAdminProcedure/g)?.length).toBeGreaterThanOrEqual(15);
    expect(router.match(/protectedProcedure/g)?.length).toBeGreaterThanOrEqual(10);
    expect(router).toContain("eq(brandTruthFacts.projectId, input.projectId)");
    expect(router).toContain("eq(understandingEvaluations.projectId, input.projectId)");
  });

  it("does not hardcode sample project logic or overwrite historical AI runs", () => {
    expect(service).not.toContain("210001");
    expect(service).not.toContain("SAMPLE_210001");
    expect(service).not.toMatch(/update\(aiTestRuns\)|delete\(aiTestRuns\)/);
    expect(service).toContain("truthProfileVersion: context.profile.currentVersion");
  });

  it("exposes complete Brand Truth and Understand APIs", () => {
    for (const method of ["getProfile", "createProfile", "updateProfile", "listFacts", "createFact", "updateFact", "archiveFact", "listFactVersions", "addEvidence", "reviewEvidence", "linkEvidence", "unlinkEvidence", "createConflict", "listConflicts", "resolveConflict", "listQuestionSets", "createQuestionSet", "updateQuestionSet", "runUnderstandingTest", "getUnderstandingSummary", "getDimensionResults", "getFactComparisons", "listMisunderstandings", "reviewEvaluation", "createCorrectionTask", "scheduleRetest", "getTrend", "getRuleConfigs", "updateRuleConfig"]) expect(router).toContain(`${method}:`);
  });

  it("adds customer and operations routes with loading, error and honest empty states", () => {
    expect(app).toContain('path="/ai-understanding"');
    expect(app).toContain('path="/operations/brand-truth"');
    expect(customerPage).toContain('data-testid="ai-understanding-loading"');
    expect(customerPage).toContain('data-testid="ai-understanding-error"');
    expect(customerPage).toContain("暂无法评估");
    expect(service).toContain("独立模型通道尚未完成配置，当前不能形成跨模型一致性结论");
    expect(operationsPage).toContain('data-testid="brand-truth-operations-forbidden"');
    expect(operationsPage).toContain("客户账号可在“AI 品牌理解”页面只读查看");
  });

  it("keeps Understand separate from mention, trust, recommendation and asset scores", () => {
    expect(customerPage).toContain("被提及不等于被正确理解");
    expect(customerPage).toContain("理解准确度与提及率、推荐率、信任分和品牌资产总分分别计算");
    expect(service).not.toContain("geoScores");
  });
});
