import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PLATFORM_CONTENT_RULES,
  PUBLISH_PLATFORM_IDS,
  formatPlatformRulesForPrompt,
  getPlatformSpecificOutline,
} from "@shared/platformContentRules";
import { generateThirdPartyMaterials } from "./geoArticleLogic";

const root = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf-8");

describe("GEO-V1-F 平台化内容策略", () => {
  it("存在 platform content rules 且五平台规则不同", () => {
    expect(PUBLISH_PLATFORM_IDS).toEqual([
      "xiaohongshu",
      "zhihu",
      "sohu",
      "toutiao",
      "baijiahao",
      "netease",
      "wechat",
      "other",
    ]);
    const outlines = PUBLISH_PLATFORM_IDS.map(id => getPlatformSpecificOutline(id, "测试品牌"));
    const unique = new Set(outlines);
    // 至少保证不同平台大纲不全相同（避免全平台回落知乎）
    expect(unique.size).toBeGreaterThanOrEqual(5);
    for (const id of PUBLISH_PLATFORM_IDS) {
      expect(formatPlatformRulesForPrompt(id)).toContain(PLATFORM_CONTENT_RULES[id].label);
    }
  });

  it("WeeklyContentPage 有目标发布平台选择与策略面板", () => {
    const weekly =
      read("client/src/pages/WeeklyContentPage.tsx") + read("client/src/components/PlatformContentStrategyPanel.tsx");
    expect(weekly).toContain("平台化内容策略");
    expect(weekly).toContain("PlatformContentStrategyPanel");
    expect(weekly).toContain("platform-content-strategy-panel");
    expect(weekly).toContain("targetPublishPlatform");
    expect(weekly).toContain("geoEnhancementGoal");
    expect(weekly).toContain("contentStrategyType");
    for (const id of PUBLISH_PLATFORM_IDS) {
      expect(read("shared/platformContentRules.ts")).toContain(`id: "${id}"`);
    }
  });

  it("生成接口扩展 targetPlatform 等字段", () => {
    const routers = read("server/routers.ts");
    expect(routers).toContain("targetPublishPlatform: z.enum(PUBLISH_PLATFORM_IDS)");
    expect(routers).toContain("geoEnhancementGoal: z.enum(GEO_ENHANCEMENT_GOAL_OPTIONS)");
    expect(routers).toContain("platformStrategy");
    expect(read("server/geoArticleLogic.ts")).toContain("platformContentStrategy");
  });

  it("平台化生成不默认一稿多平台素材", () => {
    const materials = generateThirdPartyMaterials({
      project: {
        id: 1,
        enterpriseName: "测试企业",
        industry: "SaaS",
        website: "https://example.org",
        productIntro: "产品介绍",
        targetCustomers: "企业客户",
        coreSellingPoints: "卖点",
        competitorNames: [],
      },
      title: "测试标题",
      markdownContent: "# 测试\n\n## 直接回答\n\n正文",
      questions: [],
      task: { id: 1, taskName: "任务", generationReason: "原因", executionSuggestion: "建议" },
      basis: {
        customerQuestionId: 1,
        customerQuestion: "如何选型？",
        contentGap: "缺口",
        optimizationTaskId: 1,
        optimizationTask: "任务",
        notRecommendedReason: "未推荐",
        competitorGap: "差距",
        competitorNames: [],
        sourceAnalysisIds: [],
        sourceQuestionIds: [],
        manualReviewConclusion: "复核",
      },
      snippets: [],
      targetPublishPlatform: "zhihu",
    });
    expect(Object.keys(materials).sort()).toEqual(["GEO 内容页版", "知乎回答版"].sort());
    expect(materials).not.toHaveProperty("搜狐号版");
    expect(materials).not.toHaveProperty("百家号/头条号版");
  });

  it("不改发布逻辑、不恢复 Chrome 插件", () => {
    const blob = read("client/src/pages/WeeklyContentPage.tsx") + read("server/routers.ts");
    expect(blob).not.toMatch(/下载 Chrome 插件|browser-extension\.zip/);
    expect(blob).not.toContain("fake publish");
    expect(read("drizzle/schema.ts")).not.toContain("targetPublishPlatform");
  });

  it("Prompt 按平台分支而非单一硬编码框架", () => {
    const logic = read("server/geoArticleLogic.ts");
    expect(logic).toContain("getPlatformSpecificOutline");
    expect(logic).toContain("formatPlatformRulesForPrompt");
    expect(logic).toContain("平台化内容策略 — 必须遵守");
    expect(logic).not.toMatch(/所有平台共用同一/);
  });
});
