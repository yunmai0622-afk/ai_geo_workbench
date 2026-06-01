/** 平台化内容生成 — 用户可见错误文案（禁止透出 SQL / 堆栈 / 内部字段） */

import { classifyPlatformContentLlmError } from "./platformContentLlmErrors";
import { diagnoseLlmProviderEnv } from "./llmEnvDiagnostics";
import {
  PLATFORM_CONTENT_NO_AI_DIAGNOSIS_MESSAGE,
  PLATFORM_CONTENT_NO_OPTIMIZATION_TASKS_MESSAGE,
  PLATFORM_CONTENT_NO_PLATFORM_TASK_MESSAGE,
  PLATFORM_CONTENT_STALE_TOPICS_MESSAGE,
  PLATFORM_CONTENT_TOPIC_UNBOUND_MESSAGE,
} from "./platformContentDiagnosisGate";

export {
  PLATFORM_CONTENT_NO_AI_DIAGNOSIS_MESSAGE,
  PLATFORM_CONTENT_NO_OPTIMIZATION_TASKS_MESSAGE,
  PLATFORM_CONTENT_NO_PLATFORM_TASK_MESSAGE,
  PLATFORM_CONTENT_STALE_TOPICS_MESSAGE,
  PLATFORM_CONTENT_TOPIC_UNBOUND_MESSAGE,
};

export const PLATFORM_CONTENT_PROFILE_INSUFFICIENT_MESSAGE =
  "企业资料不足，暂时无法生成内容。请先完善企业介绍、产品服务和目标问题后再重试。";

export const PLATFORM_CONTENT_PARAMS_MISSING_MESSAGE =
  "请选择目标平台和内容类型后再生成。";

export {
  PLATFORM_CONTENT_AI_NOT_CONFIGURED_MESSAGE,
  PLATFORM_CONTENT_AI_AUTH_FAILED_MESSAGE,
  PLATFORM_CONTENT_AI_RATE_LIMIT_MESSAGE,
  PLATFORM_CONTENT_AI_TIMEOUT_MESSAGE,
} from "./platformContentLlmErrors";

export const PLATFORM_CONTENT_AI_UNAVAILABLE_MESSAGE =
  "AI 内容生成服务暂时不可用，请稍后重试。";

export const PLATFORM_CONTENT_GEO_STRUCTURE_OPTIMIZING_MESSAGE =
  "内容正在优化中，请稍候重试";

export const PLATFORM_CONTENT_QC_MANUAL_REVIEW_MESSAGE =
  "内容已生成，建议人工检查后再发布";

export const PLATFORM_CONTENT_PROJECT_ACCESS_MESSAGE =
  "当前企业项目不存在或无访问权限，请重新进入项目后再试。";

/** @deprecated 保留常量兼容；新代码请使用 diagnosis gate 分场景文案 */
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

function isAiFailureRaw(message: string): boolean {
  return classifyPlatformContentLlmError(message).code !== "not_llm_error";
}

function isParamsMissingRaw(message: string): boolean {
  return /请选择目标发布平台|请选择内容类型|请填写目标问题|请选择 GEO 增强目标|请选择目标 AI 平台|请选择账号身份/.test(
    message,
  );
}

function isProjectAccessRaw(message: string): boolean {
  return /项目不存在|无访问权限|NOT_FOUND|文章选题不存在|FORBIDDEN/.test(message);
}

