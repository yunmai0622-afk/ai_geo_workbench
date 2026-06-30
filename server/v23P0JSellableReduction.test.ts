import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf-8");

describe("GEO V2.3-P0-J sellable reduction pass", () => {
  it("separates weekly customer progress from the internal operator view", () => {
    const weeklyPage = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weeklyPage).toContain("WeeklyCustomerExecutionOverview");
    expect(weeklyPage).toContain("内部运营执行视图");
    expect(weeklyPage).toContain("客户只看上方“做到哪一步”");
    expect(weeklyPage).toContain('data-testid="weekly-operational-workbench"');
  });

  it("keeps AI diagnosis focused on the customer problem and downgraded evidence", () => {
    const report = read("client/src/components/diagnosis/AiDiagnosisCustomerReport.tsx");
    expect(report).toContain("第一屏只回答一个问题");
    expect(report).toContain("完整证据和检测记录已下沉到运营明细");
    expect(report).toContain("证据只保留客户能判断的摘要");
    expect(report).toContain("AI 回答样本");
  });

  it("repositions enterprise profile as brand readiness for AI recognition", () => {
    const asset = read("client/src/pages/AssetCenter.tsx");
    const shell = read("client/src/components/enterpriseProfile/wizard/OnboardingWizardShell.tsx");
    expect(asset).toContain("品牌资料准备 / AI 识别基础建设向导");
    expect(asset).toContain('data-testid="enterprise-profile-readiness-hero"');
    expect(asset).toContain("AI 识别基础准备度");
    expect(shell).toContain("AI 识别基础建设步骤");
  });

  it("turns questions into a first-screen content topic decision tool", () => {
    const questionsPage = read("client/src/pages/QuestionsLibraryPage.tsx");
    const overview = read("client/src/components/questions/QuestionPoolOperatorOverview.tsx");
    expect(questionsPage).toContain("今天应该围绕哪个 AI 搜索问题做内容");
    expect(overview).toContain('data-testid="question-operator-first-decision"');
    expect(overview).toContain("今日选题决策");
    expect(overview).toContain("为什么值得做");
  });
});
