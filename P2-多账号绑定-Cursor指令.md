# P2：平台多账号绑定 — Cursor 增量改造指令

> **写在最前的约束**
> - 禁止新建 Vue / Express / Prisma 项目；只在现有 React + tRPC + Drizzle 栈上增量改
> - 禁止引入新 UI 框架，使用已有 shadcn/ui 组件库
> - 数据库迁移使用 Drizzle Migration，不写裸 SQL

---

## 背景与问题

**现状痛点**：`project_platform_accounts` 表有一个 `uniqueIndex("project_platform_accounts_project_platform").on(table.projectId, table.platform)`，强制每个企业项目在每个平台只能绑定一个账号。

**业务需求**：一个企业客户可能同时运营多个头条号、多个知乎号、多个百家号。代理商需要能为同一个客户项目绑定多个同平台账号，发布时按需选择投放到哪个账号。

**竞品方案**：集星云推用独立账号管理模块（分组列表 + 多行账号 + 平台筛选），账号与项目解耦，所有账号池化。

**我们的方案**（保持与现有架构一致，避免大重构）：
- 移除唯一约束，改为 `(projectId, platform, accountName)` 三元组唯一（同一项目下同一平台不能有同名账号）
- `upsert` 改为 `create` + `updateById`（不再按 platform 去 update，改为按 id）
- 发布时的账号选择：`publishTasks` 已有 `platformAccountId` 字段，发布流程改为从该项目下该平台的**已启用账号列表**中选择一个，而非仅取第一条

---

## STEP 1：Drizzle Schema 修改

**操作文件：`drizzle/schema.ts`**

找到 `projectPlatformAccounts` 表的定义（约第 612 行）：

```typescript
// 现有代码（需修改）：
export const projectPlatformAccounts = mysqlTable(
  "project_platform_accounts",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    platform: varchar("platform", { length: 50 }).notNull(),
    accountName: varchar("accountName", { length: 255 }).notNull(),
    accountIdOrUrl: varchar("accountIdOrUrl", { length: 2000 }),
    accountGroup: varchar("accountGroup", { length: 50 }),
    accountRole: varchar("accountRole", { length: 50 }),
    isEnabled: int("isEnabled").default(1).notNull(),
    verificationStatus: varchar("verificationStatus", { length: 32 }).default("unknown").notNull(),
    lastVerifiedAt: timestamp("lastVerifiedAt"),
    lastDetectedAccountName: varchar("lastDetectedAccountName", { length: 255 }),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    projectPlatformUnique: uniqueIndex("project_platform_accounts_project_platform").on(table.projectId, table.platform),
  }),
);
```

**替换为**（只改最后的 index 部分）：

```typescript
export const projectPlatformAccounts = mysqlTable(
  "project_platform_accounts",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    platform: varchar("platform", { length: 50 }).notNull(),
    accountName: varchar("accountName", { length: 255 }).notNull(),
    accountIdOrUrl: varchar("accountIdOrUrl", { length: 2000 }),
    accountGroup: varchar("accountGroup", { length: 50 }),
    accountRole: varchar("accountRole", { length: 50 }),
    isEnabled: int("isEnabled").default(1).notNull(),
    verificationStatus: varchar("verificationStatus", { length: 32 }).default("unknown").notNull(),
    lastVerifiedAt: timestamp("lastVerifiedAt"),
    lastDetectedAccountName: varchar("lastDetectedAccountName", { length: 255 }),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    // 旧的 (projectId, platform) 二元唯一约束已移除
    // 改为三元约束：同一项目、同一平台、账号昵称不能重复
    projectPlatformNameUnique: uniqueIndex("project_platform_accounts_project_platform_name").on(
      table.projectId,
      table.platform,
      table.accountName,
    ),
  }),
);
```

---

## STEP 2：生成数据库 Migration

在项目根目录运行：

```bash
npx drizzle-kit generate
```

然后运行迁移（按项目实际命令）：

```bash
npx drizzle-kit migrate
# 或
npx drizzle-kit push
```

