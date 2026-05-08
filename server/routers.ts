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
  geoScores,
  optimizationTasks,
  projects,
  questions,
  reports,
} from "../drizzle/schema";
import {
  aiPlatforms,
  calculateGeoScore,
  generateContentTemplates,
  generateOptimizationTasks,
  generateReportMarkdown,
  projectStatuses,
  questionTypes,
  taskStatuses,
  taskTypes,
  templateTypes,
} from "./geoLogic";

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
  enabled: z.boolean().default(true),
});

const aiResponseInput = z.object({
  projectId: z.number().int().positive(),
  questionId: z.number().int().positive().optional().nullable(),
  questionText: z.string().min(1, "请输入问题"),
  aiPlatform: z.enum(aiPlatforms),
  rawAnswer: z.string().min(1, "请输入 AI 原始回答"),
  checkedAt: z.string().min(1, "请输入检测时间"),
});

const requireDb = async () => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库连接不可用" });
  return db;
};

const updateProjectStatus = async (projectId: number, status: typeof projectStatuses[number]) => {
  const db = await requireDb();
  await db.update(projects).set({ status }).where(eq(projects.id, projectId));
};

const getProjectOrThrow = async (projectId: number) => {
  const db = await requireDb();
  const result = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (result.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "项目不存在" });
  return result[0];
};

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
      await db.insert(questions).values({ ...input, enabled: input.enabled ? 1 : 0 });
      return { success: true } as const;
    }),
    update: protectedProcedure.input(questionInput.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const { id, ...values } = input;
      await db.update(questions).set({ ...values, enabled: values.enabled ? 1 : 0 }).where(eq(questions.id, id));
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
    generate: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const project = await getProjectOrThrow(input.projectId);
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "你是企业 GEO / AI Visibility 诊断顾问。请只输出符合 JSON Schema 的中文结果。" },
          {
            role: "user",
            content: `请根据以下企业信息生成 50 个用户可能向 AI 对话平台提出的问题。必须覆盖问题类型：${questionTypes.join("、")}。\n\n企业名称：${project.enterpriseName}\n行业：${project.industry}\n官网：${project.website}\n地区：${project.region}\n产品介绍：${project.productIntro}\n目标客户：${project.targetCustomers}\n核心卖点：${project.coreSellingPoints}\n竞品：${project.competitorNames.join("、")}\n核心关键词：${project.coreKeywords.join("、")}`,
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
                      questionType: { type: "string", enum: questionTypes },
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
      const parsed = parseLLMJson<{ questions: Array<{ questionText: string; questionType: typeof questionTypes[number] }> }>(response.choices[0]?.message.content);
      if (parsed.questions.length !== 50) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 未返回 50 个问题，请重新生成" });
      }
      await db.insert(questions).values(parsed.questions.map(item => ({ ...item, projectId: input.projectId, enabled: 1 })));
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
      return db.select().from(analysisResults).where(eq(analysisResults.projectId, input.projectId)).orderBy(desc(analysisResults.createdAt));
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
        });
      }

      await db.delete(analysisResults).where(eq(analysisResults.projectId, input.projectId));
      await db.insert(analysisResults).values(rows);
      await updateProjectStatus(input.projectId, "analysis_done");
      return { success: true, count: rows.length } as const;
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
      const score = calculateGeoScore(analyses);
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
      const generated = generateOptimizationTasks(project, analyses);
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
      if (analyses.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先完成 AI 语义分析，再生成诊断报告" });
      }
      const latestScore = await db.select().from(geoScores).where(eq(geoScores.projectId, input.projectId)).orderBy(desc(geoScores.createdAt)).limit(1);
      if (!latestScore[0]) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先计算 GEO 评分，再生成诊断报告" });
      }
      const responses = await db.select().from(aiResponses).where(eq(aiResponses.projectId, input.projectId));
      const questionTextByResponseId = new Map(responses.map(response => [response.id, response.questionText]));
      const analysesWithQuestions = analyses.map(analysis => ({
        ...analysis,
        questionText: questionTextByResponseId.get(analysis.aiResponseId) ?? null,
      }));
      const report = generateReportMarkdown(project, {
        aiVisibilityScore: latestScore[0].aiVisibilityScore,
        aiRecommendationScore: latestScore[0].aiRecommendationScore,
        competitorWinScore: latestScore[0].competitorWinScore,
        cognitionAccuracyScore: latestScore[0].cognitionAccuracyScore,
        contentAssetScore: latestScore[0].contentAssetScore,
        totalScore: latestScore[0].totalScore,
        visibilityLevel: latestScore[0].visibilityLevel,
      }, analysesWithQuestions);
      await db.delete(reports).where(eq(reports.projectId, input.projectId));
      await db.insert(reports).values({ projectId: input.projectId, geoScoreId: latestScore[0].id, ...report });
      await updateProjectStatus(input.projectId, "report_ready");
      return { success: true, report } as const;
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
