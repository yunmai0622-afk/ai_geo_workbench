import { createHash } from "node:crypto";
import { and, asc, eq, gt } from "drizzle-orm";
import {
  aiObservationAnswers, aiObservationExtractions, aiObservationRunEvents, aiObservationRuns,
  brandTruthProfileVersionFacts, brandTruthProfileVersions, legacyUnderstandingMigrationItems, legacyUnderstandingMigrationRuns,
  understandingAssessments, understandingEvaluations, understandingExtractionVersionRegistry,
  understandingMethodologyVersions, understandingQuestionSetVersions, understandingQuestionVersions, understandingRuleVersions,
} from "../drizzle/schema";
import type { DbConn } from "./projectAccess";

export const LEGACY_MIGRATION_VERSION = "03.6C-v1";
type Legacy = typeof understandingEvaluations.$inferSelect;
export type ResolvedLegacyGovernance = {
  questionText: string | null; questionVersionId: string | null; questionVersion: number | null;
  extractionVersionId: string | null; methodologyVersionId: string | null;
  ruleVersionId: string | null; truthProfileVersionId: string | null;
};
export type LegacyClassification = {
  status: "migratable" | "partially_migratable" | "legacy_non_reproducible";
  reproducibilityStatus: "fully_reproducible" | "observation_reproducible" | "partially_reproducible" | "legacy_non_reproducible";
  missingFields: string[]; createObservation: boolean; createExtraction: boolean; createAssessment: boolean;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export function checksumLegacyEvaluation(row: Legacy): string {
  return `sha256:${createHash("sha256").update(canonical(row)).digest("hex")}`;
}
export function deterministicLegacyId(projectId: number, legacyId: string, kind: string): string {
  const hex = createHash("sha256").update(`${LEGACY_MIGRATION_VERSION}:${projectId}:${legacyId}:${kind}`).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export function classifyLegacyEvaluation(row: Legacy, resolved: ResolvedLegacyGovernance): LegacyClassification {
  const observationRequired = [
    ["questionText", resolved.questionText], ["questionVersion", resolved.questionVersion],
    ["questionVersionId", resolved.questionVersionId], ["rawAnswer", row.rawAnswer],
    ["testedModel", row.testedModel], ["testedChannel", row.testedChannel], ["testedAt", row.testedAt],
  ] as const;
  const missingObservation = observationRequired.filter(([, value]) => value == null || value === "").map(([name]) => name);
  const hasSavedExtraction = row.extractedFacts != null || row.ruleResults != null || row.semanticJudgement != null;
  const governance = ["truthProfileVersionId", "questionVersionId", "extractionVersionId", "methodologyVersionId", "ruleVersionId"] as const;
  const missingGovernance = governance.filter(key => !resolved[key]);
  const confidence = legacyConfidenceBasisPoints(row.semanticJudgement);
  if (missingObservation.length) return { status: "legacy_non_reproducible", reproducibilityStatus: "legacy_non_reproducible", missingFields: [...new Set([...missingObservation, ...missingGovernance])], createObservation: false, createExtraction: false, createAssessment: false };
  if (missingGovernance.length || !hasSavedExtraction || confidence == null) return { status: "partially_migratable", reproducibilityStatus: hasSavedExtraction ? "observation_reproducible" : "partially_reproducible", missingFields: [...missingGovernance, ...(!hasSavedExtraction ? ["savedExtraction"] : []), ...(confidence == null ? ["assessmentConfidence"] : [])], createObservation: true, createExtraction: hasSavedExtraction, createAssessment: false };
  return { status: "migratable", reproducibilityStatus: "fully_reproducible", missingFields: [], createObservation: true, createExtraction: true, createAssessment: true };
}

/** Only accepts an explicitly persisted legacy confidence; it never derives or invents one. */
export function legacyConfidenceBasisPoints(value: Record<string, unknown> | null): number | null {
  const raw = value?.confidence;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const basisPoints = raw <= 1 ? Math.round(raw * 10000) : raw <= 100 ? Math.round(raw * 100) : Math.round(raw);
  return basisPoints >= 0 && basisPoints <= 10000 ? basisPoints : null;
}

export class LegacyUnderstandingMigrationService {
  constructor(private readonly db: DbConn) {}

  private async uniqueId<T extends { id: string }>(rows: T[]) { return rows.length === 1 ? rows[0].id : null; }
  async resolveGovernance(row: Legacy): Promise<ResolvedLegacyGovernance> {
    const questionSets = await this.db.select({ id: understandingQuestionSetVersions.id }).from(understandingQuestionSetVersions).where(and(eq(understandingQuestionSetVersions.projectId, row.projectId), eq(understandingQuestionSetVersions.version, row.questionSetVersion))).limit(2);
    const questionVersions = questionSets.length === 1 ? await this.db.select({ id: understandingQuestionVersions.id, version: understandingQuestionVersions.version, questionText: understandingQuestionVersions.questionTextSnapshot }).from(understandingQuestionVersions).where(and(eq(understandingQuestionVersions.projectId, row.projectId), eq(understandingQuestionVersions.legacyQuestionId, row.questionId), eq(understandingQuestionVersions.questionSetVersionId, questionSets[0].id))).limit(2) : [];
    const extractionVersions = await this.db.select({ id: understandingExtractionVersionRegistry.id }).from(understandingExtractionVersionRegistry).where(and(eq(understandingExtractionVersionRegistry.projectId, row.projectId), eq(understandingExtractionVersionRegistry.implementationVersion, row.extractionVersion))).limit(2);
    const methodologyNumber = Number(row.methodologyVersion.match(/(\d+)$/)?.[1]);
    const methodologyVersions = Number.isInteger(methodologyNumber) ? await this.db.select({ id: understandingMethodologyVersions.id }).from(understandingMethodologyVersions).where(and(eq(understandingMethodologyVersions.projectId, row.projectId), eq(understandingMethodologyVersions.version, methodologyNumber))).limit(2) : [];
    const ruleNumber = Number(row.ruleVersion.match(/(\d+)$/)?.[1]);
    const ruleVersions = Number.isInteger(ruleNumber) ? await this.db.select({ id: understandingRuleVersions.id }).from(understandingRuleVersions).where(and(eq(understandingRuleVersions.projectId, row.projectId), eq(understandingRuleVersions.version, ruleNumber))).limit(2) : [];
    const truthVersions = await this.db.select({ id: brandTruthProfileVersions.id }).from(brandTruthProfileVersions).where(and(eq(brandTruthProfileVersions.projectId, row.projectId), eq(brandTruthProfileVersions.version, row.truthProfileVersion))).limit(2);
    const truthVersionId = await this.uniqueId(truthVersions);
    const truthFacts = truthVersionId ? await this.db.select({ id: brandTruthProfileVersionFacts.id }).from(brandTruthProfileVersionFacts).where(and(eq(brandTruthProfileVersionFacts.projectId, row.projectId), eq(brandTruthProfileVersionFacts.truthProfileVersionId, truthVersionId))).limit(1) : [];
    return { questionText: questionVersions.length === 1 ? questionVersions[0].questionText : null, questionVersionId: questionVersions.length === 1 ? questionVersions[0].id : null, questionVersion: questionVersions.length === 1 ? questionVersions[0].version : null, extractionVersionId: await this.uniqueId(extractionVersions), methodologyVersionId: await this.uniqueId(methodologyVersions), ruleVersionId: await this.uniqueId(ruleVersions), truthProfileVersionId: truthFacts.length ? truthVersionId : null };
  }

  async dryRun(projectId: number, resumeAfterLegacyEvaluationId?: string) {
    const predicate = resumeAfterLegacyEvaluationId ? and(eq(understandingEvaluations.projectId, projectId), gt(understandingEvaluations.id, resumeAfterLegacyEvaluationId)) : eq(understandingEvaluations.projectId, projectId);
    const rows = await this.db.select().from(understandingEvaluations).where(predicate).orderBy(asc(understandingEvaluations.id));
    const items = [];
    for (const row of rows) items.push({ legacyEvaluationId: row.id, sourceChecksum: checksumLegacyEvaluation(row), classification: classifyLegacyEvaluation(row, await this.resolveGovernance(row)) });
    return { mode: "dry_run" as const, projectId, migrationVersion: LEGACY_MIGRATION_VERSION, scannedCount: items.length, items };
  }

  async migrateProject(projectId: number, createdBy?: number, resumeAfterLegacyEvaluationId?: string) {
    const runId = deterministicLegacyId(projectId, `${Date.now()}`, "migration-run");
    await this.db.insert(legacyUnderstandingMigrationRuns).values({ id: runId, projectId, mode: "execute", migrationVersion: LEGACY_MIGRATION_VERSION, status: "running", resumeAfterLegacyEvaluationId, startedAt: new Date(), createdBy });
    const preview = await this.dryRun(projectId, resumeAfterLegacyEvaluationId);
    const counts = { migrated: 0, partial: 0, skipped: 0, failed: 0 };
    for (const previewItem of preview.items) {
      const row = (await this.db.select().from(understandingEvaluations).where(and(eq(understandingEvaluations.id, previewItem.legacyEvaluationId), eq(understandingEvaluations.projectId, projectId))).limit(1))[0];
      if (!row) continue;
      const existing = (await this.db.select().from(legacyUnderstandingMigrationItems).where(and(eq(legacyUnderstandingMigrationItems.projectId, projectId), eq(legacyUnderstandingMigrationItems.legacyEvaluationId, row.id), eq(legacyUnderstandingMigrationItems.migrationVersion, LEGACY_MIGRATION_VERSION))).limit(1))[0];
      if (existing) {
        existing.sourceChecksum === previewItem.sourceChecksum ? counts.skipped += 1 : counts.failed += 1;
        continue;
      }
      const resolved = await this.resolveGovernance(row); const classification = classifyLegacyEvaluation(row, resolved);
      const ids = { run: deterministicLegacyId(projectId, row.id, "run"), answer: deterministicLegacyId(projectId, row.id, "answer"), extraction: deterministicLegacyId(projectId, row.id, "extraction"), assessment: deterministicLegacyId(projectId, row.id, "assessment"), item: deterministicLegacyId(projectId, row.id, "item") };
      try {
        await this.db.transaction(async tx => {
          if (classification.createObservation) {
            await tx.insert(aiObservationRuns).values({ id: ids.run, projectId, questionSetId: row.questionSetId, questionSetVersionSnapshot: row.questionSetVersion, provider: "unknown", modelName: row.testedModel, modelVersion: null, modelChannel: row.testedChannel, runPurpose: "legacy_import", locale: "unknown", startedAt: row.testedAt, completedAt: null, runStatus: "queued", providerRequestId: null, systemPromptVersion: "unknown", systemPromptHash: "unknown", systemPromptSnapshot: null, samplingParameters: null, applicationVersion: "legacy_import", createdAt: row.createdAt });
            await tx.insert(aiObservationRunEvents).values([
              { id: deterministicLegacyId(projectId, row.id, "run-event-start"), projectId, observationRunId: ids.run, eventType: "queued", eventSequence: 1, occurredAt: row.testedAt, eventMetadata: { provenance: "legacy_import", legacySourceId: row.id } },
              { id: deterministicLegacyId(projectId, row.id, "run-event-end"), projectId, observationRunId: ids.run, eventType: "succeeded", eventSequence: 2, occurredAt: row.testedAt, eventMetadata: { provenance: "legacy_import", legacySourceId: row.id, reproducibilityStatus: classification.reproducibilityStatus } },
            ]);
            await tx.insert(aiObservationAnswers).values({ id: ids.answer, projectId, observationRunId: ids.run, questionId: row.questionId, questionKey: `legacy:${row.questionId}`, questionVersionSnapshot: resolved.questionVersion!, questionTextSnapshot: resolved.questionText!, scenarioSnapshot: null, attemptNumber: 1, providerResponseId: null, rawAnswer: row.rawAnswer, rawProviderMetadata: { provenance: "legacy_import", legacySourceId: row.id }, answerContentHash: `sha256:${createHash("sha256").update(row.rawAnswer).digest("hex")}`, receivedAt: row.testedAt, latencyMs: null, inputTokens: null, outputTokens: null, totalTokens: null, finishReason: null, answerStatus: "received", citationCapability: "unknown", createdAt: row.createdAt });
          }
          if (classification.createExtraction) await tx.insert(aiObservationExtractions).values({ id: ids.extraction, projectId, observationAnswerId: ids.answer, attemptNumber: 1, extractorKey: "legacy_import", extractorVersion: row.extractionVersion, extractionPromptVersion: "unknown", extractionPromptHash: "unknown", extractionModelProvider: null, extractionModelName: row.extractorModel, extractionModelChannel: null, extractionStatus: "succeeded", structuredPayload: row.extractedFacts, extractionCoverage: row.extractionCoverage, extractionConfidence: null, citationExtractionStatus: "unknown", startedAt: row.testedAt, completedAt: row.testedAt, createdAt: row.createdAt });
          if (classification.createAssessment) await tx.insert(understandingAssessments).values({ id: ids.assessment, projectId, observationRunId: ids.run, observationAnswerId: ids.answer, extractionId: ids.extraction, truthProfileVersionId: resolved.truthProfileVersionId!, questionVersionId: resolved.questionVersionId!, extractionVersionId: resolved.extractionVersionId!, methodologyVersionId: resolved.methodologyVersionId!, primaryRuleVersionId: resolved.ruleVersionId!, assessmentStatus: row.assessmentStatus === "insufficient_data" ? "insufficient_data" : "completed", automaticOutcome: row.finalStatus, coverageBasisPoints: Math.min(10000, Math.max(0, row.assessmentCoverage * 100)), confidenceBasisPoints: legacyConfidenceBasisPoints(row.semanticJudgement)!, assessmentPayload: { provenance: "legacy_import", legacySourceId: row.id, ruleResults: row.ruleResults, semanticJudgement: row.semanticJudgement, severity: row.severity }, createdAt: row.createdAt });
          await tx.insert(legacyUnderstandingMigrationItems).values({ id: ids.item, projectId, migrationRunId: runId, legacyEvaluationId: row.id, sourceChecksum: previewItem.sourceChecksum, migrationVersion: LEGACY_MIGRATION_VERSION, migrationStatus: classification.createAssessment ? "migrated" : classification.status, reproducibilityStatus: classification.reproducibilityStatus, targetRunId: classification.createObservation ? ids.run : null, targetAnswerId: classification.createObservation ? ids.answer : null, targetExtractionId: classification.createExtraction ? ids.extraction : null, targetAssessmentId: classification.createAssessment ? ids.assessment : null, missingFields: classification.missingFields, legacyPayloadSnapshot: { extractedFacts: row.extractedFacts, uncertainStatements: row.uncertainStatements, ruleResults: row.ruleResults, semanticJudgement: row.semanticJudgement, evidenceReferences: row.evidenceReferences, severity: row.severity }, migratedAt: classification.createObservation ? new Date() : null });
        });
        classification.createAssessment ? counts.migrated += 1 : counts.partial += 1;
      } catch (error) {
        counts.failed += 1;
        const failureReason = error instanceof Error ? error.message.slice(0, 4000) : "unknown migration failure";
        try {
          await this.db.insert(legacyUnderstandingMigrationItems).values({
            id: ids.item, projectId, migrationRunId: runId, legacyEvaluationId: row.id,
            sourceChecksum: previewItem.sourceChecksum, migrationVersion: LEGACY_MIGRATION_VERSION,
            migrationStatus: "failed", reproducibilityStatus: classification.reproducibilityStatus,
            missingFields: classification.missingFields, failureReason,
          });
        } catch { /* a concurrent resumable run already owns the immutable source item */ }
      }
    }
    await this.db.update(legacyUnderstandingMigrationRuns).set({ status: counts.failed ? "partially_completed" : "completed", scannedCount: preview.scannedCount, migratedCount: counts.migrated, partialCount: counts.partial, skippedCount: counts.skipped, failedCount: counts.failed, completedAt: new Date(), report: counts }).where(and(eq(legacyUnderstandingMigrationRuns.id, runId), eq(legacyUnderstandingMigrationRuns.projectId, projectId)));
    return { runId, ...counts };
  }
}
