import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.2-P1-C-Multiplatform-Test-Enhancement", () => {
  it("schema adds ai_responses extraction fields", () => {
    const schema = read("drizzle/schema.ts");
    expect(schema).toContain("extractedMentioned");
    expect(schema).toContain("extractedRecommended");
    expect(schema).toContain("extractedCitations");
    expect(schema).toContain("extractedCompetitors");
    expect(schema).toContain("extractedSentiment");
    expect(schema).toContain("extractionMethod");
    expect(schema).toContain("extractedAt");
    expect(schema).toContain("questionPoolType");
  });

  it("schema adds test_rounds question pool fields", () => {
    const schema = read("drizzle/schema.ts");
    expect(schema).toContain("sourceQuestionPoolSize");
    expect(schema).toContain("platformsIncluded");
    expect(schema).toContain("scheduledType");
    expect(schema).toContain("comparedToRoundId");
  });

  it("migration 0059 exists without conflicting number", () => {
    expect(read("drizzle/0059_question_pool_test_extraction.sql")).toContain("extractedMentioned");
    expect(read("drizzle/meta/_journal.json")).toContain("0059_question_pool_test_extraction");
  });

  it("response extraction service is pure rule based", () => {
    const service = read("server/services/responseExtractionService.ts");
    expect(service).toContain("export function extractFromResponse");
    expect(service).not.toContain("invokeLLM");
    expect(service).not.toContain("fetch(");
  });

  it("question pool executor writes ai_responses and updates questions", () => {
    const executor = read("server/questionPoolTestExecutor.ts");
    expect(executor).toContain("extractFromResponse");
    expect(executor).toContain("db.insert(aiResponses)");
    expect(executor).toContain("lastTestResult");
    expect(executor).toContain("scheduledType");
    expect(executor).not.toContain("Promise.allSettled");
  });

  it("geo router exposes question pool test and comparison endpoints", () => {
    const routers = read("server/routers.ts");
    expect(routers).toContain("questionPoolTest:");
    expect(routers).toContain("testComparison:");
    expect(routers).toContain("startQuestionPoolTest");
    expect(routers).toContain("buildRoundComparison");
  });

  it("ai-diagnosis page includes question pool entry and comparison panel", () => {
    const flow = read("client/src/pages/V12FlowPages.tsx");
    expect(flow).toContain("QuestionPoolTestPanel");
    expect(flow).toContain("TestComparisonPanel");
    expect(read("client/src/components/diagnosis/QuestionPoolTestPanel.tsx")).toContain(
      "data-testid=\"ai-diagnosis-question-pool-test\"",
    );
    expect(read("client/src/components/diagnosis/QuestionPoolTestPanel.tsx")).toContain(
      "data-testid=\"question-pool-start-test\"",
    );
    expect(read("client/src/components/diagnosis/TestComparisonPanel.tsx")).toContain(
      "data-testid=\"test-comparison-rate-summary\"",
    );
  });
});
