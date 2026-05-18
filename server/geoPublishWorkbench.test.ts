import { describe, expect, it } from "vitest";
import { GEO_ARTICLE_MIN_PASS_SCORE } from "@shared/const";
import { buildPublishCheckSummary, projectPublishSummary, publishStatusForArticle } from "../client/src/pages/GeoPages";

const approvedBasis = {
  customerQuestion: "AI 搜索中如何选择企业 GEO 增长工具？",
  contentGap: "缺少可被 AI 摘取的官方结构化内容。",
  optimizationTaskName: "补齐 GEO 内容资产",
  notRecommendedReason: "缺少权威来源与 FAQ 结构。",
  competitorGap: "竞品已沉淀公开内容页。",
  humanRevisionConclusion: "人工确认可公开发布。",
};

const approvedScore = {
  totalScore: 86,
  blocked: false,
  blockReasons: [],
};

const approvedConsistency = {
  score: 88,
  publishAllowed: true,
  riskLevel: "低",
  blockReasons: [],
};

const approvedTraceability = [
  {
    factPoint: "平台内置 GEO 内容页用于沉淀官方结构化内容资产。",
    sourceName: "企业官网资料",
    sourceUrl: "/internal-source/company-profile",
    isPublic: true,
    manuallyConfirmed: true,
  },
];

describe("平台发布工作台规则", () => {
  it("按真实发布阶段计算平台发布页顶部状态引导", () => {
    expect(projectPublishSummary([], 0)).toMatchObject({
      stage: "内容发布",
      nextAction: "先生成高质量文章",
      ctaLabel: "去本周内容",
      ctaPath: "/weekly",
    });

    expect(projectPublishSummary([{ status: "允许发布" }], 0)).toMatchObject({
      stage: "内容发布",
      nextAction: "选择通过检查的文章发布到 公开内容页",
      ctaLabel: "发布到 公开内容页",
      ctaPath: "/content-publishing",
    });

    const publishedGuide = projectPublishSummary([{ status: "已发布" }, { status: "未检查" }], 7);
    expect(publishedGuide).toMatchObject({
      stage: "内容发布",
      nextAction: "进入收录监测，检查是否被收录、被 AI 提及、被 AI 推荐",
      ctaLabel: "进入收录监测",
      ctaPath: "/inclusion-monitoring",
    });
    expect(publishedGuide.risk).toContain("已发布 7 篇，另有 1 篇待检查或待审核");
  });

  it("发布前检查会阻断低分、一致性不足和未确认事实", () => {
    const lowQualityScore = GEO_ARTICLE_MIN_PASS_SCORE - 5;
    const lowConsistencyScore = GEO_ARTICLE_MIN_PASS_SCORE - 4;
    const summary = buildPublishCheckSummary(
      { totalScore: lowQualityScore, blocked: false, blockReasons: [] } as any,
      { score: lowConsistencyScore, publishAllowed: false, riskLevel: "中", blockReasons: [`一致性评分低于 ${GEO_ARTICLE_MIN_PASS_SCORE} 分。`] } as any,
      approvedBasis as any,
      [{ factPoint: "关键事实", sourceName: "", isPublic: true, manuallyConfirmed: false }] as any,
      "本文不包含绝对承诺。",
    );

    expect(summary.allowPublish).toBe(false);
    expect(summary.blockReasons).toEqual(expect.arrayContaining([
      `内容质量分低于 ${GEO_ARTICLE_MIN_PASS_SCORE} 分。`,
      `一致性评分低于 ${GEO_ARTICLE_MIN_PASS_SCORE} 分或未通过检查。`,
      "存在未确认事实，请先完成人工确认。",
      "存在缺少来源的关键事实。",
    ]));
    expect(publishStatusForArticle("draft", { totalScore: lowQualityScore, blocked: false } as any, summary)).toBe("质量未通过");
  });

  it("质量、一致性、事实溯源和生成依据全部通过时允许发布", () => {
    const summary = buildPublishCheckSummary(
      approvedScore as any,
      approvedConsistency as any,
      approvedBasis as any,
      approvedTraceability as any,
      "这是一篇经过人工确认、包含来源、没有风险表达的 GEO 内容。",
    );

    expect(summary.allowPublish).toBe(true);
    expect(summary.blockReasons).toHaveLength(0);
    expect(publishStatusForArticle("ready", approvedScore as any, summary)).toBe("允许发布");
    expect(publishStatusForArticle("已发布", approvedScore as any, summary, { needRetest: true })).toBe("待复测");
  });
});
