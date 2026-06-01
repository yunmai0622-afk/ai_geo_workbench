import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getCurrentUserId } from "./projectAccess";
import { requireDbConn } from "./projectPlatformAccounts";
import { listUserNotifications, markAllNotificationsRead, markNotificationRead } from "./systemNotifications";

export const systemNotificationsRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await requireDbConn();
      return listUserNotifications(db, getCurrentUserId(ctx), input?.limit ?? 30);
    }),
  markRead: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDbConn();
      const updated = await markNotificationRead(db, getCurrentUserId(ctx), input.id);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "通知不存在或已读" });
      return { success: true as const };
    }),
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await requireDbConn();
    return { success: true as const, markedCount: await markAllNotificationsRead(db, getCurrentUserId(ctx)) };
  }),
});
