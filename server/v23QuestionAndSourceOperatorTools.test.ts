import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf-8");

describe("GEO V2.3-P0-I question pool and source evidence operator tools", () => {
  const questionsPage = read("client/src/pages/QuestionsLibraryPage.tsx");
  const questionOverview = read("client/src/components/questions/QuestionPoolOperatorOverview.tsx");
  const sourcePage = read("client/src/pages/SourceGraphPage.tsx");
  const sourceOverview = read("client/src/components/source-graph/SourceEvidenceOperatorOverview.tsx");

  it("turns /questions into an operator decision tool for AI search opportunities", () => {
    expect(questionsPage).toContain("AI 搜索机会与内容选题工具");
    expect(questionsPage).toContain("QuestionPoolOperatorOverview");
    expect(questionOverview).toContain("question-operator-overview");
    expect(questionOverview).toContain("运营工具 · AI 搜索机会与内容选题");
    expect(questionOverview).toContain("本月应该优先优化哪些 AI 搜索问题");
    expect(questionOverview).toContain("question-operator-primary-cta");
  });

  it("keeps question metrics, scenario grouping, top questions, and task linkage on the first screen", () => {
    expect(questionsPage).toContain("问题总数");
    expect(questionsPage).toContain("高优先级问题");
    expect(questionsPage).toContain("已有内容承接问题");
    expect(questionsPage).toContain("待优化问题");
    expect(questionOverview).toContain("question-operator-scenarios");
    expect(questionOverview).toContain("本月优先问题类型");
    expect(questionOverview).toContain("question-operator-top-items");
    expect(questionOverview).toContain("Top 优化问题");
    expect(questionOverview).toContain("question-operator-task-links");
    expect(questionOverview).toContain("内容任务关联");
  });

  it("downgrades detailed question records into operational detail sections", () => {
    expect(questionsPage).toContain("运营明细：机会总览");
    expect(questionsPage).toContain("运营明细：问题场景分组");
    expect(questionsPage).toContain("AI 搜索机会地图");
  });

  it("turns /brand-source-graph into a source evidence repair tool", () => {
    expect(sourcePage).toContain("信源证据与可信度修复工具");
    expect(sourcePage).toContain("SourceEvidenceOperatorOverview");
    expect(sourceOverview).toContain("source-evidence-operator-overview");
    expect(sourceOverview).toContain("运营后台 · 信源证据与可信度修复");
    expect(sourceOverview).toContain("判断下步需要补哪些可信材料");
    expect(sourceOverview).toContain("AI 为什么不够信任这个品牌");
    expect(sourceOverview).toContain("source-evidence-operator-primary-cta");
  });

  it("keeps source metrics, weaknesses, suggestions, distribution, and consistency summary on the first screen", () => {
    expect(sourcePage).toContain("信源数量");
    expect(sourcePage).toContain("一致性状态");
    expect(sourcePage).toContain("可被 AI 引用的证据");
    expect(sourcePage).toContain("待修复信源");
    expect(sourceOverview).toContain("source-evidence-weaknesses");
    expect(sourceOverview).toContain("当前信源短板");
    expect(sourceOverview).toContain("source-evidence-suggestions");
    expect(sourceOverview).toContain("信源修复建议");
    expect(sourceOverview).toContain("source-evidence-distribution");
    expect(sourceOverview).toContain("信源类型分布");
    expect(sourceOverview).toContain("source-evidence-consistency");
    expect(sourceOverview).toContain("一致性检查");
  });

  it("downgrades source lists and raw consistency fields into operational details", () => {
    expect(sourcePage).toContain("运营明细：信源总览");
    expect(sourcePage).toContain("运营明细：信源列表");
    expect(sourcePage).toContain("运营明细：品牌关键信息一致性");
    expect(sourcePage).toContain("运营明细：内容增强建议");
    expect(sourcePage).toContain("品牌信源图谱");
  });

  it("does not expose engineering fields in the two operator overview components", () => {
    const forbidden = ["questionId", "sourceType", "taskId", "workflow", "bundle", "commit", "API", "错误堆栈"];
    for (const term of forbidden) {
      expect(questionOverview).not.toContain(term);
      expect(sourceOverview).not.toContain(term);
    }
  });
});
