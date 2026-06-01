export const XIAOHONGSHU_NOTE_TITLE_MAX_LEN = 25;

export const XIAOHONGSHU_MATERIAL_MARKERS = {
  title: "【笔记标题】",
  body: "【正文】",
  images: "【建议配图】",
  tags: "【话题标签】",
} as const;

export type XiaohongshuMaterialView = {
  noteTitle: string;
  body: string;
  imageSuggestions: string[];
  hashtags: string[];
};

const DEFAULT_HASHTAGS = ["#知识付费", "#知识主播", "#内容运营", "#GEO优化"];

const SECTION_EMOJI: Array<{ pattern: RegExp; emoji: string }> = [
  { pattern: /痛点|困扰|难题/, emoji: "😣" },
  { pattern: /结论|要点|先说/, emoji: "✅" },
  { pattern: /步骤|清单|怎么做/, emoji: "📌" },
  { pattern: /避坑|误区|提醒/, emoji: "⚠️" },
  { pattern: /适合|不适合/, emoji: "🎯" },
  { pattern: /案例|经验/, emoji: "💡" },
  { pattern: /自检|复测|核对/, emoji: "🔍" },
];

export function clampXiaohongshuNoteTitle(title: string): string {
  const cleaned = title.replace(/\s+/g, " ").trim();
  if (!cleaned) return "GEO内容笔记";
  const chars = Array.from(cleaned);
  if (chars.length <= XIAOHONGSHU_NOTE_TITLE_MAX_LEN) return cleaned;
  return chars.slice(0, XIAOHONGSHU_NOTE_TITLE_MAX_LEN).join("");
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

function emojiForLine(line: string): string {
  for (const rule of SECTION_EMOJI) {
    if (rule.pattern.test(line)) return rule.emoji;
  }
  return "✨";
}

export function formatXiaohongshuBodyFromMarkdown(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const blocks: string[] = [];
  let buffer: string[] = [];

  const flush = () => {
    const text = stripMarkdownInline(buffer.join("\n")).trim();
    if (text) {
      const firstLine = text.split("\n")[0] ?? text;
      const prefix = emojiForLine(firstLine);
      blocks.push(`${prefix} ${text}`);
    }
    buffer = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^#{1,3}\s+/.test(line)) {
      flush();
      const heading = stripMarkdownInline(line.replace(/^#{1,3}\s+/, ""));
      buffer.push(heading);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      buffer.push(`· ${stripMarkdownInline(line.replace(/^[-*]\s+/, ""))}`);
      continue;
    }
    buffer.push(stripMarkdownInline(line));
  }
  flush();

  if (blocks.length === 0) {
    const fallback = stripMarkdownInline(markdown).trim();
    return fallback ? `✨ ${fallback}` : "✨ 正文待补充，发布前请核对事实与合规表述。";
  }

  return blocks.join("\n\n");
}

export function buildXiaohongshuHashtags(input?: { industry?: string; keywords?: string[] }): string[] {
  const tags = new Set<string>(DEFAULT_HASHTAGS);
  const industry = (input?.industry ?? "").trim();
  if (industry) tags.add(`#${industry.replace(/\s+/g, "")}`);
  for (const kw of input?.keywords ?? []) {
    const k = kw.trim().replace(/^#/, "");
    if (k.length >= 2 && k.length <= 12) tags.add(`#${k}`);
  }
  return Array.from(tags).slice(0, 8);
}

function buildImageSuggestionsFromMarkdown(markdown: string, enterpriseName?: string): string[] {
  const headings = markdown
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /^#{2,3}\s+/.test(line))
    .map(line => stripMarkdownInline(line.replace(/^#{1,3}\s+/, "")))
    .filter(Boolean)
    .slice(0, 4);

  if (headings.length === 0) {
    const brand = (enterpriseName ?? "品牌").trim() || "品牌";
    return [
      `封面图：${brand}相关场景或问题痛点示意图（竖版 3:4）`,
      "配图2：清单/步骤要点卡片（大字+留白，便于手机阅读）",
      "配图3：避坑提醒或自检清单截图（脱敏、可核验）",
    ];
  }

  return headings.map((heading, index) => {
    const slot = index === 0 ? "封面图" : `配图${index + 1}`;
    return `${slot}：「${heading}」相关场景截图或信息卡片（竖版，避免密集小字）`;
  });
}

export function buildXiaohongshuMaterialFromInputs(input: {
  title: string;
  markdownContent: string;
  industry?: string;
  enterpriseName?: string;
  keywords?: string[];
}): XiaohongshuMaterialView {
  const noteTitle = clampXiaohongshuNoteTitle(input.title);
  const body = formatXiaohongshuBodyFromMarkdown(input.markdownContent);
  return {
    noteTitle,
    body,
    imageSuggestions: buildImageSuggestionsFromMarkdown(input.markdownContent, input.enterpriseName),
    hashtags: buildXiaohongshuHashtags({ industry: input.industry, keywords: input.keywords }),
  };
}

export function buildXiaohongshuMaterialText(view: XiaohongshuMaterialView): string {
  const images = view.imageSuggestions.map((line, index) => `${index + 1}. ${line.replace(/^\d+\.\s*/, "")}`).join("\n");
  const tags = view.hashtags.map(t => (t.startsWith("#") ? t : `#${t}`)).join(" ");
  return [
    XIAOHONGSHU_MATERIAL_MARKERS.title,
    view.noteTitle,
    "",
    XIAOHONGSHU_MATERIAL_MARKERS.body,
    view.body,
    "",
    XIAOHONGSHU_MATERIAL_MARKERS.images,
    images,
    "",
    XIAOHONGSHU_MATERIAL_MARKERS.tags,
    tags,
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

function parseListLines(block: string): string[] {
  return block
    .split(/\r?\n/)
    .map(line => line.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
}

function parseHashtagLine(block: string): string[] {
  const matches = block.match(/#[\u4e00-\u9fa5A-Za-z0-9_]+/g);
  if (matches?.length) return matches;
  return block
    .split(/[\s,，、]+/)
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => (t.startsWith("#") ? t : `#${t}`));
}

export function parseXiaohongshuMaterial(raw: string): XiaohongshuMaterialView | null {
  const text = raw.trim();
  if (!text) return null;
  if (!text.includes(XIAOHONGSHU_MATERIAL_MARKERS.title)) return null;

  const noteTitle = extractSection(text, XIAOHONGSHU_MATERIAL_MARKERS.title, [
    XIAOHONGSHU_MATERIAL_MARKERS.body,
    XIAOHONGSHU_MATERIAL_MARKERS.images,
    XIAOHONGSHU_MATERIAL_MARKERS.tags,
  ]);
  const body = extractSection(text, XIAOHONGSHU_MATERIAL_MARKERS.body, [
    XIAOHONGSHU_MATERIAL_MARKERS.images,
    XIAOHONGSHU_MATERIAL_MARKERS.tags,
  ]);
  const imagesBlock = extractSection(text, XIAOHONGSHU_MATERIAL_MARKERS.images, [XIAOHONGSHU_MATERIAL_MARKERS.tags]);
  const tagsBlock = extractSection(text, XIAOHONGSHU_MATERIAL_MARKERS.tags, []);

  if (!noteTitle && !body) return null;

  return {
    noteTitle: clampXiaohongshuNoteTitle(noteTitle || "GEO内容笔记"),
    body: body || "",
    imageSuggestions: parseListLines(imagesBlock),
    hashtags: parseHashtagLine(tagsBlock),
  };
}

export function resolveXiaohongshuMaterial(input: {
  materialText?: string | null;
  title?: string | null;
  markdownContent?: string | null;
  industry?: string | null;
  enterpriseName?: string | null;
  keywords?: string[];
}): XiaohongshuMaterialView {
  const parsed = parseXiaohongshuMaterial((input.materialText ?? "").trim());
  if (parsed && parsed.body.trim()) return parsed;

  const legacy = (input.materialText ?? "").trim();
  if (legacy && !legacy.includes(XIAOHONGSHU_MATERIAL_MARKERS.title)) {
    const lines = legacy.split(/\r?\n/).filter(Boolean);
    const noteTitle = clampXiaohongshuNoteTitle(lines[0] ?? input.title ?? "");
    const body = formatXiaohongshuBodyFromMarkdown(
      legacy.includes("\n\n") ? legacy.split("\n\n").slice(1).join("\n\n") : legacy,
    );
    return {
      noteTitle,
      body,
      imageSuggestions: buildImageSuggestionsFromMarkdown(
        input.markdownContent ?? legacy,
        input.enterpriseName ?? undefined,
      ),
      hashtags: buildXiaohongshuHashtags({
        industry: input.industry ?? undefined,
        keywords: input.keywords,
      }),
    };
  }

  return buildXiaohongshuMaterialFromInputs({
    title: input.title ?? "GEO内容笔记",
    markdownContent: input.markdownContent ?? legacy ?? "",
    industry: input.industry ?? undefined,
    enterpriseName: input.enterpriseName ?? undefined,
    keywords: input.keywords,
  });
}

export function buildXiaohongshuPublishPackage(view: XiaohongshuMaterialView): string {
  const tags = view.hashtags.map(t => (t.startsWith("#") ? t : `#${t}`)).join(" ");
  return [view.noteTitle, "", view.body.trim(), "", tags].join("\n").trim();
}
