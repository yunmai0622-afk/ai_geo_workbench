export const EFFECT_INCLUSION_STATUSES = ["pending", "included", "failed", "unverified"] as const;
export type EffectInclusionStatus = (typeof EFFECT_INCLUSION_STATUSES)[number];

export const EFFECT_DATA_SOURCES = [
  "manual",
  "platform_backend",
  "local_agent",
  "third_party",
] as const;
export type EffectDataSource = (typeof EFFECT_DATA_SOURCES)[number];

export const EFFECT_INCLUSION_STATUS_LABEL_CN: Record<EffectInclusionStatus, string> = {
  pending: "待收录",
  included: "已收录",
  failed: "收录失败",
  unverified: "未验证",
};

export const EFFECT_DATA_SOURCE_LABEL_CN: Record<EffectDataSource, string> = {
  manual: "手动回填",
  platform_backend: "平台后台",
  local_agent: "Local Agent",
  third_party: "第三方统计",
};

const MS_PER_DAY = 86_400_000;
const RETEST_WAIT_DAYS = 3;

export function normalizeEffectInclusionStatus(
  value: string | null | undefined,
): EffectInclusionStatus {
  const raw = (value ?? "").trim().toLowerCase();
  if (raw === "included" || raw === "已收录") return "included";
  if (raw === "failed" || raw === "收录失败" || raw === "检测失败") return "failed";
  if (raw === "unverified" || raw === "未验证" || raw === "未检测") return "unverified";
  return "pending";
}

export function effectInclusionStatusLabelCn(value: string | null | undefined): string {
  return EFFECT_INCLUSION_STATUS_LABEL_CN[normalizeEffectInclusionStatus(value)];
}

export function effectDataSourceLabelCn(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim().toLowerCase() as EffectDataSource;
  if (!raw) return null;
  return EFFECT_DATA_SOURCE_LABEL_CN[raw] ?? null;
}

export function parseKeywordList(input: string | string[] | null | undefined): string[] {
  if (Array.isArray(input)) {
    return input.map(item => String(item).trim()).filter(Boolean);
  }
  if (!input?.trim()) return [];
  return input
    .split(/[,，;；\n]/)
    .map(item => item.trim())
    .filter(Boolean);
}

export function computeCanEnterAiRetest(input: {
  effectInclusionStatus?: string | null;
  inclusionVerifiedAt?: Date | string | null;
  now?: Date;
}): boolean {
  const status = normalizeEffectInclusionStatus(input.effectInclusionStatus);
  if (status !== "included") return false;
  if (!input.inclusionVerifiedAt) return false;
  const verifiedAt = new Date(input.inclusionVerifiedAt).getTime();
  if (Number.isNaN(verifiedAt)) return false;
  const now = input.now ?? new Date();
  return now.getTime() - verifiedAt >= RETEST_WAIT_DAYS * MS_PER_DAY;
}

export function daysUntilAiRetest(input: {
  effectInclusionStatus?: string | null;
  inclusionVerifiedAt?: Date | string | null;
  now?: Date;
}): number | null {
  const status = normalizeEffectInclusionStatus(input.effectInclusionStatus);
  if (status !== "included" || !input.inclusionVerifiedAt) return null;
  const verifiedAt = new Date(input.inclusionVerifiedAt).getTime();
  if (Number.isNaN(verifiedAt)) return null;
  const now = input.now ?? new Date();
  const elapsedDays = Math.floor((now.getTime() - verifiedAt) / MS_PER_DAY);
  const remaining = RETEST_WAIT_DAYS - elapsedDays;
  return remaining > 0 ? remaining : 0;
}

export type ContentAssetEffectRow = {
  id: number;
  effectInclusionStatus?: string | null;
  inclusionVerifiedAt?: Date | string | null;
  readCount?: number | null;
  impressionCount?: number | null;
  publishChannel?: string | null;
};

export type ContentAssetEffectOverview = {
  publishedCount: number;
  includedCount: number;
  inclusionRate: number | null;
  pendingCount: number;
  retestReadyCount: number;
  totalReadCount: number | null;
  totalImpressionCount: number | null;
};

export function aggregateContentAssetEffectOverview(
  publishedCount: number,
  rows: ContentAssetEffectRow[],
): ContentAssetEffectOverview {
  let includedCount = 0;
  let pendingCount = 0;
  let retestReadyCount = 0;
  let totalReadCount = 0;
  let totalImpressionCount = 0;
  let hasRead = false;
  let hasImpression = false;

  for (const row of rows) {
    const status = normalizeEffectInclusionStatus(row.effectInclusionStatus);
    if (status === "included") includedCount += 1;
    if (status === "pending") pendingCount += 1;
    if (computeCanEnterAiRetest(row)) retestReadyCount += 1;
    if (typeof row.readCount === "number" && row.readCount >= 0) {
      hasRead = true;
      totalReadCount += row.readCount;
    }
    if (typeof row.impressionCount === "number" && row.impressionCount >= 0) {
      hasImpression = true;
      totalImpressionCount += row.impressionCount;
    }
  }

  const inclusionRate =
    publishedCount > 0 ? Math.round((includedCount / publishedCount) * 100) : null;

  return {
    publishedCount,
    includedCount,
    inclusionRate,
    pendingCount,
    retestReadyCount,
    totalReadCount: hasRead ? totalReadCount : null,
    totalImpressionCount: hasImpression ? totalImpressionCount : null,
  };
}

