import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLATFORM_PRODUCT_NAME } from "@/components/auth/authMarketing";
import { GEO_PRODUCT_MAIN_POSITIONING, GEO_PRODUCT_SUB_POSITIONING } from "@/lib/geoProductPositioning";
import { GEO_UNIFIED_MAIN_PIPELINE_STEPS } from "@shared/workspaceMainChain";
import { useEffect } from "react";

const WHY_GEO_POINTS = [
  "越来越多客户通过豆包、Kimi、DeepSeek 等 AI 问答获取选型建议，品牌若未被提及或推荐，会错失高意向线索。",
  "传统 SEO 与投放难以直接改善 AI 回答中的品牌可见度，需要围绕 AI 引用逻辑建设可检索、可引用的内容资产。",
  "GEO 把「实测缺口 → 内容生产 → 质量审查 → 平台发布 → 收录监测 → 交付复盘」串成可执行闭环，便于持续优化而非一次性投放。",
] as const;

const FAQ_ITEMS = [
  {
    question: "多久能看到效果？",
    answer:
      "通常需要完成至少一轮「发布 + 收录监测 + AI 复测」后才能对比变化。不同行业、平台与内容基础差异较大，一般建议以 4～8 周为观察窗口，以系统实测与监测记录为准，不承诺固定见效周期或排名结果。",
  },
  {
    question: "需要发多少内容？",
    answer:
      "重质量、轻铺量。优先围绕 AI 实测发现的内容缺口与高意向问题生成内容，每周按计划产出并过质量审查即可。数量应服务于缺口覆盖与平台策略，而不是盲目堆篇数。",
  },
  {
    question: "哪些平台效果最好？",
    answer:
      "优先自有官网 GEO 页面、微信公众号、知乎、百家号、头条号等易被 AI 检索与引用的阵地；小红书、搜狐号等可按行业补充。具体以企业目标客群常使用的 AI 入口与内容形态为准，在「平台适配发布」中按策略登记。",
  },
  {
    question: "如何判断内容质量？",
    answer:
      "结合系统质量分、事实确认、合规与反同质化检查；内容需能回答真实客户问题、引用可公开的企业资料，并避免空泛营销话术。未通过审查的内容不应发布，发布前后可通过收录监测与 AI 复测验证是否被引用或提及。",
  },
] as const;

export default function KnowledgePage() {
  useEffect(() => {
    document.title = `使用指南 - ${PLATFORM_PRODUCT_NAME}`;
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6" data-testid="knowledge-page">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">GEO 使用指南</h1>
        <p className="text-sm text-gray-500">了解 GEO 是什么、为什么做，以及如何按主链路推进项目</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">GEO 是什么</CardTitle>
          <CardDescription>Generative Engine Optimization，生成式引擎优化</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-gray-700">
          <p>
            <span className="font-medium text-gray-900">{GEO_PRODUCT_MAIN_POSITIONING}</span>
            ：帮助企业发现 AI 搜索与问答场景中的品牌可见性缺口，并持续建设可被 AI 理解、检索与引用的内容资产。
          </p>
          <p>{GEO_PRODUCT_SUB_POSITIONING}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">为什么要做 GEO</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-gray-700">
            {WHY_GEO_POINTS.map(point => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">主链路说明（8 步）</CardTitle>
          <CardDescription>按顺序推进，每步对应工作台中的具体功能模块</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {GEO_UNIFIED_MAIN_PIPELINE_STEPS.map((step, index) => (
              <li key={step.id} className="flex gap-3 text-sm" data-testid={`knowledge-step-${index + 1}`}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
                  {index + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="font-medium text-gray-900">{step.title}</p>
                  <p className="mt-1 leading-relaxed text-gray-600">{step.customerDescription}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">常见问题</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {FAQ_ITEMS.map(item => (
            <div key={item.question} className="border-b border-gray-100 pb-5 last:border-0 last:pb-0">
              <p className="text-sm font-medium text-gray-900">{item.question}</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.answer}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400">
        说明：本页为产品使用指引，不构成效果承诺。实测样本、收录与推荐结果以当前系统记录与人工复核为准。
      </p>
    </div>
  );
}
