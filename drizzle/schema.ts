import { boolean, foreignKey, mediumtext, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

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
  role: mysqlEnum("role", ["user", "admin", "operator"]).default("user").notNull(),
  /** 代运营公司注册时填写的机构名称（仅 role=operator） */
  operatorCompanyName: varchar("operatorCompanyName", { length: 255 }),
  companyId: int("companyId"),
  userStatus: mysqlEnum("userStatus", ["pending_review", "active", "rejected", "disabled"])
    .default("active")
    .notNull(),
  customerRole: mysqlEnum("customerRole", ["customer_admin", "customer_member"]),
  applicationNote: text("applicationNote"),
  reviewedAt: timestamp("reviewedAt"),
  reviewedBy: int("reviewedBy"),
  /** 订阅套餐档位（管理员可调整；未接入支付前默认基础版） */
  subscriptionPlanId: mysqlEnum("subscriptionPlanId", ["basic", "professional", "enterprise"])
    .default("basic")
    .notNull(),
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

export const questionSourceEnum = mysqlEnum("source", ["ai_generated", "manual", "csv", "onboarding_wizard"]);

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
export const trustEvidenceTypeEnum = mysqlEnum("evidenceType", [
  "case",
  "certificate",
  "media_coverage",
  "customer_review",
  "partnership",
  "award",
  "data_proof",
  "other",
]);
export const trustEvidenceVerificationStatusEnum = mysqlEnum("verificationStatus", [
  "draft",
  "verified",
  "rejected",
]);
export const discoveryCandidateTypeEnum = mysqlEnum("candidateType", ["source", "trust_evidence"]);
export const discoveryConfidenceEnum = mysqlEnum("confidence", ["high", "medium", "low"]);
export const discoveryCandidateStatusEnum = mysqlEnum("status", ["pending", "accepted", "ignored"]);
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
  /** T0 检测完成后自动标注的内容缺口标签（客户可读文案） */
  contentGapTags: json("contentGapTags").$type<string[]>(),
  /** P1-A AI 搜索问题池类型：brand_search / category_recommend / scene_need / comparison / long_tail / geo_region */
  searchPoolType: varchar("searchPoolType", { length: 64 }),
  targetKeywords: json("targetKeywords").$type<string[]>(),
  targetCustomerScene: text("targetCustomerScene"),
  relatedGeoGap: text("relatedGeoGap"),
  relatedContentTask: boolean("relatedContentTask").default(false).notNull(),
  requiredSourceTypes: json("requiredSourceTypes").$type<string[]>(),
  requiredEntityAnchors: json("requiredEntityAnchors").$type<string[]>(),
  priorityLevel: varchar("priorityLevel", { length: 16 }),
  lastTestResult: varchar("lastTestResult", { length: 32 }),
  lastTestedAt: timestamp("lastTestedAt"),
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
  /** P1-C：规则抽取 — 是否提及品牌 */
  extractedMentioned: boolean("extractedMentioned"),
  /** P1-C：规则抽取 — 是否推荐品牌 */
  extractedRecommended: boolean("extractedRecommended"),
  /** P1-C：规则抽取 — 引用来源列表 */
  extractedCitations: json("extractedCitations").$type<string[]>(),
  /** P1-C：规则抽取 — 出现的竞品名 */
  extractedCompetitors: json("extractedCompetitors").$type<string[]>(),
  /** P1-C：规则抽取 — positive/neutral/negative */
  extractedSentiment: varchar("extractedSentiment", { length: 16 }),
  /** P1-C：抽取方式 rule/ai */
  extractionMethod: varchar("extractionMethod", { length: 16 }),
  extractedAt: timestamp("extractedAt"),
  /** P1-C：对应 questions.searchPoolType */
  questionPoolType: varchar("questionPoolType", { length: 64 }),
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

/** GEO V2.0：AI 品牌成熟度 6 维评分（每项目可存多条历史记录） */
export const geoMaturityScores = mysqlTable(
  "geo_maturity_scores",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    totalScore: int("totalScore").notNull(),
    brandIdentityScore: int("brandIdentityScore"),
    categoryPositioningScore: int("categoryPositioningScore"),
    questionCoverageScore: int("questionCoverageScore"),
    sourceGraphScore: int("sourceGraphScore"),
    trustEvidenceScore: int("trustEvidenceScore"),
    aiTestPerformanceScore: int("aiTestPerformanceScore"),
    calculationDetail: json("calculationDetail").$type<Record<string, unknown>>(),
    calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    projectCalculatedIdx: index("geo_maturity_scores_project_calculated_idx").on(
      table.projectId,
      table.calculatedAt,
    ),
  }),
);

export const monthlyOptimizationPlanStatusEnum = mysqlEnum("monthlyOptimizationPlanStatus", [
  "active",
  "completed",
]);

export const monthlyOptimizationTaskTypeEnum = mysqlEnum("monthlyOptimizationTaskType", [
  "content_generation",
  "source_discovery",
  "evidence_addition",
  "profile_completion",
]);

export const monthlyOptimizationTaskStatusEnum = mysqlEnum("monthlyOptimizationTaskStatus", [
  "pending",
  "in_progress",
  "completed",
]);

export const monthlyOptimizationPlans = mysqlTable(
  "monthly_optimization_plans",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    roundNumber: int("roundNumber").default(1).notNull(),
    status: monthlyOptimizationPlanStatusEnum.default("active").notNull(),
    baselineMaturityScore: int("baselineMaturityScore").notNull(),
    baselineDimensionScores: json("baselineDimensionScores")
      .$type<Record<string, number>>()
      .notNull(),
    generatedAt: timestamp("generatedAt").defaultNow().notNull(),
    retestScheduledAt: timestamp("retestScheduledAt"),
    retestCompletedAt: timestamp("retestCompletedAt"),
    resultMaturityScore: int("resultMaturityScore"),
    resultDimensionScores: json("resultDimensionScores").$type<Record<string, number>>(),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    projectStatusIdx: index("monthly_optimization_plans_project_status_idx").on(
      table.projectId,
      table.status,
    ),
  }),
);

