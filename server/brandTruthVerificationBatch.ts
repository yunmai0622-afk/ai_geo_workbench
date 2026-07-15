import { createHash } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  brandTruthConflicts,
  brandTruthEvidence,
  brandTruthFactEvidenceLinks,
  brandTruthFacts,
  brandTruthFactVersions,
  brandTruthProfiles,
  understandingQuestions,
  understandingQuestionSets,
} from "../drizzle/schema";
import {
  BRAND_TRUTH_VERIFICATION_STATUSES,
  calculateTruthProfileStats,
  canPromoteFactFromEvidence,
  normalizeTruthValue,
} from "@shared/brandTruth";
import type { DbConn } from "./projectAccess";

const evidencePlanSchema = z.object({
  key: z.string().trim().min(1).max(64),
  evidenceType: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(500),
  url: z.string().url().max(2000),
  publisher: z.string().trim().min(1).max(255),
  sourceOwner: z.string().trim().min(1).max(255),
  sourceClass: z.enum(["official", "third_party", "enterprise_provided", "unknown"]),
  independentSource: z.boolean(),
  authorityLevel: z.enum(["high", "medium", "low", "unknown"]),
  freshnessStatus: z.enum(["current", "aging", "outdated", "unknown"]),
  consistencyStatus: z.enum(["consistent", "partial", "conflicting", "unknown"]),
  evidenceExcerpt: z.string().trim().min(1),
  publishedAt: z.coerce.date().optional().nullable(),
  sourceUpdatedAt: z.coerce.date().optional().nullable(),
  capturedAt: z.coerce.date(),
});

const factPlanSchema = z.object({
  category: z.enum(["identity", "business", "capability_boundary", "temporal"]),
  factType: z.string().trim().min(1).max(64),
  factKey: z.string().trim().min(1).max(128),
  factValue: z.string().trim().min(1),
  description: z.string().optional().nullable(),
  importance: z.enum(["critical", "high", "medium", "low"]),
  verificationStatus: z.enum(BRAND_TRUTH_VERIFICATION_STATUSES),
  supportEvidenceKeys: z.array(z.string().trim().min(1)).default([]),
  contextEvidenceKeys: z.array(z.string().trim().min(1)).default([]),
  validFrom: z.coerce.date().optional().nullable(),
  validTo: z.coerce.date().optional().nullable(),
});

const questionPlanSchema = z.object({
  category: z.string().trim().min(1).max(64),
  questionType: z.enum(["system_default", "project_custom", "high_risk", "name_collision", "outdated_info", "competitor_confusion"]),
  questionText: z.string().trim().min(1),
  verificationFactKeys: z.array(z.string().trim().min(1)).min(1),
});

export const brandTruthVerificationPlanSchema = z.object({
  expectedProfileVersion: z.number().int().positive(),
  targetProfileVersion: z.number().int().positive(),
  changeReason: z.string().trim().min(1),
  reviewerNote: z.string().trim().min(1),
  evidence: z.array(evidencePlanSchema).min(1),
  facts: z.array(factPlanSchema).min(1),
  conflicts: z.array(z.object({
    factKey: z.string().trim().min(1).max(128),
    evidenceAKey: z.string().trim().min(1).max(64).optional().nullable(),
    evidenceBKey: z.string().trim().min(1).max(64).optional().nullable(),
    conflictType: z.string().trim().min(1).max(64),
    severity: z.enum(["P0", "P1", "P2"]),
    resolutionStatus: z.enum(["open", "reviewing", "resolved", "accepted_difference"]),
    resolutionNote: z.string().trim().min(1),
  })).default([]),
  questionSet: z.object({
    name: z.string().trim().min(1).max(255),
    questions: z.array(questionPlanSchema).length(15),
  }),
}).superRefine((plan, ctx) => {
  if (plan.targetProfileVersion !== plan.expectedProfileVersion + 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetProfileVersion"], message: "目标版本必须等于当前版本 + 1" });
  }
  const evidenceKeys = new Set<string>();
  for (const [index, evidence] of plan.evidence.entries()) {
    if (evidenceKeys.has(evidence.key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["evidence", index, "key"], message: "证据 key 重复" });
    evidenceKeys.add(evidence.key);
  }
  const factKeys = new Set<string>();
  for (const [index, fact] of plan.facts.entries()) {
    if (factKeys.has(fact.factKey)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["facts", index, "factKey"], message: "事实 key 重复" });
    factKeys.add(fact.factKey);
    for (const key of [...fact.supportEvidenceKeys, ...fact.contextEvidenceKeys]) {
      if (!evidenceKeys.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["facts", index], message: `引用了不存在的证据 key：${key}` });
    }
    if (["official_verified", "third_party_verified", "multi_source_verified"].includes(fact.verificationStatus) && !fact.supportEvidenceKeys.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["facts", index, "supportEvidenceKeys"], message: "已核验事实必须关联支持证据" });
    }
  }
  for (const [index, conflict] of plan.conflicts.entries()) {
    if (!factKeys.has(conflict.factKey)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["conflicts", index, "factKey"], message: "冲突事实不在本次核验计划中" });
    for (const key of [conflict.evidenceAKey, conflict.evidenceBKey].filter(Boolean)) {
      if (!evidenceKeys.has(key!)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["conflicts", index], message: `冲突引用了不存在的证据 key：${key}` });
    }
  }
});

