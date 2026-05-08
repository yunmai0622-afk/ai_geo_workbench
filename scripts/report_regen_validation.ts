import { and, desc, eq, inArray } from "drizzle-orm";
import { aiResponses, analysisResults, projects, questions, reports } from "../drizzle/schema";
import { getDb } from "../server/db";
import { appRouter } from "../server/routers";

const sections = [
  "## 1. 报告摘要",
  "## 2. 一句话结论",
  "## 3. GEO 总分与分项评分",
  "## 4. AI 可见度分析",
  "## 5. AI 推荐与竞品对比",
  "## 6. AI 品牌认知问题",
  "## 7. 内容缺口诊断",
  "## 8. 30 天 GEO 优化行动计划",
  "## 9. 关键内容模板摘要",
  "## 10. 下一轮复测建议",
];

const specifiedQuestions = [
  "知识付费 SaaS 平台哪个好？",
  "知识付费老师卖课用什么系统？",
  "海豚知道和小鹅通有什么区别？",
  "有哪些适合教育培训机构的私域经营系统？",
  "企业 AI 经营系统有哪些服务商？",
  "哪家公司适合帮知识付费企业做 AI 转型？",
  "做课程售卖和直播转化用什么平台？",
  "小鹅通、有赞教育、海豚知道哪个更适合知识付费老师？",
  "知识付费公司怎么搭建 AI 运营诊断系统？",
  "教育培训机构如何选择 SaaS 系统？",
];

function fakeCtx() {
  return {
    user: {
      id: 1,
      openId: "report_regen_validation_user",
      name: "报告再生成验收",
      email: null,
      loginMethod: "script",
      role: "admin" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {}, protocol: "https", get: () => "localhost" },
    res: { clearCookie: () => undefined },
  } as any;
}

function assertContains(text: string, needle: string, label: string) {
  if (!text.includes(needle)) {
    throw new Error(`缺少${label}: ${needle}`);
  }
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("数据库不可用");

  const project = (await db.select().from(projects).where(eq(projects.enterpriseName, "海豚知道")).limit(1))[0];
  if (!project) throw new Error("未找到海豚知道项目");

  const specifiedRows = await db
    .select()
    .from(questions)
    .where(and(eq(questions.projectId, project.id), inArray(questions.questionText, specifiedQuestions)));
  if (specifiedRows.length !== 10) throw new Error(`客户指定问题不是 10 条，实际为 ${specifiedRows.length}`);

  const manualRows = await db
    .select({
      analysisId: analysisResults.id,
      questionText: aiResponses.questionText,
      manualOverrideJson: analysisResults.manualOverrideJson,
      manuallyReviewed: analysisResults.manuallyReviewed,
    })
    .from(analysisResults)
    .innerJoin(aiResponses, eq(analysisResults.aiResponseId, aiResponses.id))
    .where(and(eq(analysisResults.projectId, project.id), eq(analysisResults.manuallyReviewed, 1)))
    .orderBy(desc(analysisResults.updatedAt));
  if (manualRows.length < 2) throw new Error(`人工修订样本少于 2 条，实际为 ${manualRows.length}`);

  const caller = appRouter.createCaller(fakeCtx());
  const result = await caller.geo.reports.generate({ projectId: project.id });
  const reportText = result.report.markdownContent;
  const dbReport = (await db.select().from(reports).where(eq(reports.projectId, project.id)).orderBy(desc(reports.createdAt)).limit(1))[0];

  if (reportText.length < 2000) throw new Error(`报告不足 2000 字符，实际为 ${reportText.length}`);
  sections.forEach(section => assertContains(reportText, section, "固定章节"));
  assertContains(reportText, "海豚知道", "项目名称");
  assertContains(reportText, "客户指定问题 10 条", "客户指定问题数量");
  assertContains(reportText, "客户指定问题 10 条的业务意义", "客户指定问题业务意义");
  assertContains(reportText, "真实客户在采购前会问 AI 的高意向问题", "指定问题高意向解释");
  assertContains(reportText, "原始 AI 分析计算为 **25 分**", "原始 25 分说明");
  assertContains(reportText, "人工修订后有效评分为 **32 分**", "人工修订后 32 分说明");
  assertContains(reportText, "弱可见", "弱可见等级");
  assertContains(reportText, "小鹅通", "竞品小鹅通");
  assertContains(reportText, "有赞教育", "竞品有赞教育");
  assertContains(reportText, "AI 经营诊断系统专题页", "内容缺口 AI 经营诊断系统专题页");
  assertContains(reportText, "竞品对比页", "内容缺口竞品对比页");
  assertContains(reportText, "FAQ", "内容缺口 FAQ");
  assertContains(reportText, "客户案例", "内容缺口客户案例");
  assertContains(reportText, "P0", "P0 优化任务");
  assertContains(reportText, "P1", "P1 优化任务");
  assertContains(reportText, "P2", "P2 优化任务");
  assertContains(reportText, "| 优先级 | 任务名称 | 生成原因 | 对应内容缺口 | 建议产物 | 预期影响 |", "30 天任务表头");
  assertContains(reportText, "下表任务来自本轮真实分析和人工修订结果", "任务真实依据说明");
  assertContains(reportText, "样本量有限", "样本量有限声明");

  console.log(JSON.stringify({
    projectId: project.id,
    generatedReportId: dbReport?.id ?? null,
    reportLength: reportText.length,
    sectionCount: sections.filter(section => reportText.includes(section)).length,
    manualReviewedSampleCount: manualRows.length,
    specifiedQuestionCount: specifiedRows.length,
    totalScore: result.report.totalScore,
    oneSentenceConclusion: result.report.oneSentenceConclusion,
    checks: {
      minLength: reportText.length >= 2000,
      fixedSections: sections.every(section => reportText.includes(section)),
      explainsRawToReviewedScore: reportText.includes("原始 AI 分析计算为 **25 分**") && reportText.includes("人工修订后有效评分为 **32 分**"),
      competitorsIncluded: reportText.includes("小鹅通") && reportText.includes("有赞教育"),
      contentGapsIncluded: ["AI 经营诊断系统专题页", "竞品对比页", "FAQ", "客户案例"].every(item => reportText.includes(item)),
      prioritiesIncluded: ["P0", "P1", "P2"].every(item => reportText.includes(item)),
      specifiedQuestionMeaningIncluded: reportText.includes("客户指定问题 10 条的业务意义"),
      taskTableIncluded: reportText.includes("| 优先级 | 任务名称 | 生成原因 | 对应内容缺口 | 建议产物 | 预期影响 |"),
      realEvidenceMappingIncluded: reportText.includes("下表任务来自本轮真实分析和人工修订结果"),
      persistedLatestReportMatches: dbReport?.markdownContent === reportText,
    },
  }, null, 2));
  process.exit(0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
