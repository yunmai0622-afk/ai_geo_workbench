import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import {
  computeRenewalRisk,
  daysUntil,
  DEFAULT_ENABLED_FEATURES,
  parseEnabledFeatures,
  PLAN_TYPE_DEFAULTS,
  type CompanyPlanType,
  type CompanyServiceStatus,
  type CompanySubscriptionStatus,
  type CustomerCompanyStatus,
  type CustomerRole,
  type PlatformFeatureKey,
  type RenewalRiskLevel,
  type UserReviewStatus,
} from "@shared/platformAdmin";
import { computeMonthlyPlanProgress } from "@shared/monthlyPlanGeneration";
import {
  buildDeliveryCommandCenterView,
  countProfileCompletedSteps,
  type DeliveryCommandProjectInput,
} from "@shared/deliveryCommandCenter";
import { normalizeEffectInclusionStatus } from "@shared/contentAssetEffectTracking";
import { hasCompletedT0Baseline } from "@shared/workspaceMainChain";
import { calculateProfileCompletionScore } from "./assetLibrary";
import {
  companyProjects,
  companySubscriptions,
  customerCompanies,
  enterpriseGeoProfiles,
  geoMaturityScores,
  geoArticles,
  geoInclusionMonitoringRecords,
  geoPublishRecords,
  monthlyOptimizationPlans,
  monthlyOptimizationTasks,
  projects,
  questions,
  reports,
  testRounds,
  users,
} from "../drizzle/schema";
import { getDb } from "./db";

export type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export async function requirePlatformDb(): Promise<Db> {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库连接不可用" });
  }
  return db;
}

export type ProjectDeliverySnapshot = {
  projectId: number;
  projectName: string;
  companyId: number | null;
  companyName: string | null;
  currentStage: string;
  profileCompletionScore: number;
  maturityScore: number | null;
  monthlyPlanProgress: { completedCount: number; totalCount: number; rate: number };
  contentTaskProgress: { pendingCount: number; totalCount: number };
  publishTaskProgress: { pendingCount: number; totalCount: number };
  aiDiagnosisStatus: string;
  monthlyReportStatus: string;
  subscriptionExpiresAt: Date | null;
  renewalRisk: RenewalRiskLevel;
  nextAction: string;
  lastAiTestAt: Date | null;
  lastReportAt: Date | null;
};

function monthlyPlanRate(completed: number, total: number): number {
  if (total <= 0) return 0;
  return completed / total;
}

function resolveNextAction(snapshot: {
  profileCompletionScore: number;
  hasAiTest: boolean;
  monthlyPlanTotal: number;
  monthlyPlanCompleted: number;
  contentPending: number;
  publishPending: number;
  hasReport: boolean;
  renewalRisk: RenewalRiskLevel;
}): string {
  if (snapshot.renewalRisk === "high") return "联系客户续费";
  if (snapshot.profileCompletionScore < 60) return "去完善建档";
  if (!snapshot.hasAiTest) return "去创建 AI 现状检测";
  if (snapshot.monthlyPlanTotal === 0) return "去查看本月计划";
  if (snapshot.monthlyPlanCompleted < snapshot.monthlyPlanTotal) return "去查看本月计划";
  if (snapshot.contentPending > 0) return "去处理内容";
  if (snapshot.publishPending > 0) return "去发布";
  if (!snapshot.hasReport) return "去生成月报";
  return "正常推进中";
}

function resolveCurrentStage(snapshot: {
  profileCompletionScore: number;
  hasAiTest: boolean;
  monthlyPlanTotal: number;
  monthlyPlanCompleted: number;
  hasReport: boolean;
}): string {
  if (snapshot.profileCompletionScore < 60) return "建档中";
  if (!snapshot.hasAiTest) return "待 AI 实测";
  if (snapshot.monthlyPlanTotal === 0) return "待制定本月计划";
  if (snapshot.monthlyPlanCompleted < snapshot.monthlyPlanTotal) return "本月计划执行中";
  if (!snapshot.hasReport) return "待生成月报";
  return "交付完成";
}

