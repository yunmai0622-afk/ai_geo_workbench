export const initialMonitoringSuggestions = [
  "等待搜索引擎抓取后执行首次人工收录检测。",
  "用原始客户问题复测 AI 是否提及品牌。",
  "若未收录，优先增强标题、摘要、FAQ 和内部入口。",
  "若 AI 未提及，补充企业实体信息、竞品差异和 AI 可引用片段。",
];

export function buildInitialInclusionMonitoringRecord(input: {
  projectId: number;
  articleId: number;
  publishRecordId: number;
  publicUrl: string;
  qualityScore: number;
}) {
  return {
    projectId: input.projectId,
    articleId: input.articleId,
    publishRecordId: input.publishRecordId,
    publicUrl: input.publicUrl,
    inclusionStatus: "未检测" as const,
    aiMentionStatus: "未检测" as const,
    aiRecommendStatus: "未检测" as const,
    currentSuggestion: "已发布文章已进入收录监测，当前状态为未检测；下一步需要人工或后续复测流程确认收录、AI 提及和 AI 推荐情况。",
    optimizationSuggestions: initialMonitoringSuggestions,
    rawJson: {
      source: "publish_geo_content_page",
      qualityScore: input.qualityScore,
      needRetest: true,
      createdBy: "geo.articles.publish",
    },
  };
}
