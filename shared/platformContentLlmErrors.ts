import {
  diagnoseLlmProviderEnv,
  formatMissingLlmEnvServerLog,
  type LlmProviderEnvDiagnostic,
} from "./llmEnvDiagnostics";

const PLATFORM_CONTENT_AI_UNAVAILABLE_MESSAGE =
  "AI 内容生成服务暂时不可用，请稍后重试。";

export const PLATFORM_CONTENT_AI_NOT_CONFIGURED_MESSAGE =
  "AI 内容生成服务暂时未配置，请联系管理员。";

export const PLATFORM_CONTENT_AI_AUTH_FAILED_MESSAGE =
  "AI 内容生成服务认证失败，请联系管理员检查模型配置。";

export const PLATFORM_CONTENT_AI_RATE_LIMIT_MESSAGE = "AI 内容生成服务繁忙，请稍后重试。";

export const PLATFORM_CONTENT_AI_TIMEOUT_MESSAGE = "AI 内容生成超时，请稍后重试。";

export type PlatformContentLlmErrorCode =
  | "not_configured"
  | "auth_failed"
  | "rate_limit"
  | "timeout"
  | "network"
  | "provider_error"
  | "not_llm_error";

export type PlatformContentLlmErrorClassification = {
  code: PlatformContentLlmErrorCode;
  userMessage: string | null;
  serverLog: string;
};

function truncateForLog(message: string, max = 500): string {
  const t = message.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export function classifyPlatformContentLlmError(
  raw: string,
  diag?: LlmProviderEnvDiagnostic,
): PlatformContentLlmErrorClassification {
  const message = raw.trim();
  const env = diag ?? diagnoseLlmProviderEnv();

  if (/OPENAI_API_KEY is not configured|BUILT_IN_FORGE_API_KEY is not configured/i.test(message)) {
    const missing = env.missingEnvVars.length > 0 ? env.missingEnvVars : env.requiredEnvVars;
    return {
      code: "not_configured",
      userMessage: PLATFORM_CONTENT_AI_NOT_CONFIGURED_MESSAGE,
      serverLog: formatMissingLlmEnvServerLog(missing),
    };
  }

  if (
    /status=401|status=403|\b401\b|\b403\b|unauthorized|authentication failed|invalid.*api.*key|incorrect api key|api key/i.test(
      message,
    )
  ) {
    return {
      code: "auth_failed",
      userMessage: PLATFORM_CONTENT_AI_AUTH_FAILED_MESSAGE,
      serverLog: `LLM 认证失败：${truncateForLog(message)}`,
    };
  }

  if (/status=429|\b429\b|rate.?limit|too many requests/i.test(message)) {
    return {
      code: "rate_limit",
      userMessage: PLATFORM_CONTENT_AI_RATE_LIMIT_MESSAGE,
      serverLog: `LLM 限流：${truncateForLog(message)}`,
    };
  }

  if (/OPENAI_TIMEOUT|timed out after|LLM invoke timed out|ETIMEDOUT|AbortError/i.test(message)) {
    return {
      code: "timeout",
      userMessage: PLATFORM_CONTENT_AI_TIMEOUT_MESSAGE,
      serverLog: `LLM 超时：${truncateForLog(message)}`,
    };
  }

  if (
    /OpenAI LLM network failure|network failure|ECONNREFUSED|ENOTFOUND|ECONNRESET|fetch failed/i.test(
      message,
    )
  ) {
    return {
      code: "network",
      userMessage: PLATFORM_CONTENT_AI_UNAVAILABLE_MESSAGE,
      serverLog: `LLM 网络不可达：${truncateForLog(message)}`,
    };
  }

  if (/LLM invoke failed|OpenAI LLM invoke failed|invoke failed|非 JSON|AI 未返回有效正文|GEO 文章生成失败/.test(message)) {
    return {
      code: "provider_error",
      userMessage: PLATFORM_CONTENT_AI_UNAVAILABLE_MESSAGE,
      serverLog: `LLM 调用失败：${truncateForLog(message)}`,
    };
  }

  if (!env.configured) {
    const missing = env.missingEnvVars.length > 0 ? env.missingEnvVars : env.requiredEnvVars;
    return {
      code: "not_configured",
      userMessage: PLATFORM_CONTENT_AI_NOT_CONFIGURED_MESSAGE,
      serverLog: formatMissingLlmEnvServerLog(missing),
    };
  }

  return { code: "not_llm_error", userMessage: null, serverLog: "" };
}
