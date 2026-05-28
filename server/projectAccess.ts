import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import type { Project } from "../drizzle/schema";
import {
  aiResponses,
  analysisResults,
  geoArticles,
  geoInclusionMonitoringRecords,
  projects,
  publishTasks,
  questions,
  testRounds,
} from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";

export const PROJECT_ACCESS_FORBIDDEN_MSG = "无权访问该客户项目";

/**
 * 当前登录用户 id（来自 session cookie → sdk.authenticateRequest → ctx.user）。
 * 本地开发：auth.devLogin / Manus OAuth 写入 users 表后同样走此路径。
 */
export function getCurrentUserId(ctx: TrpcContext): number {
  if (!ctx.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "请先登录" });
  }
  return ctx.user.id;
}

export async function listAccessibleProjectIds(ctx: TrpcContext): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const userId = getCurrentUserId(ctx);
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.ownerUserId, userId))
    .orderBy(projects.createdAt);
  return rows.map(r => r.id);
}

export async function listAccessibleProjects(ctx: TrpcContext): Promise<Project[]> {
  const db = await getDb();
  if (!db) return [];
  const userId = getCurrentUserId(ctx);
  return db.select().from(projects).where(eq(projects.ownerUserId, userId)).orderBy(projects.createdAt);
}

/** Web / protectedProcedure：校验 projectId 归属当前用户 */
export async function requireProjectAccess(ctx: TrpcContext, projectId: number): Promise<Project> {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
  }
  const userId = getCurrentUserId(ctx);
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerUserId, userId)))
    .limit(1);
  if (!rows[0]) {
    throw new TRPCError({ code: "FORBIDDEN", message: PROJECT_ACCESS_FORBIDDEN_MSG });
  }
  return rows[0];
}

export type DbConn = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** 已有 db 连接时校验归属（publishTasks / platformAccounts 等） */
export async function requireProjectAccessConn(
  db: DbConn,
  ownerUserId: number,
  projectId: number,
): Promise<Project> {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerUserId, ownerUserId)))
    .limit(1);
  if (!rows[0]) {
    throw new TRPCError({ code: "FORBIDDEN", message: PROJECT_ACCESS_FORBIDDEN_MSG });
  }
  return rows[0];
}

/**
 * Agent / 插件等无 Web session 时加载项目行。
 * - 传入 `userId`：必须 `project.ownerUserId === userId`，否则 FORBIDDEN（防 IDOR）。
 * - 不传 `userId`（纯 localAgentId / 公开只读等）：仅确认项目存在。
 *   风险：调用方须用其它机制约束访问范围（如 task.localAgentId、文章已发布状态）。
 */
export async function getProjectRowConn(
  db: DbConn,
  projectId: number,
  userId?: number,
): Promise<Project> {
  const rows = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!rows[0]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "企业项目不存在" });
  }
  if (userId != null && rows[0].ownerUserId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: PROJECT_ACCESS_FORBIDDEN_MSG });
  }
  return rows[0];
}

export async function filterAccessibleProjectIds(db: DbConn, projectIds: number[], ownerUserId: number): Promise<number[]> {
  if (projectIds.length === 0) return [];
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(inArray(projects.id, projectIds), eq(projects.ownerUserId, ownerUserId)));
  return rows.map(r => r.id);
}

async function requireDbConn(): Promise<DbConn> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
  return db;
}

/** 反查 projectId 后校验归属；资源不存在 → NOT_FOUND */
export async function requireQuestionAccess(ctx: TrpcContext, questionId: number): Promise<number> {
  const db = await requireDbConn();
  const rows = await db
    .select({ projectId: questions.projectId })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "问题不存在" });
  await requireProjectAccess(ctx, rows[0].projectId);
  return rows[0].projectId;
}

export async function requireQuestionAccessConn(db: DbConn, ctx: TrpcContext, questionId: number): Promise<number> {
  const rows = await db
    .select({ projectId: questions.projectId })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "问题不存在" });
  await requireProjectAccessConn(db, getCurrentUserId(ctx), rows[0].projectId);
  return rows[0].projectId;
}

export async function requireArticleAccess(ctx: TrpcContext, articleId: number): Promise<{ projectId: number; article: typeof geoArticles.$inferSelect }> {
  const db = await requireDbConn();
  const rows = await db.select().from(geoArticles).where(eq(geoArticles.id, articleId)).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "文章不存在" });
  await requireProjectAccess(ctx, rows[0].projectId);
  return { projectId: rows[0].projectId, article: rows[0] };
}

export async function requireArticleAccessConn(
  db: DbConn,
  ctx: TrpcContext,
  articleId: number,
): Promise<{ projectId: number; article: typeof geoArticles.$inferSelect }> {
  const rows = await db.select().from(geoArticles).where(eq(geoArticles.id, articleId)).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "文章不存在" });
  await requireProjectAccessConn(db, getCurrentUserId(ctx), rows[0].projectId);
  return { projectId: rows[0].projectId, article: rows[0] };
}

export async function requireAnalysisAccess(ctx: TrpcContext, analysisId: number): Promise<number> {
  const db = await requireDbConn();
  const rows = await db
    .select({ projectId: analysisResults.projectId })
    .from(analysisResults)
    .where(eq(analysisResults.id, analysisId))
    .limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "分析结果不存在" });
  await requireProjectAccess(ctx, rows[0].projectId);
  return rows[0].projectId;
}

export async function requireAiResponseAccess(ctx: TrpcContext, aiResponseId: number): Promise<number> {
  const db = await requireDbConn();
  const rows = await db
    .select({ projectId: aiResponses.projectId })
    .from(aiResponses)
    .where(eq(aiResponses.id, aiResponseId))
    .limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "AI 回答不存在" });
  await requireProjectAccess(ctx, rows[0].projectId);
  return rows[0].projectId;
}

export async function requireMonitoringRecordAccess(ctx: TrpcContext, monitoringRecordId: number): Promise<number> {
  const db = await requireDbConn();
  const rows = await db
    .select({ projectId: geoInclusionMonitoringRecords.projectId })
    .from(geoInclusionMonitoringRecords)
    .where(eq(geoInclusionMonitoringRecords.id, monitoringRecordId))
    .limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "监测记录不存在" });
  await requireProjectAccess(ctx, rows[0].projectId);
  return rows[0].projectId;
}

/** Web 侧按 publishTaskId 校验（Agent 回传走 apiKey/localAgentId，不走此函数） */
export async function requirePublishTaskAccessConn(
  db: DbConn,
  ctx: TrpcContext,
  taskId: number,
): Promise<{ projectId: number; task: typeof publishTasks.$inferSelect }> {
  const rows = await db.select().from(publishTasks).where(eq(publishTasks.id, taskId)).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "发布任务不存在" });
  await requireProjectAccessConn(db, getCurrentUserId(ctx), rows[0].projectId);
  return { projectId: rows[0].projectId, task: rows[0] };
}

/** 反查检测轮次归属后校验项目访问权 */
export async function requireTestRoundAccess(
  ctx: TrpcContext,
  roundId: string,
): Promise<{ projectId: number; round: typeof testRounds.$inferSelect }> {
  const db = await requireDbConn();
  const rows = await db.select().from(testRounds).where(eq(testRounds.id, roundId)).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "检测轮次不存在" });
  await requireProjectAccess(ctx, rows[0].projectId);
  return { projectId: rows[0].projectId, round: rows[0] };
}