> **迁移说明**：这个迁移会 DROP 旧的 `project_platform_accounts_project_platform` 唯一索引，创建新的 `project_platform_accounts_project_platform_name` 三元唯一索引。现有数据不丢失。若有重复 `(projectId, platform)` 的旧数据，迁移前先查一下（通常不会有，因为旧约束已经保证了唯一性）。

---

## STEP 3：修改 server/projectPlatformAccounts.ts

**全量替换该文件内容**（改动较多，整体重写更安全）：

```typescript
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

/** 获取某项目某平台的所有已启用账号（多账号） */
export async function getEnabledPlatformAccounts(db: DbConn, projectId: number, platform: string) {
  if (!isBindingPublishPlatform(platform)) return [];
  return db
    .select()
    .from(projectPlatformAccounts)
    .where(
      and(
        eq(projectPlatformAccounts.projectId, projectId),
        eq(projectPlatformAccounts.platform, platform),
        eq(projectPlatformAccounts.isEnabled, 1),
      ),
    );
}

/** 兼容旧接口：返回第一个已启用账号（用于单账号场景） */
export async function getEnabledPlatformAccount(db: DbConn, projectId: number, platform: string) {
  const rows = await getEnabledPlatformAccounts(db, projectId, platform);
  const row = rows[0];
  if (!row || !row.accountName?.trim()) return null;
  return row;
}

/** 列出某项目所有平台的所有账号（多账号版） */
export async function listProjectPlatformAccountsForProject(db: DbConn, projectId: number) {
  const rows = await db
    .select()
    .from(projectPlatformAccounts)
    .where(eq(projectPlatformAccounts.projectId, projectId))
    .orderBy(projectPlatformAccounts.platform, projectPlatformAccounts.createdAt);

  // 按平台分组，每个平台返回账号数组（支持多账号）
  const byPlatform = new Map<string, typeof rows>();
  for (const row of rows) {
    const existing = byPlatform.get(row.platform) ?? [];
    existing.push(row);
    byPlatform.set(row.platform, existing);
  }

  return BINDING_PUBLISH_PLATFORMS.map(platform => ({
    platform,
    accounts: (byPlatform.get(platform) ?? []).map(row => ({
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
    })),
  }));
}

/** 新增平台账号（不再 upsert，改为按 accountName 去重） */
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
  if (input.accountGroup != null && input.accountGroup !== "" && !isAccountGroupType(input.accountGroup)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "账号组无效" });
  }
  if (input.accountRole != null && input.accountRole !== "" && !isPublishIdentity(input.accountRole)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "账号身份无效" });
  }
  await getProjectOrThrowConn(db, input.projectId);

  // 检查同项目同平台是否已有同名账号（三元唯一约束前的应用层防护）
  const duplicate = await db
    .select()
    .from(projectPlatformAccounts)
    .where(
      and(
        eq(projectPlatformAccounts.projectId, input.projectId),
        eq(projectPlatformAccounts.platform, input.platform),
        eq(projectPlatformAccounts.accountName, input.accountName.trim()),
      ),
    )
    .limit(1);

  if (duplicate[0]) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `该平台下已存在同名账号「${input.accountName.trim()}」，请修改昵称后重试`,
    });
  }

  const payload = {
    projectId: input.projectId,
    platform: input.platform,
    accountName: input.accountName.trim(),
    accountIdOrUrl: input.accountIdOrUrl?.trim() || null,
    accountGroup: input.accountGroup?.trim() || null,
    accountRole: input.accountRole?.trim() || null,
    isEnabled: input.isEnabled === false ? 0 : 1,
    notes: input.notes?.trim() || null,
  };

  const inserted = await db.insert(projectPlatformAccounts).values(payload).$returningId();
  const id = inserted[0]?.id;
  if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "创建平台账号失败" });
  const rows = await db.select().from(projectPlatformAccounts).where(eq(projectPlatformAccounts.id, id)).limit(1);
  return rows[0]!;
}

/** 按 id 更新平台账号 */
export async function updateProjectPlatformAccount(
  db: DbConn,
  input: {
    id: number;
    projectId: number;
    accountName: string;
    accountIdOrUrl?: string | null;
    accountGroup?: string | null;
    accountRole?: string | null;
    isEnabled?: boolean;
    notes?: string | null;
  },
) {
  if (input.accountGroup != null && input.accountGroup !== "" && !isAccountGroupType(input.accountGroup)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "账号组无效" });
  }
  if (input.accountRole != null && input.accountRole !== "" && !isPublishIdentity(input.accountRole)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "账号身份无效" });
  }

  // 确认账号属于该项目
  const existing = await db
    .select()
    .from(projectPlatformAccounts)
    .where(and(eq(projectPlatformAccounts.id, input.id), eq(projectPlatformAccounts.projectId, input.projectId)))
    .limit(1);
  if (!existing[0]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "账号不存在或无权操作" });
  }

  // 若昵称变更，检查是否与同平台其他账号重名
  if (input.accountName.trim() !== existing[0].accountName) {
    const duplicate = await db
      .select()
      .from(projectPlatformAccounts)
      .where(
        and(
          eq(projectPlatformAccounts.projectId, input.projectId),
          eq(projectPlatformAccounts.platform, existing[0].platform),
          eq(projectPlatformAccounts.accountName, input.accountName.trim()),
        ),
      )
      .limit(1);
    if (duplicate[0]) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `该平台下已存在同名账号「${input.accountName.trim()}」`,
      });
    }
  }

  await db
    .update(projectPlatformAccounts)
    .set({
      accountName: input.accountName.trim(),
      accountIdOrUrl: input.accountIdOrUrl?.trim() || null,
      accountGroup: input.accountGroup?.trim() || null,
      accountRole: input.accountRole?.trim() || null,
      isEnabled: input.isEnabled === false ? 0 : 1,
      notes: input.notes?.trim() || null,
    })
    .where(eq(projectPlatformAccounts.id, input.id));

  const updated = await db.select().from(projectPlatformAccounts).where(eq(projectPlatformAccounts.id, input.id)).limit(1);
  return updated[0]!;
}

/** 按 id 删除单个账号 */
export async function deleteProjectPlatformAccount(db: DbConn, projectId: number, accountId: number) {
  const existing = await db
    .select()
    .from(projectPlatformAccounts)
    .where(and(eq(projectPlatformAccounts.id, accountId), eq(projectPlatformAccounts.projectId, projectId)))
    .limit(1);
  if (!existing[0]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "账号不存在或无权操作" });
  }
  await db.delete(projectPlatformAccounts).where(eq(projectPlatformAccounts.id, accountId));
  return { success: true } as const;
}

/** 按 id 切换启用状态 */
export async function togglePlatformAccountEnabled(db: DbConn, projectId: number, accountId: number, isEnabled: boolean) {
  const existing = await db
    .select()
    .from(projectPlatformAccounts)
    .where(and(eq(projectPlatformAccounts.id, accountId), eq(projectPlatformAccounts.projectId, projectId)))
    .limit(1);
  if (!existing[0]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "账号不存在或无权操作" });
  }
  await db
    .update(projectPlatformAccounts)
    .set({ isEnabled: isEnabled ? 1 : 0 })
    .where(eq(projectPlatformAccounts.id, accountId));
  return { success: true } as const;
}

/** 兼容旧接口：按 platform 禁用（保留给 publishTasksRouter 等调用方） */
export async function disableAllPlatformAccounts(db: DbConn, projectId: number, platform: string) {
  await db
    .update(projectPlatformAccounts)
    .set({ isEnabled: 0 })
    .where(and(eq(projectPlatformAccounts.projectId, projectId), eq(projectPlatformAccounts.platform, platform)));
  return { success: true } as const;
}

export async function verifyPlatformAccountForProjectRecord(
  db: DbConn,
  input: {
    projectId: number;
    platform: BindingPublishPlatform;
    accountId?: number | null;             // 新增：指定核验哪一个账号，不传则取第一个已启用
    detectedAccountName?: string | null | undefined;
    verificationSource?: "plugin" | "manual";
  },
) {
  let account: Awaited<ReturnType<typeof getEnabledPlatformAccount>>;
  if (input.accountId) {
    const rows = await db
      .select()
      .from(projectPlatformAccounts)
      .where(and(eq(projectPlatformAccounts.id, input.accountId), eq(projectPlatformAccounts.projectId, input.projectId)))
      .limit(1);
    account = rows[0] ?? null;
  } else {
    account = await getEnabledPlatformAccount(db, input.projectId, input.platform);
  }

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

// verifyPublishTaskAccount 保持不变（略，直接从原文件复制）
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
        ? { detectedAccountName: detected, accountVerificationStatus: "matched", errorMessage: null }
        : { detectedAccountName: detected, accountVerificationStatus: verificationStatus, status: "failed", errorMessage },
    )
    .where(eq(publishTasks.id, task.id));

  if (task.platformAccountId && isBindingPublishPlatform(platform)) {
    await db
      .update(projectPlatformAccounts)
      .set({ verificationStatus, lastVerifiedAt: new Date(), lastDetectedAccountName: detected })
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

// 兼容旧接口：upsertProjectPlatformAccountRecord（保留签名，内部改为 create + update）
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
  // 尝试按 (projectId, platform, accountName) 找到已有记录
  const existing = await db
    .select()
    .from(projectPlatformAccounts)
    .where(
      and(
        eq(projectPlatformAccounts.projectId, input.projectId),
        eq(projectPlatformAccounts.platform, input.platform),
        eq(projectPlatformAccounts.accountName, input.accountName.trim()),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return updateProjectPlatformAccount(db, { ...input, id: existing[0].id, accountName: input.accountName });
  }
  return createProjectPlatformAccount(db, input);
}
```

