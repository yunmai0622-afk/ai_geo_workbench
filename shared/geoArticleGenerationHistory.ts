/** GEO-V1.1-Generation-History：从 geo_articles 行与同条 optimizationVersions 构建生成/版本历史 */

import { hasEditableArticleBody } from "./contentEditState";

export type GeoArticleGenerationHistoryKind =
  | "current"
  | "prior_generation"
  | "optimization_snapshot";

export type GeoArticleGenerationHistoryEntry = {
  /** 稳定键：current | gen:{id} | opt:{version} */
  key: string;
  kind: GeoArticleGenerationHistoryKind;
  createdAt: string;
  statusLabel: string;
  sourceLabel: string;
  title: string;
  markdownContent: string;
  canRestore: boolean;
  isCurrentBody?: boolean;
  version?: number;
  priorArticleId?: number;
};

export type GeoArticleHistoryRow = {
  id: number;
  topicId: number;
  title: string;
  markdownContent: string;
  status: string;
  createdAt: Date | string;
  updatedAt?: Date | string | null;
  optimizationVersions?: unknown;
  generationBasis?: Record<string, unknown> | null;
};

type OptimizationSnapshot = {
  version: number;
  createdAt: string;
  mode?: string;
  previousStatus?: string;
  title: string;
  markdownContent: string;
  reason?: string;
};

function toIsoTime(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function parseOptimizationSnapshots(raw: unknown): OptimizationSnapshot[] {
  if (!Array.isArray(raw)) return [];
  const out: OptimizationSnapshot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const version = typeof row.version === "number" ? row.version : Number(row.version);
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const markdownContent = typeof row.markdownContent === "string" ? row.markdownContent : "";
    if (!Number.isFinite(version) || version < 1 || !title || !markdownContent) continue;
    out.push({
      version,
      createdAt: typeof row.createdAt === "string" ? row.createdAt : toIsoTime(null),
      mode: typeof row.mode === "string" ? row.mode : undefined,
      previousStatus: typeof row.previousStatus === "string" ? row.previousStatus : undefined,
      title,
      markdownContent,
      reason: typeof row.reason === "string" ? row.reason : undefined,
    });
  }
  return out.sort((a, b) => b.version - a.version);
}

export function buildGeoArticleGenerationHistory(input: {
  article: GeoArticleHistoryRow;
  priorGenerations: Array<{
    id: number;
    title: string;
    markdownContent: string;
    status: string;
    createdAt: Date | string;
  }>;
}): GeoArticleGenerationHistoryEntry[] {
  const entries: GeoArticleGenerationHistoryEntry[] = [];
  const currentIsGeneratedBody = hasEditableArticleBody(input.article);

  entries.push({
    key: "current",
    kind: "current",
    createdAt: toIsoTime(input.article.updatedAt ?? input.article.createdAt),
    statusLabel: input.article.status || "未知",
    sourceLabel: currentIsGeneratedBody ? "当前正文" : "当前记录（未生成）",
    title: input.article.title,
    markdownContent: currentIsGeneratedBody ? input.article.markdownContent : "",
    canRestore: false,
    isCurrentBody: currentIsGeneratedBody,
  });

  for (const row of input.priorGenerations) {
    if (row.id === input.article.id) continue;
    if (!hasEditableArticleBody(row)) continue;
    entries.push({
      key: `gen:${row.id}`,
      kind: "prior_generation",
      createdAt: toIsoTime(row.createdAt),
      statusLabel: row.status || "未知",
      sourceLabel: "历史生成记录",
      title: row.title,
      markdownContent: row.markdownContent,
      canRestore: true,
      priorArticleId: row.id,
    });
  }

  for (const snap of parseOptimizationSnapshots(input.article.optimizationVersions)) {
    entries.push({
      key: `opt:${snap.version}`,
      kind: "optimization_snapshot",
      createdAt: toIsoTime(snap.createdAt),
      statusLabel: snap.previousStatus || "未知",
      sourceLabel: snap.mode ? `版本快照 · ${snap.mode}` : "版本快照",
      title: snap.title,
      markdownContent: snap.markdownContent,
      canRestore: true,
      version: snap.version,
    });
  }

  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function findGeoArticleGenerationHistoryEntry(
  entries: GeoArticleGenerationHistoryEntry[],
  key: string,
): GeoArticleGenerationHistoryEntry | undefined {
  return entries.find(entry => entry.key === key);
}

export function buildRestoreBackupSnapshot(input: {
  title: string;
  markdownContent: string;
  status: string;
  existingVersions: unknown;
  restoredFromLabel: string;
}): Record<string, unknown> {
  const existing = parseOptimizationSnapshots(input.existingVersions);
  const nextVersion = existing.length > 0 ? Math.max(...existing.map(v => v.version)) + 1 : 1;
  return {
    version: nextVersion,
    createdAt: new Date().toISOString(),
    mode: "历史版本恢复",
    previousStatus: input.status,
    title: input.title,
    markdownContent: input.markdownContent,
    reason: `恢复「${input.restoredFromLabel}」前的自动备份`,
  };
}

export function applyGeoArticleGenerationHistoryRestore(input: {
  article: GeoArticleHistoryRow;
  entry: GeoArticleGenerationHistoryEntry;
}): {
  title: string;
  markdownContent: string;
  optimizationVersions: Array<Record<string, unknown>>;
} {
  if (!input.entry.canRestore) {
    throw new Error("当前条目不可恢复");
  }
  const existing = Array.isArray(input.article.optimizationVersions)
    ? [...(input.article.optimizationVersions as Array<Record<string, unknown>>)]
    : [];
  const backup = buildRestoreBackupSnapshot({
    title: input.article.title,
    markdownContent: input.article.markdownContent,
    status: input.article.status,
    existingVersions: existing,
    restoredFromLabel: input.entry.sourceLabel,
  });
  return {
    title: input.entry.title,
    markdownContent: input.entry.markdownContent,
    optimizationVersions: [...existing, backup],
  };
}
