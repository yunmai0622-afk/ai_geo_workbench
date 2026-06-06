import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-QuestionBank-IntentMap-UX-P0", () => {
  const page = read("client/src/pages/QuestionsLibraryPage.tsx");
  const card = read("client/src/components/questions/QuestionBankCard.tsx");
  const roundPanel = read("client/src/components/questions/QuestionBankCurrentRoundPanel.tsx");
  const groupSection = read("client/src/components/questions/QuestionIntentGroupSection.tsx");
  const qualityPanel = read("client/src/components/questions/QuestionQualityStandardsPanel.tsx");
  const assistant = read("client/src/components/questions/QuestionBankAssistantPanel.tsx");
  const shell = read("client/src/components/project/EnterpriseProjectShell.tsx");
  const intentLib = read("shared/questionBankIntentMap.ts");

  it("页面标题与副标题体现 AI 搜索问题库 / 需求地图", () => {
    expect(page).toContain("AI 搜索问题库 / AI 搜索需求地图");
    expect(page).toContain("AI 搜索需求地图");
    expect(page).toContain("questions-page-subtitle");
    expect(page).toContain("实测品牌可见度、发现 GEO 缺口，并生成内容任务");
  });

  it("顶部问题库总览与本轮实测题组", () => {
    expect(page).toContain("question-bank-overview");
    expect(page).toContain("问题库总览");
    expect(page).toContain("QuestionBankCurrentRoundPanel");
    expect(roundPanel).toContain("本轮实测题组");
    expect(roundPanel).toContain("question-bank-create-round");
  });

  it("问题按意图分组展示", () => {
    expect(page).toContain("QuestionIntentGroupSection");
    expect(groupSection).toContain("question-intent-group-");
    expect(intentLib).toContain("品牌认知");
    expect(intentLib).toContain("场景痛点");
    expect(intentLib).toContain("方案寻找");
  });

  it("问题卡片展示意图、优先级、实测与内容状态", () => {
    expect(card).toContain("question-intent-");
    expect(card).toContain("question-priority-");
    expect(card).toContain("question-test-status-");
    expect(card).toContain("question-content-status-");
    expect(card).toContain("question-next-action-");
    expect(card).toContain("启用后将进入下一轮 AI 实测与内容生产候选范围");
  });

  it("空实测与空内容任务有解释型文案", () => {
    expect(card).toContain("question-test-empty-");
    expect(intentLib).toContain("尚未实测");
    expect(card).toContain("question-content-empty-");
    expect(intentLib).toContain("尚未生成内容");
    expect(page).toContain("待完成 AI 实测后生成");
    expect(page).toContain("待选择问题后生成");
  });

  it("问题质量标准与生成高质量问题入口", () => {
    expect(qualityPanel).toContain("什么是高质量 GEO 问题？");
    expect(page).toContain("生成高质量问题");
    expect(page).toContain("QuestionQualityStandardsPanel");
    expect(page).not.toContain("生成问题建议");
  });

  it("右侧问题库助手替代通用下一步建议", () => {
    expect(assistant).toContain("问题库助手");
    expect(assistant).toContain("question-bank-assistant-panel");
    expect(assistant).toContain("question-assistant-next-action");
    expect(assistant).toContain("创建本轮实测题组");
    expect(assistant).toContain("去 AI 实测诊断");
    expect(shell).toContain("QuestionBankAssistantPanel");
    expect(shell).toContain("isQuestionsPage");
  });

  it("问题质量标准默认折叠", () => {
    expect(qualityPanel).toContain("question-quality-standards-summary");
    expect(qualityPanel).not.toMatch(/<details\s+open/);
  });

  it("本轮实测题组按钮去 AI 实测诊断", () => {
    expect(roundPanel).toContain("去 AI 实测诊断");
    expect(roundPanel).toContain("question-bank-round-ai-test");
  });

  it("保留启用/禁用与人工添加，不暴露技术字段", () => {
    expect(page).toContain("questions-library-add");
    expect(card).toContain("question-toggle-");
    expect(page).not.toContain("rawAnswer");
    expect(page).not.toContain("taskId:");
    expect(page).not.toMatch(/\bprovider\b/);
    expect(page).not.toMatch(/\bmock\b/);
    expect(page).not.toMatch(/\bschema\b/);
    expect(card).not.toContain("rawAnswer");
  });
});
