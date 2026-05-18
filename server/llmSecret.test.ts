import { describe, it, expect } from "vitest";

describe("LLM Secret Validation", () => {
  it("OPENAI_API_KEY and OPENAI_BASE_URL are configured", () => {
    expect(process.env.OPENAI_API_KEY).toBeTruthy();
    expect(process.env.OPENAI_BASE_URL).toBeTruthy();
    expect(process.env.LLM_PROVIDER).toBe("openai");
  });

  it("can reach the LLM endpoint with a minimal request", async () => {
    const baseUrl = process.env.OPENAI_BASE_URL!;
    const apiKey = process.env.OPENAI_API_KEY!;
    const model = process.env.OPENAI_MODEL || "ep-20251210143333-s6bb7";

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
      }),
    });

    // Accept 200 (success) or 429 (rate limit) as proof the key is valid
    expect([200, 429]).toContain(res.status);
  }, 15000);
});
