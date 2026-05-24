import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { projectPlatformAccounts, projects, publishTasks } from "../drizzle/schema";
import { getDb } from "./db";
import { isAccountGroupType, isPublishIdentity } from "@shared/contentStrategy";
import {
  BINDING_PUBLISH_PLATFORMS,
  isBindingPublishPlatform,
  matchPlatformAccountNames,
  platformAccountInvalidMessage,
  publishBlockedNoAccountMessage,
  publishMismatchMessage,
  publishMustSelectAccountMessage,
  publishUnknownAccountMessage,
  type BindingPublishPlatform,
} from "@shared/platformAccountVerify";

type DbConn = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export const bindingPlatformZod = z.enum(BINDING_PUBLISH_PLATFORMS);

export type PlatformAccountRecord = typeof projectPlatformAccounts.$inferSelect;

export type PlatformAccountDto = {
  id: number;
  accountName: string;
  accountIdOrUrl: string;
  accountGroup: string | null;
  accountRole: string | null;
  isEnabled: boolean;
  verificationStatus: string;
  lastVerifiedAt: Date | null;
  lastDetectedAccountName: string | null;
  notes: string;
};

function toDto(row: PlatformAccountRecord): PlatformAccountDto {
  return {
    id: row.id,
    accountName: row.accountName,
    accountIdOrUrl: row.accountIdOrUrl ?? "",
    accountGroup: row.accountGroup ?? null,
    accountRole: row.accountRole ?? null,
    isEnabled: row.isEnabled === 1,
    verificationStatus: row.verificationStatus,
    lastVerifiedAt: row.lastVerifiedAt ?? null,
    lastDetectedAccountName: row.lastDetectedAccountName ?? null,
    notes: row.notes ?? "",
  };
}

function validateAccountMeta(accountGroup?: string | null, accountRole?: string | null) {
  if (accountGroup != null && accountGroup !== "" && !isAccountGroupType(accountGroup)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "账号组无效" });
  }
  if (accountRole != null && accountRole !== "" && !isPublishIdentity(accountRole)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "账号身份无效" });
  }
}

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

async function getAccountRowById(db: DbConn, accountId: number) {
  const rows = await db.select().from(projectPlatformAccounts).where(eq(projectPlatformAccounts.id, accountId)).limit(1);
  return rows[0] ?? null;
}

export async function getEnabledPlatformAccounts(
  db: DbConn,
  projectId: number,
  platform: BindingPublishPlatform,
): Promise<PlatformAccountDto[]> {
  const rows = await db
    .select()
    .from(projectPlatformAccounts)
    .where(
      and(
        eq(projectPlatformAccounts.projectId, projectId),
        eq(projectPlatformAccounts.platform, platform),
        eq(projectPlatformAccounts.isEnabled, 1),
      ),
    );
  return rows.filter(r => r.accountName?.trim()).map(toDto);
}

/** 兼容旧逻辑：返回第一个启用账号 */
export async function getEnabledPlatformAccount(db: DbConn, projectId: number, platform: string) {
  if (!isBindingPublishPlatform(platform)) return null;
  const rows = await getEnabledPlatformAccounts(db, projectId, platform);
  const first = rows[0];
  if (!first) return null;
  return (await getAccountRowById(db, first.id))!;
}

export async function getEnabledPlatformAccountById(
  db: DbConn,
  input: { projectId: number; platform: BindingPublishPlatform; platformAccountId: number },
): Promise<PlatformAccountRecord> {
  const row = await getAccountRowById(db, input.platformAccountId);
  if (
    !row ||
    row.projectId !== input.projectId ||
    row.platform !== input.platform ||
    row.isEnabled !== 1 ||
    !row.accountName?.trim()
  ) {
    throw new TRPCError({ code: "BAD_REQUEST", message: platformAccountInvalidMessage(input.platform) });
  }
  return row;
}

