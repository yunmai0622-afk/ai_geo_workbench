import { eq } from "drizzle-orm";
import {
  aggregateCompetitorMentionCounts,
  buildCompetitorAnalysisRows,
  buildCompetitorContentSuggestions,
} from "@shared/competitorAnalysisDisplay";
import { aiTestRuns, competitorProfiles } from "../drizzle/schema";

type DbConn = NonNullable<Awaited<ReturnType<typeof import("./db").getDb>>>;

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
