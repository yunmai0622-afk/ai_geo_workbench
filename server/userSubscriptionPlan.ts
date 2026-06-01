import { eq } from "drizzle-orm";
import {
  DEFAULT_SUBSCRIPTION_PLAN_ID,
  parseSubscriptionPlanId,
  type SubscriptionPlanId,
} from "@shared/subscriptionPlans";
import { users } from "../drizzle/schema";
import type { getDb } from "./db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export async function resolveUserSubscriptionPlanIdFromDb(
  db: Db,
  userId: number,
): Promise<SubscriptionPlanId> {
  const rows = await db
    .select({ subscriptionPlanId: users.subscriptionPlanId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return parseSubscriptionPlanId(rows[0]?.subscriptionPlanId) ?? DEFAULT_SUBSCRIPTION_PLAN_ID;
}

export async function setUserSubscriptionPlanId(
  db: Db,
  userId: number,
  planId: SubscriptionPlanId,
): Promise<SubscriptionPlanId> {
  await db.update(users).set({ subscriptionPlanId: planId }).where(eq(users.id, userId));
  return planId;
}
