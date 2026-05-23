/** 目标客户问题轻量去重（生成后与历史对比） */

export function normalizeQuestionKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000，。！？、；：""''（）\[\]【】.,;:'"()\-—·]/g, "")
    .replace(/[\?？]/g, "");
}

function bigramSet(text: string): Set<string> {
  const set = new Set<string>();
  const n = normalizeQuestionKey(text);
  if (n.length < 2) {
    if (n) set.add(n);
    return set;
  }
  for (let i = 0; i < n.length - 1; i++) set.add(n.slice(i, i + 2));
  return set;
}

function jaccardSimilarity(a: string, b: string): number {
  const sa = bigramSet(a);
  const sb = bigramSet(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  sa.forEach(x => {
    if (sb.has(x)) inter++;
  });
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** 完全相同或归一化后相同 */
export function isExactDuplicateQuestion(a: string, b: string): boolean {
  const ta = a.trim();
  const tb = b.trim();
  if (!ta || !tb) return false;
  if (ta === tb) return true;
  const na = normalizeQuestionKey(ta);
  const nb = normalizeQuestionKey(tb);
  return na.length > 0 && na === nb;
}

/** 相似度过高（包含关系 + 二元组 Jaccard） */
export function isSimilarQuestion(a: string, b: string, threshold = 0.72): boolean {
  if (isExactDuplicateQuestion(a, b)) return true;
  const na = normalizeQuestionKey(a);
  const nb = normalizeQuestionKey(b);
  if (na.length >= 4 && nb.length >= 4) {
    if (na.includes(nb) || nb.includes(na)) {
      const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
      if (ratio >= 0.65) return true;
    }
  }
  return jaccardSimilarity(a, b) >= threshold;
}

export function isDuplicateAgainstList(candidate: string, others: string[]): boolean {
  return others.some(other => isSimilarQuestion(candidate, other));
}

export type DedupeTargetQuestionResult<T extends { questionText: string }> = {
  kept: T[];
  filteredCount: number;
};

export function dedupeTargetQuestionRows<T extends { questionText: string }>(
  rows: T[],
  excludeQuestions: string[] = [],
): DedupeTargetQuestionResult<T> {
  const exclude = excludeQuestions.map(t => t.trim()).filter(Boolean);
  const kept: T[] = [];
  let filteredCount = 0;
  for (const row of rows) {
    const text = (row.questionText ?? "").trim();
    if (!text) {
      filteredCount++;
      continue;
    }
    const pool = [...exclude, ...kept.map(k => k.questionText)];
    if (isDuplicateAgainstList(text, pool)) {
      filteredCount++;
      continue;
    }
    kept.push(row);
  }
  return { kept, filteredCount };
}