export type PlatformEffectSummaryRow = {
  platform: string;
  publishedCount: number;
  includedCount: number;
  inclusionRate: number | null;
  totalReadCount: number | null;
};

export function aggregatePlatformEffectSummary(
  rows: Array<ContentAssetEffectRow & { publishChannel?: string | null }>,
): PlatformEffectSummaryRow[] {
  const byPlatform = new Map<
    string,
    { publishedCount: number; includedCount: number; totalReadCount: number; hasRead: boolean }
  >();

  for (const row of rows) {
    const platform = (row.publishChannel ?? "").trim() || "未标注";
    const bucket = byPlatform.get(platform) ?? {
      publishedCount: 0,
      includedCount: 0,
      totalReadCount: 0,
      hasRead: false,
    };
    bucket.publishedCount += 1;
    if (normalizeEffectInclusionStatus(row.effectInclusionStatus) === "included") {
      bucket.includedCount += 1;
    }
    if (typeof row.readCount === "number" && row.readCount >= 0) {
      bucket.hasRead = true;
      bucket.totalReadCount += row.readCount;
    }
    byPlatform.set(platform, bucket);
  }

  return Array.from(byPlatform.entries())
    .map(([platform, bucket]) => ({
      platform,
      publishedCount: bucket.publishedCount,
      includedCount: bucket.includedCount,
      inclusionRate:
        bucket.publishedCount > 0
          ? Math.round((bucket.includedCount / bucket.publishedCount) * 100)
          : null,
      totalReadCount: bucket.hasRead ? bucket.totalReadCount : null,
    }))
    .sort((a, b) => b.publishedCount - a.publishedCount);
}

export type ContentAssetNextAction =
  | { kind: "mark_included"; label: "标记为已收录" }
  | { kind: "join_retest"; label: "加入AI复测" }
  | { kind: "wait_retest"; label: string; daysRemaining: number }
  | { kind: "republish"; label: "重新发布" }
  | { kind: "ignore"; label: "标记忽略" };

export function buildContentAssetNextAction(input: {
  effectInclusionStatus?: string | null;
  inclusionVerifiedAt?: Date | string | null;
  now?: Date;
}): ContentAssetNextAction {
  const status = normalizeEffectInclusionStatus(input.effectInclusionStatus);
  if (status === "pending") {
    return { kind: "mark_included", label: "标记为已收录" };
  }
  if (status === "included") {
    if (computeCanEnterAiRetest(input)) {
      return { kind: "join_retest", label: "加入AI复测" };
    }
    const daysRemaining = daysUntilAiRetest(input) ?? RETEST_WAIT_DAYS;
    return {
      kind: "wait_retest",
      label: `${daysRemaining}天后可复测`,
      daysRemaining,
    };
  }
  if (status === "failed") {
    return { kind: "republish", label: "重新发布" };
  }
  return { kind: "ignore", label: "标记忽略" };
}

export function mapEffectFieldsForApi<T extends Record<string, unknown>>(row: T) {
  const effectInclusionStatus = normalizeEffectInclusionStatus(
    row.effectInclusionStatus as string | null | undefined,
  );
  const inclusionKeywords = Array.isArray(row.inclusionKeywords)
    ? (row.inclusionKeywords as string[])
    : [];
  const searchTriggerKeywords = Array.isArray(row.searchTriggerKeywords)
    ? (row.searchTriggerKeywords as string[])
    : [];
  const canEnterAiRetest = computeCanEnterAiRetest({
    effectInclusionStatus,
    inclusionVerifiedAt: row.inclusionVerifiedAt as Date | string | null | undefined,
  });
  const nextAction = buildContentAssetNextAction({
    effectInclusionStatus,
    inclusionVerifiedAt: row.inclusionVerifiedAt as Date | string | null | undefined,
  });

  return {
    ...row,
    effectInclusionStatus,
    inclusionStatusLabel: effectInclusionStatusLabelCn(effectInclusionStatus),
    effectStatusLabel: effectInclusionStatusLabelCn(effectInclusionStatus),
    inclusionKeywords,
    searchTriggerKeywords,
    dataSourceLabel: effectDataSourceLabelCn(row.effectDataSource as string | null | undefined),
    canEnterAiRetest,
    nextAction,
  };
}