export const monthlyOptimizationTasks = mysqlTable(
  "monthly_optimization_tasks",
  {
    id: int("id").autoincrement().primaryKey(),
    planId: int("planId").notNull(),
    projectId: int("projectId").notNull(),
    taskType: monthlyOptimizationTaskTypeEnum.notNull(),
    targetDimension: varchar("targetDimension", { length: 64 }).notNull(),
    relatedQuestionId: int("relatedQuestionId"),
    title: varchar("title", { length: 255 }).notNull(),
    reason: text("reason").notNull(),
    status: monthlyOptimizationTaskStatusEnum.default("pending").notNull(),
    linkedEntityId: int("linkedEntityId"),
    actionUrl: varchar("actionUrl", { length: 500 }).notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    planIdx: index("monthly_optimization_tasks_plan_idx").on(table.planId),
    projectIdx: index("monthly_optimization_tasks_project_idx").on(table.projectId),
  }),
);

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
  targetQuestionId: varchar("targetQuestionId", { length: 36 }),
  targetGapType: varchar("targetGapType", { length: 64 }),
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
  effectInclusionStatus: varchar("effectInclusionStatus", { length: 32 }),
  inclusionVerifiedAt: timestamp("inclusionVerifiedAt"),
  inclusionKeywords: json("inclusionKeywords").$type<string[]>(),
  readCount: int("readCount"),
  impressionCount: int("impressionCount"),
  interactionCount: int("interactionCount"),
  searchTriggerKeywords: json("searchTriggerKeywords").$type<string[]>(),
  effectDataSource: varchar("effectDataSource", { length: 32 }),
  evidenceScreenshotUrl: varchar("evidenceScreenshotUrl", { length: 2000 }),
  evidenceNotes: text("evidenceNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
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
  wizardStep: int("wizardStep").default(0).notNull(),
  wizardCompletedAt: timestamp("wizardCompletedAt"),
  targetMentionRate: int("targetMentionRate"),
  targetRecommendationRate: int("targetRecommendationRate"),
  targetPlatforms: json("targetPlatforms").$type<string[]>().notNull().default([]),
  targetQuestionCategories: json("targetQuestionCategories").$type<string[]>().notNull().default([]),
  targetCompetitorsToBeat: json("targetCompetitorsToBeat").$type<string[]>().notNull().default([]),
  monthlyContentCapacity: int("monthlyContentCapacity"),
  internalOwnerName: varchar("internalOwnerName", { length: 255 }),
  geoGoalNotes: text("geoGoalNotes"),
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

export const trustEvidenceItems = mysqlTable("trust_evidence_items", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  evidenceType: trustEvidenceTypeEnum.notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  summary: text("summary"),
  content: text("content"),
  sourceUrl: varchar("sourceUrl", { length: 2000 }),
  isPublic: boolean("isPublic").default(true).notNull(),
  verificationStatus: trustEvidenceVerificationStatusEnum.default("draft").notNull(),
  displayOrder: int("displayOrder").default(0).notNull(),
  linkedCustomerCaseId: int("linkedCustomerCaseId"),
  metadata: json("metadata").$type<Record<string, unknown> | null>(),
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
  /** P1-C：本轮来自问题池的题目数 */
  sourceQuestionPoolSize: int("sourceQuestionPoolSize"),
  /** P1-C：本轮测试的平台列表（与 platforms 并存，便于问题池实测筛选） */
  platformsIncluded: json("platformsIncluded").$type<string[]>(),
  /** P1-C：触发类型 manual/t1/t2/t3/weekly */
  scheduledType: varchar("scheduledType", { length: 32 }),
  /** P1-C：对比基准轮次 ID */
  comparedToRoundId: varchar("comparedToRoundId", { length: 36 }),
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
export const systemNotificationTypeEnum = mysqlEnum("type", ["t0_complete","publish_success","publish_failed","t1_retest_complete","weekly_growth_report"]);
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
export type GeoMaturityScore = typeof geoMaturityScores.$inferSelect;
export type InsertGeoMaturityScore = typeof geoMaturityScores.$inferInsert;
export type MonthlyOptimizationPlan = typeof monthlyOptimizationPlans.$inferSelect;
export type InsertMonthlyOptimizationPlan = typeof monthlyOptimizationPlans.$inferInsert;
export type MonthlyOptimizationTask = typeof monthlyOptimizationTasks.$inferSelect;
export type InsertMonthlyOptimizationTask = typeof monthlyOptimizationTasks.$inferInsert;
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
export type TrustEvidenceItem = typeof trustEvidenceItems.$inferSelect;
export type InsertTrustEvidenceItem = typeof trustEvidenceItems.$inferInsert;
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

export const brandSourceRiskLevelEnum = mysqlEnum("brand_source_risk_level", ["low", "medium", "high"]);

export const entityAnchorTypeEnum = mysqlEnum("entity_anchor_type", [
  "brand_name",
  "company_name",
  "main_business",
  "target_customer",
  "core_product",
  "official_url",
  "target_keywords",
  "customer_proof",
]);

export const entityConsistencyStatusEnum = mysqlEnum("entity_consistency_status", [
  "consistent",
  "partial",
  "missing",
  "conflict",
]);

export const sourceEnhancementStatusEnum = mysqlEnum("source_enhancement_status", [
  "pending",
  "accepted",
  "content_task_created",
  "ignored",
  "verified",
]);

/** 品牌信源图谱：各平台信源记录（P1-B） */
export const brandSourceRecords = mysqlTable("brand_source_records", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  platform: varchar("platform", { length: 64 }).notNull(),
  sourceName: varchar("sourceName", { length: 255 }),
  platformName: varchar("platformName", { length: 255 }),
  url: varchar("url", { length: 2000 }),
  isPubliclyAccessible: boolean("isPubliclyAccessible").default(false).notNull(),
  containsBrandName: boolean("containsBrandName").default(false).notNull(),
  containsBusinessDescription: boolean("containsBusinessDescription").default(false).notNull(),
  containsOfficialSite: boolean("containsOfficialSite").default(false).notNull(),
  containsCoreKeywords: boolean("containsCoreKeywords").default(false).notNull(),
  aiCitationConfirmed: boolean("aiCitationConfirmed").default(false).notNull(),
  isCrossSourceConsistent: boolean("isCrossSourceConsistent").default(false).notNull(),
  riskLevel: brandSourceRiskLevelEnum.default("low").notNull(),
  riskNotes: text("riskNotes"),
  notes: text("notes"),
  lastVerifiedAt: timestamp("lastVerifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** 实体锚点配置：每个项目一份（P1-B） */
export const entityAnchors = mysqlTable(
  "entity_anchors",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    brandName: varchar("brandName", { length: 255 }),
    companyName: varchar("companyName", { length: 255 }),
    coreBusiness: text("coreBusiness"),
    targetCustomer: text("targetCustomer"),
    coreKeywords: json("coreKeywords").$type<string[]>().notNull().default([]),
    officialSite: varchar("officialSite", { length: 500 }),
    founderName: varchar("founderName", { length: 255 }),
    typicalCases: text("typicalCases"),
    manualOverride: boolean("manualOverride").default(false).notNull(),
    lastSyncedFrom: varchar("lastSyncedFrom", { length: 64 }),
    lastSyncedAt: timestamp("lastSyncedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    projectIdUnique: uniqueIndex("entity_anchors_project_id_unique").on(table.projectId),
  }),
);

/** 实体一致性检查结果（P1-B） */
export const entityConsistencyChecks = mysqlTable(
  "entity_consistency_checks",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    anchorType: entityAnchorTypeEnum.notNull(),
    standardValue: text("standardValue"),
    observedValues: json("observedValues").$type<string[]>().notNull().default([]),
    status: entityConsistencyStatusEnum.notNull(),
    score: int("score").notNull(),
    issueSummary: text("issueSummary"),
    suggestion: text("suggestion"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    projectAnchorUnique: uniqueIndex("entity_consistency_checks_project_anchor_unique").on(
      table.projectId,
      table.anchorType,
    ),
  }),
);

/** 信源内容增强建议（P1-B） */
export const sourceEnhancementSuggestions = mysqlTable("source_enhancement_suggestions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  suggestionTitle: varchar("suggestionTitle", { length: 255 }).notNull(),
  gapType: varchar("gapType", { length: 64 }).notNull(),
  targetPlatform: varchar("targetPlatform", { length: 64 }),
  targetKeywords: json("targetKeywords").$type<string[]>().notNull().default([]),
  contentDirection: text("contentDirection").notNull(),
  priority: taskPriorityEnum.notNull(),
  status: sourceEnhancementStatusEnum.default("pending").notNull(),
  linkedTaskId: int("linkedTaskId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** AI 自动发现候选：信源 / 信任证据（P0-I） */
export const discoveryCandidates = mysqlTable("discovery_candidates", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  candidateType: discoveryCandidateTypeEnum.notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  url: varchar("url", { length: 2000 }).notNull(),
  snippet: text("snippet"),
  sourceDomain: varchar("sourceDomain", { length: 255 }),
  suggestedRecordType: varchar("suggestedRecordType", { length: 64 }).notNull(),
  confidence: discoveryConfidenceEnum.default("medium").notNull(),
  detectedSignals: json("detectedSignals").$type<Record<string, boolean>>().notNull().default({}),
  status: discoveryCandidateStatusEnum.default("pending").notNull(),
  acceptedRecordId: int("acceptedRecordId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BrandSourceRecord = typeof brandSourceRecords.$inferSelect;
export type InsertBrandSourceRecord = typeof brandSourceRecords.$inferInsert;
export type EntityAnchor = typeof entityAnchors.$inferSelect;
export type InsertEntityAnchor = typeof entityAnchors.$inferInsert;
export type EntityConsistencyCheck = typeof entityConsistencyChecks.$inferSelect;
export type InsertEntityConsistencyCheck = typeof entityConsistencyChecks.$inferInsert;
export type SourceEnhancementSuggestion = typeof sourceEnhancementSuggestions.$inferSelect;
export type InsertSourceEnhancementSuggestion = typeof sourceEnhancementSuggestions.$inferInsert;
export type DiscoveryCandidate = typeof discoveryCandidates.$inferSelect;
export type InsertDiscoveryCandidate = typeof discoveryCandidates.$inferInsert;

export const customerCompanyStatusEnum = mysqlEnum("status", [
  "pending",
  "active",
  "rejected",
  "disabled",
]);

export const customerCompanies = mysqlTable(
  "customer_companies",
  {
  id: int("id").autoincrement().primaryKey(),
  /** 创建该客户公司的代运营用户 id；NULL 表示平台级客户（历史数据） */
  ownerUserId: int("ownerUserId"),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 120 }),
  contactPhone: varchar("contactPhone", { length: 64 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  industry: varchar("industry", { length: 255 }),
  sourceChannel: varchar("sourceChannel", { length: 120 }),
  status: customerCompanyStatusEnum.default("pending").notNull(),
  notes: text("notes"),
  approvedAt: timestamp("approvedAt"),
  approvedBy: int("approvedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    ownerUserIdx: index("customer_companies_owner_user_idx").on(table.ownerUserId),
  }),
);

export const companyPlanTypeEnum = mysqlEnum("planType", ["trial", "basic", "pro", "agency", "custom"]);
export const companySubscriptionStatusEnum = mysqlEnum("status", [
  "trial",
  "active",
  "expired",
  "paused",
  "cancelled",
]);

export const companySubscriptions = mysqlTable(
  "company_subscriptions",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("companyId").notNull(),
    planType: companyPlanTypeEnum.notNull(),
    planName: varchar("planName", { length: 120 }).notNull(),
    status: companySubscriptionStatusEnum.default("trial").notNull(),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt"),
    maxProjects: int("maxProjects").default(1).notNull(),
    monthlyAiTests: int("monthlyAiTests").default(10).notNull(),
    monthlyContentTasks: int("monthlyContentTasks").default(20).notNull(),
    monthlyReports: int("monthlyReports").default(1).notNull(),
    maxTeamMembers: int("maxTeamMembers").default(5).notNull(),
    enabledFeatures: json("enabledFeatures").$type<Record<string, boolean>>().notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    companyUnique: uniqueIndex("company_subscriptions_company_unique").on(table.companyId),
  }),
);

export const companyProjectStatusEnum = mysqlEnum("status", ["active", "inactive"]);

export const companyProjects = mysqlTable(
  "company_projects",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("companyId").notNull(),
    projectId: int("projectId").notNull(),
    projectName: varchar("projectName", { length: 255 }).notNull(),
    status: companyProjectStatusEnum.default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    projectUnique: uniqueIndex("company_projects_project_unique").on(table.projectId),
    companyIdx: index("company_projects_company_idx").on(table.companyId),
  }),
);

export type CustomerCompany = typeof customerCompanies.$inferSelect;
export type InsertCustomerCompany = typeof customerCompanies.$inferInsert;
export type CompanySubscription = typeof companySubscriptions.$inferSelect;
export type InsertCompanySubscription = typeof companySubscriptions.$inferInsert;
export type CompanyProject = typeof companyProjects.$inferSelect;
export type InsertCompanyProject = typeof companyProjects.$inferInsert;

/** GEO V3.2：Brand Truth / Understand Engine。旧档案只作为待核验输入，不自动升级为已验证事实。 */
export const brandTruthProfiles = mysqlTable(
  "brand_truth_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    currentVersion: int("currentVersion").default(1).notNull(),
    status: mysqlEnum("status", ["draft", "active", "needs_review", "archived"]).default("draft").notNull(),
    completenessScore: int("completenessScore").default(0).notNull(),
    verifiedFactRate: int("verifiedFactRate").default(0).notNull(),
    conflictCount: int("conflictCount").default(0).notNull(),
    outdatedFactCount: int("outdatedFactCount").default(0).notNull(),
    lastReviewedAt: timestamp("lastReviewedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    projectUnique: uniqueIndex("brand_truth_profiles_project_unique").on(table.projectId),
    idProjectUnique: uniqueIndex("brand_truth_profiles_id_project_unique").on(table.id, table.projectId),
  }),
);

export const brandTruthFacts = mysqlTable(
  "brand_truth_facts",
  {
    id: int("id").autoincrement().primaryKey(),
    profileId: int("profileId").notNull(),
    projectId: int("projectId").notNull(),
    category: mysqlEnum("category", ["identity", "business", "capability_boundary", "temporal"]).notNull(),
    factType: varchar("factType", { length: 64 }).notNull(),
    factKey: varchar("factKey", { length: 128 }).notNull(),
    factValue: text("factValue").notNull(),
    normalizedValue: text("normalizedValue"),
    description: text("description"),
    importance: mysqlEnum("importance", ["critical", "high", "medium", "low"]).default("medium").notNull(),
    verificationStatus: mysqlEnum("verificationStatus", [
      "provided_unverified", "official_verified", "third_party_verified", "multi_source_verified",
      "conflicting", "outdated", "deprecated", "unknown",
    ]).default("provided_unverified").notNull(),
    validFrom: timestamp("validFrom"),
    validTo: timestamp("validTo"),
    sourceCount: int("sourceCount").default(0).notNull(),
    officialSourceCount: int("officialSourceCount").default(0).notNull(),
    thirdPartySourceCount: int("thirdPartySourceCount").default(0).notNull(),
    conflictCount: int("conflictCount").default(0).notNull(),
    lastVerifiedAt: timestamp("lastVerifiedAt"),
    createdBy: int("createdBy"),
    reviewedBy: int("reviewedBy"),
    version: int("version").default(1).notNull(),
    archivedAt: timestamp("archivedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    projectKeyIdx: index("brand_truth_facts_project_key_idx").on(table.projectId, table.factKey),
    profileIdx: index("brand_truth_facts_profile_idx").on(table.profileId),
  }),
);

export const brandTruthFactVersions = mysqlTable(
  "brand_truth_fact_versions",
  {
    id: int("id").autoincrement().primaryKey(),
    factId: int("factId").notNull(),
    projectId: int("projectId").notNull(),
    version: int("version").notNull(),
    profileVersion: int("profileVersion").notNull(),
    previousValue: text("previousValue"),
    newValue: text("newValue").notNull(),
    previousVerificationStatus: varchar("previousVerificationStatus", { length: 64 }),
    newVerificationStatus: varchar("newVerificationStatus", { length: 64 }).notNull(),
    changeReason: text("changeReason").notNull(),
    evidenceChange: json("evidenceChange").$type<Record<string, unknown> | null>(),
    affectsHistoricalInterpretation: boolean("affectsHistoricalInterpretation").default(false).notNull(),
    requiresRevalidation: boolean("requiresRevalidation").default(true).notNull(),
    effectiveAt: timestamp("effectiveAt"),
    changedBy: int("changedBy"),
    changedAt: timestamp("changedAt").defaultNow().notNull(),
  },
  table => ({
    factVersionUnique: uniqueIndex("brand_truth_fact_versions_fact_version_unique").on(table.factId, table.version),
    idProjectUnique: uniqueIndex("brand_truth_fact_versions_id_project_unique").on(table.id, table.projectId),
  }),
);

export const brandTruthEvidence = mysqlTable(
  "brand_truth_evidence",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    evidenceType: varchar("evidenceType", { length: 64 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    url: varchar("url", { length: 2000 }),
    publisher: varchar("publisher", { length: 255 }),
    sourceOwner: varchar("sourceOwner", { length: 255 }),
    sourceClass: mysqlEnum("sourceClass", ["official", "third_party", "enterprise_provided", "unknown"]).default("unknown").notNull(),
    independentSource: boolean("independentSource").default(false).notNull(),
    accessible: boolean("accessible").default(false).notNull(),
    authorityLevel: mysqlEnum("authorityLevel", ["high", "medium", "low", "unknown"]).default("unknown").notNull(),
    freshnessStatus: mysqlEnum("freshnessStatus", ["current", "aging", "outdated", "unknown"]).default("unknown").notNull(),
    consistencyStatus: mysqlEnum("consistencyStatus", ["consistent", "partial", "conflicting", "unknown"]).default("unknown").notNull(),
    verificationStatus: mysqlEnum("verificationStatus", ["pending", "verified", "rejected", "unverifiable"]).default("pending").notNull(),
    evidenceExcerpt: text("evidenceExcerpt"),
    evidenceHash: varchar("evidenceHash", { length: 128 }),
    manualReviewStatus: mysqlEnum("manualReviewStatus", ["pending", "approved", "rejected"]).default("pending").notNull(),
    publishedAt: timestamp("publishedAt"),
    sourceUpdatedAt: timestamp("sourceUpdatedAt"),
    capturedAt: timestamp("capturedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ projectIdx: index("brand_truth_evidence_project_idx").on(table.projectId) }),
);

export const brandTruthFactEvidenceLinks = mysqlTable(
  "brand_truth_fact_evidence_links",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    factId: int("factId").notNull(),
    evidenceId: int("evidenceId").notNull(),
    supportType: mysqlEnum("supportType", ["supports", "contradicts", "context_only"]).default("supports").notNull(),
    confidence: int("confidence").default(0).notNull(),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ linkUnique: uniqueIndex("brand_truth_fact_evidence_link_unique").on(table.factId, table.evidenceId) }),
);

export const brandTruthConflicts = mysqlTable(
  "brand_truth_conflicts",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    factKey: varchar("factKey", { length: 128 }).notNull(),
    factId: int("factId").notNull(),
    evidenceAId: int("evidenceAId"),
    evidenceBId: int("evidenceBId"),
    conflictType: varchar("conflictType", { length: 64 }).notNull(),
    severity: mysqlEnum("severity", ["P0", "P1", "P2"]).default("P2").notNull(),
    resolutionStatus: mysqlEnum("resolutionStatus", ["open", "reviewing", "resolved", "accepted_difference"]).default("open").notNull(),
    resolutionNote: text("resolutionNote"),
    resolvedBy: int("resolvedBy"),
    resolvedAt: timestamp("resolvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ projectStatusIdx: index("brand_truth_conflicts_project_status_idx").on(table.projectId, table.resolutionStatus) }),
);

export const understandingQuestionSets = mysqlTable(
  "understanding_question_sets",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    version: int("version").default(1).notNull(),
    status: mysqlEnum("status", ["draft", "active", "archived"]).default("draft").notNull(),
    validFrom: timestamp("validFrom"),
    validTo: timestamp("validTo"),
    fixedAcrossPeriods: boolean("fixedAcrossPeriods").default(true).notNull(),
    createdBy: int("createdBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ projectVersionUnique: uniqueIndex("understanding_question_sets_project_version_unique").on(table.projectId, table.version) }),
);

export const understandingQuestions = mysqlTable(
  "understanding_questions",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    questionSetId: int("questionSetId").notNull(),
    category: varchar("category", { length: 64 }).notNull(),
    questionType: mysqlEnum("questionType", ["system_default", "project_custom", "high_risk", "name_collision", "outdated_info", "competitor_confusion"]).notNull(),
    questionText: text("questionText").notNull(),
    verificationFactKeys: json("verificationFactKeys").$type<string[]>().notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    fixedAcrossPeriods: boolean("fixedAcrossPeriods").default(true).notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ setIdx: index("understanding_questions_set_idx").on(table.questionSetId) }),
);

export const understandingEvaluations = mysqlTable(
  "understanding_evaluations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: int("projectId").notNull(),
    questionSetId: int("questionSetId").notNull(),
    questionId: int("questionId").notNull(),
    sourceAiTestRunId: varchar("sourceAiTestRunId", { length: 36 }),
    testRoundId: varchar("testRoundId", { length: 36 }),
    testedModel: varchar("testedModel", { length: 128 }).notNull(),
    testedChannel: varchar("testedChannel", { length: 64 }).notNull(),
    testedAt: timestamp("testedAt").notNull(),
    rawAnswer: text("rawAnswer").notNull(),
    extractedFacts: json("extractedFacts").$type<Record<string, unknown>>().notNull(),
    uncertainStatements: json("uncertainStatements").$type<string[]>().notNull(),
    ruleResults: json("ruleResults").$type<Record<string, unknown>>().notNull(),
    semanticJudgement: json("semanticJudgement").$type<Record<string, unknown> | null>(),
    evidenceReferences: json("evidenceReferences").$type<number[]>().notNull(),
    evaluationVersion: varchar("evaluationVersion", { length: 32 }).notNull(),
    methodologyVersion: varchar("methodologyVersion", { length: 64 }).notNull(),
    dimensionWeights: json("dimensionWeights").$type<Record<string, number>>().notNull(),
    ruleVersion: varchar("ruleVersion", { length: 64 }).notNull(),
    truthProfileVersion: int("truthProfileVersion").notNull(),
    questionSetVersion: int("questionSetVersion").notNull(),
    extractionVersion: varchar("extractionVersion", { length: 32 }).notNull(),
    extractorModel: varchar("extractorModel", { length: 128 }),
    evaluatorModel: varchar("evaluatorModel", { length: 128 }),
    manualReviewStatus: mysqlEnum("manualReviewStatus", ["not_required", "pending", "approved", "overridden"]).default("not_required").notNull(),
    finalStatus: mysqlEnum("finalStatus", ["accurate", "mostly_accurate", "partially_accurate", "missing", "inaccurate", "outdated", "conflicting", "hallucinated", "unverifiable"]).notNull(),
    severity: mysqlEnum("severity", ["P0", "P1", "P2"]),
    assessmentStatus: mysqlEnum("assessmentStatus", ["not_measured", "insufficient_data", "unknown", "no_issue_detected", "issue_detected"]).notNull(),
    plannedQuestionCount: int("plannedQuestionCount").notNull(),
    runQuestionCount: int("runQuestionCount").notNull(),
    verifiedFactCount: int("verifiedFactCount").notNull(),
    extractionCoverage: int("extractionCoverage").notNull(),
    assessmentCoverage: int("assessmentCoverage").notNull(),
    reviewedBy: int("reviewedBy"),
    reviewedAt: timestamp("reviewedAt"),
    reviewNote: text("reviewNote"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ projectTestedIdx: index("understanding_evaluations_project_tested_idx").on(table.projectId, table.testedAt) }),
);

export const understandingDimensionResults = mysqlTable(
  "understanding_dimension_results",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    evaluationId: varchar("evaluationId", { length: 36 }).notNull(),
    dimension: varchar("dimension", { length: 64 }).notNull(),
    score: int("score"),
    status: varchar("status", { length: 64 }).notNull(),
    expectedFacts: json("expectedFacts").$type<Record<string, unknown>[]>().notNull(),
    actualStatements: json("actualStatements").$type<string[]>().notNull(),
    matchedFacts: json("matchedFacts").$type<string[]>().notNull(),
    missingFacts: json("missingFacts").$type<string[]>().notNull(),
    inaccurateFacts: json("inaccurateFacts").$type<string[]>().notNull(),
    outdatedFacts: json("outdatedFacts").$type<string[]>().notNull(),
    conflictingFacts: json("conflictingFacts").$type<string[]>().notNull(),
    hallucinatedClaims: json("hallucinatedClaims").$type<string[]>().notNull(),
    unverifiableClaims: json("unverifiableClaims").$type<string[]>().notNull(),
    evidenceReferences: json("evidenceReferences").$type<number[]>().notNull(),
    severity: mysqlEnum("severity", ["P0", "P1", "P2"]),
    customerExplanation: text("customerExplanation").notNull(),
    recommendedCorrection: text("recommendedCorrection").notNull(),
    verificationQuestionIds: json("verificationQuestionIds").$type<number[]>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ evaluationDimensionUnique: uniqueIndex("understanding_dimension_evaluation_unique").on(table.evaluationId, table.dimension) }),
);

