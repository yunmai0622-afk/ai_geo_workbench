import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getGeoArticleMinPassScore } from "./geoArticleLogic";
import {
  geoArticleQualityScores,
  geoArticles,
  geoInclusionMonitoringRecords,
  geoPublishRecords,
  projectPlatformAccounts,
  publishTasks,
  users,
} from "../drizzle/schema";
import { getDb } from "./db";
import { buildCustomExtensionZip, resolveServerUrlFromRequest } from "./extensionDownload";
import { getCurrentUserId, requireProjectAccessConn } from "./projectAccess";
import {
  requireDbConn,
  resolvePublishPlatformAccount,
  verifyPublishTaskAccount,
} from "./projectPlatformAccounts";
import { isValidStoredCoverBase64, parseStoredCoverBase64, resolveArticleCoverBase64ForPublish } from "@shared/articleCoverBase64";
import { buildPublishCoverImageUrl, parseDataUrlCover } from "@shared/publishCoverPayload";
import {
  BINDING_PUBLISH_PLATFORMS,
  isBindingPublishPlatform,
  PUBLISH_PLATFORM_LABELS,
  publishBlockedNoLocalProfileMessage,
  publishBlockedSessionExpiredMessage,
  publishMustSelectAccountMessage,
} from "@shared/platformAccountVerify";
import { getArticlePublishPlatform } from "@shared/articlePublishPlatform";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { evaluatePublishReadiness, type PublishReadyAccountRow } from "@shared/publishReadiness";
import { isP0GeoProfileCompleteFromRecord } from "@shared/geoProfileP0Readiness";
import { appendArticleLifecycleEvent } from "./articleLifecycleService";
import { markGeoArticlePublishedAt } from "./geoArticlePublishState";
import { buildInitialInclusionMonitoringRecord } from "./geoMonitoring";
import { analysisResults, enterpriseGeoProfiles, geoScores } from "../drizzle/schema";
import { emitPublishFailedNotification, emitPublishSuccessNotification } from "./systemNotifications";
import { retryFailedPublishTask } from "./publishTaskRetryService";
import { canRetryPublishTask, isPublishRetryExhausted } from "@shared/publishTaskRetry";
import {
  PUBLISH_QUEUE_BLOCKING_STATUSES,
  PUBLISH_QUEUE_DUPLICATE_MESSAGE,
  PUBLISH_QUEUE_DUPLICATE_RETRY_MESSAGE,
} from "@shared/publishQueueDedup";
import { buildDeliveryReportPublishStats } from "@shared/deliveryReportPublishStats";
import {
  evaluatePrePublishChecklist,
  formatPrePublishChecklistBlockMessage,
  type PrePublishChecklistPlatform,
} from "@shared/publishPrePublishChecklist";

const publishPlatformSlugEnum = z.enum([...BINDING_PUBLISH_PLATFORMS, "wechat"]);

type PublishChannelLabel =
  | "知乎"
  | "头条号"
  | "搜狐号"
  | "百家号"
  | "网易号"
  | "微信公众号";

const PLATFORM_TO_PUBLISH_CHANNEL: Record<z.infer<typeof publishPlatformSlugEnum>, PublishChannelLabel> = {
  zhihu: "知乎",
  toutiao: "头条号",
  sohu: "搜狐号",
  baijiahao: "百家号",
  netease: "网易号",
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
async function assertPublishReadinessForCreate(
  db: Awaited<ReturnType<typeof requireDbConn>>,
  input: {
    projectId: number;
    article: typeof geoArticles.$inferSelect;
    platform: z.infer<typeof publishPlatformSlugEnum>;
  },
) {
  const [profileRows, analysisRows, scoreRows, accountRows] = await Promise.all([
    db.select().from(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.projectId, input.projectId)).limit(1),
    db.select({ id: analysisResults.id }).from(analysisResults).where(eq(analysisResults.projectId, input.projectId)).limit(1),
    db.select({ id: geoScores.id }).from(geoScores).where(eq(geoScores.projectId, input.projectId)).limit(1),
    db.select().from(projectPlatformAccounts).where(eq(projectPlatformAccounts.projectId, input.projectId)),
  ]);
  const profileRecord = (profileRows[0] ?? null) as Record<string, unknown> | null;
  const platformAccounts: PublishReadyAccountRow[] = accountRows.map(row => ({
    platform: row.platform,
    accountName: row.accountName,
    isEnabled: row.isEnabled,
    localProfileId: row.localProfileId,
    localAgentId: row.localAgentId,
    sessionStatus: row.sessionStatus,
  }));
  const readiness = evaluatePublishReadiness({
    projectAccessible: true,
    enterpriseProfileReady: isP0GeoProfileCompleteFromRecord(profileRecord),
    enterpriseProfile: profileRecord,
    diagnosisReady: analysisRows.length > 0 || scoreRows.length > 0,
    article: {
      ...input.article,
      generationBasis: (input.article.generationBasis ?? null) as Record<string, unknown> | null,
    },
    platformAccounts,
    requestedPlatform: isBindingPublishPlatform(input.platform) ? input.platform : null,
    skipLocalAgentConnectionCheck: true,
  });
  if (!readiness.ready) {
    throw new TRPCError({ code: "BAD_REQUEST", message: readiness.message });
  }
  return readiness;
}

