import { describe, expect, it } from "vitest";
import { sanitizeCustomerFacingDataSourceLabel } from "./customerFacingDataSource";

describe("customerFacingDataSource", () => {
  it("replaces engineering table names in customer copy", () => {
    expect(sanitizeCustomerFacingDataSourceLabel("数据来源：ai_test_runs")).toBe("数据来源：AI 实测结果");
    expect(sanitizeCustomerFacingDataSourceLabel("基于本项目的发布任务（publish_tasks）统计")).toBe(
      "基于本项目的发布任务数据统计",
    );
  });
});
