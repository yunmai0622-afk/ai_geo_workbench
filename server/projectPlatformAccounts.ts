import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { projectPlatformAccounts, projects, publishTasks } from "../drizzle/schema";
import { getDb } from "./db";
import {
  BINDING_PUBLISH_PLATFORMS,
  isBindingPublishPlatform,
  matchPlatformAccountNames,
  publishMismatchMessage,
  publishUnknownAccountMessage,
  type BindingPublishPlatform,
} from "@shared/platformAccountVerify";

type DbConn = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export const bindingPlatformZod = z.enum(BINDING_PUBLISH_PLATFORMS);

export async function requireDbConn(): Promise<DbConn> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
  return db;
}

export async function getProjectOrThrowConn(db: DbConn, projectId: number) {
  const rows = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  const project = rows[0];
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "企业项目不存在" });
  return project;
}

export async function getEnabledPlatformAccount(db: DbConn, projectId: number, platform: string) {
  if (!isBindingPublishPlatform(platform)) return null;
  const rows = await db
    .select()
    .from(projectPlatformAccounts)
    .where(
      and(
        eq(projectPlatformAccounts.projectId, projectId),
        eq(projectPlatformAccounts.platform, platform),
        eq(projectPlatformAccounts.isEnabled, 1),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row || !row.accountName?.trim()) return null;
  return row;
}

export async function listProjectPlatformAccountsForProject(db: DbConn, projectId: number) {
  const rows = await db
    .select()
    .from(projectPlatformAccounts)
    .where(eq(projectPlatformAccounts.projectId, projectId));
  const byPlatform = new Map(rows.map(r => [r.platform, r]));
  return BINDING_PUBLISH_PLATFORMS.map(platform => {
    const row = byPlatform.get(platform);
    return {
      platform,
      id: row?.id ?? null,
      accountName: row?.accountName ?? "",
      accountIdOrUrl: row?.accountIdOrUrl ?? "",
      isEnabled: row ? row.isEnabled === 1 : false,
      verificationStatus: row?.verificationStatus ?? "unknown",
      lastVerifiedAt: row?.lastVerifiedAt ?? null,
      lastDetectedAccountName: row?.lastDetectedAccountName ?? null,
      notes: row?.notes ?? "",
    };
  });
}

export async function upsertProjectPlatformAccountRecord(
  db: DbConn,
  input: {
    projectId: number;
    platform: BindingPublishPlatform;
    accountName: string;
    accountIdOrUrl?: string | null;
    isEnabled?: boolean;
    notes?: string | null;
  },
) {
  await getProjectOrThrowConn(db, input.projectId);
  const existing = await db
    .select()
    .from(projectPlatformAccounts)
    .where(and(eq(projectPlatformAccounts.projectId, input.projectId), eq(projectPlatformAccounts.platform, input.platform)))
    .limit(1);

  const payload = {
    projectId: input.projectId,
    platform: input.platform,
    accountName: input.accountName.trim(),
    accountIdOrUrl: input.accountIdOrUrl?.trim() || null,
    isEnabled: input.isEnabled === false ? 0 : 1,
    notes: input.notes?.trim() || null,
  };

  if (existing[0]) {
    await db.update(projectPlatformAccounts).set(payload).where(eq(projectPlatformAccounts.id, existing[0].id));
    const updated = await db.select().from(projectPlatformAccounts).where(eq(projectPlatformAccounts.id, existing[0].id)).limit(1);
    return updated[0]!;
  }

  const inserted = await db.insert(projectPlatformAccounts).values(payload).$returningId();
  const id = inserted[0]?.id;
  if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "保存平台账号失败" });
  const rows = await db.select().from(projectPlatformAccounts).where(eq(projectPlatformAccounts.id, id)).limit(1);
  return rows[0]!;
}

export async function verifyPlatformAccountForProjectRecord(
  db: DbConn,
  input: {
    projectId: number;
    platform: BindingPublishPlatform;
    detectedAccountName?: string | null | undefined;
    verificationSource?: "plugin" | "manual";
  },
) {
  const account = await getEnabledPlatformAccount(db, input.projectId, input.platform);
  if (!account) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "当前企业尚未配置该平台绑定账号" });
  }

  const result = matchPlatformAccountNames(account.accountName, input.detectedAccountName);
  const detected = result.detectedAccountName;
  const status = !detected && result.status === "login_required" ? "login_required" : result.status;

  await db
    .update(projectPlatformAccounts)
    .set({
      verificationStatus: status,
      lastVerifiedAt: new Date(),
      lastDetectedAccountName: detected,
    })
    .where(eq(projectPlatformAccounts.id, account.id));

  return {
    platformAccountId: account.id,
    expectedAccountName: account.accountName,
    detectedAccountName: detected,
    matched: result.matched,
    status,
    message: result.message,
    verificationSource: input.verificationSource ?? "manual",
  } as const;
}

export async function verifyPublishTaskAccount(
  db: DbConn,
  input: { taskId: number; apiKey: string; detectedAccountName?: string | null | undefined },
) {
  const taskRows = await db.select().from(publishTasks).where(eq(publishTasks.id, input.taskId)).limit(1);
  const task = taskRows[0];
  if (!task || task.apiKey !== input.apiKey) {
    throw new TRPCError({ code: "NOT_FOUND", message: "发布任务不存在或无权操作" });
  }

  const project = await getProjectOrThrowConn(db, task.projectId);
  const expected = task.expectedAccountName ?? "";
  const platform = task.platform;

  let matchResult = matchPlatformAccountNames(expected, input.detectedAccountName);
  if (!input.detectedAccountName?.trim()) {
    matchResult = {
      ...matchResult,
      matched: false,
      status: "unknown",
      message: publishUnknownAccountMessage(platform),
    };
  }

  const detected = matchResult.detectedAccountName;
  const verificationStatus = matchResult.matched ? "matched" : matchResult.status;

  const errorMessage = matchResult.matched
    ? null
    : matchResult.status === "mismatched"
      ? publishMismatchMessage({
          projectName: task.projectName ?? project.enterpriseName,
          expectedAccountName: expected,
          detectedAccountName: detected ?? "",
        })
      : publishUnknownAccountMessage(platform);

  await db
    .update(publishTasks)
    .set(
      matchResult.matched
        ? {
            detectedAccountName: detected,
            accountVerificationStatus: "matched",
            errorMessage: null,
          }
        : {
            detectedAccountName: detected,
            accountVerificationStatus: verificationStatus,
            status: "failed",
            errorMessage,
          },
    )
    .where(eq(publishTasks.id, task.id));

  if (task.platformAccountId && isBindingPublishPlatform(platform)) {
    await db
      .update(projectPlatformAccounts)
      .set({
        verificationStatus,
        lastVerifiedAt: new Date(),
        lastDetectedAccountName: detected,
      })
      .where(eq(projectPlatformAccounts.id, task.platformAccountId));
  }

  return {
    taskId: task.id,
    projectId: task.projectId,
    projectName: task.projectName ?? project.enterpriseName,
    platform,
    expectedAccountName: expected,
    detectedAccountName: detected,
    matched: matchResult.matched,
    status: verificationStatus,
    message: matchResult.message,
  } as const;
}