export async function resolvePublishPlatformAccount(
  db: DbConn,
  input: {
    projectId: number;
    platform: BindingPublishPlatform;
    platformAccountId?: number | null;
  },
): Promise<PlatformAccountRecord> {
  if (input.platformAccountId != null) {
    return getEnabledPlatformAccountById(db, {
      projectId: input.projectId,
      platform: input.platform,
      platformAccountId: input.platformAccountId,
    });
  }
  const enabled = await getEnabledPlatformAccounts(db, input.projectId, input.platform);
  if (enabled.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: publishBlockedNoAccountMessage(input.platform) });
  }
  if (enabled.length === 1) {
    const row = await getAccountRowById(db, enabled[0]!.id);
    if (!row) throw new TRPCError({ code: "BAD_REQUEST", message: platformAccountInvalidMessage(input.platform) });
    return row;
  }
  throw new TRPCError({ code: "BAD_REQUEST", message: publishMustSelectAccountMessage(input.platform) });
}

export async function listProjectPlatformAccountsForProject(db: DbConn, projectId: number) {
  const rows = await db
    .select()
    .from(projectPlatformAccounts)
    .where(eq(projectPlatformAccounts.projectId, projectId));
  const grouped = new Map<string, PlatformAccountDto[]>();
  for (const row of rows) {
    const list = grouped.get(row.platform) ?? [];
    list.push(toDto(row));
    grouped.set(row.platform, list);
  }
  return BINDING_PUBLISH_PLATFORMS.map(platform => ({
    platform,
    accounts: grouped.get(platform) ?? [],
  }));
}

async function assertUniqueAccountName(
  db: DbConn,
  projectId: number,
  platform: BindingPublishPlatform,
  accountName: string,
  excludeId?: number,
) {
  const rows = await db
    .select({ id: projectPlatformAccounts.id })
    .from(projectPlatformAccounts)
    .where(
      and(
        eq(projectPlatformAccounts.projectId, projectId),
        eq(projectPlatformAccounts.platform, platform),
        eq(projectPlatformAccounts.accountName, accountName),
      ),
    );
  const dup = rows.find(r => r.id !== excludeId);
  if (dup) {
    throw new TRPCError({ code: "CONFLICT", message: "该平台下已存在同名账号，请使用其他昵称" });
  }
}

export async function createProjectPlatformAccount(
  db: DbConn,
  input: {
    projectId: number;
    platform: BindingPublishPlatform;
    accountName: string;
    accountIdOrUrl?: string | null;
    accountGroup?: string | null;
    accountRole?: string | null;
    isEnabled?: boolean;
    notes?: string | null;
  },
) {
  validateAccountMeta(input.accountGroup, input.accountRole);
  await getProjectOrThrowConn(db, input.projectId);
  const accountName = input.accountName.trim();
  await assertUniqueAccountName(db, input.projectId, input.platform, accountName);

  const inserted = await db
    .insert(projectPlatformAccounts)
    .values({
      projectId: input.projectId,
      platform: input.platform,
      accountName,
      accountIdOrUrl: input.accountIdOrUrl?.trim() || null,
      accountGroup: input.accountGroup?.trim() || null,
      accountRole: input.accountRole?.trim() || null,
      isEnabled: input.isEnabled === false ? 0 : 1,
      notes: input.notes?.trim() || null,
    })
    .$returningId();
  const id = inserted[0]?.id;
  if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "创建平台账号失败" });
  const row = await getAccountRowById(db, id);
  return row!;
}

