import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { SystemNotificationType } from "@shared/systemNotificationDisplay";
import { projects, systemNotifications } from "../drizzle/schema";
import type { DbConn } from "./projectAccess";

async function resolveProjectOwner(db: DbConn, projectId: number) {
  const rows = await db.select({ ownerUserId: projects.ownerUserId, enterpriseName: projects.enterpriseName }).from(projects).where(eq(projects.id, projectId)).limit(1);
  const row = rows[0];
  if (!row?.ownerUserId) return null;
  return { ownerUserId: row.ownerUserId, enterpriseName: row.enterpriseName };
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
  await createSystemNotification(db, { userId: owner.ownerUserId, projectId, type: "t0_complete", title: "T0 检测完成", content: `${owner.enterpriseName} 的 ${roundName} 已完成，可在 AI 实测诊断页查看结果。` });
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
  await createSystemNotification(db, { userId: owner.ownerUserId, projectId, type: "publish_success", title: "内容发布成功", content: `${owner.enterpriseName} 的内容「${articleTitle}」已在${platformLabel}发布成功。` });
}

export async function emitPublishFailedNotification(db: DbConn, projectId: number, articleTitle: string, reason?: string | null) {
  const owner = await resolveProjectOwner(db, projectId);
  if (!owner) return;
  const reasonText = reason?.trim() ? `原因：${reason.trim()}` : "请前往发布记录查看详情。";
  await createSystemNotification(db, { userId: owner.ownerUserId, projectId, type: "publish_failed", title: "发布失败", content: `${owner.enterpriseName} 的内容「${articleTitle}」发布失败。${reasonText}` });
}
