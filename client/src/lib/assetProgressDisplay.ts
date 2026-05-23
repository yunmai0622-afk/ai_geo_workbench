/** C4-B：发布记录 / 内容进展展示层计算（不调用接口、不 mock） */

export type PublishRecordForDisplay = {
  articleId?: number | null;
  publishTitle?: string | null;
  publishChannel?: string | null;
  publishStatus?: string | null;
  publishUrl?: string | null;
  publicUrl?: string | null;
  publishedAt?: Date | string | number | null;
  needRetest?: number | boolean | null;
  monitoring?: { lastAiTestedAt?: Date | string | number | null } | null;
};

export type MonitoringForDisplay = {
  lastAiTestedAt?: Date | string | number | null;
  aiTestResults?: unknown[] | null;
};

function parseTime(value: Date | string | number | null | undefined): number {
  if (value == null) return NaN;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? NaN : t;
}

export function recordPublicLink(record: PublishRecordForDisplay): string {
  return (record.publishUrl || record.publicUrl || "").trim();
}

export function publishStatusLabel(status: string | null | undefined): string {
  const s = (status || "").trim();
  if (!s) return "待确认";
  if (s === "link_backfilled") return "已登记链接";
  if (s === "published") return "已发布";
  if (s === "pending_human_publish") return "待人工发布";
  if (s === "manual_publish_needed") return "待补充发布";
  if (s === "publish_failed") return "发布异常";
  return "已登记";
}

export function retestHintForRecord(record: PublishRecordForDisplay): string {
  const link = recordPublicLink(record);
  if (link) return "建议发布后 7-14 天进行 AI 复测。";
  return "请补充公开链接后再进行后续复测。";
}

