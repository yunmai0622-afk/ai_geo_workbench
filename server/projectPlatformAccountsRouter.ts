import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { projectPlatformAccounts } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import {
  bindingPlatformZod,
  getEnabledPlatformAccount,
  listProjectPlatformAccountsForProject,
  requireDbConn,
  upsertProjectPlatformAccountRecord,
  verifyPlatformAccountForProjectRecord,
} from "./projectPlatformAccounts";

export const projectPlatformAccountsRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await requireDbConn();
      return { accounts: await listProjectPlatformAccountsForProject(db, input.projectId) } as const;
    }),

  upsert: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        platform: bindingPlatformZod,
        accountName: z.string().trim().min(1, "账号昵称不能为空").max(255),
        accountIdOrUrl: z.string().max(2000).optional().nullable(),
        isEnabled: z.boolean().optional(),
        notes: z.string().max(2000).optional().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDbConn();
      const row = await upsertProjectPlatformAccountRecord(db, input);
      return { success: true, account: row } as const;
    }),

  disable: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        platform: bindingPlatformZod,
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDbConn();
      const rows = await db
        .select()
        .from(projectPlatformAccounts)
        .where(
          and(eq(projectPlatformAccounts.projectId, input.projectId), eq(projectPlatformAccounts.platform, input.platform)),
        )
        .limit(1);
      const row = rows[0];
      if (!row) {
        return { success: true, disabled: false } as const;
      }
      await db.update(projectPlatformAccounts).set({ isEnabled: 0 }).where(eq(projectPlatformAccounts.id, row.id));
      return { success: true, disabled: true } as const;
    }),

  enable: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        platform: bindingPlatformZod,
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDbConn();
      const account = await getEnabledPlatformAccount(db, input.projectId, input.platform);
      if (!account) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先添加并保存该平台账号" });
      }
      await db.update(projectPlatformAccounts).set({ isEnabled: 1 }).where(eq(projectPlatformAccounts.id, account.id));
      return { success: true } as const;
    }),

  verify: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        platform: bindingPlatformZod,
        detectedAccountName: z.string().max(255).optional().nullable(),
        verificationSource: z.enum(["plugin", "manual"]).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDbConn();
      return verifyPlatformAccountForProjectRecord(db, input);
    }),

});