export async function buildProjectDeliveryMap(
  db: Db,
  projectIds: number[],
): Promise<Map<number, Omit<ProjectDeliverySnapshot, "companyId" | "companyName" | "subscriptionExpiresAt">>> {
  const result = new Map<
    number,
    Omit<ProjectDeliverySnapshot, "companyId" | "companyName" | "subscriptionExpiresAt">
  >();
  if (projectIds.length === 0) return result;

  const [profileRows, maturityRows, planRows, testRoundRows, reportRows] = await Promise.all([
    db.select().from(enterpriseGeoProfiles).where(inArray(enterpriseGeoProfiles.projectId, projectIds)),
    db
      .select()
      .from(geoMaturityScores)
      .where(inArray(geoMaturityScores.projectId, projectIds))
      .orderBy(desc(geoMaturityScores.calculatedAt)),
    db
      .select()
      .from(monthlyOptimizationPlans)
      .where(
        and(
          inArray(monthlyOptimizationPlans.projectId, projectIds),
          eq(monthlyOptimizationPlans.status, "active"),
        ),
      )
      .orderBy(desc(monthlyOptimizationPlans.createdAt)),
    db
      .select()
      .from(testRounds)
      .where(inArray(testRounds.projectId, projectIds))
      .orderBy(desc(testRounds.createdAt)),
    db
      .select()
      .from(reports)
      .where(inArray(reports.projectId, projectIds))
      .orderBy(desc(reports.createdAt)),
  ]);

  const profileByProject = new Map(profileRows.map(r => [r.projectId, r]));
  const latestMaturityByProject = new Map<number, (typeof maturityRows)[number]>();
  for (const row of maturityRows) {
    if (!latestMaturityByProject.has(row.projectId)) latestMaturityByProject.set(row.projectId, row);
  }

  const activePlanByProject = new Map<number, (typeof planRows)[number]>();
  for (const row of planRows) {
    if (!activePlanByProject.has(row.projectId)) activePlanByProject.set(row.projectId, row);
  }

  const planIds = [...activePlanByProject.values()].map(p => p.id);
  const taskRows =
    planIds.length > 0
      ? await db
          .select()
          .from(monthlyOptimizationTasks)
          .where(inArray(monthlyOptimizationTasks.planId, planIds))
      : [];

  const tasksByPlanId = new Map<number, typeof taskRows>();
  for (const task of taskRows) {
    const list = tasksByPlanId.get(task.planId) ?? [];
    list.push(task);
    tasksByPlanId.set(task.planId, list);
  }

  const testRoundsByProject = new Map<number, typeof testRoundRows>();
  for (const row of testRoundRows) {
    const list = testRoundsByProject.get(row.projectId) ?? [];
    list.push(row);
    testRoundsByProject.set(row.projectId, list);
  }

  const latestReportByProject = new Map<number, (typeof reportRows)[number]>();
  for (const row of reportRows) {
    if (!latestReportByProject.has(row.projectId)) latestReportByProject.set(row.projectId, row);
  }

  const projectNameRows = await db
    .select({ id: projects.id, enterpriseName: projects.enterpriseName })
    .from(projects)
    .where(inArray(projects.id, projectIds));
  const projectNameById = new Map(projectNameRows.map(r => [r.id, r.enterpriseName]));

  for (const projectId of projectIds) {
    const profile = profileByProject.get(projectId);
    const profileCompletionScore = calculateProfileCompletionScore(profile ?? null);
    const maturity = latestMaturityByProject.get(projectId);
    const activePlan = activePlanByProject.get(projectId);
    const planTasks = activePlan ? (tasksByPlanId.get(activePlan.id) ?? []) : [];
    const monthlyPlanProgress = computeMonthlyPlanProgress(planTasks);
    const contentTasks = planTasks.filter(t => t.taskType === "content_generation");
    const contentPending = contentTasks.filter(t => t.status !== "completed").length;
    const publishPending = planTasks.filter(
      t => t.status !== "completed" && t.taskType !== "profile_completion",
    ).length;

    const rounds = testRoundsByProject.get(projectId) ?? [];
    const hasAiTest = hasCompletedT0Baseline(rounds);
    const lastAiTest = rounds.find(r => r.status === "completed") ?? null;
    const report = latestReportByProject.get(projectId);
    const hasReport = Boolean(report);

    const renewalRisk = computeRenewalRisk({
      subscriptionStatus: "active",
      expiresAt: null,
      monthlyPlanCompletedRate: monthlyPlanRate(
        monthlyPlanProgress.completedCount,
        monthlyPlanProgress.totalCount,
      ),
      hasAiTestData: hasAiTest,
      hasMonthlyReport: hasReport,
    });

    const stageInput = {
      profileCompletionScore,
      hasAiTest,
      monthlyPlanTotal: monthlyPlanProgress.totalCount,
      monthlyPlanCompleted: monthlyPlanProgress.completedCount,
      hasReport,
    };

    result.set(projectId, {
      projectId,
      projectName: projectNameById.get(projectId) ?? `项目 #${projectId}`,
      currentStage: resolveCurrentStage(stageInput),
      profileCompletionScore,
      maturityScore: maturity?.totalScore ?? null,
      monthlyPlanProgress: {
        ...monthlyPlanProgress,
        rate: monthlyPlanRate(monthlyPlanProgress.completedCount, monthlyPlanProgress.totalCount),
      },
      contentTaskProgress: { pendingCount: contentPending, totalCount: contentTasks.length },
      publishTaskProgress: { pendingCount: publishPending, totalCount: planTasks.length },
      aiDiagnosisStatus: hasAiTest ? "已完成" : "未完成",
      monthlyReportStatus: hasReport ? "已生成" : "未生成",
      renewalRisk,
      nextAction: resolveNextAction({
        profileCompletionScore,
        hasAiTest,
        monthlyPlanTotal: monthlyPlanProgress.totalCount,
        monthlyPlanCompleted: monthlyPlanProgress.completedCount,
        contentPending,
        publishPending,
        hasReport,
        renewalRisk,
      }),
      lastAiTestAt: lastAiTest?.finishedAt ?? lastAiTest?.createdAt ?? null,
      lastReportAt: report?.createdAt ?? null,
    });
  }

  return result;
}

export async function resolveCompanyServiceStatus(
  db: Db,
  companyId: number | null | undefined,
): Promise<CompanyServiceStatus> {
  const empty: CompanyServiceStatus = {
    companyId: companyId ?? null,
    hasSubscription: false,
    planType: null,
    planName: null,
    status: null,
    expiresAt: null,
    daysRemaining: null,
    isServiceActive: true,
    bannerMessage: null,
  };
  if (!companyId) return empty;

  const rows = await db
    .select()
    .from(companySubscriptions)
    .where(eq(companySubscriptions.companyId, companyId))
    .limit(1);
  const sub = rows[0];
  if (!sub) return empty;

  const daysRemaining = daysUntil(sub.expiresAt);
  const isExpired =
    sub.status === "expired" ||
    sub.status === "cancelled" ||
    (daysRemaining != null && daysRemaining < 0);
  const isPaused = sub.status === "paused";
  const isServiceActive = !isExpired && !isPaused && (sub.status === "active" || sub.status === "trial");

  let bannerMessage: string | null = null;
  if (isExpired) bannerMessage = "当前服务已到期，请联系平台方续费或开通。";
  else if (isPaused) bannerMessage = "当前服务已暂停，请联系平台方续费或开通。";

  return {
    companyId,
    hasSubscription: true,
    planType: sub.planType,
    planName: sub.planName,
    status: sub.status,
    expiresAt: sub.expiresAt,
    daysRemaining,
    isServiceActive,
    bannerMessage,
  };
}

