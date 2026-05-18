// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var GEO_ARTICLE_MIN_PASS_SCORE = 60;

// server/db.ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { boolean, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
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
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var questionTypeEnum = mysqlEnum("questionType", [
  "\u54C1\u724C\u8BA4\u77E5",
  "\u884C\u4E1A\u63A8\u8350",
  "\u7ADE\u54C1\u5BF9\u6BD4",
  "\u75DB\u70B9\u89E3\u51B3",
  "\u4EF7\u683C\u9009\u578B",
  "\u9AD8\u610F\u5411\u6210\u4EA4",
  "\u6307\u5B9A\u95EE\u9898"
]);
var questionSourceEnum = mysqlEnum("source", ["ai_generated", "manual", "csv"]);
var aiPlatformEnum = mysqlEnum("aiPlatform", [
  "ChatGPT",
  "DeepSeek",
  "\u8C46\u5305",
  "Kimi",
  "\u901A\u4E49",
  "\u6587\u5FC3",
  "Perplexity",
  "\u5176\u4ED6"
]);
var projectStatusEnum = mysqlEnum("status", [
  "created",
  "questions_ready",
  "responses_imported",
  "analysis_done",
  "score_done",
  "tasks_ready",
  "report_ready"
]);
var visibilityLevelEnum = mysqlEnum("visibilityLevel", [
  "\u5F31\u53EF\u89C1",
  "\u521D\u6B65\u53EF\u89C1",
  "\u826F\u597D\u53EF\u89C1",
  "\u5F3A\u52BF\u63A8\u8350"
]);
var taskTypeEnum = mysqlEnum("taskType", [
  "\u5B98\u7F51\u9996\u9875",
  "\u4EA7\u54C1\u9875",
  "\u7ADE\u54C1\u5BF9\u6BD4\u9875",
  "FAQ",
  "\u5BA2\u6237\u6848\u4F8B",
  "\u884C\u4E1A\u6587\u7AE0",
  "\u793E\u5A92\u5185\u5BB9"
]);
var taskPriorityEnum = mysqlEnum("taskPriority", ["P0", "P1", "P2"]);
var taskStatusEnum = mysqlEnum("status", ["todo", "doing", "done", "retest"]);
var templateTypeEnum = mysqlEnum("templateType", [
  "\u5B98\u7F51\u9996\u9875\u6A21\u677F",
  "FAQ \u6A21\u677F",
  "\u7ADE\u54C1\u5BF9\u6BD4\u9875\u6A21\u677F",
  "\u5BA2\u6237\u6848\u4F8B\u9875\u6A21\u677F",
  "\u884C\u4E1A\u9009\u578B\u6587\u7AE0\u6A21\u677F"
]);
var articleTypeEnum = mysqlEnum("articleType", [
  "\u5B98\u7F51\u7248 GEO \u6587\u7AE0",
  "\u95EE\u7B54\u578B GEO \u6587\u7AE0",
  "\u7ADE\u54C1\u5BF9\u6BD4\u578B GEO \u6587\u7AE0",
  "\u884C\u4E1A\u9009\u578B\u578B GEO \u6587\u7AE0"
]);
var articleStatusEnum = mysqlEnum("status", [
  "\u5F85\u751F\u6210",
  "\u5DF2\u751F\u6210",
  "\u5F85\u8D28\u68C0",
  "\u8D28\u68C0\u901A\u8FC7",
  "\u5F85\u5BA1\u6838",
  "\u5BA1\u6838\u901A\u8FC7",
  "\u5DF2\u53D1\u5E03",
  "\u5F85\u590D\u6D4B",
  "\u8D28\u68C0\u672A\u901A\u8FC7",
  "\u9700\u4EBA\u5DE5\u5BA1\u6838",
  "\u5BA1\u6838\u672A\u901A\u8FC7"
]);
var publishChannelEnum = mysqlEnum("publishChannel", [
  "\u7CFB\u7EDF\u5185\u7F6E GEO \u5185\u5BB9\u9875",
  "\u81EA\u6709\u5185\u5BB9\u7AD9 / \u4F01\u4E1A\u5B98\u7F51 GEO \u9875\u9762",
  "\u5FAE\u4FE1\u516C\u4F17\u53F7",
  "\u77E5\u4E4E",
  "\u767E\u5BB6\u53F7",
  "\u5934\u6761\u53F7",
  "\u5C0F\u7EA2\u4E66",
  "\u641C\u72D0\u53F7",
  "\u7F51\u6613\u53F7",
  "CSDN / \u6398\u91D1"
]);
var inclusionMonitorStatusEnum = mysqlEnum("inclusionMonitorStatus", ["\u672A\u68C0\u6D4B", "\u68C0\u6D4B\u4E2D", "\u5DF2\u6536\u5F55", "\u672A\u6536\u5F55", "\u68C0\u6D4B\u5931\u8D25"]);
var aiMentionMonitorStatusEnum = mysqlEnum("aiMentionMonitorStatus", ["\u672A\u68C0\u6D4B", "\u68C0\u6D4B\u4E2D", "\u5DF2\u63D0\u53CA", "\u672A\u63D0\u53CA", "\u68C0\u6D4B\u5931\u8D25"]);
var aiRecommendMonitorStatusEnum = mysqlEnum("aiRecommendMonitorStatus", ["\u672A\u68C0\u6D4B", "\u68C0\u6D4B\u4E2D", "\u5DF2\u63A8\u8350", "\u672A\u63A8\u8350", "\u68C0\u6D4B\u5931\u8D25"]);
var geoAssetSourceTypeEnum = mysqlEnum("sourceType", [
  "\u4F01\u4E1A\u57FA\u7840\u8D44\u6599",
  "\u4EA7\u54C1\u670D\u52A1\u8D44\u6599",
  "\u5BA2\u6237\u6848\u4F8B\u8D44\u6599",
  "\u7ADE\u54C1\u8D44\u6599",
  "\u5408\u89C4\u8D44\u6599",
  "\u5185\u5BB9\u98CE\u683C\u8D44\u6599",
  "\u53D1\u5E03\u7B56\u7565\u8D44\u6599",
  "\u901A\u7528\u8D44\u6599"
]);
var geoAssetInputModeEnum = mysqlEnum("inputMode", ["\u6587\u4EF6\u4E0A\u4F20", "\u6587\u672C\u7C98\u8D34", "\u4EBA\u5DE5\u5F55\u5165"]);
var geoAssetTrustLevelEnum = mysqlEnum("trustLevel", ["\u9AD8", "\u4E2D", "\u4F4E"]);
var geoAssetParseStatusEnum = mysqlEnum("parseStatus", ["\u5F85\u89E3\u6790", "\u5DF2\u89E3\u6790", "\u89E3\u6790\u5931\u8D25", "\u4EBA\u5DE5\u786E\u8BA4"]);
var customerCaseTypeEnum = mysqlEnum("caseType", ["\u771F\u5B9E\u6848\u4F8B", "\u5F85\u8865\u5145\u6848\u4F8B\u7EBF\u7D22"]);
var customerCaseVerificationStatusEnum = mysqlEnum("verificationStatus", ["\u5F85\u786E\u8BA4", "\u5DF2\u786E\u8BA4", "\u4E0D\u53EF\u516C\u5F00", "\u4FE1\u606F\u4E0D\u8DB3"]);
var publishReviewModeEnum = mysqlEnum("reviewMode", ["\u5168\u4EBA\u5DE5\u5BA1\u6838", "\u9AD8\u5206\u81EA\u52A8\u53D1\u5E03", "\u5168\u81EA\u52A8\u53D1\u5E03"]);
var platformAuthorizationStatusEnum = mysqlEnum("authorizationStatus", ["\u672A\u914D\u7F6E", "\u5F85\u4EBA\u5DE5\u6388\u6743", "\u5DF2\u6388\u6743", "\u5DF2\u5931\u6548", "\u65E0\u9700\u6388\u6743"]);
var projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  enterpriseName: varchar("enterpriseName", { length: 255 }).notNull(),
  industry: varchar("industry", { length: 255 }).notNull(),
  website: varchar("website", { length: 500 }).notNull(),
  region: varchar("region", { length: 255 }).notNull(),
  productIntro: text("productIntro").notNull(),
  targetCustomers: text("targetCustomers").notNull(),
  coreSellingPoints: text("coreSellingPoints").notNull(),
  competitorNames: json("competitorNames").$type().notNull(),
  coreKeywords: json("coreKeywords").$type().notNull(),
  status: projectStatusEnum.default("created").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var questions = mysqlTable("questions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  questionText: text("questionText").notNull(),
  questionType: questionTypeEnum.notNull(),
  targetKeyword: varchar("targetKeyword", { length: 255 }),
  intentLevel: varchar("intentLevel", { length: 64 }).default("\u4E2D").notNull(),
  businessValue: int("businessValue").default(3).notNull(),
  source: questionSourceEnum.default("ai_generated").notNull(),
  enabled: int("enabled").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var aiResponses = mysqlTable("ai_responses", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  questionId: int("questionId"),
  questionText: text("questionText").notNull(),
  aiPlatform: aiPlatformEnum.notNull(),
  rawAnswer: text("rawAnswer").notNull(),
  checkedAt: timestamp("checkedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var analysisResults = mysqlTable("analysis_results", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  aiResponseId: int("aiResponseId").notNull(),
  mentionsEnterprise: int("mentionsEnterprise").default(0).notNull(),
  recommendsEnterprise: int("recommendsEnterprise").default(0).notNull(),
  mentionsCompetitors: int("mentionsCompetitors").default(0).notNull(),
  recommendedCompetitors: json("recommendedCompetitors").$type().notNull(),
  enterpriseWins: int("enterpriseWins").default(0).notNull(),
  recommendationReason: text("recommendationReason"),
  notRecommendedReason: text("notRecommendedReason"),
  hasMisconception: int("hasMisconception").default(0).notNull(),
  contentGap: text("contentGap"),
  optimizationSuggestion: text("optimizationSuggestion"),
  rawJson: json("rawJson").$type().notNull(),
  manualOverrideJson: json("manual_override_json").$type(),
  manuallyReviewed: int("manually_reviewed").default(0).notNull(),
  reviewedAt: timestamp("reviewed_at"),
  reviewNote: text("review_note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var geoScores = mysqlTable("geo_scores", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  aiVisibilityScore: int("aiVisibilityScore").default(0).notNull(),
  aiRecommendationScore: int("aiRecommendationScore").default(0).notNull(),
  competitorWinScore: int("competitorWinScore").default(0).notNull(),
  cognitionAccuracyScore: int("cognitionAccuracyScore").default(0).notNull(),
  contentAssetScore: int("contentAssetScore").default(0).notNull(),
  totalScore: int("totalScore").default(0).notNull(),
  visibilityLevel: visibilityLevelEnum.notNull(),
  calculationDetail: json("calculationDetail").$type().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var optimizationTasks = mysqlTable("optimization_tasks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  taskType: taskTypeEnum.notNull(),
  taskName: varchar("taskName", { length: 255 }).notNull(),
  priority: taskPriorityEnum.notNull(),
  generationReason: text("generationReason").notNull(),
  executionSuggestion: text("executionSuggestion").notNull(),
  expectedImpact: text("expectedImpact").notNull(),
  status: taskStatusEnum.default("todo").notNull(),
  publishedUrl: varchar("published_url", { length: 1e3 }),
  completedAt: timestamp("completed_at"),
  needRetest: int("need_retest").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var contentTemplates = mysqlTable("content_templates", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  optimizationTaskId: int("optimization_task_id"),
  templateType: templateTypeEnum.notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  markdownContent: text("markdownContent").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var reports = mysqlTable("reports", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var geoArticleTopics = mysqlTable("geo_article_topics", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  optimizationTaskId: int("optimizationTaskId"),
  sourceAnalysisIds: json("sourceAnalysisIds").$type().notNull(),
  sourceQuestionIds: json("sourceQuestionIds").$type().notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  articleType: articleTypeEnum.notNull(),
  contentGap: text("contentGap").notNull(),
  businessReason: text("businessReason").notNull(),
  status: articleStatusEnum.default("\u5F85\u751F\u6210").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var geoArticles = mysqlTable("geo_articles", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  topicId: int("topicId").notNull(),
  optimizationTaskId: int("optimizationTaskId"),
  title: varchar("title", { length: 255 }).notNull(),
  articleType: articleTypeEnum.notNull(),
  markdownContent: text("markdownContent").notNull(),
  generationBasis: json("generationBasis").$type(),
  citableSnippets: json("citableSnippets").$type(),
  geoStructure: json("geoStructure").$type(),
  thirdPartyMaterials: json("thirdPartyMaterials").$type().notNull(),
  factTraceability: json("factTraceability").$type(),
  consistencyCheck: json("consistencyCheck").$type(),
  optimizationVersions: json("optimizationVersions").$type(),
  status: articleStatusEnum.default("\u5F85\u8D28\u68C0").notNull(),
  publicPath: varchar("publicPath", { length: 1e3 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var contentPlans = mysqlTable("content_plans", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  planName: varchar("planName", { length: 255 }).notNull(),
  weekStartDate: varchar("weekStartDate", { length: 32 }).notNull(),
  weeklyArticleCount: int("weeklyArticleCount").default(3).notNull(),
  targetPlatforms: json("targetPlatforms").$type().notNull(),
  contentTypes: json("contentTypes").$type().notNull(),
  linkedOptimizationTaskIds: json("linkedOptimizationTaskIds").$type().notNull(),
  status: varchar("status", { length: 64 }).default("\u5DF2\u914D\u7F6E").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var contentPlanItems = mysqlTable("content_plan_items", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull(),
  topicId: int("topicId"),
  articleId: int("articleId"),
  targetPlatform: varchar("targetPlatform", { length: 255 }).notNull(),
  contentType: varchar("contentType", { length: 255 }).notNull(),
  status: varchar("status", { length: 64 }).default("\u5F85\u751F\u6210").notNull(),
  differentiationAngle: text("differentiationAngle"),
  duplicateRisk: varchar("duplicateRisk", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var geoArticleQualityScores = mysqlTable("geo_article_quality_scores", {
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
  blockReasons: json("blockReasons").$type().notNull(),
  reviewSummary: text("reviewSummary").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var geoPublishRecords = mysqlTable("geo_publish_records", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  articleId: int("articleId").notNull(),
  optimizationTaskId: int("optimizationTaskId"),
  publishChannel: publishChannelEnum.notNull(),
  publishTitle: varchar("publishTitle", { length: 500 }),
  publishUrl: varchar("publishUrl", { length: 1e3 }).notNull(),
  publishStatus: varchar("publishStatus", { length: 64 }).default("\u5DF2\u53D1\u5E03").notNull(),
  qualityScore: int("qualityScore").default(0).notNull(),
  needRetest: int("needRetest").default(1).notNull(),
  notes: text("notes"),
  publishedAt: timestamp("publishedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var geoInclusionMonitoringRecords = mysqlTable("geo_inclusion_monitoring_records", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  articleId: int("articleId").notNull(),
  publishRecordId: int("publishRecordId").notNull(),
  publicUrl: varchar("publicUrl", { length: 1e3 }).notNull(),
  inclusionStatus: inclusionMonitorStatusEnum.default("\u672A\u68C0\u6D4B").notNull(),
  aiMentionStatus: aiMentionMonitorStatusEnum.default("\u672A\u68C0\u6D4B").notNull(),
  aiRecommendStatus: aiRecommendMonitorStatusEnum.default("\u672A\u68C0\u6D4B").notNull(),
  lastCheckedAt: timestamp("lastCheckedAt"),
  currentSuggestion: text("currentSuggestion").notNull(),
  optimizationSuggestions: json("optimizationSuggestions").$type().notNull(),
  rawJson: json("rawJson").$type().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var enterpriseGeoProfiles = mysqlTable("enterprise_geo_profiles", {
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
  salesChannels: json("salesChannels").$type().notNull(),
  commonQuestions: json("commonQuestions").$type().notNull(),
  purchaseDecisionFactors: json("purchaseDecisionFactors").$type().notNull(),
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
  customerPains: json("customerPains").$type(),
  competitors: json("competitors").$type(),
  hasCases: boolean("hasCases"),
  oneLiner: text("oneLiner"),
  keyPoints: json("keyPoints").$type(),
  keywords: json("keywords").$type(),
  completionScore: int("completionScore").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var geoAssetSources = mysqlTable("geo_asset_sources", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  sourceType: geoAssetSourceTypeEnum.notNull(),
  inputMode: geoAssetInputModeEnum.notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  originalFileName: varchar("originalFileName", { length: 500 }),
  fileKey: varchar("fileKey", { length: 1e3 }),
  fileUrl: varchar("fileUrl", { length: 1e3 }),
  mimeType: varchar("mimeType", { length: 255 }),
  contentDigest: text("contentDigest"),
  structuredSummary: json("structuredSummary").$type().notNull(),
  trustLevel: geoAssetTrustLevelEnum.default("\u4E2D").notNull(),
  parseStatus: geoAssetParseStatusEnum.default("\u5F85\u89E3\u6790").notNull(),
  isPublic: int("isPublic").default(0).notNull(),
  canUseForGeneration: int("canUseForGeneration").default(0).notNull(),
  manuallyConfirmed: int("manuallyConfirmed").default(0).notNull(),
  parsedAt: timestamp("parsedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var customerCases = mysqlTable("customer_cases", {
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
  sourceAssetIds: json("sourceAssetIds").$type().notNull(),
  verificationStatus: customerCaseVerificationStatusEnum.default("\u5F85\u786E\u8BA4").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var competitorProfiles = mysqlTable("competitor_profiles", {
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
  sourceAssetIds: json("sourceAssetIds").$type().notNull(),
  canReference: int("canReference").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var complianceRules = mysqlTable("compliance_rules", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  ruleName: varchar("ruleName", { length: 255 }).notNull(),
  forbiddenClaims: text("forbiddenClaims"),
  forbiddenWords: json("forbiddenWords").$type().notNull(),
  requiredDisclaimers: text("requiredDisclaimers"),
  dataUsageRules: text("dataUsageRules"),
  caseUsageRules: text("caseUsageRules"),
  priceUsageRules: text("priceUsageRules"),
  competitorMentionRules: text("competitorMentionRules"),
  reviewRequiredTopics: json("reviewRequiredTopics").$type().notNull(),
  enabled: int("enabled").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var contentStyleProfiles = mysqlTable("content_style_profiles", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  profileName: varchar("profileName", { length: 255 }).notNull(),
  tone: varchar("tone", { length: 255 }).notNull(),
  writingStyle: text("writingStyle"),
  terminology: json("terminology").$type().notNull(),
  forbiddenTone: text("forbiddenTone"),
  exampleTitles: json("exampleTitles").$type().notNull(),
  exampleParagraphs: json("exampleParagraphs").$type().notNull(),
  targetReader: text("targetReader"),
  preferredLength: varchar("preferredLength", { length: 255 }),
  ctaStyle: text("ctaStyle"),
  enabled: int("enabled").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var publishStrategies = mysqlTable("publish_strategies", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  strategyName: varchar("strategyName", { length: 255 }).notNull(),
  reviewMode: publishReviewModeEnum.default("\u5168\u4EBA\u5DE5\u5BA1\u6838").notNull(),
  dailyLimit: int("dailyLimit"),
  minQualityScore: int("minQualityScore").default(80).notNull(),
  preferredPlatforms: json("preferredPlatforms").$type().notNull(),
  bannedPlatforms: json("bannedPlatforms").$type().notNull(),
  platformNotes: text("platformNotes"),
  enabled: int("enabled").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var publishTasks = mysqlTable("publish_tasks", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var platformAuthorizationConfigs = mysqlTable("platform_authorization_configs", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  platformName: varchar("platformName", { length: 255 }).notNull(),
  accountAlias: varchar("accountAlias", { length: 255 }),
  authorizationStatus: platformAuthorizationStatusEnum.default("\u672A\u914D\u7F6E").notNull(),
  credentialStorageMode: varchar("credentialStorageMode", { length: 255 }).default("\u4E0D\u4FDD\u5B58\u660E\u6587\u51ED\u8BC1").notNull(),
  secureCredentialRef: varchar("secureCredentialRef", { length: 500 }),
  authorizationNotes: text("authorizationNotes"),
  authorizedAt: timestamp("authorizedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params["0"];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/routers.ts
import { TRPCError as TRPCError5 } from "@trpc/server";
import { and as and2, asc, desc as desc3, eq as eq4, inArray, like, not } from "drizzle-orm";
import { z as z3 } from "zod";

// server/_core/llm.ts
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { connect as tlsConnect } from "node:tls";
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var resolveManusApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
var assertManusApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }
};
var resolveOpenAIBaseUrl = () => (process.env.OPENAI_BASE_URL ?? "https://api.openai.com").replace(/\/+$/, "");
var resolveOpenAIChatCompletionsPath = () => {
  const path3 = process.env.OPENAI_CHAT_COMPLETIONS_PATH ?? "/chat/completions";
  return path3.startsWith("/") ? path3 : `/${path3}`;
};
var resolveOpenAIApiUrl = () => {
  const baseUrl = resolveOpenAIBaseUrl();
  if (baseUrl.endsWith("/chat/completions")) return baseUrl;
  const chatCompletionsPath = resolveOpenAIChatCompletionsPath();
  if (baseUrl.endsWith("/v1") || baseUrl.endsWith("/api/v3")) return `${baseUrl}${chatCompletionsPath}`;
  return `${baseUrl}/v1${chatCompletionsPath}`;
};
var resolveOpenAITimeoutMs = () => {
  const raw = Number(process.env.OPENAI_TIMEOUT_MS ?? 6e4);
  return Number.isFinite(raw) && raw > 0 ? raw : 6e4;
};
var proxyEnv = () => {
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
  const allProxy = process.env.ALL_PROXY || process.env.all_proxy;
  return {
    httpsProxy,
    httpProxy,
    allProxy,
    proxyUrl: httpsProxy || httpProxy || allProxy,
    detected: {
      HTTPS_PROXY: Boolean(httpsProxy),
      HTTP_PROXY: Boolean(httpProxy),
      ALL_PROXY: Boolean(allProxy)
    }
  };
};
var proxyAuthorizationHeader = (proxyUrl) => {
  if (!proxyUrl.username && !proxyUrl.password) return void 0;
  const credentials = `${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
};
var assertOpenAIApiKey = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
var buildCommonPayload = (params) => {
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    maxTokens,
    max_tokens,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  payload.max_tokens = max_tokens ?? maxTokens ?? 32768;
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  return payload;
};
var normalizeOpenAIResult = (result) => ({
  id: result.id,
  created: result.created,
  model: result.model,
  choices: result.choices.map((choice) => ({
    index: choice.index,
    message: {
      role: choice.message.role,
      content: choice.message.content ?? "",
      ...choice.message.tool_calls ? { tool_calls: choice.message.tool_calls } : {}
    },
    finish_reason: choice.finish_reason
  })),
  ...result.usage ? { usage: result.usage } : {}
});
function openAIErrorContext(input) {
  const { detected } = proxyEnv();
  const original = input.originalError;
  const originalCode = original?.code ?? original?.cause?.code ?? "unknown";
  const originalMessage = original?.message ?? String(input.originalError ?? "");
  return `provider=openai baseURL=${input.baseUrl} requestURL=${input.requestURL} model=${input.model} timeoutMs=${input.timeoutMs} proxyDetected=${JSON.stringify(detected)} originalCode=${originalCode}${originalMessage ? ` originalMessage=${originalMessage}` : ""}`;
}
function requestOpenAIThroughProxy(input) {
  return new Promise((resolve, reject) => {
    const targetUrl = new URL(input.apiUrl);
    const proxyUrl = new URL(input.proxyUrl);
    const proxyRequest = proxyUrl.protocol === "https:" ? httpsRequest : httpRequest;
    if (targetUrl.protocol !== "https:") {
      reject(new Error(`OpenAI proxy mode only supports https targets, got ${targetUrl.protocol}`));
      return;
    }
    if (proxyUrl.protocol !== "http:" && proxyUrl.protocol !== "https:") {
      reject(new Error(`Unsupported proxy protocol: ${proxyUrl.protocol}`));
      return;
    }
    const targetPort = targetUrl.port ? Number(targetUrl.port) : 443;
    const proxyPort = proxyUrl.port ? Number(proxyUrl.port) : proxyUrl.protocol === "https:" ? 443 : 80;
    const authHeader = proxyAuthorizationHeader(proxyUrl);
    const connectReq = proxyRequest({
      hostname: proxyUrl.hostname,
      port: proxyPort,
      method: "CONNECT",
      path: `${targetUrl.hostname}:${targetPort}`,
      headers: {
        Host: `${targetUrl.hostname}:${targetPort}`,
        ...authHeader ? { "Proxy-Authorization": authHeader } : {}
      },
      timeout: input.timeoutMs
    });
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      connectReq.destroy();
      reject(error);
    };
    const timer = setTimeout(() => {
      fail(Object.assign(new Error(`OpenAI request timed out after ${input.timeoutMs}ms`), { code: "OPENAI_TIMEOUT" }));
    }, input.timeoutMs);
    connectReq.on("connect", (res, socket) => {
      if (res.statusCode !== 200) {
        clearTimeout(timer);
        fail(Object.assign(new Error(`Proxy CONNECT failed with status ${res.statusCode}`), { code: "PROXY_CONNECT_FAILED" }));
        return;
      }
      const secureSocket = tlsConnect({
        socket,
        servername: targetUrl.hostname
      }, () => {
        const body = JSON.stringify(input.payload);
        const path3 = `${targetUrl.pathname}${targetUrl.search}`;
        const headers = {
          ...input.headers,
          Host: targetUrl.host,
          "Content-Length": Buffer.byteLength(body).toString(),
          Connection: "close"
        };
        const headerText = Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join("\r\n");
        secureSocket.write(`POST ${path3} HTTP/1.1\r
${headerText}\r
\r
${body}`);
      });
      const chunks = [];
      secureSocket.setTimeout(input.timeoutMs, () => {
        secureSocket.destroy(Object.assign(new Error(`OpenAI request timed out after ${input.timeoutMs}ms`), { code: "OPENAI_TIMEOUT" }));
      });
      secureSocket.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      secureSocket.on("error", fail);
      secureSocket.on("end", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const raw = Buffer.concat(chunks).toString("utf8");
        const separator = raw.indexOf("\r\n\r\n");
        const header = separator >= 0 ? raw.slice(0, separator) : raw;
        const body = separator >= 0 ? raw.slice(separator + 4) : "";
        const [statusLine] = header.split("\r\n");
        const match = /^HTTP\/\d(?:\.\d)?\s+(\d+)\s*(.*)$/.exec(statusLine ?? "");
        resolve({
          status: match ? Number(match[1]) : 0,
          statusText: match?.[2] ?? "",
          body
        });
      });
    });
    connectReq.on("timeout", () => {
      fail(Object.assign(new Error(`OpenAI request timed out after ${input.timeoutMs}ms`), { code: "OPENAI_TIMEOUT" }));
    });
    connectReq.on("error", fail);
    connectReq.end();
  });
}
function requestOpenAIDirect(input) {
  return new Promise((resolve, reject) => {
    const targetUrl = new URL(input.apiUrl);
    const body = JSON.stringify(input.payload);
    const requestImpl = targetUrl.protocol === "https:" ? httpsRequest : httpRequest;
    const req = requestImpl({
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port ? Number(targetUrl.port) : targetUrl.protocol === "https:" ? 443 : 80,
      method: "POST",
      path: `${targetUrl.pathname}${targetUrl.search}`,
      headers: {
        ...input.headers,
        "Content-Length": Buffer.byteLength(body).toString()
      },
      timeout: input.timeoutMs
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.on("end", () => {
        resolve({
          status: response.statusCode ?? 0,
          statusText: response.statusMessage ?? "",
          body: Buffer.concat(chunks).toString("utf8")
        });
      });
    });
    const timer = setTimeout(() => {
      req.destroy(Object.assign(new Error(`OpenAI request timed out after ${input.timeoutMs}ms`), { code: "OPENAI_TIMEOUT" }));
    }, input.timeoutMs);
    req.on("timeout", () => {
      req.destroy(Object.assign(new Error(`OpenAI request timed out after ${input.timeoutMs}ms`), { code: "OPENAI_TIMEOUT" }));
    });
    req.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    req.on("close", () => {
      clearTimeout(timer);
    });
    req.write(body);
    req.end();
  });
}
async function requestOpenAI(input) {
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${process.env.OPENAI_API_KEY}`
  };
  const { proxyUrl } = proxyEnv();
  if (proxyUrl) {
    return requestOpenAIThroughProxy({
      apiUrl: input.apiUrl,
      proxyUrl,
      payload: input.payload,
      headers,
      timeoutMs: input.timeoutMs
    });
  }
  return requestOpenAIDirect({
    apiUrl: input.apiUrl,
    payload: input.payload,
    headers,
    timeoutMs: input.timeoutMs
  });
}
async function invokeManusForge(params) {
  assertManusApiKey();
  const timeoutMs = params.timeoutMs ?? params.timeout_ms ?? resolveOpenAITimeoutMs();
  const controller = new AbortController();
  const killTimer = setTimeout(() => controller.abort(), timeoutMs);
  const payload = {
    model: "gemini-2.5-flash",
    ...buildCommonPayload(params),
    thinking: {
      budget_tokens: 128
    }
  };
  let response;
  try {
    response = await fetch(resolveManusApiUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`LLM invoke timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(killTimer);
  }
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}
async function invokeOpenAI(params) {
  assertOpenAIApiKey();
  const baseUrl = resolveOpenAIBaseUrl();
  const apiUrl = resolveOpenAIApiUrl();
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const timeoutMs = params.timeoutMs ?? params.timeout_ms ?? resolveOpenAITimeoutMs();
  const payload = {
    model,
    ...buildCommonPayload(params)
  };
  let response;
  try {
    response = await requestOpenAI({ apiUrl, payload, model, timeoutMs });
  } catch (error) {
    throw new Error(`OpenAI LLM network failure: ${openAIErrorContext({ baseUrl, requestURL: apiUrl, model, timeoutMs, originalError: error })}`);
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `OpenAI LLM invoke failed: ${openAIErrorContext({ baseUrl, requestURL: apiUrl, model, timeoutMs })} status=${response.status} ${response.statusText} \u2013 ${response.body}`
    );
  }
  return normalizeOpenAIResult(JSON.parse(response.body));
}
async function invokeLLM(params) {
  const provider = process.env.LLM_PROVIDER ?? "openai";
  if (provider === "openai") {
    return invokeOpenAI(params);
  }
  return invokeManusForge(params);
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/publishTasksRouter.ts
import { randomUUID } from "node:crypto";
import { TRPCError as TRPCError3 } from "@trpc/server";
import { and, desc, eq as eq2 } from "drizzle-orm";
import { z as z2 } from "zod";
var publishPlatformSlugEnum = z2.enum(["zhihu", "toutiao", "sohu", "baijiahao", "wechat"]);
var PLATFORM_TO_PUBLISH_CHANNEL = {
  zhihu: "\u77E5\u4E4E",
  toutiao: "\u5934\u6761\u53F7",
  sohu: "\u641C\u72D0\u53F7",
  baijiahao: "\u767E\u5BB6\u53F7",
  wechat: "\u5FAE\u4FE1\u516C\u4F17\u53F7"
};
async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "\u6570\u636E\u5E93\u4E0D\u53EF\u7528" });
  return db;
}
async function ensureUserExtensionApiKey(userId) {
  const db = await requireDb();
  const rows = await db.select({ id: users.id, extensionApiKey: users.extensionApiKey }).from(users).where(eq2(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) throw new TRPCError3({ code: "NOT_FOUND", message: "\u7528\u6237\u4E0D\u5B58\u5728" });
  if (user.extensionApiKey) return user.extensionApiKey;
  const apiKey = randomUUID().replace(/-/g, "");
  await db.update(users).set({ extensionApiKey: apiKey }).where(eq2(users.id, userId));
  return apiKey;
}
async function assertApiKeyUser(apiKey) {
  const db = await requireDb();
  const rows = await db.select().from(users).where(eq2(users.extensionApiKey, apiKey)).limit(1);
  if (!rows[0]) throw new TRPCError3({ code: "UNAUTHORIZED", message: "\u65E0\u6548\u7684 API \u5BC6\u94A5" });
  return rows[0];
}
var publishTasksRouter = router({
  create: protectedProcedure.input(
    z2.object({
      articleId: z2.number().int().positive(),
      platform: publishPlatformSlugEnum,
      projectId: z2.number().int().positive()
    })
  ).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const articleRows = await db.select().from(geoArticles).where(eq2(geoArticles.id, input.articleId)).limit(1);
    const article = articleRows[0];
    if (!article || article.projectId !== input.projectId) {
      throw new TRPCError3({ code: "NOT_FOUND", message: "\u672A\u627E\u5230\u5C5E\u4E8E\u5F53\u524D\u9879\u76EE\u7684\u5185\u5BB9" });
    }
    const apiKey = await ensureUserExtensionApiKey(ctx.user.id);
    const inserted = await db.insert(publishTasks).values({
      projectId: input.projectId,
      articleId: input.articleId,
      platform: input.platform,
      status: "pending",
      articleTitle: article.title,
      articleContent: article.markdownContent ?? "",
      apiKey
    }).$returningId();
    return { taskId: inserted[0]?.id ?? 0 };
  }),
  pending: publicProcedure.input(z2.object({ apiKey: z2.string().min(8).max(100) })).query(async ({ input }) => {
    await assertApiKeyUser(input.apiKey);
    const db = await requireDb();
    const rows = await db.select({
      id: publishTasks.id,
      platform: publishTasks.platform,
      articleTitle: publishTasks.articleTitle,
      articleContent: publishTasks.articleContent
    }).from(publishTasks).where(and(eq2(publishTasks.apiKey, input.apiKey), eq2(publishTasks.status, "pending")));
    return { tasks: rows };
  }),
  complete: publicProcedure.input(
    z2.object({
      taskId: z2.number().int().positive(),
      apiKey: z2.string().min(8).max(100),
      status: z2.enum(["processing", "completed", "failed"]),
      resultUrl: z2.string().max(500).optional(),
      errorMessage: z2.string().optional()
    })
  ).mutation(async ({ input }) => {
    await assertApiKeyUser(input.apiKey);
    const db = await requireDb();
    const taskRows = await db.select().from(publishTasks).where(eq2(publishTasks.id, input.taskId)).limit(1);
    const task = taskRows[0];
    if (!task || task.apiKey !== input.apiKey) {
      throw new TRPCError3({ code: "NOT_FOUND", message: "\u53D1\u5E03\u4EFB\u52A1\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u64CD\u4F5C" });
    }
    await db.update(publishTasks).set({
      status: input.status,
      resultUrl: input.resultUrl ?? null,
      errorMessage: input.errorMessage ?? null
    }).where(eq2(publishTasks.id, input.taskId));
    if (input.status === "completed" && input.resultUrl?.trim()) {
      const articleRows = await db.select().from(geoArticles).where(eq2(geoArticles.id, task.articleId)).limit(1);
      const article = articleRows[0];
      if (article) {
        const scoreRows = await db.select().from(geoArticleQualityScores).where(eq2(geoArticleQualityScores.articleId, article.id)).orderBy(desc(geoArticleQualityScores.createdAt)).limit(1);
        const latestScore = scoreRows[0];
        const channel = PLATFORM_TO_PUBLISH_CHANNEL[task.platform];
        if (channel) {
          await db.insert(geoPublishRecords).values({
            projectId: task.projectId,
            articleId: task.articleId,
            optimizationTaskId: article.optimizationTaskId,
            publishChannel: channel,
            publishTitle: task.articleTitle,
            publishUrl: input.resultUrl.trim(),
            publishStatus: "\u5DF2\u53D1\u5E03",
            qualityScore: latestScore?.totalScore ?? GEO_ARTICLE_MIN_PASS_SCORE,
            needRetest: 1,
            notes: "\u6D4F\u89C8\u5668\u63D2\u4EF6\u81EA\u52A8\u53D1\u5E03\u5B8C\u6210"
          });
          await db.update(geoArticles).set({ status: "\u5DF2\u53D1\u5E03" }).where(eq2(geoArticles.id, article.id));
        }
      }
    }
    return { ok: true };
  }),
  getApiKey: protectedProcedure.query(async ({ ctx }) => {
    const apiKey = await ensureUserExtensionApiKey(ctx.user.id);
    return { apiKey };
  })
});

// server/geoLogic.ts
var generatedQuestionTypes = ["\u54C1\u724C\u8BA4\u77E5", "\u884C\u4E1A\u63A8\u8350", "\u7ADE\u54C1\u5BF9\u6BD4", "\u75DB\u70B9\u89E3\u51B3", "\u4EF7\u683C\u9009\u578B", "\u9AD8\u610F\u5411\u6210\u4EA4"];
var questionTypes = [...generatedQuestionTypes, "\u6307\u5B9A\u95EE\u9898"];
var questionSources = ["ai_generated", "manual", "csv"];
var aiPlatforms = ["ChatGPT", "DeepSeek", "\u8C46\u5305", "Kimi", "\u901A\u4E49", "\u6587\u5FC3", "Perplexity", "\u5176\u4ED6"];
var projectStatuses = ["created", "questions_ready", "responses_imported", "analysis_done", "score_done", "tasks_ready", "report_ready"];
var taskStatuses = ["todo", "doing", "done", "retest"];
var toFlag = (value, fallback) => {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value === 1 ? 1 : 0;
  return fallback;
};
var toNullableText = (value, fallback) => typeof value === "string" ? value : fallback ?? null;
var toStringList = (value, fallback) => Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : fallback;
function resolveEffectiveAnalysisResult(analysis) {
  if (!analysis.manuallyReviewed || !analysis.manualOverrideJson || typeof analysis.manualOverrideJson !== "object") return analysis;
  const override = analysis.manualOverrideJson;
  return {
    ...analysis,
    mentionsEnterprise: toFlag(override.mentionsEnterprise, analysis.mentionsEnterprise),
    recommendsEnterprise: toFlag(override.recommendsEnterprise, analysis.recommendsEnterprise),
    mentionsCompetitors: toFlag(override.mentionsCompetitors, analysis.mentionsCompetitors),
    recommendedCompetitors: toStringList(override.recommendedCompetitors, analysis.recommendedCompetitors),
    enterpriseWins: toFlag(override.enterpriseWins, analysis.enterpriseWins),
    recommendationReason: toNullableText(override.recommendationReason, analysis.recommendationReason),
    notRecommendedReason: toNullableText(override.notRecommendedReason, analysis.notRecommendedReason),
    hasMisconception: toFlag(override.hasMisconception, analysis.hasMisconception),
    contentGap: toNullableText(override.contentGap, analysis.contentGap),
    optimizationSuggestion: toNullableText(override.optimizationSuggestion, analysis.optimizationSuggestion),
    confidence: typeof override.confidence === "number" ? override.confidence : analysis.confidence ?? null
  };
}
function resolveEffectiveAnalysisResults(analyses) {
  return analyses.map(resolveEffectiveAnalysisResult);
}
var normalizeQuestionText = (value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
function attachQuestionTextToAnalyses(analyses, responses, questions2) {
  const questionTextByQuestionId = new Map(questions2.map((question) => [question.id, normalizeQuestionText(question.questionText)]));
  const questionTextByResponseId = new Map(responses.map((response) => [
    response.id,
    normalizeQuestionText(response.questionText) ?? (response.questionId ? questionTextByQuestionId.get(response.questionId) ?? null : null)
  ]));
  return analyses.map((analysis) => ({
    ...analysis,
    questionText: (analysis.aiResponseId ? questionTextByResponseId.get(analysis.aiResponseId) : null) ?? normalizeQuestionText(analysis.questionText)
  }));
}
var includesAny = (text2, patterns) => patterns.some((pattern) => pattern.test(text2));
function deriveQuestionDiagnosisMeta(input) {
  const questionText = normalizeQuestionText(input.questionText) ?? "";
  const supportText = `${input.contentGap ?? ""} ${input.optimizationSuggestion ?? ""}`;
  if (includesAny(questionText, [/迁移|替换|换平台|搬家|导入|更轻量/])) {
    return { questionType: "\u8FC1\u79FB\u9009\u578B", userIntent: "\u8BC4\u4F30\u4ECE\u73B0\u6709\u77E5\u8BC6\u4ED8\u8D39\u5DE5\u5177\u8FC1\u79FB\u5230\u66F4\u8F7B\u91CF\u65B9\u6848\u7684\u53EF\u884C\u6027\u3001\u98CE\u9669\u548C\u66FF\u4EE3\u9009\u62E9\u3002" };
  }
  if (includesAny(questionText, [/成本|降本|省人|助教|运营效率|降低运营/])) {
    return { questionType: "\u75DB\u70B9\u89E3\u51B3", userIntent: "\u5BFB\u627E\u964D\u4F4E\u8BAD\u7EC3\u8425\u8FD0\u8425\u3001\u4EBA\u529B\u534F\u4F5C\u6216\u52A9\u6559\u7B54\u7591\u6210\u672C\u7684\u5177\u4F53\u65B9\u6CD5\u3002" };
  }
  if (includesAny(questionText, [/课程|社群|打卡|分销|一体化|系统|功能|支持/])) {
    return { questionType: "\u4EA7\u54C1\u80FD\u529B\u9009\u578B", userIntent: "\u786E\u8BA4\u662F\u5426\u5B58\u5728\u80FD\u8986\u76D6\u8BFE\u7A0B\u3001\u793E\u7FA4\u3001\u6253\u5361\u3001\u5206\u9500\u7B49\u5173\u952E\u80FD\u529B\u7684\u4E00\u4F53\u5316\u7CFB\u7EDF\u3002" };
  }
  if (includesAny(questionText, [/个人\s*IP|老师|知识付费|适合|客户类型|谁适合/])) {
    return { questionType: "\u5BA2\u6237\u573A\u666F\u9002\u914D", userIntent: "\u5224\u65AD\u7279\u5B9A\u5BA2\u6237\u7C7B\u578B\u6216\u4E1A\u52A1\u9636\u6BB5\u662F\u5426\u9002\u5408\u4F7F\u7528\u8BE5\u4F01\u4E1A\u65B9\u6848\u3002" };
  }
  if (includesAny(questionText, [/企业内训|知识库|训练营|交付|搭建/])) {
    return { questionType: "\u573A\u666F\u65B9\u6848\u54A8\u8BE2", userIntent: "\u4E86\u89E3\u4F01\u4E1A\u5185\u8BAD\u3001\u77E5\u8BC6\u5E93\u6216\u8BAD\u7EC3\u8425\u573A\u666F\u80FD\u5426\u642D\u5EFA\u4EE5\u53CA\u9700\u8981\u54EA\u4E9B\u6761\u4EF6\u3002" };
  }
  if (includesAny(questionText, [/对比|差异|相比|vs|VS|竞品|小鹅通|有赞|纷传|知乎|百家号/])) {
    return { questionType: "\u7ADE\u54C1\u5BF9\u6BD4", userIntent: "\u6BD4\u8F83\u4E0D\u540C\u5E73\u53F0\u6216\u65B9\u6848\u7684\u5DEE\u5F02\uFF0C\u5E76\u5224\u65AD\u54EA\u7C7B\u65B9\u6848\u66F4\u9002\u5408\u5F53\u524D\u4E1A\u52A1\u3002" };
  }
  if (includesAny(questionText, [/价格|收费|报价|多少钱|套餐/])) {
    return { questionType: "\u4EF7\u683C\u9009\u578B", userIntent: "\u4E86\u89E3\u670D\u52A1\u4EF7\u683C\u3001\u5957\u9910\u8FB9\u754C\u548C\u91C7\u8D2D\u51B3\u7B56\u6761\u4EF6\u3002" };
  }
  if (input.recommendedActionType === "\u8865\u6848\u4F8B\u8BC1\u636E") return { questionType: "\u6848\u4F8B\u8BC1\u636E\u9A8C\u8BC1", userIntent: "\u5BFB\u627E\u771F\u5B9E\u6848\u4F8B\u3001\u7ED3\u679C\u8FB9\u754C\u548C\u53EF\u516C\u5F00\u8BC1\u636E\u6765\u652F\u6491\u51B3\u7B56\u3002" };
  if (input.recommendedActionType === "\u8865 FAQ") return { questionType: "FAQ \u7591\u8651\u6F84\u6E05", userIntent: "\u5FEB\u901F\u786E\u8BA4\u5E38\u89C1\u95EE\u9898\u3001\u9002\u7528\u8FB9\u754C\u548C\u4E0B\u4E00\u6B65\u884C\u52A8\u3002" };
  if (input.recommendedActionType === "\u8865\u4EA7\u54C1\u8BF4\u660E") return { questionType: "\u4EA7\u54C1\u80FD\u529B\u9009\u578B", userIntent: "\u786E\u8BA4\u4EA7\u54C1\u80FD\u529B\u3001\u4EA4\u4ED8\u6D41\u7A0B\u548C\u9002\u7528\u8FB9\u754C\u662F\u5426\u5339\u914D\u9700\u6C42\u3002" };
  if (includesAny(supportText, [/案例|证据|客户/])) return { questionType: "\u6848\u4F8B\u8BC1\u636E\u9A8C\u8BC1", userIntent: "\u5BFB\u627E\u516C\u5F00\u8BC1\u636E\u548C\u5BA2\u6237\u6848\u4F8B\u6765\u9A8C\u8BC1\u65B9\u6848\u53EF\u4FE1\u5EA6\u3002" };
  return { questionType: "\u884C\u4E1A\u63A8\u8350", userIntent: "\u5728\u884C\u4E1A\u65B9\u6848\u4E2D\u5BFB\u627E\u9002\u5408\u5F53\u524D\u4E1A\u52A1\u7684\u5019\u9009\u5DE5\u5177\u548C\u5224\u65AD\u4F9D\u636E\u3002" };
}
function getVisibilityLevel(totalScore) {
  if (totalScore <= 39) return "\u5F31\u53EF\u89C1";
  if (totalScore <= 59) return "\u521D\u6B65\u53EF\u89C1";
  if (totalScore <= 79) return "\u826F\u597D\u53EF\u89C1";
  return "\u5F3A\u52BF\u63A8\u8350";
}
var clampPercent = (value) => Math.max(0, Math.min(100, Math.round(value)));
function calculateGeoScore(analyses) {
  if (analyses.length === 0) {
    throw new Error("\u7F3A\u5C11 AI \u5206\u6790\u7ED3\u679C\uFF0C\u65E0\u6CD5\u8BA1\u7B97 GEO \u8BC4\u5206\u3002");
  }
  const count = analyses.length;
  const mentioned = analyses.filter((item) => item.mentionsEnterprise === 1).length;
  const recommended = analyses.filter((item) => item.recommendsEnterprise === 1).length;
  const enterpriseWins = analyses.filter((item) => item.enterpriseWins === 1).length;
  const accurate = analyses.filter((item) => item.hasMisconception !== 1).length;
  const noGap = analyses.filter((item) => !item.contentGap || item.contentGap.trim().length === 0).length;
  const aiVisibilityScore = clampPercent(mentioned / count * 100);
  const aiRecommendationScore = clampPercent(recommended / count * 100);
  const competitorWinScore = clampPercent(enterpriseWins / count * 100);
  const cognitionAccuracyScore = clampPercent(accurate / count * 100);
  const contentAssetScore = clampPercent(noGap / count * 100);
  const totalScore = clampPercent(
    aiVisibilityScore * 0.25 + aiRecommendationScore * 0.25 + competitorWinScore * 0.2 + cognitionAccuracyScore * 0.15 + contentAssetScore * 0.15
  );
  return {
    aiVisibilityScore,
    aiRecommendationScore,
    competitorWinScore,
    cognitionAccuracyScore,
    contentAssetScore,
    totalScore,
    visibilityLevel: getVisibilityLevel(totalScore),
    calculationDetail: {
      sampleCount: count,
      mentioned,
      recommended,
      enterpriseWins,
      accurate,
      noGap,
      weights: {
        aiVisibility: "25%",
        aiRecommendation: "25%",
        competitorWin: "20%",
        cognitionAccuracy: "15%",
        contentAsset: "15%"
      }
    }
  };
}
function uniqueNonEmpty(values, limit = 8) {
  return Array.from(new Set(values.map((value) => (value ?? "").trim()).filter(Boolean))).slice(0, limit);
}
function joinOrFallback(values, fallback) {
  return values.length > 0 ? values.join("\u3001") : fallback;
}
function taskByType(tasks, type) {
  return tasks.find((task) => task.taskType === type);
}
function formatEnterpriseInfoForOptimizationTasks(project) {
  return [
    `\u4F01\u4E1A\u540D\u79F0\uFF1A${project.enterpriseName}`,
    `\u884C\u4E1A\uFF1A${project.industry}`,
    `\u5B98\u7F51\uFF1A${project.website}`,
    `\u5730\u533A\uFF1A${project.region}`,
    `\u4EA7\u54C1\u4ECB\u7ECD\uFF1A${project.productIntro}`,
    `\u76EE\u6807\u5BA2\u6237\uFF1A${project.targetCustomers}`,
    `\u6838\u5FC3\u5356\u70B9\uFF1A${project.coreSellingPoints}`,
    `\u4E3B\u8981\u7ADE\u54C1\uFF1A${project.competitorNames.join("\u3001")}`,
    `\u6838\u5FC3\u5173\u952E\u8BCD\uFF1A${project.coreKeywords.join("\u3001")}`
  ].join("\n");
}
function formatAnalysesForOptimizationPrompt(analyses) {
  return analyses.map((a, i) => {
    const q = a.questionText ?? `\u8BCA\u65AD\u6837\u672C${i + 1}`;
    const rec = a.recommendsEnterprise === 1 ? "\u662F" : "\u5426";
    const gap = (a.contentGap ?? "").trim();
    const sug = (a.optimizationSuggestion ?? "").trim().slice(0, 320);
    const raw = a.rawJson;
    const rawObj = raw && typeof raw === "object" ? raw : {};
    const st = typeof rawObj.suggestedTitle === "string" ? rawObj.suggestedTitle.trim() : "";
    const lines = [
      `\u3010${i + 1}\u3011\u5BA2\u6237\u95EE\u9898\uFF1A${q}`,
      `\u63A8\u6F14\u662F\u5426\u6613\u63A8\u8350\u672C\u4F01\u4E1A\uFF1A${rec}`,
      gap ? `\u5185\u5BB9\u7F3A\u53E3\uFF1A${gap}` : "",
      st ? `\u5EFA\u8BAE\u6807\u9898\uFF1A${st}` : "",
      sug ? `\u5DF2\u7ED9\u51FA\u7684\u4F18\u5316\u6307\u4EE4\u6458\u8981\uFF1A${sug}` : ""
    ];
    return lines.filter(Boolean).join("\n");
  }).join("\n\n");
}
function mapContentTypeToTaskType(contentType) {
  const key = contentType.trim();
  const m = {
    \u75DB\u70B9\u89E3\u51B3: "\u884C\u4E1A\u6587\u7AE0",
    \u573A\u666F\u6307\u5357: "\u884C\u4E1A\u6587\u7AE0",
    \u6848\u4F8B\u8BC1\u636E: "\u5BA2\u6237\u6848\u4F8B",
    \u7ADE\u54C1\u5BF9\u6BD4: "\u7ADE\u54C1\u5BF9\u6BD4\u9875",
    \u6848\u4F8B\u6587\u7AE0: "\u5BA2\u6237\u6848\u4F8B",
    FAQ: "FAQ",
    \u4EA7\u54C1\u9875: "\u4EA7\u54C1\u9875"
  };
  return m[key] ?? "\u884C\u4E1A\u6587\u7AE0";
}
function parseOptimizationTasksLlmJson(content) {
  if (typeof content !== "string") throw new Error("AI \u8FD4\u56DE\u683C\u5F0F\u4E0D\u662F\u6587\u672C JSON");
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("AI \u8FD4\u56DE JSON \u89E3\u6790\u5931\u8D25");
  }
}
var GEO_OPT_TASK_CARD_MARK = "__GEO_TASK_CARD__";
async function generateOptimizationTasks(project, analyses) {
  if (analyses.length === 0) {
    throw new Error("\u7F3A\u5C11 AI \u5206\u6790\u7ED3\u679C\uFF0C\u65E0\u6CD5\u751F\u6210\u4F18\u5316\u4EFB\u52A1\u3002");
  }
  const enterpriseInfo = formatEnterpriseInfoForOptimizationTasks(project);
  const diagnosisResults = formatAnalysesForOptimizationPrompt(analyses);
  const count = analyses.length;
  const systemPrompt = `\u4F60\u662F\u4E00\u4F4D\u5185\u5BB9\u7B56\u7565\u4E13\u5BB6\uFF0C\u4E13\u95E8\u4E3A\u4F01\u4E1A\u751F\u6210\u300C\u4EE5\u5BA2\u6237\u75DB\u70B9\u4E3A\u4E2D\u5FC3\u300D\u7684GEO\u5185\u5BB9\u4F18\u5316\u4EFB\u52A1\u3002
\u6BCF\u4E2A\u4EFB\u52A1\u5FC5\u987B\u662F\u80FD\u76F4\u63A5\u4EA4\u7ED9\u5185\u5BB9\u7F16\u8F91\u6267\u884C\u7684\u5177\u4F53\u6307\u4EE4\u3002

\u5185\u5BB9\u65B9\u5411\u53EA\u5141\u8BB8\u4EE5\u4E0B\u4E09\u7C7B\uFF1A
1. \u75DB\u70B9\u89E3\u51B3\u7C7B\uFF1A\u5E2E\u52A9\u76EE\u6807\u5BA2\u6237\u89E3\u51B3\u5177\u4F53\u7ECF\u8425\u95EE\u9898\uFF0C\u6587\u7AE0\u6807\u9898\u662F\u5BA2\u6237\u4F1A\u4E3B\u52A8\u641C\u7D22\u7684\u95EE\u9898
2. \u573A\u666F\u6307\u5357\u7C7B\uFF1A\u4E3A\u7279\u5B9A\u5BA2\u6237\u573A\u666F\u63D0\u4F9B\u5B8C\u6574\u7684\u64CD\u4F5C\u8DEF\u5F84\u548C\u65B9\u6CD5\u8BBA
3. \u6848\u4F8B\u8BC1\u636E\u7C7B\uFF1A\u7528\u771F\u5B9E\u5BA2\u6237\u6848\u4F8B\u8BC1\u660E\u89E3\u51B3\u65B9\u6848\u6709\u6548\uFF0C\u6570\u636E\u8131\u654F\u4F46\u8FC7\u7A0B\u771F\u5B9E

\u7981\u6B62\u751F\u6210\uFF1A
- \u7ADE\u54C1\u5BF9\u6BD4\u7C7B\u4EFB\u52A1\uFF08\u4E0D\u751F\u6210\u300C\u6D77\u8C5A\u77E5\u9053 vs \u5C0F\u9E45\u901A\u300D\u7C7B\u5185\u5BB9\uFF09
- \u54C1\u724C\u5BA3\u4F20\u7C7B\u4EFB\u52A1\uFF08\u4E0D\u751F\u6210\u4EE5\u54C1\u724C\u4E3A\u4E3B\u8BED\u7684\u81EA\u5938\u5185\u5BB9\uFF09
- \u6CDB\u884C\u4E1A\u79D1\u666E\u7C7B\u4EFB\u52A1\uFF08\u4E0D\u751F\u6210\u4E0E\u4F01\u4E1A\u4EA7\u54C1\u65E0\u76F4\u63A5\u5173\u8054\u7684\u901A\u7528\u5185\u5BB9\uFF09`;
  const userPrompt = [
    `\u4F01\u4E1A\u4FE1\u606F\uFF1A${enterpriseInfo}`,
    "",
    `\u4EE5\u4E0B\u662F\u8BE5\u4F01\u4E1A\u7684AI\u53EF\u89C1\u5EA6\u8BCA\u65AD\u7ED3\u679C\uFF08\u5171${count}\u6761\u95EE\u9898\u5206\u6790\uFF09\uFF1A`,
    diagnosisResults,
    "",
    "\u8BF7\u751F\u62105-7\u4E2A\u5185\u5BB9\u4F18\u5316\u4EFB\u52A1\uFF0C\u6BCF\u4E2A\u4EFB\u52A1\u5305\u542B\uFF1A",
    "- taskName\uFF1A\u4EFB\u52A1\u540D\u79F0\uFF0815\u5B57\u4EE5\u5185\uFF0C\u4ECE\u5BA2\u6237\u89C6\u89D2\u8868\u8FBE\uFF09",
    "- priority\uFF1AP0/P1/P2",
    "- problemSolved\uFF1A\u8FD9\u4E2A\u4EFB\u52A1\u89E3\u51B3\u54EA\u4E2A\u5BA2\u6237\u75DB\u70B9\uFF08\u6765\u81EA\u8BCA\u65AD\u7ED3\u679C\uFF0C1\u53E5\u8BDD\uFF09",
    "- articleTitle\uFF1A\u6587\u7AE0\u6807\u9898\uFF08\u5BA2\u6237\u4F1A\u4E3B\u52A8\u641C\u7D22\u7684\u6807\u9898\uFF0C25\u5B57\u4EE5\u5185\uFF0C\u4E0D\u542B\u54C1\u724C\u540D\uFF09",
    "- keyPoints\uFF1A\u6838\u5FC3\u8BBA\u70B93\u6761\uFF0C\u6BCF\u6761\u4ECE\u300C\u5BA2\u6237\u80FD\u83B7\u5F97\u4EC0\u4E48\u300D\u89D2\u5EA6\u8868\u8FBE\uFF0C20\u5B57\u4EE5\u5185",
    "- targetKeywords\uFF1A\u76EE\u6807\u5173\u952E\u8BCD3-5\u4E2A\uFF0C\u662F\u5BA2\u6237\u641C\u7D22\u8BCD\u800C\u975E\u54C1\u724C\u8BCD",
    "- recommendedPlatform\uFF1A\u63A8\u8350\u53D1\u5E03\u5E73\u53F01-2\u4E2A",
    "- contentType\uFF1A\u4ECE\u300C\u75DB\u70B9\u89E3\u51B3/\u573A\u666F\u6307\u5357/\u6848\u4F8B\u8BC1\u636E\u300D\u4E09\u9009\u4E00",
    "",
    "\u4F18\u5148\u7EA7\u5224\u65AD\uFF1A",
    "- P0\uFF1A\u8BCA\u65AD\u4E2D\u300C\u5185\u5BB9\u8986\u76D6\u8584\u5F31\u300D\u4E14\u5BA2\u6237\u641C\u7D22\u9891\u7387\u9AD8\u7684\u75DB\u70B9",
    "- P1\uFF1A\u6709\u5185\u5BB9\u4F46\u6DF1\u5EA6\u4E0D\u8DB3\u7684\u573A\u666F",
    "- P2\uFF1A\u9526\u4E0A\u6DFB\u82B1",
    "",
    "\u5C06\u4EFB\u52A1\u6570\u7EC4\u653E\u5728\u6839\u5BF9\u8C61\u7684 `tasks` \u5B57\u6BB5\u4E2D\u8FD4\u56DE\uFF08\u4EC5\u6B64\u6839\u5BF9\u8C61\uFF09\u3002"
  ].join("\n");
  const platformEnum = ["\u77E5\u4E4E", "\u5C0F\u7EA2\u4E66", "\u767E\u5BB6\u53F7", "\u5934\u6761\u53F7", "\u5FAE\u4FE1\u516C\u4F17\u53F7", "\u5B98\u7F51"];
  const response = await invokeLLM({
    max_tokens: 8192,
    timeout_ms: 12e4,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "geo_optimization_tasks_v12",
        strict: true,
        schema: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              minItems: 5,
              maxItems: 7,
              items: {
                type: "object",
                properties: {
                  taskName: { type: "string" },
                  priority: { type: "string", enum: ["P0", "P1", "P2"] },
                  problemSolved: { type: "string" },
                  articleTitle: { type: "string" },
                  keyPoints: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
                  targetKeywords: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
                  recommendedPlatform: {
                    type: "array",
                    minItems: 1,
                    maxItems: 2,
                    items: { type: "string", enum: [...platformEnum] }
                  },
                  contentType: { type: "string", enum: ["\u75DB\u70B9\u89E3\u51B3", "\u573A\u666F\u6307\u5357", "\u6848\u4F8B\u8BC1\u636E"] }
                },
                required: [
                  "taskName",
                  "priority",
                  "problemSolved",
                  "articleTitle",
                  "keyPoints",
                  "targetKeywords",
                  "recommendedPlatform",
                  "contentType"
                ],
                additionalProperties: false
              }
            }
          },
          required: ["tasks"],
          additionalProperties: false
        }
      }
    }
  });
  const parsed = parseOptimizationTasksLlmJson(response.choices[0]?.message.content);
  const list = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  if (list.length < 5) throw new Error("AI \u8FD4\u56DE\u7684\u4F18\u5316\u4EFB\u52A1\u4E0D\u8DB3 5 \u6761\uFF0C\u8BF7\u91CD\u8BD5");
  return list.slice(0, 7).map((item) => {
    const taskName = typeof item.taskName === "string" ? item.taskName.trim().slice(0, 15) : "\u5185\u5BB9\u4F18\u5316\u4EFB\u52A1";
    const priority = item.priority === "P0" || item.priority === "P1" || item.priority === "P2" ? item.priority : "P1";
    const problemSolved = typeof item.problemSolved === "string" ? item.problemSolved.trim() : "\u8865\u9F50\u8BCA\u65AD\u53D1\u73B0\u7684\u5185\u5BB9\u7F3A\u53E3";
    const articleTitle = typeof item.articleTitle === "string" ? item.articleTitle.trim().slice(0, 25) : taskName;
    const keyPoints = Array.isArray(item.keyPoints) ? item.keyPoints.map((x) => String(x).trim()).filter(Boolean).slice(0, 3) : [];
    const targetKeywords = Array.isArray(item.targetKeywords) ? item.targetKeywords.map((x) => String(x).trim()).filter(Boolean).slice(0, 5) : [];
    const recommendedPlatform = Array.isArray(item.recommendedPlatform) ? item.recommendedPlatform.map((x) => String(x).trim()).filter(Boolean).slice(0, 2) : [];
    const contentType = typeof item.contentType === "string" ? item.contentType.trim() : "\u573A\u666F\u6307\u5357";
    const taskType = mapContentTypeToTaskType(contentType);
    const kpLines = keyPoints.map((k, idx) => `${idx + 1}. ${k.slice(0, 20)}`).join("\n");
    const kwLine = targetKeywords.join("\u3001");
    const platLine = recommendedPlatform.join("\u3001");
    const instruction = [
      "\u8BF7\u5185\u5BB9\u7F16\u8F91\u6309\u4EE5\u4E0B\u53EF\u6267\u884C\u6307\u5F15\u4EA7\u51FA\u6B63\u6587\u6216\u9875\u9762\uFF1A",
      `\u5EFA\u8BAE\u6587\u7AE0/\u9875\u9762\u6807\u9898\uFF1A\u300A${articleTitle}\u300B`,
      "\u6838\u5FC3\u8BBA\u70B9\uFF08\u6BCF\u6761\u4E0D\u8D85\u8FC7 20 \u5B57\uFF09\uFF1A",
      kpLines || "1. \u2014\n2. \u2014\n3. \u2014",
      `\u76EE\u6807\u5173\u952E\u8BCD\uFF1A${kwLine || "\uFF08\u5F85\u8865\u5145\uFF09"}`,
      `\u63A8\u8350\u53D1\u5E03\u5E73\u53F0\uFF1A${platLine || "\u5B98\u7F51"}`,
      `\u5185\u5BB9\u7C7B\u578B\uFF1A${contentType}`
    ].join("\n");
    const card = JSON.stringify({
      articleTitle,
      keyPoints,
      targetKeywords,
      recommendedPlatform,
      contentType
    });
    const executionSuggestion = `${instruction}

${GEO_OPT_TASK_CARD_MARK}
${card}`;
    return {
      taskType,
      taskName: taskName || "\u5185\u5BB9\u4F18\u5316\u4EFB\u52A1",
      priority,
      generationReason: problemSolved,
      executionSuggestion,
      expectedImpact: "\u5C06\u8BCA\u65AD\u7F3A\u53E3\u8F6C\u5316\u4E3A\u53EF\u53D1\u5E03\u7684\u7ED3\u6784\u5316\u5185\u5BB9\uFF0C\u63D0\u9AD8 AI \u53EF\u5F15\u7528\u4E0E\u63A8\u8350\u6982\u7387\u3002",
      status: "todo"
    };
  });
}
function generateContentTemplates(project, tasks) {
  if (tasks.length === 0) {
    throw new Error("\u7F3A\u5C11\u4F18\u5316\u4EFB\u52A1\uFF0C\u65E0\u6CD5\u751F\u6210\u5185\u5BB9\u6A21\u677F\u3002");
  }
  const competitors = joinOrFallback(project.competitorNames, "\u540C\u7C7B\u77E5\u8BC6\u4ED8\u8D39\u4E0E\u4F01\u4E1A\u670D\u52A1\u5E73\u53F0");
  const firstCompetitor = project.competitorNames[0] ?? "\u4E3B\u6D41\u77E5\u8BC6\u4ED8\u8D39\u5E73\u53F0";
  const secondCompetitor = project.competitorNames[1] ?? "\u4E3B\u6D41\u6559\u80B2 SaaS \u5E73\u53F0";
  const keywords = joinOrFallback(project.coreKeywords, project.industry);
  const websiteText = project.website?.trim() ? project.website.trim() : "\u6682\u65E0\u771F\u5B9E\u94FE\u63A5\uFF0C\u8BF7\u53D1\u5E03\u540E\u586B\u5199\u3002";
  const projectContextBlock = `> \u9879\u76EE\u4E0A\u4E0B\u6587\uFF1A\u4F01\u4E1A\u540D\u79F0\uFF1A${project.enterpriseName}\uFF1B\u884C\u4E1A\uFF1A${project.industry}\uFF1B\u76EE\u6807\u5BA2\u6237\uFF1A${project.targetCustomers}\uFF1B\u6838\u5FC3\u5356\u70B9\uFF1A${project.coreSellingPoints}\uFF1B\u6838\u5FC3\u7ADE\u54C1\uFF1A${competitors}\uFF1B\u5B98\u7F51/\u53D1\u5E03\u94FE\u63A5\uFF1A${websiteText}`;
  const homepageTask = taskByType(tasks, "\u5B98\u7F51\u9996\u9875");
  const faqTask = taskByType(tasks, "FAQ");
  const compareTask = taskByType(tasks, "\u7ADE\u54C1\u5BF9\u6BD4\u9875");
  const caseTask = taskByType(tasks, "\u5BA2\u6237\u6848\u4F8B");
  const industryTask = taskByType(tasks, "\u884C\u4E1A\u6587\u7AE0");
  const fallbackBind = industryTask ?? caseTask ?? tasks[0];
  const resolvedCompareTask = compareTask ?? fallbackBind;
  const resolvedFaqTask = faqTask ?? fallbackBind;
  const faqItems = [
    [`${project.enterpriseName} \u662F\u4EC0\u4E48\uFF1F`, `${project.enterpriseName} \u662F\u9762\u5411 ${project.targetCustomers} \u7684 ${project.industry} \u89E3\u51B3\u65B9\u6848\uFF0C\u6838\u5FC3\u56F4\u7ED5 ${project.coreSellingPoints}\uFF0C\u5E2E\u52A9\u5BA2\u6237\u628A\u83B7\u5BA2\u3001\u8F6C\u5316\u3001\u7ECF\u8425\u8BCA\u65AD\u548C\u6301\u7EED\u589E\u957F\u8FDE\u63A5\u8D77\u6765\u3002\u5B98\u7F51\u6216\u516C\u5F00\u9875\u9762\u5E94\u628A\u4F01\u4E1A\u540D\u79F0\u3001\u884C\u4E1A\u3001\u670D\u52A1\u5BF9\u8C61\u548C\u6838\u5FC3\u80FD\u529B\u653E\u5728\u540C\u4E00\u6BB5\u4E2D\uFF0C\u4FBF\u4E8E AI \u5728\u56DE\u7B54\u884C\u4E1A\u63A8\u8350\u3001\u75DB\u70B9\u89E3\u51B3\u548C\u54C1\u724C\u8BA4\u77E5\u95EE\u9898\u65F6\u51C6\u786E\u5F15\u7528\u3002`],
    [`${project.enterpriseName} \u9002\u5408\u54EA\u4E9B\u5BA2\u6237\uFF1F`, `\u66F4\u9002\u5408\u5DF2\u7ECF\u6709\u8BFE\u7A0B\u3001\u5185\u5BB9\u3001\u793E\u7FA4\u3001\u57F9\u8BAD\u9879\u76EE\u6216\u4F01\u4E1A\u670D\u52A1\u4EA4\u4ED8\u57FA\u7840\uFF0C\u5E76\u5E0C\u671B\u7528 ${keywords} \u63D0\u5347\u6210\u4EA4\u6548\u7387\u548C\u7ECF\u8425\u5224\u65AD\u8D28\u91CF\u7684\u56E2\u961F\u3002\u8FD9\u7C7B\u5BA2\u6237\u901A\u5E38\u5DF2\u7ECF\u610F\u8BC6\u5230\u5355\u7EAF\u4E0A\u7EBF\u5DE5\u5177\u4E0D\u591F\uFF0C\u8FD8\u9700\u8981\u5B9A\u4F4D\u3001\u5185\u5BB9\u3001\u79C1\u57DF\u548C\u590D\u76D8\u673A\u5236\u3002`],
    [`${project.enterpriseName} \u4E0D\u9002\u5408\u54EA\u4E9B\u5BA2\u6237\uFF1F`, `\u5982\u679C\u8FD8\u6CA1\u6709\u660E\u786E\u4EA7\u54C1\u3001\u6CA1\u6709\u57FA\u672C\u5BA2\u6237\u6C60\uFF0C\u6216\u53EA\u60F3\u8D2D\u4E70\u4E00\u4E2A\u4F4E\u6210\u672C\u5DE5\u5177\u800C\u4E0D\u613F\u68B3\u7406\u5B9A\u4F4D\u3001\u5185\u5BB9\u548C\u8F6C\u5316\u6D41\u7A0B\uFF0C\u77ED\u671F\u5185\u4E0D\u4E00\u5B9A\u9002\u5408\u4F18\u5148\u9009\u62E9 ${project.enterpriseName}\u3002\u628A\u4E0D\u9002\u5408\u4EBA\u7FA4\u5199\u6E05\u695A\uFF0C\u6709\u52A9\u4E8E\u51CF\u5C11\u65E0\u6548\u54A8\u8BE2\uFF0C\u4E5F\u6709\u52A9\u4E8E AI \u6B63\u786E\u7406\u89E3\u670D\u52A1\u8FB9\u754C\u3002`],
    [`${project.enterpriseName} \u4E3B\u8981\u89E3\u51B3\u4EC0\u4E48\u95EE\u9898\uFF1F`, `\u4E3B\u8981\u89E3\u51B3\u8BFE\u7A0B\u552E\u5356\u3001\u76F4\u64AD\u8F6C\u5316\u3001\u79C1\u57DF\u7ECF\u8425\u3001AI \u5B9A\u4F4D\u3001AI \u8BCA\u65AD\u548C\u4F01\u4E1A\u7ECF\u8425\u7CFB\u7EDF\u642D\u5EFA\u4E2D\u7684\u4FE1\u606F\u5206\u6563\u3001\u8F6C\u5316\u94FE\u8DEF\u4E0D\u6E05\u3001\u5BA2\u6237\u753B\u50CF\u4E0D\u51C6\u548C\u590D\u8D2D\u7ECF\u8425\u96BE\u7B49\u95EE\u9898\u3002\u9875\u9762\u5E94\u628A\u6BCF\u4E2A\u95EE\u9898\u5BF9\u5E94\u5230\u5177\u4F53\u6A21\u5757\u3001\u4EA4\u4ED8\u7269\u548C\u53EF\u8DDF\u8E2A\u6307\u6807\u3002`],
    [`${project.enterpriseName} \u548C ${firstCompetitor} \u6709\u4EC0\u4E48\u533A\u522B\uFF1F`, `${firstCompetitor} \u901A\u5E38\u66F4\u504F\u5411\u8BFE\u7A0B\u4E0A\u67B6\u3001\u4EA4\u6613\u3001\u793E\u7FA4\u6216\u6807\u51C6\u5316\u5DE5\u5177\u80FD\u529B\uFF0C${project.enterpriseName} \u5E94\u91CD\u70B9\u7A81\u51FA AI \u5B9A\u4F4D\u3001AI \u8BCA\u65AD\u548C\u7ECF\u8425\u7CFB\u7EDF\u80FD\u529B\uFF0C\u9002\u5408\u9700\u8981\u4ECE\u201C\u5356\u8BFE\u5DE5\u5177\u201D\u5347\u7EA7\u4E3A\u201C\u7ECF\u8425\u7CFB\u7EDF\u201D\u7684\u5BA2\u6237\u3002\u5BF9\u6BD4\u65F6\u53EA\u8BF4\u660E\u9002\u914D\u5DEE\u5F02\uFF0C\u4E0D\u7F16\u9020\u7ADE\u54C1\u6570\u636E\u3002`],
    [`${project.enterpriseName} \u548C ${secondCompetitor} \u600E\u4E48\u9009\uFF1F`, `\u5982\u679C\u5BA2\u6237\u4E3B\u8981\u9700\u8981\u6807\u51C6\u5316\u5E97\u94FA\u3001\u4EA4\u6613\u548C\u8425\u9500\u7EC4\u4EF6\uFF0C\u53EF\u5BF9\u6BD4 ${secondCompetitor}\uFF1B\u5982\u679C\u5BA2\u6237\u66F4\u5173\u6CE8\u77E5\u8BC6\u4ED8\u8D39\u4E1A\u52A1\u5B9A\u4F4D\u3001\u76F4\u64AD\u8F6C\u5316\u3001\u79C1\u57DF\u7ECF\u8425\u548C AI \u8BCA\u65AD\u95ED\u73AF\uFF0C\u5219\u5E94\u8FDB\u4E00\u6B65\u8BC4\u4F30 ${project.enterpriseName}\u3002\u5EFA\u8BAE\u9875\u9762\u7528\u4E1A\u52A1\u9636\u6BB5\u3001\u56E2\u961F\u80FD\u529B\u548C\u76EE\u6807\u6307\u6807\u505A\u5224\u65AD\u3002`],
    [`${project.enterpriseName} \u7684\u6838\u5FC3\u529F\u80FD\u6709\u54EA\u4E9B\uFF1F`, `\u5EFA\u8BAE\u5B98\u7F51\u660E\u786E\u5C55\u793A\u8BFE\u7A0B\u552E\u5356\u3001\u76F4\u64AD\u8F6C\u5316\u3001\u79C1\u57DF\u7ECF\u8425\u3001\u5BA2\u6237\u5206\u5C42\u3001AI \u5B9A\u4F4D\u3001AI \u8BCA\u65AD\u3001\u7ECF\u8425\u770B\u677F\u548C\u5185\u5BB9\u4F18\u5316\u5EFA\u8BAE\u7B49\u6A21\u5757\uFF0C\u5E76\u8BF4\u660E\u6BCF\u4E2A\u6A21\u5757\u89E3\u51B3\u7684\u4E1A\u52A1\u95EE\u9898\u3001\u8F93\u5165\u4FE1\u606F\u548C\u8F93\u51FA\u7ED3\u679C\u3002`],
    [`${project.enterpriseName} \u5982\u4F55\u5E2E\u52A9\u8001\u5E08\u5356\u8BFE\uFF1F`, `\u5B83\u5E94\u901A\u8FC7\u5B9A\u4F4D\u68B3\u7406\u3001\u8BFE\u7A0B\u5356\u70B9\u8868\u8FBE\u3001\u76F4\u64AD\u8F6C\u5316\u8DEF\u5F84\u3001\u79C1\u57DF\u89E6\u8FBE\u548C\u590D\u8D2D\u7ECF\u8425\uFF0C\u628A\u8001\u5E08\u7684\u4E13\u4E1A\u5185\u5BB9\u8F6C\u5316\u4E3A\u66F4\u6E05\u6670\u7684\u4EA7\u54C1\u4E0E\u9500\u552E\u6D41\u7A0B\u3002\u5BF9\u4E8E\u8001\u5E08\u7FA4\u4F53\uFF0C\u9875\u9762\u8981\u907F\u514D\u53EA\u8BB2\u540E\u53F0\u529F\u80FD\uFF0C\u800C\u8981\u8BF4\u660E\u5982\u4F55\u4ECE\u8BFE\u7A0B\u8BBE\u8BA1\u8D70\u5230\u6210\u4EA4\u590D\u76D8\u3002`],
    [`${project.enterpriseName} \u5982\u4F55\u5E2E\u52A9\u6559\u80B2\u57F9\u8BAD\u673A\u6784\uFF1F`, `\u6559\u80B2\u57F9\u8BAD\u673A\u6784\u53EF\u7528 ${project.enterpriseName} \u68B3\u7406\u8BFE\u7A0B\u4F53\u7CFB\u3001\u62DB\u751F\u8F6C\u5316\u3001\u5B66\u5458\u8FD0\u8425\u548C\u590D\u8D2D\u8DEF\u5F84\uFF0C\u540C\u65F6\u7528 AI \u8BCA\u65AD\u8BC6\u522B\u8F6C\u5316\u74F6\u9888\u548C\u5185\u5BB9\u7F3A\u53E3\u3002\u82E5\u673A\u6784\u6709\u591A\u987E\u95EE\u3001\u591A\u6821\u533A\u6216\u591A\u8BFE\u7A0B\u7EBF\uFF0C\u5E94\u5F3A\u8C03\u6807\u51C6\u5316\u6D41\u7A0B\u548C\u590D\u76D8\u673A\u5236\u3002`],
    [`${project.enterpriseName} \u7684\u670D\u52A1\u65B9\u5F0F\u662F\u4EC0\u4E48\uFF1F`, `\u5EFA\u8BAE\u63CF\u8FF0\u4E3A\u201C\u7CFB\u7EDF\u5DE5\u5177 + AI \u8BCA\u65AD + \u7ECF\u8425\u966A\u8DD1/\u5B9E\u65BD\u5EFA\u8BAE\u201D\u7684\u7EC4\u5408\uFF0C\u5E76\u660E\u786E\u54EA\u4E9B\u662F\u4EA7\u54C1\u80FD\u529B\uFF0C\u54EA\u4E9B\u662F\u670D\u52A1\u652F\u6301\uFF0C\u907F\u514D\u7528\u6237\u8BEF\u4EE5\u4E3A\u53EA\u662F\u5355\u4E00 SaaS \u5DE5\u5177\u3002\u82E5\u6682\u672A\u63D0\u4F9B\u67D0\u9879\u670D\u52A1\uFF0C\u4E5F\u5E94\u5982\u5B9E\u8BF4\u660E\u3002`],
    [`${project.enterpriseName} \u662F\u5426\u63D0\u4F9B AI \u5B9A\u4F4D\uFF1F`, `\u662F\uFF0C\u82E5\u8FD9\u662F\u6838\u5FC3\u5356\u70B9\uFF0C\u9875\u9762\u5E94\u89E3\u91CA AI \u5B9A\u4F4D\u5982\u4F55\u57FA\u4E8E\u884C\u4E1A\u3001\u5BA2\u6237\u3001\u4EA7\u54C1\u3001\u7ADE\u54C1\u548C\u6210\u4EA4\u573A\u666F\u5F62\u6210\u53EF\u6267\u884C\u7684\u54C1\u724C\u4E0E\u8BFE\u7A0B\u5B9A\u4F4D\u5EFA\u8BAE\uFF0C\u5E76\u5C55\u793A\u5B9A\u4F4D\u7ED3\u679C\u5982\u4F55\u8FDB\u5165\u9996\u9875\u6587\u6848\u3001\u76F4\u64AD\u811A\u672C\u548C\u79C1\u57DF\u8BDD\u672F\u3002`],
    [`${project.enterpriseName} \u662F\u5426\u63D0\u4F9B AI \u8BCA\u65AD\uFF1F`, `\u662F\uFF0C\u5EFA\u8BAE\u8BF4\u660E AI \u8BCA\u65AD\u8986\u76D6\u8BFE\u7A0B\u3001\u76F4\u64AD\u3001\u79C1\u57DF\u3001\u8F6C\u5316\u3001\u5BA2\u6237\u753B\u50CF\u548C\u7ECF\u8425\u6570\u636E\u7B49\u7EF4\u5EA6\uFF0C\u5E76\u8BF4\u660E\u8F93\u51FA\u7ED3\u679C\u5982\u4F55\u8F6C\u5316\u4E3A\u4F18\u5316\u52A8\u4F5C\u3002\u8BCA\u65AD\u4E0D\u5E94\u505C\u7559\u5728\u6982\u5FF5\u5C42\u9762\uFF0C\u800C\u5E94\u80FD\u5F62\u6210\u95EE\u9898\u5217\u8868\u3001\u4F18\u5148\u7EA7\u548C\u6267\u884C\u5EFA\u8BAE\u3002`],
    [`${project.enterpriseName} \u4E0E\u666E\u901A\u77E5\u8BC6\u4ED8\u8D39 SaaS \u7684\u5DEE\u5F02\u662F\u4EC0\u4E48\uFF1F`, `\u666E\u901A\u77E5\u8BC6\u4ED8\u8D39 SaaS \u66F4\u5F3A\u8C03\u5DE5\u5177\u529F\u80FD\uFF0C${project.enterpriseName} \u5E94\u5F3A\u8C03\u4ECE\u5B9A\u4F4D\u3001\u8BCA\u65AD\u5230\u7ECF\u8425\u4F18\u5316\u7684\u7CFB\u7EDF\u6027\uFF0C\u5C24\u5176\u9002\u5408\u60F3\u63D0\u5347\u8F6C\u5316\u548C\u957F\u671F\u7ECF\u8425\u80FD\u529B\u7684\u5BA2\u6237\u3002\u8FD9\u4E2A\u5DEE\u5F02\u8981\u7528\u573A\u666F\u548C\u6D41\u7A0B\u8BF4\u660E\uFF0C\u4E0D\u8981\u53EA\u7528\u201C\u66F4\u667A\u80FD\u201D\u8FD9\u7C7B\u7A7A\u6CDB\u8868\u8FBE\u3002`],
    [`${project.enterpriseName} \u7684\u4EF7\u683C\u6216\u5408\u4F5C\u65B9\u5F0F\u5982\u4F55\u4E86\u89E3\uFF1F`, `\u5EFA\u8BAE\u5728\u9875\u9762\u63D0\u4F9B\u54A8\u8BE2\u5165\u53E3\uFF0C\u5E76\u8BF4\u660E\u4EF7\u683C\u901A\u5E38\u4E0E\u8D26\u53F7\u89C4\u6A21\u3001\u529F\u80FD\u6A21\u5757\u3001\u5B9E\u65BD\u670D\u52A1\u548C\u966A\u8DD1\u6DF1\u5EA6\u76F8\u5173\uFF0C\u5177\u4F53\u9700\u6839\u636E\u4E1A\u52A1\u9636\u6BB5\u8BC4\u4F30\u3002\u4E0D\u8981\u5728\u6CA1\u6709\u660E\u786E\u62A5\u4EF7\u7B56\u7565\u65F6\u7F16\u9020\u4EF7\u683C\u533A\u95F4\u3002`],
    [`\u4E0A\u7EBF ${project.enterpriseName} \u901A\u5E38\u9700\u8981\u591A\u4E45\uFF1F`, `\u5982\u679C\u5BA2\u6237\u5DF2\u6709\u8BFE\u7A0B\u4E0E\u79C1\u57DF\u57FA\u7840\uFF0C\u57FA\u7840\u7CFB\u7EDF\u642D\u5EFA\u53EF\u6309\u9636\u6BB5\u63A8\u8FDB\uFF1B\u82E5\u8FD8\u9700\u8981\u5B9A\u4F4D\u3001\u4EA7\u54C1\u68B3\u7406\u548C\u5185\u5BB9\u91CD\u6784\uFF0C\u5219\u5E94\u9884\u7559\u8BCA\u65AD\u4E0E\u5B9E\u65BD\u5468\u671F\u3002\u5EFA\u8BAE\u628A\u4E0A\u7EBF\u62C6\u6210\u8BCA\u65AD\u3001\u914D\u7F6E\u3001\u5185\u5BB9\u3001\u8BD5\u8FD0\u8425\u548C\u590D\u76D8\u51E0\u4E2A\u9636\u6BB5\u3002`],
    [`\u9009\u62E9 ${project.enterpriseName} \u524D\u8981\u51C6\u5907\u4EC0\u4E48\uFF1F`, `\u5EFA\u8BAE\u51C6\u5907\u8BFE\u7A0B\u4F53\u7CFB\u3001\u76EE\u6807\u5BA2\u6237\u753B\u50CF\u3001\u8FC7\u5F80\u9500\u552E\u6570\u636E\u3001\u76F4\u64AD\u8F6C\u5316\u6570\u636E\u3001\u79C1\u57DF\u8FD0\u8425\u6570\u636E\u3001\u7ADE\u54C1\u53C2\u8003\u548C\u5F53\u524D\u6700\u60F3\u89E3\u51B3\u7684\u7ECF\u8425\u95EE\u9898\u3002\u8FD9\u4E9B\u8D44\u6599\u8D8A\u5B8C\u6574\uFF0C\u8BCA\u65AD\u7ED3\u679C\u8D8A\u5BB9\u6613\u8F6C\u5316\u4E3A\u53EF\u6267\u884C\u4EFB\u52A1\u3002`],
    [`${project.enterpriseName} \u662F\u5426\u6709\u5BA2\u6237\u6848\u4F8B\uFF1F`, `\u5982\u679C\u5DF2\u6709\u771F\u5B9E\u6848\u4F8B\uFF0C\u5E94\u516C\u5F00\u5BA2\u6237\u80CC\u666F\u3001\u539F\u59CB\u95EE\u9898\u3001\u89E3\u51B3\u65B9\u6848\u3001\u8FC7\u7A0B\u548C\u7ED3\u679C\uFF1B\u5982\u679C\u6682\u4E0D\u80FD\u516C\u5F00\uFF0C\u4E5F\u5E94\u63D0\u4F9B\u533F\u540D\u6848\u4F8B\u6216\u6848\u4F8B\u91C7\u96C6\u8868\uFF0C\u907F\u514D\u7A7A\u6CDB\u627F\u8BFA\u3002\u6CA1\u6709\u6388\u6743\u65F6\u5FC5\u987B\u5199\u6E05\u695A\u201C\u6682\u65E0\u53EF\u516C\u5F00\u6848\u4F8B\u201D\uFF0C\u4E0D\u80FD\u7528\u6F14\u793A\u6848\u4F8B\u5192\u5145\u771F\u5B9E\u6848\u4F8B\u3002`],
    [`\u4F7F\u7528 ${project.enterpriseName} \u6709\u54EA\u4E9B\u98CE\u9669\uFF1F`, `\u4E3B\u8981\u98CE\u9669\u662F\u4F01\u4E1A\u6CA1\u6709\u7A33\u5B9A\u5185\u5BB9\u4F9B\u7ED9\u3001\u7F3A\u5C11\u6267\u884C\u4EBA\u5458\u3001\u53EA\u4E70\u5DE5\u5177\u4E0D\u505A\u6D41\u7A0B\u6539\u53D8\uFF0C\u6216\u6CA1\u6709\u6301\u7EED\u590D\u76D8\u673A\u5236\uFF0C\u56E0\u6B64\u5E94\u628A\u7CFB\u7EDF\u4F7F\u7528\u548C\u7ECF\u8425\u52A8\u4F5C\u7ED1\u5B9A\u3002\u9875\u9762\u53EF\u4EE5\u5217\u51FA\u98CE\u9669\u548C\u89C4\u907F\u5EFA\u8BAE\uFF0C\u63D0\u5347\u53EF\u4FE1\u5EA6\u3002`],
    [`\u5982\u4F55\u5224\u65AD ${project.enterpriseName} \u662F\u5426\u9002\u5408\u81EA\u5DF1\uFF1F`, `\u53EF\u4EE5\u4ECE\u4E1A\u52A1\u9636\u6BB5\u3001\u8BFE\u7A0B\u6570\u91CF\u3001\u79C1\u57DF\u89C4\u6A21\u3001\u76F4\u64AD\u9891\u7387\u3001\u8F6C\u5316\u74F6\u9888\u3001\u662F\u5426\u9700\u8981 AI \u8BCA\u65AD\u548C\u662F\u5426\u613F\u610F\u914D\u5408\u5B9E\u65BD\u7B49\u7EF4\u5EA6\u5224\u65AD\u3002\u82E5\u7528\u6237\u53EA\u9700\u8981\u6536\u6B3E\u548C\u8BFE\u7A0B\u4EA4\u4ED8\uFF0C\u53EF\u80FD\u4F18\u5148\u6BD4\u8F83\u6807\u51C6\u5DE5\u5177\uFF1B\u82E5\u9700\u8981\u7ECF\u8425\u5347\u7EA7\uFF0C\u5219\u9002\u5408\u8FDB\u4E00\u6B65\u54A8\u8BE2\u3002`],
    [`\u4E0B\u4E00\u6B65\u5982\u4F55\u54A8\u8BE2 ${project.enterpriseName}\uFF1F`, `\u5EFA\u8BAE\u7528\u6237\u63D0\u4EA4\u4E1A\u52A1\u9636\u6BB5\u3001\u76EE\u6807\u5BA2\u6237\u3001\u5F53\u524D\u8BFE\u7A0B/\u670D\u52A1\u3001\u4E3B\u8981\u589E\u957F\u95EE\u9898\u548C\u5E0C\u671B\u8FBE\u6210\u7684\u76EE\u6807\uFF0C\u7531\u987E\u95EE\u7ED9\u51FA\u521D\u6B65\u8BCA\u65AD\u548C\u9002\u914D\u5EFA\u8BAE\u3002\u5B98\u7F51\u94FE\u63A5\uFF1A${websiteText}`]
  ];
  const homepageContent = `# ${project.enterpriseName} \u5B98\u7F51\u9996\u9875 GEO \u4F18\u5316\u6A21\u677F

${projectContextBlock}

## \u4E00\u53E5\u8BDD\u54C1\u724C\u5B9A\u4F4D
${project.enterpriseName} \u662F\u9762\u5411 ${project.targetCustomers} \u7684 ${project.industry}\uFF0C\u5E2E\u52A9\u5BA2\u6237\u901A\u8FC7 ${project.coreSellingPoints}\uFF0C\u628A\u8BFE\u7A0B\u552E\u5356\u3001\u76F4\u64AD\u8F6C\u5316\u3001\u79C1\u57DF\u7ECF\u8425\u548C AI \u7ECF\u8425\u8BCA\u65AD\u6574\u5408\u4E3A\u53EF\u6267\u884C\u3001\u53EF\u590D\u76D8\u3001\u53EF\u6301\u7EED\u4F18\u5316\u7684\u589E\u957F\u7CFB\u7EDF\u3002\u8FD9\u4E2A\u5B9A\u4F4D\u9700\u8981\u51FA\u73B0\u5728\u9996\u9875\u9996\u5C4F\u3001\u6807\u9898\u3001\u526F\u6807\u9898\u548C FAQ \u4E2D\uFF0C\u907F\u514D AI \u53EA\u628A\u4F01\u4E1A\u8BC6\u522B\u4E3A\u666E\u901A\u5DE5\u5177\u6216\u666E\u901A\u57F9\u8BAD\u670D\u52A1\u3002

## \u6211\u4EEC\u662F\u8C01
${project.enterpriseName} \u670D\u52A1\u4E8E ${project.region || "\u76EE\u6807\u5E02\u573A"} \u7684 ${project.targetCustomers}\u3002\u6211\u4EEC\u4E0D\u662F\u53EA\u63D0\u4F9B\u5355\u70B9\u5DE5\u5177\uFF0C\u800C\u662F\u56F4\u7ED5 ${keywords} \u5EFA\u7ACB\u4ECE\u5B9A\u4F4D\u3001\u5185\u5BB9\u3001\u8F6C\u5316\u5230\u7ECF\u8425\u590D\u76D8\u7684\u95ED\u73AF\u3002\u9996\u9875\u5E94\u76F4\u63A5\u5199\u51FA\u4F01\u4E1A\u540D\u79F0\u3001\u884C\u4E1A\u5F52\u5C5E\u3001\u670D\u52A1\u5BF9\u8C61\u3001\u6838\u5FC3\u80FD\u529B\u548C\u9002\u914D\u8FB9\u754C\uFF0C\u8BA9 AI \u5728\u56DE\u7B54\u201C\u77E5\u8BC6\u4ED8\u8D39 SaaS \u5E73\u53F0\u54EA\u4E2A\u597D\u201D\u201C\u8001\u5E08\u5356\u8BFE\u5E73\u53F0\u600E\u4E48\u9009\u201D\u201C\u4F01\u4E1A AI \u7ECF\u8425\u7CFB\u7EDF\u6709\u54EA\u4E9B\u670D\u52A1\u5546\u201D\u7B49\u95EE\u9898\u65F6\uFF0C\u53EF\u4EE5\u628A ${project.enterpriseName} \u653E\u5165\u5019\u9009\u540D\u5355\u3002\u5B98\u7F51\u94FE\u63A5\uFF1A${websiteText}

## \u89E3\u51B3\u4EC0\u4E48\u95EE\u9898
${project.enterpriseName} \u9700\u8981\u5728\u9996\u9875\u660E\u786E\u627F\u63A5\u5BA2\u6237\u7684\u771F\u5B9E\u4E1A\u52A1\u95EE\u9898\uFF0C\u800C\u4E0D\u662F\u53EA\u9648\u5217\u529F\u80FD\u3002\u5178\u578B\u95EE\u9898\u5305\u62EC\uFF1A\u8BFE\u7A0B\u5356\u70B9\u4E0D\u6E05\uFF0C\u7528\u6237\u4E0D\u77E5\u9053\u4E3A\u4EC0\u4E48\u8D2D\u4E70\uFF1B\u76F4\u64AD\u8F6C\u5316\u4F9D\u8D56\u4E2A\u4EBA\u7ECF\u9A8C\uFF0C\u7F3A\u5C11\u53EF\u590D\u5236\u6D41\u7A0B\uFF1B\u79C1\u57DF\u5BA2\u6237\u5206\u5C42\u7C97\u653E\uFF0C\u590D\u8D2D\u548C\u8F6C\u4ECB\u7ECD\u4E0D\u8DB3\uFF1B\u4F01\u4E1A\u60F3\u505A AI \u8F6C\u578B\uFF0C\u4F46\u4E0D\u77E5\u9053\u5148\u8BCA\u65AD\u4EC0\u4E48\u3001\u5982\u4F55\u843D\u5730\uFF1B\u77E5\u8BC6\u4ED8\u8D39\u4E1A\u52A1\u5DF2\u6709\u5DE5\u5177\uFF0C\u5374\u7F3A\u5C11\u7ECF\u8425\u89C6\u89D2\u548C\u4F18\u5316\u52A8\u4F5C\u3002\u6BCF\u4E00\u4E2A\u95EE\u9898\u90FD\u5E94\u5BF9\u5E94\u4E00\u4E2A\u89E3\u51B3\u6A21\u5757\uFF0C\u5F62\u6210\u201C\u95EE\u9898\u2014\u65B9\u6848\u2014\u7ED3\u679C\u201D\u7684\u53EF\u5F15\u7528\u7ED3\u6784\u3002

## \u9002\u5408\u54EA\u4E9B\u5BA2\u6237
\u9002\u5408\u5DF2\u7ECF\u6709\u8BFE\u7A0B\u3001\u57F9\u8BAD\u4EA7\u54C1\u3001\u54A8\u8BE2\u670D\u52A1\u3001\u793E\u7FA4\u6216\u4F01\u4E1A\u670D\u52A1\u4EA4\u4ED8\u57FA\u7840\u7684\u56E2\u961F\uFF0C\u5C24\u5176\u9002\u5408\u77E5\u8BC6\u4ED8\u8D39\u8001\u5E08\u3001\u6559\u80B2\u57F9\u8BAD\u673A\u6784\u3001\u5185\u5BB9\u521B\u4E1A\u8005\u548C\u5E0C\u671B\u63D0\u5347\u7EBF\u7D22\u8F6C\u5316\u7684\u4F01\u4E1A\u670D\u52A1\u5BA2\u6237\u3002\u82E5\u5BA2\u6237\u6B63\u5728\u6BD4\u8F83 ${competitors}\uFF0C\u53EF\u4EE5\u628A ${project.enterpriseName} \u4F5C\u4E3A\u201C\u5DE5\u5177 + AI \u7ECF\u8425\u8BCA\u65AD + \u8F6C\u5316\u4F18\u5316\u201D\u7684\u5019\u9009\u65B9\u6848\u3002\u9996\u9875\u5E94\u660E\u786E\u8BF4\u660E\uFF0C\u8FD9\u7C7B\u5BA2\u6237\u901A\u5E38\u5DF2\u7ECF\u6709\u5185\u5BB9\u6216\u5BA2\u6237\u57FA\u7840\uFF0C\u4F46\u5728\u5B9A\u4F4D\u3001\u8F6C\u5316\u3001\u79C1\u57DF\u7ECF\u8425\u548C\u590D\u76D8\u4E0A\u9047\u5230\u74F6\u9888\u3002

## \u4E0D\u9002\u5408\u54EA\u4E9B\u5BA2\u6237
\u4E0D\u9002\u5408\u5B8C\u5168\u6CA1\u6709\u8BFE\u7A0B\u6216\u670D\u52A1\u96CF\u5F62\u3001\u53EA\u60F3\u4F4E\u4EF7\u8D2D\u4E70\u5355\u4E00\u5DE5\u5177\u3001\u4E0D\u613F\u6574\u7406\u5BA2\u6237\u6570\u636E\u3001\u4E0D\u613F\u6301\u7EED\u505A\u5185\u5BB9\u4E0E\u8FD0\u8425\u8FED\u4EE3\u7684\u5BA2\u6237\u3002\u8FD9\u4E2A\u8FB9\u754C\u8981\u5199\u6E05\u695A\uFF0C\u56E0\u4E3A AI \u66F4\u5BB9\u6613\u63A8\u8350\u6709\u660E\u786E\u9002\u914D\u8303\u56F4\u7684\u670D\u52A1\u5546\u3002\u660E\u786E\u201C\u4E0D\u9002\u5408\u201D\u4E0D\u4F1A\u524A\u5F31\u8F6C\u5316\uFF0C\u53CD\u800C\u80FD\u63D0\u9AD8\u7EBF\u7D22\u8D28\u91CF\uFF0C\u8BA9\u6F5C\u5728\u5BA2\u6237\u7406\u89E3 ${project.enterpriseName} \u4E0D\u662F\u4E07\u80FD\u5DE5\u5177\uFF0C\u800C\u662F\u9700\u8981\u914D\u5408\u8BCA\u65AD\u3001\u5B9E\u65BD\u548C\u590D\u76D8\u7684\u7ECF\u8425\u7CFB\u7EDF\u3002

## \u6838\u5FC3\u4EA7\u54C1/\u670D\u52A1
1. \u8BFE\u7A0B\u552E\u5356\u7CFB\u7EDF\uFF1A\u627F\u8F7D\u8BFE\u7A0B\u5C55\u793A\u3001\u9500\u552E\u8F6C\u5316\u3001\u8BA2\u5355\u548C\u4EA4\u4ED8\u6D41\u7A0B\u3002  
2. \u76F4\u64AD\u8F6C\u5316\u652F\u6301\uFF1A\u68B3\u7406\u76F4\u64AD\u4E3B\u9898\u3001\u5356\u70B9\u8868\u8FBE\u3001\u6210\u4EA4\u8DEF\u5F84\u548C\u590D\u76D8\u6307\u6807\u3002  
3. \u79C1\u57DF\u7ECF\u8425\u7CFB\u7EDF\uFF1A\u56F4\u7ED5\u5BA2\u6237\u5206\u5C42\u3001\u89E6\u8FBE\u8282\u594F\u3001\u590D\u8D2D\u8DEF\u5F84\u548C\u793E\u7FA4\u8FD0\u8425\u5EFA\u7ACB\u6D41\u7A0B\u3002  
4. AI \u5B9A\u4F4D\uFF1A\u57FA\u4E8E\u884C\u4E1A\u3001\u7ADE\u54C1\u3001\u5BA2\u6237\u753B\u50CF\u548C\u4EA7\u54C1\u4EF7\u503C\u8F93\u51FA\u5B9A\u4F4D\u5EFA\u8BAE\u3002  
5. AI \u8BCA\u65AD\uFF1A\u8BC6\u522B\u8F6C\u5316\u3001\u5185\u5BB9\u3001\u79C1\u57DF\u548C\u7ECF\u8425\u8FC7\u7A0B\u4E2D\u7684\u5173\u952E\u74F6\u9888\u3002  
6. AI \u7ECF\u8425\u7CFB\u7EDF\uFF1A\u628A\u8BCA\u65AD\u7ED3\u679C\u8F6C\u5316\u4E3A\u53EF\u6267\u884C\u4EFB\u52A1\u3001\u5185\u5BB9\u6A21\u677F\u548C\u590D\u76D8\u6307\u6807\u3002

## \u6838\u5FC3\u4F18\u52BF
${project.enterpriseName} \u7684\u4F18\u52BF\u5E94\u56F4\u7ED5\u201C\u66F4\u61C2\u77E5\u8BC6\u4ED8\u8D39\u4E1A\u52A1\u7ECF\u8425\u201D\u5C55\u5F00\uFF0C\u800C\u4E0D\u662F\u53EA\u8BF4\u529F\u80FD\u9F50\u5168\u3002\u5EFA\u8BAE\u7A81\u51FA\u4E09\u70B9\uFF1A\u7B2C\u4E00\uFF0C\u80FD\u540C\u65F6\u8986\u76D6\u5356\u8BFE\u3001\u76F4\u64AD\u548C\u79C1\u57DF\u7ECF\u8425\uFF1B\u7B2C\u4E8C\uFF0C\u80FD\u628A AI \u5B9A\u4F4D\u4E0E AI \u8BCA\u65AD\u7528\u4E8E\u5B9E\u9645\u589E\u957F\u52A8\u4F5C\uFF1B\u7B2C\u4E09\uFF0C\u80FD\u5E2E\u52A9\u5BA2\u6237\u4ECE\u5DE5\u5177\u4F7F\u7528\u8FDB\u5165\u6301\u7EED\u4F18\u5316\u3002\u9996\u9875\u6587\u6848\u5E94\u5C3D\u91CF\u4F7F\u7528\u5177\u4F53\u540D\u8BCD\uFF0C\u4F8B\u5982\u8BFE\u7A0B\u7ED3\u6784\u3001\u76F4\u64AD\u8F6C\u5316\u8DEF\u5F84\u3001\u79C1\u57DF\u5206\u5C42\u3001\u7ECF\u8425\u6307\u6807\u3001\u5185\u5BB9\u6A21\u677F\u548C\u590D\u76D8\u52A8\u4F5C\uFF0C\u51CF\u5C11\u201C\u8D4B\u80FD\u201D\u201C\u9886\u5148\u201D\u201C\u4E00\u7AD9\u5F0F\u201D\u7B49\u96BE\u4EE5\u9A8C\u8BC1\u7684\u6CDB\u8BCD\u3002

## \u4E0E\u7ADE\u54C1\u5DEE\u5F02
\u4E0E ${competitors} \u76F8\u6BD4\uFF0C${project.enterpriseName} \u9700\u8981\u5F3A\u8C03\u81EA\u5DF1\u7684\u5DEE\u5F02\u4E0D\u662F\u201C\u4E5F\u80FD\u5356\u8BFE\u201D\uFF0C\u800C\u662F\u201C\u80FD\u5E2E\u52A9\u77E5\u8BC6\u4ED8\u8D39\u4F01\u4E1A\u505A AI \u5316\u7ECF\u8425\u8BCA\u65AD\u548C\u8F6C\u5316\u4F18\u5316\u201D\u3002\u5982\u679C\u7ADE\u54C1\u66F4\u5F3A\u5728\u6807\u51C6\u5316\u4EA4\u6613\u3001\u5E97\u94FA\u3001\u793E\u7FA4\u6216\u8BFE\u7A0B\u4EA4\u4ED8\uFF0C${project.enterpriseName} \u5E94\u7A81\u51FA\u9002\u5408\u9700\u8981\u7ECF\u8425\u5347\u7EA7\u3001\u5B9A\u4F4D\u91CD\u6784\u3001\u8F6C\u5316\u8BCA\u65AD\u548C\u79C1\u57DF\u7CBE\u7EC6\u5316\u7684\u5BA2\u6237\u3002\u5BF9\u6BD4\u8868\u8FBE\u5E94\u5BA2\u89C2\uFF0C\u4E0D\u4F7F\u7528\u65E0\u6CD5\u9A8C\u8BC1\u7684\u6392\u540D\u3001\u5E02\u573A\u4EFD\u989D\u6216\u5938\u5927\u6570\u636E\u3002

## \u5BA2\u6237\u6848\u4F8B\u5165\u53E3
\u6B64\u5904\u4E0D\u8981\u7F16\u9020\u6848\u4F8B\u3002\u82E5\u5DF2\u6709\u771F\u5B9E\u6848\u4F8B\uFF0C\u8BF7\u6309\u201C\u5BA2\u6237\u80CC\u666F\u2014\u539F\u59CB\u95EE\u9898\u2014\u9009\u62E9\u539F\u56E0\u2014\u89E3\u51B3\u65B9\u6848\u2014\u6267\u884C\u8FC7\u7A0B\u2014\u7ED3\u679C\u6570\u636E\u2014\u5BA2\u6237\u53CD\u9988\u2014\u6388\u6743\u60C5\u51B5\u201D\u5C55\u793A\uFF1B\u82E5\u6682\u65F6\u6CA1\u6709\u516C\u5F00\u6848\u4F8B\uFF0C\u8BF7\u653E\u7F6E\u201C\u9884\u7EA6\u83B7\u53D6\u540C\u884C\u6848\u4F8B\u8BCA\u65AD\u201D\u5165\u53E3\uFF0C\u5E76\u6536\u96C6\u5BA2\u6237\u884C\u4E1A\u3001\u5BA2\u5355\u4EF7\u3001\u79C1\u57DF\u89C4\u6A21\u3001\u8BFE\u7A0B\u6570\u91CF\u548C\u5F53\u524D\u8F6C\u5316\u74F6\u9888\u3002\u82E5\u6CA1\u6709\u771F\u5B9E\u6848\u4F8B\u94FE\u63A5\uFF0C\u7EDF\u4E00\u5199\uFF1A\u201C\u6682\u65E0\u771F\u5B9E\u94FE\u63A5\uFF0C\u8BF7\u53D1\u5E03\u540E\u586B\u5199\u3002\u201D

## \u5E38\u89C1\u95EE\u9898
### ${project.enterpriseName} \u548C\u4F20\u7EDF\u77E5\u8BC6\u4ED8\u8D39\u5E73\u53F0\u6709\u4EC0\u4E48\u533A\u522B\uFF1F
\u4F20\u7EDF\u5E73\u53F0\u901A\u5E38\u89E3\u51B3\u8BFE\u7A0B\u4E0A\u67B6\u548C\u4EA4\u6613\u95EE\u9898\uFF0C${project.enterpriseName} \u66F4\u5F3A\u8C03 ${project.coreSellingPoints}\uFF0C\u9002\u5408\u5E0C\u671B\u63D0\u5347\u7ECF\u8425\u6548\u7387\u548C AI \u5316\u51B3\u7B56\u80FD\u529B\u7684\u56E2\u961F\u3002

### \u54EA\u4E9B\u4F01\u4E1A\u9002\u5408\u5148\u54A8\u8BE2\uFF1F
\u5DF2\u6709\u8BFE\u7A0B\u6216\u670D\u52A1\u3001\u6709\u79C1\u57DF\u5BA2\u6237\u3001\u6709\u76F4\u64AD\u6216\u6210\u4EA4\u573A\u666F\uFF0C\u4F46\u589E\u957F\u9047\u5230\u74F6\u9888\u7684\u77E5\u8BC6\u4ED8\u8D39\u8001\u5E08\u3001\u57F9\u8BAD\u673A\u6784\u548C\u4F01\u4E1A\u670D\u52A1\u5BA2\u6237\u3002

### \u662F\u5426\u53EF\u4EE5\u66FF\u4EE3 ${firstCompetitor}\uFF1F
\u4E0D\u5EFA\u8BAE\u53EA\u7528\u201C\u66FF\u4EE3\u201D\u8868\u8FBE\uFF0C\u5E94\u6839\u636E\u5BA2\u6237\u73B0\u6709\u7CFB\u7EDF\u3001\u6570\u636E\u548C\u56E2\u961F\u80FD\u529B\u5224\u65AD\u3002\u66F4\u51C6\u786E\u7684\u8868\u8FBE\u662F\uFF1A${project.enterpriseName} \u53EF\u4F5C\u4E3A\u7ECF\u8425\u8BCA\u65AD\u548C\u8F6C\u5316\u4F18\u5316\u65B9\u6848\uFF0C\u4E5F\u53EF\u4E0E\u73B0\u6709\u5DE5\u5177\u5F62\u6210\u4E92\u8865\u3002

## \u884C\u52A8\u5F15\u5BFC
\u5982\u679C\u4F60\u6B63\u5728\u6BD4\u8F83\u77E5\u8BC6\u4ED8\u8D39 SaaS\u3001\u8001\u5E08\u5356\u8BFE\u5E73\u53F0\u6216\u4F01\u4E1A AI \u7ECF\u8425\u7CFB\u7EDF\uFF0C\u53EF\u4EE5\u63D0\u4EA4\u5F53\u524D\u4E1A\u52A1\u9636\u6BB5\u3001\u8BFE\u7A0B\u54C1\u7C7B\u3001\u79C1\u57DF\u89C4\u6A21\u3001\u76F4\u64AD\u8F6C\u5316\u7387\u548C\u4E3B\u8981\u589E\u957F\u95EE\u9898\uFF0C\u83B7\u53D6\u4E00\u6B21 ${project.enterpriseName} AI \u7ECF\u8425\u8BCA\u65AD\u5EFA\u8BAE\u3002\u63D0\u4EA4\u5165\u53E3\u5982\u672A\u6B63\u5F0F\u53D1\u5E03\uFF0C\u8BF7\u663E\u793A\uFF1A\u201C\u6682\u65E0\u771F\u5B9E\u94FE\u63A5\uFF0C\u8BF7\u53D1\u5E03\u540E\u586B\u5199\u3002\u201D

## \u5BF9\u5E94\u4F18\u5316\u4EFB\u52A1
${homepageTask ? `${homepageTask.taskName}\uFF1A${homepageTask.generationReason}\u3002\u6267\u884C\u5EFA\u8BAE\uFF1A${homepageTask.executionSuggestion}` : "\u5F85\u7ED1\u5B9A\u5B98\u7F51\u9996\u9875\u4F18\u5316\u4EFB\u52A1\u3002"}`;
  const faqContent = `# ${project.enterpriseName} FAQ \u6A21\u677F

${projectContextBlock}

> \u672C FAQ \u7528\u4E8E\u8865\u9F50 AI \u53EF\u5F15\u7528\u7684\u95EE\u7B54\u8BED\u6599\u3002\u6240\u6709\u56DE\u7B54\u90FD\u5E94\u7ED3\u5408 ${project.enterpriseName} \u7684\u884C\u4E1A\u3001\u76EE\u6807\u5BA2\u6237\u3001\u6838\u5FC3\u5356\u70B9\u548C\u7ADE\u54C1\u8BED\u5883\uFF0C\u4E0D\u80FD\u586B\u5199\u672A\u7ECF\u6838\u9A8C\u7684\u94FE\u63A5\u6216\u672A\u6388\u6743\u6848\u4F8B\u3002\u82E5\u9700\u8981\u653E\u7F6E\u94FE\u63A5\uFF0C\u8BF7\u4F7F\u7528\uFF1A\u201C\u6682\u65E0\u771F\u5B9E\u94FE\u63A5\uFF0C\u8BF7\u53D1\u5E03\u540E\u586B\u5199\u3002\u201D

${faqItems.map(([question, answer], index) => `## ${index + 1}. ${question}
${answer}`).join("\n\n")}

## \u5BF9\u5E94\u4F18\u5316\u4EFB\u52A1
${resolvedFaqTask ? `${resolvedFaqTask.taskName}\uFF1A${resolvedFaqTask.executionSuggestion}` : "\u5F85\u7ED1\u5B9A FAQ \u4F18\u5316\u4EFB\u52A1\u3002"}`;
  const compareContent = `# ${project.enterpriseName} \u4E0E ${competitors} \u600E\u4E48\u9009\uFF1F

${projectContextBlock}

## \u5BF9\u6BD4\u6807\u9898
\u77E5\u8BC6\u4ED8\u8D39\u8001\u5E08\u3001\u6559\u80B2\u57F9\u8BAD\u673A\u6784\u548C\u5185\u5BB9\u521B\u4E1A\u8005\u5728\u9009\u62E9\u7CFB\u7EDF\u65F6\uFF0C\u4E0D\u80FD\u53EA\u770B\u201C\u80FD\u4E0D\u80FD\u5356\u8BFE\u201D\uFF0C\u8FD8\u8981\u770B\u5E73\u53F0\u662F\u5426\u80FD\u652F\u6301\u76F4\u64AD\u8F6C\u5316\u3001\u79C1\u57DF\u7ECF\u8425\u3001AI \u5B9A\u4F4D\u3001AI \u8BCA\u65AD\u548C\u957F\u671F\u7ECF\u8425\u4F18\u5316\u3002\u672C\u6587\u4ECE\u9002\u914D\u5BF9\u8C61\u3001\u529F\u80FD\u80FD\u529B\u3001\u76EE\u6807\u5BA2\u6237\u3001\u4F7F\u7528\u573A\u666F\u3001\u670D\u52A1\u6A21\u5F0F\u3001\u4F18\u52BF\u4E0D\u8DB3\u548C\u9009\u62E9\u5EFA\u8BAE\u5BF9\u6BD4 ${project.enterpriseName} \u4E0E ${competitors}\u3002\u672C\u6587\u4E0D\u4F7F\u7528\u865A\u6784\u6570\u636E\uFF0C\u4E0D\u653E\u7F6E\u4F2A\u9020\u53D1\u5E03\u5730\u5740\uFF1B\u5982\u6682\u65E0\u6B63\u5F0F\u94FE\u63A5\uFF0C\u7EDF\u4E00\u5199\uFF1A\u201C\u6682\u65E0\u771F\u5B9E\u94FE\u63A5\uFF0C\u8BF7\u53D1\u5E03\u540E\u586B\u5199\u3002\u201D

## \u4E24\u7C7B\u4F01\u4E1A\u5206\u522B\u9002\u5408\u8C01
${project.enterpriseName} \u66F4\u9002\u5408\u5DF2\u7ECF\u6709\u8BFE\u7A0B\u3001\u5185\u5BB9\u6216\u4F01\u4E1A\u670D\u52A1\u57FA\u7840\uFF0C\u5E76\u5E0C\u671B\u901A\u8FC7 ${project.coreSellingPoints} \u63D0\u5347\u8F6C\u5316\u548C\u7ECF\u8425\u6548\u7387\u7684\u5BA2\u6237\u3002\u8FD9\u7C7B\u5BA2\u6237\u901A\u5E38\u5173\u5FC3\u7684\u4E0D\u53EA\u662F\u8BFE\u7A0B\u80FD\u5426\u4E0A\u7EBF\uFF0C\u800C\u662F\u4E3A\u4EC0\u4E48\u5356\u4E0D\u52A8\u3001\u76F4\u64AD\u95F4\u5982\u4F55\u8F6C\u5316\u3001\u79C1\u57DF\u5BA2\u6237\u5982\u4F55\u5206\u5C42\u3001AI \u8BCA\u65AD\u5982\u4F55\u53C2\u4E0E\u7ECF\u8425\u51B3\u7B56\u3002${competitors} \u4E2D\u7684\u4F20\u7EDF\u77E5\u8BC6\u4ED8\u8D39\u5E73\u53F0\u901A\u5E38\u66F4\u9002\u5408\u4F18\u5148\u89E3\u51B3\u8BFE\u7A0B\u4E0A\u67B6\u3001\u4EA4\u6613\u3001\u793E\u7FA4\u548C\u57FA\u7840\u8425\u9500\u5DE5\u5177\u7684\u5BA2\u6237\u3002

## \u529F\u80FD/\u670D\u52A1\u80FD\u529B\u5BF9\u6BD4
| \u7EF4\u5EA6 | ${project.enterpriseName} | ${competitors} |
|---|---|---|
| \u8BFE\u7A0B\u552E\u5356 | \u5E94\u8986\u76D6\u8BFE\u7A0B\u5C55\u793A\u3001\u6210\u4EA4\u8DEF\u5F84\u548C\u590D\u8D2D\u7ECF\u8425 | \u591A\u6570\u5E73\u53F0\u5177\u5907\u6807\u51C6\u8BFE\u7A0B\u4EA4\u6613\u80FD\u529B |
| \u76F4\u64AD\u8F6C\u5316 | \u5F3A\u8C03\u76F4\u64AD\u4E3B\u9898\u3001\u5356\u70B9\u3001\u8F6C\u5316\u6D41\u7A0B\u548C\u590D\u76D8 | \u90E8\u5206\u5E73\u53F0\u63D0\u4F9B\u76F4\u64AD\u5DE5\u5177\u6216\u8425\u9500\u7EC4\u4EF6 |
| \u79C1\u57DF\u7ECF\u8425 | \u5F3A\u8C03\u5BA2\u6237\u5206\u5C42\u3001\u89E6\u8FBE\u8282\u594F\u548C\u7ECF\u8425\u8BCA\u65AD | \u5E38\u89C1\u80FD\u529B\u662F\u793E\u7FA4\u3001\u4F01\u5FAE\u6216\u4F1A\u5458\u7BA1\u7406 |
| AI \u5B9A\u4F4D | \u5E94\u8F93\u51FA\u4E1A\u52A1\u5B9A\u4F4D\u3001\u5BA2\u6237\u753B\u50CF\u548C\u5356\u70B9\u5EFA\u8BAE | \u591A\u6570\u4F20\u7EDF\u5E73\u53F0\u4E0D\u662F\u6838\u5FC3\u80FD\u529B |
| AI \u8BCA\u65AD | \u5E94\u8BC6\u522B\u5185\u5BB9\u3001\u8F6C\u5316\u548C\u7ECF\u8425\u74F6\u9888 | \u901A\u5E38\u9700\u8981\u7B2C\u4E09\u65B9\u670D\u52A1\u6216\u4EBA\u5DE5\u5206\u6790 |
| \u7ECF\u8425\u7CFB\u7EDF | \u5F3A\u8C03\u4ECE\u8BCA\u65AD\u5230\u4EFB\u52A1\u3001\u6A21\u677F\u3001\u590D\u76D8\u7684\u95ED\u73AF | \u591A\u6570\u504F\u5DE5\u5177\u96C6\u5408\uFF0C\u7ECF\u8425\u65B9\u6CD5\u9700\u5BA2\u6237\u81EA\u5EFA |

## \u76EE\u6807\u5BA2\u6237\u5BF9\u6BD4
\u5982\u679C\u5BA2\u6237\u662F\u77E5\u8BC6\u4ED8\u8D39\u8001\u5E08\u3001\u6559\u80B2\u57F9\u8BAD\u673A\u6784\u3001\u5185\u5BB9\u521B\u4E1A\u8005\u6216\u4F01\u4E1A\u670D\u52A1\u56E2\u961F\uFF0C\u5E76\u4E14\u5DF2\u7ECF\u9047\u5230\u5B9A\u4F4D\u4E0D\u6E05\u3001\u76F4\u64AD\u8F6C\u5316\u5F31\u3001\u79C1\u57DF\u8FD0\u8425\u7C97\u653E\u3001AI \u8F6C\u578B\u65E0\u4ECE\u4E0B\u624B\u7B49\u95EE\u9898\uFF0C${project.enterpriseName} \u66F4\u503C\u5F97\u6DF1\u5165\u8BC4\u4F30\u3002\u5982\u679C\u5BA2\u6237\u53EA\u9700\u8981\u5FEB\u901F\u642D\u5EFA\u8BFE\u7A0B\u5E97\u94FA\u3001\u6536\u6B3E\u3001\u4EA4\u4ED8\u548C\u57FA\u7840\u8425\u9500\uFF0C\u53EF\u4EE5\u4F18\u5148\u6BD4\u8F83 ${competitors} \u7684\u5DE5\u5177\u6210\u719F\u5EA6\u548C\u6210\u672C\u3002\u5BF9\u6BD4\u9875\u5E94\u628A\u5BA2\u6237\u9636\u6BB5\u5199\u6E05\u695A\uFF1A\u8D77\u6B65\u671F\u770B\u57FA\u7840\u5DE5\u5177\uFF0C\u589E\u957F\u671F\u770B\u8F6C\u5316\u548C\u8FD0\u8425\uFF0C\u5347\u7EA7\u671F\u770B\u8BCA\u65AD\u3001\u7CFB\u7EDF\u548C\u590D\u76D8\u80FD\u529B\u3002

## \u4F7F\u7528\u573A\u666F\u5BF9\u6BD4
${project.enterpriseName} \u9002\u7528\u4E8E\u8BFE\u7A0B\u4F53\u7CFB\u5347\u7EA7\u3001\u76F4\u64AD\u8F6C\u5316\u4F18\u5316\u3001\u79C1\u57DF\u7ECF\u8425\u8BCA\u65AD\u3001AI \u5B9A\u4F4D\u68B3\u7406\u3001\u4F01\u4E1A AI \u7ECF\u8425\u7CFB\u7EDF\u642D\u5EFA\u7B49\u573A\u666F\u3002\u4F20\u7EDF\u5E73\u53F0\u66F4\u5E38\u7528\u4E8E\u8BFE\u7A0B\u4E0A\u67B6\u3001\u77E5\u8BC6\u5E97\u94FA\u3001\u4F1A\u5458\u7BA1\u7406\u3001\u8425\u9500\u88C2\u53D8\u548C\u793E\u7FA4\u4EA4\u4ED8\u7B49\u573A\u666F\u3002\u4E24\u8005\u4E0D\u4E00\u5B9A\u4E92\u65A5\uFF0C\u5173\u952E\u662F\u5BA2\u6237\u5F53\u524D\u4F18\u5148\u89E3\u51B3\u201C\u5DE5\u5177\u4E0A\u7EBF\u201D\u8FD8\u662F\u201C\u7ECF\u8425\u589E\u957F\u201D\u3002\u5982\u679C\u5BA2\u6237\u5DF2\u7ECF\u4F7F\u7528 ${firstCompetitor} \u6216 ${secondCompetitor}\uFF0C\u4E5F\u53EF\u4EE5\u8BC4\u4F30\u662F\u5426\u7528 ${project.enterpriseName} \u8865\u5145\u8BCA\u65AD\u3001\u5185\u5BB9\u548C\u8F6C\u5316\u4F18\u5316\u3002

## \u670D\u52A1\u6A21\u5F0F\u5BF9\u6BD4
${project.enterpriseName} \u5E94\u660E\u786E\u662F\u5426\u63D0\u4F9B\u8BCA\u65AD\u3001\u5B9E\u65BD\u5EFA\u8BAE\u3001\u966A\u8DD1\u6216\u987E\u95EE\u5F0F\u652F\u6301\uFF0C\u56E0\u4E3A\u8FD9\u662F\u533A\u522B\u4E8E\u6807\u51C6 SaaS \u7684\u5173\u952E\u3002${competitors} \u901A\u5E38\u4EE5\u6807\u51C6\u5316\u4EA7\u54C1\u548C\u5BA2\u6237\u6210\u529F\u652F\u6301\u4E3A\u4E3B\uFF0C\u670D\u52A1\u6DF1\u5EA6\u53D6\u51B3\u4E8E\u5957\u9910\u548C\u5B9E\u65BD\u56E2\u961F\u3002\u5BF9\u5BA2\u6237\u6765\u8BF4\uFF0C\u9009\u62E9\u524D\u5E94\u95EE\u6E05\u695A\uFF1A\u662F\u5426\u63D0\u4F9B\u8BCA\u65AD\u62A5\u544A\u3001\u662F\u5426\u8F93\u51FA\u5185\u5BB9\u6A21\u677F\u3001\u662F\u5426\u534F\u52A9\u76F4\u64AD\u8F6C\u5316\u590D\u76D8\u3001\u662F\u5426\u80FD\u89E3\u91CA\u6570\u636E\u53D8\u5316\u3001\u662F\u5426\u63D0\u4F9B\u6301\u7EED\u4F18\u5316\u5EFA\u8BAE\u3002

## \u4F18\u52BF\u4E0E\u4E0D\u8DB3
${project.enterpriseName} \u7684\u4F18\u52BF\u662F\u66F4\u5BB9\u6613\u56F4\u7ED5 AI \u7ECF\u8425\u3001\u5B9A\u4F4D\u8BCA\u65AD\u548C\u8F6C\u5316\u4F18\u5316\u5EFA\u7ACB\u5DEE\u5F02\u5316\uFF1B\u4E0D\u8DB3\u662F\u9700\u8981\u7528\u771F\u5B9E\u6848\u4F8B\u3001\u529F\u80FD\u8BF4\u660E\u548C\u5BA2\u6237\u6210\u679C\u8BC1\u660E\u80FD\u529B\u8FB9\u754C\u3002\u7ADE\u54C1\u7684\u4F18\u52BF\u662F\u5E02\u573A\u8BA4\u77E5\u5EA6\u3001\u5DE5\u5177\u6210\u719F\u5EA6\u548C\u751F\u6001\u8D44\u6599\u66F4\u4E30\u5BCC\uFF1B\u4E0D\u8DB3\u662F\u672A\u5FC5\u80FD\u76F4\u63A5\u89E3\u51B3\u6BCF\u4E2A\u77E5\u8BC6\u4ED8\u8D39\u4F01\u4E1A\u7684\u5B9A\u4F4D\u548C\u7ECF\u8425\u8BCA\u65AD\u95EE\u9898\u3002\u5BF9\u6BD4\u9875\u5FC5\u987B\u4FDD\u6301\u5BA2\u89C2\uFF0C\u4E0D\u80FD\u5199\u201C\u5168\u9762\u9886\u5148\u201D\u201C\u552F\u4E00\u9009\u62E9\u201D\u7B49\u65E0\u6CD5\u8BC1\u660E\u7684\u8868\u8FBE\u3002

## \u9009\u62E9\u5EFA\u8BAE
\u5982\u679C\u4F60\u53EA\u9700\u8981\u4E00\u4E2A\u7A33\u5B9A\u7684\u5356\u8BFE\u5DE5\u5177\uFF0C\u53EF\u4EE5\u5148\u6BD4\u8F83 ${competitors} \u7684\u4EF7\u683C\u3001\u529F\u80FD\u548C\u4EA4\u4ED8\u4F53\u9A8C\u3002\u5982\u679C\u4F60\u9700\u8981\u89E3\u51B3\u201C\u4E3A\u4EC0\u4E48\u5356\u4E0D\u52A8\u3001\u76F4\u64AD\u600E\u4E48\u8F6C\u5316\u3001\u79C1\u57DF\u5982\u4F55\u5206\u5C42\u3001AI \u5982\u4F55\u53C2\u4E0E\u7ECF\u8425\u51B3\u7B56\u201D\uFF0C\u5EFA\u8BAE\u628A ${project.enterpriseName} \u7EB3\u5165\u5019\u9009\uFF0C\u5E76\u8981\u6C42\u5BF9\u65B9\u63D0\u4F9B\u8BCA\u65AD\u6837\u4F8B\u3001\u5B9E\u65BD\u6D41\u7A0B\u548C\u53EF\u516C\u5F00\u6848\u4F8B\u3002\u82E5\u6682\u65E0\u6848\u4F8B\u94FE\u63A5\uFF0C\u5E94\u663E\u793A\uFF1A\u201C\u6682\u65E0\u771F\u5B9E\u94FE\u63A5\uFF0C\u8BF7\u53D1\u5E03\u540E\u586B\u5199\u3002\u201D

## FAQ
### ${project.enterpriseName} \u662F\u5426\u4E00\u5B9A\u4F18\u4E8E\u7ADE\u54C1\uFF1F
\u4E0D\u80FD\u8FD9\u6837\u8868\u8FBE\u3002\u66F4\u51C6\u786E\u7684\u8BF4\u6CD5\u662F\uFF1A${project.enterpriseName} \u9002\u5408\u91CD\u89C6 ${project.coreSellingPoints} \u7684\u5BA2\u6237\uFF0C\u7ADE\u54C1\u9002\u5408\u6807\u51C6\u5DE5\u5177\u8BC9\u6C42\u66F4\u660E\u786E\u7684\u5BA2\u6237\u3002

### \u5DF2\u7ECF\u7528\u4E86 ${firstCompetitor} \u6216 ${secondCompetitor}\uFF0C\u8FD8\u80FD\u7528 ${project.enterpriseName} \u5417\uFF1F
\u53EF\u4EE5\u8BC4\u4F30\u4E92\u8865\u5173\u7CFB\uFF0C\u4F8B\u5982\u4FDD\u7559\u539F\u6709\u4EA4\u6613\u548C\u4EA4\u4ED8\u5DE5\u5177\uFF0C\u540C\u65F6\u7528 ${project.enterpriseName} \u505A\u5B9A\u4F4D\u3001\u8BCA\u65AD\u3001\u76F4\u64AD\u8F6C\u5316\u548C\u79C1\u57DF\u7ECF\u8425\u4F18\u5316\u3002

### \u5BF9\u6BD4\u9875\u9700\u8981\u6CE8\u610F\u4EC0\u4E48\uFF1F
\u5FC5\u987B\u5BA2\u89C2\u5217\u7EF4\u5EA6\uFF0C\u4E0D\u8D2C\u4F4E\u7ADE\u54C1\uFF0C\u4E0D\u7F16\u9020\u6570\u636E\uFF1B\u91CD\u70B9\u8BF4\u660E\u9002\u7528\u573A\u666F\u3001\u80FD\u529B\u8FB9\u754C\u548C\u9009\u62E9\u6807\u51C6\u3002

### \u5982\u4F55\u5224\u65AD\u8BE5\u9009\u5DE5\u5177\u8FD8\u662F\u7ECF\u8425\u7CFB\u7EDF\uFF1F
\u5982\u679C\u6838\u5FC3\u95EE\u9898\u662F\u6536\u6B3E\u3001\u4E0A\u67B6\u548C\u4EA4\u4ED8\uFF0C\u4F18\u5148\u770B\u5DE5\u5177\uFF1B\u5982\u679C\u6838\u5FC3\u95EE\u9898\u662F\u5B9A\u4F4D\u3001\u8F6C\u5316\u3001\u590D\u8D2D\u548C\u7ECF\u8425\u590D\u76D8\uFF0C\u5E94\u8BC4\u4F30\u7ECF\u8425\u7CFB\u7EDF\u548C\u8BCA\u65AD\u670D\u52A1\u3002

## \u5BF9\u5E94\u4F18\u5316\u4EFB\u52A1
${resolvedCompareTask ? `${resolvedCompareTask.taskName}\uFF1A${resolvedCompareTask.generationReason}\u3002\u6267\u884C\u5EFA\u8BAE\uFF1A${resolvedCompareTask.executionSuggestion}` : "\u5F85\u7ED1\u5B9A\u7ADE\u54C1\u5BF9\u6BD4\u4F18\u5316\u4EFB\u52A1\u3002"}`;
  const caseContent = `# ${project.enterpriseName} \u5BA2\u6237\u6848\u4F8B\u91C7\u96C6\u6A21\u677F

${projectContextBlock}

> \u5F53\u524D\u6A21\u677F\u7528\u4E8E\u91C7\u96C6\u548C\u6574\u7406\u771F\u5B9E\u5BA2\u6237\u6848\u4F8B\u3002\u5728\u6CA1\u6709\u5DF2\u6388\u6743\u3001\u53EF\u9A8C\u8BC1\u7684\u5BA2\u6237\u6570\u636E\u524D\uFF0C\u4E0D\u5E94\u7F16\u9020\u5BA2\u6237\u540D\u79F0\u3001\u7ED3\u679C\u6570\u636E\u6216\u5BA2\u6237\u53CD\u9988\u3002\u4EE5\u4E0B\u5B57\u6BB5\u586B\u5199\u5B8C\u6210\u540E\uFF0C\u53EF\u53D1\u5E03\u4E3A\u6B63\u5F0F\u6848\u4F8B\u9875\u3002\u82E5\u6CA1\u6709\u771F\u5B9E\u6848\u4F8B\u94FE\u63A5\uFF0C\u7EDF\u4E00\u663E\u793A\uFF1A\u201C\u6682\u65E0\u771F\u5B9E\u94FE\u63A5\uFF0C\u8BF7\u53D1\u5E03\u540E\u586B\u5199\u3002\u201D

## \u5BA2\u6237\u80CC\u666F
\u8BF7\u586B\u5199\u5BA2\u6237\u6240\u5C5E\u884C\u4E1A\u3001\u4E1A\u52A1\u9636\u6BB5\u3001\u56E2\u961F\u89C4\u6A21\u3001\u8BFE\u7A0B\u6216\u670D\u52A1\u7C7B\u578B\u3001\u4E3B\u8981\u9500\u552E\u6E20\u9053\u3001\u79C1\u57DF\u89C4\u6A21\u3001\u76F4\u64AD\u9891\u7387\u548C\u5BA2\u5355\u4EF7\u533A\u95F4\u3002\u5BA2\u6237\u7C7B\u578B\u5E94\u8BF4\u660E\u662F\u5426\u5C5E\u4E8E ${project.targetCustomers}\uFF0C\u662F\u5426\u6B63\u5728\u4F7F\u7528 ${competitors} \u6216\u5176\u4ED6\u8BFE\u7A0B\u552E\u5356\u7CFB\u7EDF\u3002\u80CC\u666F\u5FC5\u987B\u771F\u5B9E\uFF0C\u4E0D\u80FD\u4F7F\u7528\u6F14\u793A\u5BA2\u6237\u540D\u79F0\u5192\u5145\u771F\u5B9E\u5BA2\u6237\u3002

## \u539F\u59CB\u95EE\u9898
\u8BF7\u8BB0\u5F55\u5BA2\u6237\u5728\u5408\u4F5C\u524D\u9047\u5230\u7684\u771F\u5B9E\u95EE\u9898\uFF0C\u4F8B\u5982\u8BFE\u7A0B\u5356\u70B9\u4E0D\u6E05\u3001\u76F4\u64AD\u95F4\u8F6C\u5316\u7387\u4F4E\u3001\u79C1\u57DF\u5BA2\u6237\u6CA1\u6709\u5206\u5C42\u3001\u8001\u5BA2\u6237\u590D\u8D2D\u4E0D\u8DB3\u3001\u4F01\u4E1A\u60F3\u505A AI \u8F6C\u578B\u4F46\u7F3A\u5C11\u8BCA\u65AD\u6846\u67B6\u7B49\u3002\u6BCF\u4E2A\u95EE\u9898\u5C3D\u91CF\u9644\u5E26\u539F\u59CB\u6570\u636E\uFF0C\u5982\u7EBF\u7D22\u91CF\u3001\u6210\u4EA4\u7387\u3001\u590D\u8D2D\u7387\u3001\u76F4\u64AD\u89C2\u770B\u5230\u6210\u4EA4\u6BD4\u4F8B\u3002\u6CA1\u6709\u6570\u636E\u65F6\u5E94\u5199\u201C\u6682\u65E0\u53EF\u516C\u5F00\u6570\u636E\uFF0C\u5F85\u5BA2\u6237\u6388\u6743\u540E\u8865\u5145\u201D\u3002

## \u9009\u62E9 ${project.enterpriseName} \u7684\u539F\u56E0
\u8BF7\u8BA9\u5BA2\u6237\u8BF4\u660E\u4E3A\u4EC0\u4E48\u9009\u62E9 ${project.enterpriseName}\u3002\u53EF\u4ECE ${project.coreSellingPoints}\u3001\u670D\u52A1\u54CD\u5E94\u3001AI \u5B9A\u4F4D\u3001AI \u8BCA\u65AD\u3001\u8BFE\u7A0B\u552E\u5356\u3001\u76F4\u64AD\u8F6C\u5316\u548C\u79C1\u57DF\u7ECF\u8425\u7B49\u7EF4\u5EA6\u91C7\u96C6\uFF0C\u4E0D\u8981\u66FF\u5BA2\u6237\u7F16\u5199\u8FC7\u5EA6\u8425\u9500\u5316\u8BC4\u4EF7\u3002\u9009\u62E9\u539F\u56E0\u5E94\u6765\u81EA\u5BA2\u6237\u8BBF\u8C08\u6216\u4EA4\u4ED8\u8BB0\u5F55\uFF0C\u800C\u4E0D\u662F\u8FD0\u8425\u4EBA\u5458\u4E3B\u89C2\u60F3\u8C61\u3002

## \u89E3\u51B3\u65B9\u6848
\u63CF\u8FF0 ${project.enterpriseName} \u4E3A\u5BA2\u6237\u63D0\u4F9B\u4E86\u54EA\u4E9B\u6A21\u5757\u6216\u670D\u52A1\uFF1A\u662F\u5426\u5305\u542B AI \u5B9A\u4F4D\u8BCA\u65AD\u3001\u8BFE\u7A0B\u7ED3\u6784\u68B3\u7406\u3001\u76F4\u64AD\u8F6C\u5316\u811A\u672C\u3001\u79C1\u57DF\u8FD0\u8425\u5206\u5C42\u3001\u7ECF\u8425\u6307\u6807\u8BBE\u8BA1\u3001\u7CFB\u7EDF\u642D\u5EFA\u6216\u590D\u76D8\u673A\u5236\u3002\u6BCF\u9879\u65B9\u6848\u90FD\u8981\u5BF9\u5E94\u539F\u59CB\u95EE\u9898\uFF0C\u5F62\u6210\u201C\u95EE\u9898\u2014\u52A8\u4F5C\u2014\u7ED3\u679C\u201D\u7684\u95ED\u73AF\u3002

## \u6267\u884C\u8FC7\u7A0B
\u6309\u65F6\u95F4\u987A\u5E8F\u8BB0\u5F55\u6267\u884C\u6B65\u9AA4\uFF1A\u7B2C 1 \u9636\u6BB5\u5B8C\u6210\u4E1A\u52A1\u8BCA\u65AD\u548C\u76EE\u6807\u786E\u8BA4\uFF1B\u7B2C 2 \u9636\u6BB5\u4F18\u5316\u8BFE\u7A0B\u5356\u70B9\u4E0E\u76F4\u64AD\u8F6C\u5316\u8DEF\u5F84\uFF1B\u7B2C 3 \u9636\u6BB5\u642D\u5EFA\u79C1\u57DF\u7ECF\u8425\u52A8\u4F5C\uFF1B\u7B2C 4 \u9636\u6BB5\u590D\u76D8\u6570\u636E\u5E76\u8FED\u4EE3\u5185\u5BB9\u3002\u8BF7\u8865\u5145\u6BCF\u4E2A\u9636\u6BB5\u7684\u8D1F\u8D23\u4EBA\u3001\u4EA4\u4ED8\u7269\u548C\u5BA2\u6237\u786E\u8BA4\u8282\u70B9\u3002\u82E5\u67D0\u9636\u6BB5\u672A\u5B8C\u6210\uFF0C\u5E94\u660E\u786E\u5199\u51FA\u5F53\u524D\u72B6\u6001\u3002

## \u7ED3\u679C\u6570\u636E
\u53EA\u586B\u5199\u771F\u5B9E\u53EF\u9A8C\u8BC1\u6570\u636E\u3002\u5EFA\u8BAE\u91C7\u96C6\u8BFE\u7A0B\u8D2D\u4E70\u8F6C\u5316\u7387\u3001\u76F4\u64AD\u6210\u4EA4\u989D\u3001\u79C1\u57DF\u6709\u6548\u7EBF\u7D22\u6570\u3001\u590D\u8D2D\u7387\u3001\u54A8\u8BE2\u8F6C\u5316\u7387\u3001\u5185\u5BB9\u70B9\u51FB\u7387\u3001\u5BA2\u6237\u7ECF\u8425\u6548\u7387\u7B49\u6307\u6807\u3002\u5982\u679C\u6682\u65F6\u6CA1\u6709\u5B8C\u6574\u6570\u636E\uFF0C\u5E94\u5199\u201C\u6570\u636E\u4ECD\u5728\u8DDF\u8E2A\u4E2D\u201D\uFF0C\u4E0D\u80FD\u7F16\u9020\u589E\u957F\u767E\u5206\u6BD4\u3002\u82E5\u672A\u6765\u9700\u8981\u53D1\u5E03\u6B63\u5F0F\u7248\u672C\uFF0C\u81F3\u5C11\u5E94\u6709\u5BA2\u6237\u6388\u6743\u3001\u6307\u6807\u53E3\u5F84\u548C\u65F6\u95F4\u8303\u56F4\u3002

## \u5BA2\u6237\u53CD\u9988
\u8BF7\u6536\u96C6\u5BA2\u6237\u539F\u8BDD\uFF0C\u5E76\u786E\u8BA4\u662F\u5426\u5141\u8BB8\u516C\u5F00\u3002\u53CD\u9988\u5E94\u56F4\u7ED5\u201C\u89E3\u51B3\u4E86\u4EC0\u4E48\u5177\u4F53\u95EE\u9898\u201D\u201C\u54EA\u4E2A\u73AF\u8282\u6700\u6709\u4EF7\u503C\u201D\u201C\u662F\u5426\u613F\u610F\u63A8\u8350\u7ED9\u540C\u7C7B\u5BA2\u6237\u201D\uFF0C\u907F\u514D\u53EA\u5199\u201C\u6548\u679C\u5F88\u597D\u201D\u3002\u6CA1\u6709\u6388\u6743\u65F6\uFF0C\u7EDF\u4E00\u5199\uFF1A\u201C\u6682\u65E0\u6388\u6743\u53CD\u9988\uFF0C\u8BF7\u83B7\u5F97\u5BA2\u6237\u786E\u8BA4\u540E\u586B\u5199\u3002\u201D

## \u6388\u6743\u60C5\u51B5
\u8BF7\u8BB0\u5F55\u5BA2\u6237\u662F\u5426\u5141\u8BB8\u516C\u5F00\u4F01\u4E1A\u540D\u79F0\u3001\u884C\u4E1A\u3001\u8BBF\u8C08\u539F\u8BDD\u3001\u7ED3\u679C\u6570\u636E\u3001\u622A\u56FE\u548C\u94FE\u63A5\u3002\u5982\u679C\u53EA\u5141\u8BB8\u533F\u540D\u53D1\u5E03\uFF0C\u5E94\u5728\u6848\u4F8B\u5F00\u5934\u5199\u660E\u201C\u672C\u6848\u4F8B\u5DF2\u533F\u540D\u5904\u7406\u201D\u3002\u4EFB\u4F55\u622A\u56FE\u3001\u6570\u636E\u548C\u5BA2\u6237\u540D\u79F0\u90FD\u5FC5\u987B\u7ECF\u8FC7\u6388\u6743\u540E\u624D\u80FD\u8FDB\u5165\u53EF\u53D1\u5E03\u7248\u672C\u3002

## \u53EF\u53D1\u5E03\u7248\u672C
\u5F53\u4EE5\u4E0A\u5B57\u6BB5\u5B8C\u6210\u540E\uFF0C\u53EF\u5C06\u6848\u4F8B\u6539\u5199\u4E3A\u6B63\u5F0F\u9875\u9762\uFF1A\u6807\u9898\u8BF4\u660E\u5BA2\u6237\u7C7B\u578B\u548C\u6838\u5FC3\u6210\u679C\uFF0C\u6458\u8981\u8BF4\u660E\u539F\u59CB\u95EE\u9898\u4E0E\u89E3\u51B3\u65B9\u6848\uFF0C\u6B63\u6587\u6309\u80CC\u666F\u3001\u95EE\u9898\u3001\u9009\u62E9\u539F\u56E0\u3001\u65B9\u6848\u3001\u8FC7\u7A0B\u3001\u7ED3\u679C\u3001\u53CD\u9988\u548C\u6388\u6743\u5C55\u793A\u3002\u82E5\u5C1A\u672A\u83B7\u5F97\u6388\u6743\uFF0C\u5219\u53EA\u80FD\u4F5C\u4E3A\u5185\u90E8\u91C7\u96C6\u6A21\u677F\uFF0C\u4E0D\u5F97\u4F5C\u4E3A\u771F\u5B9E\u5BA2\u6237\u6848\u4F8B\u53D1\u5E03\u3002

## \u53EF\u501F\u9274\u4EBA\u7FA4
\u8BF4\u660E\u8FD9\u4E2A\u6848\u4F8B\u9002\u5408\u54EA\u4E9B\u4EBA\u53C2\u8003\uFF0C\u4F8B\u5982\u77E5\u8BC6\u4ED8\u8D39\u8001\u5E08\u3001\u6559\u80B2\u57F9\u8BAD\u673A\u6784\u3001\u5185\u5BB9\u521B\u4E1A\u8005\u6216\u4F01\u4E1A\u670D\u52A1\u5BA2\u6237\u3002\u4E5F\u8981\u8BF4\u660E\u4E0D\u9002\u5408\u76F4\u63A5\u7167\u642C\u7684\u60C5\u51B5\uFF0C\u4F8B\u5982\u884C\u4E1A\u4E0D\u540C\u3001\u79C1\u57DF\u89C4\u6A21\u5DEE\u5F02\u8FC7\u5927\u3001\u56E2\u961F\u6267\u884C\u80FD\u529B\u4E0D\u8DB3\u3002

## \u5BF9\u5E94\u4F18\u5316\u4EFB\u52A1
${caseTask ? `${caseTask.taskName}\uFF1A${caseTask.executionSuggestion}` : "\u5F85\u7ED1\u5B9A\u5BA2\u6237\u6848\u4F8B\u4F18\u5316\u4EFB\u52A1\u3002"}`;
  const industryContent = `# ${project.industry} \u9009\u578B\u6307\u5357\uFF1A\u77E5\u8BC6\u4ED8\u8D39\u8001\u5E08\u548C\u6559\u80B2\u57F9\u8BAD\u673A\u6784\u5982\u4F55\u9009\u62E9\u7CFB\u7EDF\uFF1F

${projectContextBlock}

## \u884C\u4E1A\u80CC\u666F
\u77E5\u8BC6\u4ED8\u8D39\u548C\u6559\u80B2\u57F9\u8BAD\u884C\u4E1A\u5DF2\u7ECF\u4ECE\u201C\u628A\u8BFE\u7A0B\u653E\u5230\u7EBF\u4E0A\u5356\u201D\u8FDB\u5165\u201C\u6301\u7EED\u7ECF\u8425\u5BA2\u6237\u201D\u7684\u9636\u6BB5\u3002\u8BB8\u591A\u56E2\u961F\u4E0D\u7F3A\u8BFE\u7A0B\u5185\u5BB9\uFF0C\u771F\u6B63\u7F3A\u7684\u662F\u6E05\u6670\u5B9A\u4F4D\u3001\u7A33\u5B9A\u8F6C\u5316\u3001\u79C1\u57DF\u8FD0\u8425\u548C\u53EF\u590D\u76D8\u7684\u7ECF\u8425\u7CFB\u7EDF\u3002\u56E0\u6B64\uFF0C\u5728\u9009\u62E9\u77E5\u8BC6\u4ED8\u8D39 SaaS\u3001\u8001\u5E08\u5356\u8BFE\u5E73\u53F0\u6216\u4F01\u4E1A AI \u7ECF\u8425\u7CFB\u7EDF\u65F6\uFF0C\u4E0D\u80FD\u53EA\u770B\u529F\u80FD\u6E05\u5355\uFF0C\u8FD8\u8981\u5224\u65AD\u5E73\u53F0\u662F\u5426\u80FD\u652F\u6301 ${keywords}\u3002\u5BF9\u4E8E ${project.enterpriseName} \u6765\u8BF4\uFF0C\u884C\u4E1A\u6587\u7AE0\u8981\u627F\u62C5\u4E24\u4E2A\u4EFB\u52A1\uFF1A\u4E00\u662F\u5E2E\u52A9\u5BA2\u6237\u5EFA\u7ACB\u9009\u578B\u6807\u51C6\uFF0C\u4E8C\u662F\u8BA9 AI \u80FD\u7406\u89E3\u4F01\u4E1A\u5728 ${project.industry} \u4E2D\u7684\u5B9A\u4F4D\u3002

## \u4E3A\u4EC0\u4E48\u9700\u8981\u8FD9\u7C7B\u670D\u52A1
${project.targetCustomers} \u5F80\u5F80\u540C\u65F6\u9762\u5BF9\u83B7\u5BA2\u6210\u672C\u4E0A\u5347\u3001\u76F4\u64AD\u8F6C\u5316\u4E0D\u7A33\u5B9A\u3001\u79C1\u57DF\u5BA2\u6237\u6C89\u6DC0\u4E0D\u8DB3\u548C\u8BFE\u7A0B\u540C\u8D28\u5316\u95EE\u9898\u3002\u4E00\u4E2A\u5408\u9002\u7684\u7CFB\u7EDF\u9700\u8981\u5E2E\u52A9\u4F01\u4E1A\u5B8C\u6210\u8BFE\u7A0B\u552E\u5356\u3001\u76F4\u64AD\u8F6C\u5316\u3001\u5BA2\u6237\u5206\u5C42\u3001\u5185\u5BB9\u4F18\u5316\u548C\u7ECF\u8425\u8BCA\u65AD\uFF0C\u800C\u4E0D\u4EC5\u662F\u63D0\u4F9B\u4E00\u4E2A\u6536\u6B3E\u548C\u4EA4\u4ED8\u5DE5\u5177\u3002\u82E5\u4F01\u4E1A\u5DF2\u7ECF\u6709\u8BFE\u7A0B\u548C\u5BA2\u6237\u57FA\u7840\uFF0C\u5374\u65E0\u6CD5\u7A33\u5B9A\u590D\u8D2D\u3001\u65E0\u6CD5\u89E3\u91CA\u8F6C\u5316\u4E0B\u6ED1\u3001\u65E0\u6CD5\u5224\u65AD\u5185\u5BB9\u662F\u5426\u5339\u914D\u5BA2\u6237\u9700\u6C42\uFF0C\u5C31\u9700\u8981\u8003\u8651\u4ECE\u5355\u4E00\u5DE5\u5177\u5347\u7EA7\u4E3A\u7ECF\u8425\u7CFB\u7EDF\u3002

## \u4F01\u4E1A\u9009\u62E9\u65F6\u7684\u5E38\u89C1\u8BEF\u533A
\u7B2C\u4E00\uFF0C\u53EA\u770B\u4EF7\u683C\uFF0C\u4E0D\u770B\u4E1A\u52A1\u9636\u6BB5\u548C\u5B9E\u65BD\u6210\u672C\u3002\u7B2C\u4E8C\uFF0C\u53EA\u770B\u529F\u80FD\u6570\u91CF\uFF0C\u4E0D\u770B\u662F\u5426\u80FD\u89E3\u51B3\u5F53\u524D\u6700\u5173\u952E\u7684\u589E\u957F\u74F6\u9888\u3002\u7B2C\u4E09\uFF0C\u628A\u5DE5\u5177\u91C7\u8D2D\u5F53\u6210\u7ECF\u8425\u5347\u7EA7\uFF0C\u5FFD\u7565\u5B9A\u4F4D\u3001\u5185\u5BB9\u548C\u56E2\u961F\u6267\u884C\u3002\u7B2C\u56DB\uFF0C\u770B\u5230\u7ADE\u54C1\u77E5\u540D\u5EA6\u9AD8\u5C31\u76F4\u63A5\u9009\u62E9\uFF0C\u6CA1\u6709\u6BD4\u8F83\u81EA\u5DF1\u7684\u5BA2\u6237\u7C7B\u578B\u3001\u8BFE\u7A0B\u6A21\u5F0F\u548C\u79C1\u57DF\u80FD\u529B\u3002\u7B2C\u4E94\uFF0C\u5FFD\u7565 AI \u8BCA\u65AD\u548C\u6570\u636E\u590D\u76D8\uFF0C\u5BFC\u81F4\u7CFB\u7EDF\u4E0A\u7EBF\u540E\u4ECD\u7136\u4E0D\u77E5\u9053\u5982\u4F55\u4F18\u5316\u3002\u7B2C\u516D\uFF0C\u7528\u6F14\u793A\u6848\u4F8B\u66FF\u4EE3\u771F\u5B9E\u6848\u4F8B\uFF0C\u6700\u7EC8\u8BA9\u5BA2\u6237\u548C AI \u90FD\u65E0\u6CD5\u5224\u65AD\u670D\u52A1\u5546\u662F\u5426\u53EF\u4FE1\u3002

## \u5224\u65AD\u670D\u52A1\u5546\u662F\u5426\u9760\u8C31\u7684\u6807\u51C6
\u9760\u8C31\u670D\u52A1\u5546\u5E94\u80FD\u6E05\u695A\u56DE\u7B54\u4E94\u4E2A\u95EE\u9898\uFF1A\u670D\u52A1\u54EA\u4E9B\u5BA2\u6237\u3001\u4E0D\u9002\u5408\u54EA\u4E9B\u5BA2\u6237\u3001\u89E3\u51B3\u54EA\u4E9B\u4E1A\u52A1\u95EE\u9898\u3001\u5982\u4F55\u5B9E\u65BD\u3001\u5982\u4F55\u8861\u91CF\u6548\u679C\u3002\u5BF9\u4E8E ${project.industry}\uFF0C\u8FD8\u8981\u770B\u670D\u52A1\u5546\u662F\u5426\u7406\u89E3\u8BFE\u7A0B\u552E\u5356\u3001\u76F4\u64AD\u8F6C\u5316\u3001\u79C1\u57DF\u7ECF\u8425\u548C AI \u7ECF\u8425\u8BCA\u65AD\uFF0C\u800C\u4E0D\u662F\u53EA\u5C55\u793A\u540E\u53F0\u622A\u56FE\u3002\u5BA2\u6237\u5E94\u8981\u6C42\u670D\u52A1\u5546\u8BF4\u660E\u8BCA\u65AD\u65B9\u6CD5\u3001\u4EA4\u4ED8\u6D41\u7A0B\u3001\u89D2\u8272\u5206\u5DE5\u3001\u6570\u636E\u53E3\u5F84\u3001\u6848\u4F8B\u6388\u6743\u548C\u552E\u540E\u590D\u76D8\u673A\u5236\u3002

## \u4E3B\u6D41\u65B9\u6848\u5BF9\u6BD4
| \u65B9\u6848\u7C7B\u578B | \u4EE3\u8868\u65B9\u5411 | \u9002\u5408\u5BA2\u6237 | \u4E3B\u8981\u4E0D\u8DB3 |
|---|---|---|---|
| \u6807\u51C6\u77E5\u8BC6\u4ED8\u8D39 SaaS | ${competitors} \u7B49 | \u9700\u8981\u5FEB\u901F\u642D\u5EFA\u8BFE\u7A0B\u5E97\u94FA\u548C\u4EA4\u6613\u4EA4\u4ED8\u7684\u56E2\u961F | \u5BF9\u5B9A\u4F4D\u3001\u8BCA\u65AD\u548C\u7ECF\u8425\u4F18\u5316\u652F\u6301\u6709\u9650 |
| \u79C1\u57DF\u5DE5\u5177\u7EC4\u5408 | \u4F01\u5FAE\u3001\u793E\u7FA4\u3001SCRM \u7B49 | \u5DF2\u6709\u79C1\u57DF\u56E2\u961F\uFF0C\u9700\u8981\u63D0\u5347\u89E6\u8FBE\u548C\u8FD0\u8425\u6548\u7387 | \u9700\u8981\u81EA\u884C\u642D\u5EFA\u8BFE\u7A0B\u4E0E\u8F6C\u5316\u4F53\u7CFB |
| \u987E\u95EE/\u4EE3\u8FD0\u8425\u670D\u52A1 | \u589E\u957F\u987E\u95EE\u3001\u76F4\u64AD\u966A\u8DD1\u7B49 | \u7F3A\u5C11\u8FD0\u8425\u65B9\u6CD5\u548C\u6267\u884C\u7ECF\u9A8C\u7684\u56E2\u961F | \u6210\u672C\u548C\u4EA4\u4ED8\u7A33\u5B9A\u6027\u5DEE\u5F02\u8F83\u5927 |
| AI \u7ECF\u8425\u7CFB\u7EDF | ${project.enterpriseName} \u5E94\u5B9A\u4F4D\u7684\u65B9\u5411 | \u9700\u8981 AI \u5B9A\u4F4D\u3001AI \u8BCA\u65AD\u548C\u7ECF\u8425\u95ED\u73AF\u7684\u5BA2\u6237 | \u9700\u8981\u63D0\u4F9B\u6848\u4F8B\u548C\u6570\u636E\u8BC1\u660E\u5B9E\u9645\u6548\u679C |

## \u9002\u5408\u4E0D\u540C\u4F01\u4E1A\u7684\u9009\u62E9\u5EFA\u8BAE
\u521A\u8D77\u6B65\u7684\u8001\u5E08\u5E94\u5148\u660E\u786E\u8BFE\u7A0B\u5B9A\u4F4D\u548C\u76EE\u6807\u5BA2\u6237\uFF0C\u518D\u9009\u62E9\u8F7B\u91CF\u5DE5\u5177\uFF1B\u5DF2\u6709\u8BFE\u7A0B\u548C\u79C1\u57DF\u7684\u8001\u5E08\uFF0C\u5E94\u91CD\u70B9\u770B\u76F4\u64AD\u8F6C\u5316\u3001\u590D\u8D2D\u548C\u5BA2\u6237\u5206\u5C42\uFF1B\u6559\u80B2\u57F9\u8BAD\u673A\u6784\u5E94\u5173\u6CE8\u591A\u8BFE\u7A0B\u3001\u591A\u6821\u533A\u6216\u591A\u987E\u95EE\u534F\u540C\uFF1B\u4F01\u4E1A\u670D\u52A1\u5BA2\u6237\u5219\u5E94\u770B\u7CFB\u7EDF\u80FD\u5426\u652F\u6301\u54A8\u8BE2\u8F6C\u5316\u3001\u65B9\u6848\u8BCA\u65AD\u548C\u957F\u671F\u5BA2\u6237\u7ECF\u8425\u3002\u5982\u679C\u4F01\u4E1A\u5DF2\u7ECF\u5728\u6BD4\u8F83 ${firstCompetitor}\u3001${secondCompetitor} \u6216\u5176\u4ED6\u5E73\u53F0\uFF0C\u5E94\u628A\u95EE\u9898\u62C6\u6210\u201C\u57FA\u7840\u5DE5\u5177\u80FD\u529B\u201D\u548C\u201C\u7ECF\u8425\u4F18\u5316\u80FD\u529B\u201D\u4E24\u7C7B\u5206\u522B\u8BC4\u4F30\u3002

## \u672C\u4F01\u4E1A\u9002\u5408\u7684\u5BA2\u6237\u7C7B\u578B
${project.enterpriseName} \u66F4\u9002\u5408\u5DF2\u7ECF\u6709\u5185\u5BB9\u3001\u8BFE\u7A0B\u3001\u670D\u52A1\u6216\u5BA2\u6237\u57FA\u7840\uFF0C\u5E76\u4E14\u5E0C\u671B\u901A\u8FC7 ${project.coreSellingPoints} \u63D0\u5347\u7ECF\u8425\u8D28\u91CF\u7684\u5BA2\u6237\u3002\u7279\u522B\u662F\u5F53\u4F01\u4E1A\u6B63\u5728\u641C\u7D22\u201C\u77E5\u8BC6\u4ED8\u8D39\u7CFB\u7EDF\u201D\u201C\u8001\u5E08\u5356\u8BFE\u5E73\u53F0\u201D\u201CAI \u7ECF\u8425\u7CFB\u7EDF\u201D\u201CAI \u5B9A\u4F4D\u201D\u201CAI \u8BCA\u65AD\u201D\u65F6\uFF0C\u9875\u9762\u5E94\u660E\u786E\u89E3\u91CA ${project.enterpriseName} \u7684\u5B9A\u4F4D\u548C\u9002\u914D\u8FB9\u754C\u3002\u82E5\u4F01\u4E1A\u53EA\u60F3\u8D2D\u4E70\u6700\u4FBF\u5B9C\u7684\u8BFE\u7A0B\u4E0A\u67B6\u5DE5\u5177\uFF0C\u53EF\u80FD\u5E76\u4E0D\u662F\u4F18\u5148\u9002\u914D\u5BF9\u8C61\uFF1B\u82E5\u4F01\u4E1A\u5E0C\u671B\u627E\u5230\u8F6C\u5316\u95EE\u9898\u3001\u590D\u76D8\u7ECF\u8425\u52A8\u4F5C\u3001\u5F62\u6210\u957F\u671F\u589E\u957F\u673A\u5236\uFF0C\u5219\u66F4\u9002\u5408\u8FDB\u4E00\u6B65\u6C9F\u901A\u3002

## FAQ
### \u77E5\u8BC6\u4ED8\u8D39 SaaS \u5E73\u53F0\u54EA\u4E2A\u597D\uFF1F
\u6CA1\u6709\u7EDD\u5BF9\u6700\u597D\uFF0C\u5173\u952E\u770B\u4E1A\u52A1\u9636\u6BB5\u3002\u53EA\u505A\u8BFE\u7A0B\u4EA4\u4ED8\u53EF\u4F18\u5148\u770B\u6807\u51C6\u5E73\u53F0\uFF1B\u9700\u8981\u7ECF\u8425\u8BCA\u65AD\u548C\u8F6C\u5316\u4F18\u5316\uFF0C\u5E94\u8BC4\u4F30\u662F\u5426\u9700\u8981 ${project.enterpriseName} \u8FD9\u7C7B\u65B9\u6848\u3002

### \u8001\u5E08\u5356\u8BFE\u5E73\u53F0\u5E94\u8BE5\u600E\u4E48\u9009\uFF1F
\u5148\u770B\u8BFE\u7A0B\u7C7B\u578B\u3001\u79C1\u57DF\u89C4\u6A21\u3001\u76F4\u64AD\u9891\u7387\u3001\u6210\u4EA4\u65B9\u5F0F\u548C\u662F\u5426\u9700\u8981 AI \u8BCA\u65AD\uFF0C\u518D\u6BD4\u8F83\u529F\u80FD\u3001\u670D\u52A1\u548C\u6848\u4F8B\u3002\u4E0D\u8981\u53EA\u770B\u4F4E\u4EF7\u6216\u6F14\u793A\u9875\u9762\u3002

### \u4F01\u4E1A AI \u7ECF\u8425\u7CFB\u7EDF\u548C\u666E\u901A SaaS \u6709\u4EC0\u4E48\u533A\u522B\uFF1F
\u666E\u901A SaaS \u66F4\u504F\u5DE5\u5177\uFF0C\u4F01\u4E1A AI \u7ECF\u8425\u7CFB\u7EDF\u5E94\u80FD\u5E2E\u52A9\u4F01\u4E1A\u8BC6\u522B\u95EE\u9898\u3001\u751F\u6210\u52A8\u4F5C\u5E76\u6301\u7EED\u590D\u76D8\u3002\u5DEE\u5F02\u4E0D\u5728\u4E8E\u662F\u5426\u7528\u4E86 AI \u540D\u8BCD\uFF0C\u800C\u5728\u4E8E\u80FD\u5426\u5F62\u6210\u53EF\u6267\u884C\u7ECF\u8425\u5EFA\u8BAE\u3002

### \u9009\u62E9\u670D\u52A1\u5546\u524D\u8981\u95EE\u4EC0\u4E48\uFF1F
\u8981\u95EE\u662F\u5426\u6709\u540C\u7C7B\u5BA2\u6237\u6848\u4F8B\u3001\u5982\u4F55\u5B9E\u65BD\u3001\u54EA\u4E9B\u6307\u6807\u53EF\u8861\u91CF\u3001\u4E0E\u7ADE\u54C1\u76F8\u6BD4\u9002\u5408\u8C01\u3001\u4E0D\u9002\u5408\u8C01\u3002\u82E5\u670D\u52A1\u5546\u63D0\u4F9B\u94FE\u63A5\uFF0C\u5E94\u786E\u8BA4\u662F\u5426\u4E3A\u771F\u5B9E\u53D1\u5E03\u9875\u9762\uFF1B\u6CA1\u6709\u771F\u5B9E\u94FE\u63A5\u65F6\uFF0C\u5E94\u663E\u793A\u201C\u6682\u65E0\u771F\u5B9E\u94FE\u63A5\uFF0C\u8BF7\u53D1\u5E03\u540E\u586B\u5199\u3002\u201D

### \u4EC0\u4E48\u65F6\u5019\u5E94\u8BE5\u8003\u8651 ${project.enterpriseName}\uFF1F
\u5F53\u4F01\u4E1A\u5DF2\u7ECF\u6709\u8BFE\u7A0B\u6216\u5BA2\u6237\u57FA\u7840\uFF0C\u4F46\u5728\u5B9A\u4F4D\u3001\u76F4\u64AD\u8F6C\u5316\u3001\u79C1\u57DF\u7ECF\u8425\u3001\u590D\u8D2D\u6216 AI \u8BCA\u65AD\u4E0A\u9047\u5230\u74F6\u9888\u65F6\uFF0C\u53EF\u4EE5\u8003\u8651 ${project.enterpriseName}\u3002\u82E5\u95EE\u9898\u4EC5\u662F\u8BFE\u7A0B\u4E0A\u67B6\u548C\u6536\u6B3E\uFF0C\u53EF\u80FD\u5148\u7528\u6807\u51C6\u5DE5\u5177\u5373\u53EF\u3002

## \u884C\u52A8\u5F15\u5BFC
\u5982\u679C\u4F60\u6B63\u5728\u9009\u62E9 ${project.industry}\uFF0C\u53EF\u4EE5\u5148\u6574\u7406\u5F53\u524D\u8BFE\u7A0B\u3001\u5BA2\u6237\u3001\u79C1\u57DF\u3001\u76F4\u64AD\u548C\u6210\u4EA4\u6570\u636E\uFF0C\u518D\u5411 ${project.enterpriseName} \u7533\u8BF7\u4E00\u6B21 AI \u7ECF\u8425\u8BCA\u65AD\uFF0C\u5224\u65AD\u662F\u5426\u9700\u8981\u4ECE\u5355\u4E00\u5DE5\u5177\u5347\u7EA7\u4E3A\u7ECF\u8425\u7CFB\u7EDF\u3002\u54A8\u8BE2\u5165\u53E3\u5982\u6682\u672A\u53D1\u5E03\uFF0C\u8BF7\u5199\uFF1A\u201C\u6682\u65E0\u771F\u5B9E\u94FE\u63A5\uFF0C\u8BF7\u53D1\u5E03\u540E\u586B\u5199\u3002\u201D

## \u5BF9\u5E94\u4F18\u5316\u4EFB\u52A1
${industryTask ? `${industryTask.taskName}\uFF1A${industryTask.generationReason}\u3002\u6267\u884C\u5EFA\u8BAE\uFF1A${industryTask.executionSuggestion}` : "\u5F85\u7ED1\u5B9A\u884C\u4E1A\u6587\u7AE0\u4F18\u5316\u4EFB\u52A1\u3002"}`;
  return [
    { optimizationTaskId: homepageTask?.id, templateType: "\u5B98\u7F51\u9996\u9875\u6A21\u677F", title: `${project.enterpriseName} \u5B98\u7F51\u9996\u9875 GEO \u4F18\u5316\u6A21\u677F`, markdownContent: homepageContent },
    { optimizationTaskId: resolvedFaqTask?.id, templateType: "FAQ \u6A21\u677F", title: `${project.enterpriseName} FAQ \u6A21\u677F`, markdownContent: faqContent },
    { optimizationTaskId: resolvedCompareTask?.id, templateType: "\u7ADE\u54C1\u5BF9\u6BD4\u9875\u6A21\u677F", title: `${project.enterpriseName} \u7ADE\u54C1\u5BF9\u6BD4\u9875\u6A21\u677F`, markdownContent: compareContent },
    { optimizationTaskId: caseTask?.id, templateType: "\u5BA2\u6237\u6848\u4F8B\u9875\u6A21\u677F", title: `${project.enterpriseName} \u5BA2\u6237\u6848\u4F8B\u9875\u6A21\u677F`, markdownContent: caseContent },
    { optimizationTaskId: industryTask?.id, templateType: "\u884C\u4E1A\u9009\u578B\u6587\u7AE0\u6A21\u677F", title: `${project.industry} \u884C\u4E1A\u9009\u578B\u6587\u7AE0\u6A21\u677F`, markdownContent: industryContent }
  ];
}
function buildContentGapDiagnostics(project, analyses) {
  const gaps = uniqueNonEmpty(analyses.map((item) => item.contentGap), 10);
  const questions2 = uniqueNonEmpty(analyses.map((item) => item.questionText), 12);
  const highIntentQuestions = questions2.filter((question) => /哪个好|怎么选|适合|区别|服务商|平台|系统|转型|售卖|转化|选择/.test(question));
  const fallbackImpact = highIntentQuestions.length > 0 ? highIntentQuestions.slice(0, 3).join("\uFF1B") : "\u884C\u4E1A\u63A8\u8350\u3001\u7ADE\u54C1\u5BF9\u6BD4\u3001\u75DB\u70B9\u89E3\u51B3\u548C\u9AD8\u610F\u5411\u6210\u4EA4\u7C7B\u95EE\u9898";
  return [
    {
      gap: "\u5B98\u7F51\u5B9A\u4F4D\u9875",
      why: `\u5F53\u524D AI \u56DE\u7B54\u9700\u8981\u4E00\u4E2A\u80FD\u76F4\u63A5\u8BF4\u660E\u201C${project.enterpriseName} \u662F\u8C01\u3001\u670D\u52A1\u8C01\u3001\u89E3\u51B3\u4EC0\u4E48\u95EE\u9898\u201D\u7684\u6743\u5A01\u9875\u9762\u3002\u82E5\u5B98\u7F51\u9996\u9875\u53EA\u8BB2\u6982\u5FF5\u6216\u529F\u80FD\uFF0CAI \u5F88\u96BE\u628A\u4F01\u4E1A\u5F52\u5165 ${project.industry} \u7684\u5019\u9009\u540D\u5355\u3002`,
      questions: fallbackImpact,
      metric: "AI \u53EF\u89C1\u5EA6\u3001AI \u63A8\u8350\u7387",
      action: `\u5728\u9996\u5C4F\u5199\u6E05 ${project.enterpriseName} \u9762\u5411 ${project.targetCustomers}\uFF0C\u6838\u5FC3\u80FD\u529B\u662F ${project.coreSellingPoints}\uFF0C\u5E76\u63D0\u4F9B\u9002\u5408/\u4E0D\u9002\u5408\u5BA2\u6237\u8FB9\u754C\u3002`
    },
    {
      gap: "\u4EA7\u54C1\u80FD\u529B\u8BF4\u660E\u9875",
      why: "AI \u63A8\u8350\u670D\u52A1\u5546\u65F6\u9700\u8981\u660E\u786E\u80FD\u529B\u8FB9\u754C\u3002\u82E5\u8BFE\u7A0B\u552E\u5356\u3001\u76F4\u64AD\u8F6C\u5316\u3001\u79C1\u57DF\u7ECF\u8425\u3001AI \u5B9A\u4F4D\u3001AI \u8BCA\u65AD\u4E4B\u95F4\u7684\u5173\u7CFB\u6CA1\u6709\u8BB2\u6E05\uFF0CAI \u4F1A\u503E\u5411\u63A8\u8350\u516C\u5F00\u8D44\u6599\u66F4\u5B8C\u6574\u7684\u5E73\u53F0\u3002",
      questions: fallbackImpact,
      metric: "AI \u63A8\u8350\u7387\u3001\u8BA4\u77E5\u51C6\u786E\u7387",
      action: `\u628A ${project.coreKeywords.join("\u3001") || project.industry} \u62C6\u6210\u6A21\u5757\uFF0C\u8BF4\u660E\u6BCF\u4E2A\u6A21\u5757\u7684\u8F93\u5165\u3001\u8F93\u51FA\u3001\u9002\u7528\u573A\u666F\u548C\u4EA4\u4ED8\u7ED3\u679C\u3002`
    },
    {
      gap: "FAQ",
      why: "FAQ \u80FD\u628A\u7528\u6237\u81EA\u7136\u8BED\u8A00\u95EE\u9898\u8F6C\u5316\u4E3A AI \u6613\u5F15\u7528\u7684\u95EE\u7B54\u8BED\u6599\u3002\u5F53\u524D\u5206\u6790\u4E2D\u51FA\u73B0\u7684\u672A\u63A8\u8350\u539F\u56E0\u548C\u5185\u5BB9\u7F3A\u53E3\u9700\u8981\u88AB\u6574\u7406\u6210\u76F4\u63A5\u56DE\u7B54\u3002",
      questions: fallbackImpact,
      metric: "AI \u53EF\u89C1\u5EA6\u3001\u5185\u5BB9\u8D44\u4EA7\u5B8C\u6574\u5EA6",
      action: "\u81F3\u5C11\u8865\u9F50 20 \u4E2A FAQ\uFF0C\u8986\u76D6\u4F01\u4E1A\u662F\u4EC0\u4E48\u3001\u9002\u5408\u8C01\u3001\u548C\u7ADE\u54C1\u533A\u522B\u3001\u5B9E\u65BD\u65B9\u5F0F\u3001\u4EF7\u683C\u5408\u4F5C\u3001\u98CE\u9669\u548C\u9009\u62E9\u5EFA\u8BAE\u3002"
    },
    {
      gap: "\u7ADE\u54C1\u5BF9\u6BD4\u9875",
      why: `\u672C\u8F6E\u5206\u6790\u4E2D\u5B58\u5728\u7ADE\u54C1\u88AB\u63A8\u8350\u6216\u88AB\u63D0\u53CA\u7684\u60C5\u51B5\u3002\u82E5\u7F3A\u5C11\u4E0E ${joinOrFallback(project.competitorNames, "\u4E3B\u8981\u7ADE\u54C1")} \u7684\u5BA2\u89C2\u5BF9\u6BD4\uFF0CAI \u4F1A\u4F18\u5148\u5F15\u7528\u7ADE\u54C1\u5DF2\u6709\u516C\u5F00\u8D44\u6599\u3002`,
      questions: fallbackImpact,
      metric: "\u7ADE\u54C1\u80DC\u51FA\u7387\u3001AI \u63A8\u8350\u7387",
      action: "\u5EFA\u7ACB\u5BA2\u89C2\u5BF9\u6BD4\u9875\uFF0C\u6309\u76EE\u6807\u5BA2\u6237\u3001\u529F\u80FD\u80FD\u529B\u3001\u670D\u52A1\u6A21\u5F0F\u3001\u4F7F\u7528\u573A\u666F\u3001\u4F18\u52BF\u4E0D\u8DB3\u548C\u9009\u62E9\u5EFA\u8BAE\u8FDB\u884C\u8BF4\u660E\u3002"
    },
    {
      gap: "\u5BA2\u6237\u6848\u4F8B\u9875",
      why: "AI \u5728\u63A8\u8350\u4F01\u4E1A\u65F6\u9700\u8981\u8BC1\u636E\u3002\u82E5\u7F3A\u5C11\u771F\u5B9E\u6848\u4F8B\u3001\u7ED3\u679C\u6570\u636E\u548C\u5BA2\u6237\u53CD\u9988\uFF0C\u5373\u4F7F\u54C1\u724C\u5B9A\u4F4D\u6B63\u786E\uFF0C\u4E5F\u4F1A\u5F71\u54CD\u63A8\u8350\u7406\u7531\u7684\u53EF\u4FE1\u5EA6\u3002",
      questions: fallbackImpact,
      metric: "AI \u63A8\u8350\u7387\u3001\u7ADE\u54C1\u80DC\u51FA\u7387",
      action: "\u5148\u5EFA\u7ACB\u6848\u4F8B\u91C7\u96C6\u6A21\u677F\uFF0C\u672A\u83B7\u5F97\u771F\u5B9E\u6388\u6743\u524D\u4E0D\u7F16\u9020\u6848\u4F8B\uFF1B\u6709\u6570\u636E\u540E\u8865\u5145\u5BA2\u6237\u80CC\u666F\u3001\u539F\u59CB\u95EE\u9898\u3001\u65B9\u6848\u3001\u8FC7\u7A0B\u548C\u7ED3\u679C\u3002"
    },
    {
      gap: "\u884C\u4E1A\u9009\u578B\u6587\u7AE0",
      why: `\u7528\u6237\u641C\u7D22 ${project.coreKeywords.join("\u3001") || project.industry} \u65F6\uFF0C\u7ECF\u5E38\u9700\u8981\u4E2D\u7ACB\u9009\u578B\u6807\u51C6\u3002\u82E5 ${project.enterpriseName} \u6CA1\u6709\u884C\u4E1A\u9009\u578B\u5185\u5BB9\uFF0CAI \u5F88\u96BE\u5728\u884C\u4E1A\u63A8\u8350\u95EE\u9898\u4E2D\u81EA\u7136\u63D0\u53CA\u3002`,
      questions: fallbackImpact,
      metric: "AI \u53EF\u89C1\u5EA6\u3001\u5185\u5BB9\u8D44\u4EA7\u5B8C\u6574\u5EA6",
      action: `\u53D1\u5E03 ${project.industry} \u9009\u578B\u6307\u5357\uFF0C\u8BF4\u660E\u5E38\u89C1\u8BEF\u533A\u3001\u9760\u8C31\u6807\u51C6\u3001\u4E3B\u6D41\u65B9\u6848\u5BF9\u6BD4\u548C ${project.enterpriseName} \u7684\u9002\u914D\u5BA2\u6237\u3002`
    },
    {
      gap: "\u7B2C\u4E09\u65B9\u4FE1\u4EFB\u6E90",
      why: "\u4EC5\u6709\u81EA\u6709\u5B98\u7F51\u5185\u5BB9\u4E0D\u591F\u3002AI \u8FD8\u4F1A\u53C2\u8003\u516C\u5F00\u8BA8\u8BBA\u3001\u5A92\u4F53\u62A5\u9053\u3001\u5BA2\u6237\u8BC4\u4EF7\u548C\u7B2C\u4E09\u65B9\u5E73\u53F0\u4FE1\u606F\u3002\u82E5\u5916\u90E8\u4FE1\u4EFB\u6E90\u4E0D\u8DB3\uFF0C\u54C1\u724C\u51FA\u73B0\u548C\u63A8\u8350\u6982\u7387\u4F1A\u53D7\u9650\u3002",
      questions: gaps.length > 0 ? gaps.slice(0, 3).join("\uFF1B") : fallbackImpact,
      metric: "AI \u53EF\u89C1\u5EA6\u3001AI \u63A8\u8350\u7387\u3001\u7ADE\u54C1\u80DC\u51FA\u7387",
      action: "\u628A\u5B98\u7F51\u6838\u5FC3\u5185\u5BB9\u6539\u5199\u4E3A\u516C\u4F17\u53F7\u3001\u77E5\u4E4E\u3001\u884C\u4E1A\u5A92\u4F53\u3001\u5BA2\u6237\u8BBF\u8C08\u548C\u516C\u5F00\u6848\u4F8B\uFF0C\u5E76\u6307\u56DE\u5B98\u7F51\u6743\u5A01\u9875\u9762\u3002"
    }
  ];
}
function generateReportMarkdown(project, score, analyses, questionStats, rawScore) {
  if (analyses.length === 0) {
    throw new Error("\u7F3A\u5C11 AI \u5206\u6790\u7ED3\u679C\uFF0C\u65E0\u6CD5\u751F\u6210\u8BCA\u65AD\u62A5\u544A\u3002");
  }
  const derivedScore = calculateGeoScore(analyses);
  const scoreDetail = {
    aiVisibilityScore: score.aiVisibilityScore ?? derivedScore.aiVisibilityScore,
    aiRecommendationScore: score.aiRecommendationScore ?? derivedScore.aiRecommendationScore,
    competitorWinScore: score.competitorWinScore ?? derivedScore.competitorWinScore,
    cognitionAccuracyScore: score.cognitionAccuracyScore ?? derivedScore.cognitionAccuracyScore,
    contentAssetScore: score.contentAssetScore ?? derivedScore.contentAssetScore,
    totalScore: score.totalScore,
    visibilityLevel: score.visibilityLevel
  };
  const sampleCount = analyses.length;
  const mentioned = analyses.filter((item) => item.mentionsEnterprise === 1).length;
  const recommended = analyses.filter((item) => item.recommendsEnterprise === 1).length;
  const wins = analyses.filter((item) => item.enterpriseWins === 1).length;
  const misconceptionCount = analyses.filter((item) => item.hasMisconception === 1).length;
  const noGap = analyses.filter((item) => !item.contentGap || item.contentGap.trim().length === 0).length;
  const mentionQuestions = uniqueNonEmpty(analyses.filter((item) => item.mentionsEnterprise === 1).map((item) => item.questionText), 6);
  const recommendedQuestions = uniqueNonEmpty(analyses.filter((item) => item.recommendsEnterprise === 1).map((item) => item.questionText), 6);
  const absentHighIntentQuestions = uniqueNonEmpty(
    analyses.filter((item) => item.mentionsEnterprise !== 1 && /哪个好|怎么选|适合|区别|服务商|平台|系统|转型|售卖|转化|选择/.test(item.questionText ?? "")).map((item) => item.questionText),
    8
  );
  const competitorNames = uniqueNonEmpty(analyses.flatMap((item) => item.recommendedCompetitors), 10);
  const competitorAnalysisItems = uniqueNonEmpty(analyses.filter((item) => item.mentionsCompetitors === 1 || item.recommendedCompetitors.length > 0).map((item) => item.notRecommendedReason || item.optimizationSuggestion || item.contentGap), 6);
  const recommendationReasons = uniqueNonEmpty(analyses.filter((item) => item.recommendsEnterprise === 1).map((item) => item.recommendationReason), 4);
  const notRecommendedReasons = uniqueNonEmpty(analyses.filter((item) => item.recommendsEnterprise !== 1).map((item) => item.notRecommendedReason || item.optimizationSuggestion), 8);
  const contentGapItems = uniqueNonEmpty(analyses.map((item) => item.contentGap), 10);
  const gapDiagnostics = buildContentGapDiagnostics(project, analyses);
  const manuallyReviewedAnalyses = analyses.filter((item) => Boolean(item.manuallyReviewed));
  const manualReviewEvidence = uniqueNonEmpty(
    manuallyReviewedAnalyses.flatMap((item) => [
      item.questionText,
      item.recommendationReason,
      item.notRecommendedReason,
      item.contentGap,
      item.optimizationSuggestion
    ]),
    8
  );
  const manualReviewSummary = manuallyReviewedAnalyses.length > 0 ? `\u672C\u8F6E\u6709 ${manuallyReviewedAnalyses.length} \u6761 AI \u5206\u6790\u7ECF\u8FC7\u4EBA\u5DE5\u4FEE\u8BA2\uFF0C\u62A5\u544A\u3001\u8BC4\u5206\u3001\u4EFB\u52A1\u548C\u6A21\u677F\u5E94\u4F18\u5148\u91C7\u7528\u4FEE\u8BA2\u540E\u7684\u7ED3\u8BBA\u3002\u4EBA\u5DE5\u4FEE\u8BA2\u8865\u5145\u7684\u5173\u952E\u8BC1\u636E\u5305\u62EC\uFF1A${manualReviewEvidence.join("\uFF1B")}\u3002` : "\u672C\u8F6E\u672A\u68C0\u6D4B\u5230\u4EBA\u5DE5\u4FEE\u8BA2\u6837\u672C\uFF0C\u62A5\u544A\u4EC5\u57FA\u4E8E AI \u539F\u59CB\u8BED\u4E49\u5206\u6790\u751F\u6210\u3002";
  const sampleLimitNotice = sampleCount < 30 ? `\u672C\u8F6E**\u6837\u672C\u91CF\u6709\u9650**\uFF0C\u5B9E\u9645\u6837\u672C\u4E3A ${sampleCount} \u6761\uFF0C\u9002\u5408\u4F5C\u4E3A P0 \u521D\u6B65\u8BCA\u65AD\u548C\u884C\u52A8\u6392\u5E8F\u4F9D\u636E\uFF0C\u4F46\u4E0D\u4EE3\u8868\u5168\u7F51\u7EDD\u5BF9\u6392\u540D\uFF0C\u4E5F\u4E0D\u5E94\u88AB\u5938\u5927\u4E3A\u5168\u7F51\u7ED3\u8BBA\uFF1B\u5373\u4FBF\u6837\u672C\u91CF\u6709\u9650\uFF0C\u62A5\u544A\u4ECD\u5E94\u5B8C\u6574\u5448\u73B0\u95EE\u9898\u94FE\u8DEF\u3001\u4EBA\u5DE5\u4FEE\u8BA2\u7ED3\u8BBA\u3001\u7ADE\u54C1\u5DEE\u8DDD\u548C 30 \u5929\u884C\u52A8\u8BA1\u5212\uFF0C\u800C\u4E0D\u80FD\u9000\u56DE\u77ED\u62A5\u544A\u3002` : `\u672C\u8F6E\u6837\u672C\u91CF\u4E3A ${sampleCount} \u6761\uFF0C\u53EF\u7528\u4E8E\u89C2\u5BDF\u5F53\u524D AI \u641C\u7D22\u4E2D\u7684\u4E3B\u8981\u8D8B\u52BF\uFF0C\u4F46\u4E0D\u4EE3\u8868\u5168\u7F51\u7EDD\u5BF9\u6392\u540D\u3002`;
  const coverageStats = questionStats ?? { totalQuestions: sampleCount, aiGeneratedQuestions: sampleCount, specifiedQuestions: 0 };
  const questionCoverageSummary = `\u5F53\u524D\u95EE\u9898\u5E93\u5171 ${coverageStats.totalQuestions} \u6761\u95EE\u9898\uFF0C\u5176\u4E2D AI \u751F\u6210\u95EE\u9898 ${coverageStats.aiGeneratedQuestions} \u6761\uFF0C\u5BA2\u6237\u6307\u5B9A\u95EE\u9898 ${coverageStats.specifiedQuestions} \u6761\u3002`;
  const oneSentenceConclusion = `${project.enterpriseName} \u5F53\u524D\u5728 AI \u641C\u7D22\u4E2D\u7684\u53EF\u89C1\u5EA6\u504F\u5F31\uFF1A${sampleCount} \u6761 AI \u56DE\u7B54\u4E2D\u4EC5 ${mentioned} \u6761\u63D0\u53CA\u3001${recommended} \u6761\u63A8\u8350\u3001${wins} \u6761\u663E\u793A\u672C\u4F01\u4E1A\u80DC\u51FA\uFF0CGEO \u603B\u5206 ${scoreDetail.totalScore}\uFF0C\u7B49\u7EA7\u4E3A\u300C${scoreDetail.visibilityLevel}\u300D\uFF1B\u4E0B\u4E00\u6B65\u5E94\u4F18\u5148\u8865\u9F50\u5B98\u7F51\u5B9A\u4F4D\u9875\u3001\u7ADE\u54C1\u5BF9\u6BD4\u9875\u3001FAQ\u3001\u5BA2\u6237\u6848\u4F8B\u548C\u884C\u4E1A\u9009\u578B\u5185\u5BB9\uFF0C\u8BA9 AI \u6709\u660E\u786E\u3001\u53EF\u4FE1\u3001\u53EF\u5F15\u7528\u7684\u63A8\u8350\u4F9D\u636E\u3002`;
  const mentionRecommendationSummary = `\u5171\u5206\u6790 ${sampleCount} \u6761 AI \u56DE\u7B54\uFF0C\u5176\u4E2D ${mentioned} \u6761\u63D0\u5230\u672C\u4F01\u4E1A\uFF0C${recommended} \u6761\u63A8\u8350\u672C\u4F01\u4E1A\uFF0C${wins} \u6761\u5728\u7ADE\u54C1\u5BF9\u6BD4\u4E2D\u4F53\u73B0\u672C\u4F01\u4E1A\u80DC\u51FA\u3002`;
  const competitorAnalysis = competitorNames.length > 0 ? `AI \u56DE\u7B54\u4E2D\u66F4\u5BB9\u6613\u51FA\u73B0\u6216\u63A8\u8350\u7684\u7ADE\u54C1\u5305\u62EC\uFF1A${competitorNames.join("\u3001")}\u3002\u8FD9\u8BF4\u660E\u7ADE\u54C1\u516C\u5F00\u8BED\u6599\u3001\u529F\u80FD\u63CF\u8FF0\u6216\u5E02\u573A\u8BA4\u77E5\u66F4\u5BB9\u6613\u88AB AI \u8C03\u7528\u3002` : "\u672C\u8F6E\u5206\u6790\u672A\u8BC6\u522B\u5230\u660E\u786E\u88AB\u63A8\u8350\u7ADE\u54C1\uFF0C\u4F46\u4ECD\u9700\u8865\u5145\u7ADE\u54C1\u5BF9\u6BD4\u5185\u5BB9\uFF0C\u907F\u514D\u540E\u7EED\u6837\u672C\u6269\u5927\u540E\u51FA\u73B0\u5355\u65B9\u9762\u5931\u4F4D\u3002";
  const coreProblems = notRecommendedReasons.length > 0 ? notRecommendedReasons.join("\uFF1B") : "\u5F53\u524D\u672A\u63A8\u8350\u539F\u56E0\u4E0D\u8DB3\uFF0C\u4F46\u4ECE\u8BC4\u5206\u770B\u4ECD\u9700\u8865\u8DB3\u53EF\u5F15\u7528\u5185\u5BB9\u8D44\u4EA7\u3002";
  const contentGaps = contentGapItems.length > 0 ? contentGapItems.join("\uFF1B") : "\u5F53\u524D\u5206\u6790\u672A\u53D1\u73B0\u660E\u786E\u5185\u5BB9\u7F3A\u53E3\u3002";
  const thirtyDayActions = "P0\uFF1A7 \u5929\u5185\u5B8C\u6210\u5B98\u7F51\u5B9A\u4F4D\u9875\u3001\u4EA7\u54C1\u80FD\u529B\u8BF4\u660E\u3001\u7ADE\u54C1\u5BF9\u6BD4\u9875\u548C FAQ\uFF1BP1\uFF1A\u7B2C 8-21 \u5929\u5B8C\u6210\u5BA2\u6237\u6848\u4F8B\u91C7\u96C6\u3001\u884C\u4E1A\u9009\u578B\u6587\u7AE0\u548C\u7B2C\u4E09\u65B9\u4FE1\u4EFB\u6E90\u94FA\u8BBE\uFF1BP2\uFF1A\u7B2C 22-30 \u5929\u5C06\u6838\u5FC3\u5185\u5BB9\u6539\u5199\u4E3A\u516C\u4F17\u53F7\u3001\u77E5\u4E4E\u6216\u793E\u5A92\u5185\u5BB9\uFF0C\u5E76\u51C6\u5907\u540C\u4E00\u6279\u9AD8\u610F\u5411\u95EE\u9898\u590D\u6D4B\u3002";
  const rawScoreSummary = rawScore && rawScore.totalScore !== scoreDetail.totalScore ? `\u539F\u59CB AI \u5206\u6790\u8BA1\u7B97\u4E3A **${rawScore.totalScore} \u5206**\uFF0C\u7B49\u7EA7\u4E3A **${rawScore.visibilityLevel}**\uFF1B\u4EBA\u5DE5\u4FEE\u8BA2\u540E\u6709\u6548\u8BC4\u5206\u4E3A **${scoreDetail.totalScore} \u5206**\uFF0C\u7B49\u7EA7\u4E3A **${scoreDetail.visibilityLevel}**\u3002\u8FD9\u6B21\u53D8\u5316\u4E0D\u662F\u56E0\u4E3A\u7CFB\u7EDF\u7F16\u9020\u4E86\u65B0\u6570\u636E\uFF0C\u800C\u662F\u56E0\u4E3A\u4EBA\u5DE5\u590D\u6838\u628A ${manuallyReviewedAnalyses.length} \u6761\u6837\u672C\u4E2D\u7684\u63D0\u53CA\u3001\u63A8\u8350\u3001\u80DC\u51FA\u3001\u7ADE\u54C1\u4E0E\u5185\u5BB9\u7F3A\u53E3\u5224\u65AD\u4FEE\u6B63\u4E3A\u66F4\u7B26\u5408\u771F\u5B9E\u4E1A\u52A1\u8BED\u5883\u7684\u7ED3\u8BBA\u3002\u5206\u9879\u53D8\u5316\u4E3A\uFF1AAI \u53EF\u89C1\u5EA6 ${rawScore.aiVisibilityScore ?? derivedScore.aiVisibilityScore}\u2192${scoreDetail.aiVisibilityScore}\uFF0CAI \u63A8\u8350\u7387 ${rawScore.aiRecommendationScore ?? derivedScore.aiRecommendationScore}\u2192${scoreDetail.aiRecommendationScore}\uFF0C\u7ADE\u54C1\u80DC\u51FA\u7387 ${rawScore.competitorWinScore ?? derivedScore.competitorWinScore}\u2192${scoreDetail.competitorWinScore}\uFF0C\u8BA4\u77E5\u51C6\u786E\u7387 ${rawScore.cognitionAccuracyScore ?? derivedScore.cognitionAccuracyScore}\u2192${scoreDetail.cognitionAccuracyScore}\uFF0C\u5185\u5BB9\u8D44\u4EA7\u5B8C\u6574\u5EA6 ${rawScore.contentAssetScore ?? derivedScore.contentAssetScore}\u2192${scoreDetail.contentAssetScore}\u3002` : `\u5F53\u524D\u6709\u6548\u8BC4\u5206\u4E3A **${scoreDetail.totalScore} \u5206**\uFF0C\u7B49\u7EA7\u4E3A **${scoreDetail.visibilityLevel}**\u3002\u672C\u8F6E\u6CA1\u6709\u68C0\u6D4B\u5230\u4E0E\u5F53\u524D\u6709\u6548\u8BC4\u5206\u4E0D\u540C\u7684\u539F\u59CB\u8BC4\u5206\u7248\u672C\uFF0C\u56E0\u6B64\u62A5\u544A\u6309\u5F53\u524D\u5206\u6790\u7ED3\u8BBA\u89E3\u91CA\u5206\u6570\u3002`;
  const scoreRows = [
    ["GEO \u603B\u5206", `${scoreDetail.totalScore}`, `\u7B49\u7EA7\u4E3A\u300C${scoreDetail.visibilityLevel}\u300D\uFF0C\u8BF4\u660E\u5F53\u524D\u54C1\u724C\u5E76\u975E\u5B8C\u5168\u4E0D\u53EF\u89C1\uFF0C\u4F46\u5728\u9AD8\u610F\u5411\u95EE\u9898\u4E2D\u7684\u7A33\u5B9A\u51FA\u73B0\u548C\u88AB\u63A8\u8350\u80FD\u529B\u4E0D\u8DB3\u3002`],
    ["AI \u53EF\u89C1\u5EA6", `${scoreDetail.aiVisibilityScore}`, `${mentioned}/${sampleCount} \u6761\u56DE\u7B54\u63D0\u53CA ${project.enterpriseName}\u3002\u5206\u6570\u504F\u4F4E\u4F1A\u5BFC\u81F4\u6F5C\u5728\u5BA2\u6237\u5728 AI \u641C\u7D22\u9636\u6BB5\u770B\u4E0D\u5230\u54C1\u724C\u3002`],
    ["AI \u63A8\u8350\u7387", `${scoreDetail.aiRecommendationScore}`, `${recommended}/${sampleCount} \u6761\u56DE\u7B54\u63A8\u8350 ${project.enterpriseName}\u3002\u63A8\u8350\u7387\u504F\u4F4E\u610F\u5473\u7740 AI \u5373\u4F7F\u7406\u89E3\u884C\u4E1A\uFF0C\u4E5F\u672A\u628A\u54C1\u724C\u653E\u5165\u4F18\u5148\u5019\u9009\u3002`],
    ["\u7ADE\u54C1\u80DC\u51FA\u7387", `${scoreDetail.competitorWinScore}`, `${wins}/${sampleCount} \u6761\u56DE\u7B54\u4F53\u73B0\u672C\u4F01\u4E1A\u80DC\u51FA\u3002\u8BE5\u9879\u504F\u4F4E\u4F1A\u8BA9\u5BF9\u6BD4\u578B\u641C\u7D22\u66F4\u5BB9\u6613\u6D41\u5411 ${joinOrFallback(competitorNames, "\u7ADE\u54C1")}\u3002`],
    ["\u8BA4\u77E5\u51C6\u786E\u7387", `${scoreDetail.cognitionAccuracyScore}`, `${sampleCount - misconceptionCount}/${sampleCount} \u6761\u672A\u6807\u8BB0\u660E\u663E\u9519\u8BEF\u8BA4\u77E5\u3002\u8BE5\u9879\u8F83\u9AD8\u8BF4\u660E\u4E0D\u662F\u4E25\u91CD\u8BEF\u8BFB\uFF0C\u4E3B\u8981\u95EE\u9898\u662F\u8D44\u6599\u4E0D\u8DB3\u548C\u63A8\u8350\u4F9D\u636E\u4E0D\u8DB3\u3002`],
    ["\u5185\u5BB9\u8D44\u4EA7\u5B8C\u6574\u5EA6", `${scoreDetail.contentAssetScore}`, `${noGap}/${sampleCount} \u6761\u672A\u53D1\u73B0\u660E\u663E\u5185\u5BB9\u7F3A\u53E3\u3002\u8BE5\u9879\u8D8A\u4F4E\uFF0C\u8D8A\u8BF4\u660E\u5B98\u7F51\u3001FAQ\u3001\u6848\u4F8B\u3001\u5BF9\u6BD4\u9875\u7B49\u53EF\u5F15\u7528\u8D44\u4EA7\u4E0D\u8DB3\u3002`]
  ];
  const specifiedQuestionBusinessMeaning = coverageStats.specifiedQuestions > 0 ? `\u5BA2\u6237\u6307\u5B9A\u95EE\u9898 ${coverageStats.specifiedQuestions} \u6761\u7684\u4E1A\u52A1\u610F\u4E49\u5728\u4E8E\uFF1A\u8FD9\u4E9B\u95EE\u9898\u4E0D\u662F\u6CDB\u6CDB\u7684\u6D41\u91CF\u8BCD\uFF0C\u800C\u662F\u76F4\u63A5\u8986\u76D6\u77E5\u8BC6\u4ED8\u8D39 SaaS \u9009\u578B\u3001\u8001\u5E08\u5356\u8BFE\u7CFB\u7EDF\u3001\u6559\u80B2\u57F9\u8BAD\u673A\u6784\u79C1\u57DF\u7ECF\u8425\u3001\u4F01\u4E1A AI \u7ECF\u8425\u7CFB\u7EDF\u3001AI \u8F6C\u578B\u670D\u52A1\u5546\u3001\u8BFE\u7A0B\u552E\u5356\u4E0E\u76F4\u64AD\u8F6C\u5316\uFF0C\u4EE5\u53CA ${project.enterpriseName} \u4E0E ${joinOrFallback(project.competitorNames, "\u6838\u5FC3\u7ADE\u54C1")} \u7684\u9009\u62E9\u6BD4\u8F83\u3002\u5B83\u4EEC\u66F4\u63A5\u8FD1\u771F\u5B9E\u5BA2\u6237\u5728\u91C7\u8D2D\u524D\u4F1A\u95EE AI \u7684\u9AD8\u610F\u5411\u95EE\u9898\uFF0C\u56E0\u6B64\u62A5\u544A\u5FC5\u987B\u628A\u8FD9\u4E9B\u95EE\u9898\u4F5C\u4E3A P0 \u4F18\u5148\u7EA7\u8F93\u5165\uFF0C\u800C\u4E0D\u662F\u53EA\u6309 AI \u81EA\u52A8\u751F\u6210\u95EE\u9898\u505A\u5E73\u5747\u5224\u65AD\u3002` : "\u672C\u8F6E\u5C1A\u672A\u5BFC\u5165\u5BA2\u6237\u6307\u5B9A\u95EE\u9898\uFF0C\u56E0\u6B64\u65E0\u6CD5\u5355\u72EC\u5224\u65AD\u5BA2\u6237\u7ED9\u5B9A\u9AD8\u610F\u5411\u95EE\u9898\u7684\u4E1A\u52A1\u610F\u4E49\uFF0C\u540E\u7EED\u5E94\u4F18\u5148\u8865\u5145\u6307\u5B9A\u95EE\u9898\u96C6\u3002";
  const actionEvidenceSummary = `\u4E0B\u8868\u4EFB\u52A1\u6765\u81EA\u672C\u8F6E\u771F\u5B9E\u5206\u6790\u548C\u4EBA\u5DE5\u4FEE\u8BA2\u7ED3\u679C\uFF1A\u5185\u5BB9\u7F3A\u53E3\u5305\u62EC ${contentGaps}\uFF1B\u63A8\u8350\u7406\u7531\u5305\u62EC ${recommendationReasons.length > 0 ? recommendationReasons.join("\uFF1B") : "\u6837\u672C\u4E2D\u63A8\u8350\u7406\u7531\u4E0D\u8DB3"}\uFF1B\u4EBA\u5DE5\u4FEE\u8BA2\u8BC1\u636E\u5305\u62EC ${manualReviewEvidence.length > 0 ? manualReviewEvidence.join("\uFF1B") : "\u672C\u8F6E\u65E0\u4EBA\u5DE5\u4FEE\u8BA2\u8BC1\u636E"}\u3002`;
  const actionRows = [
    ["P0", `\u91CD\u5199 ${project.enterpriseName} \u5B98\u7F51\u5B9A\u4F4D\u9875`, "AI \u63D0\u53CA\u7387\u548C\u63A8\u8350\u7387\u4F4E\uFF0C\u9700\u8981\u5148\u8BA9 AI \u660E\u786E\u77E5\u9053\u4F01\u4E1A\u662F\u8C01\u3001\u670D\u52A1\u8C01\u3001\u89E3\u51B3\u4EC0\u4E48\u95EE\u9898", "\u5B98\u7F51\u5B9A\u4F4D\u9875\u3001\u4EA7\u54C1\u80FD\u529B\u8BF4\u660E\u9875", "\u5B98\u7F51\u9996\u9875 GEO \u4F18\u5316\u7A3F\u3001\u4EA7\u54C1\u80FD\u529B\u6A21\u5757\u8BF4\u660E", "\u63D0\u5347 AI \u53EF\u89C1\u5EA6\u4E0E\u8BA4\u77E5\u51C6\u786E\u7387"],
    ["P0", `\u53D1\u5E03 ${project.enterpriseName} \u4E0E ${joinOrFallback(project.competitorNames.slice(0, 3), "\u4E3B\u8981\u7ADE\u54C1")} \u5BF9\u6BD4\u9875`, "\u7ADE\u54C1\u5728\u56DE\u7B54\u4E2D\u66F4\u5BB9\u6613\u51FA\u73B0\uFF0C\u9700\u8981\u63D0\u4F9B\u5BA2\u89C2\u5DEE\u5F02\u5316\u4F9D\u636E", "\u7ADE\u54C1\u5BF9\u6BD4\u9875", "\u7ADE\u54C1\u5BF9\u6BD4\u9875 Markdown \u521D\u7A3F", "\u964D\u4F4E\u7ADE\u54C1\u5355\u65B9\u9762\u80DC\u51FA\u6982\u7387"],
    ["P0", `\u8865\u9F50 ${project.industry} \u9AD8\u9891 FAQ`, "\u9AD8\u610F\u5411\u95EE\u9898\u9700\u8981\u76F4\u63A5\u3001\u7ED3\u6784\u5316\u3001\u53EF\u5F15\u7528\u7B54\u6848", "FAQ", "\u4E0D\u5C11\u4E8E 20 \u4E2A\u95EE\u7B54", "\u63D0\u5347 AI \u53EF\u89C1\u5EA6\u548C\u5185\u5BB9\u8D44\u4EA7\u5B8C\u6574\u5EA6"],
    ["P1", "\u5EFA\u7ACB\u5BA2\u6237\u6848\u4F8B\u91C7\u96C6\u4E0E\u53D1\u5E03\u673A\u5236", "AI \u63A8\u8350\u9700\u8981\u8BC1\u636E\uFF0C\u4E0D\u80FD\u53EA\u9760\u5356\u70B9\u63CF\u8FF0", "\u5BA2\u6237\u6848\u4F8B\u9875", "\u6848\u4F8B\u91C7\u96C6\u8868\u3001\u533F\u540D\u6848\u4F8B\u9875\u3001\u6388\u6743\u6848\u4F8B\u9875", "\u63D0\u5347\u63A8\u8350\u7406\u7531\u53EF\u4FE1\u5EA6"],
    ["P1", `\u53D1\u5E03 ${project.industry} \u9009\u578B\u6307\u5357`, "\u884C\u4E1A\u63A8\u8350\u95EE\u9898\u9700\u8981\u4E2D\u7ACB\u9009\u578B\u6846\u67B6", "\u884C\u4E1A\u9009\u578B\u6587\u7AE0", "\u9009\u578B\u6307\u5357\u957F\u6587", "\u63D0\u5347\u884C\u4E1A\u63A8\u8350\u7C7B\u95EE\u9898\u51FA\u73B0\u7387"],
    ["P1", "\u8865\u5145\u7B2C\u4E09\u65B9\u4FE1\u4EFB\u6E90", "AI \u4E0D\u53EA\u770B\u5B98\u7F51\uFF0C\u4E5F\u4F1A\u53C2\u8003\u516C\u5F00\u8BA8\u8BBA\u548C\u5916\u90E8\u5F15\u7528", "\u7B2C\u4E09\u65B9\u4FE1\u4EFB\u6E90", "\u516C\u4F17\u53F7\u3001\u77E5\u4E4E\u3001\u5A92\u4F53\u7A3F\u3001\u5BA2\u6237\u8BBF\u8C08", "\u63D0\u5347\u63A8\u8350\u7A33\u5B9A\u6027"],
    ["P2", "\u5C06\u6838\u5FC3\u9875\u9762\u6539\u5199\u4E3A\u77ED\u5185\u5BB9\u77E9\u9635", "\u7AD9\u5916\u8BED\u6599\u53EF\u8F85\u52A9\u7EA0\u504F\u548C\u8865\u5145\u54C1\u724C\u8BA4\u77E5", "\u793E\u5A92\u5185\u5BB9", "10 \u6761\u77ED\u5185\u5BB9\u9009\u9898\u4E0E\u53D1\u5E03\u8BA1\u5212", "\u6269\u5927\u53EF\u5F15\u7528\u8BED\u6599\u8986\u76D6\u9762"]
  ];
  const markdownContent = `# ${project.enterpriseName} GEO \u8BCA\u65AD\u62A5\u544A

## 1. \u62A5\u544A\u6458\u8981
\u672C\u62A5\u544A\u57FA\u4E8E ${project.enterpriseName} \u7684\u771F\u5B9E\u9879\u76EE\u4FE1\u606F\u3001\u5DF2\u5BFC\u5165\u7684 ${sampleCount} \u6761 AI \u56DE\u7B54\u3001\u5BF9\u5E94 AI \u8BED\u4E49\u5206\u6790\u7ED3\u679C\u548C GEO \u8BC4\u5206\u751F\u6210\uFF0C\u4E0D\u4F7F\u7528\u865A\u6784\u6837\u672C\u6216\u865A\u6784\u5BA2\u6237\u6848\u4F8B\u3002\u5F53\u524D GEO \u603B\u5206\u4E3A **${scoreDetail.totalScore} \u5206**\uFF0C\u7B49\u7EA7\u4E3A **${scoreDetail.visibilityLevel}**\u3002${mentionRecommendationSummary} ${questionCoverageSummary} ${manualReviewSummary} \u6700\u5927\u95EE\u9898\u4E0D\u662F AI \u5B8C\u5168\u8BEF\u89E3\u4F01\u4E1A\uFF0C\u800C\u662F AI \u5728\u591A\u6570\u9AD8\u610F\u5411\u95EE\u9898\u4E2D\u6CA1\u6709\u7A33\u5B9A\u63D0\u53CA\u548C\u63A8\u8350 ${project.enterpriseName}\uFF1B\u6700\u5927\u673A\u4F1A\u662F\u4F01\u4E1A\u5356\u70B9\u4E2D\u5DF2\u7ECF\u5305\u542B ${project.coreSellingPoints}\uFF0C\u53EA\u8981\u628A\u8FD9\u4E9B\u80FD\u529B\u8F6C\u5316\u4E3A\u5B98\u7F51\u5B9A\u4F4D\u3001FAQ\u3001\u7ADE\u54C1\u5BF9\u6BD4\u3001\u6848\u4F8B\u548C\u884C\u4E1A\u9009\u578B\u5185\u5BB9\uFF0C\u5C31\u6709\u673A\u4F1A\u63D0\u5347 AI \u53EF\u5F15\u7528\u6027\u3002${sampleLimitNotice}

## 2. \u4E00\u53E5\u8BDD\u7ED3\u8BBA
${oneSentenceConclusion}

## 3. GEO \u603B\u5206\u4E0E\u5206\u9879\u8BC4\u5206
| \u6307\u6807 | \u5206\u6570 | \u89E3\u91CA |
|---|---:|---|
${scoreRows.map((row) => `| ${row[0]} | ${row[1]} | ${row[2]} |`).join("\n")}

${rawScoreSummary}

\u4ECE\u4E1A\u52A1\u542B\u4E49\u770B\uFF0C${scoreDetail.totalScore} \u5206\u7684\u201C${scoreDetail.visibilityLevel}\u201D\u610F\u5473\u7740\u6F5C\u5728\u5BA2\u6237\u5728\u5411 AI \u63D0\u95EE\u65F6\uFF0C\u7CFB\u7EDF\u66F4\u53EF\u80FD\u770B\u5230\u7ADE\u54C1\u6216\u901A\u7528\u5E73\u53F0\uFF0C\u800C\u4E0D\u662F\u7A33\u5B9A\u770B\u5230 ${project.enterpriseName}\u3002\u8FD9\u4F1A\u5F71\u54CD\u4E24\u4E2A\u73AF\u8282\uFF1A\u4E00\u662F\u83B7\u5BA2\u524D\u7F6E\u9636\u6BB5\uFF0C\u5BA2\u6237\u8FD8\u6CA1\u8FDB\u5165\u5B98\u7F51\u5C31\u88AB\u5176\u4ED6\u5E73\u53F0\u5360\u636E\u5FC3\u667A\uFF1B\u4E8C\u662F\u54C1\u724C\u8BA4\u77E5\u9636\u6BB5\uFF0CAI \u5373\u4F7F\u5076\u5C14\u63D0\u53CA ${project.enterpriseName}\uFF0C\u4E5F\u7F3A\u5C11\u5145\u5206\u7406\u7531\u628A\u5B83\u4F5C\u4E3A\u4F18\u5148\u63A8\u8350\u3002

## 4. AI \u53EF\u89C1\u5EA6\u5206\u6790
\u672C\u8F6E\u95EE\u9898\u5E93\u8986\u76D6\u60C5\u51B5\u4E3A\uFF1A**${coverageStats.totalQuestions} \u6761\u95EE\u9898**\uFF0C\u5176\u4E2D **${coverageStats.aiGeneratedQuestions} \u6761 AI \u751F\u6210\u95EE\u9898**\u3001**${coverageStats.specifiedQuestions} \u6761\u5BA2\u6237\u6307\u5B9A\u95EE\u9898**\u3002${specifiedQuestionBusinessMeaning} \u672C\u8F6E\u603B\u5171\u5206\u6790\u4E86 **${sampleCount} \u6761 AI \u56DE\u7B54**\u3002\u5176\u4E2D\uFF0C${project.enterpriseName} \u88AB\u63D0\u53CA **${mentioned} \u6B21**\uFF0C\u88AB\u63A8\u8350 **${recommended} \u6B21**\uFF0C\u5728\u7ADE\u54C1\u5BF9\u6BD4\u4E2D\u4F53\u73B0\u80DC\u51FA **${wins} \u6B21**\u3002\u51FA\u73B0 ${project.enterpriseName} \u7684\u95EE\u9898\u5305\u62EC\uFF1A${mentionQuestions.length > 0 ? mentionQuestions.join("\uFF1B") : "\u5F53\u524D\u62A5\u544A\u751F\u6210\u4E0A\u4E0B\u6587\u672A\u53D6\u5F97\u9010\u9898\u6587\u672C\uFF0C\u9700\u5728\u540E\u7EED\u590D\u6D4B\u4E2D\u4FDD\u7559\u95EE\u9898\u4E0E\u5206\u6790\u6620\u5C04\u3002"} \u88AB\u63A8\u8350\u7684\u95EE\u9898\u5305\u62EC\uFF1A${recommendedQuestions.length > 0 ? recommendedQuestions.join("\uFF1B") : "\u672C\u8F6E\u63A8\u8350\u6837\u672C\u8F83\u5C11\uFF0C\u9700\u4F18\u5148\u63D0\u5347\u63A8\u8350\u4F9D\u636E\u3002"}

\u66F4\u503C\u5F97\u5173\u6CE8\u7684\u662F\u7F3A\u5E2D\u95EE\u9898\u3002${absentHighIntentQuestions.length > 0 ? `\u5728\u8FD9\u4E9B\u9AD8\u610F\u5411\u95EE\u9898\u4E2D\uFF0C${project.enterpriseName} \u6CA1\u6709\u88AB\u63D0\u53CA\uFF1A${absentHighIntentQuestions.join("\uFF1B")}\u3002` : "\u672C\u8F6E\u672A\u6355\u6349\u5230\u660E\u786E\u7684\u9AD8\u610F\u5411\u7F3A\u5E2D\u9898\u76EE\u6587\u672C\uFF0C\u4F46\u4ECE\u63D0\u53CA\u7387\u770B\u4ECD\u5B58\u5728\u53EF\u89C1\u5EA6\u4E0D\u8DB3\u3002"} \u8FD9\u4E9B\u95EE\u9898\u5F80\u5F80\u5BF9\u5E94\u5BA2\u6237\u9009\u578B\u3001\u8D2D\u4E70\u548C\u7ADE\u54C1\u6BD4\u8F83\uFF0C\u5982\u679C\u54C1\u724C\u7F3A\u5E2D\uFF0C\u610F\u5473\u7740\u5BA2\u6237\u5728 AI \u641C\u7D22\u4E2D\u53EF\u80FD\u76F4\u63A5\u8FDB\u5165\u7ADE\u54C1\u5217\u8868\u6216\u901A\u7528\u5E73\u53F0\u63A8\u8350\u5217\u8868\u3002

## 5. AI \u63A8\u8350\u4E0E\u7ADE\u54C1\u5BF9\u6BD4
${competitorAnalysis} \u4ECE\u5206\u6790\u7ED3\u679C\u770B\uFF0C\u7ADE\u54C1\u88AB\u63A8\u8350\u7684\u4E3B\u8981\u539F\u56E0\u901A\u5E38\u662F\u516C\u5F00\u8D44\u6599\u66F4\u5B8C\u6574\u3001\u4EA7\u54C1\u80FD\u529B\u66F4\u5BB9\u6613\u88AB AI \u5F52\u7C7B\u3001\u5DF2\u6709\u5E02\u573A\u8BA4\u77E5\u66F4\u5F3A\uFF0C\u6216\u5728\u77E5\u8BC6\u4ED8\u8D39\u5E73\u53F0\u3001\u8BFE\u7A0B\u4EA4\u4ED8\u3001\u79C1\u57DF\u7ECF\u8425\u7B49\u901A\u7528\u573A\u666F\u4E2D\u8BED\u6599\u66F4\u591A\u3002${competitorAnalysisItems.length > 0 ? `\u672C\u8F6E\u4E0E\u7ADE\u54C1\u76F8\u5173\u7684\u5206\u6790\u4F9D\u636E\u5305\u62EC\uFF1A${competitorAnalysisItems.join("\uFF1B")}\u3002` : "\u672C\u8F6E\u7ADE\u54C1\u63A8\u8350\u539F\u56E0\u6837\u672C\u6709\u9650\uFF0C\u540E\u7EED\u590D\u6D4B\u5E94\u7EE7\u7EED\u89C2\u5BDF\u7ADE\u54C1\u88AB\u63A8\u8350\u7684\u5177\u4F53\u7406\u7531\u3002"}

${project.enterpriseName} \u88AB\u63A8\u8350\u65F6\u7684\u4E3B\u8981\u7406\u7531\u662F\uFF1A${recommendationReasons.length > 0 ? recommendationReasons.join("\uFF1B") : `\u6837\u672C\u4E2D\u63A8\u8350\u7406\u7531\u4E0D\u8DB3\uFF0C\u9700\u8981\u901A\u8FC7\u5B98\u7F51\u548C\u6848\u4F8B\u5185\u5BB9\u660E\u786E ${project.coreSellingPoints} \u7684\u4E1A\u52A1\u4EF7\u503C\u3002`} \u5F53\u524D\u6700\u5927\u7ADE\u4E89\u5DEE\u8DDD\u5728\u4E8E\uFF1A\u7ADE\u54C1\u66F4\u5BB9\u6613\u88AB AI \u8BC6\u522B\u4E3A\u201C\u53EF\u9009\u5E73\u53F0\u201D\uFF0C\u800C ${project.enterpriseName} \u7684 AI \u5B9A\u4F4D\u3001AI \u8BCA\u65AD\u548C AI \u7ECF\u8425\u7CFB\u7EDF\u80FD\u529B\u8FD8\u6CA1\u6709\u5F62\u6210\u8DB3\u591F\u6E05\u6670\u3001\u53EF\u5F15\u7528\u3001\u53EF\u9A8C\u8BC1\u7684\u516C\u5F00\u5185\u5BB9\u3002

## 6. AI \u54C1\u724C\u8BA4\u77E5\u95EE\u9898
AI \u5F53\u524D\u5BF9 ${project.enterpriseName} \u7684\u7406\u89E3\u4ECD\u5904\u5728\u201C\u5076\u5C14\u8BC6\u522B\u3001\u63A8\u8350\u4E0D\u8DB3\u201D\u7684\u9636\u6BB5\u3002\u8BA4\u77E5\u51C6\u786E\u7387\u4E3A ${scoreDetail.cognitionAccuracyScore} \u5206\uFF0C\u8BF4\u660E\u4E25\u91CD\u9519\u8BEF\u8BA4\u77E5\u4E0D\u662F\u9996\u8981\u77DB\u76FE\uFF1B\u771F\u6B63\u7684\u95EE\u9898\u662F AI \u6CA1\u6709\u5145\u5206\u7406\u89E3\u4F01\u4E1A\u7684\u6838\u5FC3\u80FD\u529B\u8FB9\u754C\uFF0C\u4E5F\u6CA1\u6709\u7A33\u5B9A\u628A ${project.enterpriseName} \u653E\u8FDB ${project.industry} \u7684\u4E3B\u6D41\u5019\u9009\u540D\u5355\u3002

AI \u5C1A\u672A\u5145\u5206\u7406\u89E3\u7684\u80FD\u529B\u5305\u62EC\uFF1A${project.coreSellingPoints}\u3002\u8FD9\u4E9B\u80FD\u529B\u5982\u679C\u53EA\u505C\u7559\u5728\u5185\u90E8\u8BDD\u672F\u6216\u9500\u552E\u4ECB\u7ECD\u4E2D\uFF0C\u800C\u6CA1\u6709\u88AB\u5199\u6210\u5B98\u7F51\u6A21\u5757\u3001FAQ\u3001\u7ADE\u54C1\u5BF9\u6BD4\u3001\u6848\u4F8B\u548C\u884C\u4E1A\u6587\u7AE0\uFF0CAI \u5C31\u7F3A\u5C11\u53EF\u5F15\u7528\u6765\u6E90\u3002\u5BF9\u5BA2\u6237\u51B3\u7B56\u7684\u5F71\u54CD\u662F\uFF1A\u5BA2\u6237\u53EF\u80FD\u77E5\u9053\u6709\u5F88\u591A\u201C\u77E5\u8BC6\u4ED8\u8D39 SaaS\u201D\u6216\u201C\u8001\u5E08\u5356\u8BFE\u5E73\u53F0\u201D\uFF0C\u4F46\u4E0D\u4F1A\u81EA\u7136\u7406\u89E3 ${project.enterpriseName} \u4E3A\u4EC0\u4E48\u4E0D\u540C\u3001\u9002\u5408\u8C01\u3001\u4F55\u65F6\u6BD4 ${joinOrFallback(project.competitorNames, "\u7ADE\u54C1")} \u66F4\u503C\u5F97\u8003\u8651\u3002

## 7. \u5185\u5BB9\u7F3A\u53E3\u8BCA\u65AD
| \u4F18\u5148\u7EA7\u5185\u5BB9\u7F3A\u53E3 | \u4E3A\u4EC0\u4E48\u7F3A | \u5F71\u54CD\u54EA\u4E9B AI \u95EE\u9898 | \u5F71\u54CD\u6307\u6807 | \u5E94\u8BE5\u600E\u4E48\u8865 |
|---|---|---|---|---|
${gapDiagnostics.map((item, index) => `| ${index + 1}. ${item.gap} | ${item.why} | ${item.questions} | ${item.metric} | ${item.action} |`).join("\n")}

\u672C\u8F6E\u9010\u9898\u5206\u6790\u4E0E\u4EBA\u5DE5\u4FEE\u8BA2\u540E\u8BC6\u522B\u7684\u5177\u4F53\u5185\u5BB9\u7F3A\u53E3\u5305\u62EC\uFF1A${contentGaps}\u3002

\u8FD9\u4E9B\u7F3A\u53E3\u5171\u540C\u6307\u5411\u4E00\u4E2A\u95EE\u9898\uFF1A${project.enterpriseName} \u9700\u8981\u628A\u201C\u4E1A\u52A1\u80FD\u529B\u201D\u7FFB\u8BD1\u6210\u201CAI \u53EF\u8BFB\u7684\u516C\u5F00\u8BC1\u636E\u201D\u3002\u4E0D\u662F\u7B80\u5355\u589E\u52A0\u5BA3\u4F20\u6587\u6848\uFF0C\u800C\u662F\u8BA9\u6BCF\u4E2A\u9875\u9762\u56DE\u7B54\u4E00\u4E2A\u660E\u786E\u95EE\u9898\uFF1A\u6211\u662F\u8C01\u3001\u9002\u5408\u8C01\u3001\u89E3\u51B3\u4EC0\u4E48\u3001\u51ED\u4EC0\u4E48\u53EF\u4FE1\u3001\u548C\u7ADE\u54C1\u600E\u4E48\u9009\u3002

## 8. 30 \u5929 GEO \u4F18\u5316\u884C\u52A8\u8BA1\u5212
${actionEvidenceSummary}
| \u4F18\u5148\u7EA7 | \u4EFB\u52A1\u540D\u79F0 | \u751F\u6210\u539F\u56E0 | \u5BF9\u5E94\u5185\u5BB9\u7F3A\u53E3 | \u5EFA\u8BAE\u4EA7\u7269 | \u9884\u671F\u5F71\u54CD |
|---|---|---|---|---|---|
${actionRows.map((row) => `| ${row[0]} | ${row[1]} | ${row[2]} | ${row[3]} | ${row[4]} | ${row[5]} |`).join("\n")}

\u6267\u884C\u987A\u5E8F\u5EFA\u8BAE\u662F\u5148\u505A P0 \u9875\u9762\uFF0C\u56E0\u4E3A\u8FD9\u4E9B\u9875\u9762\u76F4\u63A5\u5F71\u54CD AI \u662F\u5426\u77E5\u9053 ${project.enterpriseName} \u662F\u8C01\u4EE5\u53CA\u662F\u5426\u503C\u5F97\u63A8\u8350\uFF1B\u518D\u505A P1 \u8BC1\u636E\u5185\u5BB9\uFF0C\u56E0\u4E3A\u6848\u4F8B\u3001\u884C\u4E1A\u6587\u7AE0\u548C\u7B2C\u4E09\u65B9\u4FE1\u4EFB\u6E90\u4F1A\u5F71\u54CD\u63A8\u8350\u7406\u7531\uFF1B\u6700\u540E\u505A P2 \u5185\u5BB9\u77E9\u9635\uFF0C\u7528\u6765\u6269\u5927\u5916\u90E8\u8BED\u6599\u8986\u76D6\u548C\u957F\u671F\u7EA0\u504F\u3002

## 9. \u5173\u952E\u5185\u5BB9\u6A21\u677F\u6458\u8981
**\u5B98\u7F51\u9996\u9875\u4F18\u5316\u6A21\u677F\u6458\u8981\uFF1A** \u9996\u5C4F\u5FC5\u987B\u5199\u6E05 ${project.enterpriseName} \u662F\u9762\u5411 ${project.targetCustomers} \u7684 ${project.industry}\uFF0C\u6838\u5FC3\u56F4\u7ED5 ${project.coreSellingPoints}\uFF0C\u5E76\u8865\u5145\u9002\u5408/\u4E0D\u9002\u5408\u5BA2\u6237\u3001\u6838\u5FC3\u670D\u52A1\u3001\u7ADE\u54C1\u5DEE\u5F02\u548C\u884C\u52A8\u5F15\u5BFC\u3002

**FAQ \u6A21\u677F\u6458\u8981\uFF1A** \u81F3\u5C11 20 \u4E2A\u95EE\u7B54\uFF0C\u8986\u76D6\u4F01\u4E1A\u662F\u4EC0\u4E48\u3001\u9002\u5408\u8C01\u3001\u89E3\u51B3\u4EC0\u4E48\u95EE\u9898\u3001\u548C ${joinOrFallback(project.competitorNames, "\u7ADE\u54C1")} \u7684\u533A\u522B\u3001\u6838\u5FC3\u529F\u80FD\u3001\u670D\u52A1\u65B9\u5F0F\u3001\u4EF7\u683C\u5408\u4F5C\u3001\u6848\u4F8B\u3001\u5B9E\u65BD\u5468\u671F\u3001\u98CE\u9669\u548C\u9009\u62E9\u5EFA\u8BAE\u3002

**\u7ADE\u54C1\u5BF9\u6BD4\u9875\u6A21\u677F\u6458\u8981\uFF1A** \u4E0D\u505A\u8D2C\u4F4E\u7ADE\u54C1\u7684\u5BA3\u4F20\u9875\uFF0C\u800C\u662F\u6309\u76EE\u6807\u5BA2\u6237\u3001\u529F\u80FD\u80FD\u529B\u3001\u4F7F\u7528\u573A\u666F\u3001\u670D\u52A1\u6A21\u5F0F\u3001\u4F18\u52BF\u4E0D\u8DB3\u548C\u9009\u62E9\u5EFA\u8BAE\uFF0C\u89E3\u91CA ${project.enterpriseName} \u4E0E ${joinOrFallback(project.competitorNames, "\u540C\u7C7B\u5E73\u53F0")} \u7684\u9002\u914D\u5DEE\u5F02\u3002

**\u5BA2\u6237\u6848\u4F8B\u9875\u6A21\u677F\u6458\u8981\uFF1A** \u5728\u6CA1\u6709\u771F\u5B9E\u5BA2\u6237\u6570\u636E\u65F6\u8F93\u51FA\u6848\u4F8B\u91C7\u96C6\u6A21\u677F\uFF0C\u660E\u786E\u5BA2\u6237\u80CC\u666F\u3001\u539F\u59CB\u95EE\u9898\u3001\u9009\u62E9\u539F\u56E0\u3001\u89E3\u51B3\u65B9\u6848\u3001\u6267\u884C\u8FC7\u7A0B\u3001\u7ED3\u679C\u6570\u636E\u548C\u5BA2\u6237\u53CD\u9988\u5B57\u6BB5\uFF0C\u7981\u6B62\u7F16\u9020\u6848\u4F8B\u3002

**\u884C\u4E1A\u9009\u578B\u6587\u7AE0\u6A21\u677F\u6458\u8981\uFF1A** \u7528\u884C\u4E1A\u80CC\u666F\u3001\u5E38\u89C1\u8BEF\u533A\u3001\u9760\u8C31\u6807\u51C6\u3001\u4E3B\u6D41\u65B9\u6848\u5BF9\u6BD4\u548C\u4E0D\u540C\u4F01\u4E1A\u9009\u62E9\u5EFA\u8BAE\uFF0C\u5E2E\u52A9 AI \u5728\u201C\u77E5\u8BC6\u4ED8\u8D39 SaaS \u5E73\u53F0\u54EA\u4E2A\u597D\u201D\u201C\u6559\u80B2\u57F9\u8BAD\u673A\u6784\u5982\u4F55\u9009\u62E9 SaaS \u7CFB\u7EDF\u201D\u7B49\u95EE\u9898\u4E2D\u5F15\u7528 ${project.enterpriseName}\u3002

## 10. \u4E0B\u4E00\u8F6E\u590D\u6D4B\u5EFA\u8BAE
\u5EFA\u8BAE\u5728 P0 \u5185\u5BB9\u4E0A\u7EBF\u540E **14-30 \u5929** \u8FDB\u884C\u4E0B\u4E00\u8F6E\u590D\u6D4B\u3002\u590D\u6D4B\u95EE\u9898\u5E94\u4F18\u5148\u8986\u76D6\u672C\u8F6E\u9AD8\u610F\u5411\u95EE\u9898\uFF0C\u5C24\u5176\u662F\u201C\u77E5\u8BC6\u4ED8\u8D39 SaaS \u5E73\u53F0\u54EA\u4E2A\u597D\u201D\u201C\u77E5\u8BC6\u4ED8\u8D39\u8001\u5E08\u5356\u8BFE\u7528\u4EC0\u4E48\u7CFB\u7EDF\u201D\u201C${project.enterpriseName} \u548C ${project.competitorNames[0] ?? "\u4E3B\u8981\u7ADE\u54C1"} \u6709\u4EC0\u4E48\u533A\u522B\u201D\u201C\u4F01\u4E1A AI \u7ECF\u8425\u7CFB\u7EDF\u6709\u54EA\u4E9B\u670D\u52A1\u5546\u201D\u201C\u77E5\u8BC6\u4ED8\u8D39\u516C\u53F8\u600E\u4E48\u642D\u5EFA AI \u8FD0\u8425\u8BCA\u65AD\u7CFB\u7EDF\u201D\u7B49\u3002\u590D\u6D4B\u65F6\u91CD\u70B9\u770B\u4E94\u4E2A\u6307\u6807\uFF1AAI \u53EF\u89C1\u5EA6\u662F\u5426\u63D0\u5347\u3001AI \u63A8\u8350\u7387\u662F\u5426\u63D0\u5347\u3001\u7ADE\u54C1\u80DC\u51FA\u7387\u662F\u5426\u4E0B\u964D\u3001\u8BA4\u77E5\u51C6\u786E\u7387\u662F\u5426\u4FDD\u6301\u7A33\u5B9A\u3001\u5185\u5BB9\u8D44\u4EA7\u5B8C\u6574\u5EA6\u662F\u5426\u6539\u5584\u3002

\u5224\u65AD\u4F18\u5316\u662F\u5426\u6709\u6548\uFF0C\u4E0D\u5E94\u53EA\u770B\u4E00\u6B21\u56DE\u7B54\u662F\u5426\u51FA\u73B0\u54C1\u724C\uFF0C\u800C\u8981\u770B\u540C\u4E00\u6279\u95EE\u9898\u3001\u591A\u5E73\u53F0\u3001\u591A\u8F6E\u56DE\u7B54\u4E2D\uFF0C${project.enterpriseName} \u662F\u5426\u66F4\u7A33\u5B9A\u5730\u88AB\u63D0\u53CA\u3001\u662F\u5426\u88AB\u653E\u5165\u5019\u9009\u5217\u8868\u3001\u662F\u5426\u80FD\u88AB\u89E3\u91CA\u4E3A ${project.coreSellingPoints} \u76F8\u5173\u65B9\u6848\u3001\u662F\u5426\u80FD\u5728\u4E0E ${joinOrFallback(project.competitorNames, "\u7ADE\u54C1")} \u5BF9\u6BD4\u65F6\u83B7\u5F97\u6E05\u6670\u63A8\u8350\u7406\u7531\u3002`;
  return {
    oneSentenceConclusion,
    totalScore: scoreDetail.totalScore,
    mentionRecommendationSummary,
    competitorAnalysis,
    coreProblems,
    contentGaps,
    thirtyDayActions,
    markdownContent
  };
}

// server/systemConfig.ts
var SYSTEM_COMPLIANCE_RULE_NAME = "\u7CFB\u7EDF\u9ED8\u8BA4 GEO \u5408\u89C4";
var SYSTEM_FORBIDDEN_WORDS = [
  "\u4FDD\u8BC1\u6536\u5F55",
  "\u4FDD\u8BC1\u6392\u540D",
  "\u4FDD\u8BC1\u63A8\u8350",
  "\u4FDD\u8BC1\u6210\u4EA4",
  "\u767E\u5206\u767E\u8F6C\u5316",
  "\u66FF\u4EE3\u5168\u90E8\u4EBA\u5DE5",
  "\u4E00\u5B9A\u6536\u5F55",
  "\u4E00\u5B9A\u6392\u540D",
  "100%",
  "\u7EDD\u5BF9\u7B2C\u4E00",
  "\u81EA\u52A8\u4EE3\u53D1\u7B2C\u4E09\u65B9\u5E73\u53F0"
];
var SYSTEM_FORBIDDEN_CLAIMS_TEXT = [
  "\u5305\u6548\u679C",
  "\u552F\u4E00\u6307\u5B9A",
  "\u4E0D\u5207\u5B9E\u9645\u7684\u6548\u679C\u627F\u8BFA",
  "\u672A\u7ECF\u9A8C\u8BC1\u7684\u6392\u540D\u4E0E\u8F6C\u5316\u7387\u65AD\u8A00"
].join("\n");
var SYSTEM_REQUIRED_DISCLAIMERS = "\u5BF9\u5916\u53D1\u5E03\u5185\u5BB9\u987B\u6807\u6CE8\u300C\u6548\u679C\u56E0\u5BA2\u6237\u4E0E\u5E02\u573A\u800C\u5F02\u300D\uFF1B\u6D89\u53CA\u6570\u636E\u987B\u8BF4\u660E\u6765\u6E90\u6216\u5DF2\u8131\u654F\uFF1B\u4E0D\u5F97\u5C06 AI \u5F15\u7528\u7B49\u540C\u4E8E\u5B98\u65B9\u80CC\u4E66\u3002";
var SYSTEM_PUBLISH_STRATEGY_LINES = [
  "\u5BA1\u6838\u6A21\u5F0F\uFF1A\u5168\u4EBA\u5DE5\u5BA1\u6838\uFF1B\u4E0D\u81EA\u52A8\u767B\u5F55\u7B2C\u4E09\u65B9\u5E73\u53F0\u3001\u4E0D\u4FDD\u5B58\u5BA2\u6237\u5E73\u53F0\u8D26\u53F7\u5BC6\u7801\u3002",
  "\u8D28\u91CF\u9608\u503C\uFF1A\u4EE5\u7CFB\u7EDF GEO \u8D28\u68C0\u6700\u4F4E\u5206\u4E3A\u51C6\uFF1B\u4E0D\u627F\u8BFA\u6536\u5F55\u3001\u6392\u540D\u6216 AI \u63A8\u8350\u3002",
  "\u5E73\u53F0\u8FB9\u754C\uFF1A\u4EC5\u8BB0\u5F55\u4EBA\u5DE5\u53D1\u5E03\u7ED3\u679C\u4E0E\u516C\u5F00\u94FE\u63A5\uFF0C\u4E0D\u8C03\u7528\u5916\u90E8\u5E73\u53F0\u4EE3\u53D1\u6587\u63A5\u53E3\u3002"
];
function getSystemComplianceRulesForPrePublish() {
  return [
    {
      ruleName: SYSTEM_COMPLIANCE_RULE_NAME,
      forbiddenWords: [...SYSTEM_FORBIDDEN_WORDS],
      forbiddenClaims: SYSTEM_FORBIDDEN_CLAIMS_TEXT,
      requiredDisclaimers: SYSTEM_REQUIRED_DISCLAIMERS,
      enabled: 1
    }
  ];
}
function getSystemComplianceUsageLines() {
  return getSystemComplianceRulesForPrePublish().map(
    (item) => [item.ruleName, item.forbiddenClaims, item.requiredDisclaimers].filter(Boolean).join("\uFF1A")
  );
}

// server/geoArticleLogic.ts
function parseProfileStringArray(value) {
  if (Array.isArray(value)) return value.filter((x) => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
  if (typeof value === "string" && value.trim()) {
    try {
      const j = JSON.parse(value);
      if (Array.isArray(j)) return j.filter((x) => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
    } catch {
    }
  }
  return [];
}
function splitProfileLines(value) {
  return value.split(/[\n；;]+/).map((s) => s.trim()).filter(Boolean);
}
function resolveEnterpriseProfileForContent(profile) {
  const p = profile ?? {};
  const pickStr = (primary, ...fallbacks) => {
    const a = valueText(primary);
    if (a) return a;
    for (const f of fallbacks) {
      const b = valueText(f);
      if (b) return b;
    }
    return "";
  };
  const brandName = pickStr(p.brandName, p.enterpriseName);
  const productDesc = pickStr(p.productDesc, p.productServiceIntro, p.productIntro);
  const targetCustomer = pickStr(p.targetCustomer, p.targetCustomers);
  let customerPains = parseProfileStringArray(p.customerPains);
  if (customerPains.length === 0) customerPains = splitProfileLines(valueText(p.commonObjections)).slice(0, 12);
  let oneLiner = pickStr(p.oneLiner);
  if (!oneLiner) {
    const csp = valueText(p.coreSellingPoints);
    oneLiner = splitProfileLines(csp)[0] ?? "";
  }
  let keyPoints = parseProfileStringArray(p.keyPoints);
  if (keyPoints.length === 0) {
    const csp = valueText(p.coreSellingPoints);
    keyPoints = splitProfileLines(csp).slice(0, 12);
  }
  let keywords = parseProfileStringArray(p.keywords);
  if (keywords.length === 0) {
    const feat = valueText(p.featureNotes);
    keywords = splitProfileLines(feat).flatMap((line) => line.split(/[,，、]/)).map((s) => s.trim()).filter((s) => s.length >= 2).slice(0, 16);
    if (keywords.length === 0) {
      const csp = valueText(p.coreSellingPoints);
      keywords = csp.split(/[,，、]/).map((s) => s.trim()).filter((s) => s.length >= 2).slice(0, 12);
    }
  }
  return { brandName, productDesc, targetCustomer, customerPains, oneLiner, keyPoints, keywords };
}
function withResolvedEnterpriseProfile(ctx) {
  return { ...ctx, resolvedEnterpriseProfile: resolveEnterpriseProfileForContent(ctx.profile ?? null) };
}
var GEO_OPT_TASK_CARD_MARK2 = "__GEO_TASK_CARD__";
function parseOptimizationTaskCard(executionSuggestion) {
  if (!executionSuggestion?.includes(GEO_OPT_TASK_CARD_MARK2)) return null;
  const parts = executionSuggestion.split(`${GEO_OPT_TASK_CARD_MARK2}
`);
  const jsonPart = parts[1]?.trim();
  if (!jsonPart) return null;
  try {
    const j = JSON.parse(jsonPart);
    const articleTitle = typeof j.articleTitle === "string" ? j.articleTitle.trim() : "";
    const keyPoints = Array.isArray(j.keyPoints) ? j.keyPoints.filter((x) => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) : [];
    const targetKeywords = Array.isArray(j.targetKeywords) ? j.targetKeywords.filter((x) => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) : [];
    const recommendedPlatform = Array.isArray(j.recommendedPlatform) ? j.recommendedPlatform.filter((x) => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) : [];
    const contentType = typeof j.contentType === "string" ? j.contentType.trim() : "";
    return { articleTitle, keyPoints, targetKeywords, recommendedPlatform, contentType };
  } catch {
    return null;
  }
}
function contentTypeLabelToArticleType(contentType) {
  const key = contentType.trim();
  const map = {
    \u7ADE\u54C1\u5BF9\u6BD4: "\u7ADE\u54C1\u5BF9\u6BD4\u578B GEO \u6587\u7AE0",
    \u6848\u4F8B\u6587\u7AE0: "\u5B98\u7F51\u7248 GEO \u6587\u7AE0",
    \u573A\u666F\u6307\u5357: "\u884C\u4E1A\u9009\u578B\u578B GEO \u6587\u7AE0",
    FAQ: "\u95EE\u7B54\u578B GEO \u6587\u7AE0",
    \u4EA7\u54C1\u9875: "\u5B98\u7F51\u7248 GEO \u6587\u7AE0"
  };
  return map[key] ?? "\u5B98\u7F51\u7248 GEO \u6587\u7AE0";
}
var unique = (items) => Array.from(new Set(items.filter(Boolean)));
var nonEmpty = (value) => typeof value === "string" && value.trim().length > 0;
var compactTexts = (items) => items.map((item) => item?.trim()).filter((item) => Boolean(item));
var countIncludes = (content, values) => values.filter((value) => value && content.includes(value)).length;
var asBool = (value) => value === true || value === 1 || value === "1";
var valueText = (value) => typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
var jsonSummaryText = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 180);
  if (typeof value === "object") {
    const record = value;
    return [record.digest, record.title, record.keywords].flatMap((item) => Array.isArray(item) ? item : [item]).map(valueText).filter(Boolean).join("\uFF1B").slice(0, 180);
  }
  return String(value).slice(0, 180);
};
var splitGovernanceTerms = (value) => Array.isArray(value) ? value.map(valueText).filter(Boolean) : valueText(value).split(/\n|,|，|；|;/).map((item) => item.trim()).filter(Boolean);
function summarizeAssetSource(asset, category) {
  return {
    id: Number(asset.id ?? 0),
    title: valueText(asset.title) || category,
    category,
    sourceType: valueText(asset.sourceType) || category,
    trustLevel: valueText(asset.trustLevel) || null,
    isPublic: asBool(asset.isPublic),
    canUseForGeneration: asBool(asset.canUseForGeneration),
    summary: jsonSummaryText(asset.structuredSummary) || valueText(asset.contentDigest).slice(0, 180)
  };
}
function buildAssetLibraryUsage(assetLibrary) {
  const sources = assetLibrary?.assetSources ?? [];
  const profile = assetLibrary?.profile ?? null;
  const resolved = assetLibrary?.resolvedEnterpriseProfile ?? resolveEnterpriseProfileForContent(profile);
  const enterpriseDigest = compactTexts([
    resolved.brandName ? `\u4F01\u4E1A/\u54C1\u724C\uFF1A${resolved.brandName}` : "",
    resolved.targetCustomer ? `\u76EE\u6807\u5BA2\u6237\uFF1A${resolved.targetCustomer}` : "",
    resolved.customerPains.length > 0 ? `\u5BA2\u6237\u75DB\u70B9\uFF1A${resolved.customerPains.join("\u3001")}` : ""
  ]).join("\u3002").slice(0, 320);
  const productDigest = compactTexts([
    resolved.productDesc ? `\u4EA7\u54C1/\u670D\u52A1\uFF1A${resolved.productDesc}` : "",
    resolved.oneLiner ? `\u4E00\u53E5\u8BDD\uFF1A${resolved.oneLiner}` : "",
    resolved.keyPoints.length > 0 ? `\u6838\u5FC3\u5356\u70B9\uFF1A${resolved.keyPoints.join("\uFF1B")}` : "",
    resolved.keywords.length > 0 ? `\u5173\u952E\u8BCD\uFF1A${resolved.keywords.join("\u3001")}` : ""
  ]).join("\u3002").slice(0, 400);
  const profileMaterial = [
    ...enterpriseDigest ? [{
      id: -998,
      title: "\u4F01\u4E1A\u6863\u6848\xB7\u8EAB\u4EFD\u4E0E\u5BA2\u6237",
      category: "\u4F01\u4E1A\u57FA\u7840\u8D44\u6599",
      sourceType: "\u4F01\u4E1A\u6863\u6848",
      trustLevel: "\u9AD8",
      isPublic: true,
      canUseForGeneration: true,
      summary: enterpriseDigest
    }] : [],
    ...productDigest ? [{
      id: -999,
      title: "\u4F01\u4E1A\u6863\u6848\xB7\u4EA7\u54C1\u4E0E\u8868\u8FBE",
      category: "\u4EA7\u54C1\u670D\u52A1\u8D44\u6599",
      sourceType: "\u4F01\u4E1A\u6863\u6848",
      trustLevel: "\u9AD8",
      isPublic: true,
      canUseForGeneration: true,
      summary: productDigest
    }] : []
  ];
  const enterpriseMaterials = [...profileMaterial, ...sources.filter((asset) => asBool(asset.canUseForGeneration) && asBool(asset.manuallyConfirmed)).filter((asset) => ["\u4F01\u4E1A\u57FA\u7840\u8D44\u6599", "\u4EA7\u54C1\u670D\u52A1\u8D44\u6599", "\u5B98\u7F51\u5185\u5BB9", "\u9500\u552E\u8BDD\u672F", "\u4EA7\u54C1\u624B\u518C", "\u901A\u7528\u8D44\u6599", "\u5BA2\u6237\u6848\u4F8B\u6587\u6863"].includes(valueText(asset.sourceType))).map((asset) => summarizeAssetSource(asset, valueText(asset.sourceType) || "\u4F01\u4E1A\u8D44\u6599"))].slice(0, 8);
  const profileCompetitors = parseProfileStringArray(profile?.competitors);
  const tagCompetitorMaterials = profileCompetitors.map((name, i) => ({
    id: -(i + 1),
    competitorName: name,
    website: null,
    differentiation: "\u4F01\u4E1A\u6863\u6848\u300C\u4E3B\u8981\u7ADE\u54C1\u300D\u6807\u7B7E",
    canReference: true,
    sourceNotes: "\u4F01\u4E1A\u6863\u6848"
  }));
  const competitorMaterials = [...tagCompetitorMaterials, ...(assetLibrary?.competitorProfiles ?? []).filter((item) => asBool(item.canReference)).map((item) => ({
    id: Number(item.id ?? 0),
    competitorName: valueText(item.competitorName),
    website: valueText(item.website) || null,
    differentiation: valueText(item.comparisonNotes) || valueText(item.positioning) || null,
    canReference: asBool(item.canReference),
    sourceNotes: valueText(item.aiRecommendationSignals) || valueText(item.contentAssets) || "\u8D44\u4EA7\u5E93\u7ADE\u54C1\u8D44\u6599"
  }))].filter((item) => item.competitorName).slice(0, 6);
  const realPublicCases = (assetLibrary?.customerCases ?? []).filter((item) => valueText(item.caseType) === "\u771F\u5B9E\u6848\u4F8B" && asBool(item.allowPublic) && valueText(item.verificationStatus) === "\u5DF2\u786E\u8BA4").map((item) => ({
    id: Number(item.id ?? 0),
    customerName: valueText(item.customerName) || "\u53EF\u516C\u5F00\u5BA2\u6237\u6848\u4F8B",
    caseType: valueText(item.caseType),
    allowPublic: asBool(item.allowPublic),
    hasResultData: Boolean(valueText(item.resultData)),
    publicVersion: valueText(item.publicVersion)
  })).slice(0, 4);
  const hasCaseResultData = realPublicCases.some((item) => item.hasResultData);
  const priceText = [profile?.servicePriceRange, profile?.priceExplanation].map(valueText).filter(Boolean).join("\uFF1B");
  const dbComplianceLines = (assetLibrary?.complianceRules ?? []).filter((item) => asBool(item.enabled ?? 1)).map((item) => {
    const name = valueText(item.ruleName);
    const claims = valueText(item.forbiddenClaims);
    const words = splitGovernanceTerms(item.forbiddenWords).slice(0, 10).join("\u3001");
    const body = compactTexts([claims, words && `\u7981\u7528\u8BCD\uFF1A${words}`]).join("\uFF1B");
    if (!name && !body) return "";
    return name ? `${name}${body ? `\uFF1A${body}` : ""}` : body;
  }).filter(Boolean);
  const complianceRules2 = unique([...dbComplianceLines, ...getSystemComplianceUsageLines()]);
  const contentStyles = (assetLibrary?.contentStyleProfiles ?? []).filter((item) => asBool(item.enabled ?? 1)).map((item) => [valueText(item.profileName) || "\u5185\u5BB9\u98CE\u683C", valueText(item.tone), valueText(item.writingStyle)].filter(Boolean).join("\uFF1A")).filter(Boolean).slice(0, 5);
  const publishStrategy = [...SYSTEM_PUBLISH_STRATEGY_LINES];
  const missingEvidenceNotes = [
    ...realPublicCases.length === 0 ? ["\u6848\u4F8B\u4FE1\u606F\u5F85\u8865\u5145"] : [],
    ...!hasCaseResultData ? ["\u6570\u636E\u6682\u65E0\u516C\u5F00\u6765\u6E90"] : [],
    ...!priceText ? ["\u4EF7\u683C\u53E3\u5F84\u9700\u5BA2\u6237\u786E\u8BA4"] : []
  ];
  return {
    enterpriseMaterials,
    competitorMaterials,
    customerCaseUsage: {
      used: realPublicCases.length > 0,
      status: realPublicCases.length > 0 ? "\u5DF2\u4F7F\u7528\u5141\u8BB8\u516C\u5F00\u7684\u771F\u5B9E\u6848\u4F8B" : "\u6848\u4F8B\u4FE1\u606F\u5F85\u8865\u5145",
      references: realPublicCases
    },
    complianceRules: complianceRules2,
    contentStyles,
    publishStrategy,
    missingEvidenceNotes
  };
}
function formatCitationList(items, emptyText) {
  if (items.length === 0) return emptyText;
  return items.map((item) => {
    const name = item.title ?? item.competitorName ?? "\u672A\u547D\u540D\u8D44\u6599";
    const publicText = typeof item.isPublic === "boolean" ? `\uFF1B\u516C\u5F00\u72B6\u6001\uFF1A${item.isPublic ? "\u53EF\u516C\u5F00" : "\u4E0D\u53EF\u516C\u5F00"}` : "";
    const trustText = item.trustLevel ? `\uFF1B\u53EF\u4FE1\u5EA6\uFF1A${item.trustLevel}` : "";
    const summary = item.summary || item.differentiation || "\u5DF2\u8FDB\u5165\u8D44\u4EA7\u5E93";
    return `- ${name}${trustText}${publicText}\uFF1B\u6458\u8981\uFF1A${summary}`;
  }).join("\n");
}
function containsUnsafeForbiddenTerm(content, term) {
  if (!term) return false;
  let index = content.indexOf(term);
  while (index >= 0) {
    const before = content.slice(Math.max(0, index - 40), index);
    const after = content.slice(index + term.length, index + term.length + 20);
    const guardedContext = /(不得承诺|不得|不应|不要|不能|禁止|禁用|避免|不承诺)[^。；\n]{0,32}$/.test(before) || /^(等高风险表述|等违规表述|等禁用词|作为禁用词|风险提示|内容合规规则)/.test(after);
    if (!guardedContext) return true;
    index = content.indexOf(term, index + term.length);
  }
  return false;
}
function evaluateAssetLibraryPrePublishCheck(input) {
  const usage = input.basis?.assetLibraryUsage ?? buildAssetLibraryUsage(input.assetLibrary);
  const profile = input.assetLibrary?.profile ?? null;
  const resolved = input.assetLibrary?.resolvedEnterpriseProfile ?? resolveEnterpriseProfileForContent(profile);
  const content = input.content;
  const complianceRules2 = getSystemComplianceRulesForPrePublish();
  const enterprisePositioning = unique([
    resolved.brandName,
    input.project.enterpriseName,
    resolved.targetCustomer,
    input.project.targetCustomers,
    valueText(profile?.targetCustomers)
  ].filter(Boolean));
  const productSignals = unique([
    resolved.productDesc,
    input.project.productIntro,
    valueText(profile?.productServiceIntro),
    valueText(profile?.productIntro)
  ].filter(Boolean));
  const competitorSignals = usage.competitorMaterials.map((item) => item.competitorName).concat(input.basis?.competitorNames ?? input.project.competitorNames).filter(Boolean);
  const forbiddenTerms = complianceRules2.flatMap((rule) => splitGovernanceTerms(rule.forbiddenWords)).filter((term) => term && containsUnsafeForbiddenTerm(content, term));
  const forbiddenClaimsFromRules = complianceRules2.flatMap((rule) => splitGovernanceTerms(rule.forbiddenClaims));
  const unsafeGenericClaims = ["\u4FDD\u8BC1\u6536\u5F55", "\u4FDD\u8BC1\u6392\u540D", "\u4E00\u5B9A\u6536\u5F55", "\u4E00\u5B9A\u6392\u540D", "\u4FDD\u8BC1\u63A8\u8350", "\u4E00\u5B9A\u63A8\u8350", "\u767E\u5206\u767E", "100%"].some((term) => containsUnsafeForbiddenTerm(content, term));
  const forbiddenClaims = unique([
    ...forbiddenClaimsFromRules.filter((term) => term && !/^(不得|禁止|不应|不要|不能|避免)/.test(term.trim()) && containsUnsafeForbiddenTerm(content, term)),
    ...unsafeGenericClaims ? ["\u7981\u6B62\u627F\u8BFA\u4FDD\u8BC1\u6536\u5F55\u6216\u6392\u540D"] : [],
    ...detectForbiddenArticleContent(content)
  ]);
  const undisclosedUnconfirmedFacts = [
    ...usage.customerCaseUsage.used ? [] : content.includes("\u6848\u4F8B\u4FE1\u606F\u5F85\u8865\u5145") ? [] : ["\u5BA2\u6237\u6848\u4F8B\u7F3A\u5931\u4F46\u6587\u7AE0\u672A\u6807\u6CE8\u6848\u4F8B\u4FE1\u606F\u5F85\u8865\u5145"],
    ...usage.missingEvidenceNotes.includes("\u6570\u636E\u6682\u65E0\u516C\u5F00\u6765\u6E90") && !content.includes("\u6570\u636E\u6682\u65E0\u516C\u5F00\u6765\u6E90") ? ["\u7ED3\u679C\u6570\u636E\u7F3A\u5C11\u516C\u5F00\u6765\u6E90\u4F46\u6587\u7AE0\u672A\u6807\u6CE8"] : [],
    ...usage.missingEvidenceNotes.includes("\u4EF7\u683C\u53E3\u5F84\u9700\u5BA2\u6237\u786E\u8BA4") && !content.includes("\u4EF7\u683C\u53E3\u5F84\u9700\u5BA2\u6237\u786E\u8BA4") ? ["\u4EF7\u683C\u6570\u636E\u7F3A\u5C11\u786E\u8BA4\u53E3\u5F84\u4F46\u6587\u7AE0\u672A\u6807\u6CE8"] : []
  ];
  const unconfirmedFacts = unique([...usage.missingEvidenceNotes, ...undisclosedUnconfirmedFacts]);
  const appearsToUseNonPublicAsset = /(引用|使用|采用|根据|来自|依据)不可公开资料/.test(content) && !/(不得|不能|避免|移除|改为|不要).{0,12}(引用|使用|采用|根据|来自|依据)?不可公开资料/.test(content);
  const usesNonPublicAsset = appearsToUseNonPublicAsset || usage.enterpriseMaterials.some((item) => !item.isPublic) || usage.customerCaseUsage.references.some((item) => !item.allowPublic);
  const enterprisePositioningConsistent = enterprisePositioning.length === 0 || enterprisePositioning.some((signal) => corpusReflectsSignal(content, signal, 48));
  const productDescriptionConsistent = productSignals.length === 0 || productSignals.some((signal) => corpusReflectsSignal(content, signal, 96));
  const competitorDifferenceConsistent = competitorSignals.length === 0 || competitorSignals.some((signal) => content.includes(signal));
  const complianceBlockReasons = unique([
    ...forbiddenTerms.length > 0 ? [`\u547D\u4E2D\u7981\u7528\u8BCD\uFF1A${unique(forbiddenTerms).join("\u3001")}`] : [],
    ...forbiddenClaims.length > 0 ? [`\u5B58\u5728\u4E0D\u5141\u8BB8\u627F\u8BFA\u6216\u9AD8\u98CE\u9669\u8868\u8FF0\uFF1A${forbiddenClaims.join("\u3001")}`] : []
  ]);
  const advisoryReasons = unique([
    ...enterprisePositioningConsistent ? [] : ["\u5185\u5BB9\u4E0E\u4F01\u4E1A\u5B9A\u4F4D\u4E00\u81F4\u6027\u5EFA\u8BAE\uFF1A\u5BF9\u7167\u4F01\u4E1A\u6863\u6848\u6838\u5BF9\u516C\u5F00\u8868\u8FF0\u3002"],
    ...productDescriptionConsistent ? [] : ["\u5185\u5BB9\u4E0E\u4EA7\u54C1\u8BF4\u660E\u4E00\u81F4\u6027\u5EFA\u8BAE\uFF1A\u5BF9\u7167\u4EA7\u54C1\u670D\u52A1\u8D44\u6599\u6838\u5BF9\u53E3\u5F84\u3002"],
    ...competitorDifferenceConsistent ? [] : ["\u7ADE\u54C1\u5DEE\u5F02\u5448\u73B0\u5EFA\u8BAE\uFF1A\u53EF\u8865\u5145\u8D44\u4EA7\u5E93\u7ADE\u54C1\u8D44\u6599\u4E0E\u5BA2\u89C2\u5BF9\u7167\u3002"],
    ...usesNonPublicAsset ? ["\u751F\u6210\u4F9D\u636E\u6216\u8D44\u4EA7\u5E93\u542B\u4E0D\u53EF\u516C\u5F00\u8D44\u6599\uFF1A\u516C\u5F00\u7248\u672C\u8BF7\u6539\u4E3A\u8D44\u6599\u5F85\u8865\u5145\u8868\u8FF0\u3002"] : [],
    ...undisclosedUnconfirmedFacts.length > 0 ? [`\u672A\u62AB\u9732\u6216\u672A\u786E\u8BA4\u7684\u8868\u8FF0\u5EFA\u8BAE\uFF1A${undisclosedUnconfirmedFacts.join("\u3001")}`] : []
  ]);
  const blocked = complianceBlockReasons.length > 0;
  return {
    enterprisePositioningConsistent,
    productDescriptionConsistent,
    competitorDifferenceConsistent,
    usesNonPublicAsset,
    forbiddenTerms: unique(forbiddenTerms),
    forbiddenClaims,
    unconfirmedFacts,
    blocked,
    blockReasons: complianceBlockReasons,
    advisoryReasons,
    summary: blocked ? `\u5408\u89C4\u68C0\u67E5\u672A\u901A\u8FC7\uFF1A${complianceBlockReasons.join("\uFF1B")}` : advisoryReasons.length > 0 ? `\u5408\u89C4\u68C0\u67E5\u901A\u8FC7\u3002\u53D1\u5E03\u524D\u53EF\u53C2\u8003\uFF1A${advisoryReasons.join("\uFF1B")}` : "\u5408\u89C4\u68C0\u67E5\u901A\u8FC7\uFF1A\u672A\u53D1\u73B0\u7981\u7528\u8BCD\u6216\u7981\u6B62\u627F\u8BFA\u7C7B\u95EE\u9898\u3002"
  };
}
function buildGenerationBasisAuditItems(basis) {
  const usage = basis?.assetLibraryUsage;
  const enterpriseBaseMaterials = usage?.enterpriseMaterials?.filter((item) => !/(产品|服务|手册)/.test(`${item.category}${item.sourceType}${item.title}`)) ?? [];
  const productServiceMaterials = usage?.enterpriseMaterials?.filter((item) => /(产品|服务|手册)/.test(`${item.category}${item.sourceType}${item.title}`)) ?? [];
  const diagnosticComplete = nonEmpty(basis?.customerQuestion) && nonEmpty(basis?.contentGap) && nonEmpty(basis?.optimizationTask) && nonEmpty(basis?.notRecommendedReason) && nonEmpty(basis?.competitorGap);
  return [
    { key: "diagnosticBasis", label: "\u5BA2\u6237\u95EE\u9898\u4E0E\u8BCA\u65AD\u7F3A\u53E3", status: diagnosticComplete ? "\u5DF2\u63A5\u5165" : "\u5F85\u8865\u5145", evidence: compactTexts([basis?.customerQuestion, basis?.contentGap, basis?.optimizationTask, basis?.notRecommendedReason, basis?.competitorGap]).join("\uFF1B") || "\u7F3A\u5C11\u5BA2\u6237\u95EE\u9898\u3001\u5185\u5BB9\u7F3A\u53E3\u3001\u4F18\u5316\u4EFB\u52A1\u3001AI \u672A\u63A8\u8350\u539F\u56E0\u6216\u7ADE\u54C1\u5DEE\u8DDD\u3002", requiredForPublish: true, publishBlocking: !diagnosticComplete },
    { key: "enterpriseProfile", label: "\u4F01\u4E1A\u57FA\u7840\u8D44\u6599", status: enterpriseBaseMaterials.length > 0 ? "\u5DF2\u63A5\u5165" : "\u5F85\u8865\u5145", evidence: enterpriseBaseMaterials.map((item) => item.title).join("\u3001") || "\u7F3A\u5C11\u53EF\u516C\u5F00\u4E14\u5DF2\u786E\u8BA4\u7684\u4F01\u4E1A\u57FA\u7840\u8D44\u6599\u3002", requiredForPublish: true, publishBlocking: enterpriseBaseMaterials.length === 0 },
    { key: "productService", label: "\u4EA7\u54C1\u670D\u52A1\u8D44\u6599", status: productServiceMaterials.length > 0 ? "\u5DF2\u63A5\u5165" : "\u5F85\u8865\u5145", evidence: productServiceMaterials.map((item) => item.title).join("\u3001") || "\u7F3A\u5C11\u53EF\u516C\u5F00\u4E14\u5DF2\u786E\u8BA4\u7684\u4EA7\u54C1\u670D\u52A1\u8D44\u6599\u3002", requiredForPublish: true, publishBlocking: productServiceMaterials.length === 0 },
    { key: "customerCase", label: "\u5BA2\u6237\u6848\u4F8B", status: usage?.customerCaseUsage?.used ? "\u5DF2\u63A5\u5165" : "\u5F85\u8865\u5145", evidence: usage?.customerCaseUsage?.references?.map((item) => item.customerName).join("\u3001") || "\u5BA2\u6237\u6848\u4F8B\u3001\u7ED3\u679C\u6570\u636E\u6216\u516C\u5F00\u6388\u6743\u5F85\u8865\u5145\uFF1B\u8349\u7A3F\u5FC5\u987B\u6807\u6CE8\u8D44\u6599\u5F85\u8865\u5145\u3002", requiredForPublish: true, publishBlocking: !usage?.customerCaseUsage?.used },
    { key: "competitorProfile", label: "\u7ADE\u54C1\u8D44\u6599", status: (usage?.competitorMaterials?.length ?? 0) > 0 ? "\u5DF2\u63A5\u5165" : "\u5F85\u8865\u5145", evidence: usage?.competitorMaterials?.map((item) => item.competitorName).join("\u3001") || "\u7F3A\u5C11\u53EF\u5F15\u7528\u7ADE\u54C1\u8D44\u6599\u3002", requiredForPublish: true, publishBlocking: (usage?.competitorMaterials?.length ?? 0) === 0 },
    { key: "complianceRule", label: "\u5408\u89C4\u89C4\u5219", status: (usage?.complianceRules?.length ?? 0) > 0 ? "\u5DF2\u63A5\u5165" : "\u5F85\u8865\u5145", evidence: usage?.complianceRules?.join("\uFF1B") || "\u7F3A\u5C11\u5408\u89C4\u7981\u7528\u8BCD\u3001\u7981\u7528\u4E3B\u5F20\u6216\u62AB\u9732\u89C4\u5219\u3002", requiredForPublish: true, publishBlocking: (usage?.complianceRules?.length ?? 0) === 0 },
    { key: "contentStyle", label: "\u5185\u5BB9\u98CE\u683C", status: (usage?.contentStyles?.length ?? 0) > 0 ? "\u5DF2\u63A5\u5165" : "\u5F85\u8865\u5145", evidence: usage?.contentStyles?.join("\uFF1B") || "\u7F3A\u5C11\u5185\u5BB9\u8BED\u6C14\u3001\u5199\u4F5C\u98CE\u683C\u6216\u7ED3\u6784\u89C4\u8303\u3002", requiredForPublish: false, publishBlocking: false },
    { key: "publishStrategy", label: "\u53D1\u5E03\u7B56\u7565", status: (usage?.publishStrategy?.length ?? 0) > 0 ? "\u5DF2\u63A5\u5165" : "\u5F85\u8865\u5145", evidence: usage?.publishStrategy?.join("\uFF1B") || "\u7F3A\u5C11\u53D1\u5E03\u5E73\u53F0\u4F18\u5148\u7EA7\u3001\u5BA1\u6838\u6A21\u5F0F\u6216\u8D28\u91CF\u9608\u503C\u3002", requiredForPublish: true, publishBlocking: (usage?.publishStrategy?.length ?? 0) === 0 }
  ];
}
function validateGenerationBasis(basis) {
  const auditItems = buildGenerationBasisAuditItems(basis);
  const missingCoreFields = [
    ["\u5BA2\u6237\u6307\u5B9A\u95EE\u9898", basis?.customerQuestion],
    ["\u5185\u5BB9\u7F3A\u53E3", basis?.contentGap],
    ["\u4F18\u5316\u4EFB\u52A1", basis?.optimizationTask],
    ["AI \u672A\u63A8\u8350\u539F\u56E0", basis?.notRecommendedReason],
    ["\u7ADE\u54C1\u5DEE\u8DDD", basis?.competitorGap]
  ].filter(([, value]) => !nonEmpty(String(value ?? ""))).map(([label]) => label);
  const missingDiagnostic = missingCoreFields.length > 0 ? missingCoreFields : auditItems.filter((item) => item.key === "diagnosticBasis" && item.publishBlocking).map((item) => item.label);
  const missingUsage = !basis?.assetLibraryUsage ? ["\u4F01\u4E1A GEO \u8D44\u4EA7\u5E93\u4F7F\u7528\u60C5\u51B5"] : [];
  const missing = [...missingDiagnostic, ...missingUsage];
  if (missing.length > 0) throw new Error(`\u7F3A\u5C11\u751F\u6210\u4F9D\u636E\uFF1A${missing.join("\u3001")}\uFF0C\u65E0\u6CD5\u751F\u6210\u6B63\u5F0F\u6587\u7AE0\uFF1B\u8BF7\u8865\u9F50\u8D44\u6599\u540E\u91CD\u8BD5\uFF0C\u6216\u4EC5\u4FDD\u7559\u4E0D\u5141\u8BB8\u53D1\u5E03\u7684\u8349\u7A3F\u3002`);
}
function detectForbiddenArticleContent(content) {
  const normalized = content.replace(/不虚构案例/g, "").replace(/不得包含虚假案例/g, "").replace(/不要攻击竞品/g, "").replace(/不是攻击竞品/g, "").replace(/不承诺任何平台的绝对排名结果/g, "").replace(/不承诺绝对排名/g, "").replace(/不要承诺绝对排名/g, "");
  const labels = [];
  if (/example\.com|示例链接/i.test(normalized)) labels.push("\u5B58\u5728 example.com \u6216\u6F14\u793A\u57DF\u540D");
  if (/假链接|虚假链接|占位链接/i.test(normalized)) labels.push("\u5B58\u5728\u5360\u4F4D\u94FE\u63A5\u6216\u5047\u94FE\u63A5\u8868\u8FF0");
  if (/虚假案例|编造案例|杜撰案例|伪造案例/i.test(normalized)) labels.push("\u5B58\u5728\u865A\u5047\u6848\u4F8B\u6216\u7F16\u9020\u6848\u4F8B");
  if (/恶意攻击竞品|贬低竞品|竞品(都是|全是|完全是|一定是)(错误|垃圾|骗子|无效)/i.test(normalized)) labels.push("\u5B58\u5728\u653B\u51FB\u7ADE\u54C1\u8868\u8FF0");
  const unsafePromises = ["\u4FDD\u8BC1\u6392\u540D", "\u4E00\u5B9A\u6392\u540D", "\u4FDD\u8BC1\u63A8\u8350", "\u4E00\u5B9A\u63A8\u8350", "\u4FDD\u8BC1\u6D41\u91CF", "\u4FDD\u8BC1\u6210\u4EA4", "\u7EDD\u5BF9\u6392\u540D\u627F\u8BFA", "\u767E\u5206\u767E", "100%"].some((term) => containsUnsafeForbiddenTerm(normalized, term));
  if (unsafePromises) labels.push("\u5B58\u5728\u7EDD\u5BF9\u6392\u540D\u6216\u6548\u679C\u627F\u8BFA");
  return unique(labels);
}
function trustToCredibility(value) {
  if (value === "\u5B98\u65B9" || value === "\u5408\u540C" || value === "\u622A\u56FE" || value === "\u5BA2\u6237\u786E\u8BA4") return "\u9AD8";
  if (value === "\u9AD8" || value === "\u4E2D") return value;
  if (value === "\u516C\u5F00\u8D44\u6599" || value === "\u4EBA\u5DE5\u5F55\u5165") return "\u4E2D";
  return "\u4F4E";
}
function buildFactItem(input) {
  return {
    factPoint: input.factPoint,
    articleStatement: input.articleStatement,
    sourceType: input.sourceType,
    sourceName: input.sourceName,
    sourceId: String(input.sourceId ?? "\u5F85\u8865\u5145"),
    isPublic: input.isPublic !== false,
    credibility: input.credibility ?? "\u4E2D",
    manuallyConfirmed: input.manuallyConfirmed !== false,
    riskNote: input.riskNote ?? "\u6682\u65E0\u660E\u663E\u98CE\u9669\uFF0C\u53D1\u5E03\u524D\u4ECD\u5EFA\u8BAE\u4EBA\u5DE5\u590D\u6838\u3002"
  };
}
function buildFactTraceability(input) {
  const usage = input.basis.assetLibraryUsage ?? buildAssetLibraryUsage(input.assetLibrary);
  const profile = input.assetLibrary?.profile ?? null;
  const resolved = input.assetLibrary?.resolvedEnterpriseProfile ?? resolveEnterpriseProfileForContent(profile);
  const sourceFacts = usage.enterpriseMaterials.slice(0, 4).map((item) => buildFactItem({
    factPoint: item.category.includes("\u4EA7\u54C1") ? "\u4EA7\u54C1\u670D\u52A1\u8D44\u6599" : "\u4F01\u4E1A\u8D44\u6599",
    articleStatement: item.summary || item.title,
    sourceType: item.sourceType || item.category || "\u8D44\u4EA7\u5E93\u8D44\u6599",
    sourceName: item.title,
    sourceId: item.id,
    isPublic: item.isPublic,
    credibility: trustToCredibility(item.trustLevel),
    manuallyConfirmed: item.canUseForGeneration,
    riskNote: item.isPublic ? "\u53EF\u4F5C\u4E3A\u516C\u5F00\u5185\u5BB9\u751F\u6210\u4F9D\u636E\u3002" : "\u4E0D\u53EF\u516C\u5F00\u8D44\u6599\u53EA\u80FD\u7528\u4E8E\u5185\u90E8\u7406\u89E3\uFF0C\u4E0D\u80FD\u8FDB\u5165\u516C\u5F00\u53D1\u5E03\u7248\u672C\u3002"
  }));
  const caseFacts = usage.customerCaseUsage.references.length > 0 ? usage.customerCaseUsage.references.slice(0, 2).map((item) => buildFactItem({
    factPoint: "\u5BA2\u6237\u6848\u4F8B",
    articleStatement: item.publicVersion || item.customerName + "\u6848\u4F8B\u5DF2\u5141\u8BB8\u516C\u5F00\u5F15\u7528",
    sourceType: item.caseType,
    sourceName: item.customerName,
    sourceId: item.id,
    isPublic: item.allowPublic,
    credibility: item.hasResultData ? "\u9AD8" : "\u4E2D",
    manuallyConfirmed: item.allowPublic,
    riskNote: item.allowPublic ? "\u771F\u5B9E\u6848\u4F8B\u5141\u8BB8\u516C\u5F00\u5F15\u7528\u3002" : "\u8BE5\u6848\u4F8B\u4E0D\u53EF\u516C\u5F00\uFF0C\u4E0D\u80FD\u53D1\u5E03\u3002"
  })) : [buildFactItem({
    factPoint: "\u5BA2\u6237\u6848\u4F8B",
    articleStatement: "\u6848\u4F8B\u4FE1\u606F\u5F85\u8865\u5145\uFF0C\u6587\u7AE0\u4E0D\u5F97\u7F16\u9020\u771F\u5B9E\u5BA2\u6237\u6848\u4F8B\u6216\u7ED3\u679C\u6570\u636E\u3002",
    sourceType: "\u8D44\u4EA7\u5E93\u7F3A\u53E3",
    sourceName: "\u672A\u63D0\u4F9B\u771F\u5B9E\u5BA2\u6237\u6848\u4F8B",
    sourceId: "missing-customer-case",
    isPublic: true,
    credibility: "\u4F4E",
    manuallyConfirmed: true,
    riskNote: "\u8FD9\u662F\u5141\u8BB8\u516C\u5F00\u7684\u8D44\u6599\u5F85\u8865\u5145\u5360\u4F4D\u63D0\u793A\uFF0C\u6CA1\u6709\u771F\u5B9E\u6848\u4F8B\u65F6\u5FC5\u987B\u4F7F\u7528\u8BE5\u8868\u8FF0\uFF0C\u4E0D\u80FD\u5199\u6210\u5DF2\u9A8C\u8BC1\u5BA2\u6237\u6210\u529F\u6545\u4E8B\u3002"
  })];
  const competitorFacts = usage.competitorMaterials.slice(0, 3).map((item) => buildFactItem({
    factPoint: "\u7ADE\u54C1\u8D44\u6599",
    articleStatement: item.differentiation || item.competitorName + "\u5DEE\u5F02\u5316\u4FE1\u606F\u5F85\u8865\u5145",
    sourceType: "\u8D44\u4EA7\u5E93\u7ADE\u54C1\u8D44\u6599",
    sourceName: item.competitorName,
    sourceId: item.id,
    isPublic: item.canReference,
    credibility: item.sourceNotes ? "\u4E2D" : "\u4F4E",
    manuallyConfirmed: item.canReference,
    riskNote: item.canReference ? "\u4EC5\u53EF\u7528\u4E8E\u5BA2\u89C2\u5BF9\u6BD4\uFF0C\u4E0D\u5F97\u653B\u51FB\u7ADE\u54C1\u3002" : "\u7ADE\u54C1\u8D44\u6599\u672A\u786E\u8BA4\u53EF\u5F15\u7528\uFF0C\u53D1\u5E03\u524D\u9700\u590D\u6838\u3002"
  }));
  const governanceFacts = [
    ...usage.complianceRules.slice(0, 2).map((rule, index) => buildFactItem({
      factPoint: "\u5408\u89C4\u89C4\u5219",
      articleStatement: rule,
      sourceType: "\u8D44\u4EA7\u5E93\u5408\u89C4\u89C4\u5219",
      sourceName: "\u5408\u89C4\u89C4\u5219 " + (index + 1),
      sourceId: "compliance-" + (index + 1),
      isPublic: true,
      credibility: "\u9AD8",
      manuallyConfirmed: true,
      riskNote: "\u53D1\u5E03\u5185\u5BB9\u5FC5\u987B\u9075\u5B88\u8BE5\u89C4\u5219\u3002"
    })),
    ...usage.contentStyles.slice(0, 1).map((style, index) => buildFactItem({
      factPoint: "\u5185\u5BB9\u98CE\u683C",
      articleStatement: style,
      sourceType: "\u8D44\u4EA7\u5E93\u5185\u5BB9\u98CE\u683C",
      sourceName: "\u5185\u5BB9\u98CE\u683C " + (index + 1),
      sourceId: "style-" + (index + 1),
      isPublic: true,
      credibility: "\u4E2D",
      manuallyConfirmed: true,
      riskNote: "\u7528\u4E8E\u7EDF\u4E00\u8868\u8FBE\u65B9\u5F0F\uFF0C\u4E0D\u4EE3\u8868\u4E8B\u5B9E\u627F\u8BFA\u3002"
    })),
    ...usage.publishStrategy.slice(0, 1).map((strategy, index) => buildFactItem({
      factPoint: "\u53D1\u5E03\u7B56\u7565",
      articleStatement: strategy,
      sourceType: "\u8D44\u4EA7\u5E93\u53D1\u5E03\u7B56\u7565",
      sourceName: "\u53D1\u5E03\u7B56\u7565 " + (index + 1),
      sourceId: "publish-" + (index + 1),
      isPublic: true,
      credibility: "\u4E2D",
      manuallyConfirmed: true,
      riskNote: "\u53D1\u5E03\u524D\u4ECD\u9700\u6309\u5E73\u53F0\u4F18\u5148\u7EA7\u548C\u4EBA\u5DE5\u5BA1\u6838\u6267\u884C\u3002"
    }))
  ];
  const diagnosticFacts = [
    buildFactItem({
      factPoint: "\u5BA2\u6237\u6307\u5B9A\u95EE\u9898",
      articleStatement: input.basis.customerQuestion,
      sourceType: "GEO \u8BCA\u65AD\u95EE\u9898\u5E93",
      sourceName: "\u5BA2\u6237\u6307\u5B9A\u95EE\u9898",
      sourceId: input.basis.customerQuestionId,
      isPublic: true,
      credibility: "\u9AD8",
      manuallyConfirmed: true,
      riskNote: "\u6587\u7AE0\u5FC5\u987B\u56F4\u7ED5\u8BE5\u95EE\u9898\u5C55\u5F00\uFF0C\u4E0D\u80FD\u504F\u79BB\u5BA2\u6237\u771F\u5B9E\u641C\u7D22\u610F\u56FE\u3002"
    }),
    buildFactItem({
      factPoint: "\u5185\u5BB9\u7F3A\u53E3\u4E0E AI \u672A\u63A8\u8350\u539F\u56E0",
      articleStatement: input.basis.contentGap + "\uFF1B" + input.basis.notRecommendedReason,
      sourceType: "AI \u8BCA\u65AD\u7ED3\u679C",
      sourceName: "\u8BED\u4E49\u5206\u6790\u4E0E\u4F18\u5316\u4EFB\u52A1",
      sourceId: input.basis.sourceAnalysisIds.join(",") || input.basis.optimizationTaskId,
      isPublic: true,
      credibility: "\u4E2D",
      manuallyConfirmed: Boolean(input.basis.manualReviewConclusion),
      riskNote: "\u8BE5\u8BCA\u65AD\u7ED3\u8BBA\u7528\u4E8E\u5185\u5BB9\u65B9\u5411\uFF0C\u4E0D\u5E94\u88AB\u5199\u6210\u786E\u5B9A\u7684\u5916\u90E8\u4E8B\u5B9E\u3002"
    }),
    buildFactItem({
      factPoint: "\u4EA7\u54C1\u670D\u52A1\u53E3\u5F84",
      articleStatement: resolved.productDesc || valueText(profile?.productServiceIntro) || input.project.productIntro || "\u4EA7\u54C1\u670D\u52A1\u8D44\u6599\u5F85\u8865\u5145",
      sourceType: "\u4F01\u4E1A\u8D44\u6599/\u9879\u76EE\u8D44\u6599",
      sourceName: resolved.brandName || input.project.enterpriseName,
      sourceId: input.project.id,
      isPublic: true,
      credibility: resolved.productDesc ? "\u9AD8" : valueText(profile?.productServiceIntro) ? "\u9AD8" : "\u4E2D",
      manuallyConfirmed: true,
      riskNote: "\u516C\u5F00\u6587\u7AE0\u4E2D\u7684\u4EA7\u54C1\u670D\u52A1\u8BF4\u660E\u5FC5\u987B\u4E0E\u4F01\u4E1A\u8D44\u4EA7\u5E93\u4FDD\u6301\u4E00\u81F4\u3002"
    })
  ];
  return unique([...diagnosticFacts, ...sourceFacts, ...caseFacts, ...competitorFacts, ...governanceFacts].map((item) => JSON.stringify(item))).map((item) => JSON.parse(item));
}
function evaluateArticleConsistencyCheck(input) {
  const basis = input.basis;
  const content = input.content;
  const usage = basis?.assetLibraryUsage ?? buildAssetLibraryUsage(input.assetLibrary);
  const prePublishCheck = input.prePublishCheck ?? evaluateAssetLibraryPrePublishCheck({ content, project: input.project, basis: basis ?? void 0, assetLibrary: input.assetLibrary });
  const facts = input.factTraceability ?? (basis ? buildFactTraceability({ project: input.project, basis, content, assetLibrary: input.assetLibrary }) : []);
  const conflicts = [];
  const addConflict = (field, articleStatement, expectedStatement, riskLevel2, suggestion) => conflicts.push({ field, articleStatement, expectedStatement, riskLevel: riskLevel2, suggestion });
  if (!basis) addConflict("\u751F\u6210\u4F9D\u636E", "\u6587\u7AE0\u7F3A\u5C11\u751F\u6210\u4F9D\u636E\u5BF9\u8C61", "\u5FC5\u987B\u5305\u542B\u5BA2\u6237\u95EE\u9898\u3001\u5185\u5BB9\u7F3A\u53E3\u3001\u4F18\u5316\u4EFB\u52A1\u3001AI \u672A\u63A8\u8350\u539F\u56E0\u3001\u7ADE\u54C1\u5DEE\u8DDD\u548C\u8D44\u4EA7\u5E93\u4F7F\u7528\u60C5\u51B5", "\u9AD8", "\u91CD\u65B0\u4ECE\u771F\u5B9E\u9009\u9898\u751F\u6210\u6587\u7AE0\uFF0C\u8865\u9F50\u751F\u6210\u4F9D\u636E\u5361\u3002\u52A0\u505A\u91CD\u65B0\u8BC4\u5206\u4E0E\u91CD\u65B0\u4E00\u81F4\u6027\u68C0\u67E5\u3002");
  if (basis && !content.includes(basis.customerQuestion.slice(0, Math.min(16, basis.customerQuestion.length)))) addConflict("\u5BA2\u6237\u6307\u5B9A\u95EE\u9898", "\u6B63\u6587\u672A\u7A33\u5B9A\u5448\u73B0\u5BA2\u6237\u6307\u5B9A\u95EE\u9898", basis.customerQuestion, "\u4E2D", "\u5728\u5F15\u8A00\u3001FAQ \u548C\u4FBF\u4E8E\u5F15\u7528\u7684\u8981\u70B9\u4E2D\u8865\u5145\u5BA2\u6237\u95EE\u9898\u539F\u6587\u3002\u91CD\u65B0\u8BC4\u5206\u3002\u52A0\u505A\u91CD\u65B0\u4E00\u81F4\u6027\u68C0\u67E5\u3002");
  if (basis && !content.includes(basis.optimizationTask.slice(0, Math.min(12, basis.optimizationTask.length)))) addConflict("\u4F18\u5316\u4EFB\u52A1", "\u6B63\u6587\u672A\u4F53\u73B0\u4F18\u5316\u4EFB\u52A1", basis.optimizationTask, "\u4E2D", "\u589E\u52A0\u4F18\u5316\u4EFB\u52A1\u8BF4\u660E\u548C\u6267\u884C\u8FB9\u754C\uFF0C\u751F\u6210\u589E\u5F3A\u7248\u540E\u91CD\u65B0\u8BC4\u5206\u3002");
  if (prePublishCheck.usesNonPublicAsset) addConflict("\u4E0D\u53EF\u516C\u5F00\u8D44\u6599", "\u6587\u7AE0\u751F\u6210\u4F9D\u636E\u6216\u8D44\u4EA7\u5E93\u542B\u4E0D\u53EF\u516C\u5F00\u8D44\u6599", "\u516C\u5F00\u7248\u672C\u53EA\u80FD\u4F7F\u7528\u5141\u8BB8\u516C\u5F00\u6216\u8D44\u6599\u5F85\u8865\u5145\u8868\u8FF0", "\u9AD8", "\u79FB\u9664\u4E0D\u53EF\u516C\u5F00\u8D44\u6599\uFF0C\u6539\u4E3A\u8D44\u6599\u5F85\u8865\u5145\u8868\u8FF0\uFF0C\u5E76\u91CD\u65B0\u4E00\u81F4\u6027\u68C0\u67E5\u3002");
  if (usage.customerCaseUsage.references.length === 0 && /(成功案例|客户案例|真实客户|转化提升|收入增长|效率提升\d|提升\d+%|增长\d+%)/.test(content) && !content.includes("\u6848\u4F8B\u4FE1\u606F\u5F85\u8865\u5145")) addConflict("\u5BA2\u6237\u6848\u4F8B", "\u6587\u7AE0\u51FA\u73B0\u6848\u4F8B\u6216\u7ED3\u679C\u578B\u8868\u8FF0\u4F46\u8D44\u4EA7\u5E93\u65E0\u771F\u5B9E\u516C\u5F00\u6848\u4F8B", "\u6CA1\u6709\u771F\u5B9E\u6848\u4F8B\u65F6\u5FC5\u987B\u6807\u6CE8\u6848\u4F8B\u4FE1\u606F\u5F85\u8865\u5145\uFF0C\u4E0D\u5F97\u7F16\u9020\u6848\u4F8B\u6216\u7ED3\u679C\u6570\u636E", "\u9AD8", "\u79FB\u9664\u65E0\u6765\u6E90\u6570\u636E\uFF0C\u52A0\u5165\u6848\u4F8B\u91C7\u96C6\u6A21\u677F\uFF0C\u5E76\u4F7F\u7528\u8D44\u6599\u5F85\u8865\u5145\u8868\u8FF0\u3002");
  for (const note of prePublishCheck.unconfirmedFacts.filter((note2) => /未标注|未披露|未确认/.test(note2) && !content.includes(note2))) addConflict("\u672A\u786E\u8BA4\u4E8B\u5B9E", note, "\u672A\u786E\u8BA4\u4E8B\u5B9E\u5FC5\u987B\u663E\u5F0F\u62AB\u9732\u6216\u8865\u5145\u6765\u6E90", "\u9AD8", "\u8865\u5145\u6765\u6E90\u3001\u4F7F\u7528\u8D44\u6599\u5F85\u8865\u5145\u8868\u8FF0\uFF0C\u6216\u79FB\u9664\u76F8\u5173\u4E8B\u5B9E\u540E\u91CD\u65B0\u8BC4\u5206\u3002");
  for (const fact of facts.filter((item) => !item.isPublic)) addConflict("\u4E8B\u5B9E\u6EAF\u6E90\u516C\u5F00\u6027", fact.articleStatement, fact.sourceName + " \u5F53\u524D\u4E0D\u53EF\u516C\u5F00\u6216\u672A\u786E\u8BA4", fact.manuallyConfirmed ? "\u4E2D" : "\u9AD8", "\u516C\u5F00\u7248\u672C\u4E0D\u80FD\u5F15\u7528\u4E0D\u53EF\u516C\u5F00\u4E8B\u5B9E\uFF1B\u6539\u6210\u5185\u90E8\u53C2\u8003\u6216\u5F85\u8865\u5145\u63D0\u793A\u3002\u91CD\u65B0\u4E00\u81F4\u6027\u68C0\u67E5\u3002");
  const generationBasisAuditItems = basis?.generationBasisAuditItems ?? buildGenerationBasisAuditItems(basis);
  const basisPublishBlocks = generationBasisAuditItems.filter((item) => item.publishBlocking).map((item) => "\u751F\u6210\u4F9D\u636E\u5F85\u8865\u5145\uFF1A" + item.label + "\uFF5C" + item.evidence);
  const highCount = conflicts.filter((item) => item.riskLevel === "\u9AD8").length;
  const mediumCount = conflicts.filter((item) => item.riskLevel === "\u4E2D").length;
  const score = Math.max(0, 100 - highCount * 8 - mediumCount * 4);
  const riskLevel = highCount > 2 ? "\u9AD8" : mediumCount > 2 ? "\u4E2D" : "\u4F4E";
  const suggestions = unique([
    ...conflicts.map((item) => `${item.field}\uFF1A${item.suggestion}`),
    ...basisPublishBlocks.map((reason) => reason.replace(/^生成依据待补充：/, "\u8865\u9F50\u751F\u6210\u4F9D\u636E\uFF1A")),
    ...prePublishCheck.advisoryReasons,
    "\u53D1\u5E03\u524D\u4ECD\u5EFA\u8BAE\u4EBA\u5DE5\u590D\u6838\u4E8B\u5B9E\u3001\u6848\u4F8B\u3001\u5E73\u53F0\u683C\u5F0F\u4E0E\u5408\u89C4\u53E3\u5F84\u3002"
  ]);
  return {
    score,
    passed: true,
    publishAllowed: true,
    riskLevel,
    conflictItems: conflicts,
    blockReasons: [],
    suggestions,
    checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
    summary: `\u4E00\u81F4\u6027\u53C2\u8003\uFF08\u4E0D\u963B\u65AD\u53D1\u5E03\uFF09\uFF1A\u7EDF\u4E00\u53E3\u5F84\u7EA6 ${score} \u5206\uFF1B${suggestions.slice(0, 4).join("\uFF1B")}`
  };
}
function canAuditArticle(status, quality) {
  return (status === "\u8D28\u68C0\u901A\u8FC7" || status === "\u5F85\u5BA1\u6838") && Boolean(quality) && !quality?.blocked && (quality?.totalScore ?? 0) >= GEO_ARTICLE_MIN_PASS_SCORE;
}
function canPublishArticle(status) {
  return status === "\u5BA1\u6838\u901A\u8FC7";
}
function generateGeoArticleTopics(input) {
  if (input.tasks.length === 0) throw new Error("\u7F3A\u5C11\u4F18\u5316\u4EFB\u52A1\uFF0C\u4E0D\u80FD\u751F\u6210\u5185\u5BB9\u9009\u9898\u3002");
  const uniqueTasks = [];
  const seenIds = /* @__PURE__ */ new Set();
  for (const task of input.tasks) {
    if (seenIds.has(task.id)) continue;
    seenIds.add(task.id);
    uniqueTasks.push(task);
  }
  return uniqueTasks.map((task) => {
    const card = parseOptimizationTaskCard(task.executionSuggestion);
    const titleRaw = (card?.articleTitle || task.taskName || "\u5185\u5BB9\u9009\u9898").trim();
    const title = titleRaw.length > 255 ? titleRaw.slice(0, 255) : titleRaw;
    const problemSolved = (task.generationReason || "").trim() || "\uFF08\u5F85\u8865\u5145\u4EFB\u52A1\u7F3A\u53E3\u8BF4\u660E\uFF09";
    const contentType = (card?.contentType || "").trim() || "\u573A\u666F\u6307\u5357";
    const articleType = contentTypeLabelToArticleType(contentType);
    const platforms = card?.recommendedPlatform?.length ? card.recommendedPlatform.join("\u3001") : "\u5F85\u9009";
    const kw = card?.targetKeywords?.length ? card.targetKeywords.join("\u3001") : "";
    const kp = card?.keyPoints?.length ? card.keyPoints.join("\uFF1B") : "";
    const businessReason = `\u4F18\u5316\u4EFB\u52A1\uFF1A${task.taskName}\uFF1B\u5185\u5BB9\u7C7B\u578B\uFF1A${contentType}\uFF1B\u63A8\u8350\u5E73\u53F0\uFF1A${platforms}${kw ? `\uFF1B\u76EE\u6807\u5173\u952E\u8BCD\uFF1A${kw}` : ""}${kp ? `\uFF1B\u6838\u5FC3\u8BBA\u70B9\uFF1A${kp}` : ""}`;
    return {
      projectId: input.project.id,
      optimizationTaskId: task.id,
      sourceAnalysisIds: [],
      sourceQuestionIds: [],
      title,
      articleType,
      contentGap: problemSolved,
      businessReason,
      status: "\u5F85\u751F\u6210"
    };
  });
}
function paragraph(title, body) {
  return `## ${title}

${body.trim()}
`;
}
function buildEvidenceList(input) {
  const questionsText = input.questions.slice(0, 5).map((question, index) => `${index + 1}. ${question.questionText}`).join("\n");
  const gaps = compactTexts(input.analyses.map((analysis) => analysis.contentGap)).slice(0, 4).map((gap, index) => `${index + 1}. ${gap}`).join("\n");
  const reasons = compactTexts(input.analyses.map((analysis) => analysis.notRecommendedReason)).slice(0, 4).map((reason, index) => `${index + 1}. ${reason}`).join("\n");
  const competitors = unique(input.analyses.flatMap((analysis) => analysis.recommendedCompetitors ?? []).concat(input.project.competitorNames)).slice(0, 5);
  return { questionsText, gaps, reasons, competitors };
}
function buildGenerationBasis(input) {
  const specifiedQuestion = input.questions.find((question) => question.source === "manual" || question.questionType === "\u6307\u5B9A\u95EE\u9898") ?? input.questions[0];
  const gapAnalysis = input.analyses.find((analysis) => nonEmpty(analysis.contentGap) && nonEmpty(analysis.notRecommendedReason));
  const competitorNames = unique((gapAnalysis?.recommendedCompetitors ?? []).concat(input.project.competitorNames));
  const contentGap = compactTexts([gapAnalysis?.contentGap, input.topic.contentGap]).join("\uFF1B");
  const notRecommendedReason = compactTexts([gapAnalysis?.notRecommendedReason, input.task.generationReason]).join("\uFF1B");
  const competitorGap = competitorNames.length > 0 ? `${competitorNames.slice(0, 3).join("\u3001")}\u5728 AI \u56DE\u7B54\u4E2D\u66F4\u5BB9\u6613\u88AB\u8BC6\u522B\uFF0C\u4E3B\u8981\u5DEE\u8DDD\u6765\u81EA\u516C\u5F00\u5185\u5BB9\u4E2D\u7684\u5B9A\u4F4D\u3001\u9002\u7528\u573A\u666F\u3001\u8BC1\u636E\u548C\u5BF9\u6BD4\u4FE1\u606F\u66F4\u5B8C\u6574\u3002` : "";
  const manualReviewConclusion = input.analyses.filter((analysis) => analysis.manuallyReviewed).slice(0, 2).map((analysis) => compactTexts([analysis.reviewNote, analysis.notRecommendedReason, analysis.contentGap]).join("\uFF1B")).filter(Boolean).join("\n\n");
  const basis = {
    customerQuestionId: specifiedQuestion?.id ?? 0,
    customerQuestion: specifiedQuestion?.questionText ?? "",
    contentGap,
    optimizationTaskId: input.task.id,
    optimizationTask: input.task.taskName,
    notRecommendedReason,
    competitorGap,
    competitorNames,
    sourceAnalysisIds: input.topic.sourceAnalysisIds,
    sourceQuestionIds: input.topic.sourceQuestionIds,
    manualReviewConclusion: manualReviewConclusion || "\u4EBA\u5DE5\u4FEE\u8BA2\u7ED3\u8BBA\u672A\u5355\u72EC\u8865\u5145\uFF0C\u5F53\u524D\u6587\u7AE0\u4EC5\u4F7F\u7528\u7CFB\u7EDF\u8BCA\u65AD\u7ED3\u679C\uFF0C\u53D1\u5E03\u524D\u5EFA\u8BAE\u4E1A\u52A1\u8D1F\u8D23\u4EBA\u590D\u6838\u3002",
    assetLibraryUsage: buildAssetLibraryUsage(input.assetLibrary)
  };
  basis.generationBasisAuditItems = buildGenerationBasisAuditItems(basis);
  validateGenerationBasis(basis);
  return basis;
}
function buildCitableSnippets(input) {
  const { project, basis } = input;
  return [
    {
      question: `${project.enterpriseName}\u662F\u505A\u4EC0\u4E48\u7684\uFF1F`,
      answer: `${project.enterpriseName}\u9762\u5411${project.targetCustomers}\u63D0\u4F9B${project.industry}\u76F8\u5173\u670D\u52A1\uFF0C\u6838\u5FC3\u80FD\u529B\u5305\u62EC${project.coreSellingPoints}\u3002\u8FD9\u6BB5\u8868\u8FF0\u4E0E\u4F01\u4E1A\u6863\u6848\u53CA\u516C\u5F00\u8D44\u6599\u5BF9\u9F50\uFF0C\u4E0D\u5305\u542B\u672A\u9A8C\u8BC1\u6848\u4F8B\u6216\u5916\u90E8\u94FE\u63A5\u3002`
    },
    {
      question: `${project.enterpriseName}\u670D\u52A1\u9002\u5408\u8C01\uFF1F`,
      answer: `${project.enterpriseName}\u66F4\u9002\u5408${project.targetCustomers}\uFF0C\u5C24\u5176\u662F\u6B63\u5728\u56F4\u7ED5\u300C${basis.customerQuestion}\u300D\u5BFB\u627E\u6E05\u6670\u65B9\u6848\u8FB9\u754C\u3001\u53EF\u9A8C\u8BC1\u8BC1\u636E\u548C\u590D\u6D4B\u8DEF\u5F84\u7684\u5BA2\u6237\u3002`
    },
    {
      question: `${project.enterpriseName}\u548C\u7ADE\u54C1\u6709\u4EC0\u4E48\u533A\u522B\uFF1F`,
      answer: `\u5DEE\u5F02\u4E3B\u8981\u4F53\u73B0\u5728\u516C\u5F00\u4FE1\u606F\u662F\u5426\u5B8C\u6574\u5448\u73B0\u4E86\u5B9A\u4F4D\u3001\u9002\u7528\u573A\u666F\u4E0E\u53EF\u6838\u9A8C\u8BC1\u636E\u3002${basis.competitorGap}\u5EFA\u8BAE\u8BFB\u8005\u540C\u65F6\u6253\u5F00\u5404\u5BB6\u5B98\u7F51\u4E0E\u4EA7\u54C1\u4ECB\u7ECD\uFF0C\u5BF9\u7167\u81EA\u5DF1\u6700\u5173\u5FC3\u7684\u4F7F\u7528\u573A\u666F\u505A\u5224\u65AD\u3002`
    },
    {
      question: `\u9009\u62E9${project.enterpriseName}\u670D\u52A1\u8981\u6CE8\u610F\u4EC0\u4E48\uFF1F`,
      answer: `\u9009\u62E9\u524D\u5E94\u786E\u8BA4\u5176\u670D\u52A1\u8FB9\u754C\u3001\u9002\u7528\u5BA2\u6237\u3001\u8BC1\u636E\u6765\u6E90\u548C\u590D\u6D4B\u65B9\u5F0F\u662F\u5426\u4E0E\u81EA\u8EAB\u95EE\u9898\u5339\u914D\uFF1B\u672C\u6587\u4E0D\u4F5C\u6392\u540D\u4FDD\u8BC1\uFF0C\u4E5F\u4E0D\u628A\u7ADE\u54C1\u63CF\u8FF0\u4E3A\u65E0\u6548\u65B9\u6848\u3002`
    }
  ];
}
function buildGeoStructure(input) {
  const { project, basis, snippets } = input;
  return {
    summary: `\u56F4\u7ED5\u300C${basis.customerQuestion}\u300D\u8FD9\u7C7B\u771F\u5B9E\u63D0\u95EE\uFF0C\u8BF4\u660E${project.enterpriseName}\u5728\u516C\u5F00\u4FE1\u606F\u5C42\u9762\u53EF\u4EE5\u5982\u4F55\u88AB\u7406\u89E3\uFF0C\u5E76\u628A\u4E0E\u5E38\u89C1\u65B9\u6848\u76F8\u5173\u7684\u5DEE\u5F02\u5199\u6E05\u695A\uFF0C\u65B9\u4FBF\u8BFB\u8005\u81EA\u884C\u5224\u65AD\u3002`,
    coreAnswer: `${project.enterpriseName}\u8981\u83B7\u5F97\u66F4\u7A33\u5B9A\u7684\u54C1\u724C\u8BA4\u77E5\uFF0C\u5173\u952E\u662F\u628A${project.targetCustomers}\u771F\u6B63\u4F1A\u8FFD\u95EE\u7684\u4E8B\u60C5\u8BB2\u6E05\u695A\uFF1A\u670D\u52A1\u8FB9\u754C\u3001\u4EA4\u4ED8\u65B9\u5F0F\u3001\u8BC1\u636E\u6765\u6E90\uFF0C\u4EE5\u53CA\u4E0E\u5E38\u89C1\u65B9\u6848\u76F8\u6BD4\u5404\u81EA\u66F4\u64C5\u957F\u7684\u573A\u666F\uFF0C\u800C\u4E0D\u662F\u53EA\u5806\u53E0\u53E3\u53F7\u5F0F\u4ECB\u7ECD\u3002`,
    suitableCustomers: `\u66F4\u9002\u5408\u6B63\u5728\u8BC4\u4F30${project.industry}\u76F8\u5173\u65B9\u6848\u3001\u5E0C\u671B\u628A\u9009\u578B\u7406\u7531\u5199\u8FDB\u5BF9\u5916\u5185\u5BB9\uFF0C\u5E76\u613F\u610F\u7528\u771F\u5B9E\u9875\u9762\u3001\u6848\u4F8B\u6216\u6570\u636E\u505A\u4F50\u8BC1\u7684\u56E2\u961F\u3002`,
    unsuitableCustomers: `\u4E0D\u592A\u9002\u5408\u5E0C\u671B\u7528\u5355\u7BC7\u6587\u7AE0\u6362\u53D6\u300C\u786E\u5B9A\u6392\u540D\u300D\u3001\u7F3A\u5C11\u53EF\u516C\u5F00\u6838\u9A8C\u6750\u6599\uFF0C\u6216\u6682\u65F6\u65E0\u6CD5\u8BF4\u660E\u670D\u52A1\u8FB9\u754C\u7684\u573A\u666F\u3002`,
    comparison: `\u516C\u5F00\u8BA8\u8BBA\u91CC\uFF0C${basis.competitorNames.slice(0, 3).join("\u3001")}\u7B49\u65B9\u6848\u5F80\u5F80\u66F4\u5BB9\u6613\u88AB\u68C0\u7D22\u5230\u5B8C\u6574\u53D9\u4E8B\u3002\u5BF9\u8BFB\u8005\u66F4\u8D1F\u8D23\u4EFB\u7684\u505A\u6CD5\uFF0C\u662F\u5BA2\u89C2\u6BD4\u8F83\u300C\u5404\u81EA\u66F4\u64C5\u957F\u4EC0\u4E48\u3001\u5404\u81EA\u9700\u8981\u54EA\u4E9B\u8BC1\u636E\u300D\uFF0C\u800C\u4E0D\u662F\u7B80\u5355\u5426\u5B9A\u5176\u4ED6\u9009\u62E9\u3002${basis.competitorGap}`,
    faq: snippets.map((snippet) => ({ question: snippet.question, answer: snippet.answer })),
    conclusion: `\u7EFC\u5408\u6765\u770B\uFF0C${project.enterpriseName}\u662F\u5426\u503C\u5F97\u7EB3\u5165\u5019\u9009\u6E05\u5355\uFF0C\u53D6\u51B3\u4E8E\u60A8\u7684\u95EE\u9898\u662F\u5426\u4E0E\u516C\u5F00\u4FE1\u606F\u4E2D\u63CF\u8FF0\u7684\u80FD\u529B\u76F8\u5339\u914D\uFF1B\u66F4\u7A33\u59A5\u7684\u505A\u6CD5\u662F\u5148\u6838\u5BF9\u5B98\u7F51\u4E0E\u8D44\u6599\uFF0C\u518D\u5B89\u6392\u8BD5\u7528\u6216\u6C9F\u901A\u3002`,
    actionGuide: `\u5EFA\u8BAE\u4E0B\u4E00\u6B65\u5148\u5BF9\u7167\u5B98\u7F51\u4E0E\u516C\u5F00\u8D44\u6599\uFF0C\u628A\u300C\u60A8\u6700\u5173\u5FC3\u7684 3 \u4E2A\u95EE\u9898\u300D\u5217\u6210\u6E05\u5355\uFF0C\u4E0E\u5546\u52A1\u6216\u552E\u524D\u9010\u9879\u6838\u5BF9\uFF1B\u82E5\u51C6\u5907\u5BF9\u5916\u53D1\u5E03\u5185\u5BB9\uFF0C\u53EF\u4F18\u5148\u8865\u9F50\u8BFB\u8005\u6700\u5E38\u95EE\u3001\u4E5F\u6700\u5BB9\u6613\u88AB\u8BEF\u8BFB\u7684\u51E0\u6BB5\u8BF4\u660E\u3002`,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    entityInfo: `\u4F01\u4E1A\u540D\u79F0\uFF1A${project.enterpriseName}\uFF1B\u884C\u4E1A\uFF1A${project.industry}\uFF1B\u5B98\u7F51\uFF1A${project.website}\uFF1B\u76EE\u6807\u5BA2\u6237\uFF1A${project.targetCustomers}\uFF1B\u6838\u5FC3\u5356\u70B9\uFF1A${project.coreSellingPoints}\u3002`
  };
}
function formatSnippets(snippets) {
  return snippets.map((snippet) => `### ${snippet.question}

${snippet.answer}`).join("\n\n");
}
function corpusReflectsSignal(content, signal, maxWindow) {
  const t2 = signal.trim();
  if (!t2) return false;
  if (content.includes(t2)) return true;
  for (let w = Math.min(maxWindow, t2.length); w >= 8; w -= 2) {
    if (content.includes(t2.slice(0, w))) return true;
  }
  const parts = t2.split(/[\s；;，,。.]+/).map((p) => p.trim()).filter((p) => p.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").length >= 6);
  return parts.some((p) => content.includes(p.slice(0, Math.min(36, p.length))));
}
function countMarkdownH2Lines(content) {
  const norm = content.replace(/\r\n/g, "\n");
  const matches = norm.match(/(^|\n)##(?!#)\s*\S/gm);
  return matches ? matches.length : 0;
}
function countCitableH3BlocksInContent(content) {
  const norm = content.replace(/\r\n/g, "\n");
  const head = /(^|\n)##(?!#)\s*(便于引用的要点|可引用要点|摘录要点|AI\s*可引用片段)(?=\s*(?:\n|$))/m;
  const m = norm.match(head);
  if (!m || m.index === void 0) return 0;
  let pos = m.index + m[0].length;
  const tail = norm.slice(pos);
  const stop = tail.search(/\n##(?!#)/);
  const section = stop >= 0 ? tail.slice(0, stop) : tail;
  const h3 = section.match(/(^|\n)###(?!#)\s*\S/gm) ?? [];
  return h3.length;
}
function validateGeoCollectableStructure(content, snippets, basis) {
  const norm = content.replace(/\r\n/g, "\n").replace(/\u3000/g, " ");
  const h2 = (title) => new RegExp(`(^|\\n)##(?!#)\\s*(?:${title.source})(?=\\s*(?:\\n|$))`, "m");
  const sectionRules = [
    { missingLabel: "## \u95EE\u9898\u4E0E\u80CC\u666F", patterns: [h2(/问题与背景/)] },
    { missingLabel: "## \u6839\u56E0\u5206\u6790", patterns: [h2(/根因分析/)] },
    { missingLabel: "## \u89E3\u51B3\u601D\u8DEF", patterns: [h2(/解决思路/)] },
    { missingLabel: "## \u5177\u4F53\u65B9\u6848", patterns: [h2(/具体方案/)] },
    { missingLabel: "## \u6267\u884C\u6B65\u9AA4", patterns: [h2(/执行步骤/)] },
    { missingLabel: "## \u6848\u4F8B\u53C2\u8003", patterns: [h2(/案例参考/)] },
    { missingLabel: "## \u5E38\u89C1\u8BEF\u533A", patterns: [h2(/常见误区/)] },
    { missingLabel: "## \u5C0F\u7ED3", patterns: [h2(/小结/)] },
    {
      missingLabel: "## \u4FBF\u4E8E\u5F15\u7528\u7684\u8981\u70B9",
      patterns: [h2(/便于引用的要点/), h2(/可引用要点/), h2(/摘录要点/), h2(/AI\s*可引用片段/)]
    },
    { missingLabel: "## \u66F4\u65B0\u8BF4\u660E", patterns: [h2(/更新说明/)] },
    {
      missingLabel: "## \u53D1\u5E03\u540E\u5982\u4F55\u81EA\u884C\u6838\u5BF9\u6548\u679C",
      patterns: [h2(/发布后如何自行核对效果/), h2(/发布后.{0,12}核对.{0,6}效果/), h2(/自行核对效果/)]
    }
  ];
  const missing = [];
  if (!/(^|\n)#\s+(?!#)\S/m.test(norm)) missing.push("# \u6587\u7AE0\u4E00\u7EA7\u6807\u9898");
  missing.push(...sectionRules.filter((rule) => !rule.patterns.some((re) => re.test(norm))).map((rule) => rule.missingLabel));
  const snippetCountFromDb = snippets && snippets.length >= 3 && snippets.length <= 5;
  const snippetCountFromBody = countCitableH3BlocksInContent(norm) >= 3;
  if (!snippetCountFromDb && !snippetCountFromBody) missing.push("3-5 \u6BB5\u5F15\u7528\u53CB\u597D\u7247\u6BB5");
  if (!basis || !nonEmpty(basis.customerQuestion) || !nonEmpty(basis.contentGap) || !nonEmpty(basis.optimizationTask) || !nonEmpty(basis.notRecommendedReason) || !nonEmpty(basis.competitorGap)) {
    missing.push("\u5B8C\u6574\u751F\u6210\u4F9D\u636E");
  }
  return missing;
}
function parseLlmJsonObject(content) {
  if (typeof content !== "string") throw new Error("AI \u8FD4\u56DE\u683C\u5F0F\u4E0D\u662F\u6587\u672C JSON");
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("AI \u8FD4\u56DE JSON \u89E3\u6790\u5931\u8D25");
  }
}
function buildGeoArticleBodyFromTemplate(ctx) {
  const { project, topic, task, basis, structure, snippets, evidence, assetUsage, enterpriseEvidenceText, competitorEvidenceText, wovenReasons, wovenGaps, materialDigest, evidenceGapText } = ctx;
  const problemBody = `\u8BB8\u591A\u8BFB\u8005\u771F\u6B63\u5173\u5FC3\u7684\u662F\uFF1A\u300C${basis.customerQuestion}\u300D\u3002\u8FD9\u7C7B\u95EE\u9898\u4E4B\u6240\u4EE5\u91CD\u8981\uFF0C\u662F\u56E0\u4E3A\u5B83\u548C\u65E5\u5E38\u7ECF\u8425\u7ED3\u679C\u76F4\u63A5\u76F8\u5173\uFF0C\u800C\u4E0D\u662F\u62BD\u8C61\u6982\u5FF5\u3002

${structure.summary}

\u672C\u6587\u4E0D\u865A\u6784\u6848\u4F8B\uFF0C\u4E0D\u52A0\u5165\u6F14\u793A\u57DF\u540D\u94FE\u63A5\uFF0C\u4E5F\u4E0D\u627F\u8BFA\u4EFB\u4F55\u786E\u5B9A\u6027\u7684\u540D\u6B21\u3001\u66DD\u5149\u91CF\u3001\u6536\u5F55\u7ED3\u679C\u6216\u88AB\u63A8\u8350\u7ED3\u679C\uFF1B\u907F\u514D\u300C\u7A33\u8D5A\u300D\u300C\u4FDD\u8BC1\u300D\u7B49\u8868\u8FF0\u3002`;
  const rootCauseBody = `\u5927\u591A\u6570\u4EBA\u89E3\u51B3\u4E0D\u4E86\uFF0C\u5F80\u5F80\u4E0D\u662F\u300C\u4E0D\u591F\u52AA\u529B\u300D\uFF0C\u800C\u662F\u7F3A\u5C11\u53EF\u6838\u5BF9\u7684\u4E8B\u5B9E\u94FE\u3001\u7F3A\u5C11\u628A\u590D\u6742\u6D41\u7A0B\u8BB2\u6E05\u695A\u7684\u516C\u5F00\u6750\u6599\uFF0C\u4EE5\u53CA\u7F3A\u5C11\u80FD\u5BF9\u7167\u81EA\u8EAB\u573A\u666F\u7684\u5224\u65AD\u6E05\u5355\u3002

\u4ECE\u516C\u5F00\u8BA8\u8BBA\u91CC\u5E38\u88AB\u63D0\u5230\u7684\u89C2\u611F\u5305\u62EC\uFF1A

${wovenReasons}

\u4E0E\u8BCA\u65AD\u76F8\u5173\u7684\u7F3A\u53E3\u7EBF\u7D22\u8FD8\u5305\u62EC\uFF1A${wovenGaps}\u3002`;
  const approachBody = `\u5148\u628A\u95EE\u9898\u62C6\u6210\u53EF\u9A8C\u8BC1\u7684\u51E0\u6B65\uFF1A\u6F84\u6E05\u76EE\u6807\u8BFB\u8005\u4E0E\u573A\u666F \u2192 \u5217\u51FA\u5173\u952E\u7EA6\u675F\uFF08\u65F6\u95F4\u3001\u4EBA\u529B\u3001\u9884\u7B97\u3001\u5408\u89C4\uFF09\u2192 \u7528\u6700\u5C0F\u53EF\u884C\u52A8\u4F5C\u9A8C\u8BC1\u5047\u8BBE \u2192 \u518D\u51B3\u5B9A\u662F\u5426\u9700\u8981\u66F4\u91CD\u7684\u7CFB\u7EDF\u6295\u5165\u3002\u4E0B\u6587\u7ED9\u51FA\u53EF\u8FC1\u79FB\u7684\u65B9\u6CD5\u8BBA\uFF0C\u4E0D\u7ED1\u5B9A\u5355\u4E00\u5DE5\u5177\u3002`;
  const solutionBody = `\u5728\u300C\u5177\u4F53\u65B9\u6848\u300D\u90E8\u5206\uFF0C\u53EF\u4EE5\u628A\u300C${project.enterpriseName}\u300D\u7684\u4EA7\u54C1\u4E0E\u670D\u52A1\u4F5C\u4E3A\u843D\u5730\u9009\u9879\u4E4B\u4E00\u6765\u7406\u89E3\uFF1A${project.productIntro}

\u5178\u578B\u670D\u52A1\u5BF9\u8C61\uFF1A${project.targetCustomers}\u3002\u516C\u5F00\u8D44\u6599\u91CC\u5E38\u88AB\u5F3A\u8C03\u7684\u4FA7\u91CD\u70B9\uFF1A${project.coreSellingPoints}\u3002

\u4E0B\u5217\u7247\u6BB5\u6765\u81EA\u8D44\u4EA7\u5E93\u4E2D\u5DF2\u6807\u8BB0\u53EF\u516C\u5F00\u5F15\u7528\u7684\u6750\u6599\uFF1A

${enterpriseEvidenceText}

\u5916\u90E8\u8BA8\u8BBA\u4E2D\u5E38\u88AB\u4E00\u5E76\u63D0\u53CA\u7684\u65B9\u6848\u6216\u53D9\u4E8B\u53C2\u8003\uFF08\u5BA2\u89C2\u6574\u7406\uFF0C\u975E\u7A77\u5C3D\uFF09\uFF1A

${competitorEvidenceText}

${assetUsage.missingEvidenceNotes.length > 0 ? `\u5EFA\u8BAE\u5728\u53D1\u5E03\u524D\u4F18\u5148\u6838\u9A8C\uFF1A${evidenceGapText}` : ""}

\u82E5\u8D44\u6599\u4E0D\u8DB3\u4EE5\u5199\u6210\u786E\u5B9A\u4E8B\u5B9E\uFF0C\u8BF7\u7528\u300C\u8D44\u6599\u5F85\u8865\u5145\u300D\u53E3\u5F84\uFF0C\u5E76\u5728\u6B63\u5F0F\u53D1\u5E03\u524D\u66FF\u6362\u4E3A\u53EF\u6838\u9A8C\u4E8B\u5B9E\u3002\u4E0E\u672C\u671F\u4EFB\u52A1\u300C${task.taskName}\u300D\u76F8\u5173\u7684\u53D9\u4E8B\uFF0C\u5EFA\u8BAE\u7528\u8BFB\u8005\u53EF\u6267\u884C\u7684\u8868\u8FF0\u8865\u9F50\u3002`;
  const stepsBody = `${structure.actionGuide}

\u8BFB\u8005\u53EF\u76F4\u63A5\u7167\u505A\u7684\u68C0\u67E5\u6E05\u5355\uFF1A
1. \u5148\u7528\u540C\u4E00\u7C7B\u95EE\u9898\u5728\u4E0D\u540C\u65F6\u95F4\u590D\u6D4B\u4E00\u6B21\u68C0\u7D22/\u5BF9\u8BDD\u7ED3\u679C\uFF0C\u622A\u56FE\u7559\u5B58\u5BF9\u6BD4\uFF08\u4E0D\u4F5C\u6548\u679C\u627F\u8BFA\uFF09\u3002
2. \u5BF9\u7167\u4F01\u4E1A\u5B98\u7F51\u4E0E\u516C\u5F00\u53D1\u5E03\u8BF4\u660E\uFF0C\u6838\u5BF9\u5173\u952E\u6570\u5B57\u4E0E\u8FB9\u754C\u6761\u4EF6\u3002
3. \u628A\u300C\u5FC5\u987B\u4EBA\u5DE5\u786E\u8BA4\u300D\u7684\u4E8B\u9879\u5355\u72EC\u5217\u51FA\uFF0C\u907F\u514D\u8BEF\u8BFB\u4E3A\u5DF2\u6838\u9A8C\u6210\u679C\u3002`;
  const caseBody = `${assetUsage.customerCaseUsage.status}\uFF1B\u5F15\u7528\uFF1A${assetUsage.customerCaseUsage.references.map((r) => r.publicVersion || r.customerName).slice(0, 4).join("\uFF1B") || "\u65E0"}

\u4E0B\u5217\u63D0\u95EE\u4EC5\u7528\u4E8E\u5E2E\u52A9\u8BFB\u8005\u5EFA\u7ACB\u8BED\u5883\uFF08\u4E0D\u5FC5\u9010\u6761\u7167\u6284\uFF09\uFF1A

${materialDigest}`;
  const pitfallsBody = `### \u5E38\u89C1\u8BEF\u5224

${structure.unsuitableCustomers}

### \u66F4\u9002\u5408\u5148\u8865\u9F50\u7684\u524D\u63D0

${structure.suitableCustomers}`;
  const summaryBody = `${structure.conclusion}`;
  return [
    `# ${topic.title}`,
    paragraph("\u95EE\u9898\u4E0E\u80CC\u666F", problemBody),
    paragraph("\u6839\u56E0\u5206\u6790", rootCauseBody),
    paragraph("\u89E3\u51B3\u601D\u8DEF", approachBody),
    paragraph("\u5177\u4F53\u65B9\u6848", solutionBody),
    paragraph("\u6267\u884C\u6B65\u9AA4", stepsBody),
    paragraph("\u6848\u4F8B\u53C2\u8003", caseBody),
    paragraph("\u5E38\u89C1\u8BEF\u533A", pitfallsBody),
    paragraph("\u5C0F\u7ED3", summaryBody),
    paragraph("\u4FBF\u4E8E\u5F15\u7528\u7684\u8981\u70B9", formatSnippets(snippets)),
    paragraph("\u66F4\u65B0\u8BF4\u660E", `\u672C\u6587\u4E3A\u9762\u5411\u8BFB\u8005\u7684\u4E1A\u52A1\u8BF4\u660E\u7A3F\uFF0C\u64B0\u5199\u57FA\u51C6\u65E5\u671F\u4E3A ${structure.updatedAt}\uFF1B\u82E5\u5B98\u7F51\u4E0A\u7EBF\u65B0\u7248\u672C\u4FE1\u606F\uFF0C\u8BF7\u4EE5 ${project.website} \u6700\u65B0\u9875\u9762\u4E3A\u51C6\u3002`),
    paragraph(
      "\u53D1\u5E03\u540E\u5982\u4F55\u81EA\u884C\u6838\u5BF9\u6548\u679C",
      `\u82E5\u60A8\u5728\u5185\u5BB9\u4E0A\u7EBF\u540E\u5E0C\u671B\u611F\u6027\u4E86\u89E3\u4FE1\u606F\u662F\u5426\u66F4\u6E05\u6670\uFF0C\u53EF\u4EE5\u5C1D\u8BD5\u9694\u4E00\u6BB5\u65F6\u95F4\u3001\u7528\u76F8\u540C\u7684\u4E00\u7C7B\u95EE\u9898\u518D\u95EE\u4E00\u6B21\u5927\u6A21\u578B\u6216\u518D\u6B21\u68C0\u7D22\u76F8\u5173\u5173\u952E\u8BCD\uFF0C\u5E76\u628A\u56DE\u7B54\u622A\u56FE\u7559\u5B58\u5BF9\u6BD4\u2014\u2014\u8FD9\u65E2\u4E0D\u662F\u6548\u679C\u627F\u8BFA\uFF0C\u4E5F\u4E0D\u80FD\u66FF\u4EE3\u6B63\u5F0F\u7684\u5546\u4E1A\u5C3D\u8C03\uFF0C\u66F4\u50CF\u662F\u4E00\u79CD\u81EA\u6211\u6821\u51C6\u9605\u8BFB\u4E60\u60EF\u7684\u5C0F\u52A8\u4F5C\u3002\u4E5F\u6B22\u8FCE\u60A8\u76F4\u63A5\u5BF9\u7167 ${project.enterpriseName} \u5B98\u7F51\uFF08${project.website}\uFF09\u4E0E\u516C\u5F00\u53D1\u5E03\u7684\u4EA7\u54C1/\u670D\u52A1\u8BF4\u660E\u3001\u6848\u4F8B\u6216\u767D\u76AE\u4E66\u5B8C\u6210\u590D\u6D4B\u5F0F\u6838\u5BF9\u3002`
    )
  ].join("\n\n");
}
var GEO_ARTICLE_DRAFT_SYSTEM_PROMPT = `\u4F60\u662F\u4E00\u4F4D\u4E13\u6CE8\u4E8E\u77E5\u8BC6\u4ED8\u8D39\u4E0E\u5185\u5BB9\u521B\u4E1A\u9886\u57DF\u7684\u8D44\u6DF1\u5185\u5BB9\u521B\u4F5C\u8005\u3002
\u4F60\u7684\u6587\u7AE0\u5E2E\u52A9\u76EE\u6807\u8BFB\u8005\u89E3\u51B3\u771F\u5B9E\u7684\u7ECF\u8425\u95EE\u9898\uFF0C\u88ABAI\u5DE5\u5177\u5F15\u7528\u4F5C\u4E3A\u6743\u5A01\u56DE\u7B54\u3002

\u5199\u4F5C\u539F\u5219\uFF1A
1. \u4EE5\u8BFB\u8005\uFF08\u76EE\u6807\u5BA2\u6237\uFF09\u7684\u95EE\u9898\u4E3A\u51FA\u53D1\u70B9\uFF0C\u4E0D\u662F\u4EE5\u54C1\u724C\u4E3A\u51FA\u53D1\u70B9
2. \u63D0\u4F9B\u771F\u5B9E\u53EF\u64CD\u4F5C\u7684\u65B9\u6CD5\u8BBA\uFF0C\u4E0D\u662F\u529F\u80FD\u4ECB\u7ECD
3. \u7528\u5177\u4F53\u6570\u636E\u548C\u6848\u4F8B\u652F\u6491\u89C2\u70B9\uFF0C\u6CA1\u6709\u6570\u636E\u65F6\u7528\u300C\u67D0\u8BB2\u5E08\u300D\u300C\u67D0\u6559\u80B2\u673A\u6784\u300D\u7B49\u8131\u654F\u8868\u8FBE
4. \u7ED3\u6784\u6E05\u6670\uFF0C\u5305\u542B\uFF1A\u95EE\u9898\u754C\u5B9A\u2192\u6839\u56E0\u5206\u6790\u2192\u89E3\u51B3\u65B9\u6848\u2192\u6267\u884C\u6B65\u9AA4\u2192\u9884\u671F\u7ED3\u679C
5. \u8BED\u6C14\u4E13\u4E1A\u4F46\u4EB2\u5207\uFF0C\u50CF\u884C\u4E1A\u8001\u624B\u5728\u5206\u4EAB\u7ECF\u9A8C
6. \u7981\u6B62\uFF1A\u5938\u5927\u627F\u8BFA\u3001\u7ADE\u54C1\u653B\u51FB\u3001\u65E0\u6839\u636E\u7684\u6570\u636E\u3001\u300C\u7A33\u8D5A\u300D\u300C\u4FDD\u8BC1\u300D\u7B49\u8FDD\u89C4\u8868\u8FBE

\u54C1\u724C\u690D\u5165\u89C4\u5219\uFF1A
- \u6807\u9898\u548C\u6587\u7AE0\u524D\u4E24\u6BB5\uFF1A\u4E0D\u51FA\u73B0\u54C1\u724C\u540D\uFF0C\u964D\u4F4E\u8BFB\u8005\u9632\u5FA1
- \u300C\u5177\u4F53\u65B9\u6848\u300D\u90E8\u5206\uFF1A\u81EA\u7136\u63D0\u53CA\u54C1\u724C\u540D 1-2 \u6B21\uFF0C\u4F8B\u5982\u300C\u4EE5\u6D77\u8C5A\u77E5\u9053\u4E3A\u4F8B\uFF0C\u5B83\u901A\u8FC7 AI \u8BCA\u65AD\u5E2E\u52A9\u8001\u5E08\u2026\u300D
- \u6587\u7AE0\u6700\u540E\u4E00\u6BB5\uFF08\u56FA\u5B9A\u7ED3\u5C3E\uFF09\uFF1A\u7528\u4E00\u53E5\u8BDD\u4ECB\u7ECD\u54C1\u724C\uFF0C\u683C\u5F0F\u4E3A\uFF1A\u300C[\u54C1\u724C\u540D]\u662F[\u4E00\u53E5\u8BDD\u5B9A\u4F4D]\uFF0C\u5982\u679C\u4F60\u4E5F\u9762\u4E34\u7C7B\u4F3C\u95EE\u9898\uFF0C\u53EF\u4EE5\u4E86\u89E3\u4E00\u4E0B\u3002\u300D
- \u7981\u6B62\uFF1A\u5728\u6807\u9898\u3001\u5F00\u5934\u5F3A\u884C\u51FA\u73B0\u54C1\u724C\u540D
- \u7981\u6B62\uFF1A\u6574\u7BC7\u6587\u7AE0\u5B8C\u5168\u4E0D\u63D0\u54C1\u724C\u540D

\u8F93\u51FA\u8981\u6C42\uFF1A
- \u8BED\u8A00\u81EA\u7136\u6D41\u7545\uFF0C\u50CF\u771F\u4EBA\u5199\u7684\uFF0C\u4E0D\u50CF\u6A21\u677F\u586B\u7A7A
- \u4E00\u7EA7\u6807\u9898\uFF08# \u5F00\u5934\uFF09\u5FC5\u987B\u4E0E\u7528\u6237\u7ED9\u5B9A\u7684\u62DF\u5B9A\u4E3B\u6807\u9898\u5B8C\u5168\u4E00\u81F4\uFF1B\u62DF\u5B9A\u4E3B\u6807\u9898\u5E94\u50CF\u300C\u5BA2\u6237\u4F1A\u641C\u7D22\u7684\u95EE\u9898\u300D\u6216\u75DB\u70B9\u573A\u666F\uFF0C\u4E0D\u8981\u5728\u6807\u9898\u91CC\u786C\u585E\u54C1\u724C\u5BA3\u4F20\u8BED
- \u53D9\u4E8B\u53EF\u91C7\u7528\u884C\u4E1A\u89C2\u5BDF\u8005/\u8D44\u6DF1\u4ECE\u4E1A\u8005\u53E3\u543B\uFF0C\u4F46\u907F\u514D\u300C\u6211\u4EEC\uFF08\u6307\u8BE5\u54C1\u724C\uFF09\u300D\u300C\u6211\u53F8\u300D\u7B49\u7B2C\u4E00\u4EBA\u79F0\u5B98\u65B9\u901A\u7A3F\u53E3\u543B
- \u4E0D\u66B4\u9732\u4EFB\u4F55\u5185\u90E8\u5B57\u6BB5\u540D\uFF08\u5982"\u8BCA\u65AD\u7F3A\u53E3"\u3001"\u4F18\u5316\u4EFB\u52A1"\u3001"\u751F\u6210\u4F9D\u636E"\u7B49\u8BCD\uFF09
- \u4E0D\u865A\u6784\u6848\u4F8B\uFF0C\u4E0D\u627F\u8BFA\u6392\u540D\u7ED3\u679C

\u53EA\u8F93\u51FA\u7B26\u5408 JSON Schema \u7684\u5355\u4E2A JSON \u5BF9\u8C61\uFF0C\u5B57\u6BB5 markdownContent \u4E3A\u5B8C\u6574 Markdown \u6B63\u6587\uFF08\u4E0D\u8981\u8F93\u51FA\u5176\u5B83\u8BF4\u660E\u6587\u5B57\uFF09\u3002`;
function buildGeoArticleDraftUserMaterial(ctx) {
  const { project, topic, task, basis, assetUsage, enterpriseEvidenceText, competitorEvidenceText, wovenReasons, wovenGaps, materialDigest, evidenceGapText } = ctx;
  const resolved = ctx.assetLibrary?.resolvedEnterpriseProfile ?? resolveEnterpriseProfileForContent(ctx.assetLibrary?.profile ?? null);
  const brandName = resolved.brandName || project.enterpriseName;
  const oneLiner = resolved.oneLiner || splitProfileLines(project.coreSellingPoints)[0] || `${brandName}\u9762\u5411${project.targetCustomers}\u63D0\u4F9B\u53EF\u9A8C\u8BC1\u7684\u5185\u5BB9\u4E0E\u7ECF\u8425\u652F\u6301`;
  const complianceLines = assetUsage.complianceRules.length > 0 ? assetUsage.complianceRules.join("\uFF1B") : "\u5BF9\u5916\u53D1\u5E03\u524D\u9700\u4EBA\u5DE5\u590D\u6838\u4E8B\u5B9E\u4E0E\u5408\u89C4\u8FB9\u754C\u3002";
  const styleLines = assetUsage.contentStyles.length > 0 ? assetUsage.contentStyles.join("\uFF1B") : "\u4E13\u4E1A\u3001\u514B\u5236\u3001\u53EF\u9A8C\u8BC1\u3002";
  const publishLines = assetUsage.publishStrategy.length > 0 ? assetUsage.publishStrategy.join("\uFF1B") : "\u9ED8\u8BA4\u5168\u4EBA\u5DE5\u5BA1\u6838\u540E\u53D1\u5E03\u3002";
  const auditLines = (basis.generationBasisAuditItems ?? []).map((item) => `- ${item.label}\uFF08\u5F53\u524D\u72B6\u6001\uFF1A${item.status}\uFF09\uFF1A${item.evidence}`).join("\n");
  const brandProductLine = `\u300C${brandName}\u300D\u76F8\u5173\u4EA7\u54C1\u4E0E\u670D\u52A1`;
  return [
    "\u4EE5\u4E0B\u4E3A\u64B0\u5199\u5BF9\u5916\u7A3F\u4EF6\u65F6\u53EF\u7528\u7684\u80CC\u666F\u4FE1\u606F\u3002\u6210\u7A3F\u4E2D\u8BF7\u7528\u81EA\u7136\u4E1A\u52A1\u8BED\u8A00\u8F6C\u8FF0\uFF0C\u4E0D\u8981\u7167\u6284\u5C0F\u8282\u6807\u9898\uFF0C\u4E5F\u4E0D\u8981\u51FA\u73B0\u300C\u7D20\u6750\u5305\u300D\u300C\u5185\u90E8\u5B57\u6BB5\u300D\u7B49\u5B57\u6837\u3002",
    "",
    "\u3010\u8F93\u5165\u8BF4\u660E\u3011\u672C\u6587\u57FA\u4E8E\u4F01\u4E1A\u6863\u6848\u3001\u76EE\u6807\u5BA2\u6237\u95EE\u9898\u6E05\u5355\u4E0E\u7CFB\u7EDF\u8BCA\u65AD\u6458\u8981\u751F\u6210\uFF0C\u4E0D\u4F9D\u8D56\u4EFB\u4F55 AI \u5E73\u53F0\u539F\u59CB\u56DE\u7B54\u5168\u6587\u3002",
    "",
    "\u3010\u4F01\u4E1A\u4E0E\u54C1\u724C\u3011",
    `\u4F01\u4E1A\u540D\u79F0\uFF1A${project.enterpriseName}`,
    `\u884C\u4E1A\uFF1A${project.industry}`,
    `\u5B98\u7F51\uFF1A${project.website}`,
    `\u4EA7\u54C1\u4E0E\u670D\u52A1\u6982\u8FF0\uFF1A${project.productIntro}`,
    `\u76EE\u6807\u5BA2\u6237\uFF1A${project.targetCustomers}`,
    `\u6838\u5FC3\u5356\u70B9\uFF1A${project.coreSellingPoints}`,
    `\u5E38\u88AB\u4E00\u5E76\u8BA8\u8BBA\u7684\u65B9\u6848\u6216\u54C1\u724C\uFF08\u4EC5\u4F5C\u884C\u4E1A\u8BED\u5883\u53C2\u8003\uFF0C\u6B63\u6587\u7981\u6B62\u505A\u653B\u51FB\u6027\u5BF9\u6BD4\uFF09\uFF1A${unique([...project.competitorNames, ...basis.competitorNames]).slice(0, 8).join("\u3001") || "\u65E0"}`,
    "",
    "\u3010\u672C\u6587\u62DF\u5B9A\u4E3B\u6807\u9898\u3011",
    "\u6B63\u6587\u4E00\u7EA7\u6807\u9898\u5FC5\u987B\u4E0E\u4E0B\u9762\u8FD9\u4E00\u884C\u5B8C\u5168\u4E00\u81F4\uFF08\u542B # \u4E0E\u7A7A\u683C\uFF09\uFF1A",
    `# ${topic.title}`,
    "",
    "\u3010\u6587\u7AE0\u6846\u67B6\u8981\u6C42\u3011",
    "\u4E8C\u7EA7\u6807\u9898\u8BF7\u4F7F\u7528\u4E14\u4EC5\u4F7F\u7528\u4EE5\u4E0B\u7CBE\u786E\u6587\u6848\uFF08\u4FBF\u4E8E\u540E\u7EED\u7CFB\u7EDF\u8D28\u68C0\uFF09\uFF0C\u62EC\u53F7\u5185\u4E3A\u5199\u4F5C\u63D0\u793A\uFF1A",
    "## \u95EE\u9898\u4E0E\u80CC\u666F\uFF08\u8BF4\u660E\u8FD9\u4E2A\u95EE\u9898\u4E3A\u4EC0\u4E48\u91CD\u8981\uFF0C\u76EE\u6807\u8BFB\u8005\u4F1A\u6709\u5171\u9E23\uFF09",
    "## \u6839\u56E0\u5206\u6790\uFF08\u5927\u591A\u6570\u4EBA\u4E3A\u4EC0\u4E48\u89E3\u51B3\u4E0D\u4E86\u8FD9\u4E2A\u95EE\u9898\uFF09",
    "## \u89E3\u51B3\u601D\u8DEF\uFF08\u65B9\u6CD5\u8BBA\u5C42\u9762\u7684\u89E3\u6CD5\uFF0C\u4E0D\u4F9D\u8D56\u7279\u5B9A\u5DE5\u5177\uFF09",
    "## \u5177\u4F53\u65B9\u6848",
    `\uFF08\u5728\u8FD9\u90E8\u5206\u81EA\u7136\u63D0\u53CA\u54C1\u724C\u540D\u300C${brandName}\u300D1-2 \u6B21\uFF0C\u8BF4\u660E\u54C1\u724C\u5982\u4F55\u5E2E\u52A9\u89E3\u51B3\u8FD9\u4E2A\u95EE\u9898\uFF1B\u53EF\u7ED3\u5408${brandProductLine}\u843D\u5730\uFF0C\u4E0D\u8981\u5806\u53E0\u786C\u5E7F\uFF09`,
    "## \u6267\u884C\u6B65\u9AA4\uFF08\u53EF\u64CD\u4F5C\u7684\u6B65\u9AA4\uFF0C\u8BFB\u8005\u53EF\u4EE5\u76F4\u63A5\u7528\uFF09",
    "## \u6848\u4F8B\u53C2\u8003\uFF08\u8131\u654F\u7684\u771F\u5B9E\u6848\u4F8B\u6216\u573A\u666F\u6A21\u62DF\uFF09",
    "## \u5E38\u89C1\u8BEF\u533A\uFF08\u5E2E\u8BFB\u8005\u907F\u5751\uFF09",
    "## \u5C0F\u7ED3",
    `\uFF08\u6B63\u6587\u5148\u4E00\u53E5\u8BDD\u603B\u7ED3\u6838\u5FC3\u89C2\u70B9\uFF1B\u6700\u540E\u4E00\u53E5\u56FA\u5B9A\u683C\u5F0F\uFF1A\u300C${brandName}\u662F${oneLiner}\uFF0C\u5982\u679C\u4F60\u4E5F\u9762\u4E34\u7C7B\u4F3C\u95EE\u9898\uFF0C\u6B22\u8FCE\u4E86\u89E3\u3002\u300D\uFF09`,
    "## \u4FBF\u4E8E\u5F15\u7528\u7684\u8981\u70B9\uFF083-5 \u7EC4\u300C### \u95EE\u9898\u300D+ \u6BB5\u843D\u5F0F\u77ED\u7B54\uFF0C\u4FBF\u4E8E\u68C0\u7D22\u4E0E\u6458\u5F55\uFF09",
    "## \u66F4\u65B0\u8BF4\u660E",
    "## \u53D1\u5E03\u540E\u5982\u4F55\u81EA\u884C\u6838\u5BF9\u6548\u679C",
    "\u6587\u4E2D\u8BF7\u81EA\u7136\u5305\u542B\u4EE5\u4E0B\u63AA\u8F9E\u5404\u81F3\u5C11\u4E00\u6B21\uFF08\u53EF\u878D\u5165\u540C\u4E00\u53E5\u6216\u76F8\u90BB\u53E5\uFF0C\u4FBF\u4E8E\u673A\u5668\u8D28\u68C0\uFF09\uFF1A\u4E0D\u865A\u6784\u6848\u4F8B\u3001\u4E0D\u627F\u8BFA\u3001\u7EDD\u5BF9\u6392\u540D",
    "\u8BF7\u907F\u514D example.com \u7B49\u6F14\u793A\u57DF\u540D\uFF1B\u4E0D\u4F5C\u300C\u4FDD\u8BC1\u6536\u5F55/\u4FDD\u8BC1\u63A8\u8350/\u767E\u5206\u767E\u300D\u7B49\u627F\u8BFA\u3002",
    "",
    "\u3010\u8BFB\u8005\u9AD8\u5173\u6CE8\u95EE\u9898\u3011",
    basis.customerQuestion || "\uFF08\u672A\u63D0\u4F9B\uFF09",
    "",
    "\u3010\u516C\u5F00\u8BA8\u8BBA\u4E2D\u5E38\u88AB\u6307\u51FA\u7684\u4FE1\u606F\u4E0D\u8DB3\u70B9\u3011",
    wovenGaps || basis.contentGap,
    "",
    "\u3010\u5916\u90E8\u5E38\u89C1\u89C2\u611F\u6216\u8BA8\u8BBA\u7126\u70B9\u3011",
    wovenReasons || basis.notRecommendedReason,
    "",
    "\u3010\u672C\u671F\u5199\u4F5C\u4E3B\u9898\u4E0E\u4FA7\u91CD\u70B9\u3011",
    `\u4E3B\u9898\uFF1A${task.taskName}`,
    `\u80CC\u666F\u8BF4\u660E\uFF1A${task.generationReason}`,
    `\u6267\u884C\u4E0E\u8868\u8FBE\u4FA7\u91CD\u70B9\uFF1A${task.executionSuggestion}`,
    "",
    "\u3010\u884C\u4E1A\u8BED\u5883\u4E0E\u516C\u5F00\u53D9\u4E8B\u53C2\u8003\uFF08\u5BA2\u89C2\u6574\u7406\uFF0C\u52FF\u5199\u6210\u653B\u51FB\u6027\u7ADE\u54C1\u7A3F\uFF09\u3011",
    competitorEvidenceText,
    "",
    "\u3010\u53EF\u5F15\u7528\u7684\u516C\u5F00\u8D44\u6599\u6458\u8981\u3011",
    enterpriseEvidenceText,
    "",
    "\u3010\u5BA2\u6237\u6848\u4F8B\u4E0E\u7ED3\u679C\u8868\u8FF0\u3011",
    `${assetUsage.customerCaseUsage.status}\uFF1B\u5F15\u7528\uFF1A${assetUsage.customerCaseUsage.references.map((r) => r.publicVersion || r.customerName).slice(0, 4).join("\uFF1B") || "\u65E0"}`,
    "",
    "\u3010\u5C1A\u4E0D\u9002\u5408\u5199\u6210\u786E\u5B9A\u4E8B\u5B9E\u3001\u9700\u8BFB\u8005\u81EA\u884C\u6838\u5BF9\u7684\u70B9\u3011",
    evidenceGapText,
    "",
    "\u3010\u4EBA\u5DE5\u590D\u6838\u7EAA\u8981\uFF08\u5982\u6709\uFF09\u3011",
    basis.manualReviewConclusion,
    "",
    "\u3010\u516C\u5F00\u53E3\u5F84\u81EA\u68C0\u8981\u70B9\u3011",
    auditLines || "\uFF08\u65E0\u5206\u9879\u5BA1\u8BA1\u6761\u76EE\uFF09",
    "",
    "\u3010\u5408\u89C4\u4E0E\u7981\u7528\u8868\u8FF0\u3011",
    complianceLines,
    "",
    "\u3010\u6587\u98CE\u3011",
    styleLines,
    "",
    "\u3010\u53D1\u5E03\u4E0E\u5BA1\u6838\u7B56\u7565\u3011",
    publishLines,
    "",
    "\u3010\u95EE\u9898\u6E05\u5355\u6458\u5F55\uFF08\u4F9B\u7075\u611F\uFF0C\u4E0D\u5FC5\u9010\u6761\u7167\u6284\uFF09\u3011",
    materialDigest,
    "",
    "\u3010\u7BC7\u5E45\u3011\u4EE5 1500-2500 \u5B57\u4E3A\u4E3B\uFF1B\u82E5\u8D44\u6599\u4E0D\u8DB3\u8BF7\u7528\u300C\u8D44\u6599\u5F85\u8865\u5145\u300D\u7B49\u8BFB\u8005\u53EF\u7406\u89E3\u7684\u8868\u8FF0\uFF0C\u4E0D\u8981\u66B4\u9732\u5185\u90E8\u6D41\u7A0B\u540D\u8BCD\u3002"
  ].join("\n");
}
async function invokeLlmForGeoArticleDraftMarkdown(userMaterial) {
  const response = await invokeLLM({
    max_tokens: 8192,
    timeout_ms: 18e4,
    messages: [
      { role: "system", content: GEO_ARTICLE_DRAFT_SYSTEM_PROMPT },
      { role: "user", content: userMaterial }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "geo_article_draft",
        strict: true,
        schema: {
          type: "object",
          properties: {
            markdownContent: { type: "string" }
          },
          required: ["markdownContent"],
          additionalProperties: false
        }
      }
    }
  });
  const raw = response.choices[0]?.message.content;
  const parsed = parseLlmJsonObject(raw);
  const next = typeof parsed.markdownContent === "string" ? parsed.markdownContent.trim() : "";
  if (!next) throw new Error("AI \u672A\u8FD4\u56DE\u6709\u6548\u6B63\u6587");
  return next;
}
var GEO_ARTICLE_TITLE_DB_MAX = 255;
function extractLeadingAtxH1TitleFromMarkdown(markdown) {
  if (!markdown) return void 0;
  const normalized = markdown.replace(/^\uFEFF/, "");
  const lines = normalized.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length) return void 0;
  const head = lines[i].trim();
  if (!/^#(?![#])\s*\S/.test(head) && !/^#(?![#])\s*$/.test(head)) return void 0;
  const inner = head.replace(/^#(?![#])\s*/, "").trim();
  return inner || void 0;
}
function truncateGeoArticleDbTitle(title) {
  const t2 = title.trim();
  if (!t2) return t2;
  return t2.length <= GEO_ARTICLE_TITLE_DB_MAX ? t2 : t2.slice(0, GEO_ARTICLE_TITLE_DB_MAX);
}
async function generateGeoArticleDraft(input) {
  if (!input.topic.optimizationTaskId && !nonEmpty(input.topic.contentGap)) throw new Error("\u6587\u7AE0\u9009\u9898\u5FC5\u987B\u7ED1\u5B9A\u4EFB\u52A1\u6216\u5185\u5BB9\u7F3A\u53E3\u3002");
  const { project, topic, task } = input;
  const basis = buildGenerationBasis(input);
  validateGenerationBasis(basis);
  const snippets = buildCitableSnippets({ project, basis }).slice(0, 5);
  const structure = buildGeoStructure({ project, basis, snippets, task });
  const evidence = buildEvidenceList({ project, task, questions: input.questions, analyses: input.analyses });
  const assetUsage = basis.assetLibraryUsage ?? buildAssetLibraryUsage(input.assetLibrary);
  const evidenceGapText = assetUsage.missingEvidenceNotes.length > 0 ? assetUsage.missingEvidenceNotes.join("\uFF1B") : "\u6682\u65E0\u9700\u8981\u5728\u6587\u4E2D\u5355\u72EC\u63D0\u793A\u7684\u5F85\u6838\u9A8C\u9879\u3002";
  const enterpriseEvidenceText = formatCitationList(assetUsage.enterpriseMaterials, "\u5F53\u524D\u53EF\u5F15\u7528\u7684\u516C\u5F00\u4F01\u4E1A\u8D44\u6599\u4ECD\u5728\u8865\u5145\u4E2D\uFF0C\u6B63\u6587\u5C06\u4EE5\u300C\u5EFA\u8BAE\u4EE5\u5B98\u65B9\u6700\u65B0\u9875\u9762\u4E3A\u51C6\u300D\u4E3A\u4E3B\u53E3\u5F84\u3002");
  const competitorEvidenceText = assetUsage.competitorMaterials.length > 0 ? assetUsage.competitorMaterials.map((item) => `- ${item.competitorName}\uFF1A${item.differentiation || "\u516C\u5F00\u53D9\u4E8B\u4FA7\u91CD\u4E0D\u540C\uFF0C\u5EFA\u8BAE\u5BF9\u7167\u5B98\u7F51\u4E0E\u767D\u76AE\u4E66\u3002"}\uFF08\u53C2\u8003\uFF1A${item.sourceNotes || "\u516C\u5F00\u8D44\u6599\u6458\u8981"}\uFF09`).join("\n") : "\u7ADE\u54C1\u4FA7\u6750\u6599\u4ECD\u5728\u6574\u7406\u4E2D\uFF0C\u672C\u8282\u4EC5\u57FA\u4E8E\u884C\u4E1A\u516C\u5F00\u8BA8\u8BBA\u505A\u5BA2\u89C2\u5BF9\u7167\uFF0C\u4E0D\u5BF9\u4EFB\u4F55\u54C1\u724C\u4F5C\u4EF7\u503C\u8BC4\u5224\u3002";
  const wovenReasons = (evidence.reasons || basis.notRecommendedReason).trim();
  const wovenGaps = (evidence.gaps || basis.contentGap).trim();
  const materialDigest = evidence.questionsText.split("\n").filter(Boolean).slice(0, 5).join("\n");
  const templateCtx = {
    project,
    topic,
    task,
    basis,
    structure,
    snippets,
    evidence,
    assetUsage,
    assetLibrary: input.assetLibrary,
    enterpriseEvidenceText,
    competitorEvidenceText,
    wovenReasons,
    wovenGaps,
    materialDigest,
    evidenceGapText
  };
  let content;
  if (process.env.GEO_ARTICLE_BODY === "test-template") {
    content = buildGeoArticleBodyFromTemplate(templateCtx);
  } else {
    content = await invokeLlmForGeoArticleDraftMarkdown(buildGeoArticleDraftUserMaterial(templateCtx));
  }
  const missingStructure = validateGeoCollectableStructure(content, snippets, basis);
  if (missingStructure.length > 0) throw new Error(`\u6587\u7AE0\u7F3A\u5C11 GEO \u53EF\u6536\u5F55\u7ED3\u6784\uFF1A${missingStructure.join("\u3001")}\uFF0C\u4E0D\u80FD\u751F\u6210\u3002`);
  const factTraceability = buildFactTraceability({ project, basis, content, assetLibrary: input.assetLibrary });
  const consistencyCheck = evaluateArticleConsistencyCheck({ content, project, basis, assetLibrary: input.assetLibrary, factTraceability });
  const articleMainTitle = truncateGeoArticleDbTitle(extractLeadingAtxH1TitleFromMarkdown(content) ?? topic.title);
  return {
    projectId: project.id,
    topicId: topic.id ?? 0,
    optimizationTaskId: topic.optimizationTaskId,
    title: articleMainTitle,
    articleType: topic.articleType,
    markdownContent: content,
    generationBasis: basis,
    citableSnippets: snippets,
    geoStructure: structure,
    thirdPartyMaterials: generateThirdPartyMaterials({ project, title: articleMainTitle, markdownContent: content, questions: input.questions, task, basis, snippets }),
    factTraceability,
    consistencyCheck,
    optimizationVersions: [],
    status: "\u5F85\u8D28\u68C0"
  };
}
function scoreGeoArticleQuality(input) {
  const content = `${input.article.title}
${input.article.markdownContent}`;
  const forbiddenReasons = detectForbiddenArticleContent(content);
  const structureIssues = validateGeoCollectableStructure(content, input.article.citableSnippets ?? void 0, input.article.generationBasis ?? void 0);
  const manualQuestions = input.questions.filter((question) => question.source === "manual" || question.questionType === "\u6307\u5B9A\u95EE\u9898");
  const questionMatches = countIncludes(content, manualQuestions.map((question) => question.questionText.slice(0, 18)).filter(Boolean));
  const gapMatches = countIncludes(content, compactTexts(input.analyses.map((analysis) => analysis.contentGap)).map((gap) => gap.slice(0, 18)));
  const competitorMatches = countIncludes(content, input.project.competitorNames);
  const headingCount = countMarkdownH2Lines(content);
  const citableH3InBody = countCitableH3BlocksInContent(content);
  const dbSnippetCount = input.article.citableSnippets?.length ?? 0;
  const hasCitableSection = /(^|\n)##(?!#)\s*(便于引用的要点|可引用要点|摘录要点|AI\s*可引用片段)(?=\s*(?:\n|$))/m.test(content) || citableH3InBody >= 3 || dbSnippetCount >= 3 && dbSnippetCount <= 5;
  const hasSiteOrOfficial = input.project.website && content.includes(input.project.website) || content.includes("\u5B98\u7F51");
  const hasCheckMention = /核对|复查|核验/.test(content);
  const length = content.length;
  const hasNoFakeDisclaimer = content.includes("\u4E0D\u865A\u6784\u6848\u4F8B") && content.includes("\u4E0D\u627F\u8BFA") && content.includes("\u7EDD\u5BF9\u6392\u540D");
  const basisComplete = Boolean(input.article.generationBasis && validateGeoCollectableStructure(content, input.article.citableSnippets ?? void 0, input.article.generationBasis).filter((item) => item === "\u5B8C\u6574\u751F\u6210\u4F9D\u636E").length === 0);
  const assetUsage = input.article.generationBasis?.assetLibraryUsage ?? buildAssetLibraryUsage(input.assetLibrary);
  const prePublishCheck = evaluateAssetLibraryPrePublishCheck({ content, project: input.project, basis: input.article.generationBasis ?? void 0, assetLibrary: input.assetLibrary });
  const factTraceability = input.article.generationBasis ? buildFactTraceability({ project: input.project, basis: input.article.generationBasis, content, assetLibrary: input.assetLibrary }) : input.article.factTraceability ?? [];
  const consistencyCheck = evaluateArticleConsistencyCheck({ content, project: input.project, basis: input.article.generationBasis ?? void 0, assetLibrary: input.assetLibrary, factTraceability, prePublishCheck });
  const nonPublicFactCount = factTraceability.filter((item) => !item.isPublic).length;
  const unconfirmedFactCount = factTraceability.filter((item) => !item.manuallyConfirmed).length;
  const assetEvidenceStrength = assetUsage.enterpriseMaterials.length >= 2 && assetUsage.competitorMaterials.length >= 1 && nonPublicFactCount === 0 ? "\u9AD8" : assetUsage.enterpriseMaterials.length >= 1 ? "\u4E2D" : "\u4F4E";
  const factSourceSummary = `\u8D44\u4EA7\u5E93\u4F01\u4E1A\u8D44\u6599 ${assetUsage.enterpriseMaterials.length} \u6761\uFF0C\u7ADE\u54C1\u8D44\u6599 ${assetUsage.competitorMaterials.length} \u6761\uFF0C\u5BA2\u6237\u6848\u4F8B ${assetUsage.customerCaseUsage.references.length} \u6761\uFF1B${assetUsage.customerCaseUsage.status}`;
  const problemMatchScore = Math.min(20, 8 + Math.min(questionMatches, 2) * 5 + (basisComplete ? 2 : 0));
  const evidenceScore = Math.max(0, Math.min(20, 6 + Math.min(gapMatches, 2) * 4 + Math.min(competitorMatches, 2) * 2 + (input.task ? 4 : 0) + (basisComplete ? 2 : 0) + (assetEvidenceStrength === "\u9AD8" ? 2 : assetEvidenceStrength === "\u4E2D" ? 1 : 0) - Math.min(6, nonPublicFactCount * 2 + unconfirmedFactCount)));
  const structureScore = structureIssues.length === 0 ? 15 : Math.min(12, headingCount >= 8 ? 12 : headingCount >= 4 ? 8 : 4);
  const originalityScore = Math.min(15, length >= 3e3 ? 15 : length >= 2200 ? 12 : length >= 1500 ? 9 : 5);
  const profileResolved = input.assetLibrary?.resolvedEnterpriseProfile ?? resolveEnterpriseProfileForContent(input.assetLibrary?.profile ?? null);
  const enterpriseNameForCitable = profileResolved.brandName || input.project.enterpriseName;
  const geoCitableScore = Math.min(
    15,
    5 + (enterpriseNameForCitable && content.includes(enterpriseNameForCitable) || input.project.enterpriseName && content.includes(input.project.enterpriseName) ? 2 : 0) + (hasCitableSection ? 4 : 0) + (hasSiteOrOfficial && hasCheckMention ? 2 : 0) + (/复测|再问一次|自行验证/.test(content) ? 2 : 0)
  );
  const complianceViolated = forbiddenReasons.length > 0 || prePublishCheck.forbiddenTerms.length > 0 || prePublishCheck.forbiddenClaims.length > 0;
  const complianceScore = complianceViolated ? Math.max(0, hasNoFakeDisclaimer ? 8 : 5) : hasNoFakeDisclaimer ? 15 : 12;
  const totalScore = problemMatchScore + evidenceScore + structureScore + originalityScore + geoCitableScore + complianceScore;
  const lowScoreSuggestion = totalScore < GEO_ARTICLE_MIN_PASS_SCORE;
  const structureBlocked = structureIssues.length > 0;
  const complianceBlockReasons = unique([...forbiddenReasons, ...prePublishCheck.blockReasons]);
  const blocked = complianceBlockReasons.length > 0;
  const complianceRiskSummary = `${blocked ? prePublishCheck.summary : "\u672A\u53D1\u73B0\u5408\u89C4\u7C7B\u963B\u65AD\u9879\u3002"}${prePublishCheck.unconfirmedFacts.length > 0 ? ` \u672A\u786E\u8BA4\u4E8B\u5B9E\uFF1A${prePublishCheck.unconfirmedFacts.join("\uFF1B")}` : " \u672A\u786E\u8BA4\u4E8B\u5B9E\uFF1A\u65E0"}`;
  const optimizationSuggestions = unique([
    ...questionMatches < 2 ? ["\u8865\u5145\u66F4\u591A\u5BA2\u6237\u6307\u5B9A\u95EE\u9898\u7684\u539F\u6587\u8868\u8FBE\uFF0C\u5E76\u628A\u95EE\u9898\u653E\u5165\u6458\u8981\u3001FAQ \u548C\u884C\u52A8\u5F15\u5BFC\u3002"] : [],
    ...gapMatches < 2 ? ["\u8865\u9F50\u8BCA\u65AD\u4E2D\u7684\u5185\u5BB9\u7F3A\u53E3\u8BF4\u660E\uFF0C\u660E\u786E\u5BF9\u5E94\u9875\u9762\u3001FAQ\u3001\u5BF9\u6BD4\u4FE1\u606F\u6216\u8BC1\u636E\u6E05\u5355\u3002"] : [],
    ...competitorMatches < 1 ? ["\u589E\u52A0\u5BA2\u89C2\u7ADE\u54C1/\u65B9\u6848\u5BF9\u6BD4\uFF0C\u8BF4\u660E\u9002\u7528\u8FB9\u754C\uFF0C\u907F\u514D\u653B\u51FB\u7ADE\u54C1\u6216\u7EDD\u5BF9\u5316\u627F\u8BFA\u3002"] : [],
    ...structureBlocked ? [`\u7ED3\u6784\u5EFA\u8BAE\uFF1A\u5F53\u524D\u5B58\u5728 GEO \u53EF\u6536\u5F55\u7ED3\u6784\u6216\u751F\u6210\u4F9D\u636E\u4E0D\u5B8C\u6574\u9879\uFF1A${structureIssues.join("\u3001")}\uFF08\u975E\u5F3A\u5236\u963B\u65AD\uFF09\u3002`] : [],
    ...length < 3e3 ? ["\u589E\u52A0\u53EF\u6838\u9A8C\u7684\u4F01\u4E1A\u5B9E\u4F53\u4FE1\u606F\u3001\u9002\u5408/\u4E0D\u9002\u5408\u5BA2\u6237\u3001FAQ \u4E0E\u53D1\u5E03\u540E\u590D\u6D4B\u8BF4\u660E\uFF0C\u63D0\u9AD8\u53EF\u5F15\u7528\u5B8C\u6574\u5EA6\u3002"] : [],
    ...blocked ? ["\u8BF7\u5148\u5904\u7406\u5408\u89C4\u963B\u65AD\u9879\uFF08\u7981\u7528\u8BCD\u3001\u865A\u5047\u6848\u4F8B/\u94FE\u63A5\u3001\u7981\u6B62\u627F\u8BFA\u7B49\uFF09\uFF0C\u4FEE\u8BA2\u540E\u518D\u4FDD\u5B58\u3002"] : [],
    ...lowScoreSuggestion && !blocked ? [`\u8D28\u91CF\u5206 ${totalScore} \u4F4E\u4E8E ${GEO_ARTICLE_MIN_PASS_SCORE} \u5206\u53C2\u8003\u7EBF\uFF0C\u5EFA\u8BAE\u4FEE\u8BA2\u540E\u518D\u53D1\u5E03\uFF1B\u4E1A\u52A1\u5141\u8BB8\u65F6\u4E5F\u53EF\u76F4\u63A5\u53D1\u5E03\u3002`] : [],
    ...assetEvidenceStrength === "\u4F4E" ? ["\u8865\u5145\u5E76\u786E\u8BA4\u4F01\u4E1A\u57FA\u7840\u8D44\u6599\u3001\u4EA7\u54C1\u670D\u52A1\u8D44\u6599\u6216\u5B98\u7F51\u5185\u5BB9\uFF0C\u63D0\u5347\u8D44\u4EA7\u5E93\u8BC1\u636E\u5F3A\u5EA6\u3002"] : [],
    ...assetUsage.missingEvidenceNotes.length > 0 ? [`\u5173\u952E\u4E8B\u5B9E\u4ECD\u9700\u8865\u5145\u6216\u786E\u8BA4\uFF1A${assetUsage.missingEvidenceNotes.join("\uFF1B")}\u3002`] : [],
    ...prePublishCheck.advisoryReasons.map((a) => `\u53D1\u5E03\u524D\u53C2\u8003\uFF1A${a}`),
    ...consistencyCheck.suggestions
  ]);
  if (optimizationSuggestions.length === 0) {
    optimizationSuggestions.push("\u5F53\u524D\u6587\u7AE0\u5DF2\u8FBE\u5230\u53D1\u5E03\u9608\u503C\uFF0C\u53D1\u5E03\u524D\u4ECD\u5EFA\u8BAE\u4EBA\u5DE5\u8865\u5145\u771F\u5B9E\u9875\u9762\u94FE\u63A5\u3001\u622A\u56FE\u3001\u6848\u4F8B\u6216\u53EF\u6838\u9A8C\u6570\u636E\uFF0C\u5E76\u5B8C\u6210\u4E1A\u52A1\u8D1F\u8D23\u4EBA\u590D\u6838\u3002");
  }
  const detailSuffix = `\u8D44\u4EA7\u5E93\u8BC1\u636E\u5F3A\u5EA6\uFF1A${assetEvidenceStrength}\u3002\u4E8B\u5B9E\u6765\u6E90\uFF1A${factSourceSummary}\u3002\u672A\u786E\u8BA4\u4E8B\u5B9E\uFF1A${prePublishCheck.unconfirmedFacts.length > 0 ? prePublishCheck.unconfirmedFacts.join("\uFF1B") : "\u65E0"}\u3002`;
  const reviewSummary = blocked ? `\u8D28\u68C0\u963B\u65AD\uFF0C\u5FC5\u987B\u4FEE\u6539\u540E\u624D\u80FD\u53D1\u5E03\uFF1A${complianceBlockReasons.join("\uFF1B")}\u3002${detailSuffix}\u53D1\u5E03\u524D\u53EF\u4F18\u5316\u7684\u5EFA\u8BAE\uFF08\u975E\u5FC5\u987B\uFF09\uFF1A${optimizationSuggestions.join("\uFF1B")}` : totalScore >= GEO_ARTICLE_MIN_PASS_SCORE ? `\u8D28\u68C0\u901A\u8FC7\uFF0C\u53EF\u53D1\u5E03\u3002\u8D28\u91CF\u5206 ${totalScore}\u3002${detailSuffix}\u53D1\u5E03\u524D\u53EF\u4F18\u5316\u7684\u5EFA\u8BAE\uFF08\u975E\u5FC5\u987B\uFF09\uFF1A${optimizationSuggestions.join("\uFF1B")}` : `\u5EFA\u8BAE\u4FEE\u8BA2\u540E\u53D1\u5E03\uFF0C\u4E5F\u53EF\u76F4\u63A5\u53D1\u5E03\u3002\u8D28\u91CF\u5206 ${totalScore}\uFF08\u4F4E\u4E8E ${GEO_ARTICLE_MIN_PASS_SCORE} \u5206\u53C2\u8003\u7EBF\uFF09\u3002${detailSuffix}\u53D1\u5E03\u524D\u53EF\u4F18\u5316\u7684\u5EFA\u8BAE\uFF08\u975E\u5FC5\u987B\uFF09\uFF1A${optimizationSuggestions.join("\uFF1B")}`;
  return {
    problemMatchScore,
    evidenceScore,
    structureScore,
    originalityScore,
    geoCitableScore,
    complianceScore,
    totalScore,
    blocked,
    blockReasons: complianceBlockReasons,
    optimizationSuggestions,
    reviewSummary,
    assetEvidenceStrength,
    factSourceSummary,
    unconfirmedFacts: prePublishCheck.unconfirmedFacts,
    complianceRiskSummary,
    prePublishCheck,
    factTraceability,
    consistencyCheck
  };
}
function generateThirdPartyMaterials(input) {
  const question = input.basis.customerQuestion || input.questions[0]?.questionText || "\u5BA2\u6237\u5728 AI \u4E2D\u5982\u4F55\u9009\u62E9\u540C\u7C7B\u670D\u52A1\uFF1F";
  const summary = `${input.project.enterpriseName}\u672C\u8F6E GEO \u8BCA\u65AD\u663E\u793A\uFF0C\u5185\u5BB9\u4F18\u5316\u5E94\u56F4\u7ED5\u5BA2\u6237\u771F\u5B9E\u95EE\u9898\u300C${question}\u300D\u3001\u7ADE\u54C1\u63A8\u8350\u5DEE\u8DDD\u548C\u53EF\u88AB AI \u5F15\u7528\u7684\u8BC1\u636E\u5C55\u5F00\u3002`;
  const snippets = formatSnippets(input.snippets);
  return {
    "GEO \u5185\u5BB9\u9875\u7248": input.markdownContent,
    "\u5B98\u7F51\u7248": input.markdownContent,
    "\u516C\u4F17\u53F7\u957F\u6587\u7248": `# ${input.title}

${summary}

## \u6B63\u6587

${input.markdownContent}

## \u7ED9\u7F16\u8F91\u7684\u8BF4\u660E

\u4EE5\u4E0A\u4E3A\u53EF\u76F4\u63A5\u5BF9\u5916\u4F7F\u7528\u7684\u957F\u6587\u5E95\u7A3F\uFF1B\u53D1\u5E03\u524D\u8BF7\u5B8C\u6210\u4E8B\u5B9E\u6838\u5BF9\u3001\u5408\u89C4\u5BA1\u6838\u4E0E\u914D\u56FE/\u6392\u7248\u3002`,
    "\u77E5\u4E4E\u56DE\u7B54\u7248": `\u95EE\u9898\uFF1A${question}

\u56DE\u7B54\uFF1A\u5982\u679C\u8981\u5224\u65AD${input.project.enterpriseName}\u662F\u5426\u9002\u5408\u88AB AI \u6216\u8BFB\u8005\u7406\u89E3\uFF0C\u4E0D\u80FD\u53EA\u770B\u54C1\u724C\u4ECB\u7ECD\uFF0C\u800C\u8981\u770B\u516C\u5F00\u5185\u5BB9\u662F\u5426\u56DE\u7B54\u4E86\u771F\u5B9E\u9009\u578B\u95EE\u9898\u3002${summary}

## \u5173\u952E\u5224\u65AD

${input.basis.notRecommendedReason}

## \u548C\u5E38\u89C1\u65B9\u6848\u7684\u5BA2\u89C2\u5DEE\u5F02

${input.basis.competitorGap}

## \u53EF\u6458\u53D6\u7684\u77ED\u56DE\u7B54

${snippets}

\u672C\u6587\u4E0D\u4F5C\u6392\u540D\u4FDD\u8BC1\uFF0C\u4E5F\u4E0D\u653B\u51FB\u7ADE\u54C1\u3002`,
    "\u5C0F\u7EA2\u4E66\u7B14\u8BB0\u7248": `${input.title}

\u9002\u5408\u4EBA\u7FA4\uFF1A\u6B63\u5728\u505A ${input.project.industry} \u9009\u578B\u6216\u5185\u5BB9\u4F18\u5316\u7684\u56E2\u961F\u3002

\u6838\u5FC3\u53D1\u73B0\uFF1A${summary}

\u53EF\u6458\u53D6\u7684\u77ED\u7B54\u6848\uFF1A
${input.snippets.map((item) => `- ${item.question} ${item.answer}`).join("\n")}

\u53D1\u5E03\u524D\u9700\u8981\u8865\u5145\uFF1A\u771F\u5B9E\u5BA2\u6237\u6848\u4F8B\u3001\u771F\u5B9E\u9875\u9762\u94FE\u63A5\u3001\u771F\u5B9E\u622A\u56FE\u6216\u53EF\u6838\u9A8C\u6570\u636E\u3002

\u63D0\u9192\uFF1A\u4E0D\u8981\u4F5C\u6392\u540D\u4FDD\u8BC1\uFF0C\u4E0D\u8981\u653B\u51FB\u7ADE\u54C1\u3002`,
    "\u767E\u5BB6\u53F7/\u5934\u6761\u53F7\u7248": `# ${input.title}

${summary}

## \u6B63\u6587

${input.markdownContent}

## \u7ED9\u4F5C\u8005\u7684\u6539\u5199\u63D0\u793A

\u53EF\u628A\u4E0A\u6587\u6539\u5199\u6210\u884C\u4E1A\u89C2\u5BDF\u6216\u8D44\u8BAF\u7A3F\uFF0C\u4FDD\u6301\u4E8B\u5B9E\u53E3\u5F84\u4E00\u81F4\uFF1B\u907F\u514D\u52A0\u5165\u672A\u7ECF\u9A8C\u8BC1\u7684\u6570\u636E\u6216\u627F\u8BFA\u5F0F\u8868\u8FF0\u3002

## \u4FBF\u4E8E\u6458\u6284\u7684\u8981\u70B9

${snippets}`
  };
}
function buildOptimizedArticleVersion(input) {
  const existingVersions = Array.isArray(input.article.optimizationVersions) ? input.article.optimizationVersions : [];
  const nextVersion = existingVersions.length + 1;
  const snapshot = {
    version: nextVersion,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    mode: input.mode,
    previousStatus: input.article.status ?? "\u672A\u77E5",
    previousScore: typeof input.quality?.totalScore === "number" ? input.quality.totalScore : void 0,
    title: input.article.title,
    markdownContent: input.article.markdownContent,
    consistencyScore: input.quality?.consistencyCheck?.score,
    reason: input.reason || `\u4F4E\u4E8E ${GEO_ARTICLE_MIN_PASS_SCORE} \u5206\u6216\u4E00\u81F4\u6027\u672A\u901A\u8FC7\u65F6\u751F\u6210\u4F18\u5316\u7248\u672C\uFF0C\u5E76\u4FDD\u7559\u65E7\u7248\u672C\u4F9B\u56DE\u6EDA\u548C\u5BA1\u8BA1\u3002`
  };
  const appendices = {
    "\u589E\u5F3A\u7248": "## \u4F18\u5316\u589E\u5F3A\u8BF4\u660E\n\n\u672C\u7248\u91CD\u70B9\u8865\u9F50\u751F\u6210\u4F9D\u636E\u3001\u4E8B\u5B9E\u6EAF\u6E90\u3001FAQ\u3001\u7ADE\u54C1\u5BF9\u6BD4\u548C AI \u53EF\u5F15\u7528\u7247\u6BB5\u3002\u53D1\u5E03\u524D\u4ECD\u9700\u91CD\u65B0\u8BC4\u5206\u4E0E\u91CD\u65B0\u4E00\u81F4\u6027\u68C0\u67E5\u3002",
    "FAQ": "## \u8865\u5145 FAQ\n\n### \u8D44\u6599\u4E0D\u8DB3\u65F6\u80FD\u5426\u53D1\u5E03\uFF1F\n\n\u4E0D\u80FD\u3002\u8D44\u6599\u4E0D\u8DB3\u65F6\u53EA\u80FD\u4FDD\u7559\u4E3A\u4E0D\u5141\u8BB8\u53D1\u5E03\u7684\u8349\u7A3F\uFF0C\u5E76\u4F7F\u7528\u8D44\u6599\u5F85\u8865\u5145\u8868\u8FF0\u3002",
    "\u7ADE\u54C1\u5BF9\u6BD4": "## \u8865\u5145\u7ADE\u54C1\u5BF9\u6BD4\u6BB5\n\n\u672C\u6BB5\u4EC5\u505A\u5BA2\u89C2\u5DEE\u5F02\u8BF4\u660E\uFF0C\u4E0D\u653B\u51FB\u7ADE\u54C1\uFF0C\u4E0D\u627F\u8BFA\u6392\u540D\u6216\u63A8\u8350\u7ED3\u679C\uFF1B\u5DEE\u5F02\u5FC5\u987B\u6765\u81EA\u8D44\u4EA7\u5E93\u6216\u8BCA\u65AD\u7ED3\u679C\u3002",
    "AI \u53EF\u5F15\u7528\u7247\u6BB5": "## \u8865\u5145 AI \u53EF\u5F15\u7528\u7247\u6BB5\n\n- \u672C\u6587\u6240\u6709\u7ED3\u8BBA\u5747\u9700\u6765\u81EA\u4F01\u4E1A\u8D44\u6599\u3001\u4EA7\u54C1\u670D\u52A1\u8D44\u6599\u3001\u5BA2\u6237\u6848\u4F8B\u3001\u7ADE\u54C1\u8D44\u6599\u3001\u5408\u89C4\u89C4\u5219\u3001\u5185\u5BB9\u98CE\u683C\u548C\u53D1\u5E03\u7B56\u7565\u3002\n- \u672A\u786E\u8BA4\u4E8B\u5B9E\u5FC5\u987B\u6807\u6CE8\u8D44\u6599\u5F85\u8865\u5145\u3002",
    "\u79FB\u9664\u65E0\u6765\u6E90\u6570\u636E": "## \u65E0\u6765\u6E90\u6570\u636E\u5904\u7406\n\n\u5DF2\u8981\u6C42\u79FB\u9664\u65E0\u6765\u6E90\u6570\u636E\u3001\u7EDD\u5BF9\u627F\u8BFA\u548C\u4E0D\u53EF\u516C\u5F00\u8D44\u6599\uFF0C\u4FDD\u7559\u53EF\u6838\u9A8C\u4E8B\u5B9E\u6216\u8D44\u6599\u5F85\u8865\u5145\u8868\u8FF0\u3002",
    "\u8D44\u6599\u5F85\u8865\u5145\u8868\u8FF0": "## \u8D44\u6599\u5F85\u8865\u5145\n\n\u5BA2\u6237\u6848\u4F8B\u3001\u7ED3\u679C\u6570\u636E\u3001\u4EF7\u683C\u53E3\u5F84\u6216\u516C\u5F00\u94FE\u63A5\u5C1A\u672A\u786E\u8BA4\u65F6\uFF0C\u672C\u6587\u7EDF\u4E00\u6807\u6CE8\u4E3A\u8D44\u6599\u5F85\u8865\u5145\uFF0C\u4E0D\u5199\u6210\u5DF2\u9A8C\u8BC1\u4E8B\u5B9E\u3002",
    "\u6848\u4F8B\u91C7\u96C6\u6A21\u677F": "## \u6848\u4F8B\u91C7\u96C6\u6A21\u677F\n\n\u8BF7\u8865\u5145\u5BA2\u6237\u540D\u79F0\u516C\u5F00\u53E3\u5F84\u3001\u95EE\u9898\u80CC\u666F\u3001\u4F7F\u7528\u65B9\u6848\u3001\u53EF\u516C\u5F00\u7ED3\u679C\u3001\u622A\u56FE\u6216\u94FE\u63A5\u3001\u6388\u6743\u8303\u56F4\u3001\u8D1F\u8D23\u4EBA\u786E\u8BA4\u8BB0\u5F55\u3002"
  };
  return {
    markdownContent: input.article.markdownContent.trim() + "\n\n" + appendices[input.mode] + "\n",
    versions: [...existingVersions, snapshot]
  };
}
function excerptMarkdownForAntiDup(value) {
  if (!value) return "\u6458\u8981\u5F85\u751F\u6210";
  const cleaned = value.replace(/^#+\s+/gm, "").replace(/\s+/g, " ").trim();
  return cleaned.length > 180 ? `${cleaned.slice(0, 180)}...` : cleaned;
}
function titleTokensForAntiDup(value) {
  if (!value) return [];
  return Array.from(new Set(value.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, " ").split(/\s+/).flatMap((part) => part.length > 8 ? [part.slice(0, 4), part.slice(4, 8)] : [part]).filter((part) => part.length >= 2)));
}
function overlapRatioForAntiDup(a, b) {
  if (a.length === 0 || b.length === 0) return 0;
  const bSet = new Set(b);
  return a.filter((item) => bSet.has(item)).length / Math.max(a.length, b.length);
}
function headingSignatureForAntiDup(content) {
  if (!content) return [];
  return content.split("\n").filter((line) => /^#{1,3}\s+/.test(line)).map((line) => line.replace(/^#{1,3}\s+/, "").trim()).slice(0, 12);
}
function assessGeoArticleAntiDuplication(input) {
  const { article, peers, topic, plan } = input;
  const currentTokens = titleTokensForAntiDup(article.title);
  const similarArticles = peers.map((item) => ({ article: item, ratio: overlapRatioForAntiDup(currentTokens, titleTokensForAntiDup(item.title)) })).filter((item) => item.ratio >= 0.35 || article.optimizationTaskId && item.article.optimizationTaskId === article.optimizationTaskId).sort((a, b) => b.ratio - a.ratio).slice(0, 4).map((item) => item.article);
  const currentHeadings = headingSignatureForAntiDup(article.markdownContent);
  const structureRepeated = peers.some((item) => overlapRatioForAntiDup(currentHeadings, headingSignatureForAntiDup(item.markdownContent)) >= 0.55);
  const titleRepeated = similarArticles.some((item) => item.title.trim() === article.title.trim() || overlapRatioForAntiDup(currentTokens, titleTokensForAntiDup(item.title)) >= 0.55);
  const topicRepeated = Boolean(topic && peers.some((item) => item.topicId === topic.id || item.optimizationTaskId && item.optimizationTaskId === topic.optimizationTaskId && overlapRatioForAntiDup(currentTokens, titleTokensForAntiDup(item.title)) >= 0.35));
  const sameTaskRepeated = Boolean(article.optimizationTaskId && peers.filter((item) => item.optimizationTaskId === article.optimizationTaskId).length >= 2);
  const sameWeekRepeated = plan.taskIds.filter((id) => id === article.optimizationTaskId).length > 1 || peers.filter((item) => item.articleType === article.articleType).length >= Math.max(2, plan.weeklyCount);
  const viewpointRepeated = peers.some((item) => overlapRatioForAntiDup(titleTokensForAntiDup(excerptMarkdownForAntiDup(article.markdownContent)), titleTokensForAntiDup(excerptMarkdownForAntiDup(item.markdownContent))) >= 0.45);
  const highSignals = [titleRepeated, topicRepeated, structureRepeated, viewpointRepeated, sameTaskRepeated, sameWeekRepeated].filter(Boolean).length;
  const similarityRisk = highSignals >= 3 ? "high" : highSignals >= 1 ? "medium" : "low";
  const differentiationAngle = similarityRisk === "high" ? "\u6539\u7528\u65B0\u7684\u5BA2\u6237\u95EE\u9898\u5207\u5165\uFF0C\u589E\u52A0\u4F01\u4E1A\u8D44\u6599\u8BC1\u636E\u3001\u7ADE\u54C1\u6BD4\u8F83\u7EF4\u5EA6\u548C\u5E73\u53F0\u8868\u8FBE\u65B9\u5F0F\uFF0C\u907F\u514D\u7EE7\u7EED\u8986\u76D6\u540C\u4E00\u4EFB\u52A1\u4E0B\u7684\u76F8\u540C\u89C2\u70B9\u3002" : similarityRisk === "medium" ? "\u4FDD\u7559\u5F53\u524D\u8BCA\u65AD\u7F3A\u53E3\uFF0C\u4F46\u6362\u6210\u65B0\u7684\u5E73\u53F0\u573A\u666F\u3001FAQ \u89D2\u5EA6\u6216\u6848\u4F8B\u8BC1\u636E\u5C55\u5F00\u3002" : "\u5F53\u524D\u6587\u7AE0\u548C\u5386\u53F2\u5185\u5BB9\u5DEE\u5F02\u8F83\u6E05\u695A\uFF0C\u53EF\u7EE7\u7EED\u8865\u5F3A\u4F01\u4E1A\u8D44\u6599\u6765\u6E90\u548C AI \u53EF\u5F15\u7528\u7247\u6BB5\u3002";
  const rewriteSuggestion = similarityRisk === "high" ? "\u5EFA\u8BAE\u91CD\u5199\u6807\u9898\u3001\u6458\u8981\u3001FAQ \u548C\u6838\u5FC3\u89C2\u70B9\uFF0C\u5E76\u51CF\u5C11\u4E0E\u76F8\u4F3C\u6587\u7AE0\u91CD\u590D\u7684\u6BB5\u843D\u7ED3\u6784\u3002" : similarityRisk === "medium" ? "\u5EFA\u8BAE\u8C03\u6574\u6807\u9898\u5173\u952E\u8BCD\u3001\u589E\u52A0\u5DEE\u5F02\u5316\u5C0F\u6807\u9898\uFF0C\u5E76\u8865\u5145\u65B0\u7684\u4EA7\u54C1/\u670D\u52A1/\u6848\u4F8B/\u5BF9\u6BD4\u4FE1\u606F\u3002" : "\u5EFA\u8BAE\u8FDB\u5165\u4EBA\u5DE5\u590D\u6838\uFF0C\u786E\u8BA4\u4E8B\u5B9E\u3001\u6848\u4F8B\u3001\u5E73\u53F0\u683C\u5F0F\u548C\u54C1\u724C\u5B9E\u4F53\u4FE1\u606F\u3002";
  return {
    similarityRisk,
    similarArticleTitles: similarArticles.map((item) => item.title),
    titleRepeated,
    topicRepeated,
    structureRepeated,
    viewpointRepeated,
    sameTaskRepeated,
    sameWeekRepeated,
    differentiationAngle,
    rewriteSuggestion,
    blocked: similarityRisk === "high"
  };
}
function isGeoArticleQualityCheckPass(quality) {
  return !quality.blocked && quality.totalScore >= GEO_ARTICLE_MIN_PASS_SCORE;
}
async function rewriteGeoArticleMarkdownForQuality(input) {
  const { projectName, articleTitle, markdownContent, quality, antiDup } = input;
  const userPayload = [
    `\u4F01\u4E1A/\u9879\u76EE\uFF1A${projectName}`,
    `\u6587\u7AE0\u6807\u9898\uFF1A${articleTitle}`,
    `\u5F53\u524D\u6B63\u6587\uFF08Markdown\uFF09\uFF1A
${markdownContent}`,
    `\u8D28\u68C0\u6458\u8981\uFF1A${quality.reviewSummary}`,
    `\u963B\u65AD\u539F\u56E0\uFF1A${quality.blockReasons.join("\uFF1B") || "\u65E0"}`,
    `\u4F18\u5316\u5EFA\u8BAE\uFF1A${quality.optimizationSuggestions.join("\uFF1B")}`,
    `\u53CD\u540C\u8D28\u5316\uFF1A\u91CD\u590D\u98CE\u9669=${antiDup.similarityRisk}\uFF1B\u76F8\u4F3C\u5386\u53F2\u6807\u9898=${antiDup.similarArticleTitles.join("\u3001") || "\u65E0"}\uFF1B\u5DEE\u5F02\u5316\u89D2\u5EA6=${antiDup.differentiationAngle}\uFF1B\u6539\u5199\u5EFA\u8BAE=${antiDup.rewriteSuggestion}`,
    "\u8BF7\u5168\u6587\u91CD\u5199 Markdown \u6B63\u6587\uFF1A\u6362\u65B0\u7684\u5207\u5165\u89D2\u5EA6\u4E0E\u5C0F\u6807\u9898\u8109\u7EDC\uFF0C\u51CF\u5C11\u4E0E\u5386\u53F2\u6587\u7AE0\u91CD\u590D\u7684\u6BB5\u843D\u7ED3\u6784\uFF1B\u4FDD\u7559\u6838\u5FC3\u4E8B\u5B9E\u4E0E\u5408\u89C4\u8981\u6C42\uFF08\u4E0D\u865A\u6784\u6848\u4F8B\u3001\u4E0D\u4F5C\u6392\u540D\u4FDD\u8BC1\u3001\u4E0D\u653B\u51FB\u7ADE\u54C1\uFF09\uFF0C\u4F46\u6362\u7528\u4E0D\u540C\u8868\u8FBE\u65B9\u5F0F\uFF1B\u5168\u6587\u4ECD\u987B\u4E3A\u7B2C\u4E09\u65B9\u884C\u4E1A/\u7528\u6237\u89C6\u89D2\uFF0C\u7981\u6B62\u300CXX\u516C\u53F8\u5982\u4F55\u56DE\u7B54\u300D\u300CXX\u516C\u53F8\u9762\u5411\u2026\u300D\u7B49\u4F01\u4E1A\u81EA\u8FF0\u53E5\u5F0F\uFF1B\u4FDD\u7559 GEO \u5E38\u7528\u4E8C\u7EA7\u6807\u9898\u7ED3\u6784\uFF08\u5982\u5F15\u8A00\u3001\u6838\u5FC3\u95EE\u9898\u3001\u5BF9\u6BD4\u3001FAQ\u3001\u7ED3\u8BBA\u7B49\uFF09\uFF0C\u4E0D\u8981\u8F93\u51FA\u9664 JSON \u5916\u7684\u5176\u4ED6\u6587\u5B57\u3002"
  ].join("\n\n");
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "\u4F60\u662F\u8D44\u6DF1\u884C\u4E1A\u5185\u5BB9\u7F16\u8F91\uFF0C\u64C5\u957F GEO \u573A\u666F\u4E0B\u53BB\u91CD\u4E0E\u6362\u89D2\u5EA6\u91CD\u5199\u3002\u91CD\u5199\u540E\u987B\u4FDD\u6301\u7B2C\u4E09\u65B9\u89C2\u5BDF\u6216\u9009\u8D2D\u53C2\u8003\u89C6\u89D2\uFF0C\u7981\u6B62\u300CXX\u516C\u53F8\u5982\u4F55\u56DE\u7B54\u300D\u300CXX\u516C\u53F8\u9762\u5411\u2026\u300D\u7B49\u4F01\u4E1A\u81EA\u8FF0\u53E5\u5F0F\uFF1B\u53EA\u8F93\u51FA\u7B26\u5408 JSON Schema \u7684\u5355\u4E2A JSON \u5BF9\u8C61\u3002"
      },
      { role: "user", content: userPayload }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "geo_article_rewrite",
        strict: true,
        schema: {
          type: "object",
          properties: {
            markdownContent: { type: "string" }
          },
          required: ["markdownContent"],
          additionalProperties: false
        }
      }
    }
  });
  const raw = response.choices[0]?.message.content;
  const parsed = parseLlmJsonObject(raw);
  const next = typeof parsed.markdownContent === "string" ? parsed.markdownContent.trim() : "";
  if (!next) throw new Error("AI \u672A\u8FD4\u56DE\u6709\u6548\u6B63\u6587");
  return next;
}
var GEO_TARGET_QUESTIONS_SYSTEM_PROMPT = `\u4F60\u662F\u4E00\u4F4D\u6DF1\u5EA6\u7406\u89E3\u77E5\u8BC6\u4ED8\u8D39\u4E0E\u5185\u5BB9\u521B\u4E1A\u5BA2\u6237\u7684\u5185\u5BB9\u7B56\u7565\u4E13\u5BB6\u3002
\u4F60\u7684\u4EFB\u52A1\u662F\u751F\u6210\u300C\u76EE\u6807\u5BA2\u6237\u5728\u9047\u5230\u771F\u5B9E\u7ECF\u8425\u95EE\u9898\u65F6\uFF0C\u4F1A\u5728AI\u5DE5\u5177\u4E2D\u641C\u7D22\u7684\u95EE\u9898\u300D\u3002

\u751F\u6210\u89C4\u5219\uFF1A
1. \u95EE\u9898\u5FC5\u987B\u662F\u5BA2\u6237\u89C6\u89D2\uFF0C\u4ECE\u5BA2\u6237\u7684\u75DB\u70B9\u3001\u56F0\u60D1\u3001\u9700\u6C42\u51FA\u53D1\uFF0C\u4E0D\u662F\u54C1\u724C\u89C6\u89D2
2. \u95EE\u9898\u5FC5\u987B\u5E26\u6709\u5177\u4F53\u573A\u666F\uFF0C\u4F8B\u5982\u300C\u76F4\u64AD\u95F4\u6BCF\u5929\u6709500\u4EBA\u8FDB\u6765\uFF0C\u4F46\u4E0B\u5355\u7684\u4E0D\u52305\u4E2A\uFF0C\u95EE\u9898\u51FA\u5728\u54EA\uFF1F\u300D
3. \u7981\u6B62\u751F\u6210\u300CXX\u54C1\u724C vs XX\u54C1\u724C\u54EA\u4E2A\u597D\u300D\u8FD9\u7C7B\u7ADE\u54C1\u5BF9\u6BD4\u95EE\u9898
4. \u7981\u6B62\u751F\u6210\u300CXX\u5E73\u53F0\u600E\u4E48\u6837\u300D\u8FD9\u7C7B\u5E73\u53F0\u8BC4\u6D4B\u95EE\u9898
5. \u95EE\u9898\u8986\u76D6\u4EE5\u4E0B\u4E09\u4E2A\u7EF4\u5EA6\uFF0C\u6BCF\u4E2A\u7EF4\u5EA6\u81F3\u5C112\u6761\uFF1A
   - \u75DB\u70B9\u8BCA\u65AD\uFF1A\u5BA2\u6237\u6709\u5177\u4F53\u7ECF\u8425\u95EE\u9898\uFF0C\u60F3\u627E\u5230\u6839\u56E0\uFF08\u5982\u300C\u76F4\u64AD\u8F6C\u5316\u7387\u4F4E\u300D\u300C\u9000\u6B3E\u591A\u300D\u300C\u79C1\u57DF\u6CA1\u590D\u8D2D\u300D\uFF09
   - \u8DEF\u5F84\u63A2\u7D22\uFF1A\u5BA2\u6237\u60F3\u77E5\u9053\u600E\u4E48\u505A\u67D0\u4EF6\u4E8B\uFF08\u5982\u300C\u600E\u4E48\u4ECE0\u5F00\u59CB\u5356\u8BFE\u300D\u300C\u5982\u4F55\u642D\u5EFA\u79C1\u57DF\u6210\u4EA4\u4F53\u7CFB\u300D\uFF09
   - \u5DE5\u5177\u9009\u62E9\uFF1A\u5BA2\u6237\u5728\u7279\u5B9A\u573A\u666F\u4E0B\u60F3\u627E\u5408\u9002\u7684\u89E3\u51B3\u65B9\u6848\uFF08\u5982\u300C\u6709\u4EC0\u4E48\u5DE5\u5177\u80FD\u5E2E\u6211\u5206\u6790\u76F4\u64AD\u6570\u636E\u300D\uFF09
6. \u751F\u62108-10\u6761\uFF0C\u4E0D\u591A\u4E0D\u5C11
7. \u52A3\u52BF\u9898\uFF1A\u4FDD\u75592-3\u6761\u300C\u5BA2\u6237\u95EE\u9898\u573A\u666F\u4E0B\uFF0C\u8BE5\u4F01\u4E1A\u76EE\u524D\u5185\u5BB9\u8986\u76D6\u4E0D\u8DB3\u300D\u7684\u95EE\u9898\uFF0C\u7528\u4E8E\u66B4\u9732\u771F\u5B9E\u7F3A\u53E3

\u53EA\u8F93\u51FA\u7B26\u5408 JSON Schema \u7684\u5355\u4E2A JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u8F93\u51FA\u5176\u5B83\u6587\u5B57\u3002`;
async function generateTargetQuestions(input) {
  const userContent = [
    "\u4F01\u4E1A\u4FE1\u606F\uFF1A",
    `- \u54C1\u724C\u540D\u79F0\uFF1A${input.brandName}`,
    `- \u884C\u4E1A\u5B9A\u4F4D\uFF1A${input.industryTag}`,
    `- \u6838\u5FC3\u4EA7\u54C1\uFF1A${input.productDesc}`,
    `- \u76EE\u6807\u5BA2\u6237\uFF1A${input.targetCustomer}`,
    `- \u5BA2\u6237\u6838\u5FC3\u75DB\u70B9\uFF1A${input.customerPains}`,
    `- \u6838\u5FC3\u5356\u70B9\uFF1A${input.keyPoints}`,
    "",
    "\u8BF7\u751F\u62108-10\u6761\u76EE\u6807\u5BA2\u6237\u771F\u5B9E\u641C\u7D22\u95EE\u9898\uFF1A",
    "1. \u6BCF\u6761\u95EE\u9898\u63A7\u5236\u572825\u5B57\u4EE5\u5185",
    "2. \u95EE\u9898\u5FC5\u987B\u662F\u5BA2\u6237\u81EA\u5DF1\u4F1A\u8BF4\u7684\u8BDD\uFF0C\u4E0D\u80FD\u51FA\u73B0\u54C1\u724C\u540D",
    "3. \u5FC5\u987B\u67092-3\u6761\u5BA2\u6237\u75DB\u70B9\u8BCA\u65AD\u7C7B\u95EE\u9898\uFF08disadvantaged: true\uFF09",
    "4. \u7981\u6B62\u51FA\u73B0\u7ADE\u54C1\u540D\u79F0",
    "5. \u8FD4\u56DEJSON\u6570\u7EC4\uFF0C\u6BCF\u4E2A\u5BF9\u8C61\u5305\u542B\uFF1Aquestion\u3001intent\uFF08\u7528\u6237\u610F\u56FE\uFF0C\u4ECE\u300C\u75DB\u70B9\u8BCA\u65AD/\u8DEF\u5F84\u63A2\u7D22/\u5DE5\u5177\u9009\u62E9\u300D\u4E09\u9009\u4E00\uFF09\u3001disadvantaged\uFF08\u5E03\u5C14\u503C\uFF09",
    "",
    "\u5C06\u4E0A\u8FF0\u6570\u7EC4\u653E\u5728\u6839\u5BF9\u8C61\u7684 `questions` \u5B57\u6BB5\u4E2D\u8F93\u51FA\uFF08\u4EC5\u6B64\u4E00\u4E2A\u6839\u5BF9\u8C61\uFF09\u3002"
  ].join("\n");
  const response = await invokeLLM({
    max_tokens: 4096,
    timeout_ms: 12e4,
    messages: [
      { role: "system", content: GEO_TARGET_QUESTIONS_SYSTEM_PROMPT },
      { role: "user", content: userContent }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "geo_target_customer_questions_v12",
        strict: true,
        schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              minItems: 8,
              maxItems: 10,
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  intent: { type: "string", enum: ["\u75DB\u70B9\u8BCA\u65AD", "\u8DEF\u5F84\u63A2\u7D22", "\u5DE5\u5177\u9009\u62E9"] },
                  disadvantaged: { type: "boolean" }
                },
                required: ["question", "intent", "disadvantaged"],
                additionalProperties: false
              }
            }
          },
          required: ["questions"],
          additionalProperties: false
        }
      }
    }
  });
  const raw = response.choices[0]?.message.content;
  const parsed = parseLlmJsonObject(raw);
  const list = Array.isArray(parsed.questions) ? parsed.questions : [];
  const rows = [];
  const seen = /* @__PURE__ */ new Set();
  const allowedIntent = /* @__PURE__ */ new Set(["\u75DB\u70B9\u8BCA\u65AD", "\u8DEF\u5F84\u63A2\u7D22", "\u5DE5\u5177\u9009\u62E9"]);
  for (const item of list) {
    const questionText = typeof item.question === "string" ? item.question.trim() : "";
    const intentRaw = typeof item.intent === "string" ? item.intent.trim() : "";
    const intent = allowedIntent.has(intentRaw) ? intentRaw : "";
    const disadvantaged = item.disadvantaged === true;
    if (!questionText || questionText.length > 25) continue;
    if (!intent) continue;
    if (seen.has(questionText)) continue;
    seen.add(questionText);
    rows.push({ questionText, questionType: "\u6307\u5B9A\u95EE\u9898", intent, disadvantaged });
  }
  if (rows.length < 8) throw new Error("AI \u8FD4\u56DE\u7684\u6709\u6548\u95EE\u9898\u4E0D\u8DB3 8 \u6761\uFF0C\u8BF7\u91CD\u8BD5");
  const disadvantagedCount = rows.filter((r) => r.disadvantaged).length;
  if (disadvantagedCount < 2) throw new Error("AI \u8FD4\u56DE\u7684\u52A3\u52BF\u573A\u666F\u95EE\u9898\u4E0D\u8DB3 2 \u6761\uFF0C\u8BF7\u91CD\u8BD5");
  return rows.slice(0, 10);
}

// server/geoArticleQualityCheckFlow.ts
import { TRPCError as TRPCError4 } from "@trpc/server";
import { desc as desc2, eq as eq3 } from "drizzle-orm";
var MAX_AUTO_QUALITY_REWRITES = 2;
async function getProjectOrThrow(db, projectId) {
  const result = await db.select().from(projects).where(eq3(projects.id, projectId)).limit(1);
  if (result.length === 0) throw new TRPCError4({ code: "NOT_FOUND", message: "\u9879\u76EE\u4E0D\u5B58\u5728" });
  return result[0];
}
async function getAssetLibraryContext(db, projectId) {
  const [profiles, assetSources, cases, competitors, styles] = await Promise.all([
    db.select().from(enterpriseGeoProfiles).where(eq3(enterpriseGeoProfiles.projectId, projectId)).orderBy(desc2(enterpriseGeoProfiles.updatedAt)).limit(1),
    db.select().from(geoAssetSources).where(eq3(geoAssetSources.projectId, projectId)).orderBy(desc2(geoAssetSources.updatedAt)),
    db.select().from(customerCases).where(eq3(customerCases.projectId, projectId)).orderBy(desc2(customerCases.updatedAt)),
    db.select().from(competitorProfiles).where(eq3(competitorProfiles.projectId, projectId)).orderBy(desc2(competitorProfiles.updatedAt)),
    db.select().from(contentStyleProfiles).where(eq3(contentStyleProfiles.projectId, projectId)).orderBy(desc2(contentStyleProfiles.updatedAt))
  ]);
  return withResolvedEnterpriseProfile({
    profile: profiles[0] ?? null,
    assetSources,
    customerCases: cases,
    competitorProfiles: competitors,
    complianceRules: [],
    contentStyleProfiles: styles,
    publishStrategies: []
  });
}
async function runGeoArticleQualityCheckFlow(db, articleId) {
  const articleRows = await db.select().from(geoArticles).where(eq3(geoArticles.id, articleId)).limit(1);
  const article = articleRows[0];
  if (!article) throw new TRPCError4({ code: "NOT_FOUND", message: "\u6587\u7AE0\u4E0D\u5B58\u5728" });
  const project = await getProjectOrThrow(db, article.projectId);
  const projectQuestions = await db.select().from(questions).where(eq3(questions.projectId, article.projectId));
  const analyses = await db.select().from(analysisResults).where(eq3(analysisResults.projectId, article.projectId));
  const responses = await db.select().from(aiResponses).where(eq3(aiResponses.projectId, article.projectId));
  const taskRows = article.optimizationTaskId ? await db.select().from(optimizationTasks).where(eq3(optimizationTasks.id, article.optimizationTaskId)).limit(1) : [];
  const analysesWithQuestions = attachQuestionTextToAnalyses(resolveEffectiveAnalysisResults(analyses), responses, projectQuestions);
  const assetLibrary = await getAssetLibraryContext(db, article.projectId);
  const peerRows = await db.select({
    id: geoArticles.id,
    title: geoArticles.title,
    markdownContent: geoArticles.markdownContent,
    topicId: geoArticles.topicId,
    optimizationTaskId: geoArticles.optimizationTaskId,
    articleType: geoArticles.articleType
  }).from(geoArticles).where(eq3(geoArticles.projectId, article.projectId));
  const topicMetaRows = await db.select({ id: geoArticleTopics.id, optimizationTaskId: geoArticleTopics.optimizationTaskId }).from(geoArticleTopics).where(eq3(geoArticleTopics.id, article.topicId)).limit(1);
  const latestPlanRows = await db.select({ linkedOptimizationTaskIds: contentPlans.linkedOptimizationTaskIds, weeklyArticleCount: contentPlans.weeklyArticleCount }).from(contentPlans).where(eq3(contentPlans.projectId, article.projectId)).orderBy(desc2(contentPlans.updatedAt)).limit(1);
  const planForAntiDup = {
    taskIds: latestPlanRows[0]?.linkedOptimizationTaskIds ?? [],
    weeklyCount: latestPlanRows[0]?.weeklyArticleCount ?? 3
  };
  const peers = peerRows.filter((row) => row.id !== article.id);
  let markdownContent = article.markdownContent;
  const articleLike = article;
  const scoreOne = () => scoreGeoArticleQuality({
    article: { ...articleLike, markdownContent },
    project,
    questions: projectQuestions,
    analyses: analysesWithQuestions,
    task: taskRows[0] ?? null,
    assetLibrary
  });
  let quality = scoreOne();
  let antiDupArticle = {
    id: article.id,
    title: article.title,
    markdownContent,
    topicId: article.topicId,
    optimizationTaskId: article.optimizationTaskId,
    articleType: article.articleType
  };
  let antiDup = assessGeoArticleAntiDuplication({
    article: antiDupArticle,
    peers,
    topic: topicMetaRows[0] ?? null,
    plan: planForAntiDup
  });
  const existingVersions = Array.isArray(article.optimizationVersions) ? article.optimizationVersions : [];
  const optimizationVersions = [...existingVersions];
  const persistScore = async () => {
    await db.insert(geoArticleQualityScores).values({
      projectId: article.projectId,
      articleId: article.id,
      problemMatchScore: quality.problemMatchScore,
      evidenceScore: quality.evidenceScore,
      structureScore: quality.structureScore,
      originalityScore: quality.originalityScore,
      geoCitableScore: quality.geoCitableScore,
      complianceScore: quality.complianceScore,
      totalScore: quality.totalScore,
      blocked: quality.blocked ? 1 : 0,
      blockReasons: quality.blockReasons,
      reviewSummary: quality.reviewSummary
    });
  };
  const syncArticleFields = async (status) => {
    await db.update(geoArticles).set({
      ...status ? { status } : {},
      markdownContent,
      optimizationVersions,
      factTraceability: quality.factTraceability,
      consistencyCheck: quality.consistencyCheck
    }).where(eq3(geoArticles.id, article.id));
  };
  await persistScore();
  await db.update(geoArticles).set({
    factTraceability: quality.factTraceability,
    consistencyCheck: quality.consistencyCheck
  }).where(eq3(geoArticles.id, article.id));
  if (isGeoArticleQualityCheckPass(quality)) {
    await syncArticleFields("\u8D28\u68C0\u901A\u8FC7");
    return { success: true, quality, autoRewriteCount: 0, finalStatus: "\u8D28\u68C0\u901A\u8FC7" };
  }
  let used = 0;
  while (!isGeoArticleQualityCheckPass(quality) && used < MAX_AUTO_QUALITY_REWRITES) {
    const markdownBeforeRewrite = markdownContent;
    try {
      markdownContent = await rewriteGeoArticleMarkdownForQuality({
        projectName: project.enterpriseName,
        articleTitle: article.title,
        markdownContent,
        quality,
        antiDup
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "\u81EA\u52A8\u6362\u89D2\u91CD\u5199\u5931\u8D25";
      throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message });
    }
    optimizationVersions.push({
      version: optimizationVersions.length + 1,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      mode: "GEO \u8D28\u68C0\u81EA\u52A8\u91CD\u5199",
      previousStatus: article.status,
      previousScore: quality.totalScore,
      title: article.title,
      markdownContent: markdownBeforeRewrite,
      consistencyScore: quality.consistencyCheck?.score,
      reason: `\u8D28\u68C0\u672A\u901A\u8FC7\u540E\u7CFB\u7EDF\u81EA\u52A8\u6362\u89D2\u91CD\u5199\uFF0C\u4F9D\u636E\uFF1A${(quality.blockReasons.length ? quality.blockReasons : quality.optimizationSuggestions).slice(0, 5).join("\uFF1B")}`
    });
    used += 1;
    quality = scoreOne();
    antiDupArticle = { ...antiDupArticle, markdownContent };
    antiDup = assessGeoArticleAntiDuplication({
      article: antiDupArticle,
      peers,
      topic: topicMetaRows[0] ?? null,
      plan: planForAntiDup
    });
    await persistScore();
    await db.update(geoArticles).set({
      markdownContent,
      optimizationVersions,
      factTraceability: quality.factTraceability,
      consistencyCheck: quality.consistencyCheck
    }).where(eq3(geoArticles.id, article.id));
  }
  if (isGeoArticleQualityCheckPass(quality)) {
    await syncArticleFields("\u8D28\u68C0\u901A\u8FC7");
    return { success: true, quality, autoRewriteCount: used, finalStatus: "\u8D28\u68C0\u901A\u8FC7" };
  }
  await syncArticleFields("\u9700\u4EBA\u5DE5\u5BA1\u6838");
  return { success: false, quality, autoRewriteCount: used, finalStatus: "\u9700\u4EBA\u5DE5\u5BA1\u6838" };
}

// server/storage.ts
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}

// server/geoMonitoring.ts
var initialMonitoringSuggestions = [
  "\u7B49\u5F85\u641C\u7D22\u5F15\u64CE\u6293\u53D6\u540E\u6267\u884C\u9996\u6B21\u4EBA\u5DE5\u6536\u5F55\u68C0\u6D4B\u3002",
  "\u7528\u539F\u59CB\u5BA2\u6237\u95EE\u9898\u590D\u6D4B AI \u662F\u5426\u63D0\u53CA\u54C1\u724C\u3002",
  "\u82E5\u672A\u6536\u5F55\uFF0C\u4F18\u5148\u589E\u5F3A\u6807\u9898\u3001\u6458\u8981\u3001FAQ \u548C\u5185\u90E8\u5165\u53E3\u3002",
  "\u82E5 AI \u672A\u63D0\u53CA\uFF0C\u8865\u5145\u4F01\u4E1A\u5B9E\u4F53\u4FE1\u606F\u3001\u7ADE\u54C1\u5DEE\u5F02\u548C AI \u53EF\u5F15\u7528\u7247\u6BB5\u3002"
];
function buildInitialInclusionMonitoringRecord(input) {
  return {
    projectId: input.projectId,
    articleId: input.articleId,
    publishRecordId: input.publishRecordId,
    publicUrl: input.publicUrl,
    inclusionStatus: "\u672A\u68C0\u6D4B",
    aiMentionStatus: "\u672A\u68C0\u6D4B",
    aiRecommendStatus: "\u672A\u68C0\u6D4B",
    currentSuggestion: "\u5DF2\u53D1\u5E03\u6587\u7AE0\u5DF2\u8FDB\u5165\u6536\u5F55\u76D1\u6D4B\uFF0C\u5F53\u524D\u72B6\u6001\u4E3A\u672A\u68C0\u6D4B\uFF1B\u4E0B\u4E00\u6B65\u9700\u8981\u4EBA\u5DE5\u6216\u540E\u7EED\u590D\u6D4B\u6D41\u7A0B\u786E\u8BA4\u6536\u5F55\u3001AI \u63D0\u53CA\u548C AI \u63A8\u8350\u60C5\u51B5\u3002",
    optimizationSuggestions: initialMonitoringSuggestions,
    rawJson: {
      source: "publish_geo_content_page",
      qualityScore: input.qualityScore,
      needRetest: true,
      createdBy: "geo.articles.publish"
    }
  };
}

// server/assetLibrary.ts
var assetSourceTypes = [
  "\u4F01\u4E1A\u57FA\u7840\u8D44\u6599",
  "\u4EA7\u54C1\u670D\u52A1\u8D44\u6599",
  "\u5BA2\u6237\u6848\u4F8B\u8D44\u6599",
  "\u7ADE\u54C1\u8D44\u6599",
  "\u5408\u89C4\u8D44\u6599",
  "\u5185\u5BB9\u98CE\u683C\u8D44\u6599",
  "\u53D1\u5E03\u7B56\u7565\u8D44\u6599",
  "\u901A\u7528\u8D44\u6599"
];
var assetInputModes = ["\u6587\u4EF6\u4E0A\u4F20", "\u6587\u672C\u7C98\u8D34", "\u4EBA\u5DE5\u5F55\u5165"];
var assetTrustLevels = ["\u9AD8", "\u4E2D", "\u4F4E"];
var customerCaseTypes = ["\u771F\u5B9E\u6848\u4F8B", "\u5F85\u8865\u5145\u6848\u4F8B\u7EBF\u7D22"];
var caseVerificationStatuses = ["\u5F85\u786E\u8BA4", "\u5DF2\u786E\u8BA4", "\u4E0D\u53EF\u516C\u5F00", "\u4FE1\u606F\u4E0D\u8DB3"];
var publishReviewModes = ["\u5168\u4EBA\u5DE5\u5BA1\u6838", "\u9AD8\u5206\u81EA\u52A8\u53D1\u5E03", "\u5168\u81EA\u52A8\u53D1\u5E03"];
var platformAuthorizationStatuses = ["\u672A\u914D\u7F6E", "\u5F85\u4EBA\u5DE5\u6388\u6743", "\u5DF2\u6388\u6743", "\u5DF2\u5931\u6548", "\u65E0\u9700\u6388\u6743"];
function splitLines(value) {
  if (!value) return [];
  return value.split(/\n|,|，|；|;/).map((item) => item.trim()).filter(Boolean);
}
function summarizeTextToStructuredSummary(text2, fallbackTitle) {
  const normalized = (text2 ?? "").trim();
  return {
    title: fallbackTitle,
    digest: normalized.slice(0, 500),
    keywords: splitLines(normalized.slice(0, 240)).slice(0, 8),
    sourceLength: normalized.length,
    generatedFrom: normalized ? "\u5BA2\u6237\u7C98\u8D34\u6216\u4E0A\u4F20\u8D44\u6599\u6458\u8981" : "\u4EBA\u5DE5\u5F55\u5165\u5360\u4F4D\u6458\u8981"
  };
}
function calculateProfileCompletionScore(profile) {
  if (!profile) return 0;
  const requiredFields = [
    "enterpriseName",
    "shortName",
    "officialWebsite",
    "industry",
    "region",
    "productServiceIntro",
    "targetCustomers",
    "coreSellingPoints",
    "servicePriceRange",
    "serviceModel",
    "fitCustomers",
    "unfitCustomers",
    "salesChannels",
    "commonQuestions",
    "purchaseDecisionFactors",
    "productIntro",
    "featureNotes",
    "serviceProcess",
    "deliveryPlan",
    "afterSalesService",
    "competitorDifference",
    "priceExplanation",
    "salesTalkTracks",
    "commonObjections"
  ];
  const filled = requiredFields.filter((field) => {
    const value = profile[field];
    if (Array.isArray(value)) return value.length > 0;
    if (value === null || value === void 0) return false;
    return String(value).trim().length > 0;
  }).length;
  return Math.round(filled / requiredFields.length * 100);
}
function validateCustomerCaseInput(input) {
  const sourceAssetIds = input.sourceAssetIds ?? [];
  if (input.caseType === "\u771F\u5B9E\u6848\u4F8B" && !input.customerName?.trim()) {
    throw new Error("\u771F\u5B9E\u5BA2\u6237\u6848\u4F8B\u5FC5\u987B\u586B\u5199\u5BA2\u6237\u540D\u79F0\u6216\u53EF\u516C\u5F00\u5BA2\u6237\u4EE3\u79F0");
  }
  return {
    ...input,
    sourceAssetIds
  };
}
function assertAssetCanBeUsedForGeneration(asset) {
  if (!asset.canUseForGeneration) {
    throw new Error(`\u8D44\u6599\u300C${asset.title}\u300D\u672A\u5141\u8BB8\u7528\u4E8E\u5185\u5BB9\u751F\u6210`);
  }
  if (!asset.manuallyConfirmed) {
    throw new Error(`\u8D44\u6599\u300C${asset.title}\u300D\u5C1A\u672A\u4EBA\u5DE5\u786E\u8BA4\uFF0C\u4E0D\u80FD\u8FDB\u5165\u751F\u6210\u4F9D\u636E`);
  }
  if (!asset.structuredSummary || Object.keys(asset.structuredSummary).length === 0) {
    throw new Error(`\u8D44\u6599\u300C${asset.title}\u300D\u7F3A\u5C11\u7ED3\u6784\u5316\u6458\u8981\uFF0C\u4E0D\u80FD\u8FDB\u5165\u751F\u6210\u4F9D\u636E`);
  }
}
function buildAssetEvidencePack(assets) {
  return assets.map((asset) => {
    assertAssetCanBeUsedForGeneration(asset);
    return {
      assetId: asset.id,
      title: asset.title,
      sourceType: asset.sourceType,
      trustLevel: asset.trustLevel,
      summary: asset.structuredSummary,
      digest: asset.contentDigest ?? ""
    };
  });
}
function createUploadAssetDbRecord(input) {
  return {
    projectId: input.projectId,
    sourceType: input.sourceType,
    inputMode: "\u6587\u4EF6\u4E0A\u4F20",
    title: input.title,
    originalFileName: input.originalFileName ?? null,
    fileKey: input.fileKey ?? null,
    fileUrl: input.fileUrl ?? null,
    mimeType: input.mimeType ?? null,
    contentDigest: input.contentDigest ?? null,
    structuredSummary: input.structuredSummary ?? summarizeTextToStructuredSummary(input.contentDigest, input.title),
    trustLevel: input.trustLevel,
    parseStatus: "\u4EBA\u5DE5\u786E\u8BA4",
    isPublic: input.isPublic ? 1 : 0,
    canUseForGeneration: input.canUseForGeneration ? 1 : 0,
    manuallyConfirmed: input.manuallyConfirmed ? 1 : 0,
    parsedAt: /* @__PURE__ */ new Date()
  };
}

// server/routers.ts
var GEO_SYNTHETIC_AI_RESPONSE_PREFIX = "\u3010\u7CFB\u7EDF\u81EA\u52A8\u3011";
var projectInput = z3.object({
  enterpriseName: z3.string().min(1, "\u8BF7\u8F93\u5165\u4F01\u4E1A\u540D\u79F0"),
  industry: z3.string().min(1, "\u8BF7\u8F93\u5165\u884C\u4E1A"),
  website: z3.string().min(1, "\u8BF7\u8F93\u5165\u5B98\u7F51"),
  region: z3.string().min(1, "\u8BF7\u8F93\u5165\u5730\u533A"),
  productIntro: z3.string().min(1, "\u8BF7\u8F93\u5165\u4EA7\u54C1\u4ECB\u7ECD"),
  targetCustomers: z3.string().min(1, "\u8BF7\u8F93\u5165\u76EE\u6807\u5BA2\u6237"),
  coreSellingPoints: z3.string().min(1, "\u8BF7\u8F93\u5165\u6838\u5FC3\u5356\u70B9"),
  competitorNames: z3.array(z3.string()).default([]),
  coreKeywords: z3.array(z3.string()).default([])
});
var questionInput = z3.object({
  projectId: z3.number().int().positive(),
  questionText: z3.string().min(1, "\u8BF7\u8F93\u5165\u95EE\u9898"),
  questionType: z3.enum(questionTypes),
  targetKeyword: z3.string().optional().nullable(),
  intentLevel: z3.string().optional().default("\u9AD8"),
  businessValue: z3.number().int().min(1).max(5).optional().default(5),
  source: z3.enum(questionSources).optional().default("manual"),
  enabled: z3.boolean().default(true)
});
var manualQuestionImportRow = z3.object({
  questionText: z3.string().min(1, "\u8BF7\u8F93\u5165\u95EE\u9898"),
  questionType: z3.enum(questionTypes).optional().default("\u6307\u5B9A\u95EE\u9898"),
  targetKeyword: z3.string().optional().nullable(),
  intentLevel: z3.string().optional().default("\u9AD8"),
  businessValue: z3.number().int().min(1).max(5).optional().default(5)
});
var aiResponseInput = z3.object({
  projectId: z3.number().int().positive(),
  questionId: z3.number().int().positive().optional().nullable(),
  questionText: z3.string().min(1, "\u8BF7\u8F93\u5165\u95EE\u9898"),
  aiPlatform: z3.enum(aiPlatforms),
  rawAnswer: z3.string().min(1, "\u8BF7\u8F93\u5165 AI \u539F\u59CB\u56DE\u7B54"),
  checkedAt: z3.string().min(1, "\u8BF7\u8F93\u5165\u68C0\u6D4B\u65F6\u95F4")
});
var contentPlanInput = z3.object({
  id: z3.number().int().positive().optional(),
  projectId: z3.number().int().positive(),
  planName: z3.string().min(1, "\u8BF7\u8F93\u5165\u8BA1\u5212\u540D\u79F0"),
  weekStartDate: z3.string().min(1, "\u8BF7\u9009\u62E9\u5468\u671F\u5F00\u59CB\u65E5\u671F"),
  weeklyArticleCount: z3.number().int().min(1).max(20),
  targetPlatforms: z3.array(z3.string().min(1)).min(1, "\u8BF7\u9009\u62E9\u76EE\u6807\u53D1\u5E03\u5E73\u53F0"),
  contentTypes: z3.array(z3.string().min(1)).min(1, "\u8BF7\u9009\u62E9\u5185\u5BB9\u7C7B\u578B"),
  linkedOptimizationTaskIds: z3.array(z3.number().int().positive()).min(1, "\u8BF7\u9009\u62E9\u8981\u7ED1\u5B9A\u7684\u4F18\u5316\u4EFB\u52A1"),
  status: z3.string().optional().default("\u5DF2\u914D\u7F6E")
});
var contentPlanItemInput = z3.object({
  projectId: z3.number().int().positive(),
  planId: z3.number().int().positive(),
  topicId: z3.number().int().positive().optional().nullable(),
  articleId: z3.number().int().positive().optional().nullable(),
  targetPlatform: z3.string().min(1, "\u8BF7\u9009\u62E9\u76EE\u6807\u5E73\u53F0"),
  contentType: z3.string().min(1, "\u8BF7\u9009\u62E9\u5185\u5BB9\u7C7B\u578B"),
  status: z3.string().optional().default("\u5F85\u751F\u6210"),
  differentiationAngle: z3.string().optional().nullable(),
  duplicateRisk: z3.string().optional().nullable()
});
var manualPublishPlatforms = [
  "\u81EA\u6709\u5185\u5BB9\u7AD9 / \u4F01\u4E1A\u5B98\u7F51 GEO \u9875\u9762",
  "\u5FAE\u4FE1\u516C\u4F17\u53F7",
  "\u77E5\u4E4E",
  "\u767E\u5BB6\u53F7",
  "\u5934\u6761\u53F7",
  "\u5C0F\u7EA2\u4E66",
  "\u641C\u72D0\u53F7",
  "\u7F51\u6613\u53F7",
  "CSDN / \u6398\u91D1"
];
var manualPublishStatuses = [
  "pending_human_publish",
  "published",
  "publish_failed",
  "manual_publish_needed",
  "link_backfilled"
];
var manualPublishRecordInput = z3.object({
  projectId: z3.number().int().positive(),
  articleId: z3.number().int().positive(),
  publishPlatform: z3.enum(manualPublishPlatforms),
  publishTitle: z3.string().min(1, "\u8BF7\u8F93\u5165\u53D1\u5E03\u6807\u9898"),
  publishUrl: z3.string().optional().default(""),
  publishedAt: z3.string().min(1, "\u8BF7\u9009\u62E9\u53D1\u5E03\u65F6\u95F4"),
  publishStatus: z3.enum(manualPublishStatuses),
  notes: z3.string().optional().default("")
});
var analysisManualReviewInput = z3.object({
  id: z3.number().int().positive(),
  mentionsEnterprise: z3.boolean(),
  recommendsEnterprise: z3.boolean(),
  mentionsCompetitors: z3.boolean(),
  recommendedCompetitors: z3.array(z3.string()).default([]),
  enterpriseWins: z3.boolean(),
  recommendationReason: z3.string().optional().default(""),
  notRecommendedReason: z3.string().optional().default(""),
  hasMisconception: z3.boolean(),
  contentGap: z3.string().optional().default(""),
  optimizationSuggestion: z3.string().optional().default(""),
  confidence: z3.number().min(0).max(100).optional().nullable(),
  reviewNote: z3.string().optional().nullable()
});
var requireDb2 = async () => {
  const db = await getDb();
  if (!db) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "\u6570\u636E\u5E93\u8FDE\u63A5\u4E0D\u53EF\u7528" });
  return db;
};
var resolveForwardProjectStatus = (currentStatus, requestedStatus) => {
  const currentIndex = currentStatus ? projectStatuses.indexOf(currentStatus) : -1;
  const requestedIndex = projectStatuses.indexOf(requestedStatus);
  return requestedIndex >= currentIndex ? requestedStatus : currentStatus ?? requestedStatus;
};
var updateProjectStatus = async (projectId, status) => {
  const db = await requireDb2();
  const current = await db.select({ status: projects.status }).from(projects).where(eq4(projects.id, projectId)).limit(1);
  const nextStatus = resolveForwardProjectStatus(current[0]?.status, status);
  if (nextStatus !== current[0]?.status) {
    await db.update(projects).set({ status: nextStatus }).where(eq4(projects.id, projectId));
  }
};
var getProjectOrThrow2 = async (projectId) => {
  const db = await requireDb2();
  const result = await db.select().from(projects).where(eq4(projects.id, projectId)).limit(1);
  if (result.length === 0) throw new TRPCError5({ code: "NOT_FOUND", message: "\u9879\u76EE\u4E0D\u5B58\u5728" });
  return result[0];
};
var getAssetLibraryContext2 = async (projectId) => {
  const db = await requireDb2();
  const [profiles, assetSources, cases, competitors, styles] = await Promise.all([
    db.select().from(enterpriseGeoProfiles).where(eq4(enterpriseGeoProfiles.projectId, projectId)).orderBy(desc3(enterpriseGeoProfiles.updatedAt)).limit(1),
    db.select().from(geoAssetSources).where(eq4(geoAssetSources.projectId, projectId)).orderBy(desc3(geoAssetSources.updatedAt)),
    db.select().from(customerCases).where(eq4(customerCases.projectId, projectId)).orderBy(desc3(customerCases.updatedAt)),
    db.select().from(competitorProfiles).where(eq4(competitorProfiles.projectId, projectId)).orderBy(desc3(competitorProfiles.updatedAt)),
    db.select().from(contentStyleProfiles).where(eq4(contentStyleProfiles.projectId, projectId)).orderBy(desc3(contentStyleProfiles.updatedAt))
  ]);
  return withResolvedEnterpriseProfile({
    profile: profiles[0] ?? null,
    assetSources,
    customerCases: cases,
    competitorProfiles: competitors,
    complianceRules: [],
    contentStyleProfiles: styles,
    publishStrategies: []
  });
};
var normalizeQuestionText2 = (value) => value.trim();
async function syncManualQuestionsFromAiResponseImport(db, rows) {
  const byProject = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const text2 = normalizeQuestionText2(row.questionText);
    if (!text2) continue;
    const list = byProject.get(row.projectId);
    if (list) list.push(text2);
    else byProject.set(row.projectId, [text2]);
  }
  for (const [projectId, texts] of Array.from(byProject.entries())) {
    const existingRows = await db.select({ questionText: questions.questionText }).from(questions).where(eq4(questions.projectId, projectId));
    const existingSet = new Set(existingRows.map((r) => normalizeQuestionText2(r.questionText)));
    const batchSeen = /* @__PURE__ */ new Set();
    const toInsert = [];
    for (const text2 of texts) {
      if (existingSet.has(text2) || batchSeen.has(text2)) continue;
      batchSeen.add(text2);
      existingSet.add(text2);
      toInsert.push({
        projectId,
        questionText: text2,
        questionType: "\u6307\u5B9A\u95EE\u9898",
        targetKeyword: null,
        intentLevel: "\u9AD8",
        businessValue: 5,
        source: "manual",
        enabled: 1
      });
    }
    if (toInsert.length > 0) {
      await db.insert(questions).values(toInsert);
    }
  }
}
async function insertSpecifiedQuestions(projectId, rows, source) {
  const db = await requireDb2();
  const existing = await db.select().from(questions).where(eq4(questions.projectId, projectId));
  const known = new Map(existing.map((item) => [item.questionText, item]));
  const toInsert = [];
  let skippedDuplicateCount = 0;
  let convertedSpecifiedCount = 0;
  for (const row of rows) {
    const questionText = normalizeQuestionText2(row.questionText);
    if (!questionText) {
      skippedDuplicateCount += 1;
      continue;
    }
    const existingQuestion = known.get(questionText);
    if (existingQuestion) {
      skippedDuplicateCount += 1;
      if (existingQuestion.source === "ai_generated" || existingQuestion.questionType !== "\u6307\u5B9A\u95EE\u9898") {
        await db.update(questions).set({
          questionType: "\u6307\u5B9A\u95EE\u9898",
          source,
          targetKeyword: row.targetKeyword?.trim() || existingQuestion.targetKeyword,
          intentLevel: row.intentLevel?.trim() || existingQuestion.intentLevel || "\u9AD8",
          businessValue: row.businessValue ?? existingQuestion.businessValue ?? 5,
          enabled: 1
        }).where(eq4(questions.id, existingQuestion.id));
        known.set(questionText, {
          ...existingQuestion,
          questionType: "\u6307\u5B9A\u95EE\u9898",
          source,
          targetKeyword: row.targetKeyword?.trim() || existingQuestion.targetKeyword,
          intentLevel: row.intentLevel?.trim() || existingQuestion.intentLevel || "\u9AD8",
          businessValue: row.businessValue ?? existingQuestion.businessValue ?? 5,
          enabled: 1
        });
        convertedSpecifiedCount += 1;
      }
      continue;
    }
    const inserted = {
      projectId,
      questionText,
      questionType: row.questionType ?? "\u6307\u5B9A\u95EE\u9898",
      targetKeyword: row.targetKeyword?.trim() || null,
      intentLevel: row.intentLevel?.trim() || "\u9AD8",
      businessValue: row.businessValue ?? 5,
      enabled: 1,
      source
    };
    known.set(questionText, inserted);
    toInsert.push(inserted);
  }
  if (toInsert.length > 0) {
    await db.insert(questions).values(toInsert);
  }
  await updateProjectStatus(projectId, "questions_ready");
  return {
    success: true,
    addedCount: toInsert.length,
    skippedDuplicateCount,
    convertedSpecifiedCount,
    totalCount: existing.length + toInsert.length
  };
}
function parseLLMJson(content) {
  if (typeof content !== "string") {
    throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "AI \u8FD4\u56DE\u683C\u5F0F\u4E0D\u662F\u6587\u672C JSON" });
  }
  try {
    return JSON.parse(content);
  } catch {
    throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "AI \u8FD4\u56DE JSON \u89E3\u6790\u5931\u8D25" });
  }
}
function parseQuestionGeoMeta(targetKeyword) {
  const raw = typeof targetKeyword === "string" ? targetKeyword.trim() : "";
  if (raw.startsWith("{")) {
    try {
      const j = JSON.parse(raw);
      const intent = typeof j.intent === "string" ? j.intent.trim().slice(0, 32) : "";
      return { intent, disadvantaged: j.disadvantaged === true };
    } catch {
    }
  }
  return { intent: "", disadvantaged: false };
}
function buildEnterpriseInfoBlockForDiagnosis(project, profile) {
  const resolved = resolveEnterpriseProfileForContent(profile ?? null);
  const painFromProfile = profile?.customerPains?.filter((x) => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
  const painStr = painFromProfile?.length ? painFromProfile.join("\uFF1B") : resolved.customerPains.join("\uFF1B") || "\uFF08\u6863\u6848\u672A\u586B\uFF0C\u8BF7\u7ED3\u5408\u884C\u4E1A\u5E38\u8BC6\u63A8\u6F14\uFF09";
  const compArr = profile?.competitors?.filter((x) => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) ?? [];
  const comps = compArr.length > 0 ? compArr.join("\u3001") : project.competitorNames.join("\u3001") || "\uFF08\u672A\u586B\uFF09";
  return [
    `\u4F01\u4E1A\u540D\u79F0\uFF1A${project.enterpriseName}`,
    `\u884C\u4E1A\uFF1A${project.industry}`,
    `\u5B98\u7F51\uFF1A${project.website}`,
    `\u5730\u533A\uFF1A${project.region}`,
    `\u54C1\u724C/\u5B9A\u4F4D\u6458\u8981\uFF1A${resolved.oneLiner || project.coreSellingPoints}`,
    `\u6838\u5FC3\u4EA7\u54C1\uFF1A${resolved.productDesc || project.productIntro}`,
    `\u76EE\u6807\u5BA2\u6237\uFF1A${resolved.targetCustomer || project.targetCustomers}`,
    `\u6838\u5FC3\u5356\u70B9\uFF1A${project.coreSellingPoints}`,
    `\u4E3B\u8981\u7ADE\u54C1\uFF1A${comps}`,
    `\u5BA2\u6237\u6838\u5FC3\u75DB\u70B9\uFF1A${painStr}`,
    `\u6838\u5FC3\u5173\u952E\u8BCD\uFF1A${project.coreKeywords.join("\u3001")}`
  ].join("\n");
}
var nonEmptyString = z3.string().trim().min(1);
var optionalText = z3.string().optional().default("");
var optionalUrlText = z3.string().optional().default("");
var booleanToInt = (value) => value ? 1 : 0;
var enterpriseProfileInput = z3.object({
  projectId: z3.number().int().positive(),
  enterpriseName: nonEmptyString,
  shortName: optionalText,
  officialWebsite: optionalUrlText,
  industry: optionalText,
  region: optionalText,
  productServiceIntro: optionalText,
  targetCustomers: optionalText,
  coreSellingPoints: optionalText,
  servicePriceRange: optionalText,
  serviceModel: optionalText,
  fitCustomers: optionalText,
  unfitCustomers: optionalText,
  salesChannels: z3.array(z3.string()).default([]),
  commonQuestions: z3.array(z3.string()).default([]),
  purchaseDecisionFactors: z3.array(z3.string()).default([]),
  productIntro: optionalText,
  featureNotes: optionalText,
  serviceProcess: optionalText,
  deliveryPlan: optionalText,
  afterSalesService: optionalText,
  competitorDifference: optionalText,
  priceExplanation: optionalText,
  salesTalkTracks: optionalText,
  commonObjections: optionalText,
  /** 与 `enterprise_geo_profiles` 列对齐：含旧版 NOT NULL JSON 与 V2 扩展列（见 drizzle/schema.ts `enterpriseGeoProfiles`） */
  brandName: optionalText,
  industryTag: optionalText,
  productDesc: optionalText,
  mainChannel: optionalText,
  targetCustomer: optionalText,
  customerPains: z3.array(z3.string()).optional(),
  competitors: z3.array(z3.string()).optional(),
  hasCases: z3.boolean().optional(),
  oneLiner: optionalText,
  keyPoints: z3.array(z3.string()).optional(),
  keywords: z3.array(z3.string()).optional()
});
var assetSourceBaseInput = z3.object({
  projectId: z3.number().int().positive(),
  sourceType: z3.enum(assetSourceTypes),
  title: nonEmptyString,
  contentDigest: z3.string().optional().default(""),
  trustLevel: z3.enum(assetTrustLevels).default("\u4E2D"),
  isPublic: z3.boolean().default(false),
  canUseForGeneration: z3.boolean().default(false),
  manuallyConfirmed: z3.boolean().default(false)
});
var assetTextInput = assetSourceBaseInput.extend({
  inputMode: z3.enum(assetInputModes).default("\u6587\u672C\u7C98\u8D34")
});
var assetUploadInput = assetSourceBaseInput.extend({
  originalFileName: nonEmptyString,
  mimeType: z3.string().default("text/plain"),
  fileBase64: z3.string().min(1, "\u8BF7\u4E0A\u4F20\u6587\u4EF6\u5185\u5BB9")
});
var customerCaseInput = z3.object({
  projectId: z3.number().int().positive(),
  caseType: z3.enum(customerCaseTypes),
  customerName: nonEmptyString,
  customerIndustry: optionalText,
  customerBackground: optionalText,
  originalProblem: optionalText,
  chosenReason: optionalText,
  usedProductService: optionalText,
  executionProcess: optionalText,
  resultData: optionalText,
  customerFeedback: optionalText,
  allowPublic: z3.boolean().default(false),
  publicVersion: optionalText,
  sensitiveNotes: optionalText,
  sourceAssetIds: z3.array(z3.number().int().positive()).default([]),
  verificationStatus: z3.enum(caseVerificationStatuses).default("\u5F85\u786E\u8BA4")
});
var competitorInput = z3.object({
  projectId: z3.number().int().positive(),
  competitorName: nonEmptyString,
  website: optionalUrlText,
  positioning: optionalText,
  strengths: optionalText,
  weaknesses: optionalText,
  priceInfo: optionalText,
  contentAssets: optionalText,
  aiRecommendationSignals: optionalText,
  comparisonNotes: optionalText,
  sourceAssetIds: z3.array(z3.number().int().positive()).default([]),
  canReference: z3.boolean().default(true)
});
var complianceRuleInput = z3.object({
  projectId: z3.number().int().positive(),
  ruleName: nonEmptyString,
  forbiddenClaims: optionalText,
  forbiddenWords: z3.array(z3.string()).default([]),
  requiredDisclaimers: optionalText,
  dataUsageRules: optionalText,
  caseUsageRules: optionalText,
  priceUsageRules: optionalText,
  competitorMentionRules: optionalText,
  reviewRequiredTopics: z3.array(z3.string()).default([]),
  enabled: z3.boolean().default(true)
});
var contentStyleInput = z3.object({
  projectId: z3.number().int().positive(),
  profileName: nonEmptyString,
  tone: nonEmptyString,
  writingStyle: optionalText,
  terminology: z3.array(z3.string()).default([]),
  forbiddenTone: optionalText,
  exampleTitles: z3.array(z3.string()).default([]),
  exampleParagraphs: z3.array(z3.string()).default([]),
  targetReader: optionalText,
  preferredLength: optionalText,
  ctaStyle: optionalText,
  enabled: z3.boolean().default(true)
});
var publishStrategyInput = z3.object({
  projectId: z3.number().int().positive(),
  strategyName: nonEmptyString,
  reviewMode: z3.enum(publishReviewModes).default("\u5168\u4EBA\u5DE5\u5BA1\u6838"),
  dailyLimit: z3.number().int().positive().nullable().optional(),
  minQualityScore: z3.number().int().min(0).max(100).default(GEO_ARTICLE_MIN_PASS_SCORE),
  preferredPlatforms: z3.array(z3.string()).default([]),
  bannedPlatforms: z3.array(z3.string()).default([]),
  platformNotes: optionalText,
  enabled: z3.boolean().default(true)
});
var platformAuthorizationInput = z3.object({
  projectId: z3.number().int().positive(),
  platformName: nonEmptyString,
  accountAlias: optionalText,
  authorizationStatus: z3.enum(platformAuthorizationStatuses).default("\u672A\u914D\u7F6E"),
  secureCredentialRef: z3.string().optional().default(""),
  authorizationNotes: optionalText
});
var geoAssetRouter = router({
  summary: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive().optional() })).query(async ({ input }) => {
    const db = await requireDb2();
    if (!input.projectId) {
      return {
        profile: null,
        completionScore: 0,
        nextAction: "\u8BF7\u5148\u9009\u62E9\u9879\u76EE\uFF0C\u518D\u8865\u5145\u4F01\u4E1A\u8D44\u6599\u3002",
        riskReminders: ["\u672A\u9009\u62E9\u9879\u76EE\uFF0C\u540E\u7EED\u5185\u5BB9\u751F\u6210\u4E0D\u80FD\u5F15\u7528\u4F01\u4E1A\u8D44\u6599\u4F9D\u636E\u3002"],
        assetSources: [],
        customerCases: [],
        competitors: [],
        complianceRules: [],
        styleProfiles: [],
        publishStrategies: [],
        platformAuthorizations: [],
        counts: { assetSources: 0, usableAssets: 0, customerCases: 0, realCases: 0, competitors: 0, complianceRules: 0, styleProfiles: 0, publishStrategies: 0, platformAuthorizations: 0 }
      };
    }
    await getProjectOrThrow2(input.projectId);
    const [profiles, sources, cases, competitors, rules, styles, strategies, authorizations] = await Promise.all([
      db.select().from(enterpriseGeoProfiles).where(eq4(enterpriseGeoProfiles.projectId, input.projectId)).limit(1),
      db.select().from(geoAssetSources).where(eq4(geoAssetSources.projectId, input.projectId)).orderBy(desc3(geoAssetSources.createdAt)),
      db.select().from(customerCases).where(eq4(customerCases.projectId, input.projectId)).orderBy(desc3(customerCases.createdAt)),
      db.select().from(competitorProfiles).where(eq4(competitorProfiles.projectId, input.projectId)).orderBy(desc3(competitorProfiles.createdAt)),
      db.select().from(complianceRules).where(eq4(complianceRules.projectId, input.projectId)).orderBy(desc3(complianceRules.createdAt)),
      db.select().from(contentStyleProfiles).where(eq4(contentStyleProfiles.projectId, input.projectId)).orderBy(desc3(contentStyleProfiles.createdAt)),
      db.select().from(publishStrategies).where(eq4(publishStrategies.projectId, input.projectId)).orderBy(desc3(publishStrategies.createdAt)),
      db.select().from(platformAuthorizationConfigs).where(eq4(platformAuthorizationConfigs.projectId, input.projectId)).orderBy(desc3(platformAuthorizationConfigs.createdAt))
    ]);
    const profile = profiles[0] ?? null;
    const completionScore = profile?.completionScore ?? calculateProfileCompletionScore(profile);
    const usableAssetCount = sources.filter((source) => source.canUseForGeneration && source.manuallyConfirmed).length;
    const realCaseCount = cases.filter((item) => item.caseType === "\u771F\u5B9E\u6848\u4F8B" && item.verificationStatus === "\u5DF2\u786E\u8BA4").length;
    const counts = { assetSources: sources.length, usableAssets: usableAssetCount, customerCases: cases.length, realCases: realCaseCount, competitors: competitors.length, complianceRules: rules.length, styleProfiles: styles.length, publishStrategies: strategies.length, platformAuthorizations: authorizations.length };
    const riskReminders = [
      usableAssetCount === 0 ? "\u6682\u65E0\u5DF2\u786E\u8BA4\u4E14\u5141\u8BB8\u7528\u4E8E\u5185\u5BB9\u751F\u6210\u7684\u8D44\u6599\uFF0C\u540E\u7EED\u6587\u7AE0\u4E0D\u80FD\u76F4\u63A5\u5F15\u7528\u5BA2\u6237\u8D44\u6599\u3002" : "\u5DF2\u6709\u53EF\u7528\u4E8E\u5185\u5BB9\u751F\u6210\u7684\u5BA2\u6237\u8D44\u6599\uFF0C\u540E\u7EED\u6587\u7AE0\u5E94\u5F3A\u5236\u5F15\u7528\u3002",
      realCaseCount === 0 ? "\u6682\u65E0\u5DF2\u786E\u8BA4\u771F\u5B9E\u6848\u4F8B\uFF0C\u7CFB\u7EDF\u4E0D\u5F97\u7F16\u9020\u5BA2\u6237\u6848\u4F8B\u3001\u7ED3\u679C\u6570\u636E\u6216\u5BA2\u6237\u53CD\u9988\u3002" : "\u5DF2\u6709\u5DF2\u786E\u8BA4\u771F\u5B9E\u6848\u4F8B\uFF0C\u5F15\u7528\u65F6\u4ECD\u9700\u9075\u5B88\u516C\u5F00\u6388\u6743\u548C\u654F\u611F\u4FE1\u606F\u89C4\u5219\u3002",
      authorizations.some((item) => /password|pwd|token|cookie|密码/i.test(`${item.authorizationNotes ?? ""}${item.secureCredentialRef ?? ""}`)) ? "\u5E73\u53F0\u6388\u6743\u914D\u7F6E\u5B58\u5728\u7591\u4F3C\u654F\u611F\u4FE1\u606F\uFF0C\u8BF7\u7ACB\u5373\u6E05\u7406\u3002" : "\u5E73\u53F0\u6388\u6743\u914D\u7F6E\u91C7\u7528\u8131\u654F\u6216\u5F15\u7528\u65B9\u5F0F\uFF0C\u4E0D\u4FDD\u5B58\u660E\u6587\u8D26\u53F7\u5BC6\u7801\u3002"
    ];
    const nextAction = completionScore < 60 ? "\u7EE7\u7EED\u8865\u5145\u4F01\u4E1A\u57FA\u7840\u4FE1\u606F\u3001\u4EA7\u54C1\u670D\u52A1\u8D44\u6599\u548C\u5BA2\u6237\u8D2D\u4E70\u51B3\u7B56\u70B9\u3002" : usableAssetCount === 0 ? "\u8BF7\u786E\u8BA4\u81F3\u5C11\u4E00\u6761\u8D44\u6599\u5141\u8BB8\u7528\u4E8E\u5185\u5BB9\u751F\u6210\u3002" : realCaseCount === 0 ? "\u5982\u9700\u6848\u4F8B\u578B\u5185\u5BB9\uFF0C\u8BF7\u5148\u8865\u5145\u771F\u5B9E\u6848\u4F8B\u6765\u6E90\uFF1B\u5426\u5219\u540E\u7EED\u5185\u5BB9\u5E94\u907F\u5F00\u6848\u4F8B\u627F\u8BFA\u3002" : "\u8D44\u4EA7\u5E93\u53EF\u652F\u6491\u540E\u7EED\u8BCA\u65AD\u3001\u5185\u5BB9\u751F\u6210\u3001\u8D28\u68C0\u548C\u53D1\u5E03\u7B56\u7565\u3002";
    return {
      profile,
      completionScore,
      nextAction,
      riskReminders,
      counts,
      assetSources: sources,
      customerCases: cases,
      competitors,
      complianceRules: rules,
      styleProfiles: styles,
      publishStrategies: strategies,
      platformAuthorizations: authorizations
    };
  }),
  upsertProfile: protectedProcedure.input(enterpriseProfileInput).mutation(async ({ input }) => {
    const db = await requireDb2();
    await getProjectOrThrow2(input.projectId);
    const completionScore = calculateProfileCompletionScore(input);
    const existing = await db.select().from(enterpriseGeoProfiles).where(eq4(enterpriseGeoProfiles.projectId, input.projectId)).limit(1);
    const raw = { ...input, completionScore };
    const values = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== void 0));
    if (existing[0]) {
      await db.update(enterpriseGeoProfiles).set(values).where(eq4(enterpriseGeoProfiles.id, existing[0].id));
      return { success: true, id: existing[0].id, completionScore };
    }
    const inserted = await db.insert(enterpriseGeoProfiles).values(values).$returningId();
    return { success: true, id: inserted[0]?.id ?? 0, completionScore };
  }),
  addTextSource: protectedProcedure.input(assetTextInput).mutation(async ({ input }) => {
    const db = await requireDb2();
    await getProjectOrThrow2(input.projectId);
    const structuredSummary = summarizeTextToStructuredSummary(input.contentDigest, input.title);
    const inserted = await db.insert(geoAssetSources).values({
      projectId: input.projectId,
      sourceType: input.sourceType,
      inputMode: input.inputMode,
      title: input.title,
      contentDigest: input.contentDigest,
      structuredSummary,
      trustLevel: input.trustLevel,
      parseStatus: input.manuallyConfirmed ? "\u4EBA\u5DE5\u786E\u8BA4" : "\u5DF2\u89E3\u6790",
      isPublic: booleanToInt(input.isPublic),
      canUseForGeneration: booleanToInt(input.canUseForGeneration),
      manuallyConfirmed: booleanToInt(input.manuallyConfirmed),
      parsedAt: /* @__PURE__ */ new Date()
    }).$returningId();
    return { success: true, id: inserted[0]?.id ?? 0 };
  }),
  addUploadedSource: protectedProcedure.input(assetUploadInput).mutation(async ({ input }) => {
    const db = await requireDb2();
    await getProjectOrThrow2(input.projectId);
    const raw = Buffer.from(input.fileBase64, "base64");
    if (raw.length === 0) throw new TRPCError5({ code: "BAD_REQUEST", message: "\u4E0A\u4F20\u6587\u4EF6\u4E3A\u7A7A" });
    const relKey = `geo-assets/${input.projectId}/${Date.now()}-${input.originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const stored = await storagePut(relKey, raw, input.mimeType);
    const digest = input.contentDigest || `\u5DF2\u4E0A\u4F20\u6587\u4EF6\uFF1A${input.originalFileName}\uFF0C\u5927\u5C0F ${raw.length} \u5B57\u8282\u3002\u6570\u636E\u5E93\u4EC5\u4FDD\u5B58\u6587\u4EF6 key\u3001URL \u4E0E\u6458\u8981\uFF0C\u4E0D\u4FDD\u5B58\u6587\u4EF6\u5B57\u8282\u3002`;
    const record = createUploadAssetDbRecord({
      projectId: input.projectId,
      sourceType: input.sourceType,
      title: input.title,
      originalFileName: input.originalFileName,
      fileKey: stored.key,
      fileUrl: stored.url,
      mimeType: input.mimeType,
      contentDigest: digest,
      trustLevel: input.trustLevel,
      isPublic: input.isPublic,
      canUseForGeneration: input.canUseForGeneration,
      manuallyConfirmed: input.manuallyConfirmed
    });
    const inserted = await db.insert(geoAssetSources).values(record).$returningId();
    return { success: true, id: inserted[0]?.id ?? 0, fileKey: stored.key, fileUrl: stored.url };
  }),
  createCustomerCase: protectedProcedure.input(customerCaseInput).mutation(async ({ input }) => {
    const db = await requireDb2();
    await getProjectOrThrow2(input.projectId);
    try {
      validateCustomerCaseInput(input);
    } catch (error) {
      throw new TRPCError5({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "\u5BA2\u6237\u6848\u4F8B\u6821\u9A8C\u5931\u8D25" });
    }
    const inserted = await db.insert(customerCases).values({
      ...input,
      allowPublic: booleanToInt(input.allowPublic),
      verificationStatus: input.caseType === "\u5F85\u8865\u5145\u6848\u4F8B\u7EBF\u7D22" ? "\u4FE1\u606F\u4E0D\u8DB3" : input.verificationStatus
    }).$returningId();
    return { success: true, id: inserted[0]?.id ?? 0 };
  }),
  updateCustomerCase: protectedProcedure.input(customerCaseInput.extend({ id: z3.number().int().positive() })).mutation(async ({ input }) => {
    const db = await requireDb2();
    await getProjectOrThrow2(input.projectId);
    try {
      validateCustomerCaseInput(input);
    } catch (error) {
      throw new TRPCError5({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "\u5BA2\u6237\u6848\u4F8B\u6821\u9A8C\u5931\u8D25" });
    }
    const { id, ...values } = input;
    await db.update(customerCases).set({
      ...values,
      allowPublic: booleanToInt(values.allowPublic),
      verificationStatus: values.caseType === "\u5F85\u8865\u5145\u6848\u4F8B\u7EBF\u7D22" ? "\u4FE1\u606F\u4E0D\u8DB3" : values.verificationStatus
    }).where(eq4(customerCases.id, id));
    return { success: true, id };
  }),
  createCompetitor: protectedProcedure.input(competitorInput).mutation(async ({ input }) => {
    const db = await requireDb2();
    await getProjectOrThrow2(input.projectId);
    const inserted = await db.insert(competitorProfiles).values({ ...input, canReference: booleanToInt(input.canReference) }).$returningId();
    return { success: true, id: inserted[0]?.id ?? 0 };
  }),
  updateCompetitor: protectedProcedure.input(competitorInput.extend({ id: z3.number().int().positive() })).mutation(async ({ input }) => {
    const db = await requireDb2();
    await getProjectOrThrow2(input.projectId);
    const { id, ...values } = input;
    await db.update(competitorProfiles).set({ ...values, canReference: booleanToInt(values.canReference) }).where(eq4(competitorProfiles.id, id));
    return { success: true, id };
  }),
  /** 合规规则 / 发布策略 / 平台授权 的客户写入入口已关闭，统一由 `server/systemConfig.ts` 与只读历史表承载。 */
  createComplianceRule: protectedProcedure.input(complianceRuleInput).mutation(() => {
    throw new TRPCError5({ code: "FORBIDDEN", message: "\u5408\u89C4\u89C4\u5219\u5DF2\u8FC1\u79FB\u4E3A\u7CFB\u7EDF\u7EDF\u4E00\u914D\u7F6E\uFF0C\u6B64\u5165\u53E3\u5DF2\u5173\u95ED\u3002" });
  }),
  updateComplianceRule: protectedProcedure.input(complianceRuleInput.extend({ id: z3.number().int().positive() })).mutation(() => {
    throw new TRPCError5({ code: "FORBIDDEN", message: "\u5408\u89C4\u89C4\u5219\u5DF2\u8FC1\u79FB\u4E3A\u7CFB\u7EDF\u7EDF\u4E00\u914D\u7F6E\uFF0C\u6B64\u5165\u53E3\u5DF2\u5173\u95ED\u3002" });
  }),
  createStyleProfile: protectedProcedure.input(contentStyleInput).mutation(async ({ input }) => {
    const db = await requireDb2();
    await getProjectOrThrow2(input.projectId);
    const inserted = await db.insert(contentStyleProfiles).values({ ...input, enabled: booleanToInt(input.enabled) }).$returningId();
    return { success: true, id: inserted[0]?.id ?? 0 };
  }),
  createPublishStrategy: protectedProcedure.input(publishStrategyInput).mutation(() => {
    throw new TRPCError5({ code: "FORBIDDEN", message: "\u53D1\u5E03\u7B56\u7565\u5DF2\u8FC1\u79FB\u4E3A\u7CFB\u7EDF\u7EDF\u4E00\u914D\u7F6E\uFF0C\u6B64\u5165\u53E3\u5DF2\u5173\u95ED\u3002" });
  }),
  updatePublishStrategy: protectedProcedure.input(publishStrategyInput.extend({ id: z3.number().int().positive() })).mutation(() => {
    throw new TRPCError5({ code: "FORBIDDEN", message: "\u53D1\u5E03\u7B56\u7565\u5DF2\u8FC1\u79FB\u4E3A\u7CFB\u7EDF\u7EDF\u4E00\u914D\u7F6E\uFF0C\u6B64\u5165\u53E3\u5DF2\u5173\u95ED\u3002" });
  }),
  createPlatformAuthorization: protectedProcedure.input(platformAuthorizationInput).mutation(() => {
    throw new TRPCError5({ code: "FORBIDDEN", message: "\u7B2C\u4E09\u65B9\u5E73\u53F0\u6388\u6743\u5DF2\u4E0D\u5728\u4F01\u4E1A\u6863\u6848\u7EF4\u62A4\uFF0C\u6B64\u5165\u53E3\u5DF2\u5173\u95ED\u3002" });
  }),
  updatePlatformAuthorization: protectedProcedure.input(platformAuthorizationInput.extend({ id: z3.number().int().positive() })).mutation(() => {
    throw new TRPCError5({ code: "FORBIDDEN", message: "\u7B2C\u4E09\u65B9\u5E73\u53F0\u6388\u6743\u5DF2\u4E0D\u5728\u4F01\u4E1A\u6863\u6848\u7EF4\u62A4\uFF0C\u6B64\u5165\u53E3\u5DF2\u5173\u95ED\u3002" });
  }),
  generateProfileMarketingCopy: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive() })).mutation(async ({ input }) => {
    const db = await requireDb2();
    await getProjectOrThrow2(input.projectId);
    const rows = await db.select().from(enterpriseGeoProfiles).where(eq4(enterpriseGeoProfiles.projectId, input.projectId)).orderBy(desc3(enterpriseGeoProfiles.updatedAt)).limit(1);
    const p = rows[0];
    if (!p) throw new TRPCError5({ code: "BAD_REQUEST", message: "\u8BF7\u5148\u4FDD\u5B58\u4F01\u4E1A\u6863\u6848\u3002" });
    const brandName = String(p.brandName ?? p.enterpriseName ?? "").trim();
    const industryTag = String(p.industryTag ?? p.industry ?? "").trim();
    const productDesc = String(p.productDesc ?? p.productServiceIntro ?? p.productIntro ?? "").trim();
    const targetCustomer = String(p.targetCustomer ?? p.targetCustomers ?? "").trim();
    const painsRaw = p.customerPains;
    let pains = [];
    if (Array.isArray(painsRaw)) pains = painsRaw.filter((x) => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
    else if (typeof painsRaw === "string" && painsRaw.trim()) {
      try {
        const j = JSON.parse(painsRaw);
        if (Array.isArray(j)) pains = j.filter((x) => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
      } catch {
      }
    }
    if (!brandName || !industryTag || !productDesc || !targetCustomer || pains.length === 0) {
      throw new TRPCError5({ code: "BAD_REQUEST", message: "\u8BF7\u5148\u5B8C\u6210\u300C\u57FA\u672C\u8EAB\u4EFD\u300D\u4E0E\u300C\u4F60\u7684\u5BA2\u6237\u300D\u5FC5\u586B\u9879\u5E76\u4FDD\u5B58\u3002" });
    }
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "\u4F60\u662F B2B \u4F01\u4E1A\u5185\u5BB9\u4E0E\u5E02\u573A\u987E\u95EE\u3002\u53EA\u8F93\u51FA\u7B26\u5408 JSON Schema \u7684\u4E2D\u6587\u7ED3\u679C\uFF1B\u5356\u70B9\u8981\u5177\u4F53\u53EF\u9A8C\u8BC1\u503E\u5411\uFF0C\u5173\u952E\u8BCD\u7528\u4E8E GEO \u5185\u5BB9\u68C0\u7D22\u573A\u666F\u3002" },
        {
          role: "user",
          content: `\u6839\u636E\u4EE5\u4E0B\u4FE1\u606F\u751F\u6210\uFF1A1\uFF09\u4E00\u53E5\u8BDD\u4ECB\u7ECD oneLiner\uFF08\u4E0D\u8D85\u8FC7 60 \u5B57\uFF09\uFF1B2\uFF09\u6838\u5FC3\u5356\u70B9 keyPoints\uFF083-8 \u6761\uFF0C\u6BCF\u6761\u4E0D\u8D85\u8FC7 24 \u5B57\uFF09\uFF1B3\uFF09\u6838\u5FC3\u5173\u952E\u8BCD keywords\uFF085-12 \u4E2A\u8BCD\u6216\u77ED\u8BED\uFF0C\u6BCF\u6761\u4E0D\u8D85\u8FC7 12 \u5B57\uFF09\u3002

\u4F01\u4E1A/\u54C1\u724C\uFF1A${brandName}
\u884C\u4E1A\u65B9\u5411\uFF1A${industryTag}
\u4EA7\u54C1/\u670D\u52A1\uFF1A${productDesc}
\u76EE\u6807\u5BA2\u6237\uFF1A${targetCustomer}
\u5BA2\u6237\u75DB\u70B9\uFF1A${pains.join("\u3001")}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "profile_marketing_snippets",
          strict: true,
          schema: {
            type: "object",
            properties: {
              oneLiner: { type: "string" },
              keyPoints: {
                type: "array",
                minItems: 3,
                maxItems: 8,
                items: { type: "string" }
              },
              keywords: {
                type: "array",
                minItems: 5,
                maxItems: 12,
                items: { type: "string" }
              }
            },
            required: ["oneLiner", "keyPoints", "keywords"],
            additionalProperties: false
          }
        }
      }
    });
    const parsed = parseLLMJson(response.choices[0]?.message.content);
    return { oneLiner: parsed.oneLiner.trim(), keyPoints: parsed.keyPoints.map((s) => s.trim()).filter(Boolean), keywords: parsed.keywords.map((s) => s.trim()).filter(Boolean) };
  }),
  evidencePack: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive(), assetIds: z3.array(z3.number().int().positive()).min(1) })).query(async ({ input }) => {
    const db = await requireDb2();
    await getProjectOrThrow2(input.projectId);
    const sources = await db.select().from(geoAssetSources).where(eq4(geoAssetSources.projectId, input.projectId));
    const selected = sources.filter((source) => input.assetIds.includes(source.id));
    if (selected.length !== input.assetIds.length) {
      throw new TRPCError5({ code: "BAD_REQUEST", message: "\u5B58\u5728\u4E0D\u5C5E\u4E8E\u5F53\u524D\u9879\u76EE\u7684\u8D44\u6599\u6765\u6E90" });
    }
    try {
      return buildAssetEvidencePack(selected.map((source) => ({
        id: source.id,
        title: source.title,
        sourceType: source.sourceType,
        trustLevel: source.trustLevel,
        canUseForGeneration: source.canUseForGeneration,
        manuallyConfirmed: source.manuallyConfirmed,
        structuredSummary: source.structuredSummary,
        contentDigest: source.contentDigest
      })));
    } catch (error) {
      throw new TRPCError5({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "\u8D44\u6599\u4E0D\u80FD\u4F5C\u4E3A\u5185\u5BB9\u4F9D\u636E" });
    }
  })
});
var geoRouter = router({
  assetLibrary: geoAssetRouter,
  projects: router({
    list: protectedProcedure.query(async () => {
      const db = await requireDb2();
      return db.select().from(projects).orderBy(desc3(projects.createdAt));
    }),
    create: protectedProcedure.input(projectInput).mutation(async ({ input }) => {
      const db = await requireDb2();
      await db.insert(projects).values({ ...input, status: "created" });
      return { success: true };
    }),
    update: protectedProcedure.input(projectInput.extend({ id: z3.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb2();
      const { id, ...values } = input;
      await db.update(projects).set(values).where(eq4(projects.id, id));
      return { success: true };
    }),
    delete: protectedProcedure.input(z3.object({ id: z3.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb2();
      await db.delete(reports).where(eq4(reports.projectId, input.id));
      await db.delete(contentTemplates).where(eq4(contentTemplates.projectId, input.id));
      await db.delete(optimizationTasks).where(eq4(optimizationTasks.projectId, input.id));
      await db.delete(geoScores).where(eq4(geoScores.projectId, input.id));
      await db.delete(analysisResults).where(eq4(analysisResults.projectId, input.id));
      await db.delete(aiResponses).where(eq4(aiResponses.projectId, input.id));
      await db.delete(questions).where(eq4(questions.projectId, input.id));
      await db.delete(projects).where(eq4(projects.id, input.id));
      return { success: true };
    })
  }),
  questions: router({
    list: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb2();
      if (!input.projectId) return [];
      return db.select().from(questions).where(eq4(questions.projectId, input.projectId)).orderBy(desc3(questions.createdAt));
    }),
    create: protectedProcedure.input(questionInput).mutation(async ({ input }) => {
      const db = await requireDb2();
      await db.insert(questions).values({ ...input, targetKeyword: input.targetKeyword?.trim() || null, intentLevel: input.intentLevel ?? "\u9AD8", businessValue: input.businessValue ?? 5, source: input.source ?? "manual", enabled: input.enabled ? 1 : 0 });
      await updateProjectStatus(input.projectId, "questions_ready");
      return { success: true };
    }),
    update: protectedProcedure.input(questionInput.extend({ id: z3.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb2();
      const { id, ...values } = input;
      await db.update(questions).set({ ...values, targetKeyword: values.targetKeyword?.trim() || null, intentLevel: values.intentLevel ?? "\u9AD8", businessValue: values.businessValue ?? 5, source: values.source ?? "manual", enabled: values.enabled ? 1 : 0 }).where(eq4(questions.id, id));
      return { success: true };
    }),
    toggle: protectedProcedure.input(z3.object({ id: z3.number().int().positive(), enabled: z3.boolean() })).mutation(async ({ input }) => {
      const db = await requireDb2();
      await db.update(questions).set({ enabled: input.enabled ? 1 : 0 }).where(eq4(questions.id, input.id));
      return { success: true };
    }),
    delete: protectedProcedure.input(z3.object({ id: z3.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb2();
      await db.delete(questions).where(eq4(questions.id, input.id));
      return { success: true };
    }),
    batchAddSpecified: protectedProcedure.input(z3.object({
      projectId: z3.number().int().positive(),
      questions: z3.array(z3.string().min(1)).min(1)
    })).mutation(async ({ input }) => {
      return insertSpecifiedQuestions(input.projectId, input.questions.map((questionText) => ({ questionText })), "manual");
    }),
    importSpecifiedCsvRows: protectedProcedure.input(z3.object({
      projectId: z3.number().int().positive(),
      rows: z3.array(manualQuestionImportRow).min(1)
    })).mutation(async ({ input }) => {
      return insertSpecifiedQuestions(input.projectId, input.rows, "csv");
    }),
    /** 基于企业档案生成 5–10 条 AI 检索型目标问题，写入 questions（覆盖同项目历史 ai_generated 行）。 */
    generateTargetQuestions: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb2();
      const project = await getProjectOrThrow2(input.projectId);
      const profileRows = await db.select().from(enterpriseGeoProfiles).where(eq4(enterpriseGeoProfiles.projectId, input.projectId)).orderBy(desc3(enterpriseGeoProfiles.updatedAt)).limit(1);
      const ep = profileRows[0];
      const resolved = resolveEnterpriseProfileForContent(ep ?? null);
      const painFromProfile = ep?.customerPains?.filter((x) => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
      const customerPains = painFromProfile?.length ? painFromProfile.join("\uFF1B") : resolved.customerPains.join("\uFF1B") || "\uFF08\u6863\u6848\u672A\u586B\u5BA2\u6237\u75DB\u70B9\uFF0C\u8BF7\u7ED3\u5408\u884C\u4E1A\u5E38\u8BC6\u63A8\u6F14\uFF09";
      const compArr = ep?.competitors?.filter((x) => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) ?? [];
      const competitors = compArr.length > 0 ? compArr.join("\u3001") : project.competitorNames.join("\u3001") || "\uFF08\u672A\u586B\uFF09";
      const keyPointsFromEp = ep?.keyPoints?.filter((x) => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()).join("\uFF1B");
      const keyPointsStr = keyPointsFromEp && keyPointsFromEp.length > 0 ? keyPointsFromEp : resolved.keyPoints.join("\uFF1B") || project.coreSellingPoints;
      const generated = await generateTargetQuestions({
        brandName: (ep?.brandName?.trim() || resolved.brandName || project.enterpriseName).trim(),
        industryTag: (ep?.industryTag?.trim() || project.industry).trim(),
        productDesc: (ep?.productDesc?.trim() || resolved.productDesc || project.productIntro).trim(),
        targetCustomer: (ep?.targetCustomer?.trim() || resolved.targetCustomer || project.targetCustomers).trim(),
        customerPains,
        competitors,
        keyPoints: keyPointsStr
      });
      await db.delete(questions).where(and2(eq4(questions.projectId, input.projectId), eq4(questions.source, "ai_generated")));
      await db.insert(questions).values(
        generated.map((item) => ({
          projectId: input.projectId,
          questionText: item.questionText,
          questionType: "\u6307\u5B9A\u95EE\u9898",
          targetKeyword: JSON.stringify({ intent: item.intent, disadvantaged: item.disadvantaged }),
          intentLevel: "\u9AD8",
          businessValue: item.disadvantaged ? 9 : 7,
          source: "ai_generated",
          enabled: 1
        }))
      );
      await updateProjectStatus(input.projectId, "questions_ready");
      return { success: true, count: generated.length };
    }),
    generate: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb2();
      const project = await getProjectOrThrow2(input.projectId);
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "\u4F60\u662F\u4F01\u4E1A GEO / AI Visibility \u8BCA\u65AD\u987E\u95EE\u3002\u8BF7\u53EA\u8F93\u51FA\u7B26\u5408 JSON Schema \u7684\u4E2D\u6587\u7ED3\u679C\u3002" },
          {
            role: "user",
            content: `\u8BF7\u6839\u636E\u4EE5\u4E0B\u4F01\u4E1A\u4FE1\u606F\u751F\u6210 50 \u4E2A\u7528\u6237\u53EF\u80FD\u5411 AI \u5BF9\u8BDD\u5E73\u53F0\u63D0\u51FA\u7684\u95EE\u9898\u3002\u5FC5\u987B\u8986\u76D6\u95EE\u9898\u7C7B\u578B\uFF1A${generatedQuestionTypes.join("\u3001")}\u3002

\u4F01\u4E1A\u540D\u79F0\uFF1A${project.enterpriseName}
\u884C\u4E1A\uFF1A${project.industry}
\u5B98\u7F51\uFF1A${project.website}
\u5730\u533A\uFF1A${project.region}
\u4EA7\u54C1\u4ECB\u7ECD\uFF1A${project.productIntro}
\u76EE\u6807\u5BA2\u6237\uFF1A${project.targetCustomers}
\u6838\u5FC3\u5356\u70B9\uFF1A${project.coreSellingPoints}
\u7ADE\u54C1\uFF1A${project.competitorNames.join("\u3001")}
\u6838\u5FC3\u5173\u952E\u8BCD\uFF1A${project.coreKeywords.join("\u3001")}`
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "geo_questions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  minItems: 50,
                  maxItems: 50,
                  items: {
                    type: "object",
                    properties: {
                      questionText: { type: "string" },
                      questionType: { type: "string", enum: generatedQuestionTypes }
                    },
                    required: ["questionText", "questionType"],
                    additionalProperties: false
                  }
                }
              },
              required: ["questions"],
              additionalProperties: false
            }
          }
        }
      });
      const parsed = parseLLMJson(response.choices[0]?.message.content);
      if (parsed.questions.length !== 50) {
        throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "AI \u672A\u8FD4\u56DE 50 \u4E2A\u95EE\u9898\uFF0C\u8BF7\u91CD\u65B0\u751F\u6210" });
      }
      await db.insert(questions).values(parsed.questions.map((item) => ({ ...item, projectId: input.projectId, targetKeyword: null, intentLevel: "\u4E2D", businessValue: 3, source: "ai_generated", enabled: 1 })));
      await updateProjectStatus(input.projectId, "questions_ready");
      return { success: true, count: parsed.questions.length };
    })
  }),
  aiResponses: router({
    list: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb2();
      if (!input.projectId) return [];
      return db.select().from(aiResponses).where(eq4(aiResponses.projectId, input.projectId)).orderBy(desc3(aiResponses.createdAt));
    }),
    create: protectedProcedure.input(aiResponseInput).mutation(async ({ input }) => {
      const db = await requireDb2();
      await db.insert(aiResponses).values({ ...input, questionId: input.questionId ?? null, checkedAt: new Date(input.checkedAt) });
      await syncManualQuestionsFromAiResponseImport(db, [{ projectId: input.projectId, questionText: input.questionText }]);
      await updateProjectStatus(input.projectId, "responses_imported");
      return { success: true };
    }),
    importCsvRows: protectedProcedure.input(z3.object({ rows: z3.array(aiResponseInput).min(1) })).mutation(async ({ input }) => {
      const db = await requireDb2();
      await db.insert(aiResponses).values(input.rows.map((row) => ({ ...row, questionId: row.questionId ?? null, checkedAt: new Date(row.checkedAt) })));
      await syncManualQuestionsFromAiResponseImport(
        db,
        input.rows.map((row) => ({ projectId: row.projectId, questionText: row.questionText }))
      );
      const projectIds = Array.from(new Set(input.rows.map((row) => row.projectId)));
      await Promise.all(projectIds.map((projectId) => updateProjectStatus(projectId, "responses_imported")));
      return { success: true, count: input.rows.length };
    }),
    delete: protectedProcedure.input(z3.object({ id: z3.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb2();
      await db.delete(analysisResults).where(eq4(analysisResults.aiResponseId, input.id));
      await db.delete(aiResponses).where(eq4(aiResponses.id, input.id));
      return { success: true };
    })
  }),
  analysis: router({
    list: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb2();
      if (!input.projectId) return [];
      const rows = await db.select().from(analysisResults).where(eq4(analysisResults.projectId, input.projectId)).orderBy(desc3(analysisResults.createdAt));
      const [responseRows, questionRows] = await Promise.all([
        db.select({ id: aiResponses.id, questionId: aiResponses.questionId, questionText: aiResponses.questionText }).from(aiResponses).where(eq4(aiResponses.projectId, input.projectId)),
        db.select({ id: questions.id, questionText: questions.questionText }).from(questions).where(eq4(questions.projectId, input.projectId))
      ]);
      return attachQuestionTextToAnalyses(rows.map(resolveEffectiveAnalysisResult), responseRows, questionRows);
    }),
    run: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb2();
      const project = await getProjectOrThrow2(input.projectId);
      const profileRows = await db.select().from(enterpriseGeoProfiles).where(eq4(enterpriseGeoProfiles.projectId, input.projectId)).orderBy(desc3(enterpriseGeoProfiles.updatedAt)).limit(1);
      const profileRow = profileRows[0];
      const enterpriseInfo = buildEnterpriseInfoBlockForDiagnosis(project, profileRow);
      const qrows = await db.select().from(questions).where(eq4(questions.projectId, input.projectId));
      const diagnosisQuestions = qrows.filter((q) => q.enabled === 1 && q.questionType === "\u6307\u5B9A\u95EE\u9898").sort((a, b) => (b.businessValue ?? 0) - (a.businessValue ?? 0)).slice(0, 10);
      if (diagnosisQuestions.length === 0) {
        throw new TRPCError5({
          code: "BAD_REQUEST",
          message: "\u8BF7\u5148\u5728 AI \u8BCA\u65AD\u9875\u70B9\u51FB\u300C\u91CD\u65B0\u751F\u6210\u300D\uFF0C\u6216\u6DFB\u52A0\u300C\u6307\u5B9A\u95EE\u9898\u300D\u7C7B\u578B\u95EE\u9898\uFF0C\u518D\u8FD0\u884C\u8BCA\u65AD\u3002"
        });
      }
      await db.delete(analysisResults).where(eq4(analysisResults.projectId, input.projectId));
      await db.delete(aiResponses).where(
        and2(eq4(aiResponses.projectId, input.projectId), like(aiResponses.rawAnswer, `${GEO_SYNTHETIC_AI_RESPONSE_PREFIX}%`))
      );
      const diagnosisSystemPrompt = `\u4F60\u662F\u4E00\u4F4DGEO\u5185\u5BB9\u7B56\u7565\u4E13\u5BB6\uFF0C\u4E13\u6CE8\u4E8E\u5206\u6790\u4F01\u4E1A\u5185\u5BB9\u5982\u4F55\u66F4\u597D\u5730\u56DE\u7B54\u76EE\u6807\u5BA2\u6237\u7684\u771F\u5B9E\u95EE\u9898\u3002
\u4F60\u7684\u4EFB\u52A1\u662F\u63A8\u6F14\uFF1A\u5F53\u7528\u6237\u5728ChatGPT\u3001Perplexity\u7B49AI\u5DE5\u5177\u4E2D\u8F93\u5165\u8FD9\u4E2A\u95EE\u9898\u65F6\uFF0C\u8BE5\u4F01\u4E1A\u73B0\u6709\u7684\u5185\u5BB9\u80FD\u5426\u88ABAI\u5F15\u7528\u6765\u56DE\u7B54\u8FD9\u4E2A\u95EE\u9898\u3002

\u5206\u6790\u6846\u67B6\uFF1A
1. \u8FD9\u4E2A\u95EE\u9898\u7684\u6838\u5FC3\u662F\u4EC0\u4E48\u75DB\u70B9\u6216\u9700\u6C42\uFF1F
2. AI\u56DE\u7B54\u8FD9\u4E2A\u95EE\u9898\u65F6\u4F1A\u5F15\u7528\u4EC0\u4E48\u7C7B\u578B\u7684\u5185\u5BB9\uFF1F\uFF08\u6848\u4F8B/\u6570\u636E/\u65B9\u6CD5\u8BBA/\u5DE5\u5177\u8BF4\u660E\uFF09
3. \u8BE5\u4F01\u4E1A\u76EE\u524D\u662F\u5426\u6709\u516C\u5F00\u5185\u5BB9\u80FD\u56DE\u7B54\u8FD9\u4E2A\u95EE\u9898\uFF1F
4. \u5185\u5BB9\u7F3A\u53E3\u662F\u4EC0\u4E48\uFF1F\u9700\u8981\u8865\u5145\u4EC0\u4E48\u7C7B\u578B\u7684\u5185\u5BB9\u624D\u80FD\u88ABAI\u5F15\u7528\uFF1F
5. \u5EFA\u8BAE\u521B\u4F5C\u7684\u5185\u5BB9\u65B9\u5411\uFF08\u4E0D\u662F\u7ADE\u54C1\u5BF9\u6BD4\uFF0C\u800C\u662F\u5E2E\u5BA2\u6237\u89E3\u51B3\u8FD9\u4E2A\u95EE\u9898\u7684\u5185\u5BB9\uFF09

\u91CD\u8981\u7EA6\u675F\uFF1A
- \u4E0D\u8981\u4EE5\u300C\u7ADE\u54C1\u5BF9\u6BD4\u300D\u4F5C\u4E3A\u5185\u5BB9\u5EFA\u8BAE\u65B9\u5411
- \u5185\u5BB9\u5EFA\u8BAE\u5E94\u8BE5\u662F\u300C\u5E2E\u5BA2\u6237\u89E3\u51B3\u95EE\u9898\u300D\u7684\u89C6\u89D2\uFF0C\u4E0D\u662F\u300C\u8BC1\u660E\u81EA\u5DF1\u6BD4\u7ADE\u54C1\u5F3A\u300D\u7684\u89C6\u89D2
- \u5EFA\u8BAE\u6807\u9898\u5E94\u8BE5\u662F\u5BA2\u6237\u4F1A\u4E3B\u52A8\u641C\u7D22\u7684\u6807\u9898\uFF0C\u4E0D\u662F\u54C1\u724C\u5BA3\u4F20\u6807\u9898
- \u300C\u662F\u5426\u6613\u63D0\u53CA\u300D\u548C\u300C\u662F\u5426\u6613\u63A8\u8350\u300D\u5FC5\u987B\u72EC\u7ACB\u5224\u65AD\uFF0C\u4E0D\u8981\u4E24\u4E2A\u5E03\u5C14\u503C\u957F\u671F\u96F7\u540C\uFF08\u5728\u5408\u7406\u89E3\u91CA\u524D\u63D0\u4E0B\uFF09`;
      const platformItemSchema = {
        type: "string",
        enum: ["\u77E5\u4E4E", "\u5C0F\u7EA2\u4E66", "\u767E\u5BB6\u53F7", "\u5934\u6761\u53F7", "\u5FAE\u4FE1\u516C\u4F17\u53F7", "\u5B98\u7F51"]
      };
      const rows = [];
      for (const q of diagnosisQuestions) {
        const stub = `${GEO_SYNTHETIC_AI_RESPONSE_PREFIX}\u672A\u91C7\u96C6\u771F\u5B9E AI \u5E73\u53F0\u539F\u59CB\u56DE\u7B54\uFF1B\u8BF7\u4EC5\u4F9D\u636E\u4F01\u4E1A\u6863\u6848\u4E0E\u76EE\u6807\u68C0\u7D22\u610F\u56FE\u505A GEO \u7F3A\u53E3\u63A8\u6F14\u3002`;
        const inserted = await db.insert(aiResponses).values({
          projectId: input.projectId,
          questionId: q.id,
          questionText: q.questionText,
          aiPlatform: "\u5176\u4ED6",
          rawAnswer: stub,
          checkedAt: /* @__PURE__ */ new Date()
        }).$returningId();
        const responseId = inserted[0]?.id ?? 0;
        if (!responseId) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "\u5199\u5165\u8BCA\u65AD\u5360\u4F4D\u8BB0\u5F55\u5931\u8D25" });
        const { intent: questionIntent, disadvantaged: questionDisadvantaged } = parseQuestionGeoMeta(q.targetKeyword);
        const disadvantagedLabel = questionDisadvantaged ? "\u662F" : "\u5426";
        const intentLabel = questionIntent || "\uFF08\u672A\u6807\u6CE8\uFF0C\u8BF7\u7ED3\u5408\u95EE\u9898\u6587\u672C\u63A8\u65AD\uFF09";
        const llm = await invokeLLM({
          max_tokens: 4096,
          timeout_ms: 12e4,
          messages: [
            { role: "system", content: diagnosisSystemPrompt },
            {
              role: "user",
              content: [
                "\u4F01\u4E1A\u4FE1\u606F\uFF1A",
                enterpriseInfo,
                "",
                `\u5BA2\u6237\u95EE\u9898\uFF1A${q.questionText}`,
                `\u7528\u6237\u610F\u56FE\uFF1A${intentLabel}`,
                `\u8BE5\u95EE\u9898\u662F\u5426\u4E3A\u5185\u5BB9\u8986\u76D6\u8584\u5F31\u573A\u666F\uFF1A${disadvantagedLabel}`,
                "",
                "\u82E5\u300C\u5185\u5BB9\u8986\u76D6\u8584\u5F31\u573A\u666F\u300D\u4E3A\u300C\u662F\u300D\uFF0CeasyToRecommend \u539F\u5219\u4E0A\u5E94\u4E3A false\uFF0C\u9664\u975E\u6709\u660E\u786E\u516C\u5F00\u8BC1\u636E\u8868\u660E\u5185\u5BB9\u4ECD\u6613\u88AB\u5F15\u7528\u6765\u56DE\u7B54\u8BE5\u95EE\u9898\u3002",
                "",
                "\u8BF7\u5206\u6790\u5E76\u8F93\u51FA\u4EE5\u4E0B\u5B57\u6BB5\uFF08\u4EE5 JSON \u5BF9\u8C61\u7ED9\u51FA\uFF0C\u5B57\u6BB5\u540D\u4E0E Schema \u4E00\u81F4\uFF09\uFF1A",
                "- easyToMention\uFF1A\u8BE5\u4F01\u4E1A\u662F\u5426\u5BB9\u6613\u5728AI\u56DE\u7B54\u4E2D\u88AB\u63D0\u53CA\uFF08\u5E03\u5C14\uFF09",
                "- easyToRecommend\uFF1A\u8BE5\u4F01\u4E1A\u5185\u5BB9\u662F\u5426\u5BB9\u6613\u88ABAI\u5F15\u7528\u6765\u56DE\u7B54\u8FD9\u4E2A\u95EE\u9898\uFF08\u5E03\u5C14\uFF09",
                "- contentGap\uFF1A\u5F53\u524D\u5185\u5BB9\u7F3A\u53E3\uFF0C\u5177\u4F53\u6307\u51FA\u7F3A\u4EC0\u4E48\u7C7B\u578B\u7684\u5185\u5BB9\uFF082-3\u53E5\u8BDD\uFF09",
                "- suggestedTitle\uFF1A\u5EFA\u8BAE\u521B\u4F5C\u7684\u5185\u5BB9\u6807\u9898\uFF08\u5BA2\u6237\u4F1A\u4E3B\u52A8\u641C\u7D22\u7684\u6807\u9898\uFF0C\u4E0D\u542B\u54C1\u724C\u540D\uFF0C\u4E0D\u662F\u7ADE\u54C1\u5BF9\u6BD4\uFF09",
                "- coreTheses\uFF1A\u652F\u6491\u8BE5\u6807\u9898\u76842\u6761\u6838\u5FC3\u8BBA\u70B9\uFF0C\u4ECE\u5BA2\u6237\u6536\u76CA\u89D2\u5EA6\u8868\u8FBE\uFF08\u5B57\u7B26\u4E32\u6570\u7EC4\uFF0C\u957F\u5EA62\uFF09",
                "- recommendedPlatforms\uFF1A\u63A8\u8350\u53D1\u5E03\u5E73\u53F0\uFF08\u4ECE\u77E5\u4E4E/\u5C0F\u7EA2\u4E66/\u767E\u5BB6\u53F7/\u5934\u6761\u53F7/\u5FAE\u4FE1\u516C\u4F17\u53F7/\u5B98\u7F51\u4E2D\u90091-2\u4E2A\uFF09",
                "- strongestCompetitor\uFF1A\u5728\u8FD9\u4E2A\u95EE\u9898\u573A\u666F\u4E0B\uFF0C\u54EA\u7C7B\u5185\u5BB9/\u65B9\u6848\u6700\u5BB9\u6613\u88ABAI\u4F18\u5148\u5F15\u7528\uFF08\u4E0D\u4E00\u5B9A\u662F\u5177\u4F53\u54C1\u724C\uFF1B\u4E00\u53E5\u8BDD\uFF09"
              ].join("\n")
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "geo_analysis_result_v12",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  easyToMention: { type: "boolean" },
                  easyToRecommend: { type: "boolean" },
                  contentGap: { type: "string" },
                  suggestedTitle: { type: "string" },
                  coreTheses: { type: "array", minItems: 2, maxItems: 2, items: { type: "string" } },
                  recommendedPlatforms: { type: "array", minItems: 1, maxItems: 2, items: platformItemSchema },
                  strongestCompetitor: { type: "string" }
                },
                required: [
                  "easyToMention",
                  "easyToRecommend",
                  "contentGap",
                  "suggestedTitle",
                  "coreTheses",
                  "recommendedPlatforms",
                  "strongestCompetitor"
                ],
                additionalProperties: false
              }
            }
          }
        });
        const parsed = parseLLMJson(llm.choices[0]?.message.content);
        const recommendedActionType = "\u8865\u6848\u4F8B\u8BC1\u636E";
        const strong = typeof parsed.strongestCompetitor === "string" ? parsed.strongestCompetitor.trim() : "";
        const suggestedTitle = typeof parsed.suggestedTitle === "string" ? parsed.suggestedTitle.trim() : "";
        const theses = Array.isArray(parsed.coreTheses) ? parsed.coreTheses.map((x) => String(x).trim()).filter(Boolean) : [];
        const t1 = theses[0] ?? "";
        const t2 = theses[1] ?? "";
        const platforms = Array.isArray(parsed.recommendedPlatforms) ? parsed.recommendedPlatforms.map(String) : [];
        const optSuggestionLines = [
          `\u5EFA\u8BAE\u6807\u9898\uFF1A\u300A${suggestedTitle || "\uFF08\u5F85\u8865\u5145\u6807\u9898\uFF09"}\u300B`,
          `\u6838\u5FC3\u8BBA\u70B9\uFF1A\u2460${t1 || "\u2014"} \u2461${t2 || "\u2014"}`,
          `\u63A8\u8350\u53D1\u5E03\u5E73\u53F0\uFF1A${platforms.join("\u3001") || "\u5B98\u7F51"}`
        ];
        const optimizationSuggestion = optSuggestionLines.join("\n");
        const mentionsCompetitors = strong.length > 0;
        const recommendedCompetitors = strong ? [strong.slice(0, 120)] : [];
        const recommendationReason = parsed.easyToMention ? "\u63A8\u6F14\uFF1A\u5728\u5178\u578B\u4E2D\u6587 AI \u5BF9\u8BDD\u8BED\u5883\u4E0B\uFF0C\u4F01\u4E1A\u6709\u4E00\u5B9A\u6982\u7387\u88AB\u7528\u6237\u95EE\u9898\u987A\u5E26\u63D0\u53CA\u3002" : "\u63A8\u6F14\uFF1A\u5728\u516C\u5F00\u8BED\u6599\u4E0E\u54C1\u724C\u8BA4\u77E5\u6709\u9650\u65F6\uFF0C\u6A21\u578B\u8F83\u96BE\u4E3B\u52A8\u5173\u8054\u5230\u672C\u4F01\u4E1A\u3002";
        const notRecommendedReason = parsed.easyToRecommend ? "" : "\u63A8\u6F14\uFF1A\u5728\u7F3A\u4E4F\u53EF\u5F15\u7528\u7ED3\u6784\u5316\u5185\u5BB9\u6216\u7ADE\u54C1\u58F0\u91CF\u66F4\u9AD8\u65F6\uFF0C\u6A21\u578B\u66F4\u503E\u5411\u4E0D\u63A8\u8350\u6216\u4EC5\u6CDB\u5316\u56DE\u7B54\u3002";
        const semanticSummary = [suggestedTitle, t1, t2].filter(Boolean).join("\uFF1B");
        const evidenceExcerpt = [t1, t2].filter(Boolean).join("\uFF1B");
        const competitorGap = strong;
        const decisionBasis = `${parsed.contentGap ?? ""}`.slice(0, 500);
        const diagnosisMeta = deriveQuestionDiagnosisMeta({
          questionText: q.questionText,
          recommendedActionType,
          contentGap: parsed.contentGap,
          optimizationSuggestion
        });
        const userIntentDisplay = questionIntent || diagnosisMeta.userIntent;
        const legacyParsed = {
          mentionsEnterprise: parsed.easyToMention,
          recommendsEnterprise: parsed.easyToRecommend,
          mentionsCompetitors,
          recommendedCompetitors,
          enterpriseWins: parsed.easyToRecommend,
          recommendationReason,
          notRecommendedReason,
          hasMisconception: false,
          contentGap: parsed.contentGap,
          optimizationSuggestion,
          semanticSummary,
          evidenceExcerpt,
          competitorGap,
          decisionBasis,
          recommendedActionType
        };
        rows.push({
          projectId: input.projectId,
          aiResponseId: responseId,
          mentionsEnterprise: parsed.easyToMention ? 1 : 0,
          recommendsEnterprise: parsed.easyToRecommend ? 1 : 0,
          mentionsCompetitors: mentionsCompetitors ? 1 : 0,
          recommendedCompetitors,
          enterpriseWins: parsed.easyToRecommend ? 1 : 0,
          recommendationReason,
          notRecommendedReason,
          hasMisconception: 0,
          contentGap: parsed.contentGap,
          optimizationSuggestion,
          rawJson: {
            ...legacyParsed,
            syntheticDiagnosis: true,
            questionType: diagnosisMeta.questionType,
            issueType: diagnosisMeta.questionType,
            userIntent: userIntentDisplay,
            questionIntent,
            questionDisadvantaged,
            questionText: q.questionText,
            aiPlatform: "\u5176\u4ED6",
            suggestedTitle,
            coreTheses: [t1, t2].filter(Boolean),
            recommendedPlatforms: platforms,
            strongestCompetitor: strong,
            questionDiagnosis: {
              questionText: q.questionText,
              aiPlatform: "\u5176\u4ED6",
              questionType: diagnosisMeta.questionType,
              issueType: diagnosisMeta.questionType,
              userIntent: userIntentDisplay,
              semanticSummary,
              evidenceExcerpt: "",
              competitorGap,
              decisionBasis,
              recommendedActionType,
              suggestedTitle,
              coreTheses: [t1, t2].filter(Boolean),
              recommendedPlatforms: platforms,
              strongestCompetitor: strong
            }
          },
          manualOverrideJson: null,
          manuallyReviewed: 0,
          reviewedAt: null,
          reviewNote: null
        });
      }
      await db.insert(analysisResults).values(rows);
      await updateProjectStatus(input.projectId, "analysis_done");
      return { success: true, count: rows.length };
    }),
    saveManualReview: protectedProcedure.input(analysisManualReviewInput).mutation(async ({ input }) => {
      const db = await requireDb2();
      const manualOverrideJson = {
        mentionsEnterprise: input.mentionsEnterprise,
        recommendsEnterprise: input.recommendsEnterprise,
        mentionsCompetitors: input.mentionsCompetitors,
        recommendedCompetitors: input.recommendedCompetitors.map((item) => item.trim()).filter(Boolean),
        enterpriseWins: input.enterpriseWins,
        recommendationReason: input.recommendationReason.trim(),
        notRecommendedReason: input.notRecommendedReason.trim(),
        hasMisconception: input.hasMisconception,
        contentGap: input.contentGap.trim(),
        optimizationSuggestion: input.optimizationSuggestion.trim(),
        confidence: input.confidence ?? null
      };
      await db.update(analysisResults).set({
        manualOverrideJson,
        manuallyReviewed: 1,
        reviewedAt: /* @__PURE__ */ new Date(),
        reviewNote: input.reviewNote?.trim() || null
      }).where(eq4(analysisResults.id, input.id));
      return { success: true };
    }),
    undoManualReview: protectedProcedure.input(z3.object({ id: z3.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb2();
      await db.update(analysisResults).set({
        manualOverrideJson: null,
        manuallyReviewed: 0,
        reviewedAt: null,
        reviewNote: null
      }).where(eq4(analysisResults.id, input.id));
      return { success: true };
    })
  }),
  scores: router({
    latest: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb2();
      if (!input.projectId) return null;
      const candidates = await db.select().from(geoScores).where(eq4(geoScores.projectId, input.projectId)).orderBy(desc3(geoScores.createdAt), desc3(geoScores.id)).limit(3);
      const row = candidates[0] ?? null;
      const mismatched = candidates.filter((r) => r.projectId !== input.projectId);
      if (mismatched.length > 0) {
        console.error("[geo.scores.latest] projectId \u8FC7\u6EE4\u5F02\u5E38\uFF1A\u8FD4\u56DE\u884C\u4E0E\u8BF7\u6C42\u4E0D\u4E00\u81F4", {
          requestedProjectId: input.projectId,
          rows: mismatched.map((r) => ({ id: r.id, projectId: r.projectId }))
        });
      }
      console.info("[geo.scores.latest]", {
        requestedProjectId: input.projectId,
        returned: row ? {
          id: row.id,
          projectId: row.projectId,
          createdAt: row.createdAt,
          totalScore: row.totalScore
        } : null,
        sameProjectTop3: candidates.map((r) => ({
          id: r.id,
          projectId: r.projectId,
          createdAt: r.createdAt,
          totalScore: r.totalScore
        }))
      });
      return row;
    }),
    list: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb2();
      if (!input.projectId) return [];
      return db.select({
        id: geoScores.id,
        totalScore: geoScores.totalScore,
        aiVisibilityScore: geoScores.aiVisibilityScore,
        aiRecommendationScore: geoScores.aiRecommendationScore,
        createdAt: geoScores.createdAt
      }).from(geoScores).where(eq4(geoScores.projectId, input.projectId)).orderBy(asc(geoScores.createdAt));
    }),
    calculate: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb2();
      const analyses = await db.select().from(analysisResults).where(eq4(analysisResults.projectId, input.projectId));
      if (analyses.length === 0) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "\u8BF7\u5148\u5B8C\u6210 AI \u8BED\u4E49\u5206\u6790\uFF0C\u518D\u8BA1\u7B97 GEO \u8BC4\u5206" });
      }
      const score = calculateGeoScore(resolveEffectiveAnalysisResults(analyses));
      await db.delete(geoScores).where(eq4(geoScores.projectId, input.projectId));
      await db.insert(geoScores).values({ projectId: input.projectId, ...score });
      await updateProjectStatus(input.projectId, "score_done");
      return { success: true, score };
    })
  }),
  tasks: router({
    list: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb2();
      if (!input.projectId) return [];
      return db.select().from(optimizationTasks).where(eq4(optimizationTasks.projectId, input.projectId)).orderBy(desc3(optimizationTasks.createdAt));
    }),
    generate: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb2();
      const project = await getProjectOrThrow2(input.projectId);
      const analyses = await db.select().from(analysisResults).where(eq4(analysisResults.projectId, input.projectId));
      if (analyses.length === 0) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "\u8BF7\u5148\u5B8C\u6210 AI \u8BED\u4E49\u5206\u6790\uFF0C\u518D\u751F\u6210\u4F18\u5316\u4EFB\u52A1" });
      }
      const generated = await generateOptimizationTasks(project, resolveEffectiveAnalysisResults(analyses));
      await db.delete(optimizationTasks).where(eq4(optimizationTasks.projectId, input.projectId));
      await db.insert(optimizationTasks).values(generated.map((task) => ({ ...task, projectId: input.projectId })));
      await updateProjectStatus(input.projectId, "tasks_ready");
      return { success: true, count: generated.length };
    }),
    updateStatus: protectedProcedure.input(z3.object({
      id: z3.number().int().positive(),
      status: z3.enum(taskStatuses),
      publishedUrl: z3.string().optional().nullable(),
      needRetest: z3.boolean().optional().default(false)
    })).mutation(async ({ input }) => {
      const db = await requireDb2();
      await db.update(optimizationTasks).set({
        status: input.status,
        publishedUrl: input.status === "done" ? input.publishedUrl ?? null : null,
        needRetest: input.status === "done" && input.needRetest ? 1 : 0,
        completedAt: input.status === "done" ? /* @__PURE__ */ new Date() : null
      }).where(eq4(optimizationTasks.id, input.id));
      return { success: true };
    })
  }),
  templates: router({
    list: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb2();
      if (!input.projectId) return [];
      return db.select().from(contentTemplates).where(eq4(contentTemplates.projectId, input.projectId)).orderBy(desc3(contentTemplates.createdAt));
    }),
    generate: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb2();
      const project = await getProjectOrThrow2(input.projectId);
      const tasks = await db.select().from(optimizationTasks).where(eq4(optimizationTasks.projectId, input.projectId));
      if (tasks.length === 0) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "\u8BF7\u5148\u751F\u6210\u4F18\u5316\u4EFB\u52A1\uFF0C\u518D\u751F\u6210\u5185\u5BB9\u6A21\u677F" });
      }
      const generated = generateContentTemplates(project, tasks.map((task) => ({ id: task.id, taskType: task.taskType, taskName: task.taskName, generationReason: task.generationReason, executionSuggestion: task.executionSuggestion })));
      await db.delete(contentTemplates).where(eq4(contentTemplates.projectId, input.projectId));
      await db.insert(contentTemplates).values(generated.map((item) => ({ ...item, projectId: input.projectId, templateType: item.templateType })));
      await updateProjectStatus(input.projectId, "report_ready");
      return { success: true, count: generated.length };
    })
  }),
  reports: router({
    latest: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb2();
      if (!input.projectId) return null;
      const result = await db.select().from(reports).where(eq4(reports.projectId, input.projectId)).orderBy(desc3(reports.createdAt)).limit(1);
      return result[0] ?? null;
    }),
    generate: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb2();
      const project = await getProjectOrThrow2(input.projectId);
      const analyses = await db.select().from(analysisResults).where(eq4(analysisResults.projectId, input.projectId));
      const effectiveAnalyses = resolveEffectiveAnalysisResults(analyses);
      if (analyses.length === 0) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "\u8BF7\u5148\u5B8C\u6210 AI \u8BED\u4E49\u5206\u6790\uFF0C\u518D\u751F\u6210\u8BCA\u65AD\u62A5\u544A" });
      }
      const rawScore = calculateGeoScore(analyses);
      const latestScore = await db.select().from(geoScores).where(eq4(geoScores.projectId, input.projectId)).orderBy(desc3(geoScores.createdAt)).limit(1);
      if (!latestScore[0]) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "\u8BF7\u5148\u8BA1\u7B97 GEO \u8BC4\u5206\uFF0C\u518D\u751F\u6210\u8BCA\u65AD\u62A5\u544A" });
      }
      const responses = await db.select().from(aiResponses).where(eq4(aiResponses.projectId, input.projectId));
      const projectQuestions = await db.select().from(questions).where(eq4(questions.projectId, input.projectId));
      const questionStats = {
        totalQuestions: projectQuestions.length,
        aiGeneratedQuestions: projectQuestions.filter((question) => question.source === "ai_generated").length,
        specifiedQuestions: projectQuestions.filter((question) => question.source === "manual" || question.source === "csv").length
      };
      const analysesWithQuestions = attachQuestionTextToAnalyses(effectiveAnalyses, responses, projectQuestions);
      const report = generateReportMarkdown(project, {
        aiVisibilityScore: latestScore[0].aiVisibilityScore,
        aiRecommendationScore: latestScore[0].aiRecommendationScore,
        competitorWinScore: latestScore[0].competitorWinScore,
        cognitionAccuracyScore: latestScore[0].cognitionAccuracyScore,
        contentAssetScore: latestScore[0].contentAssetScore,
        totalScore: latestScore[0].totalScore,
        visibilityLevel: latestScore[0].visibilityLevel
      }, analysesWithQuestions, questionStats, rawScore);
      await db.delete(reports).where(eq4(reports.projectId, input.projectId));
      await db.insert(reports).values({ projectId: input.projectId, geoScoreId: latestScore[0].id, ...report });
      await updateProjectStatus(input.projectId, "report_ready");
      return { success: true, report };
    })
  }),
  contentPlans: router({
    list: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb2();
      if (!input.projectId) return [];
      await getProjectOrThrow2(input.projectId);
      return db.select().from(contentPlans).where(eq4(contentPlans.projectId, input.projectId)).orderBy(desc3(contentPlans.createdAt));
    }),
    latest: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb2();
      if (!input.projectId) {
        return {
          plan: null,
          items: [],
          planName: null,
          startDate: null,
          targetPlatforms: [],
          contentTypes: [],
          weeklyArticleCount: null,
          status: null,
          linkedOptimizationTaskIds: []
        };
      }
      await getProjectOrThrow2(input.projectId);
      const plans = await db.select().from(contentPlans).where(eq4(contentPlans.projectId, input.projectId)).orderBy(desc3(contentPlans.createdAt)).limit(1);
      const plan = plans[0] ?? null;
      if (!plan) {
        return {
          plan: null,
          items: [],
          planName: null,
          startDate: null,
          targetPlatforms: [],
          contentTypes: [],
          weeklyArticleCount: null,
          status: null,
          linkedOptimizationTaskIds: []
        };
      }
      const items = await db.select().from(contentPlanItems).where(eq4(contentPlanItems.planId, plan.id)).orderBy(desc3(contentPlanItems.createdAt));
      return {
        plan,
        items,
        planName: plan.planName,
        startDate: plan.weekStartDate,
        targetPlatforms: plan.targetPlatforms,
        contentTypes: plan.contentTypes,
        weeklyArticleCount: plan.weeklyArticleCount,
        status: plan.status,
        linkedOptimizationTaskIds: plan.linkedOptimizationTaskIds
      };
    }),
    upsert: protectedProcedure.input(contentPlanInput).mutation(async ({ input }) => {
      const db = await requireDb2();
      await getProjectOrThrow2(input.projectId);
      const selectedTasks = await db.select().from(optimizationTasks).where(eq4(optimizationTasks.projectId, input.projectId));
      const validTaskIds = new Set(selectedTasks.map((task) => task.id));
      const linkedOptimizationTaskIds = input.linkedOptimizationTaskIds.filter((taskId) => validTaskIds.has(taskId));
      if (linkedOptimizationTaskIds.length === 0) {
        throw new TRPCError5({
          code: "BAD_REQUEST",
          message: "\u8BF7\u81F3\u5C11\u7ED1\u5B9A\u4E00\u4E2A\u5C5E\u4E8E\u5F53\u524D\u9879\u76EE\u7684\u4F18\u5316\u4EFB\u52A1\uFF08\u5DF2\u81EA\u52A8\u5FFD\u7565\u65E0\u6548\u6216\u8DE8\u9879\u76EE\u7684\u4EFB\u52A1 ID\uFF09\u3002"
        });
      }
      const values = {
        projectId: input.projectId,
        planName: input.planName.trim(),
        weekStartDate: input.weekStartDate,
        weeklyArticleCount: input.weeklyArticleCount,
        targetPlatforms: input.targetPlatforms,
        contentTypes: input.contentTypes,
        linkedOptimizationTaskIds,
        status: input.status
      };
      if (input.id) {
        const existing = await db.select().from(contentPlans).where(eq4(contentPlans.id, input.id)).limit(1);
        if (!existing[0] || existing[0].projectId !== input.projectId) {
          throw new TRPCError5({ code: "NOT_FOUND", message: "\u5185\u5BB9\u751F\u4EA7\u8BA1\u5212\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u9879\u76EE" });
        }
        await db.update(contentPlans).set(values).where(eq4(contentPlans.id, input.id));
        return { success: true, planId: input.id };
      }
      const inserted = await db.insert(contentPlans).values(values).$returningId();
      return { success: true, planId: inserted[0]?.id ?? 0 };
    }),
    addItem: protectedProcedure.input(contentPlanItemInput).mutation(async ({ input }) => {
      const db = await requireDb2();
      await getProjectOrThrow2(input.projectId);
      const planRows = await db.select().from(contentPlans).where(eq4(contentPlans.id, input.planId)).limit(1);
      const plan = planRows[0];
      if (!plan || plan.projectId !== input.projectId) {
        throw new TRPCError5({ code: "NOT_FOUND", message: "\u5185\u5BB9\u751F\u4EA7\u8BA1\u5212\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u9879\u76EE" });
      }
      if (input.topicId) {
        const topicRows = await db.select().from(geoArticleTopics).where(eq4(geoArticleTopics.id, input.topicId)).limit(1);
        if (!topicRows[0] || topicRows[0].projectId !== input.projectId) throw new TRPCError5({ code: "BAD_REQUEST", message: "\u5185\u5BB9\u9009\u9898\u4E0D\u5C5E\u4E8E\u5F53\u524D\u9879\u76EE" });
      }
      if (input.articleId) {
        const articleRows = await db.select().from(geoArticles).where(eq4(geoArticles.id, input.articleId)).limit(1);
        if (!articleRows[0] || articleRows[0].projectId !== input.projectId) throw new TRPCError5({ code: "BAD_REQUEST", message: "\u6587\u7AE0\u4E0D\u5C5E\u4E8E\u5F53\u524D\u9879\u76EE" });
      }
      const inserted = await db.insert(contentPlanItems).values({
        planId: input.planId,
        topicId: input.topicId ?? null,
        articleId: input.articleId ?? null,
        targetPlatform: input.targetPlatform,
        contentType: input.contentType,
        status: input.status,
        differentiationAngle: input.differentiationAngle ?? null,
        duplicateRisk: input.duplicateRisk ?? null
      }).$returningId();
      return { success: true, itemId: inserted[0]?.id ?? 0 };
    })
  }),
  articles: router({
    topics: router({
      list: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive().optional() })).query(async ({ input }) => {
        const db = await requireDb2();
        if (!input.projectId) return [];
        return db.select().from(geoArticleTopics).where(eq4(geoArticleTopics.projectId, input.projectId)).orderBy(desc3(geoArticleTopics.createdAt));
      }),
      generate: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive() })).mutation(async ({ input }) => {
        const db = await requireDb2();
        const project = await getProjectOrThrow2(input.projectId);
        const tasks = await db.select().from(optimizationTasks).where(eq4(optimizationTasks.projectId, input.projectId));
        const generated = generateGeoArticleTopics({
          project,
          tasks: tasks.map((t2) => ({
            id: t2.id,
            taskType: t2.taskType,
            taskName: t2.taskName,
            priority: t2.priority,
            generationReason: t2.generationReason,
            executionSuggestion: t2.executionSuggestion,
            expectedImpact: t2.expectedImpact,
            status: t2.status
          }))
        });
        await db.delete(geoArticleTopics).where(eq4(geoArticleTopics.projectId, input.projectId));
        await db.insert(geoArticleTopics).values(generated.map((topic) => ({ ...topic, articleType: topic.articleType, status: topic.status })));
        return { success: true, count: generated.length, topics: generated };
      })
    }),
    list: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb2();
      if (!input.projectId) return [];
      const rows = await db.select().from(geoArticles).where(and2(eq4(geoArticles.projectId, input.projectId), not(like(geoArticles.title, "%\u5982\u4F55\u56DE\u7B54%")))).orderBy(desc3(geoArticles.createdAt));
      const uniqueRows = Array.from(new Map(rows.map((r) => [r.id, r])).values());
      const taskIds = Array.from(new Set(uniqueRows.map((row) => row.optimizationTaskId).filter((id) => typeof id === "number" && id > 0)));
      const tasks = taskIds.length ? await db.select().from(optimizationTasks).where(and2(eq4(optimizationTasks.projectId, input.projectId), inArray(optimizationTasks.id, taskIds))) : [];
      const taskById = new Map(tasks.map((task) => [task.id, task]));
      return uniqueRows.map((article) => {
        const task = article.optimizationTaskId ? taskById.get(article.optimizationTaskId) : void 0;
        const card = task ? parseOptimizationTaskCard(task.executionSuggestion) : null;
        const targetPlatform = card?.recommendedPlatform?.length ? card.recommendedPlatform.join("\u3001") : "";
        const contentType = card?.contentType && card.contentType.trim() || article.articleType;
        return { ...article, targetPlatform: targetPlatform || null, contentType };
      });
    }),
    latestQualityScores: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb2();
      if (!input.projectId) return [];
      const rows = await db.select().from(geoArticleQualityScores).where(eq4(geoArticleQualityScores.projectId, input.projectId)).orderBy(desc3(geoArticleQualityScores.createdAt));
      const hasComplianceBlock = (reasons) => reasons.some((reason) => /禁用词|禁止承诺|合规/.test(reason));
      return rows.map((row) => {
        const blockReasons = Array.isArray(row.blockReasons) ? row.blockReasons : [];
        const isPass = row.totalScore >= 60 && !hasComplianceBlock(blockReasons);
        return { ...row, isPass };
      });
    }),
    publishRecords: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb2();
      if (!input.projectId) return [];
      return db.select().from(geoPublishRecords).where(eq4(geoPublishRecords.projectId, input.projectId)).orderBy(desc3(geoPublishRecords.publishedAt));
    }),
    createManualPublishRecord: protectedProcedure.input(manualPublishRecordInput).mutation(async ({ input }) => {
      const db = await requireDb2();
      await getProjectOrThrow2(input.projectId);
      const articleRows = await db.select().from(geoArticles).where(eq4(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article || article.projectId !== input.projectId) {
        throw new TRPCError5({ code: "NOT_FOUND", message: "\u672A\u627E\u5230\u5C5E\u4E8E\u5F53\u524D\u9879\u76EE\u7684\u5185\u5BB9" });
      }
      const scoreRows = await db.select().from(geoArticleQualityScores).where(eq4(geoArticleQualityScores.articleId, article.id)).orderBy(desc3(geoArticleQualityScores.createdAt)).limit(1);
      const latestScore = scoreRows[0];
      if (!latestScore || latestScore.blocked || latestScore.totalScore < GEO_ARTICLE_MIN_PASS_SCORE) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: `\u53EA\u6709\u5DF2\u901A\u8FC7 GEO \u8D28\u68C0\u4E14\u8D28\u91CF\u5206\u4E0D\u4F4E\u4E8E ${GEO_ARTICLE_MIN_PASS_SCORE} \u7684\u5185\u5BB9\u624D\u80FD\u8BB0\u5F55\u4EBA\u5DE5\u53D1\u5E03\u7ED3\u679C` });
      }
      const publishedAt = new Date(input.publishedAt);
      if (Number.isNaN(publishedAt.getTime())) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "\u53D1\u5E03\u65F6\u95F4\u683C\u5F0F\u4E0D\u6B63\u786E" });
      }
      const inserted = await db.insert(geoPublishRecords).values({
        projectId: input.projectId,
        articleId: article.id,
        optimizationTaskId: article.optimizationTaskId,
        publishChannel: input.publishPlatform,
        publishTitle: input.publishTitle,
        publishUrl: input.publishUrl.trim(),
        publishStatus: input.publishStatus,
        qualityScore: latestScore.totalScore,
        needRetest: input.publishStatus === "published" || input.publishStatus === "link_backfilled" ? 1 : 0,
        notes: [
          "V1.0 \u4EBA\u5DE5\u786E\u8BA4\u53D1\u5E03\u8BB0\u5F55\uFF1A\u672C\u7CFB\u7EDF\u53EA\u8BB0\u5F55\u4EBA\u5DE5\u53D1\u5E03\u7ED3\u679C\u548C\u516C\u5F00\u94FE\u63A5\uFF0C\u4E0D\u8C03\u7528\u5916\u90E8\u5E73\u53F0 API\uFF0C\u4E0D\u521B\u5EFA\u6536\u5F55\u76D1\u6D4B\u8BB0\u5F55\u3002",
          input.notes.trim()
        ].filter(Boolean).join("\n"),
        publishedAt
      }).$returningId();
      return { success: true, id: inserted[0]?.id ?? 0 };
    }),
    updateManualPublishRecord: protectedProcedure.input(manualPublishRecordInput.extend({ id: z3.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb2();
      await getProjectOrThrow2(input.projectId);
      const recordRows = await db.select().from(geoPublishRecords).where(eq4(geoPublishRecords.id, input.id)).limit(1);
      const record = recordRows[0];
      if (!record || record.projectId !== input.projectId || record.articleId !== input.articleId) {
        throw new TRPCError5({ code: "NOT_FOUND", message: "\u672A\u627E\u5230\u5C5E\u4E8E\u5F53\u524D\u9879\u76EE\u548C\u5185\u5BB9\u7684\u53D1\u5E03\u8BB0\u5F55" });
      }
      const articleRows = await db.select().from(geoArticles).where(eq4(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article || article.projectId !== input.projectId) {
        throw new TRPCError5({ code: "NOT_FOUND", message: "\u672A\u627E\u5230\u5C5E\u4E8E\u5F53\u524D\u9879\u76EE\u7684\u5185\u5BB9" });
      }
      const publishedAt = new Date(input.publishedAt);
      if (Number.isNaN(publishedAt.getTime())) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "\u53D1\u5E03\u65F6\u95F4\u683C\u5F0F\u4E0D\u6B63\u786E" });
      }
      await db.update(geoPublishRecords).set({
        publishChannel: input.publishPlatform,
        publishTitle: input.publishTitle,
        publishUrl: input.publishUrl.trim(),
        publishStatus: input.publishStatus,
        needRetest: input.publishStatus === "published" || input.publishStatus === "link_backfilled" ? 1 : 0,
        notes: [
          "V1.0 \u4EBA\u5DE5\u786E\u8BA4\u53D1\u5E03\u8BB0\u5F55\uFF1A\u672C\u7CFB\u7EDF\u53EA\u8BB0\u5F55\u4EBA\u5DE5\u53D1\u5E03\u7ED3\u679C\u548C\u516C\u5F00\u94FE\u63A5\uFF0C\u4E0D\u8C03\u7528\u5916\u90E8\u5E73\u53F0 API\uFF0C\u4E0D\u521B\u5EFA\u6536\u5F55\u76D1\u6D4B\u8BB0\u5F55\u3002",
          input.notes.trim()
        ].filter(Boolean).join("\n"),
        publishedAt
      }).where(eq4(geoPublishRecords.id, input.id));
      return { success: true, id: input.id };
    }),
    inclusionMonitoringRecords: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb2();
      if (!input.projectId) return [];
      return db.select().from(geoInclusionMonitoringRecords).where(eq4(geoInclusionMonitoringRecords.projectId, input.projectId)).orderBy(desc3(geoInclusionMonitoringRecords.createdAt));
    }),
    generate: protectedProcedure.input(z3.object({ topicId: z3.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb2();
      const topicRows = await db.select().from(geoArticleTopics).where(eq4(geoArticleTopics.id, input.topicId)).limit(1);
      const topic = topicRows[0];
      if (!topic) throw new TRPCError5({ code: "NOT_FOUND", message: "\u6587\u7AE0\u9009\u9898\u4E0D\u5B58\u5728" });
      const project = await getProjectOrThrow2(topic.projectId);
      const taskRows = topic.optimizationTaskId ? await db.select().from(optimizationTasks).where(eq4(optimizationTasks.id, topic.optimizationTaskId)).limit(1) : [];
      const task = taskRows[0];
      if (!task) throw new TRPCError5({ code: "BAD_REQUEST", message: "\u6587\u7AE0\u9009\u9898\u5FC5\u987B\u7ED1\u5B9A\u4F18\u5316\u4EFB\u52A1\uFF0C\u4E0D\u80FD\u751F\u6210\u65E0\u6765\u6E90\u6587\u7AE0" });
      const projectQuestions = await db.select().from(questions).where(eq4(questions.projectId, topic.projectId));
      const analyses = await db.select().from(analysisResults).where(eq4(analysisResults.projectId, topic.projectId));
      const responses = await db.select().from(aiResponses).where(eq4(aiResponses.projectId, topic.projectId));
      const sourceQuestionIds = Array.isArray(topic.sourceQuestionIds) ? topic.sourceQuestionIds : [];
      const sourceAnalysisIds = Array.isArray(topic.sourceAnalysisIds) ? topic.sourceAnalysisIds : [];
      const questionScope = projectQuestions.filter((question) => sourceQuestionIds.includes(question.id));
      const analysesWithQuestions = attachQuestionTextToAnalyses(resolveEffectiveAnalysisResults(analyses), responses, projectQuestions);
      const analysisScope = analysesWithQuestions.filter((analysis) => sourceAnalysisIds.includes(analysis.id));
      const assetLibrary = await getAssetLibraryContext2(topic.projectId);
      let draft;
      try {
        draft = await generateGeoArticleDraft({
          project,
          topic: { ...topic, id: topic.id, articleType: topic.articleType, optimizationTaskId: task.id },
          task,
          questions: questionScope.length > 0 ? questionScope : projectQuestions,
          analyses: analysisScope.length > 0 ? analysisScope : analysesWithQuestions,
          assetLibrary
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "GEO \u6587\u7AE0\u751F\u6210\u5931\u8D25";
        throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message });
      }
      const inserted = await db.insert(geoArticles).values(draft).$returningId();
      const articleId = inserted[0]?.id ?? 0;
      if (!articleId) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "\u6587\u7AE0\u5199\u5165\u5931\u8D25" });
      await db.update(geoArticleTopics).set({ status: "\u5DF2\u751F\u6210" }).where(eq4(geoArticleTopics.id, topic.id));
      const qcResult = await runGeoArticleQualityCheckFlow(db, articleId);
      return {
        success: true,
        articleId,
        quality: qcResult.quality,
        autoRewriteCount: qcResult.autoRewriteCount,
        finalStatus: qcResult.finalStatus,
        qualityCheckPassed: qcResult.finalStatus === "\u8D28\u68C0\u901A\u8FC7"
      };
    }),
    qualityCheck: protectedProcedure.input(z3.object({ articleId: z3.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb2();
      const articleRows = await db.select().from(geoArticles).where(eq4(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article) throw new TRPCError5({ code: "NOT_FOUND", message: "\u6587\u7AE0\u4E0D\u5B58\u5728" });
      if (!(article.status === "\u5DF2\u751F\u6210" || article.status === "\u5F85\u8D28\u68C0" || article.status === "\u9700\u4EBA\u5DE5\u5BA1\u6838" || article.status === "\u8D28\u68C0\u672A\u901A\u8FC7")) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "\u5F53\u524D\u72B6\u6001\u7684\u6587\u7AE0\u4E0D\u80FD\u91CD\u65B0\u6267\u884C\u8D28\u91CF\u8BC4\u5206" });
      }
      const qcResult = await runGeoArticleQualityCheckFlow(db, input.articleId);
      return {
        success: qcResult.success,
        quality: qcResult.quality,
        autoRewriteCount: qcResult.autoRewriteCount,
        finalStatus: qcResult.finalStatus
      };
    }),
    optimizeVersion: protectedProcedure.input(z3.object({ articleId: z3.number().int().positive(), mode: z3.enum(["\u589E\u5F3A\u7248", "FAQ", "\u7ADE\u54C1\u5BF9\u6BD4", "AI \u53EF\u5F15\u7528\u7247\u6BB5", "\u79FB\u9664\u65E0\u6765\u6E90\u6570\u636E", "\u8D44\u6599\u5F85\u8865\u5145\u8868\u8FF0", "\u6848\u4F8B\u91C7\u96C6\u6A21\u677F"]), reason: z3.string().optional().default("") })).mutation(async ({ input }) => {
      const db = await requireDb2();
      const articleRows = await db.select().from(geoArticles).where(eq4(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article) throw new TRPCError5({ code: "NOT_FOUND", message: "\u6587\u7AE0\u4E0D\u5B58\u5728" });
      const project = await getProjectOrThrow2(article.projectId);
      const projectQuestions = await db.select().from(questions).where(eq4(questions.projectId, article.projectId));
      const analyses = await db.select().from(analysisResults).where(eq4(analysisResults.projectId, article.projectId));
      const responses = await db.select().from(aiResponses).where(eq4(aiResponses.projectId, article.projectId));
      const analysesWithQuestions = attachQuestionTextToAnalyses(resolveEffectiveAnalysisResults(analyses), responses, projectQuestions);
      const taskRows = article.optimizationTaskId ? await db.select().from(optimizationTasks).where(eq4(optimizationTasks.id, article.optimizationTaskId)).limit(1) : [];
      const assetLibrary = await getAssetLibraryContext2(article.projectId);
      const currentQuality = scoreGeoArticleQuality({
        article,
        project,
        questions: projectQuestions,
        analyses: analysesWithQuestions,
        task: taskRows[0] ?? null,
        assetLibrary
      });
      const optimized = buildOptimizedArticleVersion({ article, quality: currentQuality, mode: input.mode, reason: input.reason });
      const nextQuality = scoreGeoArticleQuality({
        article: { ...article, markdownContent: optimized.markdownContent },
        project,
        questions: projectQuestions,
        analyses: analysesWithQuestions,
        task: taskRows[0] ?? null,
        assetLibrary
      });
      await db.update(geoArticles).set({
        markdownContent: optimized.markdownContent,
        optimizationVersions: optimized.versions,
        factTraceability: nextQuality.factTraceability,
        consistencyCheck: nextQuality.consistencyCheck,
        status: "\u5F85\u8D28\u68C0"
      }).where(eq4(geoArticles.id, article.id));
      return { success: true, versionCount: optimized.versions.length, quality: nextQuality };
    }),
    audit: protectedProcedure.input(z3.object({ articleId: z3.number().int().positive(), approved: z3.boolean(), note: z3.string().optional().default("") })).mutation(async ({ input }) => {
      const db = await requireDb2();
      const articleRows = await db.select().from(geoArticles).where(eq4(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article) throw new TRPCError5({ code: "NOT_FOUND", message: "\u6587\u7AE0\u4E0D\u5B58\u5728" });
      const scoreRows = await db.select().from(geoArticleQualityScores).where(eq4(geoArticleQualityScores.articleId, article.id)).orderBy(desc3(geoArticleQualityScores.createdAt)).limit(1);
      const latestScore = scoreRows[0];
      const consistency = article.consistencyCheck;
      const canAudit = canAuditArticle(article.status, latestScore ? { totalScore: latestScore.totalScore, blocked: Boolean(latestScore.blocked) } : null);
      if (!canAudit || consistency?.publishAllowed === false || (consistency?.score ?? 100) < GEO_ARTICLE_MIN_PASS_SCORE || consistency?.riskLevel === "\u9AD8") throw new TRPCError5({ code: "BAD_REQUEST", message: `\u672A\u8D28\u68C0\u901A\u8FC7\u3001\u4F4E\u4E8E ${GEO_ARTICLE_MIN_PASS_SCORE} \u5206\u6216\u4E00\u81F4\u6027\u68C0\u67E5\u672A\u901A\u8FC7\u7684\u6587\u7AE0\u4E0D\u80FD\u5BA1\u6838` });
      await db.update(geoArticles).set({ status: input.approved ? "\u5BA1\u6838\u901A\u8FC7" : "\u5BA1\u6838\u672A\u901A\u8FC7" }).where(eq4(geoArticles.id, article.id));
      return { success: true };
    }),
    publish: protectedProcedure.input(z3.object({ articleId: z3.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb2();
      const articleRows = await db.select().from(geoArticles).where(eq4(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article) throw new TRPCError5({ code: "NOT_FOUND", message: "\u6587\u7AE0\u4E0D\u5B58\u5728" });
      if (!canPublishArticle(article.status)) throw new TRPCError5({ code: "BAD_REQUEST", message: "\u672A\u5BA1\u6838\u901A\u8FC7\u7684\u6587\u7AE0\u4E0D\u80FD\u53D1\u5E03" });
      const scoreRows = await db.select().from(geoArticleQualityScores).where(eq4(geoArticleQualityScores.articleId, article.id)).orderBy(desc3(geoArticleQualityScores.createdAt)).limit(1);
      const latestScore = scoreRows[0];
      if (!latestScore || latestScore.blocked || latestScore.totalScore < GEO_ARTICLE_MIN_PASS_SCORE) throw new TRPCError5({ code: "BAD_REQUEST", message: `\u6587\u7AE0\u8D28\u91CF\u5206\u4F4E\u4E8E ${GEO_ARTICLE_MIN_PASS_SCORE} \u6216\u5B58\u5728\u7981\u6B62\u53D1\u5E03\u98CE\u9669\uFF0C\u4E0D\u80FD\u53D1\u5E03` });
      const assetLibrary = await getAssetLibraryContext2(article.projectId);
      const prePublishCheck = evaluateAssetLibraryPrePublishCheck({
        content: `${article.title}
${article.markdownContent}`,
        project: await getProjectOrThrow2(article.projectId),
        basis: article.generationBasis,
        assetLibrary
      });
      if (prePublishCheck.blocked) throw new TRPCError5({ code: "BAD_REQUEST", message: prePublishCheck.summary });
      const publicPath = `/geo/content/${article.projectId}/${article.id}`;
      await db.update(geoArticles).set({ status: "\u5DF2\u53D1\u5E03", publicPath }).where(eq4(geoArticles.id, article.id));
      if (article.optimizationTaskId) {
        await db.update(optimizationTasks).set({ status: "retest", publishedUrl: publicPath, needRetest: 1 }).where(eq4(optimizationTasks.id, article.optimizationTaskId));
      }
      const insertResult = await db.insert(geoPublishRecords).values({
        projectId: article.projectId,
        articleId: article.id,
        optimizationTaskId: article.optimizationTaskId,
        publishChannel: "\u7CFB\u7EDF\u5185\u7F6E GEO \u5185\u5BB9\u9875",
        publishUrl: publicPath,
        publishStatus: "\u5DF2\u53D1\u5E03",
        qualityScore: latestScore.totalScore,
        needRetest: 1,
        notes: "\u4EBA\u5DE5\u5BA1\u6838\u901A\u8FC7\u540E\u53D1\u5E03\u5230\u7CFB\u7EDF\u5185\u7F6E GEO \u5185\u5BB9\u9875\uFF0C\u7B49\u5F85\u590D\u6D4B\u3002"
      });
      const publishRecordId = Number(insertResult.insertId ?? 0);
      const latestPublishRows = publishRecordId > 0 ? [] : await db.select().from(geoPublishRecords).where(eq4(geoPublishRecords.articleId, article.id)).orderBy(desc3(geoPublishRecords.createdAt)).limit(1);
      const resolvedPublishRecordId = publishRecordId > 0 ? publishRecordId : latestPublishRows[0]?.id;
      if (!resolvedPublishRecordId) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "\u53D1\u5E03\u8BB0\u5F55\u521B\u5EFA\u5931\u8D25\uFF0C\u65E0\u6CD5\u8FDB\u5165\u6536\u5F55\u76D1\u6D4B" });
      await db.insert(geoInclusionMonitoringRecords).values(buildInitialInclusionMonitoringRecord({
        projectId: article.projectId,
        articleId: article.id,
        publishRecordId: resolvedPublishRecordId,
        publicUrl: publicPath,
        qualityScore: latestScore.totalScore
      }));
      return { success: true, publicPath };
    }),
    publicContent: publicProcedure.input(z3.object({ projectId: z3.number().int().positive(), articleId: z3.number().int().positive() })).query(async ({ input }) => {
      const db = await requireDb2();
      const articleRows = await db.select().from(geoArticles).where(eq4(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article || article.projectId !== input.projectId || !(article.status === "\u5DF2\u53D1\u5E03" || article.status === "\u5F85\u590D\u6D4B")) {
        throw new TRPCError5({ code: "NOT_FOUND", message: "\u5185\u5BB9\u4E0D\u5B58\u5728\u6216\u5C1A\u672A\u53D1\u5E03" });
      }
      const project = await getProjectOrThrow2(article.projectId);
      const profileRows = await db.select().from(enterpriseGeoProfiles).where(eq4(enterpriseGeoProfiles.projectId, article.projectId)).limit(1);
      const prof = profileRows[0];
      const projectForPublic = prof ? {
        ...project,
        brandName: prof.brandName ?? void 0,
        targetCustomer: prof.targetCustomer ?? void 0,
        productDesc: prof.productDesc ?? void 0,
        productServiceIntro: prof.productServiceIntro ?? void 0,
        oneLiner: prof.oneLiner ?? void 0
      } : project;
      const scoreRows = await db.select().from(geoArticleQualityScores).where(eq4(geoArticleQualityScores.articleId, article.id)).orderBy(desc3(geoArticleQualityScores.createdAt)).limit(1);
      return { article, project: projectForPublic, qualityScore: scoreRows[0] ?? null };
    })
  })
});
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    devLogin: publicProcedure.mutation(async ({ ctx }) => {
      if (process.env.NODE_ENV === "production") {
        throw new TRPCError5({ code: "FORBIDDEN", message: "\u672C\u5730\u5F00\u53D1\u767B\u5F55\u4E0D\u80FD\u5728\u751F\u4EA7\u73AF\u5883\u4F7F\u7528" });
      }
      const openId = "local-dev-user";
      const name = "\u672C\u5730\u5F00\u53D1\u7528\u6237";
      await upsertUser({
        openId,
        name,
        email: "local-dev@example.invalid",
        loginMethod: "local-dev",
        role: "admin",
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.signSession({
        openId,
        appId: process.env.VITE_APP_ID || "local-dev",
        name
      }, { expiresInMs: ONE_YEAR_MS });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return { success: true };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  geo: geoRouter,
  publishTasks: publishTasksRouter
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
var plugins = [react(), tailwindcss(), jsxLocPlugin()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