---

## STEP 4：修改 server/projectPlatformAccountsRouter.ts

**全量替换该文件内容**：

```typescript
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { ACCOUNT_GROUP_TYPES, PUBLISH_IDENTITIES } from "@shared/contentStrategy";
import {
  bindingPlatformZod,
  createProjectPlatformAccount,
  updateProjectPlatformAccount,
  deleteProjectPlatformAccount,
  togglePlatformAccountEnabled,
  listProjectPlatformAccountsForProject,
  verifyPlatformAccountForProjectRecord,
  requireDbConn,
} from "./projectPlatformAccounts";

const accountGroupZod = z.enum(ACCOUNT_GROUP_TYPES).optional().nullable();
const accountRoleZod = z.enum(PUBLISH_IDENTITIES).optional().nullable();

const accountFormInput = z.object({
  projectId: z.number().int().positive(),
  platform: bindingPlatformZod,
  accountName: z.string().trim().min(1, "账号昵称不能为空").max(255),
  accountIdOrUrl: z.string().max(2000).optional().nullable(),
  accountGroup: accountGroupZod,
  accountRole: accountRoleZod,
  isEnabled: z.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export const projectPlatformAccountsRouter = router({
  /** 列出项目所有账号（多账号版，按平台分组） */
  list: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await requireDbConn();
      return { accounts: await listProjectPlatformAccountsForProject(db, input.projectId) } as const;
    }),

  /** 新增账号（同平台允许多条） */
  create: protectedProcedure
    .input(accountFormInput)
    .mutation(async ({ input }) => {
      const db = await requireDbConn();
      const row = await createProjectPlatformAccount(db, input);
      return { success: true, account: row } as const;
    }),

  /** 按 id 更新账号信息 */
  update: protectedProcedure
    .input(accountFormInput.extend({ id: z.number().int().positive() }).omit({ platform: true }))
    .mutation(async ({ input }) => {
      const db = await requireDbConn();
      const row = await updateProjectPlatformAccount(db, input);
      return { success: true, account: row } as const;
    }),

  /** 按 id 删除单个账号 */
  delete: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await requireDbConn();
      return deleteProjectPlatformAccount(db, input.projectId, input.id);
    }),

  /** 按 id 切换启用/禁用 */
  toggleEnabled: protectedProcedure
    .input(z.object({
      projectId: z.number().int().positive(),
      id: z.number().int().positive(),
      isEnabled: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const db = await requireDbConn();
      return togglePlatformAccountEnabled(db, input.projectId, input.id, input.isEnabled);
    }),

  /** 核验指定账号（支持指定 accountId） */
  verify: protectedProcedure
    .input(z.object({
      projectId: z.number().int().positive(),
      platform: bindingPlatformZod,
      accountId: z.number().int().positive().optional().nullable(),
      detectedAccountName: z.string().max(255).optional().nullable(),
      verificationSource: z.enum(["plugin", "manual"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await requireDbConn();
      return verifyPlatformAccountForProjectRecord(db, input);
    }),

  // ── 以下为兼容旧接口，供 publishTasksRouter 等调用方使用 ──

  /** @deprecated 用 create 替代 */
  upsert: protectedProcedure
    .input(accountFormInput)
    .mutation(async ({ input }) => {
      const db = await requireDbConn();
      const { upsertProjectPlatformAccountRecord } = await import("./projectPlatformAccounts");
      const row = await upsertProjectPlatformAccountRecord(db, input);
      return { success: true, account: row } as const;
    }),

  /** @deprecated 用 toggleEnabled 替代 */
  disable: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), platform: bindingPlatformZod }))
    .mutation(async () => {
      throw new TRPCError({ code: "METHOD_NOT_SUPPORTED", message: "请使用 toggleEnabled 按账号 id 操作" });
    }),

  /** @deprecated 用 toggleEnabled 替代 */
  enable: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), platform: bindingPlatformZod }))
    .mutation(async () => {
      throw new TRPCError({ code: "METHOD_NOT_SUPPORTED", message: "请使用 toggleEnabled 按账号 id 操作" });
    }),
});
```

