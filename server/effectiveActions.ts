import { inArray } from "drizzle-orm";
import type { getDb } from "./db";
import { projects, retestComparisons } from "../drizzle/schema";

export const EFFECTIVE_ACTION_TYPES = [
  "content_publish",
  "profile_update",
  "keyword_add",
  "competitor_analysis",
] as const;

export const EFFECTIVE_ACTION_CHANGE_DIRECTIONS = ["up", "flat", "down", "unknown"] as const;

export const EFFECTIVE_ACTION_EFFECT_LEVELS = [
  "A_obvious",
  "B_possible",
  "C_no_observed_effect",
  "D_wrong_direction",
  "watching",
] as const;

export type EffectiveActionType = (typeof EFFECTIVE_ACTION_TYPES)[number];
export type EffectiveActionChangeDirection = (typeof EFFECTIVE_ACTION_CHANGE_DIRECTIONS)[number];
export type EffectiveActionEffectLevel = (typeof EFFECTIVE_ACTION_EFFECT_LEVELS)[number];

/** 由复测对比生成的草稿（不写库，需人工确认后 create） */
export type EffectiveActionSuggestion = {
  sourceRetestComparisonId: string;
  projectId: number;
  industry: string;
  customerType: string;
  questionType: string;
  platform: string;
  baseRoundId: string;
  compareRoundId: string;
  baseMentionCount: number;
  compareMentionCount: number;
  changeDirection: "up";
  effectLevel: "watching";
  manualConclusion: string;
  note: string;
};

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/**
 * 从 retest_comparisons 生成有效动作草稿（不自动写库）。
 * 条件：changeDirection=up 且 confidenceLevel≠observe_more；effectLevel 固定为 watching。
 */
export async function suggestEffectiveActions(
  db: Db,
  retestComparisonIds: string[],
): Promise<EffectiveActionSuggestion[]> {
  if (retestComparisonIds.length === 0) return [];

  const rows = await db
    .select()
    .from(retestComparisons)
    .where(inArray(retestComparisons.id, retestComparisonIds));

  const projectIds = Array.from(new Set(rows.map(r => r.projectId)));
  const projectRows =
    projectIds.length > 0
      ? await db
          .select({
            id: projects.id,
            industry: projects.industry,
            targetCustomers: projects.targetCustomers,
          })
          .from(projects)
          .where(inArray(projects.id, projectIds))
      : [];
  const projectById = new Map(projectRows.map(p => [p.id, p]));

  const suggestions: EffectiveActionSuggestion[] = [];
  for (const row of rows) {
    if (row.changeDirection !== "up" || row.confidenceLevel === "observe_more") continue;
    const project = projectById.get(row.projectId);
    suggestions.push({
      sourceRetestComparisonId: row.id,
      projectId: row.projectId,
      industry: project?.industry ?? "",
      customerType: (project?.targetCustomers ?? "").slice(0, 255),
      questionType: row.questionType,
      platform: row.platform,
      baseRoundId: row.baseRoundId,
      compareRoundId: row.compareRoundId,
      baseMentionCount: row.baseMentionCount,
      compareMentionCount: row.compareMentionCount,
      changeDirection: "up",
      effectLevel: "watching",
      manualConclusion: row.systemConclusion,
      note: `由复测对比 ${row.id} 自动生成草稿，请补充动作类型、名称与执行时间后入库`,
    });
  }
  return suggestions;
}
