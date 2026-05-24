import { describe, expect, it } from "vitest";
import {
  accountGroupsMismatch,
  formatArticleStrategySummary,
  getAccountGroupLabel,
  getContentAssetTypeLabel,
  getPublishIdentityLabel,
} from "./contentStrategy";

describe("contentStrategy", () => {
  it("labels return Chinese names", () => {
    expect(getContentAssetTypeLabel("seeding")).toBe("种草推荐型");
    expect(getPublishIdentityLabel("employee")).toBe("员工号");
    expect(getAccountGroupLabel("employee_group")).toBe("员工账号组");
  });

  it("formatArticleStrategySummary shows unset when empty", () => {
    expect(formatArticleStrategySummary({})).toBe("未设置策略");
    expect(
      formatArticleStrategySummary({
        contentStrategyType: "seeding",
        publishIdentity: "employee",
        recommendedAccountGroup: "employee_group",
      }),
    ).toBe("种草推荐型 · 员工号 · 员工账号组");
  });

  it("accountGroupsMismatch detects difference", () => {
    expect(accountGroupsMismatch("official_group", "seeding_group")).toBe(true);
    expect(accountGroupsMismatch("official_group", "official_group")).toBe(false);
    expect(accountGroupsMismatch(null, "official_group")).toBe(false);
  });
});
