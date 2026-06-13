import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { customerCases, trustEvidenceItems } from "../drizzle/schema";
import {
  computeTrustEvidenceMaturityScore,
  TRUST_EVIDENCE_TYPES,
  TRUST_EVIDENCE_VERIFICATION_STATUSES,
  type TrustEvidenceType,
} from "@shared/trustEvidence";
import { getDb } from "./db";
import { syncMonthlyPlanOnTrustOrSourceChanged } from "./monthlyPlanSync";
import { requireProjectAccess } from "./projectAccess";
import { protectedProcedure, router } from "./_core/trpc";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
  return db;
}

const evidenceTypeSchema = z.enum(
  TRUST_EVIDENCE_TYPES.map(t => t.value) as [TrustEvidenceType, ...TrustEvidenceType[]],
);

const verificationStatusSchema = z.enum(
  TRUST_EVIDENCE_VERIFICATION_STATUSES.map(s => s.value) as [
    (typeof TRUST_EVIDENCE_VERIFICATION_STATUSES)[number]["value"],
    ...(typeof TRUST_EVIDENCE_VERIFICATION_STATUSES)[number]["value"][],
  ],
);

const trustEvidenceInputSchema = z.object({
  evidenceType: evidenceTypeSchema,
  title: z.string().trim().min(1, "请填写标题").max(255),
  summary: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  sourceUrl: z.string().max(2000).optional().nullable(),
  isPublic: z.boolean().default(true),
  verificationStatus: verificationStatusSchema.default("draft"),
  displayOrder: z.number().int().default(0),
  linkedCustomerCaseId: z.number().int().positive().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

async function requireTrustEvidenceAccess(ctx: Parameters<typeof requireProjectAccess>[0], id: number) {
  const db = await requireDb();
  const rows = await db
    .select({ projectId: trustEvidenceItems.projectId })
    .from(trustEvidenceItems)
    .where(eq(trustEvidenceItems.id, id))
    .limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "信任证据不存在" });
  await requireProjectAccess(ctx, rows[0].projectId);
  return rows[0].projectId;
}

async function assertLinkedCustomerCaseBelongsToProject(
  projectId: number,
  linkedCustomerCaseId: number | null | undefined,
) {
  if (linkedCustomerCaseId == null) return;
  const db = await requireDb();
  const rows = await db
    .select({ id: customerCases.id })
    .from(customerCases)
    .where(and(eq(customerCases.id, linkedCustomerCaseId), eq(customerCases.projectId, projectId)))
    .limit(1);
  if (!rows[0]) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "关联客户案例不存在或不属于当前项目" });
  }
}

async function loadTrustEvidenceStats(projectId: number) {
  const db = await requireDb();
  const [items, caseRows] = await Promise.all([
    db
      .select()
      .from(trustEvidenceItems)
      .where(eq(trustEvidenceItems.projectId, projectId))
      .orderBy(asc(trustEvidenceItems.displayOrder), asc(trustEvidenceItems.id)),
    db.select().from(customerCases).where(eq(customerCases.projectId, projectId)),
  ]);

  const verifiedCount = items.filter(item => item.verificationStatus === "verified").length;
  const draftCount = items.filter(item => item.verificationStatus === "draft").length;
  const rejectedCount = items.filter(item => item.verificationStatus === "rejected").length;
  const confirmedCustomerCaseCount = caseRows.filter(row => row.verificationStatus === "已确认").length;

  const typeDistribution = TRUST_EVIDENCE_TYPES.reduce<Record<string, number>>((acc, type) => {
    acc[type.value] = items.filter(item => item.evidenceType === type.value).length;
    return acc;
  }, {});

  return {
    items,
    caseRows,
    verifiedCount,
    draftCount,
    rejectedCount,
    confirmedCustomerCaseCount,
    typeDistribution,
  };
}

export const trustEvidenceRouter = router({
  getTrustEvidence: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx, input.projectId);
      const { items } = await loadTrustEvidenceStats(input.projectId);
      return items;
    }),

  createTrustEvidence: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), data: trustEvidenceInputSchema }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      await assertLinkedCustomerCaseBelongsToProject(input.projectId, input.data.linkedCustomerCaseId);
      const inserted = await db
        .insert(trustEvidenceItems)
        .values({
          projectId: input.projectId,
          ...input.data,
        })
        .$returningId();
      const id = inserted[0]?.id;
      if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "创建信任证据失败" });
      await syncMonthlyPlanOnTrustOrSourceChanged(input.projectId).catch(err => {
        console.error("[monthlyPlan] sync on trust evidence create failed", { projectId: input.projectId, err });
      });
      return { success: true as const, id };
    }),

  updateTrustEvidence: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), data: trustEvidenceInputSchema.partial() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const projectId = await requireTrustEvidenceAccess(ctx, input.id);
      if (input.data.linkedCustomerCaseId !== undefined) {
        await assertLinkedCustomerCaseBelongsToProject(projectId, input.data.linkedCustomerCaseId);
      }
      await db
        .update(trustEvidenceItems)
        .set(input.data)
        .where(and(eq(trustEvidenceItems.id, input.id), eq(trustEvidenceItems.projectId, projectId)));
      await syncMonthlyPlanOnTrustOrSourceChanged(projectId).catch(err => {
        console.error("[monthlyPlan] sync on trust evidence update failed", { projectId, err });
      });
      return { success: true as const, id: input.id };
    }),

  deleteTrustEvidence: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const projectId = await requireTrustEvidenceAccess(ctx, input.id);
      await db
        .delete(trustEvidenceItems)
        .where(and(eq(trustEvidenceItems.id, input.id), eq(trustEvidenceItems.projectId, projectId)));
      return { success: true as const, id: input.id };
    }),

  getTrustEvidenceSummary: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx, input.projectId);
      const stats = await loadTrustEvidenceStats(input.projectId);
      return {
        totalCount: stats.items.length,
        verifiedCount: stats.verifiedCount,
        draftCount: stats.draftCount,
        rejectedCount: stats.rejectedCount,
        typeDistribution: stats.typeDistribution,
        confirmedCustomerCaseCount: stats.confirmedCustomerCaseCount,
        customerCaseTotalCount: stats.caseRows.length,
      };
    }),

  getTrustEvidenceMaturityScore: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx, input.projectId);
      const stats = await loadTrustEvidenceStats(input.projectId);
      return computeTrustEvidenceMaturityScore({
        verifiedCount: stats.verifiedCount,
        draftCount: stats.draftCount,
        rejectedCount: stats.rejectedCount,
        totalTrustEvidenceCount: stats.items.length,
        customerCaseCount: stats.caseRows.length,
      });
    }),
});