async function subscriptionByCompanyId(db: Db, companyIds: number[]) {
  if (companyIds.length === 0) return new Map<number, (typeof companySubscriptions.$inferSelect)>();
  const rows = await db
    .select()
    .from(companySubscriptions)
    .where(inArray(companySubscriptions.companyId, companyIds));
  return new Map(rows.map(r => [r.companyId, r]));
}

async function projectCountByCompanyId(db: Db, companyIds: number[]) {
  if (companyIds.length === 0) return new Map<number, number>();
  const rows = await db
    .select({
      companyId: companyProjects.companyId,
      count: sql<number>`count(*)`,
    })
    .from(companyProjects)
    .where(and(inArray(companyProjects.companyId, companyIds), eq(companyProjects.status, "active")))
    .groupBy(companyProjects.companyId);
  return new Map(rows.map(r => [r.companyId, Number(r.count)]));
}

async function lastLoginByCompanyId(db: Db, companyIds: number[]) {
  if (companyIds.length === 0) return new Map<number, Date>();
  const rows = await db
    .select({
      companyId: users.companyId,
      lastSignedIn: sql<Date>`max(${users.lastSignedIn})`,
    })
    .from(users)
    .where(and(inArray(users.companyId, companyIds), eq(users.userStatus, "active")))
    .groupBy(users.companyId);
  return new Map(
    rows
      .filter(r => r.companyId != null)
      .map(r => [r.companyId as number, r.lastSignedIn]),
  );
}

export async function getCustomerCompanyMetrics(db: Db) {
  const companies = await db.select({ id: customerCompanies.id, status: customerCompanies.status }).from(customerCompanies);
  const companyIds = companies.map(c => c.id);
  const subs = await subscriptionByCompanyId(db, companyIds);

  let pendingReview = 0;
  let activeService = 0;
  let expiringSoon = 0;
  let highRisk = 0;

  for (const company of companies) {
    if (company.status === "pending") pendingReview += 1;
    if (company.status === "active") activeService += 1;
    const sub = subs.get(company.id);
    if (!sub) continue;
    const days = daysUntil(sub.expiresAt);
    if (days != null && days >= 0 && days <= 7) expiringSoon += 1;
    const risk = computeRenewalRisk({
      subscriptionStatus: sub.status,
      expiresAt: sub.expiresAt,
      monthlyPlanCompletedRate: null,
      hasAiTestData: true,
      hasMonthlyReport: true,
    });
    if (risk === "high") highRisk += 1;
  }

  return {
    totalCompanies: companies.length,
    pendingReview,
    activeService,
    expiringSoon,
    highRisk,
  };
}

export async function listCustomerCompanies(
  db: Db,
  input?: { status?: CustomerCompanyStatus; search?: string },
) {
  const conditions = [];
  if (input?.status) conditions.push(eq(customerCompanies.status, input.status));
  if (input?.search?.trim()) {
    const q = `%${input.search.trim()}%`;
    conditions.push(
      or(
        like(customerCompanies.companyName, q),
        like(customerCompanies.contactName, q),
        like(customerCompanies.contactEmail, q),
        like(customerCompanies.contactPhone, q),
      ),
    );
  }

  const rows = await db
    .select()
    .from(customerCompanies)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(customerCompanies.createdAt));

  const companyIds = rows.map(r => r.id);
  const [subs, projectCounts, lastLogins, bindings] = await Promise.all([
    subscriptionByCompanyId(db, companyIds),
    projectCountByCompanyId(db, companyIds),
    lastLoginByCompanyId(db, companyIds),
    db.select().from(companyProjects).where(inArray(companyProjects.companyId, companyIds)),
  ]);

  const projectIds = bindings.map(b => b.projectId);
  const deliveryMap = await buildProjectDeliveryMap(db, projectIds);

  return rows.map(row => {
    const sub = subs.get(row.id);
    const companyBindings = bindings.filter(b => b.companyId === row.id);
    const primaryDelivery =
      companyBindings.length > 0 ? deliveryMap.get(companyBindings[0]!.projectId) : null;
    const renewalRisk = sub
      ? computeRenewalRisk({
          subscriptionStatus: sub.status,
          expiresAt: sub.expiresAt,
          monthlyPlanCompletedRate: primaryDelivery?.monthlyPlanProgress.rate ?? null,
          hasAiTestData: primaryDelivery?.aiDiagnosisStatus === "已完成",
          hasMonthlyReport: primaryDelivery?.monthlyReportStatus === "已生成",
        })
      : ("low" as RenewalRiskLevel);

    return {
      ...row,
      subscription: sub ?? null,
      projectCount: projectCounts.get(row.id) ?? 0,
      lastLoginAt: lastLogins.get(row.id) ?? null,
      deliveryStage: primaryDelivery?.currentStage ?? "未绑定项目",
      renewalRisk,
    };
  });
}

export async function getCustomerCompany(db: Db, companyId: number) {
  const rows = await db.select().from(customerCompanies).where(eq(customerCompanies.id, companyId)).limit(1);
  const company = rows[0];
  if (!company) {
    throw new TRPCError({ code: "NOT_FOUND", message: "未找到该客户公司" });
  }

  const [subRows, bindingRows, memberRows] = await Promise.all([
    db.select().from(companySubscriptions).where(eq(companySubscriptions.companyId, companyId)).limit(1),
    db.select().from(companyProjects).where(eq(companyProjects.companyId, companyId)),
    db.select().from(users).where(eq(users.companyId, companyId)),
  ]);

  const projectIds = bindingRows.map(b => b.projectId);
  const deliveryMap = await buildProjectDeliveryMap(db, projectIds);

  return {
    ...company,
    subscription: subRows[0] ?? null,
    projects: bindingRows.map(b => ({
      ...b,
      delivery: deliveryMap.get(b.projectId) ?? null,
    })),
    members: memberRows,
  };
}

