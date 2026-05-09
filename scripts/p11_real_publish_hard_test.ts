import { desc, eq, inArray } from "drizzle-orm";
import { appRouter } from "../server/routers";
import { getDb } from "../server/db";
import {
  analysisResults,
  geoArticleQualityScores,
  geoArticles,
  geoArticleTopics,
  geoPublishRecords,
  optimizationTasks,
  projects,
  questions,
  reports,
  contentTemplates,
} from "../drizzle/schema";
import { detectForbiddenArticleContent, validateGeoCollectableStructure } from "../server/geoArticleLogic";
import { existsSync, readFileSync } from "node:fs";

const fail = (message: string): never => {
  throw new Error(message);
};

const assert = (condition: unknown, message: string) => {
  if (!condition) fail(message);
};

const requiredMaterialKeys = ["GEO 内容页版", "公众号长文版", "知乎回答版", "小红书笔记版", "百家号/头条号版"] as const;
const geoPagesSource = readFileSync("client/src/pages/GeoPages.tsx", "utf8");
const copySuccessToastEvidence = geoPagesSource.includes("navigator.clipboard.writeText(value).then(() => toast.success(\"已复制平台素材\"))");
assert(copySuccessToastEvidence, "第三方素材复制缺少成功提示回调，无法证明复制成功后有页面提示");
const clipboardRuntimeEvidencePath = "p11_clipboard_runtime_evidence.json";
assert(existsSync(clipboardRuntimeEvidencePath), "缺少第三方素材复制运行时证据文件 p11_clipboard_runtime_evidence.json");
const clipboardRuntimeEvidence = JSON.parse(readFileSync(clipboardRuntimeEvidencePath, "utf8")) as {
  successToastSeen?: boolean;
  clipboardNonEmpty?: boolean;
  clipboardTextLength?: number;
  clipboardTextPreview?: string;
  successText?: string;
  runtime?: string;
  url?: string;
};
assert(clipboardRuntimeEvidence.successToastSeen === true, "浏览器运行时未捕获到“已复制平台素材”成功提示");
assert(clipboardRuntimeEvidence.clipboardNonEmpty === true && Number(clipboardRuntimeEvidence.clipboardTextLength) > 100, "浏览器运行时剪贴板内容为空或过短");
assert(String(clipboardRuntimeEvidence.clipboardTextPreview ?? "").includes("海豚知道"), "剪贴板素材预览未包含海豚知道，无法证明与目标素材一致");
const requiredStructureMarkers = [
  "# ",
  "## 摘要",
  "## 核心问题回答",
  "## 生成依据",
  "## 适合客户",
  "## 不适合客户",
  "## 竞品/方案对比",
  "## FAQ",
  "## 结论",
  "## 行动引导",
  "## 更新时间",
  "## 企业实体信息",
  "## 引用友好片段",
];

function normalizeTask(task: typeof optimizationTasks.$inferSelect) {
  return {
    ...task,
    priority: task.priority as "P0" | "P1" | "P2",
  };
}

function chooseArticleTargets(topics: Array<typeof geoArticleTopics.$inferSelect>, tasks: Array<typeof optimizationTasks.$inferSelect>) {
  const taskById = new Map(tasks.map(task => [task.id, task]));
  const competitor = topics.find(topic => topic.articleType === "竞品对比型 GEO 文章" || taskById.get(topic.optimizationTaskId ?? 0)?.taskType === "竞品对比页");
  const product = topics.find(topic => taskById.get(topic.optimizationTaskId ?? 0)?.taskType === "产品页")
    ?? topics.find(topic => topic.title.includes("产品页") || topic.businessReason.includes("产品页"));
  const industry = topics.find(topic => topic.articleType === "行业选型型 GEO 文章" || taskById.get(topic.optimizationTaskId ?? 0)?.taskType === "行业文章");
  const picked = [
    { label: "竞品对比文章", topic: competitor },
    { label: "产品能力说明文章", topic: product },
    { label: "行业选型指南文章", topic: industry },
  ];
  for (const item of picked) assert(item.topic, `未找到${item.label}对应选题`);
  const seen = new Set<number>();
  return picked.map(item => ({ label: item.label, topic: item.topic! })).filter(item => {
    if (seen.has(item.topic.id)) return false;
    seen.add(item.topic.id);
    return true;
  });
}

