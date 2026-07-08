import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf-8");

describe("GEO-V1.1-Score-Explanation GEO评分权重说明", () => {
  it("共享文案与四项权重", () => {
    const shared = read("shared/geoScoreWeightExplanation.ts");
    expect(shared).toContain("品牌识别率");
    expect(shared).toContain("内容覆盖度");
    expect(shared).toContain("平台分布");
    expect(shared).toContain("AI推荐率");
    expect(shared).toContain("weightPercent: 30");
    expect(shared).toContain("weightPercent: 25");
    expect(shared).toContain("weightPercent: 20");
  });

  it("GEO 分说明保留在组件中，不嵌入客户服务首页", () => {
    const workspace = read("client/src/pages/EnterpriseWorkspacePage.tsx");
    expect(workspace).not.toContain("GeoScoreWeightExplanationHelp");
    expect(workspace).not.toContain("workspace-geo-score-metric");
    expect(read("client/src/components/project/ProjectSwitcher.tsx")).toContain(
      "project-switcher-geo-score-explanation",
    );
    expect(read("client/src/components/geo/GeoScoreWeightExplanationHelp.tsx")).toContain("GEO 评分说明");
  });
});
