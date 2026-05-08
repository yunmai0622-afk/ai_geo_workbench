import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  aiResponses,
  analysisResults,
  contentTemplates,
  geoArticleQualityScores,
  geoArticleTopics,
  geoArticles,
  geoPublishRecords,
  geoScores,
  optimizationTasks,
  projects,
  questions,
  reports,
} from "../drizzle/schema";
import {
  aiPlatforms,
  generatedQuestionTypes,
  attachQuestionTextToAnalyses,
  calculateGeoScore,
  generateContentTemplates,
  generateOptimizationTasks,
  generateReportMarkdown,
  resolveEffectiveAnalysisResult,
  resolveEffectiveAnalysisResults,
  projectStatuses,
  questionSources,
  questionTypes,
  taskStatuses,
  taskTypes,
  templateTypes,
} from "./geoLogic";
import {
  articleTypes,
  canAuditArticle,
  canPublishArticle,
  generateGeoArticleDraft,
  generateGeoArticleTopics,
  scoreGeoArticleQuality,
  type ArticleStatus,
} from "./geoArticleLogic";

const projectInput = z.object({
  enterpriseName: z.string().min(1, "请输入企业名称"),
  industry: z.string().min(1, "请输入行业"),
  website: z.string().min(1, "请输入官网"),
  region: z.string().min(1, "请输入地区"),
  productIntro: z.string().min(1, "请输入产品介绍"),
  targetCustomers: z.string().min(1, "请输入目标客户"),
  coreSellingPoints: z.string().min(1, "请输入核心卖点"),
  competitorNames: z.array(z.string()).default([]),
  coreKeywords: z.array(z.string()).default([]),
});

const questionInput = z.object({
  projectId: z.number().int().positive(),
  questionText: z.string().min(1, "请输入问题"),
  questionType: z.enum(questionTypes),
  targetKeyword: z.string().optional().nullable(),
  intentLevel: z.string().optional().default("高"),
  businessValue: z.number().int().min(1).max(5).optional().default(5),
  source: z.enum(questionSources).optional().default("manual"),
  enabled: z.boolean().default(true),
});

const manualQuestionImportRow = z.object({
  questionText: z.string().min(1, "请输入问题"),
  questionType: z.enum(questionTypes).optional().default("指定问题"),
  targetKeyword: z.string().optional().nullable(),
  intentLevel: z.string().optional().default("高"),
  businessValue: z.number().int().min(1).max(5).optional().default(5),
});

type ManualQuestionImportRow = {
  questionText: string;
  questionType?: (typeof questionTypes)[number];
  targetKeyword?: string | null;
  intentLevel?: string;
  businessValue?: number;
};

const aiResponseInput = z.object({
  projectId: z.number().int().positive(),
  questionId: z.number().int().positive().optional().nullable(),
  questionText: z.string().min(1, "请输入问题"),
  aiPlatform: z.enum(aiPlatforms),
  rawAnswer: z.string().min(1, "请输入 AI 原始回答"),
  checkedAt: z.string().min(1, "请输入检测时间"),
});
const analysisManualReviewInput = z.object({
  id: z.number().int().positive(),
  mentionsEnterprise: z.boolean(),
  recommendsEnterprise: z.boolean(),
  mentionsCompetitors: z.boolean(),
  recommendedCompetitors: z.array(z.string()).default([]),
  enterpriseWins: z.boolean(),
  recommendationReason: z.string().optional().default(""),
  notRecommendedReason: z.string().optional().default(""),
  hasMisconception: z.boolean(),
  contentGap: z.string().optional().default(""),
  optimizationSuggestion: z.string().optional().default(""),
  confidence: z.number().min(0).max(100).optional().nullable(),
  reviewNote: z.string().optional().nullable(),
});

const requireDb = async () => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库连接不可用" });
  return db;
};

export const resolveForwardProjectStatus = (
  currentStatus: typeof projectStatuses[number] | null | undefined,
  requestedStatus: typeof projectStatuses[number],
) => {
  const currentIndex = currentStatus ? projectStatuses.indexOf(currentStatus) : -1;
  const requestedIndex = projectStatuses.indexOf(requestedStatus);
  return requestedIndex >= currentIndex ? requestedStatus : currentStatus ?? requestedStatus;
};