function markdownToBasicHtml(markdown: string) {
  return markdown
    .split("\n")
    .map(line => {
      if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
      if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
      if (line.startsWith("- ")) return `<li>${line.slice(2)}</li>`;
      if (!line.trim()) return "";
      return `<p>${line}</p>`;
    })
    .join("\n");
}

async function main() {
  const db = await getDb();
  if (!db) fail("数据库不可用");

  const caller = appRouter.createCaller({
    user: { id: 1, openId: "p11-hard-test", role: "admin", name: "P1.1 Hard Test", email: null, loginMethod: null, lastSignedIn: new Date(), createdAt: new Date(), updatedAt: new Date() },
    req: {} as never,
    res: {} as never,
  });

  const project = (await db.select().from(projects).where(eq(projects.enterpriseName, "海豚知道")).limit(1))[0] ?? fail("未找到海豚知道项目");
  const projectId = project.id;

  const projectQuestions = await db.select().from(questions).where(eq(questions.projectId, projectId));
  const specifiedQuestions = projectQuestions.filter(question => question.source === "manual" || question.questionType === "指定问题");
  const analyses = await db.select().from(analysisResults).where(eq(analysisResults.projectId, projectId));
  const tasks = await db.select().from(optimizationTasks).where(eq(optimizationTasks.projectId, projectId));

  assert(specifiedQuestions.length >= 3, "客户指定问题不足，不能做真实选题测试");
  assert(analyses.length > 0, "缺少 GEO 诊断分析结果");
  assert(tasks.length > 0, "缺少优化任务");
  assert(tasks.some(task => task.taskType === "竞品对比页"), "缺少竞品对比页优化任务");
  assert(tasks.some(task => task.taskType === "产品页"), "缺少产品页优化任务");
  assert(tasks.some(task => task.taskType === "行业文章"), "缺少行业文章优化任务");

  await caller.geo.articles.topics.generate({ projectId });
  const generatedTopics = await db.select().from(geoArticleTopics).where(eq(geoArticleTopics.projectId, projectId)).orderBy(desc(geoArticleTopics.createdAt));
  assert(generatedTopics.length >= 5 && generatedTopics.length <= 10, `选题数量应为 5-10，实际为 ${generatedTopics.length}`);

  const articleTargets = chooseArticleTargets(generatedTopics, tasks);
  assert(articleTargets.length === 3, "三类文章选题去重后不足 3 个");

  const generatedArticles: Array<{
    label: string;
    topic: typeof geoArticleTopics.$inferSelect;
    article: typeof geoArticles.$inferSelect;
    quality: typeof geoArticleQualityScores.$inferSelect;
    task: typeof optimizationTasks.$inferSelect | undefined;
    lowScoreBlockMessage?: string;
    preAuditPublishBlockMessage?: string;
  }> = [];

  for (const target of articleTargets) {
    const generated = await caller.geo.articles.generate({ topicId: target.topic.id });
    const article = (await db.select().from(geoArticles).where(eq(geoArticles.id, generated.articleId)).limit(1))[0] ?? fail(`未找到已生成文章：${target.label}`);
    const task = tasks.find(item => item.id === article.optimizationTaskId);
    const basis = article.generationBasis as Record<string, unknown> | null;
    assert(article.status === "待质检", `${target.label}生成后状态应为待质检，实际为 ${article.status}`);
    assert(basis?.customerQuestion, `${target.label}缺少生成依据：客户指定问题`);
    assert(basis?.contentGap, `${target.label}缺少生成依据：内容缺口`);
    assert(basis?.optimizationTask, `${target.label}缺少生成依据：优化任务`);
    assert(basis?.notRecommendedReason, `${target.label}缺少生成依据：AI 未推荐原因`);
    assert(basis?.competitorGap, `${target.label}缺少生成依据：竞品差距`);
    assert(specifiedQuestions.some(question => question.questionText === basis.customerQuestion), `${target.label}生成依据不是来自客户指定问题`);
    for (const marker of requiredStructureMarkers) assert(article.markdownContent.includes(marker), `${target.label}缺少结构：${marker}`);
    assert((article.citableSnippets as Array<unknown> | null)?.length && (article.citableSnippets as Array<unknown>).length >= 3 && (article.citableSnippets as Array<unknown>).length <= 5, `${target.label}引用友好片段数量不合规`);
    for (const context of ["海豚知道", "知识付费", "AI 经营系统"]) assert(article.markdownContent.includes(context), `${target.label}缺少真实上下文：${context}`);
    assert(article.markdownContent.includes("小鹅通") || article.markdownContent.includes("有赞教育"), `${target.label}缺少小鹅通/有赞教育竞品上下文`);
    const forbidden = detectForbiddenArticleContent(article.markdownContent);
    assert(forbidden.length === 0, `${target.label}存在禁用内容：${forbidden.join("、")}`);
    const materials = article.thirdPartyMaterials as Record<string, string>;
    for (const key of requiredMaterialKeys) assert(typeof materials[key] === "string" && materials[key].length > 100, `${target.label}缺少第三方平台素材：${key}`);
    assert(markdownToBasicHtml(materials["公众号长文版"]).includes("<h1>"), `${target.label}HTML 导出转换异常`);

    let preAuditPublishBlockMessage = "";
    try {
      await caller.geo.articles.publish({ articleId: article.id });
      fail(`${target.label}未审核通过前不应允许发布`);
    } catch (error) {
      preAuditPublishBlockMessage = error instanceof Error ? error.message : String(error);
      assert(preAuditPublishBlockMessage.includes("未审核通过"), `${target.label}未审核发布阻断提示异常：${preAuditPublishBlockMessage}`);
    }

    await caller.geo.articles.qualityCheck({ articleId: article.id });
    const quality = (await db.select().from(geoArticleQualityScores).where(eq(geoArticleQualityScores.articleId, article.id)).orderBy(desc(geoArticleQualityScores.createdAt)).limit(1))[0] ?? fail(`${target.label}未生成质量评分`);
    const checkedArticle = (await db.select().from(geoArticles).where(eq(geoArticles.id, article.id)).limit(1))[0] ?? fail(`${target.label}质检后文章不存在`);
    assert(quality.totalScore >= 80, `${target.label}真实生成文章质量分低于 80：${quality.totalScore}`);
    assert(quality.blocked === 0, `${target.label}真实生成文章被阻断：${JSON.stringify(quality.blockReasons)}`);
    assert(checkedArticle.status === "待审核", `${target.label}质检通过后状态应为待审核，实际为 ${checkedArticle.status}`);
    for (const scoreField of ["problemMatchScore", "evidenceScore", "structureScore", "originalityScore", "geoCitableScore", "complianceScore"] as const) {
      assert(Number.isFinite(quality[scoreField]) && quality[scoreField] > 0, `${target.label}缺少分项评分：${scoreField}`);
    }
    assert(quality.reviewSummary.includes("质检通过") && quality.reviewSummary.includes(String(quality.totalScore)), `${target.label}缺少质检总结或总分`);
    assert(quality.reviewSummary.includes("优化建议"), `${target.label}质检总结缺少优化建议`);

    generatedArticles.push({ label: target.label, topic: target.topic, article: checkedArticle, quality, task, preAuditPublishBlockMessage });
  }

  const lowScoreArticle = generatedArticles[1];
  await db.insert(geoArticleQualityScores).values({
    projectId,
    articleId: lowScoreArticle.article.id,
    problemMatchScore: 10,
    evidenceScore: 10,
    structureScore: 10,
    originalityScore: 10,
    geoCitableScore: 10,
    complianceScore: 10,
    totalScore: 60,
    blocked: 1,
    blockReasons: ["硬测试模拟：内容质量分 60 低于 80 分"],
    reviewSummary: "硬测试模拟低分阻断，不代表真实文章最终质量。",
  });
  await db.update(geoArticles).set({ status: "质检未通过" }).where(eq(geoArticles.id, lowScoreArticle.article.id));
  let lowScoreBlockMessage = "";
  try {
    await caller.geo.articles.audit({ articleId: lowScoreArticle.article.id, approved: true, note: "硬测试不应通过" });
    fail("低于 80 分文章不应允许审核");
  } catch (error) {
    lowScoreBlockMessage = error instanceof Error ? error.message : String(error);
    assert(lowScoreBlockMessage.includes("低于 80") || lowScoreBlockMessage.includes("未质检通过"), `低分审核阻断提示异常：${lowScoreBlockMessage}`);
  }
  lowScoreArticle.lowScoreBlockMessage = lowScoreBlockMessage;

  const publishCandidate = generatedArticles.find(item => item.article.id !== lowScoreArticle.article.id && item.quality.totalScore >= 80) ?? fail("没有可发布候选文章");
  await caller.geo.articles.audit({ articleId: publishCandidate.article.id, approved: true, note: "P1.1 真实发布硬测试人工审核通过" });
  const publishResult = await caller.geo.articles.publish({ articleId: publishCandidate.article.id });
  const publishedArticle = (await db.select().from(geoArticles).where(eq(geoArticles.id, publishCandidate.article.id)).limit(1))[0] ?? fail("发布后文章不存在");
  assert(publishedArticle.status === "已发布", `发布后文章状态异常：${publishedArticle.status}`);
  assert(publishedArticle.publicPath === publishResult.publicPath, "发布返回链接与文章 publicPath 不一致");

  const publishRecord = (await db.select().from(geoPublishRecords).where(eq(geoPublishRecords.articleId, publishedArticle.id)).orderBy(desc(geoPublishRecords.publishedAt)).limit(1))[0] ?? fail("未生成发布记录");
  assert(publishRecord.optimizationTaskId === publishedArticle.optimizationTaskId, "发布记录未绑定优化任务");
  assert(publishRecord.qualityScore === publishCandidate.quality.totalScore, "发布记录质量分与质检分不一致");
  assert(publishRecord.publishUrl === publishedArticle.publicPath, "发布记录链接与文章链接不一致");
  assert(publishRecord.needRetest === 1, "发布记录未标记待复测");

  const retestTask = publishedArticle.optimizationTaskId
    ? (await db.select().from(optimizationTasks).where(eq(optimizationTasks.id, publishedArticle.optimizationTaskId)).limit(1))[0]
    : undefined;
  assert(retestTask?.status === "retest", `关联任务未进入待复测，实际为 ${retestTask?.status}`);
  assert(retestTask?.needRetest === 1, "关联任务 needRetest 未置为 1");
  assert(retestTask?.publishedUrl === publishedArticle.publicPath, "关联任务发布链接未回填");

  const publicContent = await caller.geo.articles.publicContent({ projectId, articleId: publishedArticle.id });
  assert(publicContent.article.id === publishedArticle.id, "公开内容接口返回文章不一致");
  assert(publicContent.qualityScore?.totalScore === publishCandidate.quality.totalScore, "公开内容接口质量分不一致");
  const publicText = `${publicContent.article.title}\n${publicContent.article.markdownContent}`;
  assert(!publicText.includes("example.com"), "公开内容含 example.com");
  assert(!/[A-Za-z]{8,}\s+placeholder|Lorem ipsum/i.test(publicText), "公开内容含英文占位");
  assert(validateGeoCollectableStructure(publicContent.article.markdownContent, publicContent.article.citableSnippets as never, publicContent.article.generationBasis as never).length === 0, "公开内容缺少 GEO 可收录结构");

  const currentArticles = await db.select().from(geoArticles).where(eq(geoArticles.projectId, projectId));
  const currentRecords = await db.select().from(geoPublishRecords).where(eq(geoPublishRecords.projectId, projectId));
  const currentTasks = await db.select().from(optimizationTasks).where(eq(optimizationTasks.projectId, projectId));
  const latestReport = (await db.select().from(reports).where(eq(reports.projectId, projectId)).orderBy(desc(reports.createdAt)).limit(1))[0];
  const templates = await db.select().from(contentTemplates).where(eq(contentTemplates.projectId, projectId));
  assert(currentArticles.some(article => article.status === "已发布"), "Harness 提示所需已发布文章状态不存在");
  assert(currentRecords.length >= 1, "Harness 提示所需发布记录不存在");
  assert(currentTasks.some(task => task.status === "retest" && task.needRetest === 1), "Harness 提示所需待复测任务不存在");
  assert(project.status === "report_ready", `P0.9 项目状态被异常破坏：${project.status}`);
  assert(Boolean(latestReport), "P0.9 报告不存在");
  assert(templates.length > 0, "P0.9 内容模板不存在");
  assert(analyses.some(item => item.manuallyReviewed === 1), "P0.9 人工修订结果不存在");
  assert(specifiedQuestions.length >= 10, "P0.9 指定问题数量异常");

  const articleIds = generatedArticles.map(item => item.article.id);
  const finalArticles = await db.select().from(geoArticles).where(inArray(geoArticles.id, articleIds));
  const finalArticleById = new Map(finalArticles.map(article => [article.id, article]));
  const result = {
    project: {
      id: project.id,
      enterpriseName: project.enterpriseName,
      industry: project.industry,
      website: project.website,
      specifiedQuestionCount: specifiedQuestions.length,
      analysisCount: analyses.length,
      taskCount: tasks.length,
    },
    topicGeneration: {
      generatedTopicCount: generatedTopics.length,
      selectedTopics: articleTargets.map(target => ({ label: target.label, topicId: target.topic.id, title: target.topic.title, articleType: target.topic.articleType, taskId: target.topic.optimizationTaskId })),
    },
    articles: generatedArticles.map(item => {
      const finalArticle = finalArticleById.get(item.article.id) ?? item.article;
      const materialKeys = Object.keys(finalArticle.thirdPartyMaterials as Record<string, string>);
      const basis = finalArticle.generationBasis as Record<string, unknown>;
      return {
        label: item.label,
        articleId: finalArticle.id,
        title: finalArticle.title,
        articleType: finalArticle.articleType,
        finalStatus: finalArticle.status,
        qualityScore: {
          problemMatchScore: item.quality.problemMatchScore,
          evidenceScore: item.quality.evidenceScore,
          structureScore: item.quality.structureScore,
          originalityScore: item.quality.originalityScore,
          geoCitableScore: item.quality.geoCitableScore,
          complianceScore: item.quality.complianceScore,
          totalScore: item.quality.totalScore,
          blocked: Boolean(item.quality.blocked),
          blockReasons: item.quality.blockReasons,
          reviewSummary: item.quality.reviewSummary,
        },
        generationBasis: {
          customerQuestion: basis.customerQuestion,
          contentGap: String(basis.contentGap).slice(0, 240),
          optimizationTask: basis.optimizationTask,
          notRecommendedReason: String(basis.notRecommendedReason).slice(0, 240),
          competitorGap: String(basis.competitorGap).slice(0, 240),
        },
        citableSnippetCount: (finalArticle.citableSnippets as Array<unknown> | null)?.length ?? 0,
        thirdPartyMaterialKeys: materialKeys,
        markdownExportOk: requiredMaterialKeys.every(key => typeof (finalArticle.thirdPartyMaterials as Record<string, string>)[key] === "string"),
        htmlExportOk: markdownToBasicHtml((finalArticle.thirdPartyMaterials as Record<string, string>)["公众号长文版"] ?? "").includes("<h1>"),
        copySuccessToastEvidence,
        clipboardRuntimeEvidence: {
          successToastSeen: clipboardRuntimeEvidence.successToastSeen,
          clipboardNonEmpty: clipboardRuntimeEvidence.clipboardNonEmpty,
          clipboardTextLength: clipboardRuntimeEvidence.clipboardTextLength,
          clipboardTextPreview: clipboardRuntimeEvidence.clipboardTextPreview,
          runtime: clipboardRuntimeEvidence.runtime,
          url: clipboardRuntimeEvidence.url,
        },
        preAuditPublishBlockMessage: item.preAuditPublishBlockMessage,
        lowScoreBlockMessage: item.lowScoreBlockMessage,
      };
    }),
    published: {
      articleId: publishedArticle.id,
      title: publishedArticle.title,
      publicPath: publishedArticle.publicPath,
      qualityScore: publishCandidate.quality.totalScore,
      publishRecord: {
        id: publishRecord.id,
        articleId: publishRecord.articleId,
        optimizationTaskId: publishRecord.optimizationTaskId,
        qualityScore: publishRecord.qualityScore,
        publishUrl: publishRecord.publishUrl,
        needRetest: publishRecord.needRetest,
        publishChannel: publishRecord.publishChannel,
      },
      retestTask: retestTask ? {
        id: retestTask.id,
        taskName: retestTask.taskName,
        status: retestTask.status,
        needRetest: retestTask.needRetest,
        publishedUrl: retestTask.publishedUrl,
      } : null,
    },
    harnessExpectedNextStep: "已有文章发布记录且关联任务进入待复测，下一步应提示回到 AI 语义分析 / GEO 评分对同一指定问题做复测，而不是继续批量铺文。",
    p09Regression: {
      reportExists: Boolean(latestReport),
      templateCount: templates.length,
      manuallyReviewedAnalysisCount: analyses.filter(item => item.manuallyReviewed === 1).length,
      specifiedQuestionCount: specifiedQuestions.length,
    },
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
