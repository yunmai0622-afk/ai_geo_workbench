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
  [key: string]: unknown;
};

export function mapInclusionMonitoringRecordForApi<T extends InclusionMonitoringDbRow>(row: T) {
  return {
    ...row,
    inclusionStatus: row.inclusionMonitorStatus ?? "未检测",
    aiMentionStatus: row.aiMentionMonitorStatus ?? "未检测",
    aiRecommendStatus: row.aiRecommendMonitorStatus ?? "未检测",
    currentSuggestion: row.currentSuggestion ?? "",
    optimizationSuggestions: Array.isArray(row.optimizationSuggestions) ? row.optimizationSuggestions : [],
    rawJson: row.rawJson && typeof row.rawJson === "object" ? row.rawJson : {},
    aiTestResults: Array.isArray(row.aiTestResults) ? row.aiTestResults : [],
  };
}
