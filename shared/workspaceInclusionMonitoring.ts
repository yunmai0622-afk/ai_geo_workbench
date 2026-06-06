/** 工作台收录监测明细：按发布平台聚合监测记录（纯函数，可单测） */

export type WorkspaceInclusionMonitoringInput = {
  id: number;
  publishRecordId: number;
  inclusionStatus?: string | null;
  lastCheckedAt?: Date | string | null;
  articleTitle?: string | null;
};

export type WorkspacePublishRecordChannelInput = {
  id: number;
  publishChannel?: string | null;
};

export type WorkspaceInclusionPlatformRow = {
  platform: string;
  inclusionStatus: string;
  lastCheckedAt: Date | string | null;
  recordCount: number;
};

function parseTime(value: Date | string | null | undefined): number {
  if (value == null) return NaN;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? NaN : t;
}

export function formatInclusionCheckedAtLabel(value: Date | string | null | undefined): string {
  const t = parseTime(value);
  if (Number.isNaN(t)) return "未检测";
  return new Date(t).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildWorkspaceInclusionPlatformRows(
  monitoring: WorkspaceInclusionMonitoringInput[],
  publishRecords: WorkspacePublishRecordChannelInput[],
): WorkspaceInclusionPlatformRow[] {
  if (monitoring.length === 0) return [];

  const channelByPublishId = new Map<number, string>();
  for (const record of publishRecords) {
    const channel = (record.publishChannel ?? "").trim();
    if (channel) channelByPublishId.set(record.id, channel);
  }

  const byPlatform = new Map<
    string,
    { inclusionStatus: string; lastCheckedAt: Date | string | null; recordCount: number; sortKey: number }
  >();

  for (const row of monitoring) {
    const platform =
      channelByPublishId.get(row.publishRecordId)?.trim() ||
      "未标注平台";
    const inclusionStatus = (row.inclusionStatus ?? "").trim() || "未检测";
    const checkedAt = row.lastCheckedAt ?? null;
    const sortKey = parseTime(checkedAt);

    const existing = byPlatform.get(platform);
    if (!existing) {
      byPlatform.set(platform, {
        inclusionStatus,
        lastCheckedAt: checkedAt,
        recordCount: 1,
        sortKey: Number.isNaN(sortKey) ? -1 : sortKey,
      });
      continue;
    }

    existing.recordCount += 1;
    const nextKey = Number.isNaN(sortKey) ? -1 : sortKey;
    if (nextKey > existing.sortKey) {
      existing.sortKey = nextKey;
      existing.lastCheckedAt = checkedAt;
      existing.inclusionStatus = inclusionStatus;
    }
  }

  return Array.from(byPlatform.entries())
    .map(([platform, row]) => ({
      platform,
      inclusionStatus: row.inclusionStatus,
      lastCheckedAt: row.lastCheckedAt,
      recordCount: row.recordCount,
    }))
    .sort((a, b) => {
      const ta = parseTime(a.lastCheckedAt);
      const tb = parseTime(b.lastCheckedAt);
      if (!Number.isNaN(tb) && !Number.isNaN(ta)) return tb - ta;
      if (!Number.isNaN(tb)) return 1;
      if (!Number.isNaN(ta)) return -1;
      return a.platform.localeCompare(b.platform, "zh-CN");
    });
}

export function workspaceInclusionEmptyGuide(input: {
  monitoringCount: number;
  publishRecordCount: number;
}): { title: string; description: string; ctaLabel: string } {
  if (input.monitoringCount > 0) {
    return {
      title: "暂无平台汇总",
      description: "监测记录尚未关联发布平台，请在收录监测页查看详情。",
      ctaLabel: "进入收录监测",
    };
  }
  if (input.publishRecordCount > 0) {
    return {
      title: "暂无收录监测记录",
      description: "当前项目已有发布记录，请进入收录监测为已发布内容创建监测卡片，或执行补录。",
      ctaLabel: "进入收录监测",
    };
  }
  return {
    title: "暂无收录监测数据",
    description: "完成平台适配发布并回填公开链接后，系统会开始收录监测；也可在发布中心登记人工发布结果。",
    ctaLabel: "前往内容发布",
  };
}