const updateProjectStatus = async (projectId: number, status: typeof projectStatuses[number]) => {
  const db = await requireDb();
  const current = await db.select({ status: projects.status }).from(projects).where(eq(projects.id, projectId)).limit(1);
  const nextStatus = resolveForwardProjectStatus(current[0]?.status, status);
  if (nextStatus !== current[0]?.status) {
    await db.update(projects).set({ status: nextStatus }).where(eq(projects.id, projectId));
  }
};

const getProjectOrThrow = async (projectId: number) => {
  const db = await requireDb();
  const result = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (result.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "项目不存在" });
  return result[0];
};

const normalizeQuestionText = (value: string) => value.trim();

async function insertSpecifiedQuestions(projectId: number, rows: ManualQuestionImportRow[], source: "manual" | "csv") {
  const db = await requireDb();
  const existing = await db.select().from(questions).where(eq(questions.projectId, projectId));
  const known = new Map(existing.map(item => [item.questionText, item]));
  const toInsert = [];
  let skippedDuplicateCount = 0;
  let convertedSpecifiedCount = 0;

  for (const row of rows) {
    const questionText = normalizeQuestionText(row.questionText);
    if (!questionText) {
      skippedDuplicateCount += 1;
      continue;
    }

    const existingQuestion = known.get(questionText);
    if (existingQuestion) {
      skippedDuplicateCount += 1;
      if (existingQuestion.source === "ai_generated" || existingQuestion.questionType !== "指定问题") {
        await db.update(questions).set({
          questionType: "指定问题",
          source,
          targetKeyword: row.targetKeyword?.trim() || existingQuestion.targetKeyword,
          intentLevel: row.intentLevel?.trim() || existingQuestion.intentLevel || "高",
          businessValue: row.businessValue ?? existingQuestion.businessValue ?? 5,
          enabled: 1,
        }).where(eq(questions.id, existingQuestion.id));
        known.set(questionText, {
          ...existingQuestion,
          questionType: "指定问题",
          source,
          targetKeyword: row.targetKeyword?.trim() || existingQuestion.targetKeyword,
          intentLevel: row.intentLevel?.trim() || existingQuestion.intentLevel || "高",
          businessValue: row.businessValue ?? existingQuestion.businessValue ?? 5,
          enabled: 1,
        });
        convertedSpecifiedCount += 1;
      }
      continue;
    }

    const inserted = {
      projectId,
      questionText,
      questionType: row.questionType ?? "指定问题" as const,
      targetKeyword: row.targetKeyword?.trim() || null,
      intentLevel: row.intentLevel?.trim() || "高",
      businessValue: row.businessValue ?? 5,
      enabled: 1,
      source,
    };
    known.set(questionText, inserted as typeof questions.$inferSelect);
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
    totalCount: existing.length + toInsert.length,
  } as const;
}

function parseLLMJson<T>(content: unknown): T {
  if (typeof content !== "string") {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 返回格式不是文本 JSON" });
  }
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 返回 JSON 解析失败" });
  }
}

