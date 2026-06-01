import { and, desc, eq } from "drizzle-orm";
import { aiTestRuns, testRounds } from "../drizzle/schema";
import {
  aggregateT0AiTestRunMetrics,
  type T0AiTestRunMetricsResult,
} from "@shared/t0AiTestRunMetrics";
import { findLatestCompletedRound, type TestRoundSummary } from "@shared/retestComparisonDisplay";

type DbConn = Awaited<ReturnType<typeof import("./db").getDb>>;

export type ResolvedT0AiTestRunMetrics = T0AiTestRunMetricsResult & {
  roundId: string;
  roundName: string;
  finishedAt: Date | null;
};

/** 读取项目最近一次已完成 T0 轮次的 ai_test_runs 并聚合指标。 */
export async function resolveLatestT0AiTestRunMetrics(
  db: NonNullable<DbConn>,
  projectId: number,
): Promise<ResolvedT0AiTestRunMetrics | null> {
  const rounds = await db
    .select()
    .from(testRounds)
    .where(eq(testRounds.projectId, projectId))
    .orderBy(desc(testRounds.createdAt));

  const baseRound = findLatestCompletedRound(rounds as TestRoundSummary[], "T0_BASELINE");
  if (!baseRound) return null;

  const runs = await db
    .select({
      mentionedCompany: aiTestRuns.mentionedCompany,
      recommendedCompany: aiTestRuns.recommendedCompany,
    })
    .from(aiTestRuns)
    .where(and(eq(aiTestRuns.roundId, baseRound.id), eq(aiTestRuns.projectId, projectId)));

  const metrics = aggregateT0AiTestRunMetrics(runs);
  if (!metrics) return null;

  const fullRound = rounds.find(round => round.id === baseRound.id);

  return {
    ...metrics,
    roundId: baseRound.id,
    roundName: baseRound.roundName,
    finishedAt: fullRound?.finishedAt ?? null,
  };
}