export const understandingCorrectionTasks = mysqlTable(
  "understanding_correction_tasks",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    evaluationId: varchar("evaluationId", { length: 36 }),
    factKey: varchar("factKey", { length: 128 }).notNull(),
    expectedFact: text("expectedFact"),
    observedStatement: text("observedStatement").notNull(),
    severity: mysqlEnum("severity", ["P0", "P1", "P2"]).notNull(),
    affectedStage: mysqlEnum("affectedStage", ["know", "understand", "trust", "recommend", "grow"]).default("understand").notNull(),
    recommendedAssetType: varchar("recommendedAssetType", { length: 64 }).notNull(),
    actionType: varchar("actionType", { length: 64 }).notNull(),
    actionDescription: text("actionDescription").notNull(),
    requiredEvidence: text("requiredEvidence").notNull(),
    owner: varchar("owner", { length: 255 }),
    priority: mysqlEnum("priority", ["P0", "P1", "P2"]).notNull(),
    dependency: text("dependency"),
    completionCriteria: text("completionCriteria").notNull(),
    verificationQuestionIds: json("verificationQuestionIds").$type<number[]>().notNull(),
    targetRetestRound: varchar("targetRetestRound", { length: 64 }),
    targetRetestAt: timestamp("targetRetestAt"),
    status: mysqlEnum("status", ["pending", "in_progress", "completed", "retest_scheduled", "verified", "cancelled"]).default("pending").notNull(),
    createdBy: int("createdBy"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ projectStatusIdx: index("understanding_correction_tasks_project_status_idx").on(table.projectId, table.status) }),
);

