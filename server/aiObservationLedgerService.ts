import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  aiCitationResults,
  aiExtractedBrandFacts,
  aiObservationAnswers,
  aiObservationExtractions,
  aiObservationRunEvents,
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

export const OBSERVATION_RUN_STATUSES = ["queued", "running", "succeeded", "partially_succeeded", "failed", "cancelled"] as const;
export type ObservationRunStatus = (typeof OBSERVATION_RUN_STATUSES)[number];
export type ObservationRunTerminalStatus = Extract<ObservationRunStatus, "succeeded" | "partially_succeeded" | "failed" | "cancelled">;

const RUN_TRANSITIONS: Record<ObservationRunStatus, readonly ObservationRunStatus[]> = {
  queued: ["running", "failed", "cancelled"],
  running: ["succeeded", "partially_succeeded", "failed", "cancelled"],
  succeeded: [], partially_succeeded: [], failed: [], cancelled: [],
};

export function assertObservationRunTransition(current: ObservationRunStatus, next: ObservationRunStatus): void {
  if (!RUN_TRANSITIONS[current].includes(next)) throw new Error(`Illegal observation run transition: ${current} -> ${next}`);
}

export class AiObservationLedgerService {
  constructor(private readonly db: DbConn, private readonly allowWhenDisabled = false) {}

  async createRun(input: Omit<RunInsert, "id" | "createdAt" | "runStatus" | "completedAt" | "errorCode" | "errorMessage"> & {
    initialStatus: "queued" | "running";
    initialEventMetadata?: Record<string, unknown> | null;
  }) {
    requireEnabled(this.allowWhenDisabled);
    const id = randomUUID();
    const { initialStatus, initialEventMetadata, ...run } = input;
    await this.db.transaction(async tx => {
      await tx.insert(aiObservationRuns).values({ ...run, id, runStatus: initialStatus, completedAt: null, errorCode: null, errorMessage: null });
      await tx.insert(aiObservationRunEvents).values({
        id: randomUUID(), projectId: run.projectId, observationRunId: id, eventType: initialStatus,
        eventSequence: 1, occurredAt: run.startedAt, eventMetadata: initialEventMetadata ?? null, createdBy: run.createdBy,
      });
    });
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

  async appendRunEvent(input: {
    projectId: number; runId: string; eventType: ObservationRunStatus; occurredAt: Date;
    errorCode?: string | null; errorMessage?: string | null; eventMetadata?: Record<string, unknown> | null; createdBy?: number | null;
  }) {
    requireEnabled(this.allowWhenDisabled);
    return this.db.transaction(async tx => {
      const run = await tx.select({ id: aiObservationRuns.id }).from(aiObservationRuns).where(and(
        eq(aiObservationRuns.id, input.runId), eq(aiObservationRuns.projectId, input.projectId),
      )).limit(1);
      if (!run[0]) throw new Error("Observation run does not belong to project");
      const latest = await tx.select().from(aiObservationRunEvents).where(and(
        eq(aiObservationRunEvents.observationRunId, input.runId), eq(aiObservationRunEvents.projectId, input.projectId),
      )).orderBy(desc(aiObservationRunEvents.eventSequence)).limit(1);
      if (!latest[0]) throw new Error("Observation run has no initial event");
      assertObservationRunTransition(latest[0].eventType, input.eventType);
      const id = randomUUID();
      await tx.insert(aiObservationRunEvents).values({
        id, projectId: input.projectId, observationRunId: input.runId, eventType: input.eventType,
        eventSequence: latest[0].eventSequence + 1, occurredAt: input.occurredAt,
        errorCode: input.errorCode, errorMessage: input.errorMessage, eventMetadata: input.eventMetadata, createdBy: input.createdBy,
      });
      return id;
    });
  }

  /** Compatibility wrapper. Terminal state is now an appended event; the Run row is never updated. */
  async markRunTerminal(input: { projectId: number; runId: string; status: ObservationRunTerminalStatus; completedAt: Date; errorCode?: string | null; errorMessage?: string | null; createdBy?: number | null }) {
    return this.appendRunEvent({
      projectId: input.projectId, runId: input.runId, eventType: input.status, occurredAt: input.completedAt,
      errorCode: input.errorCode, errorMessage: input.errorMessage, createdBy: input.createdBy,
    });
  }

  async getRun(projectId: number, runId: string) {
    requireEnabled(this.allowWhenDisabled);
    const run = (await this.db.select().from(aiObservationRuns).where(and(eq(aiObservationRuns.id, runId), eq(aiObservationRuns.projectId, projectId))).limit(1))[0] ?? null;
    if (!run) return null;
    const statusHistory = await this.db.select().from(aiObservationRunEvents).where(and(
      eq(aiObservationRunEvents.observationRunId, runId), eq(aiObservationRunEvents.projectId, projectId),
    )).orderBy(asc(aiObservationRunEvents.eventSequence));
    return { ...run, currentStatus: statusHistory.at(-1)?.eventType ?? null, statusHistory };
  }

  async getAnswer(projectId: number, answerId: string) {
    requireEnabled(this.allowWhenDisabled);
    return (await this.db.select().from(aiObservationAnswers).where(and(eq(aiObservationAnswers.id, answerId), eq(aiObservationAnswers.projectId, projectId))).limit(1))[0] ?? null;
  }
}

/** Explicit boundary: legacy mixed records remain read-only compatibility data until PR-03.6C. */
export const LEGACY_UNDERSTANDING_EVALUATION_BOUNDARY = "legacy-read-only-no-observation-dual-write" as const;
