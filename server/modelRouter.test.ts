import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelRouter, type ModelClient } from "./modelRouter";

describe("modelRouter", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("routes quality_review to deepseek by default", () => {
    vi.stubEnv("QUALITY_REVIEW_MODEL", "");
    const deepseek: ModelClient = {
      name: "deepseek",
      call: vi.fn().mockResolvedValue('{"total":80}'),
    };
    const router = new ModelRouter({ deepseek });
    expect(router.getProviderForTask("quality_review")).toBe("deepseek");
    expect(router.getModel("quality_review")).toBe(deepseek);
  });

  it("rejects unimplemented claude client with clear error", async () => {
    vi.stubEnv("QUALITY_REVIEW_MODEL", "claude");
    const router = new ModelRouter();
    await expect(router.callModel("quality_review", "test")).rejects.toThrow("Claude 模型暂未接入");
  });

  it("rejects unimplemented gpt client with clear error", async () => {
    vi.stubEnv("QUALITY_REVIEW_MODEL", "gpt");
    const router = new ModelRouter();
    await expect(router.callModel("quality_review", "test")).rejects.toThrow("GPT 模型暂未接入");
  });

  it("calls mocked client and returns string", async () => {
    const deepseek: ModelClient = {
      name: "deepseek",
      call: vi.fn().mockResolvedValue("ok-response"),
    };
    const router = new ModelRouter({ deepseek });
    const resp = await router.callModel("quality_review", "user prompt", { systemPrompt: "sys" });
    expect(resp.text).toBe("ok-response");
    expect(deepseek.call).toHaveBeenCalledWith("user prompt", "sys");
  });
});