export async function createCustomerCompany(
  db: Db,
  input: {
    companyName: string;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    industry?: string;
    sourceChannel?: string;
    notes?: string;
  },
) {
  const inserted = await db.insert(customerCompanies).values({
    companyName: input.companyName.trim(),
    contactName: input.contactName?.trim() || null,
    contactPhone: input.contactPhone?.trim() || null,
    contactEmail: input.contactEmail?.trim() || null,
    industry: input.industry?.trim() || null,
    sourceChannel: input.sourceChannel?.trim() || null,
    notes: input.notes?.trim() || null,
    status: "pending",
  }).$returningId();

  const id = Number(inserted[0]?.id ?? 0);
  if (!id) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "创建客户公司失败" });
  }
  return getCustomerCompany(db, id);
}

export async function updateCustomerCompanyStatus(
  db: Db,
  input: { companyId: number; status: CustomerCompanyStatus; reviewerId: number },
) {
  const patch: Partial<typeof customerCompanies.$inferInsert> = { status: input.status };
  if (input.status === "active") {
    patch.approvedAt = new Date();
    patch.approvedBy = input.reviewerId;
  }
  await db.update(customerCompanies).set(patch).where(eq(customerCompanies.id, input.companyId));
  return getCustomerCompany(db, input.companyId);
}

export async function updateCustomerCompany(
  db: Db,
  input: {
    companyId: number;
    companyName?: string;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    industry?: string;
    sourceChannel?: string;
    notes?: string;
  },
) {
  const patch: Partial<typeof customerCompanies.$inferInsert> = {};
  if (input.companyName != null) patch.companyName = input.companyName.trim();
  if (input.contactName != null) patch.contactName = input.contactName.trim() || null;
  if (input.contactPhone != null) patch.contactPhone = input.contactPhone.trim() || null;
  if (input.contactEmail != null) patch.contactEmail = input.contactEmail.trim() || null;
  if (input.industry != null) patch.industry = input.industry.trim() || null;
  if (input.sourceChannel != null) patch.sourceChannel = input.sourceChannel.trim() || null;
  if (input.notes != null) patch.notes = input.notes.trim() || null;

  await db.update(customerCompanies).set(patch).where(eq(customerCompanies.id, input.companyId));
  return getCustomerCompany(db, input.companyId);
}

export async function listUsersForReview(
  db: Db,
  input?: { status?: UserReviewStatus; search?: string },
) {
  const conditions = [];
  if (input?.status) conditions.push(eq(users.userStatus, input.status));
  if (input?.search?.trim()) {
    const q = `%${input.search.trim()}%`;
    conditions.push(or(like(users.email, q), like(users.name, q)));
  }

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      companyId: users.companyId,
      userStatus: users.userStatus,
      customerRole: users.customerRole,
      applicationNote: users.applicationNote,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
      reviewedAt: users.reviewedAt,
      reviewedBy: users.reviewedBy,
    })
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(users.createdAt));

  const companyIds = [...new Set(rows.map(r => r.companyId).filter((id): id is number => id != null))];
  const companyRows =
    companyIds.length > 0
      ? await db
          .select({ id: customerCompanies.id, companyName: customerCompanies.companyName })
          .from(customerCompanies)
          .where(inArray(customerCompanies.id, companyIds))
      : [];
  const companyNameById = new Map(companyRows.map(c => [c.id, c.companyName]));

  return rows.map(row => ({
    ...row,
    companyName: row.companyId ? (companyNameById.get(row.companyId) ?? null) : null,
  }));
}

export async function reviewUser(
  db: Db,
  input: {
    userId: number;
    status: Extract<UserReviewStatus, "active" | "rejected" | "disabled">;
    reviewerId: number;
    companyId?: number;
    customerRole?: CustomerRole;
  },
) {
  const existing = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!existing[0]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "未找到该用户" });
  }

  if (input.status === "active") {
    if (!input.companyId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "审核通过必须绑定客户公司" });
    }
    if (!input.customerRole) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "审核通过必须分配客户角色" });
    }
  }

  await db
    .update(users)
    .set({
      userStatus: input.status,
      reviewedAt: new Date(),
      reviewedBy: input.reviewerId,
      companyId: input.status === "active" ? input.companyId : existing[0].companyId,
      customerRole: input.status === "active" ? input.customerRole : existing[0].customerRole,
    })
    .where(eq(users.id, input.userId));

  const updated = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  return updated[0]!;
}

export async function assignUserCompany(db: Db, input: { userId: number; companyId: number }) {
  const company = await db
    .select({ id: customerCompanies.id })
    .from(customerCompanies)
    .where(eq(customerCompanies.id, input.companyId))
    .limit(1);
  if (!company[0]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "未找到该客户公司" });
  }
  await db.update(users).set({ companyId: input.companyId }).where(eq(users.id, input.userId));
  const updated = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!updated[0]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "未找到该用户" });
  }
  return updated[0];
}

export async function updateUserRole(db: Db, input: { userId: number; customerRole: CustomerRole }) {
  await db.update(users).set({ customerRole: input.customerRole }).where(eq(users.id, input.userId));
  const updated = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!updated[0]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "未找到该用户" });
  }
  return updated[0];
}

