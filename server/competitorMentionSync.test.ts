import { describe, expect, it } from "vitest";
import { aggregateCompetitorMentionCounts } from "@shared/competitorAnalysisDisplay";

/** syncCompetitorAiMentionCounts 写入 DB 前的计数逻辑（与 server/competitorAnalysis.ts 一致）。 */
function planCompetitorMentionCountUpdates(
  profiles: Array<{ id: number; competitorName: string }>,
  runMentions: string[][],
): Array<{ id: number; aiMentionCount: number }> {
  const profileNames = profiles.map(row => row.competitorName);
  const counts = aggregateCompetitorMentionCounts(profileNames, runMentions);
  return profiles.map(row => ({
    id: row.id,
    aiMentionCount: counts[row.competitorName] ?? 0,
  }));
}

describe("syncCompetitorAiMentionCounts planning", () => {
  it("maps ai_test_runs competitorNames to profile rows with fuzzy match", () => {
    const updates = planCompetitorMentionCountUpdates(
      [
        { id: 1, competitorName: "小鹅通" },
        { id: 2, competitorName: "有赞教育" },
      ],
      [["小鹅通"], ["有赞教育版"], ["千聊"]],
    );
    expect(updates).toEqual([
      { id: 1, aiMentionCount: 1 },
      { id: 2, aiMentionCount: 1 },
    ]);
  });
});
