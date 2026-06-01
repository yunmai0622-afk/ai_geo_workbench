import { stripInternalArticleMetadataFromMarkdown } from "./stripInternalArticleMetadata";

export const WECHAT_SUMMARY_MAX_LEN = 100;

/** 微信公众号首图文封面常用比例 2.35:1 */
export const WECHAT_COVER_SIZE_HINT =
  "建议封面尺寸：900×383 像素（比例约 2.35:1，用于头条图文封面）；正文配图宽度建议不超过 1080 像素，单张不超过 10MB。";

export const WECHAT_MATERIAL_MARKERS = {
  title: "【文章标题】",
  summary: "【摘要】",
  body: "【正文】",
  cover: "【封面图建议】",
} as const;

export type WechatMaterialView = {
  articleTitle: string;
  summary: string;
  /** 公众号排版预览（纯文本，段落留白） */
  bodyDisplay: string;
  /** 复制到剪贴板用的 HTML */
  bodyHtml: string;
  /** 复制到剪贴板的纯文本正文 */
  bodyPlain: string;
  coverSizeHint: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function clampWechatSummary(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const chars = Array.from(cleaned);
  if (chars.length <= WECHAT_SUMMARY_MAX_LEN) return cleaned;
  return chars.slice(0, WECHAT_SUMMARY_MAX_LEN).join("");
}

function stripMarkdownInline(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

/**
 * 去掉正文首行单井号 H1，避免与发布标题重复。
 */
export function stripLeadingMarkdownH1Line(markdown: string | null | undefined): string {
  if (markdown == null) return "";
  const normalized = markdown.replace(/^\uFEFF/, "");
  const lines = normalized.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length) return normalized.trim();
  const head = lines[i].trim();
  if (!/^#(?![#])\s*\S/.test(head) && !/^#(?![#])\s*$/.test(head)) return normalized.trim();
  i++;
  while (i < lines.length && lines[i].trim() === "") i++;
  return lines.slice(i).join("\n").trimEnd();
}

export function formatWechatBodyFromMarkdown(markdown: string): string {
  const source = stripLeadingMarkdownH1Line(stripInternalArticleMetadataFromMarkdown(markdown));
  const lines = source.split(/\r?\n/);
  const blocks: string[] = [];
  let buffer: string[] = [];

  const flushParagraph = () => {
    const text = stripMarkdownInline(buffer.join("\n")).trim();
    if (text) blocks.push(text);
    buffer = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      continue;
    }
    if (/^#{1,3}\s+/.test(line)) {
      flushParagraph();
      const heading = stripMarkdownInline(line.replace(/^#{1,3}\s+/, ""));
      if (heading) blocks.push(heading);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      buffer.push(`· ${stripMarkdownInline(line.replace(/^[-*]\s+/, ""))}`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      buffer.push(`${line.replace(/^\d+\.\s+/, "").trim()}`);
      continue;
    }
    buffer.push(stripMarkdownInline(line));
  }
  flushParagraph();

  if (blocks.length === 0) {
    const fallback = stripMarkdownInline(source).trim();
    return fallback || "正文待补充，发布前请核对事实与合规表述。";
  }

  return blocks.join("\n\n");
}

export function markdownToWechatCopyHtml(markdown: string): string {
  const source = stripLeadingMarkdownH1Line(stripInternalArticleMetadataFromMarkdown(markdown));
  return source
    .split(/\r?\n/)
    .map(line => {
      const t = line.trim();
      if (!t) return "";
      if (t.startsWith("### ")) {
        return `<h3 style="font-size:16px;font-weight:700;margin:18px 0 8px;line-height:1.5;">${escapeHtml(t.slice(4))}</h3>`;
      }
      if (t.startsWith("## ")) {
        return `<h2 style="font-size:18px;font-weight:700;margin:22px 0 10px;line-height:1.5;">${escapeHtml(t.slice(3))}</h2>`;
      }
      if (t.startsWith("# ")) {
        return `<h1 style="font-size:20px;font-weight:700;margin:24px 0 12px;line-height:1.4;">${escapeHtml(t.slice(2))}</h1>`;
      }
      if (/^[-*]\s+/.test(t)) {
        return `<p style="margin:10px 0;line-height:1.75;text-align:justify;">· ${escapeHtml(t.replace(/^[-*]\s+/, ""))}</p>`;
      }
      if (/^\d+\.\s+/.test(t)) {
        return `<p style="margin:10px 0;line-height:1.75;text-align:justify;">${escapeHtml(t)}</p>`;
      }
      return `<p style="margin:14px 0;line-height:1.75;text-align:justify;">${escapeHtml(t)}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

function summaryFromGenerationBasis(basis: Record<string, unknown> | null | undefined): string {
  if (!basis) return "";
  const candidates = [
    basis.articleSummary,
    basis.contentSummary,
    basis.summary,
    basis.customerQuestion,
  ];
  for (const item of candidates) {
    if (typeof item === "string" && item.trim()) return clampWechatSummary(item);
  }
  const structure = basis.structure;
  if (structure && typeof structure === "object" && structure !== null) {
    const s = (structure as Record<string, unknown>).summary;
    if (typeof s === "string" && s.trim()) return clampWechatSummary(s);
  }
  return "";
}

function summaryFromLegacyMaterial(raw: string, title: string): string {
  const text = raw.trim();
  if (!text) return "";
  const bodyMarker = "## 正文";
  const bodyIdx = text.indexOf(bodyMarker);
  if (bodyIdx > 0) {
    let intro = text.slice(0, bodyIdx).trim();
    intro = intro.replace(/^#\s+.+\n?/m, "").trim();
    if (intro) return clampWechatSummary(intro);
  }
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length >= 2 && lines[0].replace(/^#\s+/, "") === title.trim()) {
    return clampWechatSummary(lines[1] ?? "");
  }
  if (lines.length > 0 && !lines[0].startsWith("#")) {
    return clampWechatSummary(lines[0]);
  }
  return "";
}

export function buildWechatMaterialFromInputs(input: {
  title: string;
  markdownContent: string;
  generationBasis?: Record<string, unknown> | null;
  summaryOverride?: string | null;
}): WechatMaterialView {
  const articleTitle = input.title.replace(/\s+/g, " ").trim() || "待补充标题";
  const markdown = stripInternalArticleMetadataFromMarkdown(input.markdownContent ?? "");
  const summary =
    clampWechatSummary((input.summaryOverride ?? "").trim()) ||
    summaryFromGenerationBasis(input.generationBasis ?? null) ||
    clampWechatSummary(formatWechatBodyFromMarkdown(markdown).split("\n\n")[0] ?? "");
  const bodyDisplay = formatWechatBodyFromMarkdown(markdown);
  const bodyHtml = markdownToWechatCopyHtml(markdown);
  const bodyPlain = bodyDisplay;
  return {
    articleTitle,
    summary: summary || "摘要待补充，可从正文首段提炼后粘贴到公众号摘要栏。",
    bodyDisplay,
    bodyHtml,
    bodyPlain,
    coverSizeHint: WECHAT_COVER_SIZE_HINT,
  };
}

export function buildWechatMaterialText(view: WechatMaterialView): string {
  return [
    WECHAT_MATERIAL_MARKERS.title,
    view.articleTitle,
    "",
    WECHAT_MATERIAL_MARKERS.summary,
    view.summary,
    "",
    WECHAT_MATERIAL_MARKERS.body,
    view.bodyDisplay,
    "",
    WECHAT_MATERIAL_MARKERS.cover,
    view.coverSizeHint,
  ].join("\n");
}

function extractSection(raw: string, marker: string, nextMarkers: string[]): string {
  const start = raw.indexOf(marker);
  if (start < 0) return "";
  let contentStart = start + marker.length;
  if (raw[contentStart] === "\n") contentStart += 1;
  let end = raw.length;
  for (const next of nextMarkers) {
    const idx = raw.indexOf(next, contentStart);
    if (idx >= 0 && idx < end) end = idx;
  }
  return raw.slice(contentStart, end).trim();
}

export function parseWechatMaterial(raw: string): WechatMaterialView | null {
  const text = raw.trim();
  if (!text) return null;
  if (!text.includes(WECHAT_MATERIAL_MARKERS.title)) return null;

  const articleTitle = extractSection(text, WECHAT_MATERIAL_MARKERS.title, [
    WECHAT_MATERIAL_MARKERS.summary,
    WECHAT_MATERIAL_MARKERS.body,
    WECHAT_MATERIAL_MARKERS.cover,
  ]);
  const summary = extractSection(text, WECHAT_MATERIAL_MARKERS.summary, [
    WECHAT_MATERIAL_MARKERS.body,
    WECHAT_MATERIAL_MARKERS.cover,
  ]);
  const bodyBlock = extractSection(text, WECHAT_MATERIAL_MARKERS.body, [WECHAT_MATERIAL_MARKERS.cover]);
  const coverSizeHint = extractSection(text, WECHAT_MATERIAL_MARKERS.cover, []);

  if (!articleTitle && !bodyBlock) return null;

  const bodyDisplay = bodyBlock || "";
  return {
    articleTitle: articleTitle || "待补充标题",
    summary: clampWechatSummary(summary) || "摘要待补充，可从正文首段提炼后粘贴到公众号摘要栏。",
    bodyDisplay,
    bodyHtml: markdownToWechatCopyHtml(bodyDisplay),
    bodyPlain: bodyDisplay,
    coverSizeHint: coverSizeHint || WECHAT_COVER_SIZE_HINT,
  };
}

export function resolveWechatMaterial(input: {
  materialText?: string | null;
  title?: string | null;
  markdownContent?: string | null;
  generationBasis?: Record<string, unknown> | null;
}): WechatMaterialView {
  const parsed = parseWechatMaterial((input.materialText ?? "").trim());
  if (parsed && parsed.bodyDisplay.trim()) return parsed;

  const legacy = (input.materialText ?? "").trim();
  const title = (input.title ?? "").trim() || "待补充标题";
  const markdown =
    typeof input.markdownContent === "string"
      ? stripInternalArticleMetadataFromMarkdown(input.markdownContent)
      : "";

  if (legacy && legacy.includes("## 正文")) {
    const bodyStart = legacy.indexOf("## 正文");
    const bodyPart = legacy.slice(bodyStart + "## 正文".length).replace(/## 给编辑的说明[\s\S]*/u, "").trim();
    const summary =
      summaryFromLegacyMaterial(legacy, title) || summaryFromGenerationBasis(input.generationBasis ?? null);
    const bodyDisplay = formatWechatBodyFromMarkdown(bodyPart || markdown);
    return {
      articleTitle: title,
      summary: summary || clampWechatSummary(bodyDisplay.split("\n\n")[0] ?? "") || "摘要待补充，可从正文首段提炼后粘贴到公众号摘要栏。",
      bodyDisplay,
      bodyHtml: markdownToWechatCopyHtml(bodyPart || markdown),
      bodyPlain: bodyDisplay,
      coverSizeHint: WECHAT_COVER_SIZE_HINT,
    };
  }

  return buildWechatMaterialFromInputs({
    title,
    markdownContent: markdown || legacy,
    generationBasis: input.generationBasis ?? null,
  });
}

export async function copyWechatFormattedBody(view: WechatMaterialView): Promise<void> {
  const html = view.bodyHtml.trim();
  const plain = view.bodyPlain.trim();
  if (!plain) {
    throw new Error("正文为空");
  }
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      }),
    ]);
    return;
  }
  await navigator.clipboard.writeText(plain);
}
