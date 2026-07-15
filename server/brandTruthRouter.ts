import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  brandTruthConflicts,
  brandTruthEvidence,
  brandTruthFactEvidenceLinks,
  brandTruthFacts,
  brandTruthFactVersions,
  brandTruthProfiles,
  understandingCorrectionTasks,
  understandingDimensionResults,
  understandingEvaluations,
  understandingQuestions,
  understandingQuestionSets,
  understandingRuleConfigs,
} from "../drizzle/schema";
import { BRAND_TRUTH_EVIDENCE_TYPES, BRAND_TRUTH_VERIFICATION_STATUSES, canPromoteFactFromEvidence, isQualifiedPublicEvidence, normalizeTruthValue } from "@shared/brandTruth";
import { CORRECTION_ACTION_TYPES, UNDERSTANDING_FIELD_STATUSES } from "@shared/understandingEngine";
import { adminProcedure, operatorAdminProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { getCurrentUserId, requireProjectAccess } from "./projectAccess";
import {
  buildUnderstandingSummary,
  createProfileFromExistingData,
  ensureDefaultUnderstandingQuestionSet,
  listLinkedEvidence,
  loadTruthContext,
  refreshTruthProfileStats,
  runUnderstandingTest,
} from "./brandTruthService";
import { applyBrandTruthVerificationBatch, brandTruthVerificationPlanSchema } from "./brandTruthVerificationBatch";
import { executeExclusiveUnderstandWrite, UnderstandReadService } from "./understandReadService";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
  return db;
}

async function requireScopedRow<T extends { projectId: number }>(rows: T[], message: string, ctx: Parameters<typeof requireProjectAccess>[0]) {
  const row = rows[0];
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message });
  await requireProjectAccess(ctx, row.projectId);
  return row;
}

const projectIdInput = z.object({ projectId: z.number().int().positive() });
const verificationStatusSchema = z.enum(BRAND_TRUTH_VERIFICATION_STATUSES);
const factInput = z.object({
  category: z.enum(["identity", "business", "capability_boundary", "temporal"]),
  factType: z.string().trim().min(1).max(64),
  factKey: z.string().trim().min(1).max(128),
  factValue: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  importance: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  verificationStatus: verificationStatusSchema.default("provided_unverified"),
  validFrom: z.coerce.date().optional().nullable(),
  validTo: z.coerce.date().optional().nullable(),
});

const evidenceInput = z.object({
  evidenceType: z.enum(BRAND_TRUTH_EVIDENCE_TYPES),
  title: z.string().trim().min(1).max(500),
  url: z.string().trim().max(2000).optional().nullable(),
  publisher: z.string().trim().max(255).optional().nullable(),
  sourceOwner: z.string().trim().max(255).optional().nullable(),
  sourceClass: z.enum(["official", "third_party", "enterprise_provided", "unknown"]),
  independentSource: z.boolean().default(false),
  accessible: z.boolean().default(false),
  authorityLevel: z.enum(["high", "medium", "low", "unknown"]).default("unknown"),
  freshnessStatus: z.enum(["current", "aging", "outdated", "unknown"]).default("unknown"),
  consistencyStatus: z.enum(["consistent", "partial", "conflicting", "unknown"]).default("unknown"),
  verificationStatus: z.enum(["pending", "verified", "rejected", "unverifiable"]).default("pending"),
  evidenceExcerpt: z.string().optional().nullable(),
  evidenceHash: z.string().max(128).optional().nullable(),
  manualReviewStatus: z.enum(["pending", "approved", "rejected"]).default("pending"),
  publishedAt: z.coerce.date().optional().nullable(),
  sourceUpdatedAt: z.coerce.date().optional().nullable(),
  capturedAt: z.coerce.date().optional().nullable(),
});

