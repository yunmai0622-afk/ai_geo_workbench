import { describe, expect, it } from "vitest";
import {
  ENTERPRISE_INDUSTRY_OPTIONS,
  getPainOptionsForIndustry,
  industryPainPointOptions,
  resolveIndustryFromStored,
} from "@shared/enterpriseProfileIndustry";

describe("enterpriseProfileIndustry", () => {
  it("exposes at least 14 industry options", () => {
    expect(ENTERPRISE_INDUSTRY_OPTIONS.length).toBeGreaterThanOrEqual(14);
  });

  it("maps legacy industry values", () => {
    expect(resolveIndustryFromStored("知识付费").select).toBe("知识付费 / 教育培训");
    expect(resolveIndustryFromStored("未知行业").custom).toBe("未知行业");
  });

  it("changes pain options by industry", () => {
    const edu = getPainOptionsForIndustry("知识付费 / 教育培训");
    const saas = getPainOptionsForIndustry("企业服务 / SaaS");
    expect(edu).not.toEqual(saas);
    expect(edu.length).toBeGreaterThanOrEqual(5);
    expect(industryPainPointOptions["房产家居"]?.length).toBeGreaterThanOrEqual(5);
  });
});
