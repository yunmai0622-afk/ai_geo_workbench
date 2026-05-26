/** 平台化内容生成 — 用户可见错误文案（禁止透出 SQL / 堆栈 / 内部字段） */

export const PLATFORM_CONTENT_PROFILE_INSUFFICIENT_MESSAGE =
  "企业资料不足，暂时无法生成内容。请先完善企业介绍、产品服务和目标问题后再重试。";

export const PLATFORM_CONTENT_PARAMS_MISSING_MESSAGE =
  "请选择目标平台和内容类型后再生成。";

export const PLATFORM_CONTENT_AI_UNAVAILABLE_MESSAGE =
  "AI 内容生成服务暂时不可用，请稍后重试。";

export const PLATFORM_CONTENT_PROJECT_ACCESS_MESSAGE =
  "当前企业项目不存在或无访问权限，请重新进入项目后再试。";

export const PLATFORM_CONTENT_DIAGNOSIS_BASIS_MESSAGE =
  "请先完成 AI 内容诊断并生成优化任务，再生成平台化内容。";

const INTERNAL_MARKERS = [
  "failed query",
  "insert into",
  "sqlstate",
  "drizzle",
  "stack trace",
  "at /",
  "owneruserid",
  "params:",
] as const;

function looksInternal(message: string): boolean {
  const lower = message.trim().toLowerCase();
  return INTERNAL_MARKERS.some(marker => lower.includes(marker));
}

function isProfileInsufficientRaw(message: string): boolean {
  return /企业资料还缺少|企业资料不足/.test(message);
}

function isDiagnosisBasisRaw(message: string): boolean {
  return /缺少生成依据|客户指定问题|内容缺口|优化任务|AI 未推荐原因|竞品差距|企业 GEO 资产库/.test(message);
}

function isAiFailureRaw(message: string): boolean {
  return /LLM|invoke failed|network failure|timed out|timeout|OPENAI|非 JSON|AI 未返回|GEO 文章生成失败|文章缺少 GEO 可收录结构/.test(
    message,
  );
}

function isParamsMissingRaw(message: string): boolean {
  return /请选择目标发布平台|请选择内容类型|请填写目标问题|请选择 GEO 增强目标|请选择目标 AI 平台|请选择账号身份/.test(
    message,
  );
}

function isProjectAccessRaw(message: string): boolean {
  return /项目不存在|无访问权限|NOT_FOUND|文章选题不存在|FORBIDDEN/.test(message);
}

/** 将服务端/逻辑层原始错误映射为客户可读提示 */
export function toPlatformContentGenerationError(raw: string): string {
  const message = raw.trim();
  if (!message) return PLATFORM_CONTENT_AI_UNAVAILABLE_MESSAGE;
  if (looksInternal(message)) return PLATFORM_CONTENT_AI_UNAVAILABLE_MESSAGE;
  if (message === PLATFORM_CONTENT_PROFILE_INSUFFICIENT_MESSAGE) return message;
  if (message === PLATFORM_CONTENT_PARAMS_MISSING_MESSAGE) return message;
  if (message === PLATFORM_CONTENT_PROJECT_ACCESS_MESSAGE) return message;
  if (message === PLATFORM_CONTENT_AI_UNAVAILABLE_MESSAGE) return message;
  if (isProjectAccessRaw(message)) return PLATFORM_CONTENT_PROJECT_ACCESS_MESSAGE;
  if (isParamsMissingRaw(message)) return PLATFORM_CONTENT_PARAMS_MISSING_MESSAGE;
  if (isProfileInsufficientRaw(message)) return message;
  if (isDiagnosisBasisRaw(message)) return PLATFORM_CONTENT_DIAGNOSIS_BASIS_MESSAGE;
  if (isAiFailureRaw(message)) return PLATFORM_CONTENT_AI_UNAVAILABLE_MESSAGE;
  if (message.length > 120) return PLATFORM_CONTENT_AI_UNAVAILABLE_MESSAGE;
  return message;
}
