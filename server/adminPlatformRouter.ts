import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  COMPANY_PLAN_TYPES,
  COMPANY_SUBSCRIPTION_STATUSES,
  CUSTOMER_COMPANY_STATUSES,
  CUSTOMER_ROLES,
  PLATFORM_FEATURE_KEYS,
  RENEWAL_RISK_LEVELS,
  USER_REVIEW_STATUSES,
} from "@shared/platformAdmin";
import { adminProcedure, operatorAdminProcedure, router } from "./_core/trpc";
import {
  assignUserCompany,
  assertCustomerCompanyAccess,
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
import type { PlatformActor } from "@shared/platformAdmin";

function platformActorFromCtx(ctx: { user: { id: number; role: string } }): PlatformActor {
  return { userId: ctx.user.id, role: ctx.user.role };
}

const customersRouter = router({
  list: operatorAdminProcedure
    .input(
      z
        .object({
          status: z.enum(CUSTOMER_COMPANY_STATUSES).optional(),
          search: z.string().trim().max(255).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const db = await requirePlatformDb();
      return listCustomerCompanies(db, input, platformActorFromCtx(ctx));
    }),

  get: operatorAdminProcedure
    .input(z.object({ companyId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await requirePlatformDb();
      return getCustomerCompany(db, input.companyId, platformActorFromCtx(ctx));
    }),

  metrics: operatorAdminProcedure.query(async ({ ctx }) => {
    const db = await requirePlatformDb();
    return getCustomerCompanyMetrics(db, platformActorFromCtx(ctx));
  }),

  create: operatorAdminProcedure
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
    .mutation(async ({ ctx, input }) => {
      const db = await requirePlatformDb();
      return createCustomerCompany(
        db,
        {
          ...input,
          contactEmail: input.contactEmail || undefined,
        },
        platformActorFromCtx(ctx),
      );
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

  update: operatorAdminProcedure
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
    .mutation(async ({ ctx, input }) => {
      const db = await requirePlatformDb();
      const { companyId, contactEmail, ...rest } = input;
      return updateCustomerCompany(
        db,
        {
          companyId,
          ...rest,
          contactEmail: contactEmail === "" ? "" : contactEmail,
        },
        platformActorFromCtx(ctx),
      );
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
  list: operatorAdminProcedure
    .input(
      z
        .object({
          companyId: z.number().int().positive().optional(),
          search: z.string().trim().max(255).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const db = await requirePlatformDb();
      return listSubscriptions(db, input, platformActorFromCtx(ctx));
    }),

  upsert: operatorAdminProcedure
    .input(
      z.object({
        companyId: z.number().int().positive(),
        planType: z.enum(COMPANY_PLAN_TYPES),
        planName: z.string().trim().max(120).optional(),
        status: z.enum(COMPANY_SUBSCRIPTION_STATUSES).optional(),
        startedAt: z.date().optional(),
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
    .mutation(async ({ ctx, input }) => {
      const db = await requirePlatformDb();
      return upsertCompanySubscription(db, input, platformActorFromCtx(ctx));
    }),

  pause: operatorAdminProcedure
    .input(z.object({ companyId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requirePlatformDb();
      await assertCustomerCompanyAccess(db, platformActorFromCtx(ctx), input.companyId);
      return pauseCompanySubscription(db, input.companyId);
    }),

  extend: operatorAdminProcedure
    .input(
      z.object({
        companyId: z.number().int().positive(),
        expiresAt: z.date(),
        status: z.enum(COMPANY_SUBSCRIPTION_STATUSES).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requirePlatformDb();
      await assertCustomerCompanyAccess(db, platformActorFromCtx(ctx), input.companyId);
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
  listBindings: operatorAdminProcedure
    .input(z.object({ companyId: z.number().int().positive().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await requirePlatformDb();
      return listProjectBindings(db, input, platformActorFromCtx(ctx));
    }),

  bind: operatorAdminProcedure
    .input(
      z.object({
        companyId: z.number().int().positive(),
        projectId: z.number().int().positive(),
        projectName: z.string().trim().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requirePlatformDb();
      return bindProjectToCompany(db, input, platformActorFromCtx(ctx));
    }),

  unbind: operatorAdminProcedure
    .input(
      z.object({
        companyId: z.number().int().positive(),
        projectId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requirePlatformDb();
      return unbindProject(db, input, platformActorFromCtx(ctx));
    }),

  createForCompany: operatorAdminProcedure
    .input(
      z.object({
        companyId: z.number().int().positive(),
        ownerUserId: z.number().int().positive().optional(),
        enterpriseName: z.string().trim().min(1).max(255),
        industry: z.string().trim().max(255).optional(),
        website: z.string().trim().max(500).optional(),
        region: z.string().trim().max(255).optional(),
        productIntro: z.string().trim().max(5000).optional(),
        targetCustomers: z.string().trim().max(5000).optional(),
        coreSellingPoints: z.string().trim().max(5000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requirePlatformDb();
      const actor = platformActorFromCtx(ctx);
      const ownerUserId = actor.role === "operator" ? actor.userId : input.ownerUserId;
      if (!ownerUserId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请指定项目归属用户" });
      }
      return createProjectForCompany(db, { ...input, ownerUserId }, actor);
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
