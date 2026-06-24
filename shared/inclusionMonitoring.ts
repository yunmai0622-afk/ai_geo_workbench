import {
  buildMonitoringNextAction,
  monitorStatusLabelCn,
  parsePublishLinkAccess,
  type PublishLinkAccessSnapshot,
} from "./inclusionMonitoringDisplay";
import { mapEffectFieldsForApi } from "./contentAssetEffectTracking";

/**
 * 将 DB 行映射为前端/API 使用的监测字段（兼容 inclusionStatus 等别名，空值不抛错）。
 */
export type InclusionMonitoringDbRow = {
  inclusionMonitorStatus?: string | null;
  aiMentionMonitorStatus?: string | null;
  aiRecommendMonitorStatus?: string | null;
  currentSuggestion?: string | null;
  optimizationSuggestions?: string[] | null;
  rawJson?: Record<string, unknown> | null;
  aiTestResults?: unknown[] | null;
  lastAiTestedAt?: Date | string | null;
  [key: string]: unknown;
};

export function mapInclusionMonitoringRecordForApi<T extends InclusionMonitoringDbRow>(row: T) {
  const rawJson = row.rawJson && typeof row.rawJson === "object" ? row.rawJson : {};
  const aiTestResults = Array.isArray(row.aiTestResults) ? row.aiTestResults : [];
  const inclusionStatus = monitorStatusLabelCn(row.inclusionMonitorStatus ?? "未检测");
  const aiMentionStatus = monitorStatusLabelCn(row.aiMentionMonitorStatus ?? "未检测");
  const aiRecommendStatus = monitorStatusLabelCn(row.aiRecommendMonitorStatus ?? "未检测");
  const linkAccess = parsePublishLinkAccess(rawJson);
  const nextAction = buildMonitoringNextAction({
    inclusionStatus,
    lastAiTestedAt: row.lastAiTestedAt,
    aiTestResults,
  });

  return mapEffectFieldsForApi({
    ...row,
    inclusionStatus,
    aiMentionStatus,
    aiRecommendStatus,
    currentSuggestion: row.currentSuggestion ?? "",
    optimizationSuggestions: Array.isArray(row.optimizationSuggestions) ? row.optimizationSuggestions : [],
    rawJson,
    aiTestResults,
    linkAccess,
    nextAction,
  });
}

export type { PublishLinkAccessSnapshot };
