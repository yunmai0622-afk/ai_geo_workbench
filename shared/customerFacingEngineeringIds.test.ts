import { describe, expect, it } from "vitest";
import {
  resolveEngineeringSourceLabel,
  sanitizeCustomerFacingEngineeringIds,
} from "./customerFacingEngineeringIds";

describe("customerFacingEngineeringIds", () => {
  it("replaces known engineering id markers with customer labels", () => {
    expect(sanitizeCustomerFacingEngineeringIds("source-graph:30036")).toBe("来自信源图谱建议");
    expect(sanitizeCustomerFacingEngineeringIds("优化方向 [source-graph:12]")).toBe(
      "优化方向 来自信源图谱建议",
    );
    expect(sanitizeCustomerFacingEngineeringIds("optimization_task:9")).toBe("来自优化任务");
    expect(sanitizeCustomerFacingEngineeringIds("article:42")).toBe("关联内容");
    expect(sanitizeCustomerFacingEngineeringIds("taskId:7")).toBe("来自优化任务");
    expect(sanitizeCustomerFacingEngineeringIds("questionId:3")).toBe("来自AI搜索问题");
  });

  it("falls back to AI diagnosis label for unknown id formats", () => {
    expect(sanitizeCustomerFacingEngineeringIds("foo_bar:99")).toBe("来自AI诊断");
  });

  it("resolves source label from generation reason", () => {
    expect(resolveEngineeringSourceLabel("方向说明 source-graph:30036")).toBe("来自信源图谱建议");
    expect(resolveEngineeringSourceLabel("普通诊断原因")).toBeNull();
  });
});
