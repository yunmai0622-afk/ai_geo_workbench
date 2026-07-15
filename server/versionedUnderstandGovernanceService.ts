import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  aiObservationExtractions,
  brandFactDefinitionVersions,
  brandFactDefinitions,
  brandTruthFactVersions,
  brandTruthProfiles,
  brandTruthProfileVersionFacts,
  brandTruthProfileVersions,
  understandingAssessmentDimensionResults,
  understandingAssessmentManualReviews,
  understandingAssessmentRuleResults,
  understandingAssessments,
  understandingEvaluations,
  understandingExtractionVersionRegistry,
  understandingMethodologyDimensionWeights,
  understandingMethodologyVersions,
  understandingQuestionVersions,
  understandingRuleVersions,
} from "../drizzle/schema";
import type { DbConn } from "./projectAccess";

const DIMENSIONS = ["identity", "business", "capability", "boundary", "temporal", "evidence", "consistency", "uncertainty"] as const;
type Outcome = (typeof understandingAssessments.$inferInsert)["automaticOutcome"];

function assertBasisPoints(name: string, value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) throw new Error(`${name} must be an integer between 0 and 10000`);
}

/** Append-only writer for PR-03.6B governance objects. Existing versions and Assessments are never updated. */
export class VersionedUnderstandGovernanceService {
  constructor(private readonly db: DbConn) {}

  async createFactDefinitionVersion(input: Omit<typeof brandFactDefinitionVersions.$inferInsert, "id" | "createdAt">) {
    const parent = await this.db.select({ id: brandFactDefinitions.id }).from(brandFactDefinitions).where(and(
      eq(brandFactDefinitions.id, input.definitionId), eq(brandFactDefinitions.projectId, input.projectId),
    )).limit(1);
    if (!parent[0]) throw new Error("Fact definition does not belong to project");
    const id = randomUUID();
    await this.db.insert(brandFactDefinitionVersions).values({ ...input, id });
    return id;
  }

  async createMethodologyVersion(input: {
    version: Omit<typeof understandingMethodologyVersions.$inferInsert, "id" | "createdAt">;
    weights: Array<{ dimension: (typeof DIMENSIONS)[number]; weightBasisPoints: number }>;
  }) {
    const seen = new Set(input.weights.map(item => item.dimension));
    if (seen.size !== DIMENSIONS.length || DIMENSIONS.some(dimension => !seen.has(dimension))) throw new Error("Methodology must define all 8 dimensions exactly once");
    for (const weight of input.weights) assertBasisPoints("weightBasisPoints", weight.weightBasisPoints);
    if (input.weights.reduce((sum, item) => sum + item.weightBasisPoints, 0) !== 10_000) throw new Error("Methodology weights must total 10000 basis points");
    const id = randomUUID();
    await this.db.transaction(async tx => {
      await tx.insert(understandingMethodologyVersions).values({ ...input.version, id });
      await tx.insert(understandingMethodologyDimensionWeights).values(input.weights.map(item => ({ ...item, projectId: input.version.projectId, methodologyVersionId: id })));
    });
    return id;
  }

  async createQuestionVersion(input: Omit<typeof understandingQuestionVersions.$inferInsert, "id" | "createdAt">) {
    const id = randomUUID();
    await this.db.insert(understandingQuestionVersions).values({ ...input, id });
    return id;
  }

  async createTruthProfileVersion(input: {
    version: Omit<typeof brandTruthProfileVersions.$inferInsert, "id" | "createdAt">;
    factVersionIds: number[];
  }) {
    if (new Set(input.factVersionIds).size !== input.factVersionIds.length) throw new Error("Truth profile fact versions must be unique");
    const id = randomUUID();
    await this.db.transaction(async tx => {
      const profile = await tx.select({ id: brandTruthProfiles.id }).from(brandTruthProfiles).where(and(
        eq(brandTruthProfiles.id, input.version.profileId), eq(brandTruthProfiles.projectId, input.version.projectId),
      )).limit(1);
      if (!profile[0]) throw new Error("Truth profile does not belong to project");
      for (const factVersionId of input.factVersionIds) {
        const factVersion = await tx.select({ id: brandTruthFactVersions.id }).from(brandTruthFactVersions).where(and(
          eq(brandTruthFactVersions.id, factVersionId), eq(brandTruthFactVersions.projectId, input.version.projectId),
        )).limit(1);
        if (!factVersion[0]) throw new Error("Truth fact version does not belong to project");
      }
      await tx.insert(brandTruthProfileVersions).values({ ...input.version, id });
      if (input.factVersionIds.length) await tx.insert(brandTruthProfileVersionFacts).values(input.factVersionIds.map(factVersionId => ({
        projectId: input.version.projectId, truthProfileVersionId: id, factVersionId,
      })));
    });
    return id;
  }