---

## STEP 5：重写前端 PlatformAccountBindingSection.tsx

**全量替换 `client/src/components/PlatformAccountBindingSection.tsx`**：

```tsx
import { AiSection, AiStatusBadge } from "@/components/ai/ProductUi";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { aiGlassPanel, aiInput, aiOutlineBtn, aiPrimaryBtn } from "@/lib/aiProductUi";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ACCOUNT_GROUP_OPTIONS,
  getAccountGroupLabel,
  getPublishIdentityLabel,
  PUBLISH_IDENTITY_OPTIONS,
  type AccountGroupType,
  type PublishIdentity,
} from "@shared/contentStrategy";
import {
  BINDING_PUBLISH_PLATFORMS,
  PUBLISH_PLATFORM_LABELS,
  type BindingPublishPlatform,
} from "@shared/platformAccountVerify";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// 单个账号行的类型
type AccountEntry = {
  id: number;
  accountName: string;
  accountIdOrUrl: string;
  accountGroup: string | null;
  accountRole: string | null;
  isEnabled: boolean;
  verificationStatus: string;
  lastVerifiedAt: Date | string | null;
  lastDetectedAccountName: string | null;
  notes: string;
};

// list query 返回的平台行
type PlatformRow = {
  platform: BindingPublishPlatform;
  accounts: AccountEntry[];
};

function verificationTone(status: string): "success" | "warning" | "neutral" {
  if (status === "matched") return "success";
  if (status === "mismatched" || status === "login_required") return "warning";
  return "neutral";
}

function verificationLabel(status: string): string {
  if (status === "matched") return "已核验 ✓";
  if (status === "mismatched") return "账号不匹配";
  if (status === "login_required") return "需重新登录";
  return "未核验";
}

function formatTime(value: Date | string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("zh-CN");
}

// 空表单状态
const emptyForm = {
  accountName: "",
  accountIdOrUrl: "",
  notes: "",
  isEnabled: true,
  accountGroup: "" as AccountGroupType | "",
  accountRole: "" as PublishIdentity | "",
};

export function PlatformAccountBindingSection({ projectId }: { projectId: number }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.geo.platformAccounts.list.useQuery({ projectId });
  const createMutation = trpc.geo.platformAccounts.create.useMutation();
  const updateMutation = trpc.geo.platformAccounts.update.useMutation();
  const deleteMutation = trpc.geo.platformAccounts.delete.useMutation();
  const toggleMutation = trpc.geo.platformAccounts.toggleEnabled.useMutation();

  // Dialog 状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPlatform, setDialogPlatform] = useState<BindingPublishPlatform>("zhihu");
  const [editingId, setEditingId] = useState<number | null>(null); // null = 新增
  const [form, setForm] = useState(emptyForm);

  const platformRows = (data?.accounts ?? []) as PlatformRow[];

  const invalidate = async () => {
    await utils.geo.platformAccounts.list.invalidate({ projectId });
  };

  const openAddDialog = (platform: BindingPublishPlatform) => {
    setDialogPlatform(platform);
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (platform: BindingPublishPlatform, account: AccountEntry) => {
    setDialogPlatform(platform);
    setEditingId(account.id);
    setForm({
      accountName: account.accountName,
      accountIdOrUrl: account.accountIdOrUrl,
      notes: account.notes,
      isEnabled: account.isEnabled,
      accountGroup: (account.accountGroup as AccountGroupType) ?? "",
      accountRole: (account.accountRole as PublishIdentity) ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.accountName.trim()) {
      toast.error("请填写账号昵称");
      return;
    }
    try {
      if (editingId === null) {
        // 新增
        await createMutation.mutateAsync({
          projectId,
          platform: dialogPlatform,
          accountName: form.accountName.trim(),
          accountIdOrUrl: form.accountIdOrUrl.trim() || null,
          notes: form.notes.trim() || null,
          accountGroup: form.accountGroup || null,
          accountRole: form.accountRole || null,
          isEnabled: form.isEnabled,
        });
        toast.success("账号已添加");
      } else {
        // 更新
        await updateMutation.mutateAsync({
          projectId,
          id: editingId,
          accountName: form.accountName.trim(),
          accountIdOrUrl: form.accountIdOrUrl.trim() || null,
          notes: form.notes.trim() || null,
          accountGroup: form.accountGroup || null,
          accountRole: form.accountRole || null,
          isEnabled: form.isEnabled,
        });
        toast.success("账号已更新");
      }
      await invalidate();
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    }
  };

  const handleDelete = async (accountId: number) => {
    if (!confirm("确认删除该账号？删除后不可恢复。")) return;
    try {
      await deleteMutation.mutateAsync({ projectId, id: accountId });
      await invalidate();
      toast.success("账号已删除");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  };

  const handleToggle = async (accountId: number, currentEnabled: boolean) => {
    try {
      await toggleMutation.mutateAsync({ projectId, id: accountId, isEnabled: !currentEnabled });
      await invalidate();
      toast.success(!currentEnabled ? "已启用" : "已禁用");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div id="platform-accounts" className="scroll-mt-24">
      <AiSection
        title="平台账号绑定"
        description="每个企业项目可绑定多个发布账号（如多个头条号、多个知乎账号）。发布时选择目标账号，系统通过插件核验浏览器登录账号是否一致。"
      >
        <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-50">
          发布前账号核验需要使用最新版发布插件（v1.2.0 及以上）。若刚更新系统，请在浏览器扩展管理中重新加载插件后再发布。
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-slate-500">加载中…</div>
        ) : (
          <div className="space-y-6">
            {BINDING_PUBLISH_PLATFORMS.map(platform => {
              const row = platformRows.find(r => r.platform === platform);
              const accounts = row?.accounts ?? [];
              const label = PUBLISH_PLATFORM_LABELS[platform];

              return (
                <div key={platform} className={cn(aiGlassPanel, "space-y-3 p-4")}>
                  {/* 平台标题行 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{label}</p>
                      <p className="text-xs text-slate-500">
                        {accounts.length === 0
                          ? "未绑定账号"
                          : `已绑定 ${accounts.length} 个账号，${accounts.filter(a => a.isEnabled).length} 个启用中`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className={aiPrimaryBtn}
                      onClick={() => openAddDialog(platform)}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      添加账号
                    </Button>
                  </div>

                  {/* 账号列表 */}
                  {accounts.length > 0 && (
                    <div className="space-y-2">
                      {accounts.map(account => (
                        <div
                          key={account.id}
                          className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5"
                        >
                          {/* 账号信息 */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-slate-100">
                                {account.accountName}
                              </p>
                              <AiStatusBadge tone={verificationTone(account.verificationStatus)}>
                                {verificationLabel(account.verificationStatus)}
                              </AiStatusBadge>
                              {!account.isEnabled && (
                                <AiStatusBadge tone="neutral">已禁用</AiStatusBadge>
                              )}
                            </div>
                            {account.accountIdOrUrl ? (
                              <p className="mt-0.5 truncate text-xs text-slate-500">
                                {account.accountIdOrUrl}
                              </p>
                            ) : null}
                            <p className="mt-0.5 text-xs text-slate-600">
                              核验时间：{formatTime(account.lastVerifiedAt)}
                              {account.lastDetectedAccountName ? ` · 检测到：${account.lastDetectedAccountName}` : ""}
                            </p>
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-slate-400 hover:text-cyan-300"
                              onClick={() => openEditDialog(platform, account)}
                              title="编辑"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className={cn(
                                "h-7 w-7",
                                account.isEnabled ? "text-cyan-400 hover:text-cyan-200" : "text-slate-500 hover:text-slate-300",
                              )}
                              onClick={() => void handleToggle(account.id, account.isEnabled)}
                              title={account.isEnabled ? "禁用" : "启用"}
                            >
                              {account.isEnabled ? (
                                <ToggleRight className="h-4 w-4" />
                              ) : (
                                <ToggleLeft className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-slate-500 hover:text-red-400"
                              onClick={() => void handleDelete(account.id)}
                              title="删除"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 新增 / 编辑 Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="border-white/10 bg-slate-950 text-slate-100 sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingId === null ? "添加" : "编辑"} {PUBLISH_PLATFORM_LABELS[dialogPlatform]} 账号
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {editingId === null
                  ? `为该企业添加一个 ${PUBLISH_PLATFORM_LABELS[dialogPlatform]} 账号。同一平台可添加多个账号。`
                  : "修改账号信息。账号昵称用于发布前核验，请与平台昵称保持一致。"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs text-slate-500">平台</label>
                <p className="mt-1 text-sm text-white">{PUBLISH_PLATFORM_LABELS[dialogPlatform]}</p>
              </div>
              <div>
                <label className="text-xs text-slate-500">账号昵称（必填，用于发布前核验）</label>
                <Input
                  className={aiInput}
                  placeholder="与平台昵称完全一致"
                  value={form.accountName}
                  onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">账号主页 / ID（可选）</label>
                <Input
                  className={aiInput}
                  value={form.accountIdOrUrl}
                  onChange={e => setForm(f => ({ ...f, accountIdOrUrl: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">账号身份</label>
                <select
                  className={aiInput}
                  value={form.accountRole}
                  onChange={e => setForm(f => ({ ...f, accountRole: e.target.value as PublishIdentity | "" }))}
                >
                  <option value="">未设置</option>
                  {PUBLISH_IDENTITY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">所属账号组</label>
                <select
                  className={aiInput}
                  value={form.accountGroup}
                  onChange={e => setForm(f => ({ ...f, accountGroup: e.target.value as AccountGroupType | "" }))}
                >
                  <option value="">未设置</option>
                  {ACCOUNT_GROUP_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">备注（可选）</label>
                <Input
                  className={aiInput}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.isEnabled}
                  onChange={e => setForm(f => ({ ...f, isEnabled: e.target.checked }))}
                />
                启用该账号用于自动发布
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className={aiOutlineBtn} onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button
                type="button"
                className={aiPrimaryBtn}
                disabled={isSaving}
                onClick={() => void handleSave()}
              >
                {isSaving ? "保存中…" : "保存"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AiSection>
    </div>
  );
}
```

