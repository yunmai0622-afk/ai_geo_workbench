import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { GEO_ARTICLE_MIN_PASS_SCORE } from "@shared/const";
import { geoArticleQualityScores, geoArticles, geoPublishRecords, publishTasks, users } from "../drizzle/schema";
import { getDb } from "./db";
import { buildCustomExtensionZip, resolveServerUrlFromRequest } from "./extensionDownload";
import { getEnabledPlatformAccount, getProjectOrThrowConn, requireDbConn, verifyPublishTaskAccount } from "./projectPlatformAccounts";
import { buildPublishCoverImageUrl, parseDataUrlCover } from "@shared/publishCoverPayload";
import { isBindingPublishPlatform, publishBlockedNoAccountMessage, PUBLISH_PLATFORM_LABELS } from "@shared/platformAccountVerify";
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

const MAX_COVER_BYTES = 3 * 1024 * 1024;

function resolveCoverImageUrl(raw: string | null | undefined, origin: string): string | null {
  if (!raw) return null;
  return raw.startsWith("http") ? raw : `${origin}${raw}`;
}

/** 服务端代理下载封面，避免插件跨域 Failed to fetch */
async function attachCoverImagePayload(coverImageUrl: string | null, origin: string) {
  const resolvedUrl = resolveCoverImageUrl(coverImageUrl, origin);
  if (!resolvedUrl) {
    return { coverImageUrl: null as string | null, coverImageBase64: undefined, coverImageMime: undefined };
  }

  if (resolvedUrl.startsWith("data:")) {
    const parsed = parseDataUrlCover(resolvedUrl);
    if (parsed) {
      console.log(`[封面图] 使用文章模板封面 base64，${parsed.coverImageBase64.length} chars`);
      return parsed;
    }
  }

  try {
    const res = await fetch(resolvedUrl);
    if (!res.ok) {
      console.warn(`[封面图] 服务端下载失败 HTTP ${res.status}: ${resolvedUrl}`);
      return { coverImageUrl: resolvedUrl, coverImageBase64: undefined, coverImageMime: undefined };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_COVER_BYTES) {
      console.warn(`[封面图] 图片过大 (${buf.length} bytes)，插件将仅保留 URL: ${resolvedUrl}`);
      return { coverImageUrl: resolvedUrl, coverImageBase64: undefined, coverImageMime: undefined };
    }
    const mime = res.headers.get("content-type") || "image/png";
    console.log(`[封面图] 服务端已缓存封面 base64，${buf.length} bytes`);
    return {
      coverImageUrl: resolvedUrl,
      coverImageBase64: buf.toString("base64"),
      coverImageMime: mime,
    };
  } catch (e) {
    console.warn(`[封面图] 服务端下载异常:`, e);
    return { coverImageUrl: resolvedUrl, coverImageBase64: undefined, coverImageMime: undefined };
  }
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
      const db = await requireDbConn();
      const articleRows = await db.select().from(geoArticles).where(eq(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article || article.projectId !== input.projectId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "未找到属于当前项目的内容" });
      }

      if (isBindingPublishPlatform(input.platform)) {
        const bound = await getEnabledPlatformAccount(db, input.projectId, input.platform);
        if (!bound) {
          throw new TRPCError({ code: "BAD_REQUEST", message: publishBlockedNoAccountMessage(input.platform) });
        }
      } else if (input.platform === "wechat") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "微信公众号暂不支持插件自动发布，请使用标记已发布记录人工发布结果",
        });
      }

      const project = await getProjectOrThrowConn(db, input.projectId);
      const boundAccount = isBindingPublishPlatform(input.platform)
        ? await getEnabledPlatformAccount(db, input.projectId, input.platform)
        : null;

      const apiKey = await ensureUserExtensionApiKey(ctx.user!.id);
      const coverImageUrl = buildPublishCoverImageUrl(article.coverBase64, article.coverImageUrl);
      const inserted = await db
        .insert(publishTasks)
        .values({
          projectId: input.projectId,
          projectName: project.enterpriseName,
          articleId: input.articleId,
          platform: input.platform,
          status: "pending",
          platformAccountId: boundAccount?.id,
          expectedAccountName: boundAccount?.accountName,
          accountVerificationStatus: "pending",
          articleTitle: article.title,
          articleContent: article.markdownContent ?? "",
          coverImageUrl: coverImageUrl ?? undefined,
          apiKey,
        })
        .$returningId();
      if (!coverImageUrl) {
        console.warn(`[封面图] 任务 ${inserted[0]?.id ?? "?"} 暂无封面，将仅发布正文`);
      }
      return {
        taskId: inserted[0]?.id ?? 0,
        coverImageUrl: coverImageUrl ?? null,
        hasCover: Boolean(coverImageUrl),
        projectName: project.enterpriseName,
        platformLabel: isBindingPublishPlatform(input.platform) ? PUBLISH_PLATFORM_LABELS[input.platform] : input.platform,
        expectedAccountName: boundAccount?.accountName ?? null,
      } as const;
    }),

  verifyPublishTask: publicProcedure
    .input(
      z.object({
        taskId: z.number().int().positive(),
        apiKey: z.string().min(8).max(100),
        detectedAccountName: z.string().max(255).optional().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDbConn();
      return verifyPublishTaskAccount(db, input);
    }),

  pending: publicProcedure.input(z.object({ apiKey: z.string().min(8).max(100) })).query(async ({ input, ctx }) => {
    await assertApiKeyUser(input.apiKey);
    const db = await requireDb();
    const rows = await db
      .select({
        id: publishTasks.id,
        projectId: publishTasks.projectId,
        projectName: publishTasks.projectName,
        platform: publishTasks.platform,
        platformAccountId: publishTasks.platformAccountId,
        expectedAccountName: publishTasks.expectedAccountName,
        articleTitle: publishTasks.articleTitle,
        articleContent: publishTasks.articleContent,
        coverImageUrl: publishTasks.coverImageUrl,
        accountVerificationStatus: publishTasks.accountVerificationStatus,
      })
      .from(publishTasks)
      .where(and(eq(publishTasks.apiKey, input.apiKey), eq(publishTasks.status, "pending")));
    const forwardedProto = ctx.req.headers["x-forwarded-proto"];
    const protocol = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : typeof forwardedProto === "string"
        ? forwardedProto.split(",")[0]?.trim()
        : "https";
    const host = ctx.req.headers.host || "aigeoworkb-kzxhj9uy.manus.space";
    const origin = `${protocol || "https"}://${host}`;

    const tasks = await Promise.all(
      rows.map(async row => {
        const cover = await attachCoverImagePayload(row.coverImageUrl, origin);
        return {
          id: row.id,
          projectId: row.projectId,
          projectName: row.projectName,
          platform: row.platform,
          platformAccountId: row.platformAccountId,
          expectedAccountName: row.expectedAccountName,
          articleTitle: row.articleTitle,
          articleContent: row.articleContent,
          accountVerificationStatus: row.accountVerificationStatus,
          ...cover,
        };
      }),
    );
    return { tasks } as const;
  }),

  complete: publicProcedure
    .input(
      z.object({
        taskId: z.number().int().positive(),
        apiKey: z.string().min(8).max(100),
        status: z.enum(["processing", "completed", "failed", "draft_saved"]),
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

      if (input.status === "draft_saved") {
        return { ok: true, draftSaved: true } as const;
      }

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

  latestByArticle: protectedProcedure
    .input(
      z.object({
        articleId: z.number().int().positive(),
        projectId: z.number().int().positive(),
      }),
    )
    .query(async ({ input }) => {
      const db = await requireDb();
      const rows = await db
        .select({
          id: publishTasks.id,
          platform: publishTasks.platform,
          status: publishTasks.status,
          accountVerificationStatus: publishTasks.accountVerificationStatus,
          expectedAccountName: publishTasks.expectedAccountName,
          detectedAccountName: publishTasks.detectedAccountName,
          resultUrl: publishTasks.resultUrl,
          errorMessage: publishTasks.errorMessage,
          createdAt: publishTasks.createdAt,
        })
        .from(publishTasks)
        .where(and(eq(publishTasks.articleId, input.articleId), eq(publishTasks.projectId, input.projectId)))
        .orderBy(desc(publishTasks.id))
        .limit(20);
      return { tasks: rows } as const;
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
