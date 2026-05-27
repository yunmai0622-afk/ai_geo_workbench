/** 目标 AI 平台可见度配置（内容策略 / 诊断 Prompt / 交付报告） */

export type AiVisibilityTargetStatus = "tested" | "enhancement" | "not_connected";

export type AiVisibilityTargetDef = {
  id: string;
  label: string;
  status: AiVisibilityTargetStatus;
};

export const AI_VISIBILITY_TARGET_REGISTRY = [
  { id: "doubao", label: "豆包", status: "tested" },
  { id: "kimi", label: "Kimi", status: "tested" },
  { id: "deepseek", label: "DeepSeek", status: "tested" },
  { id: "yuanbao", label: "腾讯元宝", status: "enhancement" },
  { id: "wenxin", label: "文心一言", status: "enhancement" },
  { id: "qwen", label: "通义千问", status: "enhancement" },
  { id: "metaso", label: "秘塔 AI 搜索", status: "enhancement" },
  { id: "so360", label: "360 AI 搜索", status: "enhancement" },
  { id: "spark", label: "讯飞星火", status: "enhancement" },
  { id: "chatgpt", label: "ChatGPT", status: "not_connected" },
  { id: "perplexity", label: "Perplexity", status: "not_connected" },
] as const satisfies readonly AiVisibilityTargetDef[];

export type AiVisibilityTargetId = (typeof AI_VISIBILITY_TARGET_REGISTRY)[number]["id"];

/** 前端可选（不含未接入） */
export const AI_SEARCH_PLATFORM_OPTIONS: readonly string[] = AI_VISIBILITY_TARGET_REGISTRY.filter(
  p => p.status !== "not_connected",
).map(p => p.label);

export type AiSearchPlatform = string;

const LABEL_SET = new Set<string>(AI_SEARCH_PLATFORM_OPTIONS);

const LEGACY_LABEL_ALIASES: Record<string, string> = {
  通义: "通义千问",
  文心: "文心一言",
  Qwen: "通义千问",
  "360AI搜索": "360 AI 搜索",
  秘塔: "秘塔 AI 搜索",
};

export function getAiVisibilityTargetByLabel(label: string): AiVisibilityTargetDef | undefined {
  return AI_VISIBILITY_TARGET_REGISTRY.find(p => p.label === label);
}

export function getDefaultTargetAiPlatforms(): string[] {
  return AI_VISIBILITY_TARGET_REGISTRY.filter(
    p => p.status === "tested" || p.status === "enhancement",
  ).map(p => p.label);
}

/** 兼容旧数据：仅 doubao/kimi/deepseek 或历史别名 */
export function normalizeTargetAiPlatforms(input: unknown): string[] {
  if (!Array.isArray(input)) return getDefaultTargetAiPlatforms();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const label = LEGACY_LABEL_ALIASES[trimmed] ?? trimmed;
    if (LABEL_SET.has(label) && !out.includes(label)) out.push(label);
  }
  return out.length ? out : getDefaultTargetAiPlatforms();
}

export function aiVisibilityTargetStatusLabel(status: AiVisibilityTargetStatus): string {
  if (status === "tested") return "已实测";
  if (status === "enhancement") return "增强目标";
  return "未接入";
}

export function formatTargetAiPlatformsForPrompt(platforms: string[]): string {
  const normalized = normalizeTargetAiPlatforms(platforms);
  const lines = normalized.map(label => {
    const meta = getAiVisibilityTargetByLabel(label);
    const status = meta?.status ?? "enhancement";
    const tag =
      status === "tested"
        ? "已实测引擎"
        : status === "enhancement"
          ? "可见度增强目标（系统未对该平台做真实检测）"
          : "未接入";
    return `- ${label}：${tag}`;
  });
  return [
    "【目标 AI 平台（可见度增强）】",
    "选择希望提升品牌可见度的 AI 搜索/问答平台。系统会围绕这些平台的搜索与问答场景组织问题、关键词和内容资产。",
    "状态说明：「已实测」表示本系统真实跑过检测引擎；「可见度增强目标」仅用于内容生成与 GEO 优化，不表示已完成该平台真实检测；不得将增强目标伪装为已实测。",
    ...lines,
  ].join("\n");
}

export function formatTargetAiVisibilityReportSection(platforms?: string[]): string {
  const normalized = normalizeTargetAiPlatforms(platforms ?? []);
  const tested = normalized.filter(l => getAiVisibilityTargetByLabel(l)?.status === "tested");
  const enhancement = normalized.filter(l => getAiVisibilityTargetByLabel(l)?.status === "enhancement");
  return [
    "### 目标 AI 平台（可见度增强）",
    tested.length ? `已实测引擎：${tested.join("、")}。` : "已实测引擎：豆包、Kimi、DeepSeek（默认）。",
    enhancement.length
      ? `可见度增强目标（内容/关键词优化方向，非本报告逐平台实测结论）：${enhancement.join("、")}。`
      : "",
    "说明：增强目标平台不会在报告中伪造该平台回答或评分；下一轮内容资产应覆盖其典型问答场景。",
  ]
    .filter(Boolean)
    .join("\n");
}
