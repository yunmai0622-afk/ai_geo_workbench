/** 客户可见文案中的数据来源标签（禁止暴露数据库表名或工程字段） */

export const CUSTOMER_DATA_SOURCE_AI_TEST = "AI 实测结果";
export const CUSTOMER_DATA_SOURCE_PUBLISH_TASKS = "发布任务数据";

const ENGINEERING_TABLE_NAME_RE =
  /\b(ai_test_runs|publish_tasks|rewritePool|rewriteQueue|generationBasis|sourceType)\b/gi;

export function sanitizeCustomerFacingDataSourceLabel(text?: string | null): string {
  const trimmed = text?.trim();
  if (!trimmed) return "";

  return trimmed
    .replace(/\b数据来源\s*[:：]\s*ai_test_runs\b/gi, `数据来源：${CUSTOMER_DATA_SOURCE_AI_TEST}`)
    .replace(/\b数据来源\s*[:：]\s*publish_tasks\b/gi, `数据来源：${CUSTOMER_DATA_SOURCE_PUBLISH_TASKS}`)
    .replace(/基于本项目的发布任务\s*[（(]\s*publish_tasks\s*[）)]/gi, "基于本项目的发布任务数据")
    .replace(ENGINEERING_TABLE_NAME_RE, match => {
      const lower = match.toLowerCase();
      if (lower === "ai_test_runs") return CUSTOMER_DATA_SOURCE_AI_TEST;
      if (lower === "publish_tasks") return CUSTOMER_DATA_SOURCE_PUBLISH_TASKS;
      if (lower === "rewritepool" || lower === "rewritequeue") return "内容优化队列";
      if (lower === "generationbasis") return "生成依据";
      if (lower === "sourcetype") return "内容来源";
      return match;
    })
    .replace(/\s{2,}/g, " ")
    .trim();
}
