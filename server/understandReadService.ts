import { and, desc, eq } from "drizzle-orm";
import {
  legacyUnderstandingMigrationItems,
  understandingAssessments,
  understandingEvaluations,
  understandingRolloutConfigs,
} from "../drizzle/schema";
import { isAiObservationLedgerV2Enabled } from "./aiObservationLedgerService";
import type { DbConn } from "./projectAccess";

export const UNDERSTAND_READ_MODES = ["legacy_only", "shadow_read", "v2_primary", "v2_only"] as const;
export type UnderstandReadMode = typeof UNDERSTAND_READ_MODES[number];
export type UnderstandWritePath = "legacy" | "v2";

export const LEGACY_PRESENTATION = {
  label: "Legacy",
  reproducibilityNotice: "部分字段不可复现",
  methodologyNotice: "不使用新方法论",
  trendEligible: false,
  directlyComparableToFormalAssessment: false,
  historicalMetricLabel: "历史 GEO 指标",
  historicalMetricNotice: "旧成熟度与资产总分不代表 AI Trust Readiness 或推荐概率",
} as const;

export function effectiveRollout(
  globalEnabled: boolean,
  config?: { readMode: UnderstandReadMode; writePath: UnderstandWritePath } | null,
) {
  // Shadow reads are project-scoped observations: they never change the customer
  // primary read or the legacy write path. The global flag remains the hard gate
  // for either v2 primary mode.
  if (!globalEnabled) {
    if (config?.readMode === "shadow_read") return { readMode: "shadow_read" as const, writePath: "legacy" as const };
    return { readMode: "legacy_only" as const, writePath: "legacy" as const };
  }
  if (!config) return { readMode: "legacy_only" as const, writePath: "legacy" as const };
  return { readMode: config.readMode, writePath: (["v2_primary", "v2_only"] as UnderstandReadMode[]).includes(config.readMode) ? "v2" as const : "legacy" as const };
}

export function composeUnderstandRead<TLegacy, TV2>(mode: UnderstandReadMode, legacy: TLegacy[], v2: TV2[]) {
  const legacyHistory = legacy.map(record => ({ ...record, presentation: LEGACY_PRESENTATION }));
  const trend = v2;
  switch (mode) {
    case "legacy_only": return { mode, primary: legacyHistory, legacyHistory, v2: [], shadowComparison: null, trend: [] };
    case "shadow_read": return { mode, primary: legacyHistory, legacyHistory, v2, shadowComparison: { legacyCount: legacy.length, v2Count: v2.length }, trend: [] };
    case "v2_primary": return { mode, primary: v2, legacyHistory, v2, shadowComparison: null, trend };
    case "v2_only": return { mode, primary: v2, legacyHistory: [], v2, shadowComparison: null, trend };
  }
}

export async function executeExclusiveUnderstandWrite<T>(
  writePath: UnderstandWritePath,
  handlers: { legacy: () => Promise<T>; v2: () => Promise<T> },
): Promise<T> {
  return writePath === "v2" ? handlers.v2() : handlers.legacy();
}

export class UnderstandReadService {
  constructor(private readonly db: DbConn) {}

  async getRollout(projectId: number) {
    const config = (await this.db.select({ readMode: understandingRolloutConfigs.readMode, writePath: understandingRolloutConfigs.writePath })
      .from(understandingRolloutConfigs).where(eq(understandingRolloutConfigs.projectId, projectId)).limit(1))[0];
    return effectiveRollout(isAiObservationLedgerV2Enabled(), config ?? null);
  }

  /** Returns exactly one write path; callers must never write both legacy and v2. */
  async getWritePath(projectId: number): Promise<UnderstandWritePath> {
    return (await this.getRollout(projectId)).writePath;
  }

  async readProject(projectId: number) {
    const rollout = await this.getRollout(projectId);
    const needsV2 = rollout.readMode !== "legacy_only";
    const [legacy, v2] = await Promise.all([
      this.db.select().from(understandingEvaluations).where(eq(understandingEvaluations.projectId, projectId)).orderBy(desc(understandingEvaluations.testedAt)),
      needsV2 ? this.db.select().from(understandingAssessments).where(eq(understandingAssessments.projectId, projectId)).orderBy(desc(understandingAssessments.createdAt)) : Promise.resolve([]),
    ]);
    return composeUnderstandRead(rollout.readMode, legacy, v2);
  }

  async migrationLink(projectId: number, legacyEvaluationId: string) {
    return (await this.db.select().from(legacyUnderstandingMigrationItems).where(and(
      eq(legacyUnderstandingMigrationItems.projectId, projectId),
      eq(legacyUnderstandingMigrationItems.legacyEvaluationId, legacyEvaluationId),
    )).limit(1))[0] ?? null;
  }

  /** Rollback is a read/write switch only. No migrated rows are removed. */
  async rollbackToLegacyOnly(projectId: number, updatedBy?: number, reason = "rollback") {
    await this.db.insert(understandingRolloutConfigs).values({ projectId, readMode: "legacy_only", writePath: "legacy", updatedBy, reason })
      .onDuplicateKeyUpdate({ set: { readMode: "legacy_only", writePath: "legacy", updatedBy, reason } });
  }
}
