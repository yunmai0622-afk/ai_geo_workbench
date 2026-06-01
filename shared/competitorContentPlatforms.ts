/** 竞品公开内容分布：人工勾选的平台（不自动抓取）。 */
export const COMPETITOR_CONTENT_PLATFORMS = [
  { key: "zhihu", label: "知乎" },
  { key: "sohu", label: "搜狐" },
  { key: "baijiahao", label: "百家号" },
  { key: "toutiao", label: "头条号" },
  { key: "wechat", label: "微信公众号" },
] as const;

export type CompetitorPlatformKey = (typeof COMPETITOR_CONTENT_PLATFORMS)[number]["key"];

export type CompetitorPlatformDistribution = Partial<Record<CompetitorPlatformKey, boolean>>;

export type ParsedCompetitorContentAssets = {
  platforms: CompetitorPlatformDistribution;
  note: string;
};

function isPlatformKey(key: string): key is CompetitorPlatformKey {
  return COMPETITOR_CONTENT_PLATFORMS.some(p => p.key === key);
}

/** 解析 competitor_profiles.contentAssets：支持 JSON 或纯文本备注。 */
export function parseCompetitorContentAssets(raw: string | null | undefined): ParsedCompetitorContentAssets {
  const text = String(raw ?? "").trim();
  if (!text) return { platforms: {}, note: "" };

  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as {
        platforms?: Record<string, unknown>;
        note?: unknown;
      };
      const platforms: CompetitorPlatformDistribution = {};
      if (parsed.platforms && typeof parsed.platforms === "object") {
        for (const [key, value] of Object.entries(parsed.platforms)) {
          if (isPlatformKey(key) && typeof value === "boolean") {
            platforms[key] = value;
          }
        }
      }
      const note = typeof parsed.note === "string" ? parsed.note.trim() : "";
      return { platforms, note: note || (Object.keys(platforms).length === 0 ? text : "") };
    } catch {
      /* fall through */
    }
  }

  return { platforms: {}, note: text };
}

export function serializeCompetitorContentAssets(input: ParsedCompetitorContentAssets): string {
  const platforms = Object.fromEntries(
    COMPETITOR_CONTENT_PLATFORMS.map(p => [p.key, Boolean(input.platforms[p.key])]),
  );
  const note = input.note.trim();
  if (!note && Object.values(platforms).every(v => !v)) return "";
  return JSON.stringify({ platforms, note });
}

export function platformLabel(key: CompetitorPlatformKey): string {
  return COMPETITOR_CONTENT_PLATFORMS.find(p => p.key === key)?.label ?? key;
}

export function listActivePlatformLabels(platforms: CompetitorPlatformDistribution): string[] {
  return COMPETITOR_CONTENT_PLATFORMS.filter(p => platforms[p.key]).map(p => p.label);
}
