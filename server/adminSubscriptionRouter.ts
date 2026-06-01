import { TRPCError } from "@trpc/server";
import { desc, eq, like } from "drizzle-orm";
import { z } from "zod";
import { getSubscriptionPlanById, SUBSCRIPTION_PLAN_IDS } from "@shared/subscriptionPlans";
import { users } from "../drizzle/schema";
import { adminProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { resolveUserSubscriptionPlanIdFromDb, setUserSubscriptionPlanId } from "./userSubscriptionPlan";

const planIdSchema = z.enum(SUBSCRIPTION_PLAN_IDS);

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库连接不可用" });
  }
  return db;
}

export const adminSubscriptionRouter = router({
  /** 管理员：按邮箱搜索或列出最近登录用户 */
  listUsers: adminProcedure
    .input(
      z
        .object({
          email: z.string().trim().max(320).optional(),
          limit: z.number().int().min(1).max(50).default(20),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = await requireDb();
      const limit = input?.limit ?? 20;
      const email = input?.email?.trim();

      const rows = email
        ? await db
            .select({
              id: users.id,
              email: users.email,
              name: users.name,
              role: users.role,
              subscriptionPlanId: users.subscriptionPlanId,
              lastSignedIn: users.lastSignedIn,
            })
            .from(users)
            .where(like(users.email, `%${email}%`))
            .orderBy(desc(users.lastSignedIn))
            .limit(limit)
        : await db
            .select({
              id: users.id,
              email: users.email,
              name: users.name,
              role: users.role,
              subscriptionPlanId: users.subscriptionPlanId,
              lastSignedIn: users.lastSignedIn,
            })
            .from(users)
            .orderBy(desc(users.lastSignedIn))
            .limit(limit);

      return rows.map(row => ({
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        planId: row.subscriptionPlanId,
        planName: getSubscriptionPlanById(row.subscriptionPlanId).name,
        lastSignedIn: row.lastSignedIn,
      }));
    }),

  /** 管理员：手动设置用户订阅套餐 */
  setUserPlan: adminProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        planId: planIdSchema,
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const existing = await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1);
      if (!existing[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "未找到该用户" });
      }
      const planId = await setUserSubscriptionPlanId(db, input.userId, input.planId);
      const plan = getSubscriptionPlanById(planId);
      return {
        userId: input.userId,
        planId,
        planName: plan.name,
      } as const;
    }),

  /** 管理员：读取指定用户当前套餐 */
  getUserPlan: adminProcedure.input(z.object({ userId: z.number().int().positive() })).query(async ({ input }) => {
    const db = await requireDb();
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1);
    if (!existing[0]) {
      throw new TRPCError({ code: "NOT_FOUND", message: "未找到该用户" });
    }
    const planId = await resolveUserSubscriptionPlanIdFromDb(db, input.userId);
    const plan = getSubscriptionPlanById(planId);
    return { userId: input.userId, planId, planName: plan.name } as const;
  }),
});
