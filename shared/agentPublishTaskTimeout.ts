/** Local Agent 领取后长时间无回传则视为超时（GEO-V1.1-AgentTaskFix） */
export const AGENT_PROCESSING_TIMEOUT_MINUTES = 30;

export const AGENT_PROCESSING_TIMEOUT_MS = AGENT_PROCESSING_TIMEOUT_MINUTES * 60 * 1000;

export const AGENT_PROCESSING_TIMEOUT_ERROR_TYPE = "agent_timeout";

export function agentProcessingTimeoutMessage(): string {
  return `处理超过 ${AGENT_PROCESSING_TIMEOUT_MINUTES} 分钟未结束，已自动标记为失败，可在 GEO Web 发布中心重试`;
}