export async function listSubscriptions(db: Db, input?: { companyId?: number; search?: string }) {
  let companyIds: number[] | undefined;
  if (input?.search?.trim()) {
    const q = `%${input.search.trim()}%`;
    const matched = await db
      .select({ id: customerCompanies.id })
      .from(customerCompanies)
      .where(like(customerCompanies.companyName, q));
    companyIds = matched.map(r => r.id);
    if (companyIds.length === 0) return [];
  }

  const subConditions = [];
  if (input?.companyId) subConditions.push(eq(companySubscriptions.companyId, input.companyId));
  if (companyIds) subConditions.push(inArray(companySubscriptions.companyId, companyIds));

  const subs = await db
    .select()
    .from(companySubscriptions)
    .where(subConditions.length > 0 ? and(...subConditions) : undefined)
    .orderBy(desc(companySubscriptions.updatedAt));

  const allCompanyIds = [...new Set(subs.map(s => s.companyId))];
  const companies =
    allCompanyIds.length > 0
      ? await db
          .select({ id: customerCompanies.id, companyName: customerCompanies.companyName })
          .from(customerCompanies)
          .where(inArray(customerCompanies.id, allCompanyIds))
      : [];
  const companyNameById = new Map(companies.map(c => [c.id, c.companyName]));

  return subs.map(sub => ({
    ...sub,
    enabledFeatures: parseEnabledFeatures(sub.enabledFeatures),
    companyName: companyNameById.get(sub.companyId) ?? `公司 #${sub.companyId}`,
    daysRemaining: daysUntil(sub.expiresAt),
  }));
}

export async function upsertCompanySubscription(
  db: Db,
  input: {
    companyId: number;
    planType: CompanyPlanType;
    planName?: string;
    status?: CompanySubscriptionStatus;
    expiresAt?: Date | null;
    maxProjects?: number;
    monthlyAiTests?: number;
    monthlyContentTasks?: number;
    monthlyReports?: number;
    maxTeamMembers?: number;
    enabledFeatures?: Partial<Record<PlatformFeatureKey, boolean>>;
    notes?: string;
  },
) {
  const company = await db
    .select({ id: customerCompanies.id })
    .from(customerCompanies)
    .where(eq(customerCompanies.id, input.companyId))
    .limit(1);
  if (!company[0]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "未找到该客户公司" });
  }

  const defaults = PLAN_TYPE_DEFAULTS[input.planType];
  const enabledFeatures = {
    ...defaults.enabledFeatures,
    ...(input.enabledFeatures ?? {}),
  };

  const payload = {
    companyId: input.companyId,
    planType: input.planType,
    planName: input.planName?.trim() || defaults.planName,
    status: input.status ?? ("trial" as CompanySubscriptionStatus),
    expiresAt: input.expiresAt ?? null,
    maxProjects: input.maxProjects ?? defaults.maxProjects,
    monthlyAiTests: input.monthlyAiTests ?? defaults.monthlyAiTests,
    monthlyContentTasks: input.monthlyContentTasks ?? defaults.monthlyContentTasks,
    monthlyReports: input.monthlyReports ?? defaults.monthlyReports,
    maxTeamMembers: input.maxTeamMembers ?? defaults.maxTeamMembers,
    enabledFeatures,
    notes: input.notes?.trim() || null,
  };

  const existing = await db
    .select({ id: companySubscriptions.id })
    .from(companySubscriptions)
    .where(eq(companySubscriptions.companyId, input.companyId))
    .limit(1);

  if (existing[0]) {
    await db.update(companySubscriptions).set(payload).where(eq(companySubscriptions.companyId, input.companyId));
  } else {
    await db.insert(companySubscriptions).values(payload);
  }

  const rows = await listSubscriptions(db, { companyId: input.companyId });
  return rows[0]!;
}

export async function pauseCompanySubscription(db: Db, companyId: number) {
  await db
    .update(companySubscriptions)
    .set({ status: "paused" })
    .where(eq(companySubscriptions.companyId, companyId));
  const rows = await listSubscriptions(db, { companyId });
  if (!rows[0]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "未找到该公司套餐" });
  }
  return rows[0];
}

export async function extendCompanySubscription(
  db: Db,
  input: { companyId: number; expiresAt: Date; status?: CompanySubscriptionStatus },
) {
  const patch: Partial<typeof companySubscriptions.$inferInsert> = {
    expiresAt: input.expiresAt,
  };
  if (input.status) patch.status = input.status;
  else patch.status = "active";

  await db.update(companySubscriptions).set(patch).where(eq(companySubscriptions.companyId, input.companyId));
  const rows = await listSubscriptions(db, { companyId: input.companyId });
  if (!rows[0]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "未找到该公司套餐" });
  }
  return rows[0];
}

export async function updateSubscriptionFeatures(
  db: Db,
  input: {
    companyId: number;
    enabledFeatures: Partial<Record<PlatformFeatureKey, boolean>>;
    maxProjects?: number;
    monthlyAiTests?: number;
    monthlyContentTasks?: number;
    monthlyReports?: number;
    maxTeamMembers?: number;
    notes?: string;
  },
) {
  const existing = await db
    .select()
    .from(companySubscriptions)
    .where(eq(companySubscriptions.companyId, input.companyId))
    .limit(1);
  if (!existing[0]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "未找到该公司套餐" });
  }

  const enabledFeatures = {
    ...parseEnabledFeatures(existing[0].enabledFeatures),
    ...input.enabledFeatures,
  };

  await db
    .update(companySubscriptions)
    .set({
      enabledFeatures,
      maxProjects: input.maxProjects ?? existing[0].maxProjects,
      monthlyAiTests: input.monthlyAiTests ?? existing[0].monthlyAiTests,
      monthlyContentTasks: input.monthlyContentTasks ?? existing[0].monthlyContentTasks,
      monthlyReports: input.monthlyReports ?? existing[0].monthlyReports,
      maxTeamMembers: input.maxTeamMembers ?? existing[0].maxTeamMembers,
      notes: input.notes ?? existing[0].notes,
    })
    .where(eq(companySubscriptions.companyId, input.companyId));

  const rows = await listSubscriptions(db, { companyId: input.companyId });
  return rows[0]!;
}

