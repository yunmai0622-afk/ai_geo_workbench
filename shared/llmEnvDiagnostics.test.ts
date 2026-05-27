import { describe, expect, it } from "vitest";
import {
  diagnoseLlmProviderEnv,
  formatMissingLlmEnvServerLog,
  getRequiredLlmEnvVars,
} from "./llmEnvDiagnostics";

describe("llmEnvDiagnostics", () => {
  it("reports missing OPENAI_API_KEY when provider is openai", () => {
    const prevProvider = process.env.LLM_PROVIDER;
    const prevKey = process.env.OPENAI_API_KEY;
    process.env.LLM_PROVIDER = "openai";
    delete process.env.OPENAI_API_KEY;
    try {
      expect(getRequiredLlmEnvVars()).toContain("OPENAI_API_KEY");
      const diag = diagnoseLlmProviderEnv();
      expect(diag.configured).toBe(false);
      expect(diag.missingEnvVars).toContain("OPENAI_API_KEY");
      expect(formatMissingLlmEnvServerLog(diag.missingEnvVars)).toBe("缺少 LLM 环境变量：OPENAI_API_KEY");
    } finally {
      if (prevProvider === undefined) delete process.env.LLM_PROVIDER;
      else process.env.LLM_PROVIDER = prevProvider;
      if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prevKey;
    }
  });
});
