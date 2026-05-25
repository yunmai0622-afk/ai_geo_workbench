export type CaseDraft = {
  id?: number;
  caseType: "真实案例" | "待补充案例线索";
  customerBackground: string;
  originalProblem: string;
  executionProcess: string;
  resultData: string;
  allowPublic: boolean;
};

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type SectionStatusTone = "未填写" | "待完善" | "已完成";

export function caseCompleteness(row: CaseDraft) {
  return {
    hasCustomer: Boolean(row.customerBackground.trim()),
    hasProblem: Boolean(row.originalProblem.trim()),
    hasSolution: Boolean(row.executionProcess.trim()),
    hasResult: Boolean(row.resultData.trim()) && !/待补充|暂无/i.test(row.resultData),
    hasData: /\d|%|倍|万|千|提升|下降|增长/.test(row.resultData),
  };
}

export function caseCompletenessScore(row: CaseDraft) {
  const c = caseCompleteness(row);
  return [c.hasCustomer, c.hasProblem, c.hasSolution, c.hasResult, c.hasData].filter(Boolean).length;
}

export function parseFaqText(text: string): FaqItem[] {
  const t = text.trim();
  if (!t) return [];
  const blocks = t.split(/\n\n+/).filter(Boolean);
  const items: FaqItem[] = [];
  for (const block of blocks) {
    const qMatch = block.match(/(?:客户疑虑[：:]|问[：:]|Q[：:])\s*([\s\S]+?)(?:\n|$)/);
    const aMatch = block.match(/(?:回答[：:]|答[：:]|A[：:])\s*([\s\S]+)/);
    if (qMatch) {
      items.push({
        id: `faq-${items.length}-${Date.now()}`,
        question: qMatch[1].trim(),
        answer: aMatch?.[1]?.trim() ?? "",
      });
    } else if (block.includes("？") || block.includes("?")) {
      const lines = block.split("\n").filter(Boolean);
      items.push({
        id: `faq-${items.length}`,
        question: lines[0] ?? "",
        answer: lines.slice(1).join("\n").trim(),
      });
    }
  }
  if (items.length === 0 && t) {
    return [{ id: "faq-0", question: t.slice(0, 120), answer: "" }];
  }
  return items;
}

export function serializeFaqItems(items: FaqItem[]): string {
  return items
    .filter(i => i.question.trim())
    .map(i => `客户疑虑：${i.question.trim()}\n回答：${i.answer.trim()}`)
    .join("\n\n");
}