export const understandingRuleConfigs = mysqlTable(
  "understanding_rule_configs",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    ruleKey: varchar("ruleKey", { length: 128 }).notNull(),
    ruleVersion: int("ruleVersion").default(1).notNull(),
    configJson: json("configJson").$type<Record<string, unknown>>().notNull(),
    status: mysqlEnum("status", ["draft", "active", "archived"]).default("draft").notNull(),
    updatedBy: int("updatedBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ projectRuleUnique: uniqueIndex("understanding_rule_configs_project_rule_unique").on(table.projectId, table.ruleKey) }),
);

export type BrandTruthProfile = typeof brandTruthProfiles.$inferSelect;
export type BrandTruthFact = typeof brandTruthFacts.$inferSelect;
export type BrandTruthEvidence = typeof brandTruthEvidence.$inferSelect;
export type UnderstandingEvaluation = typeof understandingEvaluations.$inferSelect;
export type UnderstandingCorrectionTask = typeof understandingCorrectionTasks.$inferSelect;
export type UnderstandingRuleConfig = typeof understandingRuleConfigs.$inferSelect;

/** PR-03.6A: append-only raw AI Observation Ledger. Assessments remain outside this boundary. */
export const aiObservationRuns = mysqlTable(
  "ai_observation_runs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: int("projectId").notNull(),
    questionSetId: int("questionSetId"),
    questionSetVersionSnapshot: int("questionSetVersionSnapshot").notNull(),
    provider: varchar("provider", { length: 64 }).notNull(),
    modelName: varchar("modelName", { length: 128 }).notNull(),
    modelVersion: varchar("modelVersion", { length: 128 }),
    modelChannel: varchar("modelChannel", { length: 128 }),
    runPurpose: varchar("runPurpose", { length: 64 }).notNull(),
    locale: varchar("locale", { length: 32 }).notNull(),
    startedAt: timestamp("startedAt").notNull(),
    completedAt: timestamp("completedAt"),
    runStatus: mysqlEnum("runStatus", ["queued", "running", "succeeded", "partially_succeeded", "failed", "cancelled"]).notNull(),
    providerRequestId: varchar("providerRequestId", { length: 255 }),
    systemPromptVersion: varchar("systemPromptVersion", { length: 64 }).notNull(),
    systemPromptHash: varchar("systemPromptHash", { length: 128 }).notNull(),
    systemPromptSnapshot: text("systemPromptSnapshot"),
    samplingParameters: json("samplingParameters").$type<Record<string, unknown> | null>(),
    applicationVersion: varchar("applicationVersion", { length: 128 }).notNull(),
    errorCode: varchar("errorCode", { length: 128 }),
    errorMessage: text("errorMessage"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    createdBy: int("createdBy"),
  },
  table => ({
    idProjectUnique: uniqueIndex("ai_observation_runs_id_project_unique").on(table.id, table.projectId),
    projectStartedIdx: index("ai_observation_runs_project_started_idx").on(table.projectId, table.startedAt),
  }),
);

export const aiObservationRunEvents = mysqlTable(
  "ai_observation_run_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: int("projectId").notNull(),
    observationRunId: varchar("observationRunId", { length: 36 }).notNull(),
    eventType: mysqlEnum("eventType", ["queued", "running", "succeeded", "partially_succeeded", "failed", "cancelled"]).notNull(),
    eventSequence: int("eventSequence").notNull(),
    occurredAt: timestamp("occurredAt").notNull(),
    errorCode: varchar("errorCode", { length: 128 }),
    errorMessage: text("errorMessage"),
    eventMetadata: json("eventMetadata").$type<Record<string, unknown> | null>(),
    createdBy: int("createdBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    runSequenceUnique: uniqueIndex("ai_observation_run_events_run_sequence_unique").on(table.observationRunId, table.eventSequence),
    projectRunIdx: index("ai_observation_run_events_project_run_idx").on(table.projectId, table.observationRunId),
    runProjectFk: foreignKey({ columns: [table.observationRunId, table.projectId], foreignColumns: [aiObservationRuns.id, aiObservationRuns.projectId], name: "ai_observation_run_events_run_project_fk" }),
  }),
);

