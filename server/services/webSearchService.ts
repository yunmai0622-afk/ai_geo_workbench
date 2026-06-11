export const SEARCH_PROVIDER_NOT_CONFIGURED = "SEARCH_PROVIDER_NOT_CONFIGURED";

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  score: number;
};

export class WebSearchNotConfiguredError extends Error {
  readonly code = SEARCH_PROVIDER_NOT_CONFIGURED;

  constructor() {
    super(SEARCH_PROVIDER_NOT_CONFIGURED);
    this.name = "WebSearchNotConfiguredError";
  }
}

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const DEFAULT_MAX_RESULTS = 5;
const REQUEST_TIMEOUT_MS = 30_000;

function getTavilyApiKey(): string {
  return (process.env.TAVILY_API_KEY ?? "").trim();
}

export function isWebSearchConfigured(): boolean {
  return getTavilyApiKey().length > 0;
}

export async function searchWeb(query: string, maxResults = DEFAULT_MAX_RESULTS): Promise<WebSearchResult[]> {
  const apiKey = getTavilyApiKey();
  if (!apiKey) {
    throw new WebSearchNotConfiguredError();
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: trimmedQuery,
        max_results: Math.min(Math.max(maxResults, 1), 10),
        search_depth: "basic",
        include_answer: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Tavily search failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }

    const payload = (await response.json()) as {
      results?: Array<{
        title?: string;
        url?: string;
        content?: string;
        score?: number;
      }>;
    };

    return (payload.results ?? [])
      .map(item => ({
        title: (item.title ?? "").trim(),
        url: (item.url ?? "").trim(),
        snippet: (item.content ?? "").trim(),
        score: typeof item.score === "number" ? item.score : 0,
      }))
      .filter(item => item.title.length > 0 && item.url.length > 0);
  } finally {
    clearTimeout(timeout);
  }
}
