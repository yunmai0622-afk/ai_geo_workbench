/** GEO-V1.1-Effect-Prediction：加入发布队列后的静态效果预期说明（非动态预测） */

export const PUBLISH_EFFECT_PREDICTION_LINE_INDEXING =
  "发布后预计7-14天AI平台开始收录。";
export const PUBLISH_EFFECT_PREDICTION_LINE_RETEST =
  "建议发布后第7天和第14天各执行一次复测。";
export const PUBLISH_EFFECT_PREDICTION_LINE_MULTI_PLATFORM =
  "多平台同时发布效果更好。";

export const PUBLISH_EFFECT_PREDICTION_LINES = [
  PUBLISH_EFFECT_PREDICTION_LINE_INDEXING,
  PUBLISH_EFFECT_PREDICTION_LINE_RETEST,
  PUBLISH_EFFECT_PREDICTION_LINE_MULTI_PLATFORM,
] as const;

/** 客户可读的多行说明（toast、弹窗等共用） */
export function formatPublishEffectPrediction(): string {
  return PUBLISH_EFFECT_PREDICTION_LINES.join("\n");
}
