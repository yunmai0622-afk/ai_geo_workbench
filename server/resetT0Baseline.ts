import { and, eq, inArray, or } from "drizzle-orm";
import { aiTestRuns, retestComparisons, roundQuestions, testRounds } from "../drizzle/schema";
import type { getDb } from "./db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export async function resetProjectT0Baseline(db: Db, projectId: number) {
  const rounds = await db
    .select({ id: testRounds.id, status: testRounds.status })
    .from(testRounds)
    .where(and(eq(testRounds.projectId, projectId), eq(testRounds.roundType, "T0_BASELINE")));

  if (rounds.some(round => round.status === "running")) {
    return { ok: false as const, reason: "running" as const };
  }

  const roundIds = rounds.map(round => round.id);
  if (roundIds.length === 0) {
    return { ok: true as const, deletedRoundCount: 0 };
  }

  await db.delete(aiTestRuns).where(and(eq(aiTestRuns.projectId, projectId), inArray(aiTestRuns.roundId, roundIds)));
  await db.delete(roundQuestions).where(inArray(roundQuestions.roundId, roundIds));
  await db.delete(retestComparisons).where(
    and(
      eq(retestComparisons.projectId, projectId),
      or(inArray(retestComparisons.baseRoundId, roundIds), inArray(retestComparisons.compareRoundId, roundIds)),
    ),
  );
  await db
    .delete(testRounds)
    .where(and(eq(testRounds.projectId, projectId), eq(testRounds.roundType, "T0_BASELINE")));

  return { ok: true as const, deletedRoundCount: roundIds.length };
}