---

## STEP 6：发布流程适配（publishTasksRouter）

**操作文件：`server/publishTasksRouter.ts`**

找到创建发布任务的逻辑（通常是调用 `getEnabledPlatformAccount` 的地方），将其改为：
1. 从该平台**所有已启用账号**中选取一个（优先使用前端传入的 `platformAccountId`，若无则取第一个）
2. 在发布任务里记录 `platformAccountId`

具体修改：找到类似这样的代码：

```typescript
// 旧代码（找到并替换）
const account = await getEnabledPlatformAccount(db, projectId, platform);
```

替换为：

```typescript
// 新代码：优先使用指定 accountId，否则取第一个已启用账号
import { getEnabledPlatformAccounts } from "./projectPlatformAccounts";

const enabledAccounts = await getEnabledPlatformAccounts(db, projectId, platform);
const account = input.platformAccountId
  ? enabledAccounts.find(a => a.id === input.platformAccountId) ?? enabledAccounts[0]
  : enabledAccounts[0];
```

同时，在 `publishTasksRouter` 的发布 input schema 中，新增可选字段 `platformAccountId`：

```typescript
// 在相关 input schema 的 z.object({...}) 中添加：
platformAccountId: z.number().int().positive().optional().nullable(),
```

---

## STEP 7：发布 UI 适配（发布选账号下拉）

