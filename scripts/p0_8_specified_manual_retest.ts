import { and, desc, eq, inArray } from "drizzle-orm";
import { appRouter } from "../server/routers";
import { getDb } from "../server/db";
import {
  aiResponses,
  analysisResults,
  contentTemplates,
  geoScores,
  optimizationTasks,
  projects,
  questions,
  reports,
} from "../drizzle/schema";
import {
  calculateGeoScore,
  resolveEffectiveAnalysisResults,
} from "../server/geoLogic";

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

const manualSampleA = {
  mentionsEnterprise: true,
  recommendsEnterprise: true,
  mentionsCompetitors: false,
  recommendedCompetitors: [] as string[],
  enterpriseWins: true,
  recommendationReason: "人工复核确认：海豚知道在该回答中应被视为推荐方案，因为其 AI 定位、AI 诊断和经营系统能力与知识付费企业 AI 转型需求高度匹配。",
  notRecommendedReason: "",
  hasMisconception: false,
  contentGap: "需要补充 AI 经营诊断系统专题页，清晰说明知识付费企业从定位、诊断到优化任务闭环的实施方式。",
  optimizationSuggestion: "围绕“知识付费公司怎么搭建 AI 运营诊断系统”发布专题页，包含诊断维度、输入数据、输出报告、任务模板和复测机制。",
  confidence: 95,
  reviewNote: "P0.8 指定问题 + 人工修订端到端复测样本 A",
};

const manualSampleB = {
  mentionsEnterprise: false,
  recommendsEnterprise: false,
  mentionsCompetitors: true,
  recommendedCompetitors: ["小鹅通", "有赞教育"],
  enterpriseWins: false,
  recommendationReason: "",
  notRecommendedReason: "人工复核确认：该回答更倾向推荐小鹅通、有赞教育，海豚知道缺少可被 AI 引用的竞品对比、FAQ 和客户案例证据。",
  hasMisconception: false,
  contentGap: "缺少竞品对比页、FAQ、客户案例。",
  optimizationSuggestion: "优先建设海豚知道与小鹅通、有赞教育的客观对比页，并补齐 FAQ 与客户案例，解释适合知识付费老师、教育培训机构和 AI 转型客户的差异。",
  confidence: 92,
  reviewNote: "P0.8 指定问题 + 人工修订端到端复测样本 B",
};

