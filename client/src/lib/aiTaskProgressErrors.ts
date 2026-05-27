import {
  AI_TASK_ERROR_CATEGORY_LABELS,
  AI_TASK_ERROR_NEXT_STEP,
  type AiTaskProgressErrorCategory,
} from "@shared/aiTaskProgress";
import { classifyGeoDiagnosisLlmError } from "@shared/geoDiagnosisLlmErrors";
import { classifyPlatformContentLlmError } from "@shared/platformContentLlmErrors";

export function mapGeoDiagnosisErrorCategory(raw: string): AiTaskProgressErrorCategory {
  const c = classifyGeoDiagnosisLlmError(raw);
  switch (c.code) {
    case "LLM_NOT_CONFIGURED":
      return "not_configured";
    case "LLM_AUTH_FAILED":
      return "auth_failed";
    case "LLM_RATE_LIMITED":
      return "rate_limit";
    case "LLM_TIMEOUT":
      return "timeout";
    case "LLM_NETWORK_ERROR":
      return "network";
    case "LLM_PROVIDER_ERROR":
      return "provider_error";
    case "DIAGNOSIS_DATA_MISSING":
      return "data_missing";
    default:
      return "unknown";
  }
}

export function mapPlatformContentErrorCategory(raw: string): AiTaskProgressErrorCategory {
  const c = classifyPlatformContentLlmError(raw);
  switch (c.code) {
    case "not_configured":
      return "not_configured";
    case "auth_failed":
      return "auth_failed";
    case "rate_limit":
      return "rate_limit";
    case "timeout":
      return "timeout";
    case "network":
      return "network";
    case "provider_error":
      return "provider_error";
    default:
      return "unknown";
  }
}

export function formatAiTaskProgressFailure(
  category: AiTaskProgressErrorCategory,
  detailMessage: string,
): { categoryLabel: string; message: string; nextStep: string } {
  const categoryLabel = AI_TASK_ERROR_CATEGORY_LABELS[category];
  const nextStep = AI_TASK_ERROR_NEXT_STEP[category];
  const message = detailMessage.trim() || categoryLabel;
  return { categoryLabel, message, nextStep };
}
