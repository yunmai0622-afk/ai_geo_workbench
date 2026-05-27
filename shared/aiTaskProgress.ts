/** AI 长任务阶段进度（诊断 / 平台内容生成）— 客户可见文案与阶段定义 */

export type AiTaskProgressStage = {
  percent: number;
  label: string;
};

export const AI_DIAGNOSIS_PROGRESS_STAGES: AiTaskProgressStage[] = [
  { percent: 10, label: "读取企业资料" },
  { percent: 20, label: "生成目标问题" },
  { percent: 35, label: "准备 AI 诊断请求" },
  { percent: 55, label: "调用模型分析" },
  { percent: 70, label: "整理诊断结论" },
  { percent: 85, label: "生成优化任务" },
  { percent: 95, label: "保存诊断结果" },
  { percent: 100, label: "完成" },
];

export const PLATFORM_CONTENT_PROGRESS_STAGES: AiTaskProgressStage[] = [
  { percent: 10, label: "读取企业资料与诊断结果" },
  { percent: 25, label: "确认平台内容策略" },
  { percent: 40, label: "生成标题与结构" },
  { percent: 65, label: "生成正文内容" },
  { percent: 80, label: "执行内容质检" },
  { percent: 90, label: "保存内容记录" },
  { percent: 100, label: "完成" },
];

export const AI_DIAGNOSIS_PROGRESS_HINT_30S =
  "模型分析耗时较长，请保持页面打开，系统仍在处理。";

export const AI_DIAGNOSIS_PROGRESS_HINT_60S =
  "本次诊断耗时较长，可能是模型服务繁忙。你可以继续等待或稍后重试。";

export const PLATFORM_CONTENT_PROGRESS_HINT_30S =
  "内容生成需要调用模型，当前仍在处理，请稍候。";

export const PLATFORM_CONTENT_PROGRESS_HINT_60S =
  "本次内容生成耗时较长，可能是模型服务繁忙。请继续等待或稍后重试。";

export const AI_TASK_PROGRESS_KEEP_OPEN_HINT = "模型服务正在处理，请保持页面打开。";

/** 请求未完成时进度条允许的最大百分比 */
export const AI_TASK_PROGRESS_MAX_INCOMPLETE = 95;

export function clampIncompleteProgressPercent(percent: number, max = AI_TASK_PROGRESS_MAX_INCOMPLETE): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(max, Math.max(0, Math.round(percent)));
}

export function formatElapsedSeconds(elapsedMs: number): number {
  return Math.max(0, Math.floor(elapsedMs / 1000));
}

export function pickTimedOptimisticStage(
  stages: AiTaskProgressStage[],
  elapsedMs: number,
  maxPercent: number,
): AiTaskProgressStage {
  const capped = clampIncompleteProgressPercent(maxPercent);
  const eligible = stages.filter(s => s.percent <= capped && s.percent < 100);
  if (eligible.length === 0) return stages[0]!;
  const seconds = formatElapsedSeconds(elapsedMs);
  const index = Math.min(eligible.length - 1, Math.floor(seconds / 8));
  return eligible[index]!;
}

export type AiTaskProgressErrorCategory =
  | "not_configured"
  | "auth_failed"
  | "rate_limit"
  | "timeout"
  | "network"
  | "provider_error"
  | "data_missing"
  | "unknown";

export const AI_TASK_ERROR_CATEGORY_LABELS: Record<AiTaskProgressErrorCategory, string> = {
  not_configured: "未配置模型",
  auth_failed: "认证失败",
  rate_limit: "模型限流",
  timeout: "模型超时",
  network: "网络错误",
  provider_error: "服务商错误",
  data_missing: "诊断数据不完整",
  unknown: "处理失败",
};

export const AI_TASK_ERROR_NEXT_STEP: Record<AiTaskProgressErrorCategory, string> = {
  not_configured: "请联系管理员配置模型 API 后重试。",
  auth_failed: "请联系管理员检查 API Key 与接入地址。",
  rate_limit: "请等待 1～2 分钟后重试。",
  timeout: "请保持页面打开继续等待，或稍后点击重试。",
  network: "请检查网络连接后重试。",
  provider_error: "请稍后重试；若持续失败请联系交付人员。",
  data_missing: "请先完善企业档案与「指定问题」后再运行诊断。",
  unknown: "请稍后重试；若仍失败请联系交付人员。",
};
