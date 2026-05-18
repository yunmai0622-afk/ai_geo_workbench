import { boolean, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** OAuth/local auth identifier (openId). Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** 浏览器发布插件 API 密钥 */
  extensionApiKey: varchar("extensionApiKey", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const questionTypeEnum = mysqlEnum("questionType", [
  "品牌认知",
  "行业推荐",
  "竞品对比",
  "痛点解决",
  "价格选型",
  "高意向成交",
  "指定问题",
]);

export const questionSourceEnum = mysqlEnum("source", ["ai_generated", "manual", "csv"]);

export const aiPlatformEnum = mysqlEnum("aiPlatform", [
  "ChatGPT",
  "DeepSeek",
  "豆包",
  "Kimi",
  "通义",
  "文心",
  "Perplexity",
  "其他",
]);

export const projectStatusEnum = mysqlEnum("status", [
  "created",
  "questions_ready",
  "responses_imported",
  "analysis_done",
  "score_done",
  "tasks_ready",
  "report_ready",
]);

export const visibilityLevelEnum = mysqlEnum("visibilityLevel", [
  "弱可见",
  "初步可见",
  "良好可见",
  "强势推荐",
]);

export const taskTypeEnum = mysqlEnum("taskType", [
  "官网首页",
  "产品页",
  "竞品对比页",
  "FAQ",
  "客户案例",
  "行业文章",
  "社媒内容",
]);

export const taskPriorityEnum = mysqlEnum("taskPriority", ["P0", "P1", "P2"]);
export const taskStatusEnum = mysqlEnum("status", ["todo", "doing", "done", "retest"]);

export const templateTypeEnum = mysqlEnum("templateType", [
  "官网首页模板",
  "FAQ 模板",
  "竞品对比页模板",
  "客户案例页模板",
  "行业选型文章模板",
]);

export const articleTypeEnum = mysqlEnum("articleType", [
  "官网版 GEO 文章",
  "问答型 GEO 文章",
  "竞品对比型 GEO 文章",
  "行业选型型 GEO 文章",
]);

export const articleStatusEnum = mysqlEnum("status", [
  "待生成",
  "已生成",
  "待质检",
  "质检通过",
  "待审核",
  "审核通过",
  "已发布",
  "待复测",
  "质检未通过",
  "需人工审核",
  "审核未通过",
]);

export const publishChannelEnum = mysqlEnum("publishChannel", [
  "系统内置 GEO 内容页",
  "自有内容站 / 企业官网 GEO 页面",
  "微信公众号",
  "知乎",
  "百家号",
  "头条号",
  "小红书",
  "搜狐号",
  "网易号",
  "CSDN / 掘金",
]);
export const inclusionMonitorStatusEnum = mysqlEnum("inclusionMonitorStatus", ["未检测", "检测中", "已收录", "未收录", "检测失败"]);
export const aiMentionMonitorStatusEnum = mysqlEnum("aiMentionMonitorStatus", ["未检测", "检测中", "已提及", "未提及", "检测失败"]);
export const aiRecommendMonitorStatusEnum = mysqlEnum("aiRecommendMonitorStatus", ["未检测", "检测中", "已推荐", "未推荐", "检测失败"]);

export const geoAssetSourceTypeEnum = mysqlEnum("sourceType", [
  "企业基础资料",
  "产品服务资料",
  "客户案例资料",
  "竞品资料",
  "合规资料",
  "内容风格资料",
  "发布策略资料",
  "通用资料",
]);

export const geoAssetInputModeEnum = mysqlEnum("inputMode", ["文件上传", "文本粘贴", "人工录入"]);
export const geoAssetTrustLevelEnum = mysqlEnum("trustLevel", ["高", "中", "低"]);
export const geoAssetParseStatusEnum = mysqlEnum("parseStatus", ["待解析", "已解析", "解析失败", "人工确认"]);
export const customerCaseTypeEnum = mysqlEnum("caseType", ["真实案例", "待补充案例线索"]);
export const customerCaseVerificationStatusEnum = mysqlEnum("verificationStatus", ["待确认", "已确认", "不可公开", "信息不足"]);
export const publishReviewModeEnum = mysqlEnum("reviewMode", ["全人工审核", "高分自动发布", "全自动发布"]);
export const platformAuthorizationStatusEnum = mysqlEnum("authorizationStatus", ["未配置", "待人工授权", "已授权", "已失效", "无需授权"]);

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  enterpriseName: varchar("enterpriseName", { length: 255 }).notNull(),
  industry: varchar("industry", { length: 255 }).notNull(),
  website: varchar("website", { length: 500 }).notNull(),
  region: varchar("region", { length: 255 }).notNull(),
  productIntro: text("productIntro").notNull(),
  targetCustomers: text("targetCustomers").notNull(),
  coreSellingPoints: text("coreSellingPoints").notNull(),
  competitorNames: json("competitorNames").$type<string[]>().notNull(),
  coreKeywords: json("coreKeywords").$type<string[]>().notNull(),
  status: projectStatusEnum.default("created").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const questions = mysqlTable("questions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  questionText: text("questionText").notNull(),
  questionType: questionTypeEnum.notNull(),
  targetKeyword: varchar("targetKeyword", { length: 255 }),
  intentLevel: varchar("intentLevel", { length: 64 }).default("中").notNull(),
  businessValue: int("businessValue").default(3).notNull(),
  source: questionSourceEnum.default("ai_generated").notNull(),
  enabled: int("enabled").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const aiResponses = mysqlTable("ai_responses", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  questionId: int("questionId"),
  questionText: text("questionText").notNull(),
  aiPlatform: aiPlatformEnum.notNull(),
  rawAnswer: text("rawAnswer").notNull(),
  checkedAt: timestamp("checkedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const analysisResults = mysqlTable("analysis_results", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  aiResponseId: int("aiResponseId").notNull(),
  mentionsEnterprise: int("mentionsEnterprise").default(0).notNull(),
  recommendsEnterprise: int("recommendsEnterprise").default(0).notNull(),
  mentionsCompetitors: int("mentionsCompetitors").default(0).notNull(),
  recommendedCompetitors: json("recommendedCompetitors").$type<string[]>().notNull(),
  enterpriseWins: int("enterpriseWins").default(0).notNull(),
  recommendationReason: text("recommendationReason"),
  notRecommendedReason: text("notRecommendedReason"),
  hasMisconception: int("hasMisconception").default(0).notNull(),
  contentGap: text("contentGap"),
  optimizationSuggestion: text("optimizationSuggestion"),
  rawJson: json("rawJson").$type<Record<string, unknown>>().notNull(),
  manualOverrideJson: json("manual_override_json").$type<Record<string, unknown> | null>(),
  manuallyReviewed: int("manually_reviewed").default(0).notNull(),
  reviewedAt: timestamp("reviewed_at"),
  reviewNote: text("review_note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const geoScores = mysqlTable("geo_scores", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  aiVisibilityScore: int("aiVisibilityScore").default(0).notNull(),
  aiRecommendationScore: int("aiRecommendationScore").default(0).notNull(),
  competitorWinScore: int("competitorWinScore").default(0).notNull(),
  cognitionAccuracyScore: int("cognitionAccuracyScore").default(0).notNull(),
  contentAssetScore: int("contentAssetScore").default(0).notNull(),
  totalScore: int("totalScore").default(0).notNull(),
  visibilityLevel: visibilityLevelEnum.notNull(),
  calculationDetail: json("calculationDetail").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const optimizationTasks = mysqlTable("optimization_tasks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  taskType: taskTypeEnum.notNull(),
  taskName: varchar("taskName", { length: 255 }).notNull(),
  priority: taskPriorityEnum.notNull(),
  generationReason: text("generationReason").notNull(),
  executionSuggestion: text("executionSuggestion").notNull(),
  expectedImpact: text("expectedImpact").notNull(),
  status: taskStatusEnum.default("todo").notNull(),
  publishedUrl: varchar("published_url", { length: 1000 }),
  completedAt: timestamp("completed_at"),
  needRetest: int("need_retest").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const contentTemplates = mysqlTable("content_templates", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  optimizationTaskId: int("optimization_task_id"),
  templateType: templateTypeEnum.notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  markdownContent: text("markdownContent").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  geoScoreId: int("geoScoreId"),
  oneSentenceConclusion: text("oneSentenceConclusion").notNull(),
  totalScore: int("totalScore").default(0).notNull(),
  mentionRecommendationSummary: text("mentionRecommendationSummary").notNull(),
  competitorAnalysis: text("competitorAnalysis").notNull(),
  coreProblems: text("coreProblems").notNull(),
  contentGaps: text("contentGaps").notNull(),
  thirtyDayActions: text("thirtyDayActions").notNull(),
  markdownContent: text("markdownContent").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const geoArticleTopics = mysqlTable("geo_article_topics", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  optimizationTaskId: int("optimizationTaskId"),
  sourceAnalysisIds: json("sourceAnalysisIds").$type<number[]>().notNull(),
  sourceQuestionIds: json("sourceQuestionIds").$type<number[]>().notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  articleType: articleTypeEnum.notNull(),
  contentGap: text("contentGap").notNull(),
  businessReason: text("businessReason").notNull(),
  status: articleStatusEnum.default("待生成").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const geoArticles = mysqlTable("geo_articles", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  topicId: int("topicId").notNull(),
  optimizationTaskId: int("optimizationTaskId"),
  title: varchar("title", { length: 255 }).notNull(),
  articleType: articleTypeEnum.notNull(),
  markdownContent: text("markdownContent").notNull(),
  generationBasis: json("generationBasis").$type<Record<string, unknown>>(),
  citableSnippets: json("citableSnippets").$type<Array<Record<string, string>>>(),
  geoStructure: json("geoStructure").$type<Record<string, unknown>>(),
  thirdPartyMaterials: json("thirdPartyMaterials").$type<Record<string, string>>().notNull(),
  factTraceability: json("factTraceability").$type<Array<Record<string, unknown>>>(),
  consistencyCheck: json("consistencyCheck").$type<Record<string, unknown>>(),
  optimizationVersions: json("optimizationVersions").$type<Array<Record<string, unknown>>>(),
  status: articleStatusEnum.default("待质检").notNull(),
  publicPath: varchar("publicPath", { length: 1000 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const contentPlans = mysqlTable("content_plans", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  planName: varchar("planName", { length: 255 }).notNull(),
  weekStartDate: varchar("weekStartDate", { length: 32 }).notNull(),
  weeklyArticleCount: int("weeklyArticleCount").default(3).notNull(),
  targetPlatforms: json("targetPlatforms").$type<string[]>().notNull(),
  contentTypes: json("contentTypes").$type<string[]>().notNull(),
  linkedOptimizationTaskIds: json("linkedOptimizationTaskIds").$type<number[]>().notNull(),
  status: varchar("status", { length: 64 }).default("已配置").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const contentPlanItems = mysqlTable("content_plan_items", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull(),
  topicId: int("topicId"),
  articleId: int("articleId"),
  targetPlatform: varchar("targetPlatform", { length: 255 }).notNull(),
  contentType: varchar("contentType", { length: 255 }).notNull(),
  status: varchar("status", { length: 64 }).default("待生成").notNull(),
  differentiationAngle: text("differentiationAngle"),
  duplicateRisk: varchar("duplicateRisk", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const geoArticleQualityScores = mysqlTable("geo_article_quality_scores", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  articleId: int("articleId").notNull(),
  problemMatchScore: int("problemMatchScore").default(0).notNull(),
  evidenceScore: int("evidenceScore").default(0).notNull(),
  structureScore: int("structureScore").default(0).notNull(),
  originalityScore: int("originalityScore").default(0).notNull(),
  geoCitableScore: int("geoCitableScore").default(0).notNull(),
  complianceScore: int("complianceScore").default(0).notNull(),
  totalScore: int("totalScore").default(0).notNull(),
  blocked: int("blocked").default(0).notNull(),
  blockReasons: json("blockReasons").$type<string[]>().notNull(),
  reviewSummary: text("reviewSummary").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const geoPublishRecords = mysqlTable("geo_publish_records", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  articleId: int("articleId").notNull(),
  optimizationTaskId: int("optimizationTaskId"),
  publishChannel: publishChannelEnum.notNull(),
  publishTitle: varchar("publishTitle", { length: 500 }),
  publishUrl: varchar("publishUrl", { length: 1000 }).notNull(),
  publishStatus: varchar("publishStatus", { length: 64 }).default("已发布").notNull(),
  qualityScore: int("qualityScore").default(0).notNull(),
  needRetest: int("needRetest").default(1).notNull(),
  notes: text("notes"),
  publishedAt: timestamp("publishedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const geoInclusionMonitoringRecords = mysqlTable("geo_inclusion_monitoring_records", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  articleId: int("articleId").notNull(),
  publishRecordId: int("publishRecordId").notNull(),
  publicUrl: varchar("publicUrl", { length: 1000 }).notNull(),
  inclusionStatus: inclusionMonitorStatusEnum.default("未检测").notNull(),
  aiMentionStatus: aiMentionMonitorStatusEnum.default("未检测").notNull(),
  aiRecommendStatus: aiRecommendMonitorStatusEnum.default("未检测").notNull(),
  lastCheckedAt: timestamp("lastCheckedAt"),
  currentSuggestion: text("currentSuggestion").notNull(),
  optimizationSuggestions: json("optimizationSuggestions").$type<string[]>().notNull(),
  rawJson: json("rawJson").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const enterpriseGeoProfiles = mysqlTable("enterprise_geo_profiles", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  enterpriseName: varchar("enterpriseName", { length: 255 }).notNull(),
  shortName: varchar("shortName", { length: 255 }),
  officialWebsite: varchar("officialWebsite", { length: 500 }),
  industry: varchar("industry", { length: 255 }),
  region: varchar("region", { length: 255 }),
  productServiceIntro: text("productServiceIntro"),
  targetCustomers: text("targetCustomers"),
  coreSellingPoints: text("coreSellingPoints"),
  servicePriceRange: varchar("servicePriceRange", { length: 255 }),
  serviceModel: text("serviceModel"),
  fitCustomers: text("fitCustomers"),
  unfitCustomers: text("unfitCustomers"),
  salesChannels: json("salesChannels").$type<string[]>().notNull(),
  commonQuestions: json("commonQuestions").$type<string[]>().notNull(),
  purchaseDecisionFactors: json("purchaseDecisionFactors").$type<string[]>().notNull(),
  productIntro: text("productIntro"),
  featureNotes: text("featureNotes"),
  serviceProcess: text("serviceProcess"),
  deliveryPlan: text("deliveryPlan"),
  afterSalesService: text("afterSalesService"),
  competitorDifference: text("competitorDifference"),
  priceExplanation: text("priceExplanation"),
  salesTalkTracks: text("salesTalkTracks"),
  commonObjections: text("commonObjections"),
  /** V2 企业档案（可空；由迁移从旧列回填部分字段） */
  brandName: text("brandName"),
  industryTag: text("industryTag"),
  productDesc: text("productDesc"),
  mainChannel: text("mainChannel"),
  targetCustomer: text("targetCustomer"),
  customerPains: json("customerPains").$type<string[] | null>(),
  competitors: json("competitors").$type<string[] | null>(),
  hasCases: boolean("hasCases"),
  oneLiner: text("oneLiner"),
  keyPoints: json("keyPoints").$type<string[] | null>(),
  keywords: json("keywords").$type<string[] | null>(),
  completionScore: int("completionScore").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const geoAssetSources = mysqlTable("geo_asset_sources", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  sourceType: geoAssetSourceTypeEnum.notNull(),
  inputMode: geoAssetInputModeEnum.notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  originalFileName: varchar("originalFileName", { length: 500 }),
  fileKey: varchar("fileKey", { length: 1000 }),
  fileUrl: varchar("fileUrl", { length: 1000 }),
  mimeType: varchar("mimeType", { length: 255 }),
  contentDigest: text("contentDigest"),
  structuredSummary: json("structuredSummary").$type<Record<string, unknown>>().notNull(),
  trustLevel: geoAssetTrustLevelEnum.default("中").notNull(),
  parseStatus: geoAssetParseStatusEnum.default("待解析").notNull(),
  isPublic: int("isPublic").default(0).notNull(),
  canUseForGeneration: int("canUseForGeneration").default(0).notNull(),
  manuallyConfirmed: int("manuallyConfirmed").default(0).notNull(),
  parsedAt: timestamp("parsedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const customerCases = mysqlTable("customer_cases", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  caseType: customerCaseTypeEnum.notNull(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerIndustry: varchar("customerIndustry", { length: 255 }),
  customerBackground: text("customerBackground"),
  originalProblem: text("originalProblem"),
  chosenReason: text("chosenReason"),
  usedProductService: text("usedProductService"),
  executionProcess: text("executionProcess"),
  resultData: text("resultData"),
  customerFeedback: text("customerFeedback"),
  allowPublic: int("allowPublic").default(0).notNull(),
  publicVersion: text("publicVersion"),
  sensitiveNotes: text("sensitiveNotes"),
  sourceAssetIds: json("sourceAssetIds").$type<number[]>().notNull(),
  verificationStatus: customerCaseVerificationStatusEnum.default("待确认").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const competitorProfiles = mysqlTable("competitor_profiles", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  competitorName: varchar("competitorName", { length: 255 }).notNull(),
  website: varchar("website", { length: 500 }),
  positioning: text("positioning"),
  strengths: text("strengths"),
  weaknesses: text("weaknesses"),
  priceInfo: text("priceInfo"),
  contentAssets: text("contentAssets"),
  aiRecommendationSignals: text("aiRecommendationSignals"),
  comparisonNotes: text("comparisonNotes"),
  sourceAssetIds: json("sourceAssetIds").$type<number[]>().notNull(),
  canReference: int("canReference").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const complianceRules = mysqlTable("compliance_rules", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  ruleName: varchar("ruleName", { length: 255 }).notNull(),
  forbiddenClaims: text("forbiddenClaims"),
  forbiddenWords: json("forbiddenWords").$type<string[]>().notNull(),
  requiredDisclaimers: text("requiredDisclaimers"),
  dataUsageRules: text("dataUsageRules"),
  caseUsageRules: text("caseUsageRules"),
  priceUsageRules: text("priceUsageRules"),
  competitorMentionRules: text("competitorMentionRules"),
  reviewRequiredTopics: json("reviewRequiredTopics").$type<string[]>().notNull(),
  enabled: int("enabled").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const contentStyleProfiles = mysqlTable("content_style_profiles", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  profileName: varchar("profileName", { length: 255 }).notNull(),
  tone: varchar("tone", { length: 255 }).notNull(),
  writingStyle: text("writingStyle"),
  terminology: json("terminology").$type<string[]>().notNull(),
  forbiddenTone: text("forbiddenTone"),
  exampleTitles: json("exampleTitles").$type<string[]>().notNull(),
  exampleParagraphs: json("exampleParagraphs").$type<string[]>().notNull(),
  targetReader: text("targetReader"),
  preferredLength: varchar("preferredLength", { length: 255 }),
  ctaStyle: text("ctaStyle"),
  enabled: int("enabled").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const publishStrategies = mysqlTable("publish_strategies", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  strategyName: varchar("strategyName", { length: 255 }).notNull(),
  reviewMode: publishReviewModeEnum.default("全人工审核").notNull(),
  dailyLimit: int("dailyLimit"),
  minQualityScore: int("minQualityScore").default(80).notNull(),
  preferredPlatforms: json("preferredPlatforms").$type<string[]>().notNull(),
  bannedPlatforms: json("bannedPlatforms").$type<string[]>().notNull(),
  platformNotes: text("platformNotes"),
  enabled: int("enabled").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const publishTasks = mysqlTable("publish_tasks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  articleId: int("articleId").notNull(),
  platform: varchar("platform", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  articleTitle: text("articleTitle").notNull(),
  articleContent: text("articleContent").notNull(),
  resultUrl: varchar("resultUrl", { length: 500 }),
  errorMessage: text("errorMessage"),
  apiKey: varchar("apiKey", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const platformAuthorizationConfigs = mysqlTable("platform_authorization_configs", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  platformName: varchar("platformName", { length: 255 }).notNull(),
  accountAlias: varchar("accountAlias", { length: 255 }),
  authorizationStatus: platformAuthorizationStatusEnum.default("未配置").notNull(),
  credentialStorageMode: varchar("credentialStorageMode", { length: 255 }).default("不保存明文凭证").notNull(),
  secureCredentialRef: varchar("secureCredentialRef", { length: 500 }),
  authorizationNotes: text("authorizationNotes"),
  authorizedAt: timestamp("authorizedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type InsertQuestion = typeof questions.$inferInsert;
export type AiResponse = typeof aiResponses.$inferSelect;
export type InsertAiResponse = typeof aiResponses.$inferInsert;
export type AnalysisResult = typeof analysisResults.$inferSelect;
export type InsertAnalysisResult = typeof analysisResults.$inferInsert;
export type GeoScore = typeof geoScores.$inferSelect;
export type InsertGeoScore = typeof geoScores.$inferInsert;
export type OptimizationTask = typeof optimizationTasks.$inferSelect;
export type InsertOptimizationTask = typeof optimizationTasks.$inferInsert;
export type ContentTemplate = typeof contentTemplates.$inferSelect;
export type InsertContentTemplate = typeof contentTemplates.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;
export type GeoArticleTopic = typeof geoArticleTopics.$inferSelect;
export type InsertGeoArticleTopic = typeof geoArticleTopics.$inferInsert;
export type GeoArticle = typeof geoArticles.$inferSelect;
export type InsertGeoArticle = typeof geoArticles.$inferInsert;
export type ContentPlan = typeof contentPlans.$inferSelect;
export type InsertContentPlan = typeof contentPlans.$inferInsert;
export type ContentPlanItem = typeof contentPlanItems.$inferSelect;
export type InsertContentPlanItem = typeof contentPlanItems.$inferInsert;
export type GeoArticleQualityScore = typeof geoArticleQualityScores.$inferSelect;
export type InsertGeoArticleQualityScore = typeof geoArticleQualityScores.$inferInsert;
export type GeoPublishRecord = typeof geoPublishRecords.$inferSelect;
export type InsertGeoPublishRecord = typeof geoPublishRecords.$inferInsert;
export type EnterpriseGeoProfile = typeof enterpriseGeoProfiles.$inferSelect;
export type InsertEnterpriseGeoProfile = typeof enterpriseGeoProfiles.$inferInsert;
export type GeoAssetSource = typeof geoAssetSources.$inferSelect;
export type InsertGeoAssetSource = typeof geoAssetSources.$inferInsert;
export type CustomerCase = typeof customerCases.$inferSelect;
export type InsertCustomerCase = typeof customerCases.$inferInsert;
export type CompetitorProfile = typeof competitorProfiles.$inferSelect;
export type InsertCompetitorProfile = typeof competitorProfiles.$inferInsert;
export type ComplianceRule = typeof complianceRules.$inferSelect;
export type InsertComplianceRule = typeof complianceRules.$inferInsert;
export type ContentStyleProfile = typeof contentStyleProfiles.$inferSelect;
export type InsertContentStyleProfile = typeof contentStyleProfiles.$inferInsert;
export type PublishStrategy = typeof publishStrategies.$inferSelect;
export type InsertPublishStrategy = typeof publishStrategies.$inferInsert;
export type PlatformAuthorizationConfig = typeof platformAuthorizationConfigs.$inferSelect;
export type InsertPlatformAuthorizationConfig = typeof platformAuthorizationConfigs.$inferInsert;
export type PublishTask = typeof publishTasks.$inferSelect;
export type InsertPublishTask = typeof publishTasks.$inferInsert;
