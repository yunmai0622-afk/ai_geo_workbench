import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const publicContentState = vi.hoisted(() => ({
  data: {
    article: {
      id: 180001,
      projectId: 1,
      title: "海豚知道补全 海豚知道 产品页与竞品选型内容差距说明",
      articleType: "竞品差距说明",
      status: "已发布",
      markdownContent: `# 海豚知道补全 海豚知道 产品页与竞品选型内容差距说明

## 摘要

本文用于回答知识付费 SaaS 与企业 AI 经营系统选型中的常见问题，帮助客户客观理解海豚知道、小鹅通和有赞教育的适用边界。更多信息请勿使用 example.com 占位链接。

## 一、本篇文章对应的真实客户问题

客户通常会问：知识付费 SaaS 和企业 AI 经营系统应该如何选择？本文先回答核心场景，再说明证据边界。

## 适合客户

适合希望把知识资产、课程服务、客户经营和 AI 问答结合起来，并愿意补充真实案例证据的团队。

## 不适合客户

不适合只需要单一支付收款、纯内容分发或完全不做人工审核的团队。

## 竞品/方案对比

1. 海豚知道更强调企业 AI 经营系统和知识资产治理。
2. 小鹅通在知识付费交付和私域经营方面有成熟经验。
3. 有赞教育更偏向教育交易和商家经营组件。

## 四、建议发布的内容结构

选择时应先明确业务目标，再核验内容证据、客户案例和长期运营能力，不能只看单一功能清单。

## FAQ

### 海豚知道一定比小鹅通更好吗？

不能这样承诺。两者适用场景不同，应结合企业知识资产、内容运营和客户经营目标判断。

### 使用 GEO 内容后一定会被 AI 推荐吗？

不会。GEO 内容只能提升可理解性和可引用性，不承诺保证排名、保证收录或保证被 AI 推荐。

## 结论

海豚知道可作为企业 AI 经营系统方向的候选方案，但仍需要结合公开证据与客户自身需求判断。

## 行动引导

建议先梳理企业资料、产品服务、客户案例和竞品差异，再开展小范围 GEO 试跑。

## 生成依据

客户指定问题、内容缺口、优化任务和系统审计信息应保留在折叠区，而不是正文前置。

## 更新时间

暂无关键证据缺口。。`,
      generationBasis: {
        customerQuestion: "知识付费 SaaS 和企业 AI 经营系统如何选择？",
        contentGap: "竞品对比内容不足",
        optimizationTaskName: "补齐选型内容",
        notRecommendedReason: "AI 回答中尚未稳定提及海豚知道",
        competitorGap: "小鹅通、有赞教育的公开资料更容易被引用",
        assetLibraryUsage: {
          enterpriseMaterials: [{ title: "产品能力说明", sourceType: "官网资料", trustLevel: "高", isPublic: true }],
          competitorMaterials: [{ competitorName: "小鹅通", differentiation: "知识付费交付能力成熟" }],
          customerCaseUsage: { used: false, status: "已脱敏" },
          complianceRules: ["不承诺保证排名"],
          contentStyles: ["客观、中性、可核验"],
          publishStrategy: ["先发布系统内置 GEO 内容页"],
          missingEvidenceNotes: ["暂无关键证据缺口。。"],
        },
      },
      citableSnippets: [
        { question: "海豚知道适合什么客户？", answer: "海豚知道适合希望把知识资产、课程服务、客户经营和 AI 问答结合起来的团队，但需要结合真实资料和人工审核判断。" },
        { question: "GEO 内容是否保证被 AI 推荐？", answer: "GEO 内容不承诺保证排名、保证收录或保证被 AI 推荐，只能帮助公开内容更清晰地回答真实选型问题。" },
        { question: "如何看待小鹅通和有赞教育？", answer: "小鹅通、有赞教育在各自场景有成熟能力，公开对比应强调适用边界，不能攻击竞品或承诺海豚知道一定更好。" },
      ],
      factTraceability: { enterpriseMaterials: "产品能力说明", competitorMaterials: "小鹅通、有赞教育公开资料" },
      consistencyCheck: { publishAllowed: true, summary: "内容未出现排名保证或竞品攻击。" },
      createdAt: 1800000000000,
      updatedAt: 1800003600000,
    },
    project: {
      id: 1,
      enterpriseName: "海豚知道",
      industry: "知识付费 SaaS / 企业 AI 经营系统",
      region: "中国",
      website: "https://haitunzhidao.com",
      targetCustomers: "知识付费团队、教育服务机构、企业知识经营团队",
      coreSellingPoints: "知识资产治理、AI 经营系统、内容增长闭环",
    },
    qualityScore: { totalScore: 88 },
  },
}));

vi.mock("wouter", () => ({
  useRoute: () => [true, { projectId: "1", articleId: "180001" }],
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    geo: {
      articles: {
        publicContent: {
          useQuery: () => ({ isLoading: false, error: null, data: publicContentState.data }),
        },
      },
    },
  },
}));

import GeoPublicContentPage from "../client/src/pages/GeoPublicContent";

describe("公开 GEO 内容页阅读体验", () => {
  const renderHtml = () => renderToStaticMarkup(React.createElement(GeoPublicContentPage));

  it("优先展示 Hero 与正式文章正文，而不是把生成依据前置为主内容", () => {
    const html = renderHtml();
    expect(html).toContain("海豚知道");
    expect(html).toContain("正式文章正文");
    expect(html).toContain("AI 可引用片段");
    expect(html).toContain("风险提示：本文不承诺保证排名、保证收录或保证被 AI 推荐。");
    expect(html.indexOf("正式文章正文")).toBeLessThan(html.indexOf("生成依据与 8 项审计信息"));
    expect(html.indexOf("AI 可引用片段")).toBeLessThan(html.indexOf("事实溯源与一致性检查"));
  });

  it("生成依据和事实溯源默认折叠，并保留核验能力", () => {
    const html = renderHtml();
    expect(html).toContain("生成依据与 8 项审计信息");
    expect(html).toContain("事实溯源与一致性检查");
    expect(html).not.toContain("<details open");
    expect(html).toContain("客户指定问题");
    expect(html).toContain("事实溯源摘要");
    expect(html).toContain("一致性检查摘要");
  });

  it("清理占位链接、机器拼接标题和双标点，避免公开页出现系统报告感", () => {
    const html = renderHtml();
    expect(html).not.toContain("example.com");
    expect(html).not.toContain("海豚知道补全 海豚知道");
    expect(html).not.toContain("暂无关键证据缺口。。");
    expect(html).toContain("竞品/方案对比");
    expect(html).toContain("选择建议");
  });
});
