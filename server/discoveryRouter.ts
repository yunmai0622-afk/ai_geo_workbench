import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { DISCOVERY_CANDIDATE_TYPES } from "@shared/discoveryLogic";
import { getDb } from "./db";
import {
  acceptDiscoveryCandidate,
  discoverSources,
  discoverTrustEvidence,
  getDiscoveryProviderStatus,
  ignoreDiscoveryCandidate,
  listDiscoveryCandidates,
} from "./discoveryService";
import { requireProjectAccess } from "./projectAccess";
import { protectedProcedure, router } from "./_core/trpc";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
  return db;
}

const candidateTypeSchema = z.enum(
  DISCOVERY_CANDIDATE_TYPES as unknown as [string, ...string[]],
);

export const discoveryRouter = router({
  getProviderStatus: protectedProcedure.query(() => getDiscoveryProviderStatus()),

  discoverSources: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      return discoverSources(db, input.projectId);
    }),

  discoverTrustEvidence: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      return discoverTrustEvidence(db, input.projectId);
    }),

  listCandidates: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        type: candidateTypeSchema,
        status: z.enum(["pending", "accepted", "ignored"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      return listDiscoveryCandidates(db, input.projectId, input.type as "source" | "trust_evidence", input.status);
    }),

  acceptCandidate: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        candidateId: z.number().int().positive(),
        targetType: z.enum(["source", "trust_evidence"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      return acceptDiscoveryCandidate(db, input.projectId, input.candidateId, input.targetType);
    }),

  ignoreCandidate: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        candidateId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      await ignoreDiscoveryCandidate(db, input.projectId, input.candidateId);
      return { success: true as const };
    }),
});
