import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CLIENT_PROJECT_LOW_GEO_SCORE_THRESHOLD,
  deriveClientProjectCardDisplay,
  deriveClientProjectPipelineBadgeLabel,
} from "../client/src/lib/projectWorkspaceDisplay";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1 ProjectCardFix", () => {
  it("ClientDashboardPage 展示完整阶段标签，不再包「第 X 步」", () => {
    const page = read("client/src/pages/ClientDashboardPage.tsx");
    expect(page).toContain("resolveClientProjectCardPrimaryAction");
    expect(page).toContain("{pipelineBadgeLabel}");
    expect(page).not.toMatch(/第\s*\{pipelineStep\}\s*步/);
  });

  it("已发布且已实测、GEO 分偏低时优先提示优化", () => {
    const result = deriveClientProjectCardDisplay({
      status: "score_done",
      articleCount: 3,
      publishCount: 2,
      aiTestCount: 1,
      latestGeoScore: 23,
    });
    expect(result.stageLabel).toBe("优化中");
    expect(result.nextStep).toContain("GEO 分偏低");
    expect(result.nextStep).not.toContain("查看交付报告或继续");
  });

  it("已发布且已实测、GEO 分达标时可查看交付报告", () => {
    const result = deriveClientProjectCardDisplay({
      status: "score_done",
      articleCount: 3,
      publishCount: 2,
      aiTestCount: 1,
      latestGeoScore: CLIENT_PROJECT_LOW_GEO_SCORE_THRESHOLD,
    });
    expect(result.stageLabel).toBe("报告已生成");
    expect(result.nextStep).toContain("查看交付报告");
  });

  it("pipeline 徽标与 stageLabel 一致", () => {
    expect(
      deriveClientProjectPipelineBadgeLabel({
        status: "score_done",
        articleCount: 1,
        publishCount: 1,
        aiTestCount: 1,
        latestGeoScore: 72,
      }),
    ).toBe("报告已生成");
  });
});
