import { z } from "zod";
import {
  COMPANY_PLAN_TYPES,
  COMPANY_SUBSCRIPTION_STATUSES,
  CUSTOMER_COMPANY_STATUSES,
  CUSTOMER_ROLES,
  PLATFORM_FEATURE_KEYS,
  RENEWAL_RISK_LEVELS,
  USER_REVIEW_STATUSES,
} from "@shared/platformAdmin";
import { adminProcedure, router } from "./_core/trpc";
import {
  assignUserCompany,
  bindProjectToCompany,
  createCustomerCompany,
  createProjectForCompany,
  extendCompanySubscription,
  getCustomerCompany,
  getCustomerCompanyMetrics,
  getDeliveryCommandCenter,
  getDeliverySummary,
  listCustomerCompanies,
  listDeliveryBoard,
  listProjectBindings,
  listSubscriptions,
  listUsersForReview,
  pauseCompanySubscription,
  requirePlatformDb,
  reviewUser,
  unbindProject,
  updateCustomerCompany,
  updateCustomerCompanyStatus,
  updateSubscriptionFeatures,
  updateUserRole,
  upsertCompanySubscription,
} from "./platformAdminService";

const customersRouter = router({
  list: adminProcedure
    .input(
      z
        .object({
          status: z.enum(CUSTOMER_COMPANY_STATUSES).optional(),
          search: z.string().trim().max(255).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = await requirePlatformDb();
      return listCustomerCompanies(db, input);
    }),

  get: adminProcedure
    .input(z.object({ companyId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await requirePlatformDb();
      return getCustomerCompany(db, input.companyId);
    }),

  metrics: adminProcedure.query(async () => {
    const db = await requirePlatformDb();
    return getCustomerCompanyMetrics(db);
  }),

  create: adminProcedure
    .input(
      z.object({
        companyName: z.string().trim().min(1).max(255),
        contactName: z.string().trim().max(120).optional(),
        contactPhone: z.string().trim().max(64).optional(),
        contactEmail: z.string().trim().email().max(320).optional().or(z.literal("")),
        industry: z.string().trim().max(255).optional(),
        sourceChannel: z.string().trim().max(120).optional(),
        notes: z.string().trim().max(5000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requirePlatformDb();
      return createCustomerCompany(db, {
        ...input,
        contactEmail: input.contactEmail || undefined,
      });
    }),

  approve: adminProcedure
    .input(z.object({ companyId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requirePlatformDb();
      return updateCustomerCompanyStatus(db, {
        companyId: input.companyId,
        status: "active",
        reviewerId: ctx.user!.id,
      });
    }),

  reject: adminProcedure
    .input(z.object({ companyId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requirePlatformDb();
      return updateCustomerCompanyStatus(db, {
        companyId: input.companyId,
        status: "rejected",
        reviewerId: ctx.user!.id,
      });
    }),

  disable: adminProcedure
    .input(z.object({ companyId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requirePlatformDb();
      return updateCustomerCompanyStatus(db, {
        companyId: input.companyId,
        status: "disabled",
        reviewerId: ctx.user!.id,
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        companyId: z.number().int().positive(),
        companyName: z.string().trim().min(1).max(255).optional(),
        contactName: z.string().trim().max(120).optional(),
        contactPhone: z.string().trim().max(64).optional(),
        contactEmail: z.string().trim().email().max(320).optional().or(z.literal("")),
        industry: z.string().trim().max(255).optional(),
        sourceChannel: z.string().trim().max(120).optional(),
        notes: z.string().trim().max(5000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requirePlatformDb();
      const { companyId, contactEmail, ...rest } = input;
      return updateCustomerCompany(db, {
        companyId,
        ...rest,
        contactEmail: contactEmail === "" ? "" : contactEmail,
      });
    }),
});

const usersRouter = router({
  list: adminProcedure
    .input(
      z
        .object({
          status: z.enum(USER_REVIEW_STATUSES).optional(),
          search: z.string().trim().max(320).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = await requirePlatformDb();
      return listUsersForReview(db, input);
    }),

  approve: adminProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        companyId: z.number().int().positive(),
        customerRole: z.enum(CUSTOMER_ROLES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requirePlatformDb();
      return reviewUser(db, {
        userId: input.userId,
        status: "active",
        reviewerId: ctx.user!.id,
        companyId: input.companyId,
        customerRole: input.customerRole,
      });
    }),

  reject: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requirePlatformDb();
      return reviewUser(db, {
        userId: input.userId,
        status: "rejected",
        reviewerId: ctx.user!.id,
      });
    }),

  disable: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requirePlatformDb();
      return reviewUser(db, {
        userId: input.userId,
        status: "disabled",
        reviewerId: ctx.user!.id,
      });
    }),

  assignCompany: adminProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        companyId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requirePlatformDb();
      return assignUserCompany(db, input);
    }),

  updateRole: adminProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        customerRole: z.enum(CUSTOMER_ROLES),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requirePlatformDb();
      return updateUserRole(db, input);
    }),
});

const featureSchema = z.object(
  Object.fromEntries(PLATFORM_FEATURE_KEYS.map(key => [key, z.boolean().optional()])) as Record<
    (typeof PLATFORM_FEATURE_KEYS)[number],
    z.ZodOptional<z.ZodBoolean>
  >,
);

const subscriptionsRouter = router({
  list: adminProcedure
    .input(
      z
        .object({
          companyId: z.number().int().positive().optional(),
          search: z.string().trim().max(255).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = await requirePlatformDb();
      return listSubscriptions(db, input);
    }),

  upsert: adminProcedure
    .input(
      z.object({
        companyId: z.number().int().positive(),
        planType: z.enum(COMPANY_PLAN_TYPES),
        planName: z.string().trim().max(120).optional(),
        status: z.enum(COMPANY_SUBSCRIPTION_STATUSES).optional(),
        expiresAt: z.date().nullable().optional(),
        maxProjects: z.number().int().min(1).max(100).optional(),
        monthlyAiTests: z.number().int().min(0).max(10000).optional(),
        monthlyContentTasks: z.number().int().min(0).max(10000).optional(),
        monthlyReports: z.number().int().min(0).max(100).optional(),
        maxTeamMembers: z.number().int().min(1).max(500).optional(),
        enabledFeatures: featureSchema.optional(),
        notes: z.string().trim().max(5000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requirePlatformDb();
      return upsertCompanySubscription(db, input);
    }),

  pause: adminProcedure
    .input(z.object({ companyId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await requirePlatformDb();
      return pauseCompanySubscription(db, input.companyId);
    }),

  extend: adminProcedure
    .input(
      z.object({
        companyId: z.number().int().positive(),
        expiresAt: z.date(),
        status: z.enum(COMPANY_SUBSCRIPTION_STATUSES).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requirePlatformDb();
      return extendCompanySubscription(db, input);
    }),

  updateFeatures: adminProcedure
    .input(
      z.object({
        companyId: z.number().int().positive(),
        enabledFeatures: featureSchema,
        maxProjects: z.number().int().min(1).max(100).optional(),
        monthlyAiTests: z.number().int().min(0).max(10000).optional(),
        monthlyContentTasks: z.number().int().min(0).max(10000).optional(),
        monthlyReports: z.number().int().min(0).max(100).optional(),
        maxTeamMembers: z.number().int().min(1).max(500).optional(),
        notes: z.string().trim().max(5000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requirePlatformDb();
      return updateSubscriptionFeatures(db, input);
    }),
});

const projectsRouter = router({
  listBindings: adminProcedure
    .input(z.object({ companyId: z.number().int().positive().optional() }).optional())
    .query(async ({ input }) => {
      const db = await requirePlatformDb();
      return listProjectBindings(db, input);
    }),

  bind: adminProcedure
    .input(
      z.object({
        companyId: z.number().int().positive(),
        projectId: z.number().int().positive(),
        projectName: z.string().trim().max(255).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requirePlatformDb();
      return bindProjectToCompany(db, input);
    }),

  unbind: adminProcedure
    .input(
      z.object({
        companyId: z.number().int().positive(),
        projectId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requirePlatformDb();
      return unbindProject(db, input);
    }),

  createForCompany: adminProcedure
    .input(
      z.object({
        companyId: z.number().int().positive(),
        ownerUserId: z.number().int().positive(),
        enterpriseName: z.string().trim().min(1).max(255),
        industry: z.string().trim().max(255).optional(),
        website: z.string().trim().max(500).optional(),
        region: z.string().trim().max(255).optional(),
        productIntro: z.string().trim().max(5000).optional(),
        targetCustomers: z.string().trim().max(5000).optional(),
        coreSellingPoints: z.string().trim().max(5000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requirePlatformDb();
      return createProjectForCompany(db, input);
    }),
});

const deliveryRouter = router({
  list: adminProcedure
    .input(z.object({ renewalRisk: z.enum(RENEWAL_RISK_LEVELS).optional() }).optional())
    .query(async ({ input }) => {
      const db = await requirePlatformDb();
      return listDeliveryBoard(db, input);
    }),

  getSummary: adminProcedure.query(async () => {
    const db = await requirePlatformDb();
    return getDeliverySummary(db);
  }),

  getCommandCenter: adminProcedure.query(async () => {
    const db = await requirePlatformDb();
    return getDeliveryCommandCenter(db);
  }),
});

export const adminPlatformRouter = router({
  customers: customersRouter,
  users: usersRouter,
  subscriptions: subscriptionsRouter,
  projects: projectsRouter,
  delivery: deliveryRouter,
});