export async function listProjectBindings(db: Db, input?: { companyId?: number }) {
  const conditions = [];
  if (input?.companyId) conditions.push(eq(companyProjects.companyId, input.companyId));

  const bindings = await db
    .select()
    .from(companyProjects)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(companyProjects.updatedAt));

  const companyIds = [...new Set(bindings.map(b => b.companyId))];
  const projectIds = bindings.map(b => b.projectId);

  const [companies, deliveryMap] = await Promise.all([
    companyIds.length > 0
      ? db
          .select({ id: customerCompanies.id, companyName: customerCompanies.companyName })
          .from(customerCompanies)
          .where(inArray(customerCompanies.id, companyIds))
      : Promise.resolve([]),
    buildProjectDeliveryMap(db, projectIds),
  ]);

  const companyNameById = new Map(companies.map(c => [c.id, c.companyName]));

  return bindings.map(binding => ({
    ...binding,
    companyName: companyNameById.get(binding.companyId) ?? `公司 #${binding.companyId}`,
    delivery: deliveryMap.get(binding.projectId) ?? null,
  }));
}

export async function bindProjectToCompany(
  db: Db,
  input: { companyId: number; projectId: number; projectName?: string },
) {
  const [company, project, existingBinding] = await Promise.all([
    db.select({ id: customerCompanies.id }).from(customerCompanies).where(eq(customerCompanies.id, input.companyId)).limit(1),
    db.select({ id: projects.id, enterpriseName: projects.enterpriseName }).from(projects).where(eq(projects.id, input.projectId)).limit(1),
    db.select().from(companyProjects).where(eq(companyProjects.projectId, input.projectId)).limit(1),
  ]);

  if (!company[0]) throw new TRPCError({ code: "NOT_FOUND", message: "未找到该客户公司" });
  if (!project[0]) throw new TRPCError({ code: "NOT_FOUND", message: "未找到该项目" });
  if (existingBinding[0] && existingBinding[0].companyId !== input.companyId) {
    throw new TRPCError({ code: "CONFLICT", message: "该项目已绑定到其他客户公司" });
  }

  const projectName = input.projectName?.trim() || project[0].enterpriseName;
  if (existingBinding[0]) {
    await db
      .update(companyProjects)
      .set({ companyId: input.companyId, projectName, status: "active" })
      .where(eq(companyProjects.projectId, input.projectId));
  } else {
    await db.insert(companyProjects).values({
      companyId: input.companyId,
      projectId: input.projectId,
      projectName,
      status: "active",
    });
  }

  const rows = await listProjectBindings(db, { companyId: input.companyId });
  return rows.find(r => r.projectId === input.projectId)!;
}

export async function unbindProject(db: Db, input: { companyId: number; projectId: number }) {
  await db
    .delete(companyProjects)
    .where(and(eq(companyProjects.companyId, input.companyId), eq(companyProjects.projectId, input.projectId)));
  return { success: true as const };
}

export async function createProjectForCompany(
  db: Db,
  input: {
    companyId: number;
    ownerUserId: number;
    enterpriseName: string;
    industry?: string;
    website?: string;
    region?: string;
    productIntro?: string;
    targetCustomers?: string;
    coreSellingPoints?: string;
  },
) {
  const company = await db
    .select({ id: customerCompanies.id, companyName: customerCompanies.companyName })
    .from(customerCompanies)
    .where(eq(customerCompanies.id, input.companyId))
    .limit(1);
  if (!company[0]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "未找到该客户公司" });
  }

  const inserted = await db
    .insert(projects)
    .values({
      ownerUserId: input.ownerUserId,
      enterpriseName: input.enterpriseName.trim(),
      industry: input.industry?.trim() || "未填写",
      website: input.website?.trim() || "https://example.com",
      region: input.region?.trim() || "全国",
      productIntro: input.productIntro?.trim() || "待完善",
      targetCustomers: input.targetCustomers?.trim() || "待完善",
      coreSellingPoints: input.coreSellingPoints?.trim() || "待完善",
      competitorNames: [],
      coreKeywords: [],
    })
    .$returningId();

  const projectId = Number(inserted[0]?.id ?? 0);
  if (!projectId) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "创建项目失败" });
  }

  return bindProjectToCompany(db, {
    companyId: input.companyId,
    projectId,
    projectName: input.enterpriseName.trim(),
  });
}

export async function listDeliveryBoard(db: Db, input?: { renewalRisk?: RenewalRiskLevel }) {
  const bindings = await listProjectBindings(db);
  const companyIds = [...new Set(bindings.map(b => b.companyId))];
  const subs = await subscriptionByCompanyId(db, companyIds);

  const rows = bindings.map(binding => {
    const sub = subs.get(binding.companyId);
    const delivery = binding.delivery;
    const renewalRisk = computeRenewalRisk({
      subscriptionStatus: sub?.status ?? null,
      expiresAt: sub?.expiresAt ?? null,
      monthlyPlanCompletedRate: delivery?.monthlyPlanProgress.rate ?? null,
      hasAiTestData: delivery?.aiDiagnosisStatus === "已完成",
      hasMonthlyReport: delivery?.monthlyReportStatus === "已生成",
    });

    return {
      companyId: binding.companyId,
      companyName: binding.companyName,
      projectId: binding.projectId,
      projectName: binding.projectName,
      bindingStatus: binding.status,
      currentStage: delivery?.currentStage ?? "未知",
      profileCompletionScore: delivery?.profileCompletionScore ?? 0,
      maturityScore: delivery?.maturityScore ?? null,
      monthlyPlanProgress: delivery?.monthlyPlanProgress ?? { completedCount: 0, totalCount: 0, rate: 0 },
      contentPending: delivery?.contentTaskProgress.pendingCount ?? 0,
      publishPending: delivery?.publishTaskProgress.pendingCount ?? 0,
      aiDiagnosisStatus: delivery?.aiDiagnosisStatus ?? "未完成",
      monthlyReportStatus: delivery?.monthlyReportStatus ?? "未生成",
      subscriptionExpiresAt: sub?.expiresAt ?? null,
      renewalRisk,
      nextAction: delivery?.nextAction ?? "去完善建档",
      planName: sub?.planName ?? null,
      subscriptionStatus: sub?.status ?? null,
    };
  });

  if (input?.renewalRisk) {
    return rows.filter(r => r.renewalRisk === input.renewalRisk);
  }
  return rows;
}