在调用发布的 UI 页面（`ContentPublishingFlowPage` 或相关组件）中，找到发布某篇文章的操作入口，在该平台已有多个账号时，改为显示下拉选择器：

```tsx
// 伪代码示意，找到实际发布触发代码后按此思路改：
const enabledAccounts = platformRow.accounts.filter(a => a.isEnabled);

// 若只有 1 个账号，直接发布（无需选择）
// 若有多个账号，显示下拉让用户选择后再发布
{enabledAccounts.length > 1 && (
  <select value={selectedAccountId} onChange={e => setSelectedAccountId(Number(e.target.value))}>
    {enabledAccounts.map(a => (
      <option key={a.id} value={a.id}>{a.accountName}</option>
    ))}
  </select>
)}
```

> 注：发布 UI 的具体改法需结合 `ContentPublishingFlowPage.tsx` 或调用发布 mutation 的实际组件文件来定位，步骤 6-7 是方向指引，Cursor 按实际代码落地。

---

## 文件变更总览

| 文件 | 操作 | 关键改动 |
|------|------|---------|
| `drizzle/schema.ts` | 修改 | 将 `(projectId, platform)` 二元唯一索引改为 `(projectId, platform, accountName)` 三元唯一索引 |
| `drizzle/migrations/` | 自动生成 | `npx drizzle-kit generate` 生成新迁移文件 |
| `server/projectPlatformAccounts.ts` | 重写 | 新增 `createProjectPlatformAccount` / `updateProjectPlatformAccount` / `deleteProjectPlatformAccount` / `togglePlatformAccountEnabled` / `getEnabledPlatformAccounts`（多账号版） |
| `server/projectPlatformAccountsRouter.ts` | 重写 | 新增 `create` / `update` / `delete` / `toggleEnabled` procedure，旧 `upsert` / `disable` / `enable` 保留做兼容 |
| `client/src/components/PlatformAccountBindingSection.tsx` | 重写 | 每个平台由「单账号卡片」变为「账号列表 + 添加按钮」 |
| `server/publishTasksRouter.ts` | 局部修改 | 支持 `platformAccountId` 指定发布到哪个账号 |

**不需要改动**：Chrome 扩展本身、`geoPublishRecords` 表、任何其他 router。
