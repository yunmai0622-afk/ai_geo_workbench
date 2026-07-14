import { describe, expect, it } from "vitest";
import { AI_BRAND_ASSET_DEFINITION, BRAND_ASSET_STATUS, getBrandAssets, SAMPLE_210001_ZHIHU_URL } from "../shared/brandAssets";

describe("GEO V2.4 AI brand asset model", () => {
  it("defines six evidence-oriented asset categories", () => {
    const assets = getBrandAssets(210001);
    expect(assets).toHaveLength(6);
    expect(AI_BRAND_ASSET_DEFINITION).toContain("公开证据体系");
    for (const asset of assets) {
      expect(asset.evidence).toBeTruthy();
      expect(asset.gap).toBeTruthy();
      expect(asset.nextAction).toBeTruthy();
      expect(asset.page).toMatch(/^\//);
      expect(asset.verification).toBeTruthy();
      expect(asset.whyItMatters).toBeTruthy();
      expect(typeof asset.hasPublicEvidence).toBe("boolean");
      expect(typeof asset.verifiedByAiRetest).toBe("boolean");
    }
  });

  it("keeps sample 210001 claims honest", () => {
    const assets = getBrandAssets(210001);
    expect(assets.find(asset => asset.key === "trust")?.status).toBe(BRAND_ASSET_STATUS.INSUFFICIENT);
    expect(assets.find(asset => asset.key === "question")?.gap).toContain("尚无证据证明");
    expect(assets.find(asset => asset.key === "content")?.status).toBe(BRAND_ASSET_STATUS.TO_VERIFY);
    expect(assets.find(asset => asset.key === "retest")?.gap).toContain("正式 T2/T3 尚待执行");
    expect(SAMPLE_210001_ZHIHU_URL).toBe("https://zhuanlan.zhihu.com/p/2058633582978060994");
  });
});