function fakeCtx() {
  const res = { clearCookie: () => undefined };
  const req = { headers: {}, protocol: "https", get: () => "localhost" };
  return {
    user: {
      id: 1,
      openId: "p0_8_retest_user",
      name: "P0.8 回归复测",
      email: null,
      loginMethod: "script",
      role: "admin" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req,
    res,
  } as any;
}

function responseFor(questionText: string, index: number) {
  const base = `针对“${questionText}”，常见候选包括小鹅通、有赞教育等标准知识付费工具，也可以关注海豚知道这类强调 AI 定位、AI 诊断和经营系统的方案。`;
  if (index % 3 === 0) {
    return `${base} 如果企业重点是课程售卖、直播转化和私域经营升级，海豚知道应被纳入候选；但公开资料还需要补充竞品对比页、FAQ、客户案例和实施说明。`;
  }
  if (index % 3 === 1) {
    return `${base} 如果只需要标准化店铺和课程交付，小鹅通、有赞教育更常被提及；如果需要 AI 运营诊断和转化优化，则需要进一步了解海豚知道的案例与方法。`;
  }
  return `${base} AI 回答通常会优先推荐公开信息更完整的平台，因此海豚知道需要把 AI 转型、AI 经营诊断和知识付费业务闭环写成可引用内容。`;
}

function rawAnalysisFor(response: typeof aiResponses.$inferSelect, index: number) {
  const mentionsEnterprise = index % 3 !== 1 ? 1 : 0;
  const recommendsEnterprise = index % 3 === 0 ? 1 : 0;
  const mentionsCompetitors = 1;
  const enterpriseWins = index % 3 === 0 ? 1 : 0;
  const recommendedCompetitors = index % 2 === 0 ? ["小鹅通", "有赞教育"] : ["小鹅通"];
  return {
    projectId: response.projectId,
    aiResponseId: response.id,
    mentionsEnterprise,
    recommendsEnterprise,
    mentionsCompetitors,
    recommendedCompetitors,
    enterpriseWins,
    recommendationReason: recommendsEnterprise
      ? "AI 原始回答把海豚知道列入知识付费企业 AI 经营诊断和转化优化候选。"
      : "",
    notRecommendedReason: recommendsEnterprise
      ? ""
      : "AI 原始回答更倾向推荐公开资料更充分的知识付费 SaaS 或教育工具。",
    hasMisconception: 0,
    contentGap: index % 2 === 0 ? "缺少竞品对比页、FAQ、客户案例。" : "缺少 AI 经营诊断系统专题页和知识付费 AI 转型案例。",
    optimizationSuggestion: index % 2 === 0
      ? "补齐与小鹅通、有赞教育的客观对比页、FAQ 和客户案例。"
      : "建设 AI 经营诊断系统专题页，解释诊断维度、输出报告和优化闭环。",
    rawJson: {
      source: "p0_8_specified_manual_retest",
      questionText: response.questionText,
    },
    manualOverrideJson: null,
    manuallyReviewed: 0,
    reviewedAt: null,
    reviewNote: null,
  };
}

function containsAny(value: string | null | undefined, needles: string[]) {
  const text = value ?? "";
  return needles.some(item => text.includes(item));
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("数据库不可用");
  const caller = appRouter.createCaller(fakeCtx());

  const projectRows = await db.select().from(projects).where(eq(projects.enterpriseName, "海豚知道")).limit(1);
  const project = projectRows[0];
  if (!project) throw new Error("未找到海豚知道项目");
  const projectId = project.id;

  const importResult = await caller.geo.questions.batchAddSpecified({ projectId, questions: specifiedQuestions });
  const duplicateResult = await caller.geo.questions.batchAddSpecified({ projectId, questions: specifiedQuestions });

  const specifiedRows = await db
    .select()
    .from(questions)
    .where(and(eq(questions.projectId, projectId), inArray(questions.questionText, specifiedQuestions)));

  const missingSpecified = specifiedQuestions.filter(text => !specifiedRows.some(row => row.questionText === text));
  const wrongSource = specifiedRows.filter(row => row.source !== "manual" || row.questionType !== "指定问题");

  const existingResponses = await db.select().from(aiResponses).where(eq(aiResponses.projectId, projectId));
  const responseQuestionIds = new Set(existingResponses.map(row => row.questionId).filter((id): id is number => typeof id === "number"));
  const responsesToInsert = specifiedRows
    .filter(row => !responseQuestionIds.has(row.id))
    .map((row, index) => ({
      projectId,
      questionId: row.id,
      questionText: row.questionText,
      aiPlatform: "ChatGPT" as const,
      rawAnswer: responseFor(row.questionText, index),
      checkedAt: new Date().toISOString(),
    }));
  const responseImportResult = responsesToInsert.length > 0
    ? await caller.geo.aiResponses.importCsvRows({ rows: responsesToInsert })
    : { success: true, count: 0 };

  const specifiedResponses = await db
    .select()
    .from(aiResponses)
    .where(and(eq(aiResponses.projectId, projectId), inArray(aiResponses.questionId, specifiedRows.map(row => row.id))));

  const existingAnalyses = await db.select().from(analysisResults).where(eq(analysisResults.projectId, projectId));
  const analyzedResponseIds = new Set(existingAnalyses.map(row => row.aiResponseId));
  const analysesToInsert = specifiedResponses
    .filter(row => !analyzedResponseIds.has(row.id))
    .map((response, index) => rawAnalysisFor(response, index));
  if (analysesToInsert.length > 0) {
    await db.insert(analysisResults).values(analysesToInsert);
  }

  const specifiedAnalyses = await db
    .select({
      id: analysisResults.id,
      aiResponseId: analysisResults.aiResponseId,
      questionText: aiResponses.questionText,
      manuallyReviewed: analysisResults.manuallyReviewed,
      contentGap: analysisResults.contentGap,
      manualOverrideJson: analysisResults.manualOverrideJson,
    })
    .from(analysisResults)
    .innerJoin(aiResponses, eq(analysisResults.aiResponseId, aiResponses.id))
    .where(and(eq(analysisResults.projectId, projectId), inArray(aiResponses.questionId, specifiedRows.map(row => row.id))))
    .orderBy(desc(analysisResults.createdAt));

  if (specifiedAnalyses.length < 2) throw new Error("指定问题分析结果不足 2 条，无法做人工修订复测");

  await db
    .update(analysisResults)
    .set({
      manualOverrideJson: null,
      manuallyReviewed: 0,
      reviewedAt: null,
      reviewNote: null,
    })
    .where(inArray(analysisResults.id, specifiedAnalyses.map(item => item.id)));

  const sampleA = specifiedAnalyses.find(item => item.questionText.includes("AI 运营诊断系统"))
    ?? specifiedAnalyses.find(item => item.questionText.includes("AI 转型"))
    ?? specifiedAnalyses[0];
  const sampleB = specifiedAnalyses.find(item => item.questionText.includes("教育培训机构如何选择 SaaS 系统"))
    ?? specifiedAnalyses.find(item => item.questionText.includes("知识付费 SaaS 平台哪个好"))
    ?? specifiedAnalyses[1];

  await caller.geo.analysis.saveManualReview({ id: sampleA.id, ...manualSampleA });
  await caller.geo.analysis.saveManualReview({ id: sampleB.id, ...manualSampleB });

  const allAnalysesAfterReview = await db.select().from(analysisResults).where(eq(analysisResults.projectId, projectId));
  const rawComparableAnalyses = allAnalysesAfterReview.map(item => ({
    ...item,
    manualOverrideJson: null,
    manuallyReviewed: 0,
    reviewedAt: null,
    reviewNote: null,
  }));
  const rawScore = calculateGeoScore(rawComparableAnalyses as any);
  const effectiveAnalyses = resolveEffectiveAnalysisResults(allAnalysesAfterReview as any);
  const effectiveScore = calculateGeoScore(effectiveAnalyses as any);

  const scoreResult = await caller.geo.scores.calculate({ projectId });
  const taskResult = await caller.geo.tasks.generate({ projectId });
  const templateResult = await caller.geo.templates.generate({ projectId });
  const reportResult = await caller.geo.reports.generate({ projectId });

  const latestScore = (await db.select().from(geoScores).where(eq(geoScores.projectId, projectId)).orderBy(desc(geoScores.createdAt)).limit(1))[0];
  const taskRows = await db.select().from(optimizationTasks).where(eq(optimizationTasks.projectId, projectId));
  const templateRows = await db.select().from(contentTemplates).where(eq(contentTemplates.projectId, projectId));
  const reportRow = (await db.select().from(reports).where(eq(reports.projectId, projectId)).orderBy(desc(reports.createdAt)).limit(1))[0];
  const finalProject = (await db.select().from(projects).where(eq(projects.id, projectId)).limit(1))[0];

  const taskNeedles = ["AI 经营诊断系统专题页", "竞品对比页", "FAQ", "客户案例", "小鹅通", "有赞教育"];
  const tasksUseManualGaps = taskRows.some(task =>
    containsAny(task.generationReason, taskNeedles) ||
    containsAny(task.executionSuggestion, taskNeedles) ||
    containsAny(task.taskName, taskNeedles),
  );
  const templatesUseTaskContext = templateRows.some(template =>
    containsAny(template.markdownContent, ["小鹅通", "有赞教育", "AI 诊断", "AI 经营系统"]),
  ) && templateRows.every(template => template.optimizationTaskId !== null);
  const reportText = reportRow?.markdownContent ?? "";
  const reportShowsSpecifiedCount = reportText.includes("客户指定问题 10 条") || reportText.includes("10 条客户指定问题");
  const reportUsesManualA = reportText.includes("AI 经营诊断系统专题页") || reportText.includes("AI 运营诊断系统");
  const reportUsesManualB = reportText.includes("缺少竞品对比页、FAQ、客户案例") && reportText.includes("小鹅通") && reportText.includes("有赞教育");

  const finalSpecifiedRows = await db
    .select()
    .from(questions)
    .where(and(eq(questions.projectId, projectId), inArray(questions.questionText, specifiedQuestions)));
  const finalSpecifiedResponses = await db
    .select()
    .from(aiResponses)
    .where(and(eq(aiResponses.projectId, projectId), inArray(aiResponses.questionId, finalSpecifiedRows.map(row => row.id))));
  const finalSpecifiedAnalyses = await db
    .select()
    .from(analysisResults)
    .innerJoin(aiResponses, eq(analysisResults.aiResponseId, aiResponses.id))
    .where(and(eq(analysisResults.projectId, projectId), inArray(aiResponses.questionId, finalSpecifiedRows.map(row => row.id))));
  const manualAuditRows = await db
    .select({
      id: analysisResults.id,
      questionText: aiResponses.questionText,
      manuallyReviewed: analysisResults.manuallyReviewed,
      manualOverrideJson: analysisResults.manualOverrideJson,
      reviewNote: analysisResults.reviewNote,
    })
    .from(analysisResults)
    .innerJoin(aiResponses, eq(analysisResults.aiResponseId, aiResponses.id))
    .where(inArray(analysisResults.id, [sampleA.id, sampleB.id]));

  const result = {
    projectId,
    projectStatus: finalProject.status,
    importResult,
    duplicateResult,
    responseImportResult,
    specifiedQuestionCount: finalSpecifiedRows.length,
    missingSpecified,
    wrongSource: wrongSource.map(row => ({ id: row.id, questionText: row.questionText, source: row.source, questionType: row.questionType })),
    specifiedResponseCount: finalSpecifiedResponses.length,
    specifiedAnalysisCount: finalSpecifiedAnalyses.length,
    manualReviewedSamples: [sampleA.questionText, sampleB.questionText],
    manualReviewAudit: manualAuditRows.map(row => ({
      questionText: row.questionText,
      manuallyReviewed: row.manuallyReviewed,
      manualOverrideJson: row.manualOverrideJson,
      reviewNote: row.reviewNote,
    })),
    rawScore,
    effectiveScore,
    latestScore: latestScore ? {
      totalScore: latestScore.totalScore,
      aiVisibilityScore: latestScore.aiVisibilityScore,
      aiRecommendationScore: latestScore.aiRecommendationScore,
      competitorWinScore: latestScore.competitorWinScore,
      cognitionAccuracyScore: latestScore.cognitionAccuracyScore,
      contentAssetScore: latestScore.contentAssetScore,
      visibilityLevel: latestScore.visibilityLevel,
    } : null,
    downstreamGenerateResult: {
      score: scoreResult.score,
      tasks: taskResult.count,
      templates: templateResult.count,
      reportTotalScore: reportResult.report.totalScore,
    },
    taskCount: taskRows.length,
    templateCount: templateRows.length,
    templateBoundCount: templateRows.filter(row => row.optimizationTaskId !== null).length,
    reportLength: reportText.length,
    checks: {
      allSpecifiedManualSource: finalSpecifiedRows.length === 10 && finalSpecifiedRows.every(row => row.source === "manual" && row.questionType === "指定问题"),
      duplicateSkipped: duplicateResult.addedCount === 0 && duplicateResult.skippedDuplicateCount >= 10,
      specifiedEnteredResponses: finalSpecifiedResponses.length >= 10,
      specifiedEnteredAnalysis: finalSpecifiedAnalyses.length >= 10,
      scoreUsesManualReview: latestScore?.totalScore === effectiveScore.totalScore
        && latestScore?.aiVisibilityScore === effectiveScore.aiVisibilityScore
        && latestScore?.aiRecommendationScore === effectiveScore.aiRecommendationScore
        && latestScore?.competitorWinScore === effectiveScore.competitorWinScore
        && JSON.stringify(rawScore.calculationDetail) !== JSON.stringify(effectiveScore.calculationDetail),
      tasksUseManualGaps,
      templatesUseTaskContext,
      reportShowsSpecifiedCount,
      reportUsesManualReview: reportUsesManualA && reportUsesManualB,
      harnessReportReady: finalProject.status === "report_ready",
    },
    evidence: {
      taskSnippets: taskRows.slice(0, 3).map(task => ({ taskType: task.taskType, taskName: task.taskName, executionSuggestion: task.executionSuggestion })),
      templateTitles: templateRows.map(template => ({ type: template.templateType, title: template.title, optimizationTaskId: template.optimizationTaskId })),
      reportSnippets: {
        specifiedCount: reportText.match(/客户指定问题.{0,20}/)?.[0] ?? null,
        manualA: reportText.match(/AI[^。；\n]{0,40}诊断系统[^。；\n]{0,60}/)?.[0] ?? null,
        manualB: reportText.match(/缺少竞品对比页、FAQ、客户案例[^。；\n]{0,80}/)?.[0] ?? null,
      },
    },
  };

  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
