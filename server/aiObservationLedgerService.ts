import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  aiCitationResults,
  aiExtractedBrandFacts,
  aiObservationAnswers,
  aiObservationExtractions,
  aiObservationRuns,
  aiRecommendationResults,
} from "../drizzle/schema";
import type { DbConn } from "./projectAccess";

export const AI_OBSERVATION_LEDGER_FEATURE_FLAG = "ai_observation_ledger_v2";
export const isAiObservationLedgerV2Enabled = () => process.env.AI_OBSERVATION_LEDGER_V2?.toLowerCase() === "true";

function requireEnabled(allowWhenDisabled = false) {
  if (!allowWhenDisabled && !isAiObservationLedgerV2Enabled()) throw new Error(`${AI_OBSERVATION_LEDGER_FEATURE_FLAG} is disabled`);
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

type RunInsert = typeof aiObservationRuns.$inferInsert;
type AnswerInsert = typeof aiObservationAnswers.$inferInsert;
type ExtractionInsert = typeof aiObservationExtractions.$inferInsert;
type FactInsert = typeof aiExtractedBrandFacts.$inferInsert;
type RecommendationInsert = typeof aiRecommendationResults.$inferInsert;
type CitationInsert = typeof aiCitationResults.$inferInsert;

export class AiObservationLedgerService {
  constructor(private readonly db: DbConn, private readonly allowWhenDisabled = false) {}

  async createRun(input: Omit<RunInsert, "id" | "createdAt">) {
    requireEnabled(this.allowWhenDisabled);
    const id = randomUUID();
    await this.db.insert(aiObservationRuns).values({ ...input, id });
    return id;
  }

  async appendAnswer(input: Omit<AnswerInsert, "id" | "createdAt" | "answerContentHash"> & { rawAnswer?: string | null }) {
    requireEnabled(this.allowWhenDisabled);
    const run = await this.db.select({ id: aiObservationRuns.id }).from(aiObservationRuns).where(and(
      eq(aiObservationRuns.id, input.observationRunId), eq(aiObservationRuns.projectId, input.projectId),
    )).limit(1);
    if (!run[0]) throw new Error("Observation run does not belong to project");
    const id = randomUUID();
    const rawAnswer = input.rawAnswer ?? null;
    await this.db.insert(aiObservationAnswers).values({ ...input, id, rawAnswer, answerContentHash: rawAnswer == null ? null : sha256(rawAnswer) });
    return id;
  }

  async appendExtraction(input: {
    extraction: Omit<ExtractionInsert, "id" | "createdAt">;
    facts?: Array<Omit<FactInsert, "id" | "projectId" | "extractionId" | "createdAt">>;
    recommendations?: Array<Omit<RecommendationInsert, "id" | "projectId" | "extractionId" | "createdAt">>;
    citations?: Array<Omit<CitationInsert, "id" | "projectId" | "extractionId" | "createdAt">>;
  }) {
    requireEnabled(this.allowWhenDisabled);
    const { extraction } = input;
    if (extraction.citationExtractionStatus === "unsupported" && (input.citations ?? []).some(item => item.citationStatus === "not_detected")) {
      throw new Error("citation unsupported cannot be stored as not_detected");
    }
    if (extraction.citationExtractionStatus === "extraction_failed" && (input.citations ?? []).some(item => item.citationStatus === "not_detected")) {
      throw new Error("citation extraction_failed cannot be stored as not_detected");
    }
    for (const recommendation of input.recommendations ?? []) {
      if (recommendation.recommendationStatus !== "recommended" && recommendation.recommendationRank != null) throw new Error("recommendationRank requires recommended status");
    }
    const id = randomUUID();
    await this.db.transaction(async tx => {
      const answer = await tx.select({ id: aiObservationAnswers.id }).from(aiObservationAnswers).where(and(
        eq(aiObservationAnswers.id, extraction.observationAnswerId), eq(aiObservationAnswers.projectId, extraction.projectId),
      )).limit(1);
      if (!answer[0]) throw new Error("Observation answer does not belong to project");
      await tx.insert(aiObservationExtractions).values({ ...extraction, id });
      if (input.facts?.length) await tx.insert(aiExtractedBrandFacts).values(input.facts.map(item => ({ ...item, projectId: extraction.projectId, extractionId: id })));
      if (input.recommendations?.length) await tx.insert(aiRecommendationResults).values(input.recommendations.map(item => ({ ...item, projectId: extraction.projectId, extractionId: id })));
      if (input.citations?.length) await tx.insert(aiCitationResults).values(input.citations.map(item => ({ ...item, projectId: extraction.projectId, extractionId: id })));
    });
    return id;
  }

  async markRunTerminal(input: { projectId: number; runId: string; status: "succeeded" | "partially_succeeded" | "failed" | "cancelled"; completedAt: Date; errorCode?: string | null; errorMessage?: string | null }) {
    requireEnabled(this.allowWhenDisabled);
    const result = await this.db.update(aiObservationRuns).set({ runStatus: input.status, completedAt: input.completedAt, errorCode: input.errorCode, errorMessage: input.errorMessage }).where(and(
      eq(aiObservationRuns.id, input.runId), eq(aiObservationRuns.projectId, input.projectId), inArray(aiObservationRuns.runStatus, ["queued", "running"]),
    ));
    return result;
  }

  async getAnswer(projectId: number, answerId: string) {
    requireEnabled(this.allowWhenDisabled);
    return (await this.db.select().from(aiObservationAnswers).where(and(eq(aiObservationAnswers.id, answerId), eq(aiObservationAnswers.projectId, projectId))).limit(1))[0] ?? null;
  }
}

/** Explicit boundary: legacy mixed records remain read-only compatibility data until PR-03.6C. */
export const LEGACY_UNDERSTANDING_EVALUATION_BOUNDARY = "legacy-read-only-no-observation-dual-write" as const;
