import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
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
  "审核未通过",
]);

export const publishChannelEnum = mysqlEnum("publishChannel", ["系统内置 GEO 内容页"]);

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
  status: articleStatusEnum.default("待质检").notNull(),
  publicPath: varchar("publicPath", { length: 1000 }),
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
  publishUrl: varchar("publishUrl", { length: 1000 }).notNull(),
  publishStatus: varchar("publishStatus", { length: 64 }).default("已发布").notNull(),
  qualityScore: int("qualityScore").default(0).notNull(),
  needRetest: int("needRetest").default(1).notNull(),
  notes: text("notes"),
  publishedAt: timestamp("publishedAt").defaultNow().notNull(),
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
export type GeoArticleQualityScore = typeof geoArticleQualityScores.$inferSelect;
export type InsertGeoArticleQualityScore = typeof geoArticleQualityScores.$inferInsert;
export type GeoPublishRecord = typeof geoPublishRecords.$inferSelect;
export type InsertGeoPublishRecord = typeof geoPublishRecords.$inferInsert;
