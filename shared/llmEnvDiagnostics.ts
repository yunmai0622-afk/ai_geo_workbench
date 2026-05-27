/** LLM provider 环境变量诊断（平台化内容生成 / 文章正文生成共用） */

export type LlmProviderEnvDiagnostic = {
  provider: string;
  model: string;
  requiredEnvVars: string[];
  optionalEnvVars: string[];
  missingEnvVars: string[];
  configured: boolean;
};

export function getLlmProviderName(): string {
  const raw = (process.env.LLM_PROVIDER ?? "openai").trim();
  return raw || "openai";
}

export function getLlmModelName(): string {
  const provider = getLlmProviderName();
  if (provider === "manus") return "gemini-2.5-flash";
  return process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
}

export function getRequiredLlmEnvVars(): string[] {
  const provider = getLlmProviderName();
  if (provider === "manus") return ["BUILT_IN_FORGE_API_KEY"];
  return ["OPENAI_API_KEY"];
}

export function getOptionalLlmEnvVars(): string[] {
  const provider = getLlmProviderName();
  if (provider === "manus") return ["BUILT_IN_FORGE_API_URL"];
  return ["OPENAI_BASE_URL", "OPENAI_MODEL", "OPENAI_TIMEOUT_MS", "OPENAI_CHAT_COMPLETIONS_PATH"];
}

export function diagnoseLlmProviderEnv(): LlmProviderEnvDiagnostic {
  const provider = getLlmProviderName();
  const requiredEnvVars = getRequiredLlmEnvVars();
  const missingEnvVars = requiredEnvVars.filter(name => !process.env[name]?.trim());
  return {
    provider,
    model: getLlmModelName(),
    requiredEnvVars,
    optionalEnvVars: getOptionalLlmEnvVars(),
    missingEnvVars,
    configured: missingEnvVars.length === 0,
  };
}

export function formatMissingLlmEnvServerLog(missingEnvVars: string[]): string {
  if (missingEnvVars.length === 0) return "";
  return `缺少 LLM 环境变量：${missingEnvVars.join("、")}`;
}
