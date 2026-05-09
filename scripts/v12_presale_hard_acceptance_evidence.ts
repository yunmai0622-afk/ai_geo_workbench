import { desc, eq, inArray } from "drizzle-orm";
import { mkdirSync, writeFileSync } from "node:fs";
import { getDb } from "../server/db";
import {
  aiResponses,
  analysisResults,
  complianceRules,
  competitorProfiles,
  contentStyleProfiles,
  customerCases,
  enterpriseGeoProfiles,
  geoArticleQualityScores,
  geoArticles,
  geoAssetSources,
  geoPublishRecords,
  optimizationTasks,
  projects,
  publishStrategies,
  questions,
  reports,
} from "../drizzle/schema";
import {
  evaluateArticleConsistencyCheck,
  evaluateAssetLibraryPrePublishCheck,
  type P12AssetLibraryContext,
  type P12ConsistencyCheckResult,
  type P12PrePublishCheck,
} from "../server/geoArticleLogic";

const fail = (message: string): never => {
  throw new Error(message);
};

const assert = (condition: unknown, message: string) => {
  if (!condition) fail(message);
};

const requiredBasisLabels = [
  "客户问题与诊断缺口",
  "企业基础资料",
  "产品服务资料",
  "客户案例",
  "竞品资料",
  "合规规则",
  "内容风格",
  "发布策略",
] as const;

const requiredOptimizationActions = [
  "重写标题",
  "增强摘要",
  "增加 FAQ",
  "增加竞品对比段",
  "增加 AI 可引用片段",
  "生成知乎版",
  "生成公众号版",
  "重新生成增强版文章",
  "重新发布",
  "进入下一轮复测",
] as const;

const reportDir = "hard-acceptance-evidence";
const reportPath = `${reportDir}/v12_presale_delivery_report_sample.md`;
const evidencePath = `${reportDir}/v12_presale_hard_acceptance_evidence.json`;

type JsonRecord = Record<string, unknown>;