export async function getDeliverySummary(db: Db) {
  const rows = await listDeliveryBoard(db);
  const subs = await subscriptionByCompanyId(
    db,
    [...new Set(rows.map(r => r.companyId))],
  );

  let profilePending = 0;
  let aiTestPending = 0;
  let monthlyPlanActive = 0;
  let contentPending = 0;
  let publishPending = 0;
  let reportPending = 0;
  let expiringSoon = 0;
  let highRisk = 0;

  for (const row of rows) {
    if (row.profileCompletionScore < 60) profilePending += 1;
    if (row.aiDiagnosisStatus !== "已完成") aiTestPending += 1;
    if (row.monthlyPlanProgress.totalCount > 0 && row.monthlyPlanProgress.completedCount < row.monthlyPlanProgress.totalCount) {
      monthlyPlanActive += 1;
    }
    if (row.contentPending > 0) contentPending += 1;
    if (row.publishPending > 0) publishPending += 1;
    if (row.monthlyReportStatus !== "已生成") reportPending += 1;
    if (row.renewalRisk === "high") highRisk += 1;
    const sub = subs.get(row.companyId);
    const days = daysUntil(sub?.expiresAt ?? row.subscriptionExpiresAt);
    if (days != null && days >= 0 && days <= 7) expiringSoon += 1;
  }

  return {
    profilePending,
    aiTestPending,
    monthlyPlanActive,
    contentPending,
    publishPending,
    reportPending,
    expiringSoon,
    highRisk,
    totalBindings: rows.length,
  };
}

function isSameCalendarMonth(value: Date | string | null | undefined, now: Date): boolean {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function hoursSince(value: Date | string | null | undefined, now: Date): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return (now.getTime() - date.getTime()) / 3_600_000;
}

