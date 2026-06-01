import { boolean, mediumtext, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

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
  /** scrypt 哈希，仅邮箱注册用户使用 */
  passwordHash: varchar("passwordHash", { length: 255 }),
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
  "scenario_need",
  "long_tail_conversion",
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
  /** 项目归属用户（P0 租户隔离）；FK → users.id */
  ownerUserId: int("ownerUserId").notNull(),
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
  /** 归档时间；NULL 表示活跃项目 */
  archivedAt: timestamp("archivedAt"),
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

export const questionTemplates = mysqlTable(
  "question_templates",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull(),
    platform: varchar("platform", { length: 64 }).notNull(),
    questionType: varchar("questionType", { length: 64 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    promptTemplate: text("promptTemplate").notNull(),
    description: text("description"),
    isBuiltin: int("isBuiltin").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("question_templates_slug_unique").on(table.slug)],
);

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

/** 交付报告匿名只读分享（绑定 projectId，非报告快照） */
export const deliveryReportShareTokens = mysqlTable("delivery_report_share_tokens", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  projectId: int("projectId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  isEnabled: boolean("isEnabled").default(true).notNull(),
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
  lifecycleStatus: varchar("lifecycleStatus", { length: 32 }).default("generated"),
  lifecycleEvents: json("lifecycleEvents").$type<
    Array<{
      status: string;
      at: string;
      source: string;
      message?: string;
      taskId?: number;
      platform?: string;
      publishTaskStatus?: string;
    }>
  >(),
  publicPath: varchar("publicPath", { length: 1000 }),
  coverTemplate: varchar("coverTemplate", { length: 32 }),
  coverImageUrl: varchar("coverImageUrl", { length: 2000 }),
  coverBase64: mediumtext("coverBase64"),
  geoQualityScore: int("geoQualityScore"),
  geoQualityDetail: json("geoQualityDetail").$type<Record<string, unknown>>(),
  geoQualityReviewedAt: timestamp("geoQualityReviewedAt"),
  geoQualityModel: varchar("geoQualityModel", { length: 50 }),
  geoQualityRecommendation: varchar("geoQualityRecommendation", { length: 20 }),
  geoQualityStale: int("geoQualityStale").default(0),
  contentStrategyType: varchar("contentStrategyType", { length: 50 }),
  publishIdentity: varchar("publishIdentity", { length: 50 }),
  recommendedAccountGroup: varchar("recommendedAccountGroup", { length: 50 }),
  contentEditedAt: timestamp("contentEditedAt"),
  contentTags: json("contentTags").$type<string[]>(),
  contentReviewStatus: varchar("contentReviewStatus", { length: 32 }).default("待审核").notNull(),
  publishedAt: timestamp("publishedAt"),
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
  inclusionMonitorStatus: inclusionMonitorStatusEnum.default("未检测").notNull(),
  aiMentionMonitorStatus: aiMentionMonitorStatusEnum.default("未检测").notNull(),
  aiRecommendMonitorStatus: aiRecommendMonitorStatusEnum.default("未检测").notNull(),
  lastCheckedAt: timestamp("lastCheckedAt"),
  currentSuggestion: text("currentSuggestion").notNull(),
  optimizationSuggestions: json("optimizationSuggestions").$type<string[]>().notNull(),
  rawJson: json("rawJson").$type<Record<string, unknown>>().notNull(),
  aiTestResults: json("aiTestResults").$type<
    Array<{
      engine: string;
      question: string;
      answer: string;
      mentionsBrand: boolean;
      recommendsBrand: boolean;
      recommendationRank: number | null;
      testedAt: string;
      engineName?: string;
      rawAnswer?: string;
      mentionedBrand?: boolean;
      recommendedBrand?: boolean;
      brandRank?: number | null;
      citedUrls?: string[];
      sentiment?: "positive" | "neutral" | "negative";
      competitorMentions?: Array<{
        name: string;
        mentioned: boolean;
        rank?: number | null;
        context?: string;
      }>;
      evidenceSummary?: string;
      parseStatus?: "success" | "partial" | "failed";
      parseError?: string | null;
      testStage?: "before_publish" | "after_publish" | "manual_check";
    }>
  >(),
  lastAiTestedAt: timestamp("lastAiTestedAt"),
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
  /** T0/AI 实测完成后汇总的竞品提及次数（与 ai_test_runs.competitorNames 聚合同步） */
  aiMentionCount: int("aiMentionCount").default(0).notNull(),
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
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  projectName: varchar("projectName", { length: 255 }),
  platformAccountId: int("platformAccountId"),
  expectedAccountName: varchar("expectedAccountName", { length: 255 }),
  detectedAccountName: varchar("detectedAccountName", { length: 255 }),
  accountVerificationStatus: varchar("accountVerificationStatus", { length: 32 }).default("pending"),
  articleTitle: text("articleTitle").notNull(),
  articleContent: text("articleContent").notNull(),
  coverImageUrl: text("coverImageUrl"),
  resultUrl: varchar("resultUrl", { length: 500 }),
  draftUrl: varchar("draftUrl", { length: 500 }),
  publishedUrl: varchar("publishedUrl", { length: 500 }),
  localAgentId: varchar("localAgentId", { length: 100 }),
  localProfileId: varchar("localProfileId", { length: 100 }),
  agentPickedAt: timestamp("agentPickedAt"),
  agentFinishedAt: timestamp("agentFinishedAt"),
  agentErrorType: varchar("agentErrorType", { length: 50 }),
  agentErrorMessage: text("agentErrorMessage"),
  agentLog: json("agentLog").$type<string[]>(),
  retryCount: int("retryCount").default(0).notNull(),
  retryLog: json("retryLog").$type<
    Array<{ at: string; reason: string; previousError?: string | null }>
  >(),
  errorMessage: text("errorMessage"),
  apiKey: varchar("apiKey", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const geoReviewQueue = mysqlTable("geo_review_queue", {
  id: int("id").autoincrement().primaryKey(),
  articleId: int("articleId").notNull(),
  projectId: int("projectId").notNull(),
  triggerStatus: varchar("triggerStatus", { length: 32 }).notNull(),
  reviewType: varchar("reviewType", { length: 32 }).notNull(),
  scheduledAt: timestamp("scheduledAt"),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  result: json("result").$type<Record<string, unknown>>(),
  publishTaskId: int("publishTaskId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const geoRewritePool = mysqlTable("geo_rewrite_pool", {
  id: int("id").autoincrement().primaryKey(),
  articleId: int("articleId").notNull(),
  projectId: int("projectId").notNull(),
  triggerStatus: varchar("triggerStatus", { length: 32 }).notNull(),
  source: varchar("source", { length: 64 }).notNull(),
  reason: text("reason").notNull(),
  publishTaskId: int("publishTaskId"),
  status: varchar("status", { length: 32 }).notNull().default("open"),
  suggestionText: text("suggestionText"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const projectPlatformAccounts = mysqlTable(
  "project_platform_accounts",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    platform: varchar("platform", { length: 50 }).notNull(),
    accountName: varchar("accountName", { length: 255 }).notNull(),
    accountIdOrUrl: varchar("accountIdOrUrl", { length: 2000 }),
    accountGroup: varchar("accountGroup", { length: 50 }),
    accountRole: varchar("accountRole", { length: 50 }),
    isEnabled: int("isEnabled").default(1).notNull(),
    verificationStatus: varchar("verificationStatus", { length: 32 }).default("unknown").notNull(),
    lastVerifiedAt: timestamp("lastVerifiedAt"),
    lastDetectedAccountName: varchar("lastDetectedAccountName", { length: 255 }),
    localAgentId: varchar("localAgentId", { length: 100 }),
    localProfileId: varchar("localProfileId", { length: 100 }),
    sessionStatus: varchar("sessionStatus", { length: 30 }),
    lastSessionCheckedAt: timestamp("lastSessionCheckedAt"),
    lastLoginAt: timestamp("lastLoginAt"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    projectPlatformNameUnique: uniqueIndex("project_platform_accounts_project_platform_name").on(
      table.projectId,
      table.platform,
      table.accountName,
    ),
  }),
);

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

/** GEO V1.1：检测轮次（T0 基线 / T1–T3 复测） */
export const testRoundTypeEnum = mysqlEnum("roundType", [
  "T0_BASELINE",
  "T1_RETEST",
  "T2_RETEST",
  "T3_RETEST",
]);

export const testRoundStatusEnum = mysqlEnum("status", ["pending", "running", "completed", "failed"]);

export const testRounds = mysqlTable("test_rounds", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: int("projectId").notNull(),
  roundType: testRoundTypeEnum.notNull(),
  roundName: varchar("roundName", { length: 255 }).notNull(),
  status: testRoundStatusEnum.default("pending").notNull(),
  platforms: json("platforms").$type<string[]>().notNull(),
  questionsCount: int("questionsCount").default(0).notNull(),
  runsPerQuestion: int("runsPerQuestion").default(3).notNull(),
  startedAt: timestamp("startedAt"),
  finishedAt: timestamp("finishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** GEO V1.1：检测轮次与问题关联（不复制 questionText） */
export const roundQuestions = mysqlTable(
  "round_questions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    roundId: varchar("roundId", { length: 36 }).notNull(),
    questionId: int("questionId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    roundQuestionUnique: uniqueIndex("round_questions_round_question_unique").on(table.roundId, table.questionId),
  }),
);

/** GEO V1.1：结构化 AI 实测记录（禁止写入合成占位 rawAnswer） */
export const aiTestRuns = mysqlTable(
  "ai_test_runs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: int("projectId").notNull(),
    roundId: varchar("roundId", { length: 36 }).notNull(),
    questionId: int("questionId").notNull(),
    platform: varchar("platform", { length: 64 }).notNull(),
    runIndex: int("runIndex").notNull(),
    testedAt: timestamp("testedAt").notNull(),
    rawAnswer: text("rawAnswer").notNull(),
    mentionedCompany: boolean("mentionedCompany").default(false).notNull(),
    recommendedCompany: boolean("recommendedCompany").default(false).notNull(),
    descriptionAccurate: boolean("descriptionAccurate"),
    competitorMentioned: boolean("competitorMentioned").default(false).notNull(),
    competitorNames: json("competitorNames").$type<string[]>().notNull(),
    hasSourceLinks: boolean("hasSourceLinks").default(false).notNull(),
    sourceLinks: json("sourceLinks").$type<string[] | null>(),
    suspectedContentClues: text("suspectedContentClues"),
    manualNote: text("manualNote"),
    screenshotUrl: varchar("screenshotUrl", { length: 2000 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    roundQuestionPlatformRunUnique: uniqueIndex("ai_test_runs_round_question_platform_run_unique").on(
      table.roundId,
      table.questionId,
      table.platform,
      table.runIndex,
    ),
  }),
);

/** GEO V1.1：轮次间对比快照（客户可读结论，不暴露工程字段） */
export const retestChangeDirectionEnum = mysqlEnum("changeDirection", ["up", "flat", "down", "unknown"]);

export const retestConfidenceLevelEnum = mysqlEnum("confidenceLevel", [
  "high",
  "medium",
  "low",
  "observe_more",
]);

export const retestComparisons = mysqlTable("retest_comparisons", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: int("projectId").notNull(),
  baseRoundId: varchar("baseRoundId", { length: 36 }).notNull(),
  compareRoundId: varchar("compareRoundId", { length: 36 }).notNull(),
  questionType: varchar("questionType", { length: 64 }).notNull(),
  platform: varchar("platform", { length: 64 }).notNull(),
  baseMentionCount: int("baseMentionCount").default(0).notNull(),
  compareMentionCount: int("compareMentionCount").default(0).notNull(),
  baseRecommendCount: int("baseRecommendCount").default(0).notNull(),
  compareRecommendCount: int("compareRecommendCount").default(0).notNull(),
  baseCompetitorCount: int("baseCompetitorCount").default(0).notNull(),
  compareCompetitorCount: int("compareCompetitorCount").default(0).notNull(),
  changeDirection: retestChangeDirectionEnum.notNull(),
  systemConclusion: text("systemConclusion").notNull(),
  confidenceLevel: retestConfidenceLevelEnum.notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** GEO V1.1 Phase 2：有效动作库（长期护城河，需人工确认效果等级） */
export const effectiveActions = mysqlTable("effective_actions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  /** FK → projects.id */
  projectId: int("projectId").notNull(),
  industry: varchar("industry", { length: 255 }).notNull(),
  customerType: varchar("customerType", { length: 255 }).notNull(),
  questionType: varchar("questionType", { length: 64 }).notNull(),
  actionType: varchar("actionType", { length: 64 }).notNull(),
  actionName: varchar("actionName", { length: 255 }).notNull(),
  platform: varchar("platform", { length: 64 }).notNull(),
  publishedUrl: varchar("publishedUrl", { length: 2000 }),
  executedAt: timestamp("executedAt").notNull(),
  /** FK → test_rounds.id */
  baseRoundId: varchar("baseRoundId", { length: 36 }),
  /** FK → test_rounds.id */
  compareRoundId: varchar("compareRoundId", { length: 36 }),
  baseMentionCount: int("baseMentionCount"),
  compareMentionCount: int("compareMentionCount"),
  changeDirection: varchar("changeDirection", { length: 32 }),
  effectLevel: varchar("effectLevel", { length: 64 }).notNull(),
  manualConclusion: text("manualConclusion"),
  applicableCondition: text("applicableCondition"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** GEO V1.1：用户系统通知 */
export const systemNotificationTypeEnum = mysqlEnum("notificationType", ["t0_complete","publish_success","publish_failed","t1_retest_complete"]);
export const systemNotifications = mysqlTable("system_notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  type: systemNotificationTypeEnum.notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** 关键操作审计日志（仅写入，无 UI） */
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  action: varchar("action", { length: 64 }).notNull(),
  detail: text("detail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** GEO V1.1：用户反馈（右下角反馈入口） */
export const userFeedbackTypeEnum = mysqlEnum("feedbackType", ["bug", "suggestion", "other"]);
export const userFeedbacks = mysqlTable("user_feedbacks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  type: userFeedbackTypeEnum.notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** 全局系统配置（单行 id=1，管理员在 /admin/config 维护） */
export const geoSystemConfig = mysqlTable("geo_system_config", {
  id: int("id").primaryKey().default(1),
  contentGenerationPerMinuteLimit: int("contentGenerationPerMinuteLimit").notNull(),
  t0DetectionPerHourLimit: int("t0DetectionPerHourLimit").notNull(),
  qualityMinPassScore: int("qualityMinPassScore").notNull(),
  defaultPublishPlatforms: json("defaultPublishPlatforms").$type<string[]>().notNull(),
  systemAnnouncementEnabled: int("systemAnnouncementEnabled").notNull().default(0),
  systemAnnouncementBody: text("systemAnnouncementBody"),
  systemAnnouncementUpdatedAt: timestamp("systemAnnouncementUpdatedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedByUserId: int("updatedByUserId"),
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
export type QuestionTemplate = typeof questionTemplates.$inferSelect;
export type InsertQuestionTemplate = typeof questionTemplates.$inferInsert;
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
export type ProjectPlatformAccount = typeof projectPlatformAccounts.$inferSelect;
export type InsertProjectPlatformAccount = typeof projectPlatformAccounts.$inferInsert;
export type TestRound = typeof testRounds.$inferSelect;
export type InsertTestRound = typeof testRounds.$inferInsert;
export type RoundQuestion = typeof roundQuestions.$inferSelect;
export type InsertRoundQuestion = typeof roundQuestions.$inferInsert;
export type AiTestRun = typeof aiTestRuns.$inferSelect;
export type InsertAiTestRun = typeof aiTestRuns.$inferInsert;
export type RetestComparison = typeof retestComparisons.$inferSelect;
export type InsertRetestComparison = typeof retestComparisons.$inferInsert;
export type EffectiveAction = typeof effectiveActions.$inferSelect;
export type InsertEffectiveAction = typeof effectiveActions.$inferInsert;
export type SystemNotification = typeof systemNotifications.$inferSelect;
export type InsertSystemNotification = typeof systemNotifications.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
export type GeoSystemConfig = typeof geoSystemConfig.$inferSelect;
export type InsertGeoSystemConfig = typeof geoSystemConfig.$inferInsert;
