import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { GEO_ARTICLE_MIN_PASS_SCORE } from "@shared/const";
import { geoArticleQualityScores, geoArticles, geoPublishRecords, publishTasks, users } from "../drizzle/schema";
import { getDb } from "./db";
import { buildCustomExtensionZip, resolveServerUrlFromRequest } from "./extensionDownload";
import { generateCoverImage } from "./volcengineImageGen";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const publishPlatformSlugEnum = z.enum(["zhihu", "toutiao", "sohu", "baijiahao", "wechat"]);

const PLATFORM_TO_PUBLISH_CHANNEL: Record<z.infer<typeof publishPlatformSlugEnum>, "知乎" | "头条号" | "搜狐号" | "百家号" | "微信公众号"> = {
  zhihu: "知乎",
  toutiao: "头条号",
  sohu: "搜狐号",
  baijiahao: "百家号",
  wechat: "微信公众号",
};

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
  return db;
}

async function ensureUserExtensionApiKey(userId: number): Promise<string> {
  const db = await requireDb();
  const rows = await db.select({ id: users.id, extensionApiKey: users.extensionApiKey }).from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "用户不存在" });
  if (user.extensionApiKey) return user.extensionApiKey;
  const apiKey = randomUUID().replace(/-/g, "");
  await db.update(users).set({ extensionApiKey: apiKey }).where(eq(users.id, userId));
  return apiKey;
}

async function assertApiKeyUser(apiKey: string) {
  const db = await requireDb();
  const rows = await db.select().from(users).where(eq(users.extensionApiKey, apiKey)).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "UNAUTHORIZED", message: "无效的 API 密钥" });
  return rows[0];
}

export const publishTasksRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        articleId: z.number().int().positive(),
        platform: publishPlatformSlugEnum,
        projectId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const articleRows = await db.select().from(geoArticles).where(eq(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article || article.projectId !== input.projectId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "未找到属于当前项目的内容" });
      }
      const apiKey = await ensureUserExtensionApiKey(ctx.user!.id);
      const coverImageUrl = await generateCoverImage(article.title ?? "").catch(() => null);
      const inserted = await db
        .insert(publishTasks)
        .values({
          projectId: input.projectId,
          articleId: input.articleId,
          platform: input.platform,
          status: "pending",
          articleTitle: article.title,
          articleContent: article.markdownContent ?? "",
          coverImageUrl: coverImageUrl ?? undefined,
          apiKey,
        })
        .$returningId();
      return { taskId: inserted[0]?.id ?? 0 } as const;
    }),

  pending: publicProcedure.input(z.object({ apiKey: z.string().min(8).max(100) })).query(async ({ input }) => {
    await assertApiKeyUser(input.apiKey);
    const db = await requireDb();
    const rows = await db
      .select({
        id: publishTasks.id,
        platform: publishTasks.platform,
        articleTitle: publishTasks.articleTitle,
        articleContent: publishTasks.articleContent,
        coverImageUrl: publishTasks.coverImageUrl,
      })
      .from(publishTasks)
      .where(and(eq(publishTasks.apiKey, input.apiKey), eq(publishTasks.status, "pending")));
    return { tasks: rows } as const;
  }),

  complete: publicProcedure
    .input(
      z.object({
        taskId: z.number().int().positive(),
        apiKey: z.string().min(8).max(100),
        status: z.enum(["processing", "completed", "failed"]),
        resultUrl: z.string().max(500).optional(),
        errorMessage: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await assertApiKeyUser(input.apiKey);
      const db = await requireDb();
      const taskRows = await db.select().from(publishTasks).where(eq(publishTasks.id, input.taskId)).limit(1);
      const task = taskRows[0];
      if (!task || task.apiKey !== input.apiKey) {
        throw new TRPCError({ code: "NOT_FOUND", message: "发布任务不存在或无权操作" });
      }

      await db
        .update(publishTasks)
        .set({
          status: input.status,
          resultUrl: input.resultUrl ?? null,
          errorMessage: input.errorMessage ?? null,
        })
        .where(eq(publishTasks.id, input.taskId));

      if (input.status === "completed" && input.resultUrl?.trim()) {
        const articleRows = await db.select().from(geoArticles).where(eq(geoArticles.id, task.articleId)).limit(1);
        const article = articleRows[0];
        if (article) {
          const scoreRows = await db
            .select()
            .from(geoArticleQualityScores)
            .where(eq(geoArticleQualityScores.articleId, article.id))
            .orderBy(desc(geoArticleQualityScores.createdAt))
            .limit(1);
          const latestScore = scoreRows[0];
          const channel = PLATFORM_TO_PUBLISH_CHANNEL[task.platform as z.infer<typeof publishPlatformSlugEnum>];
          if (channel) {
            await db.insert(geoPublishRecords).values({
              projectId: task.projectId,
              articleId: task.articleId,
              optimizationTaskId: article.optimizationTaskId,
              publishChannel: channel,
              publishTitle: task.articleTitle,
              publishUrl: input.resultUrl.trim(),
              publishStatus: "已发布",
              qualityScore: latestScore?.totalScore ?? GEO_ARTICLE_MIN_PASS_SCORE,
              needRetest: 1,
              notes: "浏览器插件自动发布完成",
            });
            await db.update(geoArticles).set({ status: "已发布" }).where(eq(geoArticles.id, article.id));
          }
        }
      }

      return { ok: true } as const;
    }),

  getApiKey: protectedProcedure.query(async ({ ctx }) => {
    const apiKey = await ensureUserExtensionApiKey(ctx.user!.id);
    return { apiKey } as const;
  }),

  downloadExtension: protectedProcedure.mutation(async ({ ctx }) => {
    const apiKey = await ensureUserExtensionApiKey(ctx.user!.id);
    const serverUrl = resolveServerUrlFromRequest(ctx.req);
    const zipBuffer = buildCustomExtensionZip(serverUrl, apiKey);
    return {
      fileName: "content-growth-publish-extension.zip",
      mimeType: "application/zip",
      dataBase64: zipBuffer.toString("base64"),
    } as const;
  }),
});
