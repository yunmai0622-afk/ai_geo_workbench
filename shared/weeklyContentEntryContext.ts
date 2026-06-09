/** 从问题池 / 标题卡进入内容生产页时携带的上下文（URL query） */

export type WeeklyContentEntryContext = {
  questionId?: number;
  taskId?: number;
  questionText?: string;
  selectedTitle?: string;
  sourceType?: string;
  relatedGeoGap?: string;
  articleId?: number;
  platform?: string;
  autoGenerate?: boolean;
};

export const WEEKLY_CONTENT_ENTRY_PARAM_KEYS = [
  "questionId",
  "taskId",
  "questionText",
  "selectedTitle",
  "sourceType",
  "relatedGeoGap",
  "articleId",
  "platform",
  "autoGenerate",
] as const;

const SOURCE_TYPE_LABELS: Record<string, string> = {
  ai_search: "AI搜索问题",
  search_pool: "AI搜索问题",
  question_pool: "AI搜索问题",
  diagnosis: "AI实测诊断",
  optimization_task: "内容优化任务",
  brand_source: "品牌信源建议",
};

export function resolveWeeklyContentSourceTypeLabel(sourceType?: string | null): string {
  const key = (sourceType ?? "").trim().toLowerCase();
  if (!key) return "AI搜索问题";
  return SOURCE_TYPE_LABELS[key] ?? "AI搜索问题";
}

function parsePositiveInt(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function parseWeeklyContentEntryContext(search: string): WeeklyContentEntryContext {
  const normalized = search.startsWith("?") ? search : search ? `?${search}` : "";
  if (!normalized) return {};
  const params = new URLSearchParams(normalized);
  const questionText = params.get("questionText")?.trim();
  const selectedTitle = params.get("selectedTitle")?.trim();
  const sourceType = params.get("sourceType")?.trim();
  const relatedGeoGap = params.get("relatedGeoGap")?.trim();
  const platform = params.get("platform")?.trim();
  const autoGenerate = params.get("autoGenerate") === "1" || params.get("autoGenerate") === "true";
  return {
    questionId: parsePositiveInt(params.get("questionId")),
    taskId: parsePositiveInt(params.get("taskId")),
    questionText: questionText || undefined,
    selectedTitle: selectedTitle || undefined,
    sourceType: sourceType || undefined,
    relatedGeoGap: relatedGeoGap || undefined,
    articleId: parsePositiveInt(params.get("articleId")),
    platform: platform || undefined,
    autoGenerate: autoGenerate || undefined,
  };
}

export function appendWeeklyContentEntryParams(
  baseUrl: string,
  ctx: WeeklyContentEntryContext,
): string {
  const [path, existingQuery = ""] = baseUrl.split("?");
  const params = new URLSearchParams(existingQuery);
  if (ctx.questionId != null) params.set("questionId", String(ctx.questionId));
  if (ctx.taskId != null) params.set("taskId", String(ctx.taskId));
  if (ctx.questionText?.trim()) params.set("questionText", ctx.questionText.trim());
  if (ctx.selectedTitle?.trim()) params.set("selectedTitle", ctx.selectedTitle.trim());
  if (ctx.sourceType?.trim()) params.set("sourceType", ctx.sourceType.trim());
  if (ctx.relatedGeoGap?.trim()) params.set("relatedGeoGap", ctx.relatedGeoGap.trim());
  if (ctx.articleId != null) params.set("articleId", String(ctx.articleId));
  if (ctx.platform?.trim()) params.set("platform", ctx.platform.trim());
  if (ctx.autoGenerate) params.set("autoGenerate", "1");
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function buildWeeklyContentEntryUrl(
  projectId: number,
  ctx: WeeklyContentEntryContext = {},
): string {
  return appendWeeklyContentEntryParams(`/weekly?projectId=${projectId}`, ctx);
}

export const WEEKLY_CONTENT_MISSING_QUESTION_MESSAGE =
  "当前内容缺少关联问题，请返回问题池重新选择。";

export const WEEKLY_CONTENT_ENTRY_TASK_LABEL = "生成该问题对应的平台化内容";