const geoRouter = router({
  projects: router({
    list: protectedProcedure.query(async () => {
      const db = await requireDb();
      return db.select().from(projects).orderBy(desc(projects.createdAt));
    }),
    create: protectedProcedure.input(projectInput).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.insert(projects).values({ ...input, status: "created" });
      return { success: true } as const;
    }),
    update: protectedProcedure.input(projectInput.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const { id, ...values } = input;
      await db.update(projects).set(values).where(eq(projects.id, id));
      return { success: true } as const;
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.delete(reports).where(eq(reports.projectId, input.id));
      await db.delete(contentTemplates).where(eq(contentTemplates.projectId, input.id));
      await db.delete(optimizationTasks).where(eq(optimizationTasks.projectId, input.id));
      await db.delete(geoScores).where(eq(geoScores.projectId, input.id));
      await db.delete(analysisResults).where(eq(analysisResults.projectId, input.id));
      await db.delete(aiResponses).where(eq(aiResponses.projectId, input.id));
      await db.delete(questions).where(eq(questions.projectId, input.id));
      await db.delete(projects).where(eq(projects.id, input.id));
      return { success: true } as const;
    }),
  }),

  questions: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      return db.select().from(questions).where(eq(questions.projectId, input.projectId)).orderBy(desc(questions.createdAt));
    }),
    create: protectedProcedure.input(questionInput).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.insert(questions).values({ ...input, targetKeyword: input.targetKeyword?.trim() || null, intentLevel: input.intentLevel ?? "高", businessValue: input.businessValue ?? 5, source: input.source ?? "manual", enabled: input.enabled ? 1 : 0 });
      await updateProjectStatus(input.projectId, "questions_ready");
      return { success: true } as const;
    }),
    update: protectedProcedure.input(questionInput.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const { id, ...values } = input;
      await db.update(questions).set({ ...values, targetKeyword: values.targetKeyword?.trim() || null, intentLevel: values.intentLevel ?? "高", businessValue: values.businessValue ?? 5, source: values.source ?? "manual", enabled: values.enabled ? 1 : 0 }).where(eq(questions.id, id));
      return { success: true } as const;
    }),
    toggle: protectedProcedure.input(z.object({ id: z.number().int().positive(), enabled: z.boolean() })).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.update(questions).set({ enabled: input.enabled ? 1 : 0 }).where(eq(questions.id, input.id));
      return { success: true } as const;
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.delete(questions).where(eq(questions.id, input.id));
      return { success: true } as const;
    }),
    batchAddSpecified: protectedProcedure.input(z.object({
      projectId: z.number().int().positive(),
      questions: z.array(z.string().min(1)).min(1),
    })).mutation(async ({ input }) => {
      return insertSpecifiedQuestions(input.projectId, input.questions.map(questionText => ({ questionText })), "manual");
    }),
    importSpecifiedCsvRows: protectedProcedure.input(z.object({
      projectId: z.number().int().positive(),
      rows: z.array(manualQuestionImportRow).min(1),
    })).mutation(async ({ input }) => {
      return insertSpecifiedQuestions(input.projectId, input.rows, "csv");
    }),
    generate: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const project = await getProjectOrThrow(input.projectId);
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "你是企业 GEO / AI Visibility 诊断顾问。请只输出符合 JSON Schema 的中文结果。" },
          {
            role: "user",
            content: `请根据以下企业信息生成 50 个用户可能向 AI 对话平台提出的问题。必须覆盖问题类型：${generatedQuestionTypes.join("、")}。\n\n企业名称：${project.enterpriseName}\n行业：${project.industry}\n官网：${project.website}\n地区：${project.region}\n产品介绍：${project.productIntro}\n目标客户：${project.targetCustomers}\n核心卖点：${project.coreSellingPoints}\n竞品：${project.competitorNames.join("、")}\n核心关键词：${project.coreKeywords.join("、")}`,
          },
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
                      questionType: { type: "string", enum: generatedQuestionTypes },
                    },
                    required: ["questionText", "questionType"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        },
      });
      const parsed = parseLLMJson<{ questions: Array<{ questionText: string; questionType: typeof generatedQuestionTypes[number] }> }>(response.choices[0]?.message.content);
      if (parsed.questions.length !== 50) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 未返回 50 个问题，请重新生成" });
      }
      await db.insert(questions).values(parsed.questions.map(item => ({ ...item, projectId: input.projectId, targetKeyword: null, intentLevel: "中", businessValue: 3, source: "ai_generated" as const, enabled: 1 })));
      await updateProjectStatus(input.projectId, "questions_ready");
      return { success: true, count: parsed.questions.length } as const;
    }),
  }),

  aiResponses: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      return db.select().from(aiResponses).where(eq(aiResponses.projectId, input.projectId)).orderBy(desc(aiResponses.createdAt));
    }),
    create: protectedProcedure.input(aiResponseInput).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.insert(aiResponses).values({ ...input, questionId: input.questionId ?? null, checkedAt: new Date(input.checkedAt) });
      await updateProjectStatus(input.projectId, "responses_imported");
      return { success: true } as const;
    }),
    importCsvRows: protectedProcedure.input(z.object({ rows: z.array(aiResponseInput).min(1) })).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.insert(aiResponses).values(input.rows.map(row => ({ ...row, questionId: row.questionId ?? null, checkedAt: new Date(row.checkedAt) })));
      const projectIds = Array.from(new Set(input.rows.map(row => row.projectId)));
      await Promise.all(projectIds.map(projectId => updateProjectStatus(projectId, "responses_imported")));
      return { success: true, count: input.rows.length } as const;
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.delete(analysisResults).where(eq(analysisResults.aiResponseId, input.id));
      await db.delete(aiResponses).where(eq(aiResponses.id, input.id));
      return { success: true } as const;
    }),
  }),

  analysis: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      const rows = await db.select().from(analysisResults).where(eq(analysisResults.projectId, input.projectId)).orderBy(desc(analysisResults.createdAt));
      return rows.map(resolveEffectiveAnalysisResult);
    }),
    run: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const project = await getProjectOrThrow(input.projectId);
      const responses = await db.select().from(aiResponses).where(eq(aiResponses.projectId, input.projectId)).orderBy(desc(aiResponses.createdAt));
      if (responses.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先录入或导入 AI 回答，再进行语义分析" });
      }

      const rows = [];
      for (const item of responses) {
        const llm = await invokeLLM({
          messages: [
            { role: "system", content: "你是严谨的 GEO / AI Visibility 语义分析师。必须基于 AI 原始回答做语义判断，不得只做关键词匹配，不得编造原文不存在的信息。请只输出 JSON。" },
            {
              role: "user",
              content: `企业信息：\n企业名称：${project.enterpriseName}\n行业：${project.industry}\n核心卖点：${project.coreSellingPoints}\n竞品：${project.competitorNames.join("、")}\n\n问题：${item.questionText}\nAI 平台：${item.aiPlatform}\nAI 原始回答：${item.rawAnswer}\n\n请判断该回答是否提到和推荐本企业、是否提到竞品、被推荐竞品、本企业是否胜出、推荐理由、未推荐原因、是否存在错误认知、内容缺口和优化建议。`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "geo_analysis_result",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  mentionsEnterprise: { type: "boolean" },
                  recommendsEnterprise: { type: "boolean" },
                  mentionsCompetitors: { type: "boolean" },
                  recommendedCompetitors: { type: "array", items: { type: "string" } },
                  enterpriseWins: { type: "boolean" },
                  recommendationReason: { type: "string" },
                  notRecommendedReason: { type: "string" },
                  hasMisconception: { type: "boolean" },
                  contentGap: { type: "string" },
                  optimizationSuggestion: { type: "string" },
                },
                required: [
                  "mentionsEnterprise",
                  "recommendsEnterprise",
                  "mentionsCompetitors",
                  "recommendedCompetitors",
                  "enterpriseWins",
                  "recommendationReason",
                  "notRecommendedReason",
                  "hasMisconception",
                  "contentGap",
                  "optimizationSuggestion",
                ],
                additionalProperties: false,
              },
            },
          },
        });
        const parsed = parseLLMJson<{
          mentionsEnterprise: boolean;
          recommendsEnterprise: boolean;
          mentionsCompetitors: boolean;
          recommendedCompetitors: string[];
          enterpriseWins: boolean;
          recommendationReason: string;
          notRecommendedReason: string;
          hasMisconception: boolean;
          contentGap: string;
          optimizationSuggestion: string;
        }>(llm.choices[0]?.message.content);
        rows.push({
          projectId: input.projectId,
          aiResponseId: item.id,
          mentionsEnterprise: parsed.mentionsEnterprise ? 1 : 0,
          recommendsEnterprise: parsed.recommendsEnterprise ? 1 : 0,
          mentionsCompetitors: parsed.mentionsCompetitors ? 1 : 0,
          recommendedCompetitors: parsed.recommendedCompetitors,
          enterpriseWins: parsed.enterpriseWins ? 1 : 0,
          recommendationReason: parsed.recommendationReason,
          notRecommendedReason: parsed.notRecommendedReason,
          hasMisconception: parsed.hasMisconception ? 1 : 0,
          contentGap: parsed.contentGap,
          optimizationSuggestion: parsed.optimizationSuggestion,
          rawJson: parsed,
          manualOverrideJson: null,
          manuallyReviewed: 0,
          reviewedAt: null,
          reviewNote: null,
        });
      }

      await db.delete(analysisResults).where(eq(analysisResults.projectId, input.projectId));
      await db.insert(analysisResults).values(rows);
      await updateProjectStatus(input.projectId, "analysis_done");
      return { success: true, count: rows.length } as const;
    }),
    saveManualReview: protectedProcedure.input(analysisManualReviewInput).mutation(async ({ input }) => {
      const db = await requireDb();
      const manualOverrideJson = {
        mentionsEnterprise: input.mentionsEnterprise,
        recommendsEnterprise: input.recommendsEnterprise,
        mentionsCompetitors: input.mentionsCompetitors,
        recommendedCompetitors: input.recommendedCompetitors.map(item => item.trim()).filter(Boolean),
        enterpriseWins: input.enterpriseWins,
        recommendationReason: input.recommendationReason.trim(),
        notRecommendedReason: input.notRecommendedReason.trim(),
        hasMisconception: input.hasMisconception,
        contentGap: input.contentGap.trim(),
        optimizationSuggestion: input.optimizationSuggestion.trim(),
        confidence: input.confidence ?? null,
      };
      await db.update(analysisResults).set({
        manualOverrideJson,
        manuallyReviewed: 1,
        reviewedAt: new Date(),
        reviewNote: input.reviewNote?.trim() || null,
      }).where(eq(analysisResults.id, input.id));
      return { success: true } as const;
    }),
    undoManualReview: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.update(analysisResults).set({
        manualOverrideJson: null,
        manuallyReviewed: 0,
        reviewedAt: null,
        reviewNote: null,
      }).where(eq(analysisResults.id, input.id));
      return { success: true } as const;
    }),
  }),

  scores: router({
    latest: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb();
      if (!input.projectId) return null;
      const result = await db.select().from(geoScores).where(eq(geoScores.projectId, input.projectId)).orderBy(desc(geoScores.createdAt)).limit(1);
      return result[0] ?? null;
    }),
    calculate: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const analyses = await db.select().from(analysisResults).where(eq(analysisResults.projectId, input.projectId));
      if (analyses.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先完成 AI 语义分析，再计算 GEO 评分" });
      }
      const score = calculateGeoScore(resolveEffectiveAnalysisResults(analyses));
      await db.delete(geoScores).where(eq(geoScores.projectId, input.projectId));
      await db.insert(geoScores).values({ projectId: input.projectId, ...score });
      await updateProjectStatus(input.projectId, "score_done");
      return { success: true, score } as const;
    }),
  }),

  tasks: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      return db.select().from(optimizationTasks).where(eq(optimizationTasks.projectId, input.projectId)).orderBy(desc(optimizationTasks.createdAt));
    }),
    generate: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const project = await getProjectOrThrow(input.projectId);
      const analyses = await db.select().from(analysisResults).where(eq(analysisResults.projectId, input.projectId));
      if (analyses.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先完成 AI 语义分析，再生成优化任务" });
      }
      const generated = generateOptimizationTasks(project, resolveEffectiveAnalysisResults(analyses));
      await db.delete(optimizationTasks).where(eq(optimizationTasks.projectId, input.projectId));
      await db.insert(optimizationTasks).values(generated.map(task => ({ ...task, projectId: input.projectId })));
      await updateProjectStatus(input.projectId, "tasks_ready");
      return { success: true, count: generated.length } as const;
    }),
    updateStatus: protectedProcedure.input(z.object({
      id: z.number().int().positive(),
      status: z.enum(taskStatuses),
      publishedUrl: z.string().optional().nullable(),
      needRetest: z.boolean().optional().default(false),
    })).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.update(optimizationTasks).set({
        status: input.status,
        publishedUrl: input.status === "done" ? input.publishedUrl ?? null : null,
        needRetest: input.status === "done" && input.needRetest ? 1 : 0,
        completedAt: input.status === "done" ? new Date() : null,
      }).where(eq(optimizationTasks.id, input.id));
      return { success: true } as const;
    }),
  }),

  templates: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      return db.select().from(contentTemplates).where(eq(contentTemplates.projectId, input.projectId)).orderBy(desc(contentTemplates.createdAt));
    }),
    generate: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const project = await getProjectOrThrow(input.projectId);
      const tasks = await db.select().from(optimizationTasks).where(eq(optimizationTasks.projectId, input.projectId));
      if (tasks.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先生成优化任务，再生成内容模板" });
      }
      const generated = generateContentTemplates(project, tasks.map(task => ({ id: task.id, taskType: task.taskType, taskName: task.taskName, generationReason: task.generationReason, executionSuggestion: task.executionSuggestion })));
      await db.delete(contentTemplates).where(eq(contentTemplates.projectId, input.projectId));
      await db.insert(contentTemplates).values(generated.map(item => ({ ...item, projectId: input.projectId, templateType: item.templateType as typeof templateTypes[number] })));
      await updateProjectStatus(input.projectId, "report_ready");
      return { success: true, count: generated.length } as const;
    }),
  }),

  reports: router({
    latest: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb();
      if (!input.projectId) return null;
      const result = await db.select().from(reports).where(eq(reports.projectId, input.projectId)).orderBy(desc(reports.createdAt)).limit(1);
      return result[0] ?? null;
    }),
    generate: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const project = await getProjectOrThrow(input.projectId);
      const analyses = await db.select().from(analysisResults).where(eq(analysisResults.projectId, input.projectId));
      const effectiveAnalyses = resolveEffectiveAnalysisResults(analyses);
      if (analyses.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先完成 AI 语义分析，再生成诊断报告" });
      }
      const rawScore = calculateGeoScore(analyses);
      const latestScore = await db.select().from(geoScores).where(eq(geoScores.projectId, input.projectId)).orderBy(desc(geoScores.createdAt)).limit(1);
      if (!latestScore[0]) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先计算 GEO 评分，再生成诊断报告" });
      }
      const responses = await db.select().from(aiResponses).where(eq(aiResponses.projectId, input.projectId));
      const projectQuestions = await db.select().from(questions).where(eq(questions.projectId, input.projectId));
      const questionStats = {
        totalQuestions: projectQuestions.length,
        aiGeneratedQuestions: projectQuestions.filter(question => question.source === "ai_generated").length,
        specifiedQuestions: projectQuestions.filter(question => question.source === "manual" || question.source === "csv").length,
      };
      const analysesWithQuestions = attachQuestionTextToAnalyses(effectiveAnalyses, responses, projectQuestions);
      const report = generateReportMarkdown(project, {
        aiVisibilityScore: latestScore[0].aiVisibilityScore,
        aiRecommendationScore: latestScore[0].aiRecommendationScore,
        competitorWinScore: latestScore[0].competitorWinScore,
        cognitionAccuracyScore: latestScore[0].cognitionAccuracyScore,
        contentAssetScore: latestScore[0].contentAssetScore,
        totalScore: latestScore[0].totalScore,
        visibilityLevel: latestScore[0].visibilityLevel,
      }, analysesWithQuestions, questionStats, rawScore);
      await db.delete(reports).where(eq(reports.projectId, input.projectId));
      await db.insert(reports).values({ projectId: input.projectId, geoScoreId: latestScore[0].id, ...report });
      await updateProjectStatus(input.projectId, "report_ready");
      return { success: true, report } as const;
    }),
  }),

  articles: router({
    topics: router({
      list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
        const db = await requireDb();
        if (!input.projectId) return [];
        return db.select().from(geoArticleTopics).where(eq(geoArticleTopics.projectId, input.projectId)).orderBy(desc(geoArticleTopics.createdAt));
      }),
      generate: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ input }) => {
        const db = await requireDb();
        const project = await getProjectOrThrow(input.projectId);
        const projectQuestions = await db.select().from(questions).where(eq(questions.projectId, input.projectId));
        const analyses = await db.select().from(analysisResults).where(eq(analysisResults.projectId, input.projectId));
        const responses = await db.select().from(aiResponses).where(eq(aiResponses.projectId, input.projectId));
        const tasks = await db.select().from(optimizationTasks).where(eq(optimizationTasks.projectId, input.projectId));
        const analysesWithQuestions = attachQuestionTextToAnalyses(resolveEffectiveAnalysisResults(analyses), responses, projectQuestions);
        const generated = generateGeoArticleTopics({ project, questions: projectQuestions, analyses: analysesWithQuestions, tasks });
        await db.delete(geoArticleTopics).where(eq(geoArticleTopics.projectId, input.projectId));
        await db.insert(geoArticleTopics).values(generated.map(topic => ({ ...topic, articleType: topic.articleType, status: topic.status })));
        return { success: true, count: generated.length } as const;
      }),
    }),
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      return db.select().from(geoArticles).where(eq(geoArticles.projectId, input.projectId)).orderBy(desc(geoArticles.createdAt));
    }),
    latestQualityScores: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      return db.select().from(geoArticleQualityScores).where(eq(geoArticleQualityScores.projectId, input.projectId)).orderBy(desc(geoArticleQualityScores.createdAt));
    }),
    publishRecords: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      return db.select().from(geoPublishRecords).where(eq(geoPublishRecords.projectId, input.projectId)).orderBy(desc(geoPublishRecords.publishedAt));
    }),
    generate: protectedProcedure.input(z.object({ topicId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const topicRows = await db.select().from(geoArticleTopics).where(eq(geoArticleTopics.id, input.topicId)).limit(1);
      const topic = topicRows[0];
      if (!topic) throw new TRPCError({ code: "NOT_FOUND", message: "文章选题不存在" });
      const project = await getProjectOrThrow(topic.projectId);
      const taskRows = topic.optimizationTaskId ? await db.select().from(optimizationTasks).where(eq(optimizationTasks.id, topic.optimizationTaskId)).limit(1) : [];
      const task = taskRows[0];
      if (!task) throw new TRPCError({ code: "BAD_REQUEST", message: "文章选题必须绑定优化任务，不能生成无来源文章" });
      const projectQuestions = await db.select().from(questions).where(eq(questions.projectId, topic.projectId));
      const analyses = await db.select().from(analysisResults).where(eq(analysisResults.projectId, topic.projectId));
      const responses = await db.select().from(aiResponses).where(eq(aiResponses.projectId, topic.projectId));
      const sourceQuestionIds = Array.isArray(topic.sourceQuestionIds) ? topic.sourceQuestionIds : [];
      const sourceAnalysisIds = Array.isArray(topic.sourceAnalysisIds) ? topic.sourceAnalysisIds : [];
      const questionScope = projectQuestions.filter(question => sourceQuestionIds.includes(question.id));
      const analysesWithQuestions = attachQuestionTextToAnalyses(resolveEffectiveAnalysisResults(analyses), responses, projectQuestions);
      const analysisScope = analysesWithQuestions.filter(analysis => sourceAnalysisIds.includes(analysis.id));
      const draft = generateGeoArticleDraft({
        project,
        topic: { ...topic, id: topic.id, articleType: topic.articleType as typeof articleTypes[number], optimizationTaskId: task.id },
        task,
        questions: questionScope.length > 0 ? questionScope : projectQuestions,
        analyses: analysisScope.length > 0 ? analysisScope : analysesWithQuestions,
      });
      const inserted = await db.insert(geoArticles).values(draft).$returningId();
      await db.update(geoArticleTopics).set({ status: "已生成" }).where(eq(geoArticleTopics.id, topic.id));
      return { success: true, articleId: inserted[0]?.id ?? 0 } as const;
    }),
    qualityCheck: protectedProcedure.input(z.object({ articleId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const articleRows = await db.select().from(geoArticles).where(eq(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article) throw new TRPCError({ code: "NOT_FOUND", message: "文章不存在" });
      if (!(article.status === "已生成" || article.status === "待质检")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "只有已生成但未质检的文章可以进行质量评分" });
      }
      const project = await getProjectOrThrow(article.projectId);
      const projectQuestions = await db.select().from(questions).where(eq(questions.projectId, article.projectId));
      const analyses = await db.select().from(analysisResults).where(eq(analysisResults.projectId, article.projectId));
      const responses = await db.select().from(aiResponses).where(eq(aiResponses.projectId, article.projectId));
      const taskRows = article.optimizationTaskId ? await db.select().from(optimizationTasks).where(eq(optimizationTasks.id, article.optimizationTaskId)).limit(1) : [];
      const analysesWithQuestions = attachQuestionTextToAnalyses(resolveEffectiveAnalysisResults(analyses), responses, projectQuestions);
      const quality = scoreGeoArticleQuality({ article, project, questions: projectQuestions, analyses: analysesWithQuestions, task: taskRows[0] ?? null });
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
        reviewSummary: quality.reviewSummary,
      });
      await db.update(geoArticles).set({ status: quality.blocked ? "质检未通过" : "待审核" }).where(eq(geoArticles.id, article.id));
      return { success: !quality.blocked, quality } as const;
    }),
    audit: protectedProcedure.input(z.object({ articleId: z.number().int().positive(), approved: z.boolean(), note: z.string().optional().default("") })).mutation(async ({ input }) => {
      const db = await requireDb();
      const articleRows = await db.select().from(geoArticles).where(eq(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article) throw new TRPCError({ code: "NOT_FOUND", message: "文章不存在" });
      const scoreRows = await db.select().from(geoArticleQualityScores).where(eq(geoArticleQualityScores.articleId, article.id)).orderBy(desc(geoArticleQualityScores.createdAt)).limit(1);
      const latestScore = scoreRows[0];
      const canAudit = canAuditArticle(article.status as ArticleStatus, latestScore ? { totalScore: latestScore.totalScore, blocked: Boolean(latestScore.blocked) } : null);
      if (!canAudit) throw new TRPCError({ code: "BAD_REQUEST", message: "未质检通过或低于 80 分的文章不能审核" });
      await db.update(geoArticles).set({ status: input.approved ? "审核通过" : "审核未通过" }).where(eq(geoArticles.id, article.id));
      return { success: true } as const;
    }),
    publish: protectedProcedure.input(z.object({ articleId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const articleRows = await db.select().from(geoArticles).where(eq(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article) throw new TRPCError({ code: "NOT_FOUND", message: "文章不存在" });
      if (!canPublishArticle(article.status as ArticleStatus)) throw new TRPCError({ code: "BAD_REQUEST", message: "未审核通过的文章不能发布" });
      const scoreRows = await db.select().from(geoArticleQualityScores).where(eq(geoArticleQualityScores.articleId, article.id)).orderBy(desc(geoArticleQualityScores.createdAt)).limit(1);
      const latestScore = scoreRows[0];
      if (!latestScore || latestScore.blocked || latestScore.totalScore < 80) throw new TRPCError({ code: "BAD_REQUEST", message: "文章质量分低于 80 或存在禁止发布风险，不能发布" });
      const publicPath = `/geo/content/${article.projectId}/${article.id}`;
      await db.update(geoArticles).set({ status: "已发布", publicPath }).where(eq(geoArticles.id, article.id));
      if (article.optimizationTaskId) {
        await db.update(optimizationTasks).set({ status: "retest", publishedUrl: publicPath, needRetest: 1 }).where(eq(optimizationTasks.id, article.optimizationTaskId));
      }
      await db.insert(geoPublishRecords).values({
        projectId: article.projectId,
        articleId: article.id,
        optimizationTaskId: article.optimizationTaskId,
        publishChannel: "系统内置 GEO 内容页",
        publishUrl: publicPath,
        publishStatus: "已发布",
        qualityScore: latestScore.totalScore,
        needRetest: 1,
        notes: "人工审核通过后发布到系统内置 GEO 内容页，等待复测。",
      });
      return { success: true, publicPath } as const;
    }),
    publicContent: publicProcedure.input(z.object({ projectId: z.number().int().positive(), articleId: z.number().int().positive() })).query(async ({ input }) => {
      const db = await requireDb();
      const articleRows = await db.select().from(geoArticles).where(eq(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article || article.projectId !== input.projectId || !(article.status === "已发布" || article.status === "待复测")) {
        throw new TRPCError({ code: "NOT_FOUND", message: "内容不存在或尚未发布" });
      }
      const project = await getProjectOrThrow(article.projectId);
      const scoreRows = await db.select().from(geoArticleQualityScores).where(eq(geoArticleQualityScores.articleId, article.id)).orderBy(desc(geoArticleQualityScores.createdAt)).limit(1);
      return { article, project, qualityScore: scoreRows[0] ?? null } as const;
    }),
  }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  geo: geoRouter,
});

export type AppRouter = typeof appRouter;