async function assertPrePublishChecklistForCreate(
  input: {
    article: typeof geoArticles.$inferSelect;
    platform: z.infer<typeof publishPlatformSlugEnum>;
    boundAccount: {
      platform: string;
      accountName: string | null;
      isEnabled: boolean | number | null;
      localProfileId: string | null;
      localAgentId: string | null;
      sessionStatus: string | null;
    };
  },
) {
  const platform = input.platform as PrePublishChecklistPlatform;
  const checklist = evaluatePrePublishChecklist({
    title: input.article.title ?? "",
    markdownContent: input.article.markdownContent ?? "",
    coverBase64: input.article.coverBase64,
    coverImageUrl: input.article.coverImageUrl,
    platform,
    article: {
      geoQualityScore: input.article.geoQualityScore,
      geoQualityRecommendation: input.article.geoQualityRecommendation,
      geoQualityStale: input.article.geoQualityStale,
      lifecycleStatus: input.article.lifecycleStatus,
      lifecycleEvents: input.article.lifecycleEvents,
      status: input.article.status,
    },
    account: {
      platform: input.boundAccount.platform,
      accountName: input.boundAccount.accountName,
      isEnabled: input.boundAccount.isEnabled,
      localProfileId: input.boundAccount.localProfileId,
      localAgentId: input.boundAccount.localAgentId,
      sessionStatus: input.boundAccount.sessionStatus,
    },
  });
  if (!checklist.allPassed) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: formatPrePublishChecklistBlockMessage(checklist),
    });
  }
}

