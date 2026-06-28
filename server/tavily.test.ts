import { describe, it, expect } from "vitest";

const liveTavilyTestsEnabled = process.env.RUN_LIVE_TAVILY_TESTS === "true";

describe("TAVILY_API_KEY validation", () => {
  it("should have TAVILY_API_KEY set in environment", () => {
    const key = process.env.TAVILY_API_KEY;
    expect(key).toBeDefined();
    expect(key!.length).toBeGreaterThan(5);
  });

  const liveIt = liveTavilyTestsEnabled ? it : it.skip;

  liveIt("should successfully call Tavily search API", async () => {
    const key = process.env.TAVILY_API_KEY;
    if (!key) {
      throw new Error("TAVILY_API_KEY is not set");
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query: "test",
        max_results: 1,
      }),
    });

    // A valid key should return 200, an invalid key returns 401 or 403
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("results");
  });
});