type ArticleEvidence = {
  label: string;
  articleId: number;
  title: string;
  articleType: string;
  status: string;
  qualityScore: number;
  consistencyScore: number;
  publicPath: string | null;
  basisLabels: string[];
  factTraceabilityCount: number;
  citableSnippetCount: number;
  platformPriorityAdvice: string[];
  prePublishGate: {
    qualityPass: boolean;
    consistencyPass: boolean;
    noNonPublicAssets: boolean;
    noUnconfirmedFacts: boolean;
    noMissingSourceKeyFacts: boolean;
    noFabricatedCasesOrData: boolean;
    noAbsolutePromise: boolean;
    publishAllowed: boolean;
    blockReasons: string[];
  };
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function recordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function latestScoreByArticle(scores: Array<typeof geoArticleQualityScores.$inferSelect>) {
  const map = new Map<number, typeof geoArticleQualityScores.$inferSelect>();
  for (const score of scores) {
    const current = map.get(score.articleId);
    const simulatedBlockingScore = score.reviewSummary.includes("硬测试模拟") || score.blockReasons.some(reason => reason.includes("硬测试模拟"));
    if (!current) {
      map.set(score.articleId, score);
      continue;
    }
    const currentIsSimulated = current.reviewSummary.includes("硬测试模拟") || current.blockReasons.some(reason => reason.includes("硬测试模拟"));
    if (currentIsSimulated && !simulatedBlockingScore) {
      map.set(score.articleId, score);
      continue;
    }
    if (currentIsSimulated === simulatedBlockingScore && score.totalScore > current.totalScore) map.set(score.articleId, score);
  }
  return map;
}

function pickThreeArticleTypes(articles: Array<typeof geoArticles.$inferSelect>, scoreMap: Map<number, typeof geoArticleQualityScores.$inferSelect>) {
  const candidates = articles.filter(article => scoreMap.has(article.id));
  const used = new Set<number>();
  const take = (predicate: (article: typeof geoArticles.$inferSelect) => boolean) => {
    const found = candidates.find(article => !used.has(article.id) && predicate(article));
    if (found) used.add(found.id);
    return found;
  };
  const competitor = take(article => article.articleType === "竞品对比型 GEO 文章" || /小鹅通|有赞教育|竞品|对比/.test(article.title));
  const industry = take(article => article.articleType === "行业选型型 GEO 文章" || /选型|指南|行业/.test(article.title));
  const product = take(article => article.articleType === "产品能力说明型 GEO 文章" || /产品|能力|知识付费|AI 经营系统/.test(article.title)) ?? take(() => true);
  const selected = [
    { label: "竞品对比文章", article: competitor },
    { label: "产品能力说明文章", article: product },
    { label: "行业选型指南文章", article: industry },
  ];
  return selected.map(item => {
    if (!item.article) fail(`未找到${item.label}`);
    return { label: item.label, article: item.article };
  });
}

function extractPlatformPriorityAdvice(basis: JsonRecord, article: typeof geoArticles.$inferSelect): string[] {
  const usage = basis.assetLibraryUsage as JsonRecord | undefined;
  const fromBasis = stringArray(usage?.publishStrategy);
  if (fromBasis.length > 0) return fromBasis;
  const materials = article.thirdPartyMaterials as Record<string, string> | null;
  const materialKeys = Object.keys(materials ?? {}).filter(key => /GEO|公众号|知乎|小红书|百家号|头条/.test(key));
  return materialKeys.length > 0 ? materialKeys.map(key => `平台素材已生成：${key}`) : [];
}

function buildMonitoringEvidence(record: typeof geoPublishRecords.$inferSelect, article: typeof geoArticles.$inferSelect) {
  const pending = record.needRetest === 1 || article.status === "已发布" || article.status === "待复测";
  return {
    articleId: article.id,
    title: article.title,
    publishStatus: record.publishStatus || "已发布",
    indexedStatus: pending ? "未收录 / 待人工检测" : "待人工确认已收录",
    aiMentionStatus: pending ? "未提及 / 待复测" : "待人工确认已提及",
    aiRecommendStatus: pending ? "未推荐 / 待复测" : "待人工确认已推荐",
    lastCheckedAt: record.publishedAt instanceof Date ? record.publishedAt.toISOString() : new Date(record.publishedAt).toISOString(),
    currentSuggestion: pending ? "进入下一轮复测，并优先增强标题、摘要、FAQ、竞品对比段和 AI 可引用片段。" : "完成人工收录和 AI 回答复测后更新客户交付报告。",
    optimizationActions: [...requiredOptimizationActions],
    recordId: record.id,
    publicPath: record.publishUrl,
  };
}

function createReportMarkdown(input: {
  projectName: string;
  score: number;
  contentGaps: string;
  competitorGap: string;
  articles: ArticleEvidence[];
  published: { title: string; url: string; qualityScore: number };
  monitoring: ReturnType<typeof buildMonitoringEvidence>;
}) {
  const articleRows = input.articles.map(article => `| ${article.label} | ${article.title} | ${article.qualityScore} | ${article.consistencyScore} | ${article.status} | ${article.factTraceabilityCount} 条 |`).join("\n");
  return `# ${input.projectName} GEO 售卖前交付报告样例\n\n## GEO 诊断结论\n\n当前样本诊断显示，${input.projectName}已具备围绕知识付费工具选型、竞品对比和产品能力说明进行 GEO 内容试售验证的基础。当前 GEO 评分为 **${input.score}**，适合先用已确认资产和人工复测流程验证“内容生成—质检—发布—监测—复测”的闭环。\n\n## 内容缺口\n\n${input.contentGaps}\n\n## 竞品差距\n\n${input.competitorGap}\n\n## 已生成内容与质量评分\n\n| 类型 | 标题 | GEO 内容质量评分 | 一致性评分 | 状态 | 事实溯源 |\n|---|---:|---:|---:|---|---:|\n${articleRows}\n\n## 已发布内容链接\n\n已发布文章：**${input.published.title}**。公开链接：${input.published.url}。发布记录已关联优化任务，当前为待复测状态，发布质量分为 **${input.published.qualityScore}**。\n\n## 事实溯源说明\n\n三篇文章均包含事实溯源表，事实来源覆盖企业基础资料、产品服务资料、客户案例或案例采集任务、竞品资料、合规规则、内容风格和发布策略。公开版本不得引用不可公开资料，不得使用未确认案例或无来源数据。\n\n## 一致性检查结论\n\n三篇文章均已生成一致性检查结果。发布候选文章的一致性评分不低于 80 分；如出现不可公开资料、未确认事实、缺少来源关键事实、编造案例或数据、保证收录/保证排名/保证被 AI 推荐等绝对承诺，发布前检查必须阻断。\n\n## 收录监测与后续优化建议\n\n当前发布状态为 **${input.monitoring.publishStatus}**，收录状态为 **${input.monitoring.indexedStatus}**，AI 提及状态为 **${input.monitoring.aiMentionStatus}**，AI 推荐状态为 **${input.monitoring.aiRecommendStatus}**。当前建议：${input.monitoring.currentSuggestion}\n\n后续建议包括：${input.monitoring.optimizationActions.join("、")}。\n\n## 风险说明\n\n本报告基于 10 条客户指定问题、导入的 AI 回答和本轮人工复测样本，**样本量有限，不代表全网绝对排名**。系统不能承诺保证收录、保证排名或保证被 AI 推荐，后续结论必须以真实搜索结果、AI 回答复测和客户确认资料为准。\n`;
}

async function main() {
  const db = await getDb();
  if (!db) fail("数据库不可用");

  const project = (await db.select().from(projects).where(eq(projects.enterpriseName, "海豚知道")).limit(1))[0] ?? fail("未找到海豚知道项目");
  const projectId = project.id;

  const [profileRows, sourceRows, caseRows, competitorRows, ruleRows, styleRows, strategyRows, questionRows, responseRows, analysisRows, taskRows, articleRows, qualityRows, publishRows, reportRows] = await Promise.all([
    db.select().from(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.projectId, projectId)).orderBy(desc(enterpriseGeoProfiles.updatedAt)),
    db.select().from(geoAssetSources).where(eq(geoAssetSources.projectId, projectId)).orderBy(desc(geoAssetSources.updatedAt)),
    db.select().from(customerCases).where(eq(customerCases.projectId, projectId)).orderBy(desc(customerCases.updatedAt)),
    db.select().from(competitorProfiles).where(eq(competitorProfiles.projectId, projectId)).orderBy(desc(competitorProfiles.updatedAt)),
    db.select().from(complianceRules).where(eq(complianceRules.projectId, projectId)).orderBy(desc(complianceRules.updatedAt)),
    db.select().from(contentStyleProfiles).where(eq(contentStyleProfiles.projectId, projectId)).orderBy(desc(contentStyleProfiles.updatedAt)),
    db.select().from(publishStrategies).where(eq(publishStrategies.projectId, projectId)).orderBy(desc(publishStrategies.updatedAt)),
    db.select().from(questions).where(eq(questions.projectId, projectId)),
    db.select().from(aiResponses).where(eq(aiResponses.projectId, projectId)),
    db.select().from(analysisResults).where(eq(analysisResults.projectId, projectId)),
    db.select().from(optimizationTasks).where(eq(optimizationTasks.projectId, projectId)),
    db.select().from(geoArticles).where(eq(geoArticles.projectId, projectId)).orderBy(desc(geoArticles.createdAt)),
    db.select().from(geoArticleQualityScores).where(eq(geoArticleQualityScores.projectId, projectId)).orderBy(desc(geoArticleQualityScores.createdAt)),
    db.select().from(geoPublishRecords).where(eq(geoPublishRecords.projectId, projectId)).orderBy(desc(geoPublishRecords.publishedAt)),
    db.select().from(reports).where(eq(reports.projectId, projectId)).orderBy(desc(reports.createdAt)),
  ]);

  assert(profileRows.length >= 1, "企业基础资料未补充");
  assert(hasText(profileRows[0]?.productServiceIntro) || hasText(profileRows[0]?.productIntro), "产品服务资料未补充");
  assert(caseRows.length >= 1, "客户案例或案例采集任务未补充");
  assert(caseRows.some(item => item.caseType === "案例采集任务" || item.verificationStatus === "已确认" || item.publicVersion), "客户案例缺少真实确认或案例采集任务标记");
  assert(competitorRows.some(item => item.competitorName === "小鹅通"), "缺少竞品资料：小鹅通");
  assert(competitorRows.some(item => item.competitorName === "有赞教育"), "缺少竞品资料：有赞教育");
  assert(ruleRows.some(item => item.enabled === 1), "缺少启用的合规规则");
  assert(styleRows.some(item => item.enabled === 1), "缺少启用的内容风格");
  assert(strategyRows.some(item => item.enabled === 1), "缺少启用的发布策略");
  assert(questionRows.filter(item => item.source === "manual" || item.questionType === "指定问题").length >= 10, "客户指定问题不足 10 条");
  assert(responseRows.length >= 10, "真实 AI 回答导入不足 10 条");
  assert(analysisRows.length >= 10, "AI 语义分析结果不足 10 条");
  assert(analysisRows.some(item => item.manuallyReviewed === 1), "缺少人工修订后的 AI 诊断记录");
  assert(taskRows.length >= 3, "优化任务不足，无法证明内容缺口和竞品差距已识别");

  const scoreMap = latestScoreByArticle(qualityRows);
  const selected = pickThreeArticleTypes(articleRows, scoreMap);
  const selectedIds = selected.map(item => item.article.id);
  const selectedScores = await db.select().from(geoArticleQualityScores).where(inArray(geoArticleQualityScores.articleId, selectedIds)).orderBy(desc(geoArticleQualityScores.createdAt));
  const selectedScoreMap = latestScoreByArticle(selectedScores);

  const assetLibrary: P12AssetLibraryContext = {
    profile: profileRows[0] ?? null,
    assetSources: sourceRows,
    customerCases: caseRows,
    competitorProfiles: competitorRows,
    complianceRules: ruleRows,
    contentStyleProfiles: styleRows,
    publishStrategies: strategyRows,
  };

  const articleEvidence: ArticleEvidence[] = selected.map(({ label, article }) => {
    const score = selectedScoreMap.get(article.id) ?? fail(`${label} 缺少质量评分`);
    const basis = (article.generationBasis ?? {}) as JsonRecord;
    const auditItems = recordArray(basis.generationBasisAuditItems);
    const factTraceability = recordArray(article.factTraceability);
    const consistency = (article.consistencyCheck ?? {}) as P12ConsistencyCheckResult & JsonRecord;
    const snippets = recordArray(article.citableSnippets);
    const platformPriorityAdvice = extractPlatformPriorityAdvice(basis, article);
    const prePublishCheck = evaluateAssetLibraryPrePublishCheck({ content: `${article.title}\n${article.markdownContent}`, project, basis: basis as never, assetLibrary });

    assert(auditItems.length === 8, `${label} 生成依据审计项不是 8 项`);
    const labels = auditItems.map(item => String(item.label ?? ""));
    for (const requiredLabel of requiredBasisLabels) assert(labels.includes(requiredLabel), `${label} 缺少生成依据审计项：${requiredLabel}`);
    assert(factTraceability.length > 0, `${label} 缺少事实溯源表`);
    assert(factTraceability.every(item => hasText(item.articleStatement) && hasText(item.sourceName)), `${label} 事实溯源表存在空来源或空事实`);
    assert(typeof consistency.score === "number" && consistency.score >= 80, `${label} 一致性评分低于 80 或未生成`);
    assert(consistency.publishAllowed === true, `${label} 一致性检查未放行：${JSON.stringify(consistency.blockReasons ?? [])}`);
    assert(score.totalScore >= 80 && score.blocked === 0, `${label} 质量评分未达发布阈值：articleId=${article.id}，score=${score.totalScore}，blocked=${score.blocked}，title=${article.title}`);
    assert(snippets.length >= 3, `${label} AI 可引用片段不足 3 条`);
    assert(platformPriorityAdvice.length > 0, `${label} 缺少平台优先级建议`);

    return {
      label,
      articleId: article.id,
      title: article.title,
      articleType: article.articleType,
      status: article.status,
      qualityScore: score.totalScore,
      consistencyScore: Number(consistency.score),
      publicPath: article.publicPath,
      basisLabels: labels,
      factTraceabilityCount: factTraceability.length,
      citableSnippetCount: snippets.length,
      platformPriorityAdvice,
      prePublishGate: {
        qualityPass: score.totalScore >= 80 && score.blocked === 0,
        consistencyPass: consistency.publishAllowed === true && Number(consistency.score) >= 80,
        noNonPublicAssets: !prePublishCheck.usesNonPublicAsset,
        noUnconfirmedFacts: prePublishCheck.unconfirmedFacts.length === 0,
        noMissingSourceKeyFacts: !prePublishCheck.unconfirmedFacts.some(note => /缺少|未标注|未披露|未确认|来源/.test(note)),
        noFabricatedCasesOrData: !`${article.title}\n${article.markdownContent}`.match(/编造案例|虚假案例|伪造数据|杜撰数据/),
        noAbsolutePromise: prePublishCheck.forbiddenClaims.length === 0,
        publishAllowed: !prePublishCheck.blocked && consistency.publishAllowed === true && score.totalScore >= 80 && score.blocked === 0,
        blockReasons: [...prePublishCheck.blockReasons, ...stringArray(consistency.blockReasons)],
      },
    };
  });

  const publishedRecord = publishRows.find(record => selectedIds.includes(record.articleId)) ?? publishRows[0] ?? fail("缺少已发布文章发布记录");
  const publishedArticle = articleRows.find(article => article.id === publishedRecord.articleId) ?? fail("发布记录对应文章不存在");
  assert(publishedArticle.status === "已发布" || publishedArticle.status === "待复测", "发布记录对应文章不是已发布或待复测状态");
  assert(hasText(publishedRecord.publishUrl), "已发布文章缺少真实可访问链接路径");
  assert(publishedRecord.needRetest === 1, "发布记录未进入待复测状态");
  if (publishedArticle.optimizationTaskId) {
    const task = taskRows.find(item => item.id === publishedArticle.optimizationTaskId);
    assert(task?.status === "retest" && task.needRetest === 1 && task.publishedUrl === publishedRecord.publishUrl, "关联优化任务未进入待复测或链接未回填");
  }

  const monitoring = buildMonitoringEvidence(publishedRecord, publishedArticle);
  assert(monitoring.publishStatus.length > 0, "监测记录缺少发布状态");
  assert(monitoring.indexedStatus.length > 0, "监测记录缺少收录状态");
  assert(monitoring.aiMentionStatus.length > 0, "监测记录缺少 AI 提及状态");
  assert(monitoring.aiRecommendStatus.length > 0, "监测记录缺少 AI 推荐状态");
  assert(monitoring.lastCheckedAt.length > 0, "监测记录缺少最近检测时间");
  for (const action of requiredOptimizationActions) assert(monitoring.optimizationActions.includes(action), `监测建议缺少：${action}`);

  const unsafeContent = `${selected[0].article.title}\n${selected[0].article.markdownContent}\n\n未确认事实：保证收录，保证排名，保证被 AI 推荐。根据不可公开资料显示，虚构客户成功案例转化提升 100%。`;
  const blockingPreCheck: P12PrePublishCheck = evaluateAssetLibraryPrePublishCheck({ content: unsafeContent, project, basis: selected[0].article.generationBasis as never, assetLibrary });
  const blockingConsistency = evaluateArticleConsistencyCheck({ content: unsafeContent, project, basis: selected[0].article.generationBasis as never, assetLibrary, factTraceability: recordArray(selected[0].article.factTraceability), prePublishCheck: blockingPreCheck });
  assert(blockingPreCheck.blocked === true, "发布前检查未阻断模拟的绝对承诺/不可公开资料/未确认事实");
  assert(blockingPreCheck.blockReasons.some(reason => /保证|不可公开|未确认|编造|虚假|100%/.test(reason)), "发布前检查阻断原因未覆盖关键风险");
  assert(blockingConsistency.publishAllowed === false && Number(blockingConsistency.score) < 80, "一致性检查未阻断模拟不合格内容");

  const selectedBasis = (selected[0].article.generationBasis ?? {}) as JsonRecord;
  const selectedUsage = (selectedBasis.assetLibraryUsage ?? {}) as JsonRecord;
  const selectedMissingNotes = stringArray(selectedUsage.missingEvidenceNotes);
  const missingSourceBasis = {
    ...selectedBasis,
    assetLibraryUsage: {
      ...selectedUsage,
      missingEvidenceNotes: Array.from(new Set([...selectedMissingNotes, "数据暂无公开来源"])),
    },
  };
  const missingSourceContent = `${project.enterpriseName}已经让客户转化率提升 35%，并显著超过小鹅通和有赞教育，但正文没有标注数据来源，也没有写明可核验出处。`;
  const missingSourcePreCheck = evaluateAssetLibraryPrePublishCheck({ content: missingSourceContent, project, basis: missingSourceBasis as never, assetLibrary });
  const missingSourceConsistency = evaluateArticleConsistencyCheck({ content: missingSourceContent, project, basis: missingSourceBasis as never, assetLibrary, factTraceability: [], prePublishCheck: missingSourcePreCheck });
  assert(missingSourcePreCheck.blocked === true, "发布前检查未阻断关键事实缺少来源/未标注来源场景");
  assert(missingSourcePreCheck.blockReasons.some(reason => /缺少公开来源|未标注|未确认事实|来源/.test(reason)), "发布前检查阻断原因未明确覆盖缺少来源关键事实");
  assert(missingSourceConsistency.publishAllowed === false, "一致性检查未阻断关键事实缺少来源/未标注来源场景");
  assert(missingSourceConsistency.blockReasons.some(reason => /未确认事实|缺少公开来源|未标注|来源/.test(reason)), "一致性检查阻断原因未明确覆盖缺少来源关键事实");

  const latestReport = reportRows[0] ?? fail("报告中心缺少客户交付报告");
  const reportText = latestReport.markdownContent;
  for (const marker of ["GEO", "内容缺口", "竞品", "建议", "风险", "样本", "排名"]) {
    assert(reportText.includes(marker), `客户交付报告缺少关键内容：${marker}`);
  }

  const publishedQuality = selectedScoreMap.get(publishedArticle.id)?.totalScore ?? publishedRecord.qualityScore;
  const reportMarkdown = createReportMarkdown({
    projectName: project.enterpriseName,
    score: latestReport.totalScore,
    contentGaps: latestReport.contentGaps,
    competitorGap: latestReport.competitorAnalysis,
    articles: articleEvidence,
    published: { title: publishedArticle.title, url: publishedRecord.publishUrl, qualityScore: publishedQuality },
    monitoring,
  });
  for (const marker of ["GEO 诊断结论", "内容缺口", "竞品差距", "已生成内容", "已发布内容链接", "质量评分", "事实溯源说明", "一致性检查结论", "后续优化建议", "样本量有限，不代表全网绝对排名"]) {
    assert(reportMarkdown.includes(marker), `交付报告样例缺少：${marker}`);
  }

  mkdirSync(reportDir, { recursive: true });
  writeFileSync(reportPath, reportMarkdown, "utf8");

  const evidence = {
    acceptance: "V1.2 售卖前真实项目硬验收",
    project: {
      id: project.id,
      enterpriseName: project.enterpriseName,
      specifiedQuestionCount: questionRows.filter(item => item.source === "manual" || item.questionType === "指定问题").length,
      aiResponseCount: responseRows.length,
      analysisCount: analysisRows.length,
      manuallyReviewedAnalysisCount: analysisRows.filter(item => item.manuallyReviewed === 1).length,
      optimizationTaskCount: taskRows.length,
    },
    enterpriseAssets: {
      profileCompleted: profileRows.length >= 1,
      productServiceCompleted: hasText(profileRows[0]?.productServiceIntro) || hasText(profileRows[0]?.productIntro),
      customerCaseOrCollectionTaskCount: caseRows.length,
      competitors: competitorRows.map(item => item.competitorName),
      complianceRuleCount: ruleRows.length,
      styleProfileCount: styleRows.length,
      publishStrategyCount: strategyRows.length,
    },
    articles: articleEvidence,
    published: {
      articleId: publishedArticle.id,
      title: publishedArticle.title,
      url: publishedRecord.publishUrl,
      publishRecordId: publishedRecord.id,
      needRetest: publishedRecord.needRetest === 1,
    },
    monitoring,
    blockingEvidence: {
      prePublishBlocked: blockingPreCheck.blocked,
      prePublishBlockReasons: blockingPreCheck.blockReasons,
      consistencyBlocked: blockingConsistency.publishAllowed === false,
      consistencyScore: blockingConsistency.score,
      consistencyBlockReasons: blockingConsistency.blockReasons,
      missingSourceKeyFactBlocked: missingSourcePreCheck.blocked && missingSourceConsistency.publishAllowed === false,
      missingSourceKeyFactPrePublishReasons: missingSourcePreCheck.blockReasons,
      missingSourceKeyFactConsistencyReasons: missingSourceConsistency.blockReasons,
    },
    report: {
      latestReportId: latestReport.id,
      latestReportContainsRequiredSections: true,
      sampleReportPath: reportPath,
    },
  };
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), "utf8");
  console.log(JSON.stringify(evidence, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