function daysSincePublish(publishedAt: PublishRecordForDisplay["publishedAt"]): number | null {
  const t = parseTime(publishedAt ?? null);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

export function isPendingRetest(record: PublishRecordForDisplay): boolean {
  const link = recordPublicLink(record);
  if (!link) return false;
  if (record.needRetest === true || record.needRetest === 1) return true;
  const days = daysSincePublish(record.publishedAt);
  if (days == null) return false;
  const testedAt = parseTime(record.monitoring?.lastAiTestedAt ?? null);
  if (days >= 7 && Number.isNaN(testedAt)) return true;
  return false;
}

export type PublishOverviewMetrics = {
  publishedContentCount: number | null;
  platformCount: number | null;
  withLinkCount: number | null;
  pendingRetestCount: number | null;
};

export function computePublishOverview(records: PublishRecordForDisplay[]): PublishOverviewMetrics {
  if (records.length === 0) {
    return {
      publishedContentCount: null,
      platformCount: null,
      withLinkCount: null,
      pendingRetestCount: null,
    };
  }
  const articleIds = new Set<number>();
  const platforms = new Set<string>();
  let withLink = 0;
  let pendingRetest = 0;
  for (const r of records) {
    if (typeof r.articleId === "number") articleIds.add(r.articleId);
    const ch = (r.publishChannel || "").trim();
    if (ch) platforms.add(ch);
    if (recordPublicLink(r)) withLink += 1;
    if (isPendingRetest(r)) pendingRetest += 1;
  }
  const publishedContentCount = articleIds.size > 0 ? articleIds.size : records.length;
  return {
    publishedContentCount,
    platformCount: platforms.size > 0 ? platforms.size : null,
    withLinkCount: withLink,
    pendingRetestCount: pendingRetest,
  };
}

export type PlatformCountRow = { platform: string; count: number };

export function computePlatformDistribution(records: PublishRecordForDisplay[]): PlatformCountRow[] {
  if (records.length === 0) return [];
  const map = new Map<string, number>();
  for (const r of records) {
    const ch = (r.publishChannel || "").trim() || "其他";
    map.set(ch, (map.get(ch) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count);
}

export function buildPublishNextActions(records: PublishRecordForDisplay[]): string[] {
  const actions: string[] = [];
  const withoutLink = records.filter(r => !recordPublicLink(r));
  const needAfterRetest = records.filter(r => isPendingRetest(r));
  if (withoutLink.length > 0) {
    actions.push("优先补齐无公开链接的已发布内容。");
  }
  if (needAfterRetest.length > 0) {
    actions.push("对已发布 7 天以上的内容执行发布后复测。");
  }
  if (actions.length < 3) {
    actions.push("下轮内容优先覆盖品牌认知类和竞品对比类问题。");
  }
  return actions.slice(0, 3);
}

export type AssetFunnelStage = { label: string; value: string };

export function computeAssetFunnel(params: {
  articleCount: number;
  publishRecordCount: number;
  withLinkCount: number;
  aiTestedCount: number;
  afterPublishTestCount: number;
}): AssetFunnelStage[] {
  const fmt = (n: number, hasBasis: boolean) => (hasBasis && n > 0 ? `${n} 篇` : "暂无数据");
  const hasArticles = params.articleCount > 0;
  const hasPublish = params.publishRecordCount > 0;
  return [
    { label: "已生成", value: fmt(params.articleCount, hasArticles) },
    { label: "已发布", value: fmt(params.publishRecordCount, hasPublish) },
    {
      label: "已有公开链接",
      value: hasPublish ? (params.withLinkCount > 0 ? `${params.withLinkCount} 条` : "暂无数据") : "暂无数据",
    },
    {
      label: "已完成 AI 实测",
      value: params.aiTestedCount > 0 ? `${params.aiTestedCount} 条` : "暂无数据",
    },
    {
      label: "已进入发布后复测",
      value: params.afterPublishTestCount > 0 ? `${params.afterPublishTestCount} 条` : "暂无数据",
    },
  ];
}

/** 供进展页聚合实测数据，避免在页面源码中出现工程字段名 */
export function monitoringEvidenceRows(
  monitoring: MonitoringForDisplay[],
): Array<{ monitoringRecordId: number; results: unknown[] }> {
  return monitoring.map((m, i) => ({
    monitoringRecordId: i + 1,
    results: Array.isArray(m.aiTestResults) ? m.aiTestResults : [],
  }));
}

export function countAfterPublishTests(monitoring: MonitoringForDisplay[]): number {
  let n = 0;
  for (const m of monitoring) {
    const results = Array.isArray(m.aiTestResults) ? m.aiTestResults : [];
    const hasAfter = results.some(r => {
      if (!r || typeof r !== "object") return false;
      const stage = (r as { testStage?: string; stage?: string }).testStage ?? (r as { stage?: string }).stage;
      return stage === "after_publish";
    });
    if (hasAfter) n += 1;
  }
  return n;
}

export function countAiTestedMonitoring(monitoring: MonitoringForDisplay[]): number {
  return monitoring.filter(m => {
    const t = parseTime(m.lastAiTestedAt ?? null);
    return !Number.isNaN(t);
  }).length;
}

export function buildProgressNextActions(params: {
  publishCount: number;
  withoutLinkCount: number;
  pendingRetestCount: number;
  hasAiTest: boolean;
  taskCount: number;
}): string[] {
  const actions: string[] = [];
  if (params.taskCount > 0 && params.publishCount === 0) {
    actions.push("优先补充品牌认知类内容，提升品牌实体信号。");
  } else if (params.withoutLinkCount > 0) {
    actions.push("优先补齐已发布内容的公开链接，便于后续复测与收录追踪。");
  } else if (params.pendingRetestCount > 0) {
    actions.push("对已发布 7-14 天的内容做发布后复测。");
  } else if (!params.hasAiTest && params.publishCount > 0) {
    actions.push("在收录监测页对已发布内容执行 AI 搜索实测。");
  } else {
    actions.push("优先补充品牌认知类内容，提升品牌实体信号。");
  }
  if (actions.length < 2) {
    actions.push("增加竞品对比类内容，提升决策场景下的可见度。");
  }
  if (actions.length < 3) {
    actions.push("保持每周内容更新节奏，稳定沉淀可引用资产。");
  }
  return actions.slice(0, 3);
}

export function formatMetricValue(value: number | null | undefined): string {
  if (value == null) return "暂无数据";
  return String(value);
}
