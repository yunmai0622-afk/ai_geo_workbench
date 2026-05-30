/** 不应展示/发布给读者的内部元数据二级标题（精确或前缀匹配，忽略括号内提示语） */
const INTERNAL_H2_TITLE =
  /^(发布后如何自行核对效果|发布后.{0,12}核对.{0,6}效果|自行核对效果|平台适配说明|GEO\s*质量自检说明|更新说明)(?:\s*[（(].*)?$/;

const CITABLE_H2_TITLE = /^(便于引用的要点|可引用要点|摘录要点|AI\s*可引用片段)(?:\s*[（(].*)?$/;

function normalizeH2Title(line: string): string {
  return line.replace(/^##(?!#)\s*/, "").trim();
}

function isH2Line(line: string): boolean {
  return /^##(?!#)\s/.test(line);
}

/**
 * 去掉文章 Markdown 中仅供内部使用的尾部说明。
 * 「便于引用的要点」保留第一组（正文内用户问答），去掉后续重复组（常为系统追加的品牌问答）。
 */
export function stripInternalArticleMetadataFromMarkdown(content: string | null | undefined): string {
  if (!content?.trim()) return content?.trim() ?? "";

  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  let citableSectionKept = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!isH2Line(line)) {
      kept.push(line);
      i += 1;
      continue;
    }

    const title = normalizeH2Title(line);
    if (INTERNAL_H2_TITLE.test(title)) {
      i += 1;
      while (i < lines.length && !isH2Line(lines[i] ?? "")) i += 1;
      continue;
    }

    if (CITABLE_H2_TITLE.test(title)) {
      if (citableSectionKept) {
        i += 1;
        while (i < lines.length && !isH2Line(lines[i] ?? "")) i += 1;
        continue;
      }
      citableSectionKept = true;
    }

    kept.push(line);
    i += 1;
  }

  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