export const aiObservationAnswers = mysqlTable(
  "ai_observation_answers",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: int("projectId").notNull(),
    observationRunId: varchar("observationRunId", { length: 36 }).notNull(),
    questionId: int("questionId"),
    questionKey: varchar("questionKey", { length: 128 }).notNull(),
    questionVersionSnapshot: int("questionVersionSnapshot").notNull(),
    questionTextSnapshot: text("questionTextSnapshot").notNull(),
    scenarioSnapshot: text("scenarioSnapshot"),
    attemptNumber: int("attemptNumber").notNull(),
    providerResponseId: varchar("providerResponseId", { length: 255 }),
    rawAnswer: mediumtext("rawAnswer"),
    rawProviderMetadata: json("rawProviderMetadata").$type<Record<string, unknown> | null>(),
    answerContentHash: varchar("answerContentHash", { length: 128 }),
    receivedAt: timestamp("receivedAt"),
    latencyMs: int("latencyMs"),
    inputTokens: int("inputTokens"),
    outputTokens: int("outputTokens"),
    totalTokens: int("totalTokens"),
    finishReason: varchar("finishReason", { length: 128 }),
    answerStatus: mysqlEnum("answerStatus", ["received", "empty", "provider_error", "blocked", "incomplete"]).notNull(),
    citationCapability: mysqlEnum("citationCapability", ["supported", "unsupported", "unknown"]).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    idProjectUnique: uniqueIndex("ai_observation_answers_id_project_unique").on(table.id, table.projectId),
    runAttemptUnique: uniqueIndex("ai_observation_answers_run_question_attempt_unique").on(table.observationRunId, table.questionKey, table.attemptNumber),
    projectRunIdx: index("ai_observation_answers_project_run_idx").on(table.projectId, table.observationRunId),
    runProjectFk: foreignKey({ columns: [table.observationRunId, table.projectId], foreignColumns: [aiObservationRuns.id, aiObservationRuns.projectId], name: "ai_observation_answers_run_project_fk" }),
  }),
);

export const aiObservationExtractions = mysqlTable(
  "ai_observation_extractions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: int("projectId").notNull(),
    observationAnswerId: varchar("observationAnswerId", { length: 36 }).notNull(),
    attemptNumber: int("attemptNumber").notNull(),
    extractorKey: varchar("extractorKey", { length: 128 }).notNull(),
    extractorVersion: varchar("extractorVersion", { length: 64 }).notNull(),
    extractionPromptVersion: varchar("extractionPromptVersion", { length: 64 }).notNull(),
    extractionPromptHash: varchar("extractionPromptHash", { length: 128 }).notNull(),
    extractionModelProvider: varchar("extractionModelProvider", { length: 64 }),
    extractionModelName: varchar("extractionModelName", { length: 128 }),
    extractionModelChannel: varchar("extractionModelChannel", { length: 128 }),
    extractionStatus: mysqlEnum("extractionStatus", ["succeeded", "partially_succeeded", "failed", "insufficient_content"]).notNull(),
    structuredPayload: json("structuredPayload").$type<Record<string, unknown> | null>(),
    extractionCoverage: int("extractionCoverage"),
    extractionConfidence: int("extractionConfidence"),
    citationExtractionStatus: mysqlEnum("citationExtractionStatus", ["detected", "not_detected", "unsupported", "unknown", "extraction_failed"]).notNull(),
    startedAt: timestamp("startedAt").notNull(),
    completedAt: timestamp("completedAt"),
    errorCode: varchar("errorCode", { length: 128 }),
    errorMessage: text("errorMessage"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    idProjectUnique: uniqueIndex("ai_observation_extractions_id_project_unique").on(table.id, table.projectId),
    answerAttemptUnique: uniqueIndex("ai_observation_extractions_answer_attempt_unique").on(table.observationAnswerId, table.extractorKey, table.extractorVersion, table.attemptNumber),
    projectAnswerIdx: index("ai_observation_extractions_project_answer_idx").on(table.projectId, table.observationAnswerId),
    answerProjectFk: foreignKey({ columns: [table.observationAnswerId, table.projectId], foreignColumns: [aiObservationAnswers.id, aiObservationAnswers.projectId], name: "ai_observation_extractions_answer_project_fk" }),
  }),
);

