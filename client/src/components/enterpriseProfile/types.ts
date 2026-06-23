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

export type AdvancedTrustNotes = {
  authorityText: string;
  partnersText: string;
  credentialsText: string;
  mediaText: string;
  reviewsText: string;
};

const ADVANCED_TRUST_NOTE_SECTIONS: Array<{ key: keyof AdvancedTrustNotes; label: string }> = [
  { key: "authorityText", label: "品牌故事与定位说明" },
  { key: "partnersText", label: "团队/合作客户" },
  { key: "credentialsText", label: "资质证书" },
  { key: "mediaText", label: "媒体报道" },
  { key: "reviewsText", label: "客户评价" },
];

export function serializeAdvancedTrustNotes(notes: AdvancedTrustNotes): string {
  return ADVANCED_TRUST_NOTE_SECTIONS.map(({ key, label }) => {
    const value = notes[key].trim();
    if (!value) return "";
    return `${label}：\n${value}`;
  })
    .filter(Boolean)
    .join("\n\n");
}

export function parseAdvancedTrustNotes(raw: string): AdvancedTrustNotes {
  const empty: AdvancedTrustNotes = {
    authorityText: "",
    partnersText: "",
    credentialsText: "",
    mediaText: "",
    reviewsText: "",
  };
  const text = raw.trim();
  if (!text) return empty;

  const hasLabels = ADVANCED_TRUST_NOTE_SECTIONS.some(
    ({ label }) => text.includes(`${label}：`) || text.includes(`${label}:`),
  );
  if (!hasLabels) {
    const lines = text
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);
    if (lines.length <= 1) {
      return { ...empty, authorityText: text };
    }
    return {
      ...empty,
      partnersText: lines[0] ?? "",
      credentialsText: lines[1] ?? "",
      mediaText: lines[2] ?? "",
      reviewsText: lines.slice(3).join("\n"),
    };
  }

  const result = { ...empty };
  for (let i = 0; i < ADVANCED_TRUST_NOTE_SECTIONS.length; i += 1) {
    const { key, label } = ADVANCED_TRUST_NOTE_SECTIONS[i]!;
    const labelMatch = text.match(new RegExp(`${label}[：:]\\s*`));
    if (!labelMatch || labelMatch.index === undefined) continue;
    const start = labelMatch.index + labelMatch[0].length;
    let end = text.length;
    for (let j = i + 1; j < ADVANCED_TRUST_NOTE_SECTIONS.length; j += 1) {
      const nextLabel = ADVANCED_TRUST_NOTE_SECTIONS[j]!.label;
      const nextColon = text.indexOf(`${nextLabel}：`, start);
      const nextAsciiColon = text.indexOf(`${nextLabel}:`, start);
      const candidates = [nextColon, nextAsciiColon].filter(index => index >= 0);
      if (candidates.length > 0) {
        end = Math.min(end, Math.min(...candidates));
      }
    }
    result[key] = text.slice(start, end).trim();
  }
  return result;
}