export type BrandTruthVerificationPlan = z.infer<typeof brandTruthVerificationPlanSchema>;

function contentHash(evidence: BrandTruthVerificationPlan["evidence"][number]): string {
  return `sha256:${createHash("sha256").update(JSON.stringify({
    url: evidence.url,
    title: evidence.title,
    sourceOwner: evidence.sourceOwner,
    evidenceExcerpt: evidence.evidenceExcerpt,
    capturedAt: evidence.capturedAt.toISOString(),
  })).digest("hex")}`;
}

export async function applyBrandTruthVerificationBatch(
  db: DbConn,
  input: { projectId: number; userId: number; plan: BrandTruthVerificationPlan },
) {
  return db.transaction(async tx => {
    const profileRows = await tx.select().from(brandTruthProfiles).where(eq(brandTruthProfiles.projectId, input.projectId)).limit(1);
    const profile = profileRows[0];
    if (!profile) throw new Error("Brand Truth Profile 尚未建立");
    if (profile.currentVersion !== input.plan.expectedProfileVersion) {
      throw new Error(`事实基线版本已变化：期望 V${input.plan.expectedProfileVersion}，当前为 V${profile.currentVersion}`);
    }

    const existingFacts = await tx.select().from(brandTruthFacts).where(and(
      eq(brandTruthFacts.projectId, input.projectId),
      isNull(brandTruthFacts.archivedAt),
    ));
    const factsByKey = new Map(existingFacts.map(fact => [fact.factKey, fact]));
    const evidenceByKey = new Map<string, typeof brandTruthEvidence.$inferSelect>();

    for (const evidence of input.plan.evidence) {
      const inserted = await tx.insert(brandTruthEvidence).values({
        projectId: input.projectId,
        evidenceType: evidence.evidenceType,
        title: evidence.title,
        url: evidence.url,
        publisher: evidence.publisher,
        sourceOwner: evidence.sourceOwner,
        sourceClass: evidence.sourceClass,
        independentSource: evidence.independentSource,
        accessible: true,
        authorityLevel: evidence.authorityLevel,
        freshnessStatus: evidence.freshnessStatus,
        consistencyStatus: evidence.consistencyStatus,
        verificationStatus: "verified",
        evidenceExcerpt: evidence.evidenceExcerpt,
        evidenceHash: contentHash(evidence),
        manualReviewStatus: "approved",
        publishedAt: evidence.publishedAt,
        sourceUpdatedAt: evidence.sourceUpdatedAt,
        capturedAt: evidence.capturedAt,
      }).$returningId();
      const id = inserted[0]?.id;
      if (!id) throw new Error(`证据写入失败：${evidence.key}`);
      const rows = await tx.select().from(brandTruthEvidence).where(and(eq(brandTruthEvidence.id, id), eq(brandTruthEvidence.projectId, input.projectId))).limit(1);
      evidenceByKey.set(evidence.key, rows[0]!);
    }

    const resultingFacts = new Map<string, typeof brandTruthFacts.$inferSelect>();
    for (const factPlan of input.plan.facts) {
      const supportEvidence = factPlan.supportEvidenceKeys.map(key => evidenceByKey.get(key)!).filter(Boolean);
      if (!canPromoteFactFromEvidence(factPlan.verificationStatus, supportEvidence)) {
        throw new Error(`事实 ${factPlan.factKey} 不满足 ${factPlan.verificationStatus} 的证据升级条件`);
      }
      const officialSourceCount = supportEvidence.filter(item => item.sourceClass === "official").length;
      const thirdPartySourceCount = supportEvidence.filter(item => item.sourceClass === "third_party" && item.independentSource).length;
      const previous = factsByKey.get(factPlan.factKey);
      const factVersion = previous ? previous.version + 1 : 1;
      let factId: number;
      if (previous) {
        factId = previous.id;
        await tx.update(brandTruthFacts).set({
          category: factPlan.category,
          factType: factPlan.factType,
          factValue: factPlan.factValue,
          normalizedValue: normalizeTruthValue(factPlan.factValue),
          description: factPlan.description,
          importance: factPlan.importance,
          verificationStatus: factPlan.verificationStatus,
          validFrom: factPlan.validFrom,
          validTo: factPlan.validTo,
          sourceCount: supportEvidence.length,
          officialSourceCount,
          thirdPartySourceCount,
          lastVerifiedAt: ["official_verified", "third_party_verified", "multi_source_verified"].includes(factPlan.verificationStatus) ? new Date() : null,
          reviewedBy: input.userId,
          version: factVersion,
        }).where(and(eq(brandTruthFacts.id, factId), eq(brandTruthFacts.projectId, input.projectId)));
      } else {
        const inserted = await tx.insert(brandTruthFacts).values({
          profileId: profile.id,
          projectId: input.projectId,
          category: factPlan.category,
          factType: factPlan.factType,
          factKey: factPlan.factKey,
          factValue: factPlan.factValue,
          normalizedValue: normalizeTruthValue(factPlan.factValue),
          description: factPlan.description,
          importance: factPlan.importance,
          verificationStatus: factPlan.verificationStatus,
          validFrom: factPlan.validFrom,
          validTo: factPlan.validTo,
          sourceCount: supportEvidence.length,
          officialSourceCount,
          thirdPartySourceCount,
          lastVerifiedAt: ["official_verified", "third_party_verified", "multi_source_verified"].includes(factPlan.verificationStatus) ? new Date() : null,
          createdBy: input.userId,
          reviewedBy: input.userId,
          version: factVersion,
        }).$returningId();
        factId = inserted[0]?.id ?? 0;
        if (!factId) throw new Error(`事实写入失败：${factPlan.factKey}`);
      }

      const evidenceLinks = [
        ...factPlan.supportEvidenceKeys.map(key => ({ key, supportType: "supports" as const, confidence: 95 })),
        ...factPlan.contextEvidenceKeys.map(key => ({ key, supportType: "context_only" as const, confidence: 80 })),
      ];
      for (const link of evidenceLinks) {
        const evidence = evidenceByKey.get(link.key);
        if (!evidence) throw new Error(`证据不存在：${link.key}`);
        await tx.insert(brandTruthFactEvidenceLinks).values({
          projectId: input.projectId,
          factId,
          evidenceId: evidence.id,
          supportType: link.supportType,
          confidence: link.confidence,
          reviewedAt: new Date(),
        }).onDuplicateKeyUpdate({ set: { supportType: link.supportType, confidence: link.confidence, reviewedAt: new Date() } });
      }
      await tx.insert(brandTruthFactVersions).values({
        factId,
        projectId: input.projectId,
        version: factVersion,
        profileVersion: input.plan.targetProfileVersion,
        previousValue: previous?.factValue ?? null,
        newValue: factPlan.factValue,
        previousVerificationStatus: previous?.verificationStatus ?? null,
        newVerificationStatus: factPlan.verificationStatus,
        changeReason: input.plan.changeReason,
        evidenceChange: { action: "verification_batch", evidenceKeys: evidenceLinks.map(item => item.key) },
        affectsHistoricalInterpretation: factPlan.verificationStatus === "outdated",
        requiresRevalidation: true,
        effectiveAt: factPlan.validFrom ?? new Date(),
        changedBy: input.userId,
      });
      const rows = await tx.select().from(brandTruthFacts).where(and(eq(brandTruthFacts.id, factId), eq(brandTruthFacts.projectId, input.projectId))).limit(1);
      resultingFacts.set(factPlan.factKey, rows[0]!);
    }

    for (const conflictPlan of input.plan.conflicts) {
      const fact = resultingFacts.get(conflictPlan.factKey);
      if (!fact) throw new Error(`冲突事实不存在：${conflictPlan.factKey}`);
      const evidenceA = conflictPlan.evidenceAKey ? evidenceByKey.get(conflictPlan.evidenceAKey) : null;
      const evidenceB = conflictPlan.evidenceBKey ? evidenceByKey.get(conflictPlan.evidenceBKey) : null;
      await tx.insert(brandTruthConflicts).values({
        projectId: input.projectId,
        factId: fact.id,
        factKey: conflictPlan.factKey,
        evidenceAId: evidenceA?.id,
        evidenceBId: evidenceB?.id,
        conflictType: conflictPlan.conflictType,
        severity: conflictPlan.severity,
        resolutionStatus: conflictPlan.resolutionStatus,
        resolutionNote: conflictPlan.resolutionNote,
        resolvedBy: ["resolved", "accepted_difference"].includes(conflictPlan.resolutionStatus) ? input.userId : undefined,
        resolvedAt: ["resolved", "accepted_difference"].includes(conflictPlan.resolutionStatus) ? new Date() : undefined,
      });
      await tx.update(brandTruthFacts).set({ conflictCount: fact.conflictCount + 1 }).where(and(eq(brandTruthFacts.id, fact.id), eq(brandTruthFacts.projectId, input.projectId)));
    }

    const latestSet = await tx.select().from(understandingQuestionSets).where(eq(understandingQuestionSets.projectId, input.projectId)).orderBy(desc(understandingQuestionSets.version)).limit(1);
    const questionSetVersion = (latestSet[0]?.version ?? 0) + 1;
    await tx.update(understandingQuestionSets).set({ status: "archived", validTo: new Date() }).where(and(
      eq(understandingQuestionSets.projectId, input.projectId),
      eq(understandingQuestionSets.status, "active"),
    ));
    const insertedSet = await tx.insert(understandingQuestionSets).values({
      projectId: input.projectId,
      name: input.plan.questionSet.name,
      version: questionSetVersion,
      status: "active",
      validFrom: new Date(),
      fixedAcrossPeriods: true,
      createdBy: input.userId,
    }).$returningId();
    const questionSetId = insertedSet[0]?.id;
    if (!questionSetId) throw new Error("Understand 问题集写入失败");
    await tx.insert(understandingQuestions).values(input.plan.questionSet.questions.map((question, index) => ({
      projectId: input.projectId,
      questionSetId,
      category: question.category,
      questionType: question.questionType,
      questionText: question.questionText,
      verificationFactKeys: question.verificationFactKeys,
      enabled: true,
      fixedAcrossPeriods: true,
      sortOrder: index + 1,
    })));

    const finalFacts = await tx.select({ factKey: brandTruthFacts.factKey, verificationStatus: brandTruthFacts.verificationStatus })
      .from(brandTruthFacts).where(and(eq(brandTruthFacts.projectId, input.projectId), isNull(brandTruthFacts.archivedAt)));
    const stats = calculateTruthProfileStats(finalFacts);
    await tx.update(brandTruthProfiles).set({
      currentVersion: input.plan.targetProfileVersion,
      status: "active",
      ...stats,
      lastReviewedAt: new Date(),
    }).where(eq(brandTruthProfiles.projectId, input.projectId));

    return {
      success: true as const,
      profileVersion: input.plan.targetProfileVersion,
      questionSetVersion,
      factCount: input.plan.facts.length,
      evidenceCount: input.plan.evidence.length,
      conflictCount: input.plan.conflicts.length,
      stats,
      reviewerNote: input.plan.reviewerNote,
    };
  });
}
