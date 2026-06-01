import { eq } from "drizzle-orm";
import {
  aggregateCompetitorMentionCounts,
  buildCompetitorAnalysisRows,
  buildCompetitorContentSuggestions,
} from "@shared/competitorAnalysisDisplay";
import { aiTestRuns, competitorProfiles } from "../drizzle/schema";

type DbConn = NonNullable<Awaited<ReturnType<typeof import("./db").getDb>>>;

/** 从 ai_test_runs.competitorNames 聚合各档案竞品出现次数，并写回 competitor_profiles.aiMentionCount。 */
export async function syncCompetitorAiMentionCounts(db: DbConn, projectId: number): Promise<void> {
  const [competitors, runs] = await Promise.all([
    db
      .select({
        id: competitorProfiles.id,
        competitorName: competitorProfiles.competitorName,
      })
      .from(competitorProfiles)
      .where(eq(competitorProfiles.projectId, projectId)),
    db
      .select({ competitorNames: aiTestRuns.competitorNames })
      .from(aiTestRuns)
      .where(eq(aiTestRuns.projectId, projectId)),
  ]);

  if (competitors.length === 0) return;

  const profileNames = competitors.map(row => row.competitorName);
  const aiMentionCounts = aggregateCompetitorMentionCounts(
    profileNames,
    runs.map(run => run.competitorNames ?? []),
  );

  await Promise.all(
    competitors.map(row =>
      db
        .update(competitorProfiles)
        .set({ aiMentionCount: aiMentionCounts[row.competitorName] ?? 0 })
        .where(eq(competitorProfiles.id, row.id)),
    ),
  );
}

export async function resolveCompetitorAnalysisSummary(db: DbConn, projectId: number, brandName: string) {
  const [competitors, runs] = await Promise.all([
    db
      .select()
      .from(competitorProfiles)
      .where(eq(competitorProfiles.projectId, projectId))
      .orderBy(competitorProfiles.updatedAt),
    db
      .select({ competitorNames: aiTestRuns.competitorNames })
      .from(aiTestRuns)
      .where(eq(aiTestRuns.projectId, projectId)),
  ]);

  const profileNames = competitors.map(row => row.competitorName);
  const aiMentionCounts = aggregateCompetitorMentionCounts(
    profileNames,
    runs.map(run => run.competitorNames ?? []),
  );

  const input = {
    brandName,
    competitors,
    aiMentionCounts,
    totalAiTestRuns: runs.length,
  };

  return {
    brandName,
    totalAiTestRuns: runs.length,
    competitors: buildCompetitorAnalysisRows(input),
    contentSuggestions: buildCompetitorContentSuggestions(input),
  } as const;
}