export const aiExtractedBrandFacts = mysqlTable("ai_extracted_brand_facts", {
  id: int("id").autoincrement().primaryKey(), projectId: int("projectId").notNull(), extractionId: varchar("extractionId", { length: 36 }).notNull(),
  brandId: varchar("brandId", { length: 128 }), factKey: varchar("factKey", { length: 128 }).notNull(), extractedValue: text("extractedValue").notNull(), normalizedValue: text("normalizedValue"),
  sourceTextSpan: text("sourceTextSpan"), confidence: int("confidence"), uncertaintyType: mysqlEnum("uncertaintyType", ["none", "explicit_uncertainty", "ambiguous", "inferred", "unavailable"]).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ extractionIdx: index("ai_extracted_brand_facts_project_extraction_idx").on(table.projectId, table.extractionId), extractionProjectFk: foreignKey({ columns: [table.extractionId, table.projectId], foreignColumns: [aiObservationExtractions.id, aiObservationExtractions.projectId], name: "ai_extracted_brand_facts_extraction_project_fk" }) }));

export const aiRecommendationResults = mysqlTable("ai_recommendation_results", {
  id: int("id").autoincrement().primaryKey(), projectId: int("projectId").notNull(), extractionId: varchar("extractionId", { length: 36 }).notNull(), targetBrand: varchar("targetBrand", { length: 255 }).notNull(), competitorIdentity: varchar("competitorIdentity", { length: 255 }),
  mentionStatus: mysqlEnum("mentionStatus", ["detected", "not_detected", "unknown"]).notNull(), candidateStatus: mysqlEnum("candidateStatus", ["entered", "not_entered", "unknown"]).notNull(), recommendationStatus: mysqlEnum("recommendationStatus", ["recommended", "not_recommended", "unknown"]).notNull(), recommendationRank: int("recommendationRank"), recommendationReasonText: text("recommendationReasonText"), confidence: int("confidence"), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ extractionIdx: index("ai_recommendation_results_project_extraction_idx").on(table.projectId, table.extractionId), extractionProjectFk: foreignKey({ columns: [table.extractionId, table.projectId], foreignColumns: [aiObservationExtractions.id, aiObservationExtractions.projectId], name: "ai_recommendation_results_extraction_project_fk" }) }));

export const aiCitationResults = mysqlTable("ai_citation_results", {
  id: int("id").autoincrement().primaryKey(), projectId: int("projectId").notNull(), extractionId: varchar("extractionId", { length: 36 }).notNull(), citationStatus: mysqlEnum("citationStatus", ["detected", "not_detected", "unsupported", "unknown", "extraction_failed"]).notNull(), rawCitationText: text("rawCitationText"), normalizedUrl: varchar("normalizedUrl", { length: 2000 }), sourceTitle: varchar("sourceTitle", { length: 500 }), sourceOwner: varchar("sourceOwner", { length: 255 }), sourcePosition: int("sourcePosition"), accessibilityStatus: mysqlEnum("accessibilityStatus", ["accessible", "inaccessible", "unknown", "not_checked"]).notNull(), confidence: int("confidence"), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ extractionIdx: index("ai_citation_results_project_extraction_idx").on(table.projectId, table.extractionId), extractionProjectFk: foreignKey({ columns: [table.extractionId, table.projectId], foreignColumns: [aiObservationExtractions.id, aiObservationExtractions.projectId], name: "ai_citation_results_extraction_project_fk" }) }));
/** PR-03.6B: immutable governance registries and formal Understand Assessments. */
export const brandFactDefinitions = mysqlTable("brand_fact_definitions", {
  id: varchar("id", { length: 36 }).primaryKey(), projectId: int("projectId").notNull(), definitionKey: varchar("definitionKey", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["draft", "active", "retired"]).default("draft").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), createdBy: int("createdBy"),
}, table => ({ idProjectUnique: uniqueIndex("brand_fact_definitions_id_project_unique").on(table.id, table.projectId), projectKeyUnique: uniqueIndex("brand_fact_definitions_project_key_unique").on(table.projectId, table.definitionKey) }));

export const brandFactDefinitionVersions = mysqlTable("brand_fact_definition_versions", {
  id: varchar("id", { length: 36 }).primaryKey(), projectId: int("projectId").notNull(), definitionId: varchar("definitionId", { length: 36 }).notNull(), version: int("version").notNull(),
  displayName: varchar("displayName", { length: 255 }).notNull(), description: text("description"), requirement: mysqlEnum("requirement", ["required", "optional", "not_applicable"]).notNull(),
  valueType: mysqlEnum("valueType", ["text", "integer", "decimal", "boolean", "date", "datetime", "url", "enum", "json"]).notNull(), cardinality: mysqlEnum("cardinality", ["one", "many"]).notNull(),
  temporalSemantics: mysqlEnum("temporalSemantics", ["timeless", "effective_period", "point_in_time", "event_stream"]).notNull(), validationSchema: json("validationSchema").$type<Record<string, unknown> | null>(),
  effectiveFrom: timestamp("effectiveFrom").notNull(), effectiveTo: timestamp("effectiveTo"), createdAt: timestamp("createdAt").defaultNow().notNull(), createdBy: int("createdBy"),
}, table => ({ idProjectUnique: uniqueIndex("brand_fact_definition_versions_id_project_unique").on(table.id, table.projectId), definitionVersionUnique: uniqueIndex("brand_fact_definition_versions_definition_version_unique").on(table.definitionId, table.version), definitionProjectFk: foreignKey({ columns: [table.definitionId, table.projectId], foreignColumns: [brandFactDefinitions.id, brandFactDefinitions.projectId], name: "brand_fact_definition_versions_definition_project_fk" }) }));

export const brandFactIndustryTemplateVersions = mysqlTable("brand_fact_industry_template_versions", {
  id: varchar("id", { length: 36 }).primaryKey(), projectId: int("projectId").notNull(), industryKey: varchar("industryKey", { length: 128 }).notNull(), version: int("version").notNull(),
  name: varchar("name", { length: 255 }).notNull(), status: mysqlEnum("status", ["draft", "active", "retired"]).default("draft").notNull(), effectiveFrom: timestamp("effectiveFrom").notNull(), effectiveTo: timestamp("effectiveTo"), createdAt: timestamp("createdAt").defaultNow().notNull(), createdBy: int("createdBy"),
}, table => ({ idProjectUnique: uniqueIndex("brand_fact_industry_templates_id_project_unique").on(table.id, table.projectId), industryVersionUnique: uniqueIndex("brand_fact_industry_templates_project_industry_version_unique").on(table.projectId, table.industryKey, table.version) }));

export const brandFactIndustryTemplateItems = mysqlTable("brand_fact_industry_template_items", {
  id: int("id").autoincrement().primaryKey(), projectId: int("projectId").notNull(), templateVersionId: varchar("templateVersionId", { length: 36 }).notNull(), definitionVersionId: varchar("definitionVersionId", { length: 36 }).notNull(),
  requirementOverride: mysqlEnum("requirementOverride", ["required", "optional", "not_applicable"]), sortOrder: int("sortOrder").default(0).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ itemUnique: uniqueIndex("brand_fact_industry_template_item_unique").on(table.templateVersionId, table.definitionVersionId), templateProjectFk: foreignKey({ columns: [table.templateVersionId, table.projectId], foreignColumns: [brandFactIndustryTemplateVersions.id, brandFactIndustryTemplateVersions.projectId], name: "brand_fact_industry_items_template_project_fk" }), definitionProjectFk: foreignKey({ columns: [table.definitionVersionId, table.projectId], foreignColumns: [brandFactDefinitionVersions.id, brandFactDefinitionVersions.projectId], name: "brand_fact_industry_items_definition_project_fk" }) }));

export const understandingQuestionSetVersions = mysqlTable("understanding_question_set_versions", {
  id: varchar("id", { length: 36 }).primaryKey(), projectId: int("projectId").notNull(), questionSetKey: varchar("questionSetKey", { length: 128 }).notNull(), legacyQuestionSetId: int("legacyQuestionSetId"), version: int("version").notNull(),
  nameSnapshot: varchar("nameSnapshot", { length: 255 }).notNull(), status: mysqlEnum("status", ["draft", "active", "retired"]).default("draft").notNull(), effectiveFrom: timestamp("effectiveFrom").notNull(), effectiveTo: timestamp("effectiveTo"), createdAt: timestamp("createdAt").defaultNow().notNull(), createdBy: int("createdBy"),
}, table => ({ idProjectUnique: uniqueIndex("understanding_question_set_versions_id_project_unique").on(table.id, table.projectId), keyVersionUnique: uniqueIndex("understanding_question_set_versions_project_key_version_unique").on(table.projectId, table.questionSetKey, table.version) }));