async function assertNoDuplicatePublishQueueTask(
  db: Awaited<ReturnType<typeof requireDbConn>>,
  input: { articleId: number; platform: string; platformAccountId: number },
) {
  const existing = await db
    .select({ id: publishTasks.id, status: publishTasks.status })
    .from(publishTasks)
    .where(
      and(
        eq(publishTasks.articleId, input.articleId),
        eq(publishTasks.platform, input.platform),
        eq(publishTasks.platformAccountId, input.platformAccountId),
        inArray(publishTasks.status, [...PUBLISH_QUEUE_BLOCKING_STATUSES]),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    const row = existing[0]!;
    const message =
      row.status === "failed" ? PUBLISH_QUEUE_DUPLICATE_RETRY_MESSAGE : PUBLISH_QUEUE_DUPLICATE_MESSAGE;
    throw new TRPCError({ code: "BAD_REQUEST", message });
  }
}

async function attachCoverImagePayload(coverImageUrl: string | null, origin: string) {
  const resolvedUrl = resolveCoverImageUrl(coverImageUrl, origin);
  if (!resolvedUrl) {
    return { coverImageUrl: null as string | null, coverImageBase64: undefined, coverImageMime: undefined };
  }

  if (resolvedUrl.startsWith("data:")) {
    const parsed = parseDataUrlCover(resolvedUrl);
    if (parsed) {
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
        platformAccountId: z.number().int().positive().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDbConn();
      const articleRows = await db.select().from(geoArticles).where(eq(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article || article.projectId !== input.projectId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "未找到属于当前项目的内容" });
      }

      await assertPublishReadinessForCreate(db, {
        projectId: input.projectId,
        article,
        platform: input.platform,
      });

      const articlePlatform = getArticlePublishPlatform({
        generationBasis: article.generationBasis ?? null,
      });
      if (
        articlePlatform.recognized &&
        articlePlatform.publishQueueSlug &&
        articlePlatform.publishQueueSlug !== input.platform
      ) {
        console.warn(
          `[publishTasks.create] platform mismatch article=${input.articleId} expected=${articlePlatform.publishQueueSlug} got=${input.platform}`,
        );
      }

      if (!isBindingPublishPlatform(input.platform)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "该平台请先在企业档案绑定本地发布账号后，通过本地客户端发布",
        });
      }

      if (input.platformAccountId == null || input.platformAccountId <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: publishMustSelectAccountMessage(input.platform),
        });
      }

      const ownerUserId = getCurrentUserId(ctx);
      const project = await requireProjectAccessConn(db, ownerUserId, input.projectId);
      const boundAccount = await resolvePublishPlatformAccount(db, {
        projectId: input.projectId,
        platform: input.platform,
        platformAccountId: input.platformAccountId,
      });

      const brandLabel = String(project.enterpriseName ?? "海豚知道").trim() || "海豚知道";
      const effectiveCoverBase64 = resolveArticleCoverBase64ForPublish(article, brandLabel);
      const rawCoverImageUrl = article.coverImageUrl?.trim() ?? "";
      if (!effectiveCoverBase64 && !rawCoverImageUrl) {
        console.warn(`[封面图] 文章 ${input.articleId} 暂无封面且无法合成，任务将仅含正文`);
      } else if (effectiveCoverBase64) {
        try {
          const parsed = parseStoredCoverBase64(effectiveCoverBase64);
          const payload = parsed?.base64 ?? effectiveCoverBase64;
          const coverBytes = Buffer.from(payload, "base64").length;
          if (coverBytes > 100 * 1024) {
            console.warn(
              `[封面图] 文章 ${input.articleId} coverBase64 约 ${coverBytes} bytes，超过 100KB，仍写入任务`,
            );
          }
        } catch {
          console.warn(`[封面图] 文章 ${input.articleId} coverBase64 无法解码，仍尝试写入任务`);
        }
        if (!article.coverBase64?.trim() || !isValidStoredCoverBase64(article.coverBase64)) {
          await db
            .update(geoArticles)
            .set({ coverBase64: effectiveCoverBase64 })
            .where(eq(geoArticles.id, input.articleId));
        }
      }

      const coverImageUrl = buildPublishCoverImageUrl(effectiveCoverBase64, article.coverImageUrl);

      if (!boundAccount.localAgentId?.trim() || !boundAccount.localProfileId?.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: publishBlockedNoLocalProfileMessage(input.platform),
        });
      }

      if (boundAccount.sessionStatus !== "active") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: publishBlockedSessionExpiredMessage(input.platform),
        });
      }

      await assertPrePublishChecklistForCreate({
        article,
        platform: input.platform,
        boundAccount,
      });

      await assertNoDuplicatePublishQueueTask(db, {
        articleId: input.articleId,
        platform: input.platform,
        platformAccountId: boundAccount.id,
      });

      const apiKey = await ensureUserExtensionApiKey(ctx.user!.id);
      const inserted = await db
        .insert(publishTasks)
        .values({
          projectId: input.projectId,
          projectName: project.enterpriseName,
          articleId: input.articleId,
          platform: input.platform,
          status: "pending_agent",
          platformAccountId: boundAccount.id,
          expectedAccountName: boundAccount.accountName,
          accountVerificationStatus: "matched",
          articleTitle: article.title,
          articleContent: article.markdownContent ?? "",
          coverImageUrl: coverImageUrl ?? undefined,
          apiKey,
          localAgentId: boundAccount.localAgentId,
          localProfileId: boundAccount.localProfileId,
        })
        .$returningId();
      if (!coverImageUrl) {
        console.warn(`[封面图] 任务 ${inserted[0]?.id ?? "?"} 暂无封面，将仅发布正文`);
      }
      const taskId = inserted[0]?.id ?? 0;
      if (taskId > 0) {
        await appendArticleLifecycleEvent(db, input.articleId, {
          status: "pending_publish",
          source: "publish_task_create",
          message: `已创建 ${PUBLISH_PLATFORM_LABELS[input.platform]} 本地 Agent 发布任务`,
          taskId,
          platform: input.platform,
          publishTaskStatus: "pending_agent",
        });
      }
      return {
        taskId,
        coverImageUrl: coverImageUrl ?? null,
        hasCover: Boolean(coverImageUrl),
        projectName: project.enterpriseName,
        platformLabel: PUBLISH_PLATFORM_LABELS[input.platform],
        expectedAccountName: boundAccount.accountName ?? null,
        publishMode: "local_agent" as const,
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
              qualityScore: latestScore?.totalScore ?? getGeoArticleMinPassScore(),
              needRetest: 1,
              notes: "浏览器插件自动发布完成",
            });
            await markGeoArticlePublishedAt(db, article.id);
          }
        }
        void emitPublishSuccessNotification(db, task.projectId, task.articleTitle, task.platform).catch((err: unknown) => {
          console.warn("[notifications] publish success notification failed", task.id, err);
        });
      }

      if (input.status === "failed") {
        void emitPublishFailedNotification(db, task.projectId, task.articleTitle, input.errorMessage ?? null).catch(
          (err: unknown) => {
            console.warn("[notifications] publish failed notification failed", task.id, err);
          },
        );
      }

      return { ok: true } as const;
    }),

  projectStats: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      const ownerUserId = getCurrentUserId(ctx);
      await requireProjectAccessConn(db, ownerUserId, input.projectId);
      const rows = await db
        .select({
          platform: publishTasks.platform,
          status: publishTasks.status,
          createdAt: publishTasks.createdAt,
        })
        .from(publishTasks)
        .where(eq(publishTasks.projectId, input.projectId));
      return buildDeliveryReportPublishStats(rows);
    }),

  listRecentByProject: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      const ownerUserId = getCurrentUserId(ctx);
      await requireProjectAccessConn(db, ownerUserId, input.projectId);
      const rows = await db
        .select({
          id: publishTasks.id,
          articleId: publishTasks.articleId,
          articleTitle: publishTasks.articleTitle,
          platform: publishTasks.platform,
          status: publishTasks.status,
          expectedAccountName: publishTasks.expectedAccountName,
          localProfileId: publishTasks.localProfileId,
          resultUrl: publishTasks.resultUrl,
          publishedUrl: publishTasks.publishedUrl,
          draftUrl: publishTasks.draftUrl,
          agentErrorType: publishTasks.agentErrorType,
          agentErrorMessage: publishTasks.agentErrorMessage,
          agentLog: publishTasks.agentLog,
          agentPickedAt: publishTasks.agentPickedAt,
          agentFinishedAt: publishTasks.agentFinishedAt,
          retryCount: publishTasks.retryCount,
          retryLog: publishTasks.retryLog,
          createdAt: publishTasks.createdAt,
        })
        .from(publishTasks)
        .where(eq(publishTasks.projectId, input.projectId))
        .orderBy(desc(publishTasks.id))
        .limit(input.limit ?? 30);
      return {
        tasks: rows.map(row => ({
          ...row,
          canRetry: canRetryPublishTask(row),
          retryExhausted: isPublishRetryExhausted(row),
        })),
      } as const;
    }),

  backfillPublicUrl: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        taskId: z.number().int().positive(),
        publicUrl: z.string().trim().url().max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDbConn();
      const ownerUserId = getCurrentUserId(ctx);
      await requireProjectAccessConn(db, ownerUserId, input.projectId);

      const taskRows = await db.select().from(publishTasks).where(eq(publishTasks.id, input.taskId)).limit(1);
      const task = taskRows[0];
      if (!task || task.projectId !== input.projectId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "发布任务不存在" });
      }
      if (task.status !== "completed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "仅已完成任务可回填公开链接" });
      }

      const trimmedUrl = input.publicUrl.trim();
      await db.update(publishTasks).set({ publishedUrl: trimmedUrl }).where(eq(publishTasks.id, task.id));

      const articleRows = await db.select().from(geoArticles).where(eq(geoArticles.id, task.articleId)).limit(1);
      const article = articleRows[0];
      if (!article || article.projectId !== input.projectId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "内容不存在或不属于当前项目" });
      }

      const scoreRows = await db
        .select()
        .from(geoArticleQualityScores)
        .where(eq(geoArticleQualityScores.articleId, article.id))
        .orderBy(desc(geoArticleQualityScores.createdAt))
        .limit(1);
      const latestScore = scoreRows[0];
      const channel = PLATFORM_TO_PUBLISH_CHANNEL[task.platform as z.infer<typeof publishPlatformSlugEnum>];
      if (!channel) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "当前发布平台暂不支持回填公开链接" });
      }

      const existingPublishRecordRows = await db
        .select()
        .from(geoPublishRecords)
        .where(and(eq(geoPublishRecords.projectId, input.projectId), eq(geoPublishRecords.articleId, task.articleId)))
        .orderBy(desc(geoPublishRecords.createdAt))
        .limit(20);
      const matchedPublishRecord =
        existingPublishRecordRows.find(row => row.publishUrl.trim() === trimmedUrl) ?? existingPublishRecordRows[0];

      const publishRecordId = matchedPublishRecord
        ? matchedPublishRecord.id
        : (
            await db
              .insert(geoPublishRecords)
              .values({
                projectId: task.projectId,
                articleId: task.articleId,
                optimizationTaskId: article.optimizationTaskId,
                publishChannel: channel,
                publishTitle: task.articleTitle,
                publishUrl: trimmedUrl,
                publishStatus: "已发布",
                qualityScore: latestScore?.totalScore ?? getGeoArticleMinPassScore(),
                needRetest: 1,
                notes: "发布完成后人工回填公开链接",
              })
              .$returningId()
          )[0]?.id;

      if (!publishRecordId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "创建发布记录失败" });
      }

      const existingMonitoringRows = await db
        .select({ id: geoInclusionMonitoringRecords.id })
        .from(geoInclusionMonitoringRecords)
        .where(eq(geoInclusionMonitoringRecords.publishRecordId, publishRecordId))
        .limit(1);
      if (existingMonitoringRows.length === 0) {
        await db.insert(geoInclusionMonitoringRecords).values(
          buildInitialInclusionMonitoringRecord({
            projectId: task.projectId,
            articleId: task.articleId,
            publishRecordId,
            publicUrl: trimmedUrl,
            qualityScore: latestScore?.totalScore ?? getGeoArticleMinPassScore(),
            rawJsonSource: "publish_task_backfill",
            rawJsonCreatedBy: "publishTasks.backfillPublicUrl",
          }),
        );
      }

      await markGeoArticlePublishedAt(db, article.id, {
        publicPath: trimmedUrl,
      });

      return { ok: true, taskId: task.id, publishRecordId } as const;
    }),

  retry: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        taskId: z.number().int().positive(),
        reason: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDbConn();
      const ownerUserId = getCurrentUserId(ctx);
      await requireProjectAccessConn(db, ownerUserId, input.projectId);
      return retryFailedPublishTask(db, input);
    }),

  latestByArticle: protectedProcedure
    .input(
      z.object({
        articleId: z.number().int().positive(),
        projectId: z.number().int().positive(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      const ownerUserId = getCurrentUserId(ctx);
      await requireProjectAccessConn(db, ownerUserId, input.projectId);
      const rows = await db
        .select({
          id: publishTasks.id,
          platform: publishTasks.platform,
          status: publishTasks.status,
          accountVerificationStatus: publishTasks.accountVerificationStatus,
          expectedAccountName: publishTasks.expectedAccountName,
          detectedAccountName: publishTasks.detectedAccountName,
          localProfileId: publishTasks.localProfileId,
          resultUrl: publishTasks.resultUrl,
          draftUrl: publishTasks.draftUrl,
          publishedUrl: publishTasks.publishedUrl,
          agentErrorType: publishTasks.agentErrorType,
          agentErrorMessage: publishTasks.agentErrorMessage,
          agentLog: publishTasks.agentLog,
          agentPickedAt: publishTasks.agentPickedAt,
          agentFinishedAt: publishTasks.agentFinishedAt,
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

  /** @legacy Chrome 插件打包下载，主发布链路已切 Local Agent，保留供交付回滚 */
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