  async createAssessment(input: {
    assessment: Omit<typeof understandingAssessments.$inferInsert, "id" | "createdAt">;
    dimensions: Array<Omit<typeof understandingAssessmentDimensionResults.$inferInsert, "id" | "projectId" | "assessmentId" | "createdAt">>;
    rules: Array<Omit<typeof understandingAssessmentRuleResults.$inferInsert, "id" | "projectId" | "assessmentId" | "createdAt">>;
  }) {
    const { assessment } = input;
    assertBasisPoints("coverageBasisPoints", assessment.coverageBasisPoints);
    assertBasisPoints("confidenceBasisPoints", assessment.confidenceBasisPoints);
    if (new Set(input.dimensions.map(item => item.dimension)).size !== input.dimensions.length) throw new Error("Assessment dimensions must be unique");
    const id = randomUUID();
    await this.db.transaction(async tx => {
      const [observationExtraction, truthProfileVersion, question, extractionVersion, methodology, primaryRule] = await Promise.all([
        tx.select({ id: aiObservationExtractions.id }).from(aiObservationExtractions).where(and(eq(aiObservationExtractions.id, assessment.extractionId), eq(aiObservationExtractions.projectId, assessment.projectId))).limit(1),
        tx.select({ id: brandTruthProfileVersions.id }).from(brandTruthProfileVersions).where(and(eq(brandTruthProfileVersions.id, assessment.truthProfileVersionId), eq(brandTruthProfileVersions.projectId, assessment.projectId))).limit(1),
        tx.select({ id: understandingQuestionVersions.id }).from(understandingQuestionVersions).where(and(eq(understandingQuestionVersions.id, assessment.questionVersionId), eq(understandingQuestionVersions.projectId, assessment.projectId))).limit(1),
        tx.select({ id: understandingExtractionVersionRegistry.id }).from(understandingExtractionVersionRegistry).where(and(eq(understandingExtractionVersionRegistry.id, assessment.extractionVersionId), eq(understandingExtractionVersionRegistry.projectId, assessment.projectId))).limit(1),
        tx.select({ id: understandingMethodologyVersions.id }).from(understandingMethodologyVersions).where(and(eq(understandingMethodologyVersions.id, assessment.methodologyVersionId), eq(understandingMethodologyVersions.projectId, assessment.projectId))).limit(1),
        tx.select({ id: understandingRuleVersions.id }).from(understandingRuleVersions).where(and(eq(understandingRuleVersions.id, assessment.primaryRuleVersionId), eq(understandingRuleVersions.projectId, assessment.projectId))).limit(1),
      ]);
      if (!observationExtraction[0] || !truthProfileVersion[0] || !question[0] || !extractionVersion[0] || !methodology[0] || !primaryRule[0]) throw new Error("Assessment inputs and governance versions must belong to project");
      for (const rule of input.rules) {
        const exists = await tx.select({ id: understandingRuleVersions.id }).from(understandingRuleVersions).where(and(eq(understandingRuleVersions.id, rule.ruleVersionId), eq(understandingRuleVersions.projectId, assessment.projectId))).limit(1);
        if (!exists[0]) throw new Error("Assessment rule version does not belong to project");
      }
      await tx.insert(understandingAssessments).values({ ...assessment, id });
      if (input.dimensions.length) await tx.insert(understandingAssessmentDimensionResults).values(input.dimensions.map(item => ({ ...item, projectId: assessment.projectId, assessmentId: id })));
      if (input.rules.length) await tx.insert(understandingAssessmentRuleResults).values(input.rules.map(item => ({ ...item, projectId: assessment.projectId, assessmentId: id })));
    });
    return id;
  }

  async appendManualReview(input: Omit<typeof understandingAssessmentManualReviews.$inferInsert, "id" | "createdAt">) {
    if (input.action === "overridden" && !input.overriddenOutcome) throw new Error("overriddenOutcome is required for override");
    if (input.action !== "overridden" && input.overriddenOutcome) throw new Error("overriddenOutcome is only valid for override");
    const assessment = await this.db.select({ id: understandingAssessments.id }).from(understandingAssessments).where(and(
      eq(understandingAssessments.id, input.assessmentId), eq(understandingAssessments.projectId, input.projectId),
    )).limit(1);
    if (!assessment[0]) throw new Error("Assessment does not belong to project");
    const id = randomUUID();
    await this.db.insert(understandingAssessmentManualReviews).values({ ...input, id });
    return id;
  }

  async getAssessment(projectId: number, assessmentId: string) {
    const assessment = (await this.db.select().from(understandingAssessments).where(and(eq(understandingAssessments.id, assessmentId), eq(understandingAssessments.projectId, projectId))).limit(1))[0];
    if (!assessment) return null;
    const reviews = await this.db.select().from(understandingAssessmentManualReviews).where(and(
      eq(understandingAssessmentManualReviews.assessmentId, assessmentId), eq(understandingAssessmentManualReviews.projectId, projectId),
    )).orderBy(desc(understandingAssessmentManualReviews.reviewedAt), desc(understandingAssessmentManualReviews.createdAt));
    const latest = reviews[0];
    const effectiveOutcome: Outcome | null = latest?.action === "rejected" ? null : latest?.action === "overridden" ? latest.overriddenOutcome! : assessment.automaticOutcome;
    return { ...assessment, effectiveOutcome, manualReviewStatus: latest?.action ?? "not_reviewed", reviews };
  }

  /** Explicit legacy adapter: no legacy row is rewritten or represented as a formal Assessment. */
  async listLegacyEvaluations(projectId: number) {
    const rows = await this.db.select().from(understandingEvaluations).where(eq(understandingEvaluations.projectId, projectId)).orderBy(desc(understandingEvaluations.createdAt));
    return rows.map(row => ({ source: "legacy_understanding_evaluation" as const, formalAssessmentId: null, legacyEvaluation: row }));
  }
}
