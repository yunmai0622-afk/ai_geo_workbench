import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.2-P1-A-Question-Search-Pool", () => {
  const schema = read("drizzle/schema.ts");
  const migration = read("drizzle/0057_questions_search_pool_fields.sql");
  const routers = read("server/routers.ts");
  const page = read("client/src/pages/QuestionsLibraryPage.tsx");
  const drawer = read("client/src/components/questions/QuestionSearchPoolDrawer.tsx");

  it("schema and migration add search pool fields without removing legacy columns", () => {
    expect(schema).toContain("searchPoolType");
    expect(schema).toContain("targetKeywords");
    expect(schema).toContain("relatedContentTask");
    expect(schema).toContain("requiredSourceTypes");
    expect(schema).toContain("requiredEntityAnchors");
    expect(schema).toContain("lastTestResult");
    expect(schema).toContain("questionType: questionTypeEnum.notNull()");
    expect(migration).toContain("searchPoolType");
    expect(migration).toContain("lastTestedAt");
  });

  it("questions router exposes P1-B prep queries and priority toggle", () => {
    expect(routers).toContain("getQuestionsRequiringSourceType");
    expect(routers).toContain("getQuestionsRequiringEntityAnchor");
    expect(routers).toContain("togglePriority");
    expect(routers).toContain("addToDiagnosisRound");
    expect(routers).toContain("normalizeQuestionPoolDbFields");
  });

  it("/questions page is AI search question pool with overview, tabs and actions", () => {
    expect(page).toContain("AI 搜索问题池");
    expect(page).toContain("question-pool-overview");
    expect(page).toContain("question-pool-tabs");
    expect(page).toContain("question-pool-tab-");
    expect(page).toContain("SEARCH_POOL_QUESTION_TYPES");
    expect(page).toContain("加入本轮诊断");
    expect(page).toContain("生成内容任务");
    expect(page).toContain("标记重点");
    expect(page).toContain("QuestionSearchPoolDrawer");
    expect(page).toContain('buildProjectUrl("/weekly"');
    expect(page).not.toContain("rawAnswer");
  });

  it("create/edit drawer includes required pool fields", () => {
    expect(drawer).toContain("question-pool-form-text");
    expect(drawer).toContain("question-pool-form-type");
    expect(drawer).toContain("question-pool-form-keywords");
    expect(drawer).toContain("REQUIRED_SOURCE_TYPES");
    expect(drawer).toContain("REQUIRED_ENTITY_ANCHORS");
    expect(drawer).toContain("SEARCH_POOL_QUESTION_TYPES");
  });
});
