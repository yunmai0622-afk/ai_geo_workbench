import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.2-P1-A-QuestionBank-UX", () => {
  const page = read("client/src/pages/QuestionsLibraryPage.tsx");
  const drawer = read("client/src/components/questions/QuestionSearchPoolDrawer.tsx");
  const assistant = read("client/src/components/questions/QuestionBankAssistantPanel.tsx");
  const shell = read("client/src/components/project/EnterpriseProjectShell.tsx");

  it("页面标题为 AI 搜索问题池", () => {
    expect(page).toContain("AI 搜索问题池");
    expect(page).toContain("questions-page-title");
    expect(page).toContain("questions-page-subtitle");
  });

  it("问题池概览与六类 Tab", () => {
    expect(page).toContain("question-pool-overview");
    expect(page).toContain("核心问题总数");
    expect(page).toContain("已发现缺口");
    expect(page).toContain("已启用问题");
    expect(page).toContain("竞品占优");
    expect(page).toContain("已生成内容任务");
    expect(page).toContain("本轮重点问题");
    expect(page).toContain("暂无诊断数据");
    expect(page).toContain("question-pool-tabs");
    expect(page).toContain("SEARCH_POOL_QUESTION_TYPES");
    expect(read("shared/questionSearchPool.ts")).toContain("品牌认知");
    expect(read("shared/questionSearchPool.ts")).toContain("品类推荐");
    expect(read("shared/questionSearchPool.ts")).toContain("场景需求");
    expect(read("shared/questionSearchPool.ts")).toContain("竞品对比");
    expect(read("shared/questionSearchPool.ts")).toContain("长尾痛点");
    expect(read("shared/questionSearchPool.ts")).toContain("地域/行业");
  });

  it("问题列表操作按钮完整", () => {
    expect(page).toContain("加入本轮诊断");
    expect(page).toContain("生成内容任务");
    expect(page).toContain("标记重点");
    expect(page).toContain("question-toggle-priority-");
    expect(page).toContain("question-edit-");
  });

  it("新增/编辑 drawer 字段完整", () => {
    expect(drawer).toContain("问题内容");
    expect(drawer).toContain("问题类型");
    expect(drawer).toContain("目标关键词");
    expect(drawer).toContain("目标客户场景");
    expect(drawer).toContain("关联诊断缺口");
    expect(drawer).toContain("优先级");
    expect(drawer).toContain("需要支撑的信源类型");
    expect(drawer).toContain("需要强化的实体锚点");
  });

  it("右侧问题库助手仍挂载", () => {
    expect(assistant).toContain("问题库助手");
    expect(shell).toContain("QuestionBankAssistantPanel");
    expect(shell).toContain("isQuestionsPage");
  });

  it("保留生成高质量问题入口，不暴露技术字段", () => {
    expect(page).toContain("生成高质量问题");
    expect(page).toContain("questions-library-add");
    expect(page).not.toContain("rawAnswer");
    expect(page).not.toContain("taskId:");
    expect(page).not.toMatch(/\bprovider\b/);
    expect(page).not.toMatch(/\bmock\b/);
    expect(page).not.toMatch(/\bschema\b/);
  });
});
