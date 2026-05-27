/** 无真实平台原始回答时的占位前缀；禁止写入 `ai_test_runs.rawAnswer`。 */
export const GEO_SYNTHETIC_AI_RESPONSE_PREFIX = "【系统自动】";

export function isSyntheticGeoRawAnswer(rawAnswer: string): boolean {
  return rawAnswer.trim().startsWith(GEO_SYNTHETIC_AI_RESPONSE_PREFIX);
}
