import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1-UI-P1-B Weekly-Platform-Content", () => {
  const weekly = read("client/src/pages/WeeklyContentPage.tsx");
  const board = read("client/src/components/weekly/PlatformContentBoard.tsx");
  const panels = read("client/src/components/weekly/GeoContentTaskPanels.tsx");
  const sourceLib = read("shared/geoContentTaskSource.ts");

  it("首屏平台化内容生产结构", () => {
    expect(weekly).toContain("weekly-platform-content-page");
    expect(weekly).toContain("平台化内容资产");
    expect(weekly).not.toContain("当前企业：");
    expect(weekly).toContain("GeoContentTaskPanels");
    expect(panels).toContain("weekly-geo-content-task");
    expect(panels).toContain("weekly-ai-diagnosis-basis");
    expect(weekly).toContain("resolveGeoContentTaskSource");
    expect(weekly).toContain("contentTaskId:");
    expect(weekly).toContain("diagnosisFinding:");
    expect(weekly).toContain("geoGap:");
    expect(panels).toContain("本轮 GEO 内容任务");
    expect(panels).toContain("AI 诊断依据");
    expect(panels).toContain("诊断发现");
    expect(panels).toContain("内容缺口");
    expect(panels).toContain("推荐补齐");
    expect(weekly).not.toMatch(/本轮内容目标/);
    expect(weekly).not.toMatch(/内容策略来源/);
  });

  it("无诊断空状态", () => {
    expect(weekly).toContain("weekly-no-diagnosis");
    expect(weekly).toContain("GEO_CONTENT_TASK_NO_DIAGNOSIS_MESSAGE");
    expect(sourceLib).toContain("请先完成 AI 实测诊断");
    expect(weekly).toContain("去 AI 实测诊断");
  });

  it("平台矩阵与禁止一稿多发", () => {
    const defs = read("client/src/lib/weeklyPlatformBoard.ts");
    for (const label of ["小红书", "知乎", "百家号", "头条号", "搜狐号", "网易号", "公众号", "其他平台"]) {
      expect(defs).toContain(label);
    }
    expect(board).toContain("平台内容矩阵");
    expect(board).toContain("平台内容角色");
    expect(board).toContain("本平台生成目标");
    expect(board).toContain("生成该平台内容");
    expect(board).toContain("generatingPlatformKey === def.key");
    expect(board).toContain("不支持一稿多发");
    expect(weekly).toContain("不支持一稿多发");
    expect(weekly).toContain("platform-content-progress");
    expect(weekly).toContain("PLATFORM_CONTENT_PROGRESS_HINT_30S");
    expect(weekly).not.toMatch(/生成内容资产|生成数量/);
    expect(weekly).toContain("PlatformBatchGenerationPanel");
    expect(read("client/src/components/weekly/PlatformBatchGenerationPanel.tsx")).toContain(
      "一键生成所有平台内容",
    );
    expect(sourceLib).toContain("场景种草笔记");
    expect(sourceLib).toContain("问题回答长文");
  });

  it("内容卡片与真实质检分", () => {
    expect(weekly).toContain("WeeklyPlatformArticleCard");
    expect(weekly).toContain("resolveQualityCardView");
    expect(weekly).toContain("weekly-content-avg-quality");
    expect(read("shared/geoQualityScoreDisplay.ts")).toContain("优秀");
    expect(read("client/src/components/weekly/WeeklyPlatformArticleCard.tsx")).toContain(
      "weekly-card-quality-fail-hints",
    );
    expect(weekly).toContain("加入发布队列");
    expect(weekly).toContain("weekly-batch-enqueue-publish");
    expect(weekly).toContain("weekly-filter-platform");
    expect(weekly).toContain("getArticlePublishPlatform");
    expect(weekly).toContain("publish-dialog-platform-label");
    expect(weekly).not.toContain("rawAnswer");
  });

  it("任务名称不降级为覆盖目标问题", () => {
    expect(sourceLib).toContain("buildGeoContentTaskDisplayName");
    expect(sourceLib).toContain('补齐「');
    expect(sourceLib).not.toMatch(/覆盖目标问题.*taskDisplayName/);
  });
});
