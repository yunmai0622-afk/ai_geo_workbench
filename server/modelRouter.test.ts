import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelRouter, type ModelClient } from "./modelRouter";

describe("modelRouter", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("routes quality_review to volcengine by default (same as draft_generation)", () => {
    vi.stubEnv("QUALITY_REVIEW_MODEL", "");
    const volcengine: ModelClient = {
      name: "volcengine",
      call: vi.fn().mockResolvedValue('{"total":80}'),
    };
    const router = new ModelRouter({ volcengine });
    expect(router.getProviderForTask("draft_generation")).toBe("volcengine");
    expect(router.getProviderForTask("quality_review")).toBe("volcengine");
    expect(router.getModel("quality_review")).toBe(volcengine);
  });

  it("rejects unimplemented claude client with clear error", async () => {
    vi.stubEnv("QUALITY_REVIEW_MODEL", "claude");
    const router = new ModelRouter();
    await expect(router.callModel("quality_review", "test")).rejects.toThrow("Claude 模型即将支持");
  });

  it("rejects unimplemented gpt client with clear error", async () => {
    vi.stubEnv("QUALITY_REVIEW_MODEL", "gpt");
    const router = new ModelRouter();
    await expect(router.callModel("quality_review", "test")).rejects.toThrow("GPT 模型即将支持");
  });

  it("calls mocked client and returns string", async () => {
    const volcengine: ModelClient = {
      name: "volcengine",
      modelId: "test-model-id",
      call: vi.fn().mockResolvedValue("ok-response"),
    };
    const router = new ModelRouter({ volcengine });
    const resp = await router.callModel("quality_review", "user prompt", { systemPrompt: "sys" });
    expect(resp.text).toBe("ok-response");
    expect(resp).toMatchObject({ modelName: "volcengine", modelId: "test-model-id" });
    expect(volcengine.call).toHaveBeenCalledWith("user prompt", "sys");
  });
});
