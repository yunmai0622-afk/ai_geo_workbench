import { describe, expect, it, vi } from "vitest";
import {
  assertLlmConfiguredForDiagnosis,
  classifyGeoDiagnosisLlmError,
} from "@shared/geoDiagnosisLlmErrors";

vi.mock("@shared/llmEnvDiagnostics", () => ({
  diagnoseLlmProviderEnv: () => ({
    configured: false,
    missingEnvVars: ["OPENAI_API_KEY"],
    requiredEnvVars: ["OPENAI_API_KEY"],
    provider: "openai",
    model: "gpt-4o-mini",
  }),
  formatMissingLlmEnvServerLog: (vars: string[]) => `missing: ${vars.join(",")}`,
}));

describe("geoDiagnosisLlmErrors", () => {
  it("缺 LLM key 返回 LLM_NOT_CONFIGURED", () => {
    const pre = assertLlmConfiguredForDiagnosis();
    expect(pre?.code).toBe("LLM_NOT_CONFIGURED");
    const c = classifyGeoDiagnosisLlmError("OPENAI_API_KEY is not configured");
    expect(c.code).toBe("LLM_NOT_CONFIGURED");
    expect(c.userMessage).toMatch(/尚未配置/);
  });

  it("401 返回 LLM_AUTH_FAILED", () => {
    const c = classifyGeoDiagnosisLlmError("OpenAI LLM invoke failed status=401 unauthorized");
    expect(c.code).toBe("LLM_AUTH_FAILED");
    expect(c.userMessage).toMatch(/认证失败/);
  });

  it("timeout 返回 LLM_TIMEOUT", () => {
    const c = classifyGeoDiagnosisLlmError("OPENAI_TIMEOUT timed out after 120000ms");
    expect(c.code).toBe("LLM_TIMEOUT");
    expect(c.userMessage).toMatch(/超时/);
  });

  it("不再把任意 network 都映射为笼统超时文案的唯一出口", () => {
    const c = classifyGeoDiagnosisLlmError("OpenAI LLM network failure ECONNREFUSED");
    expect(c.code).toBe("LLM_NETWORK_ERROR");
    expect(c.userMessage).not.toBe(
      "内容诊断失败，可能是模型服务超时或网络暂时异常，请稍后重试。",
    );
  });
});
