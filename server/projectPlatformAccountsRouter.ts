import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { ACCOUNT_GROUP_TYPES, PUBLISH_IDENTITIES } from "@shared/contentStrategy";
import { requireProjectAccess } from "./projectAccess";
import {
  bindLocalAgentAccount,
  bindingPlatformZod,
  createProjectPlatformAccount,
  deleteProjectPlatformAccount,
  listProjectPlatformAccountsForProject,
  requireDbConn,
  togglePlatformAccountEnabled,
  updateProjectPlatformAccount,
  upsertProjectPlatformAccountRecord,
  verifyPlatformAccountForProjectRecord,
} from "./projectPlatformAccounts";

const accountGroupZod = z.enum(ACCOUNT_GROUP_TYPES).optional().nullable();
const accountRoleZod = z.enum(PUBLISH_IDENTITIES).optional().nullable();

const accountInputBase = {
  projectId: z.number().int().positive(),
  accountName: z.string().trim().min(1, "账号昵称不能为空").max(255),
  accountIdOrUrl: z.string().max(2000).optional().nullable(),
  accountGroup: accountGroupZod,
  accountRole: accountRoleZod,
  isEnabled: z.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
};

const pluginBindingCreateSchema = z
  .object({
    ...accountInputBase,
    platform: bindingPlatformZod,
    bindingSource: z.literal("plugin_detected"),
    detectedAccountName: z.string().trim().min(1).max(255),
  })
  .refine(data => data.accountName === data.detectedAccountName, {
    message: "accountName 必须等于 detectedAccountName",
    path: ["detectedAccountName"],
  });

const purposeUpdateSchema = z.object({
  projectId: z.number().int().positive(),
  accountId: z.number().int().positive(),
  accountGroup: accountGroupZod,
  accountRole: accountRoleZod,
  isEnabled: z.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
  purposeOnly: z.literal(true).optional(),
});

export const projectPlatformAccountsRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDbConn();
      await requireProjectAccess(ctx, input.projectId);
      return { accounts: await listProjectPlatformAccountsForProject(db, input.projectId) } as const;
    }),

  create: protectedProcedure
    .input(
      z.union([
        pluginBindingCreateSchema,
        z.object({ ...accountInputBase, platform: bindingPlatformZod }),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDbConn();
      await requireProjectAccess(ctx, input.projectId);
      const row = await createProjectPlatformAccount(db, input);
      return { success: true, account: row } as const;
    }),

  update: protectedProcedure
    .input(
      z.union([
        purposeUpdateSchema,
        z.object({
          ...accountInputBase,
          accountId: z.number().int().positive(),
        }),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDbConn();
      await requireProjectAccess(ctx, input.projectId);
      const row = await updateProjectPlatformAccount(db, {
        ...input,
        purposeOnly: "purposeOnly" in input && input.purposeOnly === true ? true : undefined,
      });
      return { success: true, account: row } as const;
    }),

  delete: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        accountId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDbConn();
      await requireProjectAccess(ctx, input.projectId);
      return deleteProjectPlatformAccount(db, input);
    }),

  toggleEnabled: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDbConn();
      await requireProjectAccess(ctx, input.projectId);
      const row = await togglePlatformAccountEnabled(db, input);
      return { success: true, account: row } as const;
    }),

  /** @deprecated 兼容旧前端：按 platform+accountName upsert */
  upsert: protectedProcedure
    .input(z.object({ ...accountInputBase, platform: bindingPlatformZod }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDbConn();
      await requireProjectAccess(ctx, input.projectId);
      const row = await upsertProjectPlatformAccountRecord(db, input);
      return { success: true, account: row } as const;
    }),

  /** @deprecated */
  disable: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), platform: bindingPlatformZod }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDbConn();
      await requireProjectAccess(ctx, input.projectId);
      const grouped = await listProjectPlatformAccountsForProject(db, input.projectId);
      const platformRow = grouped.find(g => g.platform === input.platform);
      const first = platformRow?.accounts[0];
      if (!first) return { success: true, disabled: false } as const;
      await togglePlatformAccountEnabled(db, { projectId: input.projectId, accountId: first.id, enabled: false });
      return { success: true, disabled: true } as const;
    }),

  /** @deprecated */
  enable: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), platform: bindingPlatformZod }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDbConn();
      await requireProjectAccess(ctx, input.projectId);
      const grouped = await listProjectPlatformAccountsForProject(db, input.projectId);
      const first = grouped.find(g => g.platform === input.platform)?.accounts[0];
      if (!first) {
        throw new Error("请先添加并保存该平台账号");
      }
      await togglePlatformAccountEnabled(db, { projectId: input.projectId, accountId: first.id, enabled: true });
      return { success: true } as const;
    }),

  verify: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        platform: bindingPlatformZod,
        accountId: z.number().int().positive().optional(),
        detectedAccountName: z.string().max(255).optional().nullable(),
        verificationSource: z.enum(["plugin", "manual"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDbConn();
      await requireProjectAccess(ctx, input.projectId);
      return verifyPlatformAccountForProjectRecord(db, input);
    }),

  bindLocalAgentAccount: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        platform: bindingPlatformZod,
        accountName: z.string().trim().min(1).max(255),
        accountGroup: accountGroupZod,
        accountRole: accountRoleZod,
        localAgentId: z.string().trim().min(1).max(100),
        localProfileId: z.string().trim().min(1).max(100),
        sessionStatus: z.enum(["active", "expired", "unknown"]).default("active"),
        notes: z.string().max(2000).optional().nullable(),
        isEnabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDbConn();
      await requireProjectAccess(ctx, input.projectId);
      const row = await bindLocalAgentAccount(db, input);
      return { success: true, account: row } as const;
    }),
});