export const understandingQuestionVersions = mysqlTable("understanding_question_versions", {
  id: varchar("id", { length: 36 }).primaryKey(), projectId: int("projectId").notNull(), questionSetVersionId: varchar("questionSetVersionId", { length: 36 }).notNull(), questionKey: varchar("questionKey", { length: 128 }).notNull(), legacyQuestionId: int("legacyQuestionId"), version: int("version").notNull(),
  questionTextSnapshot: text("questionTextSnapshot").notNull(), scenarioSnapshot: text("scenarioSnapshot"), targetAudienceSnapshot: text("targetAudienceSnapshot"), importance: mysqlEnum("importance", ["critical", "high", "medium", "low"]).notNull(), purchaseIntent: mysqlEnum("purchaseIntent", ["none", "informational", "consideration", "transactional"]).notNull(),
  effectiveFrom: timestamp("effectiveFrom").notNull(), effectiveTo: timestamp("effectiveTo"), createdAt: timestamp("createdAt").defaultNow().notNull(), createdBy: int("createdBy"),
}, table => ({ idProjectUnique: uniqueIndex("understanding_question_versions_id_project_unique").on(table.id, table.projectId), setKeyVersionUnique: uniqueIndex("understanding_question_versions_set_key_version_unique").on(table.questionSetVersionId, table.questionKey, table.version), setProjectFk: foreignKey({ columns: [table.questionSetVersionId, table.projectId], foreignColumns: [understandingQuestionSetVersions.id, understandingQuestionSetVersions.projectId], name: "understanding_question_versions_set_project_fk" }) }));

export const understandingMethodologyRegistry = mysqlTable("understanding_methodology_registry", {
  id: varchar("id", { length: 36 }).primaryKey(), projectId: int("projectId").notNull(), methodologyKey: varchar("methodologyKey", { length: 128 }).notNull(), name: varchar("name", { length: 255 }).notNull(), status: mysqlEnum("status", ["draft", "active", "retired"]).default("draft").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), createdBy: int("createdBy"),
}, table => ({ idProjectUnique: uniqueIndex("understanding_methodology_registry_id_project_unique").on(table.id, table.projectId), projectKeyUnique: uniqueIndex("understanding_methodology_registry_project_key_unique").on(table.projectId, table.methodologyKey) }));

export const understandingMethodologyVersions = mysqlTable("understanding_methodology_versions", {
  id: varchar("id", { length: 36 }).primaryKey(), projectId: int("projectId").notNull(), methodologyId: varchar("methodologyId", { length: 36 }).notNull(), version: int("version").notNull(), description: text("description"), coveragePolicy: json("coveragePolicy").$type<Record<string, unknown>>().notNull(), confidencePolicy: json("confidencePolicy").$type<Record<string, unknown>>().notNull(), effectiveFrom: timestamp("effectiveFrom").notNull(), effectiveTo: timestamp("effectiveTo"), createdAt: timestamp("createdAt").defaultNow().notNull(), createdBy: int("createdBy"),
}, table => ({ idProjectUnique: uniqueIndex("understanding_methodology_versions_id_project_unique").on(table.id, table.projectId), methodologyVersionUnique: uniqueIndex("understanding_methodology_versions_methodology_version_unique").on(table.methodologyId, table.version), registryProjectFk: foreignKey({ columns: [table.methodologyId, table.projectId], foreignColumns: [understandingMethodologyRegistry.id, understandingMethodologyRegistry.projectId], name: "understanding_methodology_versions_registry_project_fk" }) }));

export const understandingMethodologyDimensionWeights = mysqlTable("understanding_methodology_dimension_weights", {
  id: int("id").autoincrement().primaryKey(), projectId: int("projectId").notNull(), methodologyVersionId: varchar("methodologyVersionId", { length: 36 }).notNull(), dimension: mysqlEnum("dimension", ["identity", "business", "capability", "boundary", "temporal", "evidence", "consistency", "uncertainty"]).notNull(), weightBasisPoints: int("weightBasisPoints").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ dimensionUnique: uniqueIndex("understanding_methodology_dimension_unique").on(table.methodologyVersionId, table.dimension), versionProjectFk: foreignKey({ columns: [table.methodologyVersionId, table.projectId], foreignColumns: [understandingMethodologyVersions.id, understandingMethodologyVersions.projectId], name: "understanding_methodology_weights_version_project_fk" }) }));

export const understandingExtractionVersionRegistry = mysqlTable("understanding_extraction_version_registry", {
  id: varchar("id", { length: 36 }).primaryKey(), projectId: int("projectId").notNull(), extractorKey: varchar("extractorKey", { length: 128 }).notNull(), version: int("version").notNull(), implementationVersion: varchar("implementationVersion", { length: 128 }).notNull(), promptHash: varchar("promptHash", { length: 128 }).notNull(), outputSchema: json("outputSchema").$type<Record<string, unknown>>().notNull(), status: mysqlEnum("status", ["draft", "active", "retired"]).default("draft").notNull(), effectiveFrom: timestamp("effectiveFrom").notNull(), effectiveTo: timestamp("effectiveTo"), createdAt: timestamp("createdAt").defaultNow().notNull(), createdBy: int("createdBy"),
}, table => ({ idProjectUnique: uniqueIndex("understanding_extraction_versions_id_project_unique").on(table.id, table.projectId), keyVersionUnique: uniqueIndex("understanding_extraction_versions_project_key_version_unique").on(table.projectId, table.extractorKey, table.version) }));

export const understandingRuleSets = mysqlTable("understanding_rule_sets", {
  id: varchar("id", { length: 36 }).primaryKey(), projectId: int("projectId").notNull(), ruleSetKey: varchar("ruleSetKey", { length: 128 }).notNull(), name: varchar("name", { length: 255 }).notNull(), status: mysqlEnum("status", ["draft", "active", "retired"]).default("draft").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), createdBy: int("createdBy"),
}, table => ({ idProjectUnique: uniqueIndex("understanding_rule_sets_id_project_unique").on(table.id, table.projectId), projectKeyUnique: uniqueIndex("understanding_rule_sets_project_key_unique").on(table.projectId, table.ruleSetKey) }));

export const understandingRuleVersions = mysqlTable("understanding_rule_versions", {
  id: varchar("id", { length: 36 }).primaryKey(), projectId: int("projectId").notNull(), ruleSetId: varchar("ruleSetId", { length: 36 }).notNull(), ruleKey: varchar("ruleKey", { length: 128 }).notNull(), version: int("version").notNull(), severity: mysqlEnum("severity", ["P0", "P1", "P2"]).notNull(), conditionJson: json("conditionJson").$type<Record<string, unknown>>().notNull(), outcomeJson: json("outcomeJson").$type<Record<string, unknown>>().notNull(), effectiveFrom: timestamp("effectiveFrom").notNull(), effectiveTo: timestamp("effectiveTo"), createdAt: timestamp("createdAt").defaultNow().notNull(), createdBy: int("createdBy"),
}, table => ({ idProjectUnique: uniqueIndex("understanding_rule_versions_id_project_unique").on(table.id, table.projectId), setKeyVersionUnique: uniqueIndex("understanding_rule_versions_set_key_version_unique").on(table.ruleSetId, table.ruleKey, table.version), setProjectFk: foreignKey({ columns: [table.ruleSetId, table.projectId], foreignColumns: [understandingRuleSets.id, understandingRuleSets.projectId], name: "understanding_rule_versions_set_project_fk" }) }));

export const brandTruthProfileVersions = mysqlTable("brand_truth_profile_versions", {
  id: varchar("id", { length: 36 }).primaryKey(), projectId: int("projectId").notNull(), profileId: int("profileId").notNull(), version: int("version").notNull(),
  statusSnapshot: mysqlEnum("statusSnapshot", ["draft", "active", "needs_review", "archived"]).notNull(), completenessScoreSnapshot: int("completenessScoreSnapshot").notNull(),
  verifiedFactRateSnapshot: int("verifiedFactRateSnapshot").notNull(), conflictCountSnapshot: int("conflictCountSnapshot").notNull(), outdatedFactCountSnapshot: int("outdatedFactCountSnapshot").notNull(),
  lastReviewedAtSnapshot: timestamp("lastReviewedAtSnapshot"), createdAt: timestamp("createdAt").defaultNow().notNull(), createdBy: int("createdBy"),
}, table => ({
  idProjectUnique: uniqueIndex("brand_truth_profile_versions_id_project_unique").on(table.id, table.projectId),
  profileVersionUnique: uniqueIndex("brand_truth_profile_versions_profile_version_unique").on(table.profileId, table.version, table.projectId),
  profileProjectFk: foreignKey({ columns: [table.profileId, table.projectId], foreignColumns: [brandTruthProfiles.id, brandTruthProfiles.projectId], name: "brand_truth_profile_versions_profile_project_fk" }),
}));

