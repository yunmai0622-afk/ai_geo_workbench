import { describe, expect, it } from "vitest";
import {
  buildGeoContentTaskDisplayName,
  GEO_CONTENT_TASK_NO_DIAGNOSIS_MESSAGE,
  hasGeoDiagnosisSourceData,
  parseGeoOptimizationTaskCard,
  resolveGeoContentTaskSource,
  buildWeeklyPlatformGenerationGoal,
  getWeeklyPlatformContentRole,
} from "./geoContentTaskSource";

describe("geoContentTaskSource", () => {
  const cardJson = JSON.stringify({
    articleTitle: "知识付费直播转化工具",
    keyPoints: ["转化", "工具"],
    targetKeywords: ["知识付费"],
    recommendedPlatform: ["小红书"],
    contentType: "场景指南",
  });

  const taskWithCard = {
    id: 10,
    taskName: "内容优化",
    priority: "P0",
    generationReason: "缺少直播间付费转化方案",
    executionSuggestion: `指引\n${"__GEO_TASK_CARD__"}\n${cardJson}`,
    expectedImpact: "围绕知识付费直播转化工具生成平台化内容资产。",
  };

  const analyses = [
    {
      contentGap: "缺少直播间付费转化提升工具的具体方案内容",
      notRecommendedReason: "当前品牌内容更多集中在 AI 经营系统介绍",
      questionText: "直播间知识付费转化率低，有什么工具能提升付费率？",
    },
    {
      contentGap: "缺少知识主播实际运营场景下的解决方案文章",
      notRecommendedReason: "垂直场景内容不足",
    },
  ];

  const questions = [
    {
      questionText: "直播间知识付费转化率低，有什么工具能提升付费率？",
      source: "manual",
    },
  ];

  it("有 AI 诊断任务时解析本轮 GEO 内容任务", () => {
    const source = resolveGeoContentTaskSource({
      tasks: [taskWithCard],
      analyses,
      questions,
    });
    expect(source).not.toBeNull();
    expect(source!.taskDisplayName).toBe(buildGeoContentTaskDisplayName("知识付费直播转化工具"));
    expect(source!.taskDisplayName).not.toContain("覆盖目标问题");
    expect(source!.linkedQuestion).toContain("知识付费");
    expect(source!.diagnosisFinding).toContain("AI 经营系统");
    expect(source!.contentGaps.length).toBeGreaterThanOrEqual(2);
    expect(source!.contentTaskId).toBe(10);
  });

  it("无诊断数据时返回 null", () => {
    expect(hasGeoDiagnosisSourceData([], [])).toBe(false);
    expect(
      resolveGeoContentTaskSource({
        tasks: [],
        analyses: [],
        questions: [],
      }),
    ).toBeNull();
    expect(GEO_CONTENT_TASK_NO_DIAGNOSIS_MESSAGE).toContain("AI 实测诊断");
  });

  it("各平台角色与生成目标不同但围绕同一关联问题", () => {
    const source = resolveGeoContentTaskSource({
      tasks: [taskWithCard],
      analyses,
      questions,
    })!;
    const xhs = buildWeeklyPlatformGenerationGoal("xiaohongshu", source.linkedQuestion, source.sceneLabel);
    const zh = buildWeeklyPlatformGenerationGoal("zhihu", source.linkedQuestion, source.sceneLabel);
    expect(getWeeklyPlatformContentRole("xiaohongshu")).toBe("场景种草笔记");
    expect(getWeeklyPlatformContentRole("zhihu")).toBe("问题回答长文");
    expect(xhs).not.toBe(zh);
    expect(xhs).toContain(source.linkedQuestion.slice(0, 8));
  });

  it("解析任务卡片 JSON", () => {
    const card = parseGeoOptimizationTaskCard(taskWithCard.executionSuggestion);
    expect(card?.articleTitle).toBe("知识付费直播转化工具");
  });

  it("sanitizes source-graph engineering markers in customer-facing fields", () => {
    const source = resolveGeoContentTaskSource({
      tasks: [
        {
          ...taskWithCard,
          generationReason: "补充官网案例 source-graph:30036",
        },
      ],
      analyses: [],
      questions: [],
    });
    expect(source?.geoGapSummary).not.toContain("source-graph:");
    expect(source?.geoGapSummary).toContain("来自信源图谱建议");
    expect(source?.sourceLabel).toBe("来自信源图谱建议");
  });
});
