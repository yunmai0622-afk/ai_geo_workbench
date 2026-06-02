import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  BASIC_PLAN_LIMITS,
  planHasContentArticleLimit,
  resolveMaxProjectsForPlan,
  subscriptionLimitMessageFor,
  subscriptionLimitsExemptForRole,
  type SubscriptionLimitKind,
} from "@shared/subscriptionLimits";
import type { SubscriptionPlanId } from "@shared/subscriptionPlans";
import { geoArticles, projects, testRounds } from "../drizzle/schema";
import type { getDb } from "./db";
import { resolveUserSubscriptionPlanIdFromDb } from "./userSubscriptionPlan";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type SubscriptionUsageSnapshot = {
  planId: SubscriptionPlanId;
  limited: boolean;
  limits: {
    maxProjects: number | null;
    maxContentArticles: number | null;
  };
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

export async function getSubscriptionUsageSnapshot(
  db: Db,
  userId: number,
  userRole: string,
): Promise<SubscriptionUsageSnapshot> {
  const planId = await resolveUserSubscriptionPlanIdFromDb(db, userId);
  const [projectCount, t0DetectionCount, contentArticleCount] = await Promise.all([
    countActiveProjectsForUser(db, userId),
    countT0DetectionsForUser(db, userId),
    countContentArticlesForUser(db, userId),
  ]);

  if (subscriptionLimitsExemptForRole(userRole)) {
    return {
      planId,
      limited: false,
      limits: { maxProjects: null, maxContentArticles: null },
      usage: { projectCount, t0DetectionCount, contentArticleCount },
      atLimit: { project: false, t0Detection: false, contentArticle: false },
    };
  }

  const maxProjects = resolveMaxProjectsForPlan(planId);
  const maxContentArticles = planHasContentArticleLimit(planId) ? BASIC_PLAN_LIMITS.maxContentArticles : null;

  return {
    planId,
    limited: maxProjects !== null || maxContentArticles !== null,
    limits: { maxProjects, maxContentArticles },
    usage: { projectCount, t0DetectionCount, contentArticleCount },
    atLimit: {
      project: maxProjects !== null && projectCount >= maxProjects,
      t0Detection: false,
      contentArticle:
        maxContentArticles !== null && contentArticleCount >= maxContentArticles,
    },
  };
}

function throwSubscriptionLimit(kind: SubscriptionLimitKind, planId: SubscriptionPlanId): never {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: subscriptionLimitMessageFor(kind, planId),
  });
}

export async function assertCanCreateProject(
  db: Db,
  userId: number,
  userRole: string,
): Promise<void> {
  if (subscriptionLimitsExemptForRole(userRole)) return;
  const planId = await resolveUserSubscriptionPlanIdFromDb(db, userId);
  const maxProjects = resolveMaxProjectsForPlan(planId);
  if (maxProjects === null) return;
  const projectCount = await countActiveProjectsForUser(db, userId);
  if (projectCount >= maxProjects) {
    throwSubscriptionLimit("project", planId);
  }
}

export async function assertCanGenerateContent(
  db: Db,
  userId: number,
  userRole: string,
): Promise<void> {
  if (subscriptionLimitsExemptForRole(userRole)) return;
  const planId = await resolveUserSubscriptionPlanIdFromDb(db, userId);
  if (!planHasContentArticleLimit(planId)) return;
  const articleCount = await countContentArticlesForUser(db, userId);
  if (articleCount >= BASIC_PLAN_LIMITS.maxContentArticles) {
    throwSubscriptionLimit("content_generation", planId);
  }
}