async function assertVerifiedStatusHasEvidence(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, projectId: number, factId: number | null, status: z.infer<typeof verificationStatusSchema>) {
  if (!["official_verified", "third_party_verified", "multi_source_verified"].includes(status)) return;
  if (!factId) throw new TRPCError({ code: "BAD_REQUEST", message: "新事实必须先保存并关联已审核公开证据，不能直接标记为已验证" });
  const links = await db.select().from(brandTruthFactEvidenceLinks).where(and(eq(brandTruthFactEvidenceLinks.projectId, projectId), eq(brandTruthFactEvidenceLinks.factId, factId)));
  const evidenceIds = links.filter(link => link.supportType === "supports").map(link => link.evidenceId);
  if (!evidenceIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "缺少支持该事实的公开证据" });
  const evidence = await db.select().from(brandTruthEvidence).where(and(eq(brandTruthEvidence.projectId, projectId), inArray(brandTruthEvidence.id, evidenceIds)));
  if (!canPromoteFactFromEvidence(status, evidence)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "事实升级条件不足：公开 URL、来源主体、访问记录、内容哈希、审核状态、独立性或多来源主体不符合要求" });
  }
}

async function refreshFactEvidenceStats(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, projectId: number, factId: number) {
  const linked = await listLinkedEvidence(db, projectId, factId);
  const supportingIds = new Set(linked.links.filter(link => link.supportType === "supports").map(link => link.evidenceId));
  const supporting = linked.evidence.filter(evidence => supportingIds.has(evidence.id));
  const contradicting = linked.links.filter(link => link.supportType === "contradicts").length;
  await db.update(brandTruthFacts).set({
    sourceCount: supporting.length,
    officialSourceCount: supporting.filter(item => isQualifiedPublicEvidence(item) && item.sourceClass === "official").length,
    thirdPartySourceCount: supporting.filter(item => isQualifiedPublicEvidence(item) && item.sourceClass === "third_party" && item.independentSource).length,
    conflictCount: contradicting,
  }).where(and(eq(brandTruthFacts.projectId, projectId), eq(brandTruthFacts.id, factId)));
}

async function recordEvidenceChangeVersion(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  input: { projectId: number; factId: number; userId: number; evidenceId: number; action: "linked" | "unlinked"; supportType?: string },
) {
  const [factRows, profileRows] = await Promise.all([
    db.select().from(brandTruthFacts).where(and(eq(brandTruthFacts.projectId, input.projectId), eq(brandTruthFacts.id, input.factId))).limit(1),
    db.select().from(brandTruthProfiles).where(eq(brandTruthProfiles.projectId, input.projectId)).limit(1),
  ]);
  const fact = factRows[0];
  const profile = profileRows[0];
  if (!fact || !profile) return;
  const factVersion = fact.version + 1;
  const profileVersion = profile.currentVersion + 1;
  await db.transaction(async tx => {
    await tx.update(brandTruthFacts).set({ version: factVersion }).where(and(eq(brandTruthFacts.projectId, input.projectId), eq(brandTruthFacts.id, input.factId)));
    await tx.insert(brandTruthFactVersions).values({
      factId: input.factId, projectId: input.projectId, version: factVersion, profileVersion,
      previousValue: fact.factValue, newValue: fact.factValue,
      previousVerificationStatus: fact.verificationStatus, newVerificationStatus: fact.verificationStatus,
      changeReason: input.action === "linked" ? "关联事实证据" : "解除事实证据关联",
      evidenceChange: { action: input.action, evidenceId: input.evidenceId, supportType: input.supportType ?? null },
      changedBy: input.userId, requiresRevalidation: true,
    });
    await tx.update(brandTruthProfiles).set({ currentVersion: profileVersion, status: "needs_review" }).where(eq(brandTruthProfiles.projectId, input.projectId));
  });
}

