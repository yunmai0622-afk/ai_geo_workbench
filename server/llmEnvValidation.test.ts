import { describe, expect, it } from "vitest";

describe("LLM environment variables validation", () => {
  it("LLM_PROVIDER is set to openai", () => {
    expect(process.env.LLM_PROVIDER).toBe("openai");
  });

  it("OPENAI_API_KEY is set and non-empty", () => {
    expect(process.env.OPENAI_API_KEY).toBeTruthy();
    expect(process.env.OPENAI_API_KEY!.length).toBeGreaterThan(10);
  });

  it("OPENAI_BASE_URL is set to ark endpoint", () => {
    expect(process.env.OPENAI_BASE_URL).toBe("https://ark.cn-beijing.volces.com/api/v3");
  });

  it("OPENAI_MODEL is set", () => {
    expect(process.env.OPENAI_MODEL).toBe("ep-20251210143333-s6bb7");
  });

  it("OPENAI_TIMEOUT_MS is set to 180000", () => {
    expect(process.env.OPENAI_TIMEOUT_MS).toBe("180000");
  });
});