function mapDiagnosisGateRaw(message: string): string | null {
  if (/请先完成 AI 实测诊断|请先完成 AI 语义分析|缺少 AI 分析结果|没有诊断结果|未运行内容诊断/.test(message)) {
    return PLATFORM_CONTENT_NO_AI_DIAGNOSIS_MESSAGE;
  }
  if (
    /还没有生成内容优化任务|请先生成优化任务|缺少优化任务，不能生成内容选题|请先完成内容诊断并生成优化任务|再生成优化任务/.test(
      message,
    )
  ) {
    return PLATFORM_CONTENT_NO_OPTIMIZATION_TASKS_MESSAGE;
  }
  if (/内容选题与当前优化任务|内容选题已过期|选题与当前优化任务不一致/.test(message)) {
    return PLATFORM_CONTENT_STALE_TOPICS_MESSAGE;
  }
  if (/文章选题必须绑定优化任务|选题未绑定优化任务|不能生成无来源文章/.test(message)) {
    return PLATFORM_CONTENT_TOPIC_UNBOUND_MESSAGE;
  }
  if (/当前平台暂无可用生成任务|当前平台暂无/.test(message)) {
    return PLATFORM_CONTENT_NO_PLATFORM_TASK_MESSAGE;
  }
  if (message === PLATFORM_CONTENT_NO_AI_DIAGNOSIS_MESSAGE) return message;
  if (message === PLATFORM_CONTENT_NO_OPTIMIZATION_TASKS_MESSAGE) return message;
  if (message === PLATFORM_CONTENT_STALE_TOPICS_MESSAGE) return message;
  if (message === PLATFORM_CONTENT_TOPIC_UNBOUND_MESSAGE) return message;
  if (message === PLATFORM_CONTENT_NO_PLATFORM_TASK_MESSAGE) return message;
  return null;
}

function mapGeoStructureValidationRaw(message: string): string | null {
  if (!/文章缺少 GEO 可收录结构|生成的内容未通过 GEO 结构校验|GEO 结构校验/.test(message)) {
    return null;
  }
  return PLATFORM_CONTENT_GEO_STRUCTURE_OPTIMIZING_MESSAGE;
}

function mapGenerationBasisRaw(message: string): string | null {
  const match = message.match(/^缺少生成依据：([^，]+)/);
  if (!match) return null;
  const missingPart = match[1]?.trim() ?? "";
  if (!missingPart) return null;
  const labels = missingPart.split("、").map(s => s.trim()).filter(Boolean);
  if (labels.length === 0) return null;
  return `生成依据还缺少：${labels.join("、")}。请补齐诊断缺口或优化任务后再试。`;
}

/** 将服务端/逻辑层原始错误映射为客户可读提示 */
export function toPlatformContentGenerationError(raw: string): string {
  const message = raw.trim();
  if (!message) {
    const env = diagnoseLlmProviderEnv();
    if (!env.configured) {
      return classifyPlatformContentLlmError("", env).userMessage ?? PLATFORM_CONTENT_AI_UNAVAILABLE_MESSAGE;
    }
    return PLATFORM_CONTENT_AI_UNAVAILABLE_MESSAGE;
  }
  if (looksInternal(message)) return PLATFORM_CONTENT_AI_UNAVAILABLE_MESSAGE;
  if (message === PLATFORM_CONTENT_PROFILE_INSUFFICIENT_MESSAGE) return message;
  if (message === PLATFORM_CONTENT_PARAMS_MISSING_MESSAGE) return message;
  if (message === PLATFORM_CONTENT_PROJECT_ACCESS_MESSAGE) return message;
  if (message === PLATFORM_CONTENT_AI_UNAVAILABLE_MESSAGE) return message;
  if (isProjectAccessRaw(message)) return PLATFORM_CONTENT_PROJECT_ACCESS_MESSAGE;
  if (isParamsMissingRaw(message)) return PLATFORM_CONTENT_PARAMS_MISSING_MESSAGE;
  if (isProfileInsufficientRaw(message)) return message;

  const gateMessage = mapDiagnosisGateRaw(message);
  if (gateMessage) return gateMessage;

  const basisMessage = mapGenerationBasisRaw(message);
  if (basisMessage) return basisMessage;

  const structureMessage = mapGeoStructureValidationRaw(message);
  if (structureMessage) return structureMessage;

  const llmClassified = classifyPlatformContentLlmError(message);
  if (llmClassified.userMessage) return llmClassified.userMessage;

  if (isAiFailureRaw(message)) return PLATFORM_CONTENT_AI_UNAVAILABLE_MESSAGE;
  if (message.length > 120) return PLATFORM_CONTENT_AI_UNAVAILABLE_MESSAGE;
  return message;
}
