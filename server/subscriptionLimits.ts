import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  BASIC_PLAN_LIMITS,
  planAppliesBasicFreeLimits,
  resolveSubscriptionPlanIdForUser,
  subscriptionLimitMessageFor,
  type SubscriptionLimitKind,
} from "@shared/subscriptionLimits";
import type { SubscriptionPlanId } from "@shared/subscriptionPlans";
import { geoArticles, projects, testRounds } from "../drizzle/schema";
import type { getDb } from "./db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type SubscriptionUsageSnapshot = {
  planId: SubscriptionPlanId;
  limited: boolean;
  limits: typeof BASIC_PLAN_LIMITS;
  usage: {
    projectCount: number;
    t0DetectionCount: number;
    contentArticleCount: number;
  };
  atLimit: {
    project: boolean;
    t0Detection: boolean;
    contentArticle: boolean;
  };
};

async function listOwnerProjectIds(db: Db, userId: number): Promise<number[]> {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.ownerUserId, userId), isNull(projects.archivedAt)));
  return rows.map(row => row.id);
}

export async function countActiveProjectsForUser(db: Db, userId: number): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(projects)
    .where(and(eq(projects.ownerUserId, userId), isNull(projects.archivedAt)));
  return Number(rows[0]?.count ?? 0);
}

export async function countT0DetectionsForUser(db: Db, userId: number): Promise<number> {
  const projectIds = await listOwnerProjectIds(db, userId);
  if (projectIds.length === 0) return 0;
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(testRounds)
    .where(and(inArray(testRounds.projectId, projectIds), eq(testRounds.roundType, "T0_BASELINE")));
  return Number(rows[0]?.count ?? 0);
}

export async function countContentArticlesForUser(db: Db, userId: number): Promise<number> {
  const projectIds = await listOwnerProjectIds(db, userId);
  if (projectIds.length === 0) return 0;
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(geoArticles)
    .where(inArray(geoArticles.projectId, projectIds));
  return Number(rows[0]?.count ?? 0);
}

export async function getSubscriptionUsageSnapshot(db: Db, userId: number): Promise<SubscriptionUsageSnapshot> {
  const planId = resolveSubscriptionPlanIdForUser(userId);
  const limited = planAppliesBasicFreeLimits(planId);
  const [projectCount, t0DetectionCount, contentArticleCount] = await Promise.all([
    countActiveProjectsForUser(db, userId),
    countT0DetectionsForUser(db, userId),
    countContentArticlesForUser(db, userId),
  ]);
  const limits = BASIC_PLAN_LIMITS;
  return {
    planId,
    limited,
    limits,
    usage: { projectCount, t0DetectionCount, contentArticleCount },
    atLimit: {
      project: limited && projectCount >= limits.maxProjects,
      t0Detection: limited && t0DetectionCount >= limits.maxT0Detections,
      contentArticle: limited && contentArticleCount >= limits.maxContentArticles,
    },
  };
}

function throwSubscriptionLimit(kind: SubscriptionLimitKind): never {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: subscriptionLimitMessageFor(kind),
  });
}

export async function assertCanCreateProject(db: Db, userId: number): Promise<void> {
  const planId = resolveSubscriptionPlanIdForUser(userId);
  if (!planAppliesBasicFreeLimits(planId)) return;
  const projectCount = await countActiveProjectsForUser(db, userId);
  if (projectCount >= BASIC_PLAN_LIMITS.maxProjects) {
    throwSubscriptionLimit("project");
  }
}

export async function assertCanRunT0Detection(db: Db, userId: number): Promise<void> {
  const planId = resolveSubscriptionPlanIdForUser(userId);
  if (!planAppliesBasicFreeLimits(planId)) return;
  const t0Count = await countT0DetectionsForUser(db, userId);
  if (t0Count >= BASIC_PLAN_LIMITS.maxT0Detections) {
    throwSubscriptionLimit("t0_detection");
  }
}

export async function assertCanGenerateContent(db: Db, userId: number): Promise<void> {
  const planId = resolveSubscriptionPlanIdForUser(userId);
  if (!planAppliesBasicFreeLimits(planId)) return;
  const articleCount = await countContentArticlesForUser(db, userId);
  if (articleCount >= BASIC_PLAN_LIMITS.maxContentArticles) {
    throwSubscriptionLimit("content_generation");
  }
}
