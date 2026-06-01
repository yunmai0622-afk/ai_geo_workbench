import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { SystemNotificationType } from "@shared/systemNotificationDisplay";
import {
  GEO_WEB_PATH_AI_DIAGNOSIS,
  GEO_WEB_PATH_PUBLISH_RECORDS,
  buildProjectScopedUrl,
} from "@shared/geoWebPaths";
import { resolveT0ContentGapSuggestions } from "./t0ContentGapSuggestions";
import { projects, systemNotifications, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { sendSimpleEmail } from "./email";
import type { DbConn } from "./projectAccess";

async function resolveProjectOwner(db: DbConn, projectId: number) {
  const rows = await db
    .select({
      ownerUserId: projects.ownerUserId,
      enterpriseName: projects.enterpriseName,
      ownerEmail: users.email,
    })
    .from(projects)
    .leftJoin(users, eq(projects.ownerUserId, users.id))
    .where(eq(projects.id, projectId))
    .limit(1);
  const row = rows[0];
  if (!row?.ownerUserId) return null;
  return {
    ownerUserId: row.ownerUserId,
    enterpriseName: row.enterpriseName,
    ownerEmail: row.ownerEmail?.trim() || null,
  };
}

function resolveEmailViewUrl(projectId: number, path: string): string | null {
  const base = ENV.appPublicUrl.trim();
  if (!base) return null;
  try {
    return buildProjectScopedUrl(base, path, projectId);
  } catch {
    return null;
  }
}

async function notifyOwnerByEmail(input: {
  ownerEmail: string | null;
  subject: string;
  result: string;
  viewUrl?: string | null;
}) {
  if (!input.ownerEmail) return;
  await sendSimpleEmail({
    to: input.ownerEmail,
    subject: input.subject,
    result: input.result,
    viewUrl: input.viewUrl,
  });
}

export async function createSystemNotification(db: DbConn, input: { userId: number; projectId?: number | null; type: SystemNotificationType; title: string; content: string; }) {
  await db.insert(systemNotifications).values({ userId: input.userId, projectId: input.projectId ?? null, type: input.type, title: input.title, content: input.content });
}

export async function listUserNotifications(db: DbConn, userId: number, limit = 30) {
  const items = await db.select().from(systemNotifications).where(eq(systemNotifications.userId, userId)).orderBy(desc(systemNotifications.createdAt)).limit(limit);
  const unreadRows = await db.select({ count: sql<number>`count(*)` }).from(systemNotifications).where(and(eq(systemNotifications.userId, userId), isNull(systemNotifications.readAt)));
  return { items, unreadCount: Number(unreadRows[0]?.count ?? 0) };
}

export async function markNotificationRead(db: DbConn, userId: number, notificationId: number) {
  const result = await db.update(systemNotifications).set({ readAt: new Date() }).where(and(eq(systemNotifications.id, notificationId), eq(systemNotifications.userId, userId), isNull(systemNotifications.readAt)));
  const affectedRows = typeof result === "object" && result !== null && "affectedRows" in result ? Number((result as { affectedRows: number }).affectedRows) : 0;
  return affectedRows > 0;
}

export async function markAllNotificationsRead(db: DbConn, userId: number) {
  const result = await db.update(systemNotifications).set({ readAt: new Date() }).where(and(eq(systemNotifications.userId, userId), isNull(systemNotifications.readAt)));
  return typeof result === "object" && result !== null && "affectedRows" in result ? Number((result as { affectedRows: number }).affectedRows) : 0;
}

export async function emitT0CompleteNotification(db: DbConn, projectId: number, roundName: string) {
  const owner = await resolveProjectOwner(db, projectId);
  if (!owner) return;
  const title = "T0 检测完成";
  const gapSuggestions = await resolveT0ContentGapSuggestions(db, projectId).catch(() => null);
  const gapHint =
    gapSuggestions && gapSuggestions.items.length > 0
      ? ` 工作台已推送 ${gapSuggestions.items.length} 条内容缺口建议，可一键进入内容生成。`
      : "";
  const content = `${owner.enterpriseName} 的 ${roundName} 已完成，可在 AI 实测诊断页查看结果。${gapHint}`;
  await createSystemNotification(db, { userId: owner.ownerUserId, projectId, type: "t0_complete", title, content });
  await notifyOwnerByEmail({
    ownerEmail: owner.ownerEmail,
    subject: title,
    result: content,
    viewUrl: resolveEmailViewUrl(projectId, GEO_WEB_PATH_AI_DIAGNOSIS),
  });
}

export async function emitT1RetestCompleteNotification(db: DbConn, projectId: number, roundName: string) {
  const owner = await resolveProjectOwner(db, projectId);
  if (!owner) return;
  await createSystemNotification(db, { userId: owner.ownerUserId, projectId, type: "t1_retest_complete", title: "T1 复测完成", content: `${owner.enterpriseName} 的 ${roundName} 已完成，可在交付报告页查看 T0/T1 对比。` });
}

export async function emitPublishSuccessNotification(db: DbConn, projectId: number, articleTitle: string, platform?: string | null) {
  const owner = await resolveProjectOwner(db, projectId);
  if (!owner) return;
  const platformLabel = platform?.trim() ? `${platform} ` : "";
  const title = "内容发布成功";
  const content = `${owner.enterpriseName} 的内容「${articleTitle}」已在${platformLabel}发布成功。`;
  await createSystemNotification(db, { userId: owner.ownerUserId, projectId, type: "publish_success", title, content });
  await notifyOwnerByEmail({
    ownerEmail: owner.ownerEmail,
    subject: title,
    result: content,
    viewUrl: resolveEmailViewUrl(projectId, GEO_WEB_PATH_PUBLISH_RECORDS),
  });
}

export async function emitPublishFailedNotification(db: DbConn, projectId: number, articleTitle: string, reason?: string | null) {
  const owner = await resolveProjectOwner(db, projectId);
  if (!owner) return;
  const reasonText = reason?.trim() ? `原因：${reason.trim()}` : "请前往发布记录查看详情。";
  await createSystemNotification(db, { userId: owner.ownerUserId, projectId, type: "publish_failed", title: "发布失败", content: `${owner.enterpriseName} 的内容「${articleTitle}」发布失败。${reasonText}` });
}