export const brandTruthRouter = router({
  getProfile: protectedProcedure.input(projectIdInput).query(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    return loadTruthContext(db, input.projectId);
  }),

  createProfile: operatorAdminProcedure.input(projectIdInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    return createProfileFromExistingData(db, input.projectId, getCurrentUserId(ctx));
  }),

  applyVerificationBatch: adminProcedure.input(projectIdInput.extend({ plan: brandTruthVerificationPlanSchema })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    try {
      return await applyBrandTruthVerificationBatch(db, {
        projectId: input.projectId,
        userId: getCurrentUserId(ctx),
        plan: input.plan,
      });
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "批量事实核验失败" });
    }
  }),

  updateProfile: operatorAdminProcedure.input(projectIdInput.extend({ status: z.enum(["draft", "active", "needs_review", "archived"]), reviewNote: z.string().optional() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    await db.update(brandTruthProfiles).set({ status: input.status, lastReviewedAt: input.status === "active" ? new Date() : undefined }).where(eq(brandTruthProfiles.projectId, input.projectId));
    return { success: true as const };
  }),

  listFacts: protectedProcedure.input(projectIdInput).query(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    const context = await loadTruthContext(db, input.projectId);
    return context.facts.length ? context.facts : context.fallbackFacts;
  }),

  createFact: operatorAdminProcedure.input(projectIdInput.extend({ data: factInput })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    await assertVerifiedStatusHasEvidence(db, input.projectId, null, input.data.verificationStatus);
    const profile = await createProfileFromExistingData(db, input.projectId, getCurrentUserId(ctx));
    const profileVersion = profile.currentVersion + 1;
    const inserted = await db.insert(brandTruthFacts).values({
      ...input.data, projectId: input.projectId, profileId: profile.id, normalizedValue: normalizeTruthValue(input.data.factValue), createdBy: getCurrentUserId(ctx),
    }).$returningId();
    const id = inserted[0]?.id;
    if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "创建事实失败" });
    await db.insert(brandTruthFactVersions).values({ factId: id, projectId: input.projectId, version: 1, profileVersion, previousValue: null, newValue: input.data.factValue, previousVerificationStatus: null, newVerificationStatus: input.data.verificationStatus, changeReason: "创建品牌事实", changedBy: getCurrentUserId(ctx), requiresRevalidation: true });
    await db.update(brandTruthProfiles).set({ currentVersion: profileVersion, status: "needs_review" }).where(eq(brandTruthProfiles.projectId, input.projectId));
    await refreshTruthProfileStats(db, input.projectId);
    return { success: true as const, id };
  }),

  updateFact: operatorAdminProcedure.input(projectIdInput.extend({ id: z.number().int().positive(), data: factInput, changeReason: z.string().trim().min(1), affectsHistoricalInterpretation: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const existing = await requireScopedRow(await db.select().from(brandTruthFacts).where(and(eq(brandTruthFacts.id, input.id), eq(brandTruthFacts.projectId, input.projectId))).limit(1), "品牌事实不存在", ctx);
    await assertVerifiedStatusHasEvidence(db, input.projectId, input.id, input.data.verificationStatus);
    const nextVersion = existing.version + 1;
    const profileRows = await db.select().from(brandTruthProfiles).where(eq(brandTruthProfiles.projectId, input.projectId)).limit(1);
    const profileVersion = (profileRows[0]?.currentVersion ?? 1) + 1;
    await db.transaction(async tx => {
      await tx.update(brandTruthFacts).set({ ...input.data, normalizedValue: normalizeTruthValue(input.data.factValue), version: nextVersion, reviewedBy: getCurrentUserId(ctx), lastVerifiedAt: ["official_verified", "third_party_verified", "multi_source_verified"].includes(input.data.verificationStatus) ? new Date() : null }).where(and(eq(brandTruthFacts.id, input.id), eq(brandTruthFacts.projectId, input.projectId)));
      await tx.insert(brandTruthFactVersions).values({ factId: input.id, projectId: input.projectId, version: nextVersion, profileVersion, previousValue: existing.factValue, newValue: input.data.factValue, previousVerificationStatus: existing.verificationStatus, newVerificationStatus: input.data.verificationStatus, changeReason: input.changeReason, changedBy: getCurrentUserId(ctx), affectsHistoricalInterpretation: input.affectsHistoricalInterpretation, requiresRevalidation: existing.factValue !== input.data.factValue || existing.verificationStatus !== input.data.verificationStatus, effectiveAt: input.data.validFrom ?? new Date() });
      await tx.update(brandTruthProfiles).set({ currentVersion: profileVersion, status: "needs_review" }).where(eq(brandTruthProfiles.projectId, input.projectId));
    });
    await refreshTruthProfileStats(db, input.projectId);
    return { success: true as const, version: nextVersion };
  }),

  archiveFact: operatorAdminProcedure.input(projectIdInput.extend({ id: z.number().int().positive(), reason: z.string().trim().min(1) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const fact = await requireScopedRow(await db.select().from(brandTruthFacts).where(and(eq(brandTruthFacts.id, input.id), eq(brandTruthFacts.projectId, input.projectId))).limit(1), "品牌事实不存在", ctx);
    const nextVersion = fact.version + 1;
    const profileRows = await db.select().from(brandTruthProfiles).where(eq(brandTruthProfiles.projectId, input.projectId)).limit(1);
    const profileVersion = (profileRows[0]?.currentVersion ?? 1) + 1;
    await db.update(brandTruthFacts).set({ verificationStatus: "deprecated", archivedAt: new Date(), version: nextVersion, reviewedBy: getCurrentUserId(ctx) }).where(and(eq(brandTruthFacts.id, input.id), eq(brandTruthFacts.projectId, input.projectId)));
    await db.insert(brandTruthFactVersions).values({ factId: fact.id, projectId: input.projectId, version: nextVersion, profileVersion, previousValue: fact.factValue, newValue: fact.factValue, previousVerificationStatus: fact.verificationStatus, newVerificationStatus: "deprecated", changeReason: input.reason, changedBy: getCurrentUserId(ctx), affectsHistoricalInterpretation: true, requiresRevalidation: true, effectiveAt: new Date() });
    await db.update(brandTruthProfiles).set({ currentVersion: profileVersion, status: "needs_review" }).where(eq(brandTruthProfiles.projectId, input.projectId));
    await refreshTruthProfileStats(db, input.projectId);
    return { success: true as const };
  }),

  listFactVersions: protectedProcedure.input(projectIdInput.extend({ factId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireScopedRow(await db.select().from(brandTruthFacts).where(and(eq(brandTruthFacts.id, input.factId), eq(brandTruthFacts.projectId, input.projectId))).limit(1), "品牌事实不存在", ctx);
    return db.select().from(brandTruthFactVersions).where(and(eq(brandTruthFactVersions.projectId, input.projectId), eq(brandTruthFactVersions.factId, input.factId))).orderBy(desc(brandTruthFactVersions.version));
  }),

  addEvidence: operatorAdminProcedure.input(projectIdInput.extend({ data: evidenceInput })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    const inserted = await db.insert(brandTruthEvidence).values({ ...input.data, projectId: input.projectId }).$returningId();
    const id = inserted[0]?.id;
    if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "添加证据失败" });
    return { success: true as const, id };
  }),

  linkEvidence: operatorAdminProcedure.input(projectIdInput.extend({ factId: z.number().int().positive(), evidenceId: z.number().int().positive(), supportType: z.enum(["supports", "contradicts", "context_only"]), confidence: z.number().int().min(0).max(100) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireScopedRow(await db.select().from(brandTruthFacts).where(and(eq(brandTruthFacts.id, input.factId), eq(brandTruthFacts.projectId, input.projectId))).limit(1), "品牌事实不存在", ctx);
    await requireScopedRow(await db.select().from(brandTruthEvidence).where(and(eq(brandTruthEvidence.id, input.evidenceId), eq(brandTruthEvidence.projectId, input.projectId))).limit(1), "证据不存在", ctx);
    await db.insert(brandTruthFactEvidenceLinks).values({ projectId: input.projectId, factId: input.factId, evidenceId: input.evidenceId, supportType: input.supportType, confidence: input.confidence, reviewedAt: new Date() }).onDuplicateKeyUpdate({ set: { supportType: input.supportType, confidence: input.confidence, reviewedAt: new Date() } });
    await refreshFactEvidenceStats(db, input.projectId, input.factId);
    await recordEvidenceChangeVersion(db, { projectId: input.projectId, factId: input.factId, evidenceId: input.evidenceId, supportType: input.supportType, action: "linked", userId: getCurrentUserId(ctx) });
    return { success: true as const };
  }),

  unlinkEvidence: operatorAdminProcedure.input(projectIdInput.extend({ factId: z.number().int().positive(), evidenceId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireScopedRow(await db.select().from(brandTruthFacts).where(and(eq(brandTruthFacts.id, input.factId), eq(brandTruthFacts.projectId, input.projectId))).limit(1), "品牌事实不存在", ctx);
    await db.delete(brandTruthFactEvidenceLinks).where(and(eq(brandTruthFactEvidenceLinks.projectId, input.projectId), eq(brandTruthFactEvidenceLinks.factId, input.factId), eq(brandTruthFactEvidenceLinks.evidenceId, input.evidenceId)));
    await refreshFactEvidenceStats(db, input.projectId, input.factId);
    await recordEvidenceChangeVersion(db, { projectId: input.projectId, factId: input.factId, evidenceId: input.evidenceId, action: "unlinked", userId: getCurrentUserId(ctx) });
    return { success: true as const };
  }),

  listEvidence: protectedProcedure.input(projectIdInput).query(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    return db.select().from(brandTruthEvidence).where(eq(brandTruthEvidence.projectId, input.projectId)).orderBy(desc(brandTruthEvidence.updatedAt));
  }),

  reviewEvidence: operatorAdminProcedure.input(projectIdInput.extend({ id: z.number().int().positive(), verificationStatus: z.enum(["verified", "rejected", "unverifiable"]), manualReviewStatus: z.enum(["approved", "rejected"]), accessible: z.boolean() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireScopedRow(await db.select().from(brandTruthEvidence).where(and(eq(brandTruthEvidence.id, input.id), eq(brandTruthEvidence.projectId, input.projectId))).limit(1), "证据不存在", ctx);
    await db.update(brandTruthEvidence).set({ verificationStatus: input.verificationStatus, manualReviewStatus: input.manualReviewStatus, accessible: input.accessible, capturedAt: new Date() }).where(and(eq(brandTruthEvidence.id, input.id), eq(brandTruthEvidence.projectId, input.projectId)));
    return { success: true as const };
  }),

  createConflict: operatorAdminProcedure.input(projectIdInput.extend({ factId: z.number().int().positive(), factKey: z.string().trim().min(1).max(128), evidenceAId: z.number().int().positive().optional().nullable(), evidenceBId: z.number().int().positive().optional().nullable(), conflictType: z.string().trim().min(1).max(64), severity: z.enum(["P0", "P1", "P2"]) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireScopedRow(await db.select().from(brandTruthFacts).where(and(eq(brandTruthFacts.id, input.factId), eq(brandTruthFacts.projectId, input.projectId))).limit(1), "品牌事实不存在", ctx);
    const evidenceIds = [input.evidenceAId, input.evidenceBId].filter((id): id is number => Boolean(id));
    if (evidenceIds.length) {
      const evidence = await db.select({ id: brandTruthEvidence.id }).from(brandTruthEvidence).where(and(eq(brandTruthEvidence.projectId, input.projectId), inArray(brandTruthEvidence.id, evidenceIds)));
      if (evidence.length !== new Set(evidenceIds).size) throw new TRPCError({ code: "BAD_REQUEST", message: "冲突证据不属于当前项目" });
    }
    const inserted = await db.insert(brandTruthConflicts).values({ ...input, resolutionStatus: "open" }).$returningId();
    await db.update(brandTruthFacts).set({ verificationStatus: "conflicting" }).where(and(eq(brandTruthFacts.id, input.factId), eq(brandTruthFacts.projectId, input.projectId)));
    await refreshTruthProfileStats(db, input.projectId);
    return { success: true as const, id: inserted[0]?.id };
  }),

  listConflicts: protectedProcedure.input(projectIdInput).query(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    return db.select().from(brandTruthConflicts).where(eq(brandTruthConflicts.projectId, input.projectId)).orderBy(desc(brandTruthConflicts.createdAt));
  }),

  resolveConflict: operatorAdminProcedure.input(projectIdInput.extend({ id: z.number().int().positive(), resolutionStatus: z.enum(["resolved", "accepted_difference"]), resolutionNote: z.string().trim().min(1) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireScopedRow(await db.select().from(brandTruthConflicts).where(and(eq(brandTruthConflicts.id, input.id), eq(brandTruthConflicts.projectId, input.projectId))).limit(1), "事实冲突不存在", ctx);
    await db.update(brandTruthConflicts).set({ resolutionStatus: input.resolutionStatus, resolutionNote: input.resolutionNote, resolvedBy: getCurrentUserId(ctx), resolvedAt: new Date() }).where(and(eq(brandTruthConflicts.id, input.id), eq(brandTruthConflicts.projectId, input.projectId)));
    return { success: true as const };
  }),
});

const questionInput = z.object({
  category: z.string().trim().min(1).max(64),
  questionType: z.enum(["system_default", "project_custom", "high_risk", "name_collision", "outdated_info", "competitor_confusion"]),
  questionText: z.string().trim().min(1),
  verificationFactKeys: z.array(z.string().trim().min(1)).min(1),
  enabled: z.boolean().default(true),
  fixedAcrossPeriods: z.boolean().default(true),
});

const correctionTaskInput = z.object({
  evaluationId: z.string().uuid().optional().nullable(),
  factKey: z.string().trim().min(1).max(128),
  expectedFact: z.string().optional().nullable(),
  observedStatement: z.string().trim().min(1),
  severity: z.enum(["P0", "P1", "P2"]),
  recommendedAssetType: z.string().trim().min(1).max(64),
  actionType: z.enum(CORRECTION_ACTION_TYPES),
  actionDescription: z.string().trim().min(1),
  requiredEvidence: z.string().trim().min(1),
  owner: z.string().max(255).optional().nullable(),
  dependency: z.string().optional().nullable(),
  completionCriteria: z.string().trim().min(1),
  verificationQuestionIds: z.array(z.number().int().positive()).default([]),
  targetRetestRound: z.string().max(64).optional().nullable(),
  targetRetestAt: z.coerce.date().optional().nullable(),
});

export const understandingRouter = router({
  listQuestionSets: protectedProcedure.input(projectIdInput).query(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    const sets = await db.select().from(understandingQuestionSets).where(eq(understandingQuestionSets.projectId, input.projectId)).orderBy(desc(understandingQuestionSets.version));
    const questions = await db.select().from(understandingQuestions).where(eq(understandingQuestions.projectId, input.projectId)).orderBy(understandingQuestions.sortOrder);
    return sets.map(set => ({ ...set, questions: questions.filter(question => question.questionSetId === set.id) }));
  }),

  createQuestionSet: operatorAdminProcedure.input(projectIdInput.extend({ name: z.string().trim().min(1).max(255), questions: z.array(questionInput).min(1) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    const existing = await db.select().from(understandingQuestionSets).where(eq(understandingQuestionSets.projectId, input.projectId)).orderBy(desc(understandingQuestionSets.version)).limit(1);
    const version = (existing[0]?.version ?? 0) + 1;
    const inserted = await db.insert(understandingQuestionSets).values({ projectId: input.projectId, name: input.name, version, status: "draft", fixedAcrossPeriods: true, createdBy: getCurrentUserId(ctx) }).$returningId();
    const id = inserted[0]?.id;
    if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "创建问题集失败" });
    await db.insert(understandingQuestions).values(input.questions.map((question, index) => ({ ...question, projectId: input.projectId, questionSetId: id, sortOrder: index + 1 })));
    return { success: true as const, id, version };
  }),

  updateQuestionSet: operatorAdminProcedure.input(projectIdInput.extend({ id: z.number().int().positive(), name: z.string().trim().min(1).max(255), status: z.enum(["draft", "active", "archived"]), validFrom: z.coerce.date().optional().nullable(), validTo: z.coerce.date().optional().nullable() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireScopedRow(await db.select().from(understandingQuestionSets).where(and(eq(understandingQuestionSets.id, input.id), eq(understandingQuestionSets.projectId, input.projectId))).limit(1), "问题集不存在", ctx);
    if (input.status === "active") await db.update(understandingQuestionSets).set({ status: "archived" }).where(and(eq(understandingQuestionSets.projectId, input.projectId), eq(understandingQuestionSets.status, "active")));
    await db.update(understandingQuestionSets).set({ name: input.name, status: input.status, validFrom: input.validFrom, validTo: input.validTo }).where(and(eq(understandingQuestionSets.id, input.id), eq(understandingQuestionSets.projectId, input.projectId)));
    return { success: true as const };
  }),

  ensureDefaultQuestionSet: operatorAdminProcedure.input(projectIdInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const project = await requireProjectAccess(ctx, input.projectId);
    const context = await loadTruthContext(db, input.projectId);
    return ensureDefaultUnderstandingQuestionSet(db, input.projectId, getCurrentUserId(ctx), project.enterpriseName, context.legacyProfile);
  }),

  runUnderstandingTest: operatorAdminProcedure.input(projectIdInput.extend({ questionIds: z.array(z.number().int().positive()).optional(), targetRetestRound: z.string().max(64).optional().nullable() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    try {
      const cutover = new UnderstandReadService(db);
      return await executeExclusiveUnderstandWrite(await cutover.getWritePath(input.projectId), {
        legacy: () => runUnderstandingTest(db, { ...input, userId: getCurrentUserId(ctx) }),
        v2: async () => { throw new Error("v2 write orchestration is not enabled for this legacy endpoint"); },
      });
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "理解测试执行失败" });
    }
  }),

  getUnderstandingSummary: protectedProcedure.input(projectIdInput).query(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    return buildUnderstandingSummary(db, input.projectId);
  }),

  getDimensionResults: protectedProcedure.input(projectIdInput).query(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    return db.select().from(understandingDimensionResults).where(eq(understandingDimensionResults.projectId, input.projectId)).orderBy(desc(understandingDimensionResults.createdAt));
  }),

  getFactComparisons: protectedProcedure.input(projectIdInput.extend({ evaluationId: z.string().uuid().optional() })).query(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    const rows = await db.select().from(understandingEvaluations).where(input.evaluationId ? and(eq(understandingEvaluations.projectId, input.projectId), eq(understandingEvaluations.id, input.evaluationId)) : eq(understandingEvaluations.projectId, input.projectId)).orderBy(desc(understandingEvaluations.testedAt));
    return rows.map(row => ({ evaluationId: row.id, questionId: row.questionId, ruleResults: row.ruleResults, truthProfileVersion: row.truthProfileVersion, questionSetVersion: row.questionSetVersion }));
  }),

  listMisunderstandings: protectedProcedure.input(projectIdInput).query(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    return db.select().from(understandingEvaluations).where(eq(understandingEvaluations.projectId, input.projectId)).orderBy(desc(understandingEvaluations.testedAt));
  }),

  readUnderstandingCutover: protectedProcedure.input(projectIdInput).query(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    return new UnderstandReadService(db).readProject(input.projectId);
  }),

  reviewEvaluation: operatorAdminProcedure.input(projectIdInput.extend({ id: z.string().uuid(), finalStatus: z.enum(UNDERSTANDING_FIELD_STATUSES), reviewNote: z.string().trim().min(1) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireScopedRow(await db.select().from(understandingEvaluations).where(and(eq(understandingEvaluations.id, input.id), eq(understandingEvaluations.projectId, input.projectId))).limit(1), "理解评价不存在", ctx);
    await db.update(understandingEvaluations).set({ finalStatus: input.finalStatus, manualReviewStatus: "overridden", reviewNote: input.reviewNote, reviewedBy: getCurrentUserId(ctx), reviewedAt: new Date() }).where(and(eq(understandingEvaluations.id, input.id), eq(understandingEvaluations.projectId, input.projectId)));
    return { success: true as const };
  }),

  createCorrectionTask: operatorAdminProcedure.input(projectIdInput.extend(correctionTaskInput.shape)).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    if (input.evaluationId) await requireScopedRow(await db.select().from(understandingEvaluations).where(and(eq(understandingEvaluations.id, input.evaluationId), eq(understandingEvaluations.projectId, input.projectId))).limit(1), "理解评价不存在", ctx);
    const inserted = await db.insert(understandingCorrectionTasks).values({ ...input, affectedStage: "understand", priority: input.severity, status: "pending", createdBy: getCurrentUserId(ctx) }).$returningId();
    return { success: true as const, id: inserted[0]?.id };
  }),

  createCorrectionTasksBatch: adminProcedure.input(projectIdInput.extend({ tasks: z.array(correctionTaskInput).min(1).max(20) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    const evaluationIds = Array.from(new Set(input.tasks.map(task => task.evaluationId).filter((id): id is string => Boolean(id))));
    if (evaluationIds.length) {
      const evaluations = await db.select({ id: understandingEvaluations.id }).from(understandingEvaluations).where(and(
        eq(understandingEvaluations.projectId, input.projectId),
        inArray(understandingEvaluations.id, evaluationIds),
      ));
      if (evaluations.length !== evaluationIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "纠偏任务引用了其他项目或不存在的理解评价" });
    }
    const insertedIds: number[] = [];
    await db.transaction(async tx => {
      for (const task of input.tasks) {
        const inserted = await tx.insert(understandingCorrectionTasks).values({
          ...task,
          projectId: input.projectId,
          affectedStage: "understand",
          priority: task.severity,
          status: task.targetRetestAt || task.targetRetestRound ? "retest_scheduled" : "pending",
          createdBy: getCurrentUserId(ctx),
        }).$returningId();
        if (!inserted[0]?.id) throw new Error("纠偏任务写入失败");
        insertedIds.push(inserted[0].id);
      }
    });
    return { success: true as const, count: insertedIds.length, ids: insertedIds };
  }),

  scheduleRetest: operatorAdminProcedure.input(projectIdInput.extend({ taskId: z.number().int().positive(), targetRetestRound: z.string().trim().min(1).max(64), targetRetestAt: z.coerce.date().optional().nullable() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireScopedRow(await db.select().from(understandingCorrectionTasks).where(and(eq(understandingCorrectionTasks.id, input.taskId), eq(understandingCorrectionTasks.projectId, input.projectId))).limit(1), "纠偏任务不存在", ctx);
    await db.update(understandingCorrectionTasks).set({ targetRetestRound: input.targetRetestRound, targetRetestAt: input.targetRetestAt ?? null, status: "retest_scheduled" }).where(and(eq(understandingCorrectionTasks.id, input.taskId), eq(understandingCorrectionTasks.projectId, input.projectId)));
    return { success: true as const };
  }),

  getTrend: protectedProcedure.input(projectIdInput).query(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    const evaluations = await db.select({ id: understandingEvaluations.id, testedAt: understandingEvaluations.testedAt, truthProfileVersion: understandingEvaluations.truthProfileVersion, questionSetVersion: understandingEvaluations.questionSetVersion, finalStatus: understandingEvaluations.finalStatus, testedChannel: understandingEvaluations.testedChannel }).from(understandingEvaluations).where(eq(understandingEvaluations.projectId, input.projectId)).orderBy(understandingEvaluations.testedAt);
    return { points: evaluations, sufficient: evaluations.length >= 2, conclusion: evaluations.length >= 2 ? "可按固定问题、事实版本和模型通道比较理解变化。" : "尚无足够历史数据形成理解趋势。" };
  }),

  getRuleConfigs: protectedProcedure.input(projectIdInput).query(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    return db.select().from(understandingRuleConfigs).where(eq(understandingRuleConfigs.projectId, input.projectId)).orderBy(understandingRuleConfigs.ruleKey);
  }),

  updateRuleConfig: adminProcedure.input(projectIdInput.extend({ ruleKey: z.string().trim().min(1).max(128), configJson: z.record(z.string(), z.unknown()), status: z.enum(["draft", "active", "archived"]) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    const existing = await db.select().from(understandingRuleConfigs).where(and(eq(understandingRuleConfigs.projectId, input.projectId), eq(understandingRuleConfigs.ruleKey, input.ruleKey))).limit(1);
    if (existing[0]) {
      await db.update(understandingRuleConfigs).set({ configJson: input.configJson, status: input.status, ruleVersion: existing[0].ruleVersion + 1, updatedBy: getCurrentUserId(ctx) }).where(eq(understandingRuleConfigs.id, existing[0].id));
      return { success: true as const, id: existing[0].id, version: existing[0].ruleVersion + 1 };
    }
    const inserted = await db.insert(understandingRuleConfigs).values({ projectId: input.projectId, ruleKey: input.ruleKey, configJson: input.configJson, status: input.status, updatedBy: getCurrentUserId(ctx) }).$returningId();
    return { success: true as const, id: inserted[0]?.id, version: 1 };
  }),
});