export const brandTruthProfileVersionFacts = mysqlTable("brand_truth_profile_version_facts", {
  id: int("id").autoincrement().primaryKey(), projectId: int("projectId").notNull(), truthProfileVersionId: varchar("truthProfileVersionId", { length: 36 }).notNull(),
  factVersionId: int("factVersionId").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  membershipUnique: uniqueIndex("brand_truth_profile_version_fact_unique").on(table.truthProfileVersionId, table.factVersionId),
  profileProjectFk: foreignKey({ columns: [table.truthProfileVersionId, table.projectId], foreignColumns: [brandTruthProfileVersions.id, brandTruthProfileVersions.projectId], name: "brand_truth_profile_version_facts_profile_project_fk" }),
  factProjectFk: foreignKey({ columns: [table.factVersionId, table.projectId], foreignColumns: [brandTruthFactVersions.id, brandTruthFactVersions.projectId], name: "brand_truth_profile_version_facts_fact_project_fk" }),
}));

export const understandingAssessments = mysqlTable("understanding_assessments", {
  id: varchar("id", { length: 36 }).primaryKey(), projectId: int("projectId").notNull(), observationRunId: varchar("observationRunId", { length: 36 }), observationAnswerId: varchar("observationAnswerId", { length: 36 }), extractionId: varchar("extractionId", { length: 36 }).notNull(),
  truthProfileVersionId: varchar("truthProfileVersionId", { length: 36 }).notNull(), questionVersionId: varchar("questionVersionId", { length: 36 }).notNull(), extractionVersionId: varchar("extractionVersionId", { length: 36 }).notNull(), methodologyVersionId: varchar("methodologyVersionId", { length: 36 }).notNull(), primaryRuleVersionId: varchar("primaryRuleVersionId", { length: 36 }).notNull(),
  assessmentStatus: mysqlEnum("assessmentStatus", ["completed", "partial", "insufficient_data", "failed"]).notNull(), automaticOutcome: mysqlEnum("automaticOutcome", ["accurate", "mostly_accurate", "partially_accurate", "missing", "inaccurate", "outdated", "conflicting", "hallucinated", "unverifiable"]).notNull(), coverageBasisPoints: int("coverageBasisPoints").notNull(), confidenceBasisPoints: int("confidenceBasisPoints").notNull(), assessmentPayload: json("assessmentPayload").$type<Record<string, unknown>>().notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), createdBy: int("createdBy"),
}, table => ({
  idProjectUnique: uniqueIndex("understanding_assessments_id_project_unique").on(table.id, table.projectId),
  governanceUnique: uniqueIndex("understanding_assessments_extraction_governance_unique").on(table.extractionId, table.truthProfileVersionId, table.questionVersionId, table.extractionVersionId, table.methodologyVersionId, table.primaryRuleVersionId),
  projectCreatedIdx: index("understanding_assessments_project_created_idx").on(table.projectId, table.createdAt),
  observationExtractionProjectFk: foreignKey({ columns: [table.extractionId, table.projectId], foreignColumns: [aiObservationExtractions.id, aiObservationExtractions.projectId], name: "understanding_assessments_observation_extraction_project_fk" }),
  truthProfileVersionProjectFk: foreignKey({ columns: [table.truthProfileVersionId, table.projectId], foreignColumns: [brandTruthProfileVersions.id, brandTruthProfileVersions.projectId], name: "understanding_assessments_truth_profile_version_project_fk" }),
  questionProjectFk: foreignKey({ columns: [table.questionVersionId, table.projectId], foreignColumns: [understandingQuestionVersions.id, understandingQuestionVersions.projectId], name: "understanding_assessments_question_project_fk" }),
  extractionVersionProjectFk: foreignKey({ columns: [table.extractionVersionId, table.projectId], foreignColumns: [understandingExtractionVersionRegistry.id, understandingExtractionVersionRegistry.projectId], name: "understanding_assessments_extraction_version_project_fk" }),
  methodologyProjectFk: foreignKey({ columns: [table.methodologyVersionId, table.projectId], foreignColumns: [understandingMethodologyVersions.id, understandingMethodologyVersions.projectId], name: "understanding_assessments_methodology_project_fk" }),
  ruleProjectFk: foreignKey({ columns: [table.primaryRuleVersionId, table.projectId], foreignColumns: [understandingRuleVersions.id, understandingRuleVersions.projectId], name: "understanding_assessments_rule_project_fk" }),
}));

export const understandingAssessmentDimensionResults = mysqlTable("understanding_assessment_dimension_results", {
  id: int("id").autoincrement().primaryKey(), projectId: int("projectId").notNull(), assessmentId: varchar("assessmentId", { length: 36 }).notNull(), dimension: mysqlEnum("dimension", ["identity", "business", "capability", "boundary", "temporal", "evidence", "consistency", "uncertainty"]).notNull(), scoreBasisPoints: int("scoreBasisPoints"), coverageBasisPoints: int("coverageBasisPoints").notNull(), confidenceBasisPoints: int("confidenceBasisPoints").notNull(), resultPayload: json("resultPayload").$type<Record<string, unknown>>().notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ dimensionUnique: uniqueIndex("understanding_assessment_dimension_unique").on(table.assessmentId, table.dimension), assessmentProjectFk: foreignKey({ columns: [table.assessmentId, table.projectId], foreignColumns: [understandingAssessments.id, understandingAssessments.projectId], name: "understanding_assessment_dimensions_assessment_project_fk" }) }));

export const understandingAssessmentRuleResults = mysqlTable("understanding_assessment_rule_results", {
  id: int("id").autoincrement().primaryKey(), projectId: int("projectId").notNull(), assessmentId: varchar("assessmentId", { length: 36 }).notNull(), ruleVersionId: varchar("ruleVersionId", { length: 36 }).notNull(), matched: boolean("matched").notNull(), severity: mysqlEnum("severity", ["P0", "P1", "P2"]).notNull(), resultPayload: json("resultPayload").$type<Record<string, unknown>>().notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ ruleResultUnique: uniqueIndex("understanding_assessment_rule_result_unique").on(table.assessmentId, table.ruleVersionId), assessmentProjectFk: foreignKey({ columns: [table.assessmentId, table.projectId], foreignColumns: [understandingAssessments.id, understandingAssessments.projectId], name: "understanding_assessment_rule_results_assessment_project_fk" }), ruleProjectFk: foreignKey({ columns: [table.ruleVersionId, table.projectId], foreignColumns: [understandingRuleVersions.id, understandingRuleVersions.projectId], name: "understanding_assessment_rule_results_rule_project_fk" }) }));

export const understandingAssessmentManualReviews = mysqlTable("understanding_assessment_manual_reviews", {
  id: varchar("id", { length: 36 }).primaryKey(), projectId: int("projectId").notNull(), assessmentId: varchar("assessmentId", { length: 36 }).notNull(), action: mysqlEnum("action", ["confirmed", "rejected", "overridden"]).notNull(), overriddenOutcome: mysqlEnum("overriddenOutcome", ["accurate", "mostly_accurate", "partially_accurate", "missing", "inaccurate", "outdated", "conflicting", "hallucinated", "unverifiable"]), reason: text("reason").notNull(), evidenceSnapshot: json("evidenceSnapshot").$type<Record<string, unknown>[]>().notNull(), reviewedBy: int("reviewedBy").notNull(), reviewedAt: timestamp("reviewedAt").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ projectAssessmentIdx: index("understanding_assessment_reviews_project_assessment_idx").on(table.projectId, table.assessmentId, table.reviewedAt), assessmentProjectFk: foreignKey({ columns: [table.assessmentId, table.projectId], foreignColumns: [understandingAssessments.id, understandingAssessments.projectId], name: "understanding_assessment_reviews_assessment_project_fk" }) }));

export type UnderstandingAssessment = typeof understandingAssessments.$inferSelect;
export type UnderstandingAssessmentManualReview = typeof understandingAssessmentManualReviews.$inferSelect;