export async function updateProjectPlatformAccount(
  db: DbConn,
  input: {
    projectId: number;
    accountId: number;
    accountName: string;
    accountIdOrUrl?: string | null;
    accountGroup?: string | null;
    accountRole?: string | null;
    isEnabled?: boolean;
    notes?: string | null;
  },
) {
  validateAccountMeta(input.accountGroup, input.accountRole);
  const existing = await getAccountRowById(db, input.accountId);
  if (!existing || existing.projectId !== input.projectId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "账号不存在或不属于当前企业" });
  }
  const accountName = input.accountName.trim();
  await assertUniqueAccountName(
    db,
    input.projectId,
    existing.platform as BindingPublishPlatform,
    accountName,
    existing.id,
  );

  await db
    .update(projectPlatformAccounts)
    .set({
      accountName,
      accountIdOrUrl: input.accountIdOrUrl?.trim() || null,
      accountGroup: input.accountGroup?.trim() || null,
      accountRole: input.accountRole?.trim() || null,
      isEnabled: input.isEnabled === false ? 0 : 1,
      notes: input.notes?.trim() || null,
    })
    .where(eq(projectPlatformAccounts.id, existing.id));

  return (await getAccountRowById(db, existing.id))!;
}

export async function deleteProjectPlatformAccount(db: DbConn, input: { projectId: number; accountId: number }) {
  const existing = await getAccountRowById(db, input.accountId);
  if (!existing || existing.projectId !== input.projectId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "账号不存在或不属于当前企业" });
  }
  await db.delete(projectPlatformAccounts).where(eq(projectPlatformAccounts.id, existing.id));
  return { success: true } as const;
}

export async function togglePlatformAccountEnabled(
  db: DbConn,
  input: { projectId: number; accountId: number; enabled: boolean },
) {
  const existing = await getAccountRowById(db, input.accountId);
  if (!existing || existing.projectId !== input.projectId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "账号不存在或不属于当前企业" });
  }
  await db
    .update(projectPlatformAccounts)
    .set({ isEnabled: input.enabled ? 1 : 0 })
    .where(eq(projectPlatformAccounts.id, existing.id));
  return (await getAccountRowById(db, existing.id))!;
}

/** 兼容：同 project/platform/accountName 存在则更新，否则创建 */
export async function upsertProjectPlatformAccountRecord(
  db: DbConn,
  input: {
    projectId: number;
    platform: BindingPublishPlatform;
    accountName: string;
    accountIdOrUrl?: string | null;
    accountGroup?: string | null;
    accountRole?: string | null;
    isEnabled?: boolean;
    notes?: string | null;
  },
) {
  const accountName = input.accountName.trim();
  const rows = await db
    .select()
    .from(projectPlatformAccounts)
    .where(
      and(
        eq(projectPlatformAccounts.projectId, input.projectId),
        eq(projectPlatformAccounts.platform, input.platform),
        eq(projectPlatformAccounts.accountName, accountName),
      ),
    )
    .limit(1);

  if (rows[0]) {
    return updateProjectPlatformAccount(db, {
      projectId: input.projectId,
      accountId: rows[0].id,
      accountName,
      accountIdOrUrl: input.accountIdOrUrl,
      accountGroup: input.accountGroup,
      accountRole: input.accountRole,
      isEnabled: input.isEnabled,
      notes: input.notes,
    });
  }
  return createProjectPlatformAccount(db, input);
}

export async function verifyPlatformAccountForProjectRecord(
  db: DbConn,
  input: {
    projectId: number;
    platform: BindingPublishPlatform;
    accountId?: number;
    detectedAccountName?: string | null | undefined;
    verificationSource?: "plugin" | "manual";
  },
) {
  const accountRow = input.accountId
    ? await getEnabledPlatformAccountById(db, {
        projectId: input.projectId,
        platform: input.platform,
        platformAccountId: input.accountId,
      })
    : await getEnabledPlatformAccount(db, input.projectId, input.platform);

  if (!accountRow) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "当前企业尚未配置该平台绑定账号" });
  }

  const result = matchPlatformAccountNames(accountRow.accountName, input.detectedAccountName);
  const detected = result.detectedAccountName;
  const status = !detected && result.status === "login_required" ? "login_required" : result.status;

  await db
    .update(projectPlatformAccounts)
    .set({
      verificationStatus: status,
      lastVerifiedAt: new Date(),
      lastDetectedAccountName: detected,
    })
    .where(eq(projectPlatformAccounts.id, accountRow.id));

  return {
    platformAccountId: accountRow.id,
    expectedAccountName: accountRow.accountName,
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
