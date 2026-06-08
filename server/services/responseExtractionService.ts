export type ExtractionSentiment = "positive" | "neutral" | "negative";

export type ExtractionResult = {
  mentioned: boolean;
  recommended: boolean;
  citations: string[];
  competitors: string[];
  sentiment: ExtractionSentiment;
};

const RECOMMEND_KEYWORDS = ["推荐", "建议", "适合", "首选", "值得", "优选", "可以考虑"];
const POSITIVE_KEYWORDS = ["推荐", "优秀", "适合", "领先", "优势", "值得", "首选", "出色", "专业", "可靠"];
const NEGATIVE_KEYWORDS = ["不建议", "较差", "避免", "不好", "劣势", "问题", "缺点", "不推荐", "谨慎"];

const URL_PATTERN = /https?:\/\/[^\s\])"'<>]+/gi;
const SOURCE_PATTERN = /(?:来源|参考)[：:]\s*([^\n，。；;]+)/g;

function countKeywordHits(text: string, keywords: readonly string[]): number {
  let count = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword)) count += 1;
  }
  return count;
}

function isRecommendedNearBrand(text: string, brandName: string): boolean {
  if (!brandName.trim()) return false;
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const idx = text.indexOf(brandName, searchFrom);
    if (idx < 0) break;
    const start = Math.max(0, idx - 50);
    const end = Math.min(text.length, idx + brandName.length + 50);
    const window = text.slice(start, end);
    if (RECOMMEND_KEYWORDS.some(keyword => window.includes(keyword))) {
      return true;
    }
    searchFrom = idx + brandName.length;
  }
  return false;
}

function extractCitations(text: string): string[] {
  const citations: string[] = [];
  for (const match of text.matchAll(URL_PATTERN)) {
    if (match[0]) citations.push(match[0].trim());
  }
  for (const match of text.matchAll(SOURCE_PATTERN)) {
    const value = match[1]?.trim();
    if (value) citations.push(value);
  }
  return [...new Set(citations)];
}

function resolveSentiment(text: string): ExtractionSentiment {
  const positiveCount = countKeywordHits(text, POSITIVE_KEYWORDS);
  const negativeCount = countKeywordHits(text, NEGATIVE_KEYWORDS);
  if (positiveCount > negativeCount) return "positive";
  if (negativeCount > positiveCount) return "negative";
  return "neutral";
}

/** 纯规则抽取，不调用 AI API */
export function extractFromResponse(
  rawText: string,
  brandName: string,
  competitors: string[],
): ExtractionResult {
  const text = rawText ?? "";
  const trimmedBrand = brandName.trim();
  const mentioned = trimmedBrand.length > 0 && text.includes(trimmedBrand);
  const recommended = mentioned && isRecommendedNearBrand(text, trimmedBrand);
  const citations = extractCitations(text);
  const matchedCompetitors = competitors
    .map(name => name.trim())
    .filter(name => name.length > 0 && text.includes(name));
  const sentiment = resolveSentiment(text);

  return {
    mentioned,
    recommended,
    citations,
    competitors: [...new Set(matchedCompetitors)],
    sentiment,
  };
}
