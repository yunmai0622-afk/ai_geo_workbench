/** 将客户可见文案中的工程 ID 标记替换为中文描述 */

const SPECIFIC_ENGINEERING_ID_REPLACEMENTS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\[?source-graph:\d+\]?/gi, label: "来自信源图谱建议" },
  { pattern: /\[?optimization_task:\d+\]?/gi, label: "来自优化任务" },
  { pattern: /\[?article:\d+\]?/gi, label: "关联内容" },
  { pattern: /\[?taskId:\d+\]?/gi, label: "来自优化任务" },
  { pattern: /\[?questionId:\d+\]?/gi, label: "来自AI搜索问题" },
];

const GENERIC_ENGINEERING_ID_PATTERN = /\b[a-z][a-z0-9_-]*:\d+\b/gi;

function dedupeAdjacentLabels(text: string): string {
  return text.replace(/(来自[^；，。\s]+)(?:\s+\1)+/g, "$1");
}

export function sanitizeCustomerFacingEngineeringIds(text?: string | null): string {
  const trimmed = text?.trim();
  if (!trimmed) return "";

  let result = trimmed;
  for (const { pattern, label } of SPECIFIC_ENGINEERING_ID_REPLACEMENTS) {
    result = result.replace(pattern, label);
  }
  result = result.replace(GENERIC_ENGINEERING_ID_PATTERN, "来自AI诊断");
  result = result.replace(/\s{2,}/g, " ").trim();
  result = dedupeAdjacentLabels(result);
  return result;
}

export function resolveEngineeringSourceLabel(text?: string | null): string | null {
  const raw = text ?? "";
  if (/source-graph:\d+/i.test(raw)) return "来自信源图谱建议";
  if (/optimization_task:\d+/i.test(raw)) return "来自优化任务";
  if (/article:\d+/i.test(raw)) return "关联内容";
  if (/taskId:\d+/i.test(raw)) return "来自优化任务";
  if (/questionId:\d+/i.test(raw)) return "来自AI搜索问题";
  if (GENERIC_ENGINEERING_ID_PATTERN.test(raw)) return "来自AI诊断";
  return null;
}
