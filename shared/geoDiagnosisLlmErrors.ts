import {
  diagnoseLlmProviderEnv,
  formatMissingLlmEnvServerLog,
  type LlmProviderEnvDiagnostic,
} from "./llmEnvDiagnostics";

export type GeoDiagnosisLlmErrorCode =
  | "LLM_NOT_CONFIGURED"
  | "LLM_AUTH_FAILED"
  | "LLM_RATE_LIMITED"
  | "LLM_TIMEOUT"
  | "LLM_NETWORK_ERROR"
  | "LLM_PROVIDER_ERROR"
  | "DIAGNOSIS_DATA_MISSING"
  | "NOT_LLM_ERROR";

export type GeoDiagnosisLlmErrorClassification = {
  code: GeoDiagnosisLlmErrorCode;
  userMessage: string;
  serverLog: string;
};

const MESSAGES = {
  notConfigured:
    "AI 诊断服务尚未配置。请联系管理员在部署环境配置 OPENAI_API_KEY（或 Manus 内置模型密钥）后重试。",
  authFailed: "AI 诊断服务认证失败，请联系管理员检查模型 API Key 与 OPENAI_BASE_URL。",
  rateLimited: "AI 诊断服务当前请求过多，请稍后再试。",
  timeout: "AI 诊断请求超时，请稍后重试；若持续失败请检查网络或模型服务状态。",
  network: "无法连接 AI 诊断服务，请检查服务器网络或 OPENAI_BASE_URL 是否可达。",
  provider: "AI 诊断服务返回异常，请稍后重试或联系交付人员查看服务端日志。",
  dataMissing: "诊断数据不完整，请确认已生成「指定问题」并保存企业档案后再试。",
} as const;

function truncateForLog(message: string, max = 500): string {
  const t = message.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export function classifyGeoDiagnosisLlmError(
  raw: string,
  diag?: LlmProviderEnvDiagnostic,
): GeoDiagnosisLlmErrorClassification {
  const message = raw.trim();
  const env = diag ?? diagnoseLlmProviderEnv();

  if (env.missingEnvVars.length > 0 && !message) {
    return {
      code: "LLM_NOT_CONFIGURED",
      userMessage: MESSAGES.notConfigured,
      serverLog: formatMissingLlmEnvServerLog(env.missingEnvVars),
    };
  }

  if (/OPENAI_API_KEY is not configured|BUILT_IN_FORGE_API_KEY is not configured/i.test(message)) {
    const missing = env.missingEnvVars.length > 0 ? env.missingEnvVars : env.requiredEnvVars;
    return {
      code: "LLM_NOT_CONFIGURED",
      userMessage: MESSAGES.notConfigured,
      serverLog: formatMissingLlmEnvServerLog(missing),
    };
  }

  if (/指定问题|目标客户问题|企业档案|诊断数据/i.test(message) && !/LLM|OpenAI|invoke/i.test(message)) {
    return {
      code: "DIAGNOSIS_DATA_MISSING",
      userMessage: message,
      serverLog: `诊断前置条件：${truncateForLog(message)}`,
    };
  }

  if (/status=401|status=403|\b401\b|\b403\b|unauthorized|authentication failed|invalid.*api.*key|incorrect api key/i.test(message)) {
    return {
      code: "LLM_AUTH_FAILED",
      userMessage: MESSAGES.authFailed,
      serverLog: `LLM 认证失败：${truncateForLog(message)}`,
    };
  }

  if (/status=429|\b429\b|rate.?limit|too many requests/i.test(message)) {
    return {
      code: "LLM_RATE_LIMITED",
      userMessage: MESSAGES.rateLimited,
      serverLog: `LLM 限流：${truncateForLog(message)}`,
    };
  }

  if (/OPENAI_TIMEOUT|timed out after|LLM invoke timed out|ETIMEDOUT|AbortError/i.test(message)) {
    return {
      code: "LLM_TIMEOUT",
      userMessage: MESSAGES.timeout,
      serverLog: `LLM 超时：${truncateForLog(message)}`,
    };
  }

  if (/OpenAI LLM network failure|network failure|ECONNREFUSED|ENOTFOUND|ECONNRESET|fetch failed|UND_ERR/i.test(message)) {
    return {
      code: "LLM_NETWORK_ERROR",
      userMessage: MESSAGES.network,
      serverLog: `LLM 网络不可达：${truncateForLog(message)}`,
    };
  }

  if (/LLM invoke failed|OpenAI LLM invoke failed|invoke failed|非 JSON|AI 未返回有效正文/i.test(message)) {
    return {
      code: "LLM_PROVIDER_ERROR",
      userMessage: MESSAGES.provider,
      serverLog: `LLM 提供方错误：${truncateForLog(message)}`,
    };
  }

  if (/timeout|timed out|network|ECONN|ETIMEDOUT/i.test(message)) {
    return {
      code: "LLM_TIMEOUT",
      userMessage: MESSAGES.timeout,
      serverLog: `LLM 超时（兜底）：${truncateForLog(message)}`,
    };
  }

  return {
    code: "NOT_LLM_ERROR",
    userMessage: message || MESSAGES.provider,
    serverLog: message ? truncateForLog(message) : "非 LLM 分类错误",
  };
}

export function assertLlmConfiguredForDiagnosis(): GeoDiagnosisLlmErrorClassification | null {
  const env = diagnoseLlmProviderEnv();
  if (env.configured) return null;
  return classifyGeoDiagnosisLlmError("", env);
}
