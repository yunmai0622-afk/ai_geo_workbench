/** 文章封面模板：系统 SVG 渲染中文标题，禁止 AI 生图模型画字 */

export const COVER_WIDTH = 1200;
export const COVER_HEIGHT = 675;

export const ARTICLE_COVER_TEMPLATE_IDS = ["ai-tech", "business", "compare"] as const;
export type ArticleCoverTemplateId = (typeof ARTICLE_COVER_TEMPLATE_IDS)[number];

export const ARTICLE_COVER_TEMPLATE_LABELS: Record<ArticleCoverTemplateId, string> = {
  "ai-tech": "AI 科技风",
  business: "知识商业风",
  compare: "对比分析风",
};

export function isArticleCoverTemplateId(value: string): value is ArticleCoverTemplateId {
  return (ARTICLE_COVER_TEMPLATE_IDS as readonly string[]).includes(value);
}

export function normalizeArticleCoverTemplateId(value: string | null | undefined): ArticleCoverTemplateId {
  if (value && isArticleCoverTemplateId(value)) return value;
  return "ai-tech";
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 长标题自动换行，超长截断 */
export function wrapCoverTitleLines(title: string, maxCharsPerLine = 14, maxLines = 3): string[] {
  const cleaned = title.replace(/\s+/g, " ").trim();
  if (!cleaned) return ["未命名文章"];

  const lines: string[] = [];
  let rest = cleaned;
  while (rest.length > 0 && lines.length < maxLines) {
    if (rest.length <= maxCharsPerLine) {
      lines.push(rest);
      break;
    }
    let breakAt = maxCharsPerLine;
    const slice = rest.slice(0, maxCharsPerLine + 1);
    const punct = Math.max(slice.lastIndexOf("，"), slice.lastIndexOf("。"), slice.lastIndexOf(" "), slice.lastIndexOf("、"));
    if (punct > 4) breakAt = punct + 1;
    lines.push(rest.slice(0, breakAt).trim());
    rest = rest.slice(breakAt).trim();
  }

  if (rest.length > 0 && lines.length >= maxLines) {
    const last = lines[maxLines - 1] ?? "";
    lines[maxLines - 1] = last.length > maxCharsPerLine - 1 ? `${last.slice(0, maxCharsPerLine - 1)}…` : `${last}…`;
  }

  return lines.slice(0, maxLines);
}

export type BuildCoverSvgParams = {
  template: ArticleCoverTemplateId;
  title: string;
  brandName?: string;
};

function renderTitleTspans(lines: string[], x: number, startY: number, lineHeight: number, fill: string, fontSize: number): string {
  return lines
    .map((line, i) => {
      const y = startY + i * lineHeight;
      return `<tspan x="${x}" y="${y}" fill="${fill}" font-size="${fontSize}" font-weight="700">${escapeXml(line)}</tspan>`;
    })
    .join("");
}

function buildAiTechSvg(titleLines: string[], brandName: string): string {
  const titleBlock = renderTitleTspans(titleLines, 80, 280, 72, "#E0F2FE", 52);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_WIDTH}" height="${COVER_HEIGHT}" viewBox="0 0 ${COVER_WIDTH} ${COVER_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="55%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#0c4a6e"/>
    </linearGradient>
    <radialGradient id="glow" cx="75%" cy="25%" r="45%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  <rect x="56" y="56" width="520" height="8" rx="4" fill="#22d3ee" opacity="0.9"/>
  <text font-family="'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif" xml:space="preserve">${titleBlock}</text>
  <text x="80" y="580" fill="#94a3b8" font-size="28" font-family="'PingFang SC','Microsoft YaHei',sans-serif">${escapeXml(brandName)}</text>
  <text x="80" y="620" fill="#64748b" font-size="22" font-family="'PingFang SC','Microsoft YaHei',sans-serif">GEO 内容资产</text>
</svg>`;
}

function buildBusinessSvg(titleLines: string[], brandName: string): string {
  const titleBlock = renderTitleTspans(titleLines, 72, 260, 68, "#0f172a", 48);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_WIDTH}" height="${COVER_HEIGHT}" viewBox="0 0 ${COVER_WIDTH} ${COVER_HEIGHT}">
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <rect x="0" y="0" width="${COVER_WIDTH}" height="120" fill="#0ea5e9" opacity="0.12"/>
  <rect x="48" y="48" width="1104" height="579" rx="24" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
  <text font-family="'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif" xml:space="preserve">${titleBlock}</text>
  <text x="72" y="560" fill="#0369a1" font-size="26" font-weight="600" font-family="'PingFang SC','Microsoft YaHei',sans-serif">${escapeXml(brandName)}</text>
</svg>`;
}

function buildCompareSvg(titleLines: string[], brandName: string): string {
  const titleBlock = renderTitleTspans(titleLines, 640, 300, 70, "#ffffff", 46);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_WIDTH}" height="${COVER_HEIGHT}" viewBox="0 0 ${COVER_WIDTH} ${COVER_HEIGHT}">
  <rect width="50%" height="100%" fill="#1e293b"/>
  <rect x="50%" width="50%" height="100%" fill="#0f766e"/>
  <text x="80" y="120" fill="#94a3b8" font-size="24" font-family="'PingFang SC','Microsoft YaHei',sans-serif">选型对比</text>
  <text font-family="'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif" xml:space="preserve">${titleBlock}</text>
  <text x="640" y="560" fill="#ccfbf1" font-size="24" font-family="'PingFang SC','Microsoft YaHei',sans-serif">${escapeXml(brandName)}</text>
  <line x1="600" y1="80" x2="600" y2="595" stroke="#ffffff" stroke-width="3" opacity="0.35"/>
</svg>`;
}

export function buildArticleCoverSvg(params: BuildCoverSvgParams): string {
  const template = normalizeArticleCoverTemplateId(params.template);
  const brandName = (params.brandName ?? "海豚知道").trim() || "海豚知道";
  const titleLines = wrapCoverTitleLines(params.title);

  switch (template) {
    case "business":
      return buildBusinessSvg(titleLines, brandName);
    case "compare":
      return buildCompareSvg(titleLines, brandName);
    case "ai-tech":
    default:
      return buildAiTechSvg(titleLines, brandName);
  }
}

export function buildArticleCoverDataUrl(params: BuildCoverSvgParams): string {
  const svg = buildArticleCoverSvg(params);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** 是否为旧版 AI 生图 HTTP 封面（应提示重新生成模板封面） */
export function isLegacyAiGeneratedCoverUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith("data:")) return false;
  return url.startsWith("http");
}

/** 模板列表（别名，便于业务层引用） */
export const COVER_TEMPLATES = ARTICLE_COVER_TEMPLATE_IDS.map(id => ({
  id,
  label: ARTICLE_COVER_TEMPLATE_LABELS[id],
}));

export const getDefaultCoverTemplate = normalizeArticleCoverTemplateId;
export const splitTitleLines = wrapCoverTitleLines;
export const generateCoverSvg = buildArticleCoverSvg;
export const renderCoverPreview = buildArticleCoverDataUrl;

export function truncateTitle(title: string, maxCharsPerLine = 14, maxLines = 3): string {
  return wrapCoverTitleLines(title, maxCharsPerLine, maxLines).join("");
}
