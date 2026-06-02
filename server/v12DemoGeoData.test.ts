import { describe, expect, it } from "vitest";

import {
  assetSections,
  demoArticles,
  demoMetrics,
  demoProject,
  diagnosisQuestions,
  disabledOperations,
  growthPath,
  monitoringRecords,
  publishRecords,
  reportSummary,
} from "../client/src/lib/demoGeoData";

describe("V1.2 外部只读 Demo 数据", () => {
  it("展示海豚知道样板项目的七个核心模块与指定指标", () => {
    expect(demoProject.name).toBe("海豚知道｜知识付费 SaaS / 企业 AI 经营系统");
    expect(growthPath).toEqual(["企业资产", "AI 诊断", "内容生产", "平台发布", "收录监测", "报告中心"]);
    expect(assetSections).toHaveLength(7);
    expect(diagnosisQuestions).toHaveLength(10);
    expect(demoArticles).toHaveLength(3);
    expect(publishRecords).toHaveLength(1);
    expect(monitoringRecords).toHaveLength(1);
    expect(reportSummary.risk).toContain("样本量有限");

    const metrics = Object.fromEntries(demoMetrics.map((metric) => [metric.label, metric.value]));
    expect(metrics["GEO 总分"]).toBe("25");
    expect(metrics["资料完整度"]).toBe("100%");
    expect(metrics["AI 可见度"]).toBe("30%");
    expect(metrics["AI 推荐率"]).toBe("20%");
    expect(metrics["指定问题"]).toBe("10 条");
    expect(metrics["AI 生成问题"]).toBe("50 条");
  });

  it("每篇 Demo GEO 内容都包含验收要求的生成依据、溯源、质检和引用片段", () => {
    expect(demoArticles.map((article) => article.type)).toEqual([
      "竞品对比文章",
      "产品能力说明文章",
      "行业选型指南文章",
    ]);

    for (const article of demoArticles) {
      expect(article.generatedBasis).toHaveLength(8);
      expect(article.factTrace.length).toBeGreaterThanOrEqual(3);
      expect(article.qualityScore).toBeGreaterThanOrEqual(80);
      expect(article.consistencyCheck).toContain("通过");
      expect(article.prePublishCheck).toContain("通过");
      expect(article.aiQuotableSnippets.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("只读 Demo 明确禁用所有写操作且保留公开内容页链接", () => {
    expect(disabledOperations).toEqual([
      "新建项目",
      "编辑资料",
      "上传资料",
      "生成文章",
      "重新生成",
      "发布",
      "删除",
      "保存",
      "人工修订",
      "更新监测状态",
    ]);
    expect(publishRecords[0].publicPath).toBe("/geo/content/1/180001");
  });
});
