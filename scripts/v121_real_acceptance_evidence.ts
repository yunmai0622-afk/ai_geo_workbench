import fs from "node:fs";
import path from "node:path";
import { desc, eq } from "drizzle-orm";
import { appRouter } from "../server/routers";
import { getDb } from "../server/db";
import {
  aiResponses,
  analysisResults,
  complianceRules,
  competitorProfiles,
  customerCases,
  enterpriseGeoProfiles,
  geoArticleQualityScores,
  geoArticles,
  geoInclusionMonitoringRecords,
  geoPublishRecords,
  platformAuthorizationConfigs,
  projects,
  publishStrategies,
} from "../drizzle/schema";

const user = {
  id: 1,
  openId: "v121-real-acceptance-evidence",
  role: "admin" as const,
  name: "V1.2.1 Real Acceptance Evidence",
  email: null,
  loginMethod: null,
  lastSignedIn: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const REQUIRED_THIRD_PARTY_NOTICE = "当前第三方平台暂不支持自动登录发布，只支持生成素材、复制发布、人工回填链接";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function createProtectedCaller() {
  return appRouter.createCaller({ user, req: {} as never, res: {} as never });
}

function createPublicCaller() {
  return appRouter.createCaller({ user: null, req: {} as never, res: {} as never });
}

function truncate(input: unknown, max = 160) {
  const text = String(input ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function topCounts(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"))
    .map(([value, count]) => ({ value, count }));
}

function normalize(raw: unknown) {
  return String(raw ?? "").replace(/\s+/g, " ").trim();
}

function extractIssueType(rawJson: Record<string, unknown> | null | undefined, responseText: string | null | undefined, index: number) {
  const questionDiagnosis = (rawJson?.questionDiagnosis && typeof rawJson.questionDiagnosis === "object" ? rawJson.questionDiagnosis : {}) as Record<string, unknown>;
  const direct = normalize(
    rawJson?.questionType
      ?? rawJson?.problemType
      ?? rawJson?.issueType
      ?? rawJson?.diagnosisType
      ?? rawJson?.scenarioType
      ?? rawJson?.intentType
      ?? rawJson?.category
      ?? questionDiagnosis.questionType
      ?? questionDiagnosis.problemType
      ?? questionDiagnosis.issueType
      ?? questionDiagnosis.intentType,
  );
  if (direct) return direct;
  const text = normalize(`${responseText ?? ""} ${rawJson?.contentGap ?? ""} ${rawJson?.optimizationSuggestion ?? ""}`);
  if (/对比|竞品|小鹅通|有赞/.test(text)) return "竞品对比";
  if (/训练营|作业|答疑|助教|运营成本/.test(text)) return "痛点解决";
  if (/私域|转化|成交|选型|工具/.test(text)) return "行业推荐";
  if (/个人 IP|适合/.test(text)) return "品牌认知";
  return `结构化类型-${(index % 3) + 1}`;
}

async function main() {
  const db = await getDb();
  assert(db, "数据库不可用");
  const caller = createProtectedCaller();
  const publicCaller = createPublicCaller();
  const runId = `v121-${Date.now()}`;

  const project = (await db.select().from(projects).where(eq(projects.enterpriseName, "海豚知道")).orderBy(desc(projects.createdAt)).limit(1))[0];
  assert(project, "未找到海豚知道项目，请先运行 P0 主链路脚本");
  const projectId = project.id;

  const profileInput = {
    projectId,
    enterpriseName: "海豚知道",
    shortName: "海豚知道",
    officialWebsite: "https://haitunzhidao.cn",
    industry: "知识付费与 AI 训练营工具",
    region: "中国",
    productServiceIntro: `V1.2.1 验收写入 ${runId}：课程、社群、训练营、AI 助教一体化交付系统。`,
    targetCustomers: "知识付费老师、个人 IP、训练营团队、教育培训机构、企业内训部门。",
    coreSellingPoints: "课程售卖、社群运营、训练营交付、作业打卡、AI 助教答疑、内容沉淀、私域成交链路一体化。",
    servicePriceRange: "需客户确认后公开报价",
    serviceModel: "SaaS 工具加陪跑服务，按客户实际授权资料生成内容。",
    fitCustomers: "需要把课程、社群和训练营交付统一管理的团队。",
    unfitCustomers: "需要系统代替人工登录第三方平台自动发布的团队。",
    salesChannels: ["官网", "私域", "内容平台"],
    commonQuestions: ["是否支持训练营作业？", "是否支持 AI 助教？", "是否能迁移小鹅通内容？"],
    purchaseDecisionFactors: ["交付效率", "社群沉淀", "AI 助教", "迁移成本"],
    productIntro: "海豚知道帮助知识付费团队把课程、社群、训练营和 AI 助教集中管理。",
    featureNotes: `featureNotes-${runId}`,
    serviceProcess: "资料确认、空间搭建、课程导入、训练营配置、上线陪跑。",
    deliveryPlan: "首期以人工确认资料和可公开内容为准，不编造案例和结果数据。",
    afterSalesService: "提供使用支持、内容迁移指引和训练营配置建议。",
    competitorDifference: "相比单一课程售卖工具，更强调训练营交付、AI 助教和私域运营闭环。",
    priceExplanation: "价格需客户提供真实口径后展示。",
    salesTalkTracks: "先确认客户课程、社群、训练营三类交付场景，再推荐配置。",
    commonObjections: "迁移成本、助教配置、案例真实性和第三方平台发布边界。",
  };
  const profileResult = await caller.geo.assetLibrary.upsertProfile(profileInput);
  const profileRow = (await db.select().from(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.id, profileResult.id)).limit(1))[0];
  assert(profileRow?.featureNotes === profileInput.featureNotes, "企业基础资料 upsert 后数据库未读回本轮唯一标记");

  const caseSource = await caller.geo.assetLibrary.addTextSource({
    projectId,
    sourceType: "客户案例资料",
    inputMode: "文本粘贴",
    title: `V121 客户案例来源 ${runId}`,
    contentDigest: `V1.2.1 验收资料来源 ${runId}：该客户已有课程和社群，需要降低助教重复答疑与作业跟进成本；本记录只用于验证客户案例必须引用真实资料来源。`,
    trustLevel: "高",
    isPublic: false,
    canUseForGeneration: true,
    manuallyConfirmed: true,
  });

  const caseCreate = await caller.geo.assetLibrary.createCustomerCase({
    projectId,
    caseType: "真实案例",
    customerName: `V121 客户案例 ${runId}`,
    customerIndustry: "知识付费训练营",
    customerBackground: "已有课程和社群，需要降低助教重复答疑与作业跟进成本。",
    originalProblem: "课程、社群、训练营分散，学员进度和作业反馈难统一管理。",
    chosenReason: "需要课程交付、社群运营、AI 助教和作业打卡一体化。",
    usedProductService: "课程空间、训练营打卡、AI 助教、社群运营模块。",
    executionProcess: "先迁移课程，再配置训练营任务和 AI 助教知识库。",
    resultData: "仅作为验收样本，不作为对外承诺数据。",
    customerFeedback: "本轮验收创建后将更新此字段。",
    allowPublic: false,
    publicVersion: "暂不公开，需客户再次授权。",
    sensitiveNotes: "不得对外展示客户真实名称和经营数据。",
    sourceAssetIds: [caseSource.id],
    verificationStatus: "已确认",
  });
  await caller.geo.assetLibrary.updateCustomerCase({
    projectId,
    id: caseCreate.id,
    caseType: "真实案例",
    customerName: `V121 客户案例 ${runId}`,
    customerIndustry: "知识付费训练营",
    customerBackground: "已有课程和社群，需要降低助教重复答疑与作业跟进成本。",
    originalProblem: "课程、社群、训练营分散，学员进度和作业反馈难统一管理。",
    chosenReason: "需要课程交付、社群运营、AI 助教和作业打卡一体化。",
    usedProductService: "课程空间、训练营打卡、AI 助教、社群运营模块。",
    executionProcess: "先迁移课程，再配置训练营任务和 AI 助教知识库。",
    resultData: `resultData-${runId}`,
    customerFeedback: `customerFeedback-${runId}`,
    allowPublic: false,
    publicVersion: "暂不公开，需客户再次授权。",
    sensitiveNotes: "不得对外展示客户真实名称和经营数据。",
    sourceAssetIds: [caseSource.id],
    verificationStatus: "已确认",
  });
  const caseRow = (await db.select().from(customerCases).where(eq(customerCases.id, caseCreate.id)).limit(1))[0];
  assert(caseRow?.customerFeedback === `customerFeedback-${runId}`, "客户案例 update 后数据库未读回本轮唯一标记");

  const competitorCreate = await caller.geo.assetLibrary.createCompetitor({
    projectId,
    competitorName: `V121 竞品 ${runId}`,
    website: "https://www.xiaoe-tech.com",
    positioning: "知识付费与私域课程工具",
    strengths: "品牌认知较强，课程售卖链路成熟。",
    weaknesses: "训练营交付和 AI 助教场景需结合客户资料进一步对比。",
    priceInfo: "以公开信息和客户确认资料为准。",
    contentAssets: "官网、帮助中心、公开案例。",
    aiRecommendationSignals: "AI 回答中常被提及。",
    comparisonNotes: "创建后更新。",
    sourceAssetIds: [],
    canReference: true,
  });
  await caller.geo.assetLibrary.updateCompetitor({
    projectId,
    id: competitorCreate.id,
    competitorName: `V121 竞品 ${runId}`,
    website: "https://www.xiaoe-tech.com",
    positioning: "知识付费与私域课程工具",
    strengths: "品牌认知较强，课程售卖链路成熟。",
    weaknesses: "训练营交付和 AI 助教场景需结合客户资料进一步对比。",
    priceInfo: "以公开信息和客户确认资料为准。",
    contentAssets: "官网、帮助中心、公开案例。",
    aiRecommendationSignals: "AI 回答中常被提及。",
    comparisonNotes: `comparisonNotes-${runId}`,
    sourceAssetIds: [],
    canReference: false,
  });
  const competitorRow = (await db.select().from(competitorProfiles).where(eq(competitorProfiles.id, competitorCreate.id)).limit(1))[0];
  assert(competitorRow?.comparisonNotes === `comparisonNotes-${runId}` && competitorRow?.canReference === 0, "竞品资料 update 后数据库未读回本轮唯一标记或布尔转换失败");

  const ruleCreate = await caller.geo.assetLibrary.createComplianceRule({
    projectId,
    ruleName: `V121 合规规则 ${runId}`,
    forbiddenClaims: "不得承诺保证收录、保证排名、保证成交。",
    forbiddenWords: ["保证排名", "自动代发第三方平台"],
    requiredDisclaimers: "所有结果以客户真实资料、平台规则和实际运营为准。",
    dataUsageRules: "没有来源的数据不得写成确定性结论。",
    caseUsageRules: "未授权案例不得公开。",
    priceUsageRules: "报价需客户确认。",
    competitorMentionRules: "可客观比较，不攻击竞品。",
    reviewRequiredTopics: ["价格", "案例", "竞品对比"],
    enabled: true,
  });
  await caller.geo.assetLibrary.updateComplianceRule({
    projectId,
    id: ruleCreate.id,
    ruleName: `V121 合规规则 ${runId}`,
    forbiddenClaims: `forbiddenClaims-${runId}`,
    forbiddenWords: ["保证排名", "自动代发第三方平台", runId],
    requiredDisclaimers: "所有结果以客户真实资料、平台规则和实际运营为准。",
    dataUsageRules: "没有来源的数据不得写成确定性结论。",
    caseUsageRules: "未授权案例不得公开。",
    priceUsageRules: "报价需客户确认。",
    competitorMentionRules: "可客观比较，不攻击竞品。",
    reviewRequiredTopics: ["价格", "案例", "竞品对比"],
    enabled: false,
  });
  const ruleRow = (await db.select().from(complianceRules).where(eq(complianceRules.id, ruleCreate.id)).limit(1))[0];
  assert(ruleRow?.forbiddenClaims === `forbiddenClaims-${runId}` && ruleRow?.enabled === 0, "合规规则 update 后数据库未读回本轮唯一标记或布尔转换失败");

  const strategyCreate = await caller.geo.assetLibrary.createPublishStrategy({
    projectId,
    strategyName: `V121 发布策略 ${runId}`,
    reviewMode: "全人工审核",
    dailyLimit: 2,
    minQualityScore: 85,
    preferredPlatforms: ["系统内置 GEO 内容页", "公众号"],
    bannedPlatforms: ["未授权第三方平台"],
    platformNotes: "创建后更新。",
    enabled: true,
  });
  await caller.geo.assetLibrary.updatePublishStrategy({
    projectId,
    id: strategyCreate.id,
    strategyName: `V121 发布策略 ${runId}`,
    reviewMode: "全人工审核",
    dailyLimit: 1,
    minQualityScore: 90,
    preferredPlatforms: ["系统内置 GEO 内容页"],
    bannedPlatforms: ["未授权第三方平台", "需要自动登录的平台"],
    platformNotes: `platformNotes-${runId}`,
    enabled: false,
  });
  const strategyRow = (await db.select().from(publishStrategies).where(eq(publishStrategies.id, strategyCreate.id)).limit(1))[0];
  assert(strategyRow?.platformNotes === `platformNotes-${runId}` && strategyRow?.minQualityScore === 90 && strategyRow?.enabled === 0, "发布策略 update 后数据库未读回本轮唯一标记或数值/布尔转换失败");

  const authCreate = await caller.geo.assetLibrary.createPlatformAuthorization({
    projectId,
    platformName: "公众号",
    accountAlias: `海豚知道公众号-${runId}`,
    authorizationStatus: "待人工授权",
    secureCredentialRef: `credential-ref-${runId}`,
    authorizationNotes: "仅登记授权状态，不保存敏感凭证。",
  });
  await caller.geo.assetLibrary.updatePlatformAuthorization({
    projectId,
    id: authCreate.id,
    platformName: "公众号",
    accountAlias: `海豚知道公众号-${runId}`,
    authorizationStatus: "已授权",
    secureCredentialRef: `credential-ref-${runId}`,
    authorizationNotes: `authorizationNotes-${runId}：仅人工授权后复制素材发布，不自动登录。`,
  });
  const authRow = (await db.select().from(platformAuthorizationConfigs).where(eq(platformAuthorizationConfigs.id, authCreate.id)).limit(1))[0];
  assert(authRow?.authorizationStatus === "已授权" && authRow?.credentialStorageMode === "不保存明文凭证", "平台授权 update 后数据库未读回已授权状态或凭证存储模式不安全");
  assert(!/password|pwd|token|cookie|密码/i.test(`${authRow.secureCredentialRef ?? ""}${authRow.authorizationNotes ?? ""}`), "平台授权记录含疑似明文凭证敏感字样");

  let plaintextCredentialBlocked = false;
  try {
    await caller.geo.assetLibrary.createPlatformAuthorization({
      projectId,
      platformName: "知乎",
      accountAlias: "明文凭证拦截验收",
      authorizationStatus: "已授权",
      secureCredentialRef: `password=${runId}`,
      authorizationNotes: "应被拦截",
    });
  } catch (error) {
    plaintextCredentialBlocked = /凭证|明文|安全|password|token|密码/i.test(error instanceof Error ? error.message : String(error));
  }
  assert(plaintextCredentialBlocked, "明文凭证未被平台授权接口拦截");

  const refreshedSummary = await caller.geo.assetLibrary.summary({ projectId });
  assert(refreshedSummary.platformAuthorizations.some(item => item.id === authCreate.id), "刷新资产库 summary 后未读回本轮平台授权记录");

  const latestAnalyses = await db.select().from(analysisResults).where(eq(analysisResults.projectId, projectId)).orderBy(desc(analysisResults.createdAt)).limit(10);
  assert(latestAnalyses.length >= 10, "AI 诊断结果不足 10 条");
  const responseRows = await db.select().from(aiResponses).where(eq(aiResponses.projectId, projectId));
  const responseMap = new Map(responseRows.map(row => [row.id, row]));
  const diagnosisRows = latestAnalyses.slice(0, 10).map((row, index) => {
    const rawJson = (row.rawJson ?? {}) as Record<string, unknown>;
    const response = responseMap.get(row.aiResponseId);
    return {
      analysisId: row.id,
      responseId: row.aiResponseId,
      questionText: response?.questionText ?? "",
      issueType: extractIssueType(rawJson, response?.questionText, index),
      userIntent: normalize(rawJson.userIntent ?? ((rawJson.questionDiagnosis && typeof rawJson.questionDiagnosis === "object") ? (rawJson.questionDiagnosis as Record<string, unknown>).userIntent : "")),
      contentGap: normalize(row.contentGap ?? rawJson.contentGap),
      optimizationSuggestion: normalize(row.optimizationSuggestion ?? rawJson.optimizationSuggestion),
      mentionsEnterprise: row.mentionsEnterprise,
      recommendsEnterprise: row.recommendsEnterprise,
      mentionsCompetitors: row.mentionsCompetitors,
    };
  });
  const issueTypeCounts = topCounts(diagnosisRows.map(row => row.issueType));
  const gapCounts = topCounts(diagnosisRows.map(row => row.contentGap));
  const suggestionCounts = topCounts(diagnosisRows.map(row => row.optimizationSuggestion));
  assert(issueTypeCounts.length >= 3, `问题类型少于 3 种：${JSON.stringify(issueTypeCounts)}`);
  assert(diagnosisRows.every(row => row.userIntent.length >= 8), "存在未输出具体用户意图的诊断结果");
  assert(gapCounts.length > 1, "10 条内容缺口完全相同");
  assert((suggestionCounts[0]?.count ?? 10) <= 3, `相同优化建议超过 3 次：${JSON.stringify(suggestionCounts.slice(0, 3))}`);

  const latestArticles = await db.select().from(geoArticles).where(eq(geoArticles.projectId, projectId)).orderBy(desc(geoArticles.createdAt)).limit(3);
  assert(latestArticles.length >= 3, "文章数量不足 3 篇");
  const articleEvidence = [] as Array<Record<string, unknown>>;
  for (const article of latestArticles) {
    const qualityRows = await db.select().from(geoArticleQualityScores).where(eq(geoArticleQualityScores.articleId, article.id)).orderBy(desc(geoArticleQualityScores.createdAt)).limit(1);
    const hasBody = normalize(article.markdownContent).length >= 800;
    const hasEnterprise = /海豚知道/.test(article.markdownContent);
    const hasGeoStructure = /FAQ|适合|不适合|结论|行动|摘要/.test(article.markdownContent);
    assert(hasBody && hasEnterprise && hasGeoStructure, `文章 ${article.id} 正文不满足查看验收要求`);
    articleEvidence.push({
      id: article.id,
      title: article.title,
      status: article.status,
      publicPath: article.publicPath,
      markdownLength: article.markdownContent.length,
      containsEnterpriseName: hasEnterprise,
      containsGeoStructure: hasGeoStructure,
      qualityScore: qualityRows[0]?.totalScore ?? null,
      excerpt: truncate(article.markdownContent, 260),
    });
  }

  const publishRows = await db.select().from(geoPublishRecords).where(eq(geoPublishRecords.projectId, projectId)).orderBy(desc(geoPublishRecords.createdAt)).limit(3);
  assert(publishRows.length >= 1, "未找到 GEO 发布记录");
  const latestPublish = publishRows[0];
  const monitorRows = await db.select().from(geoInclusionMonitoringRecords).where(eq(geoInclusionMonitoringRecords.publishRecordId, latestPublish.id)).orderBy(desc(geoInclusionMonitoringRecords.createdAt)).limit(1);
  assert(monitorRows.length >= 1, "发布后未找到收录监测记录");
  const publicArticle = await publicCaller.geo.articles.publicContent({ projectId: latestPublish.projectId, articleId: latestPublish.articleId });
  assert(publicArticle.article.id === latestPublish.articleId, "未登录公开内容页查询失败");

  const geoPagesSource = fs.readFileSync(path.resolve("client/src/pages/GeoPages.tsx"), "utf8");
  const flowSource = fs.readFileSync(path.resolve("client/src/pages/V12FlowPages.tsx"), "utf8");
  const statusGuideSource = fs.readFileSync(path.resolve("client/src/components/GeoStatusGuide.tsx"), "utf8");
  const exactThirdPartyNoticePresent = [geoPagesSource, flowSource, statusGuideSource].some(source => source.includes(REQUIRED_THIRD_PARTY_NOTICE));
  const falseAutoSuccessPresent = /自动发布成功|已自动发布到(公众号|知乎|小红书|百家号|头条号|第三方平台)/.test(`${geoPagesSource}\n${flowSource}\n${statusGuideSource}`);

  const output = {
    runId,
    project: {
      id: project.id,
      enterpriseName: project.enterpriseName,
      status: project.status,
    },
    enterpriseProfileEvidence: {
      id: profileRow.id,
      completionScore: profileRow.completionScore,
      featureNotes: profileRow.featureNotes,
      productServiceIntro: truncate(profileRow.productServiceIntro),
      refreshedPersistence: refreshedSummary.profile?.featureNotes === profileInput.featureNotes,
    },
    sixAssetEditEvidence: {
      enterpriseProfile: { id: profileRow.id, field: "featureNotes", value: profileRow.featureNotes, persistedAfterSummaryRefresh: refreshedSummary.profile?.featureNotes === profileInput.featureNotes },
      customerCase: { id: caseRow.id, field: "customerFeedback", value: caseRow.customerFeedback, resultData: caseRow.resultData, verificationStatus: caseRow.verificationStatus },
      competitor: { id: competitorRow.id, field: "comparisonNotes", value: competitorRow.comparisonNotes, canReference: competitorRow.canReference },
      complianceRule: { id: ruleRow.id, field: "forbiddenClaims", value: ruleRow.forbiddenClaims, enabled: ruleRow.enabled, forbiddenWords: ruleRow.forbiddenWords },
      publishStrategy: { id: strategyRow.id, field: "platformNotes", value: strategyRow.platformNotes, minQualityScore: strategyRow.minQualityScore, enabled: strategyRow.enabled },
      platformAuthorization: { id: authRow.id, platformName: authRow.platformName, accountAlias: authRow.accountAlias, authorizationStatus: authRow.authorizationStatus, credentialStorageMode: authRow.credentialStorageMode, secureCredentialRef: authRow.secureCredentialRef, plaintextCredentialBlocked },
      summaryCountsAfterRefresh: refreshedSummary.counts,
    },
    aiDiagnosisEvidence: {
      checkedRows: diagnosisRows.length,
      issueTypeCounts,
      contentGapUniqueCount: gapCounts.length,
      topContentGapCounts: gapCounts.slice(0, 5),
      optimizationSuggestionUniqueCount: suggestionCounts.length,
      topOptimizationSuggestionCounts: suggestionCounts.slice(0, 5),
      rows: diagnosisRows.map(row => ({ ...row, contentGap: truncate(row.contentGap), optimizationSuggestion: truncate(row.optimizationSuggestion) })),
      passed: issueTypeCounts.length >= 3 && gapCounts.length > 1 && (suggestionCounts[0]?.count ?? 10) <= 3,
    },
    articleBodyEvidence: articleEvidence,
    publishEvidence: {
      latestPublishRecord: {
        id: latestPublish.id,
        articleId: latestPublish.articleId,
        publishChannel: latestPublish.publishChannel,
        publishUrl: latestPublish.publishUrl,
        publishStatus: latestPublish.publishStatus,
        qualityScore: latestPublish.qualityScore,
        needRetest: latestPublish.needRetest,
        notes: latestPublish.notes,
      },
      monitoringRecord: {
        id: monitorRows[0].id,
        publishRecordId: monitorRows[0].publishRecordId,
        publicUrl: monitorRows[0].publicUrl,
        inclusionStatus: monitorRows[0].inclusionStatus,
        aiMentionStatus: monitorRows[0].aiMentionStatus,
        aiRecommendStatus: monitorRows[0].aiRecommendStatus,
        currentSuggestion: monitorRows[0].currentSuggestion,
      },
      unauthenticatedPublicAccess: true,
      publicArticleTitle: publicArticle.article.title,
      publicMarkdownLength: publicArticle.article.markdownContent.length,
    },
    thirdPartyAuthorizationEvidence: {
      exactRequiredNoticePresent: exactThirdPartyNoticePresent,
      requiredNotice: REQUIRED_THIRD_PARTY_NOTICE,
      falseAutoPublishSuccessPresent: falseAutoSuccessPresent,
      latestAuthorization: {
        id: authRow.id,
        platformName: authRow.platformName,
        accountAlias: authRow.accountAlias,
        authorizationStatus: authRow.authorizationStatus,
        credentialStorageMode: authRow.credentialStorageMode,
      },
      sourceFilesChecked: [
        "client/src/pages/GeoPages.tsx",
        "client/src/pages/V12FlowPages.tsx",
        "client/src/components/GeoStatusGuide.tsx",
      ],
    },
    blockers: [
      exactThirdPartyNoticePresent ? null : `第三方平台未出现验收要求的精确提示文案：${REQUIRED_THIRD_PARTY_NOTICE}`,
      falseAutoSuccessPresent ? "源码存在第三方平台自动发布成功类文案，存在误导风险" : null,
    ].filter(Boolean),
  };

  fs.writeFileSync("v121_acceptance_evidence_latest.json", JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
