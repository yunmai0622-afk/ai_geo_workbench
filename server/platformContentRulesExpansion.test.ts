import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AI_SEARCH_PLATFORM_OPTIONS,
  AI_VISIBILITY_TARGET_REGISTRY,
  PLATFORM_CONTENT_RULES,
  PUBLISH_PLATFORM_IDS,
  formatPlatformRulesForPrompt,
  formatTargetAiPlatformsForPrompt,
  getAiVisibilityTargetByLabel,
  normalizeTargetAiPlatforms,
} from "@shared/platformContentRules";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

function expectRuleSections(id: (typeof PUBLISH_PLATFORM_IDS)[number]) {
  const rule = PLATFORM_CONTENT_RULES[id];
  expect(rule.positioning.length).toBeGreaterThan(4);
  expect(rule.titleRules.length).toBeGreaterThan(0);
  expect(rule.bodyStructure.length).toBeGreaterThan(0);
  expect(rule.forbiddenPatterns.length).toBeGreaterThan(0);
  const prompt = formatPlatformRulesForPrompt(id);
  expect(prompt).toContain("平台定位");
  expect(prompt).toContain("标题规则");
  expect(prompt).toContain("正文结构");
  expect(prompt).toContain("禁止事项");
  expect(prompt).toContain("质检重点");
}

describe("platform content rules expansion P0", () => {
  for (const id of PUBLISH_PLATFORM_IDS) {
    it(`${id} 规则完整`, () => {
      expectRuleSections(id);
    });
  }

  it("小红书 Prompt 不含知乎问答体要求", () => {
    const p = formatPlatformRulesForPrompt("xiaohongshu");
    expect(p).toContain("禁止知乎长问答口吻");
    expect(p).not.toContain("先给结论");
  });

  it("搜狐 Prompt 不含小红书种草体", () => {
    const p = formatPlatformRulesForPrompt("sohu");
    expect(p).toContain("禁止小红书口语化");
    expect(p).not.toContain("生活方式、经验分享、种草");
    expect(p).not.toContain("收藏提示");
  });

  it("平台规则不会串平台", () => {
    const zh = formatPlatformRulesForPrompt("zhihu");
    const xhs = formatPlatformRulesForPrompt("xiaohongshu");
    expect(zh).toContain("【当前发布平台内容规则 — 知乎】");
    expect(xhs).toContain("【当前发布平台内容规则 — 小红书】");
    expect(zh).not.toContain("生活方式、经验分享、种草");
  });

  it("知乎规则强调数据、案例与 2000 字", () => {
    const zh = formatPlatformRulesForPrompt("zhihu");
    expect(zh).toContain("2000 字以上");
    expect(zh).toContain("具体数字");
    expect(zh).toContain("案例");
  });

  it("搜狐与百家号 Prompt 强调资讯时效", () => {
    expect(formatPlatformRulesForPrompt("sohu")).toMatch(/时效|资讯/);
    expect(formatPlatformRulesForPrompt("baijiahao")).toMatch(/时效|资讯/);
  });
});

describe("AI visibility targets expansion P0", () => {
  it.each(["豆包", "Kimi", "DeepSeek", "腾讯元宝", "文心一言", "通义千问", "秘塔 AI 搜索", "360 AI 搜索"])(
    "%s 存在",
    label => {
      expect(AI_SEARCH_PLATFORM_OPTIONS).toContain(label);
    },
  );

  it("讯飞星火可选存在", () => {
    expect(AI_SEARCH_PLATFORM_OPTIONS).toContain("讯飞星火");
  });

  it("旧数据仅 doubao/kimi/deepseek 兼容", () => {
    expect(normalizeTargetAiPlatforms(["豆包", "Kimi", "DeepSeek"])).toEqual([
      "豆包",
      "Kimi",
      "DeepSeek",
    ]);
  });

  it("未实测平台不显示为已实测", () => {
    const block = formatTargetAiPlatformsForPrompt(["腾讯元宝", "豆包"]);
    expect(block).toContain("豆包：已实测引擎");
    expect(block).toContain("腾讯元宝：可见度增强目标");
    expect(block).not.toMatch(/腾讯元宝：已实测/);
  });

  it("增强目标 registry 状态正确", () => {
    expect(getAiVisibilityTargetByLabel("豆包")?.status).toBe("tested");
    expect(getAiVisibilityTargetByLabel("通义千问")?.status).toBe("tested");
    expect(getAiVisibilityTargetByLabel("文心一言")?.status).toBe("tested");
    expect(getAiVisibilityTargetByLabel("腾讯元宝")?.status).toBe("enhancement");
    expect(getAiVisibilityTargetByLabel("ChatGPT")?.status).toBe("not_connected");
  });

  it("AI 诊断 Prompt 注入目标 AI 平台", () => {
    const routers = read("server/routers.ts");
    expect(routers).toContain("formatTargetAiPlatformsForPrompt(getDefaultTargetAiPlatforms())");
  });

  it("内容生成 Prompt 注入目标 AI 平台与平台规则", () => {
    const logic = read("server/geoArticleLogic.ts");
    expect(logic).toContain("formatTargetAiPlatformsForPrompt");
    expect(logic).toContain("formatPlatformRulesForPrompt");
    expect(logic).toContain("禁止一稿多平台");
    expect(logic).toContain("ensurePlatformDraftContentQuality");
    expect(logic).toContain("buildPlatformGenerationQualityPromptLines");
  });

  it("交付报告展示目标 AI 平台", () => {
    expect(read("server/geoLogic.ts")).toContain("formatTargetAiVisibilityReportSection");
  });

  it("UI 标题为可见度增强", () => {
    expect(read("client/src/components/PlatformContentStrategyPanel.tsx")).toContain(
      "目标 AI 平台（可见度增强）",
    );
    expect(read("client/src/components/PlatformContentStrategyPanel.tsx")).toContain(
      "未真实实测的平台不会显示为已实测",
    );
  });
});

describe("quality guard", () => {
  it("不跳过质检", () => {
    expect(read("server/routers.ts")).toContain("runGeoArticleQualityCheckFlow");
    expect(read("server/routers.ts")).not.toMatch(/skip.*质检|跳过质检/i);
  });

  it("平台矩阵能力保留", () => {
    expect(PUBLISH_PLATFORM_IDS.length).toBe(8);
    expect(AI_VISIBILITY_TARGET_REGISTRY.length).toBeGreaterThanOrEqual(9);
  });
});