export async function getDeliveryCommandCenter(db: Db) {
  const now = new Date();
  const bindings = await listProjectBindings(db);
  const companyIds = [...new Set(bindings.map(b => b.companyId))];
  const projectIds = bindings.map(b => b.projectId);
  const subs = await subscriptionByCompanyId(db, companyIds);

  if (projectIds.length === 0) {
    return buildDeliveryCommandCenterView([]);
  }

  const [articleRows, publishRows, inclusionRows, questionRows, allPlanRows] = await Promise.all([
    db.select().from(geoArticles).where(inArray(geoArticles.projectId, projectIds)),
    db.select().from(geoPublishRecords).where(inArray(geoPublishRecords.projectId, projectIds)),
    db
      .select()
      .from(geoInclusionMonitoringRecords)
      .where(inArray(geoInclusionMonitoringRecords.projectId, projectIds)),
    db.select({ projectId: questions.projectId, id: questions.id }).from(questions).where(inArray(questions.projectId, projectIds)),
    db
      .select()
      .from(monthlyOptimizationPlans)
      .where(inArray(monthlyOptimizationPlans.projectId, projectIds))
      .orderBy(desc(monthlyOptimizationPlans.roundNumber)),
  ]);

  const planIds = allPlanRows.map(plan => plan.id);
  const allTaskRows =
    planIds.length > 0
      ? await db
          .select()
          .from(monthlyOptimizationTasks)
          .where(inArray(monthlyOptimizationTasks.planId, planIds))
      : [];

  const profileRows = await db
    .select()
    .from(enterpriseGeoProfiles)
    .where(inArray(enterpriseGeoProfiles.projectId, projectIds));

  const questionCountByProject = new Map<number, number>();
  for (const row of questionRows) {
    questionCountByProject.set(row.projectId, (questionCountByProject.get(row.projectId) ?? 0) + 1);
  }

  const articlesByProject = new Map<number, typeof articleRows>();
  for (const row of articleRows) {
    const list = articlesByProject.get(row.projectId) ?? [];
    list.push(row);
    articlesByProject.set(row.projectId, list);
  }

  const publishByProject = new Map<number, typeof publishRows>();
  for (const row of publishRows) {
    const list = publishByProject.get(row.projectId) ?? [];
    list.push(row);
    publishByProject.set(row.projectId, list);
  }

  const inclusionByProject = new Map<number, typeof inclusionRows>();
  for (const row of inclusionRows) {
    const list = inclusionByProject.get(row.projectId) ?? [];
    list.push(row);
    inclusionByProject.set(row.projectId, list);
  }

  const profileByProject = new Map(profileRows.map(row => [row.projectId, row]));

  const plansByProject = new Map<number, typeof allPlanRows>();
  for (const plan of allPlanRows) {
    const list = plansByProject.get(plan.projectId) ?? [];
    list.push(plan);
    plansByProject.set(plan.projectId, list);
  }

  const tasksByPlanId = new Map<number, typeof allTaskRows>();
  for (const task of allTaskRows) {
    const list = tasksByPlanId.get(task.planId) ?? [];
    list.push(task);
    tasksByPlanId.set(task.planId, list);
  }

  const projectsInput: DeliveryCommandProjectInput[] = bindings.map(binding => {
    const delivery = binding.delivery;
    const sub = subs.get(binding.companyId);
    const articles = articlesByProject.get(binding.projectId) ?? [];
    const publishes = publishByProject.get(binding.projectId) ?? [];
    const inclusions = inclusionByProject.get(binding.projectId) ?? [];
    const profile = profileByProject.get(binding.projectId) ?? null;
    const plans = plansByProject.get(binding.projectId) ?? [];
    const activePlan = plans.find(plan => plan.status === "active") ?? null;
    const activeTasks = activePlan ? (tasksByPlanId.get(activePlan.id) ?? []) : [];
    const activeProgressRaw = computeMonthlyPlanProgress(activeTasks);
    const activeProgress = {
      ...activeProgressRaw,
      rate: monthlyPlanRate(activeProgressRaw.completedCount, activeProgressRaw.totalCount),
    };
    const deliveryProgress = delivery?.monthlyPlanProgress ?? activeProgress;

    const recentPlanRates = plans.slice(0, 2).map(plan => {
      const tasks = tasksByPlanId.get(plan.id) ?? [];
      const progress = computeMonthlyPlanProgress(tasks);
      return monthlyPlanRate(progress.completedCount, progress.totalCount);
    });

    const contentGeneratedCount = articles.length;
    const contentPublishedCount = articles.filter(
      article => article.status === "已发布" || article.publishedAt != null,
    ).length;
    const contentGeneratedThisMonthCount = articles.filter(article =>
      isSameCalendarMonth(article.createdAt, now),
    ).length;
    const contentPublishedThisMonthCount = publishes.filter(record =>
      isSameCalendarMonth(record.publishedAt ?? record.createdAt, now),
    ).length;

    const inclusionIncludedCount = inclusions.filter(
      row => normalizeEffectInclusionStatus(row.effectInclusionStatus) === "included",
    ).length;
    const inclusionPendingCount = inclusions.filter(
      row =>
        normalizeEffectInclusionStatus(row.effectInclusionStatus) === "pending" ||
        row.inclusionMonitorStatus === "未检测",
    ).length;

    const contentGeneratingCount = articles.filter(article => article.status === "待生成").length;
    const contentStuckGeneratingCount = articles.filter(article => {
      if (article.status !== "待生成") return false;
      const hours = hoursSince(article.updatedAt ?? article.createdAt, now);
      return hours != null && hours >= 24;
    }).length;
    const contentPendingReviewCount = articles.filter(
      article => article.status === "待质检" || article.contentReviewStatus === "待审核",
    ).length;
    const contentPendingReviewStaleCount = articles.filter(article => {
      const pending =
        article.status === "待质检" || article.contentReviewStatus === "待审核";
      if (!pending) return false;
      const hours = hoursSince(article.updatedAt ?? article.createdAt, now);
      return hours != null && hours >= 72;
    }).length;

    const profileCompletedSteps = countProfileCompletedSteps({
      profile: profile as Record<string, unknown> | null,
      questionCount: questionCountByProject.get(binding.projectId) ?? 0,
    });

    const monthlyPlanStatus: DeliveryCommandProjectInput["monthlyPlanStatus"] = activePlan
      ? "active"
      : plans.some(plan => plan.status === "completed")
        ? "completed"
        : "none";

    const lastActivityCandidates = [
      delivery?.lastAiTestAt,
      delivery?.lastReportAt,
      articles[0]?.updatedAt,
      publishes[0]?.publishedAt,
      activePlan?.updatedAt,
    ].filter(Boolean) as Array<Date | string>;

    const lastActivityAt =
      lastActivityCandidates.length > 0
        ? lastActivityCandidates.reduce((latest, value) => {
            const ts = new Date(value).getTime();
            const latestTs = new Date(latest).getTime();
            return ts > latestTs ? value : latest;
          })
        : null;

    const profileEnterpriseName = profile?.enterpriseName?.trim();
    const resolvedProjectName =
      profileEnterpriseName ||
      binding.projectName ||
      delivery?.projectName ||
      `项目 #${binding.projectId}`;

    return {
      companyId: binding.companyId,
      companyName: binding.companyName,
      projectId: binding.projectId,
      projectName: resolvedProjectName,
      hasSubscription: sub != null,
      subscriptionExpiresAt: sub?.expiresAt ?? null,
      profileCompletionScore: delivery?.profileCompletionScore ?? 0,
      profileCompletedSteps,
      hasAiTest: delivery?.aiDiagnosisStatus === "已完成",
      lastAiTestAt: delivery?.lastAiTestAt ?? null,
      monthlyPlanProgress: deliveryProgress,
      monthlyPlanStatus,
      monthlyReportStatus: delivery?.monthlyReportStatus ?? "未生成",
      retestScheduledAt: activePlan?.retestScheduledAt ?? null,
      retestCompletedAt: activePlan?.retestCompletedAt ?? null,
      contentGeneratedCount,
      contentPublishedCount,
      inclusionIncludedCount,
      inclusionPendingCount,
      contentGeneratingCount,
      contentStuckGeneratingCount,
      contentPendingReviewCount,
      contentPendingReviewStaleCount,
      contentGeneratedThisMonthCount,
      contentPublishedThisMonthCount,
      currentMonthPlanRate: deliveryProgress.rate,
      recentTwoMonthPlanRates: recentPlanRates,
      lastActivityAt,
      lastReportAt: delivery?.lastReportAt ?? null,
    };
  });

  return buildDeliveryCommandCenterView(projectsInput, now);
}

export { DEFAULT_ENABLED_FEATURES, parseEnabledFeatures };
