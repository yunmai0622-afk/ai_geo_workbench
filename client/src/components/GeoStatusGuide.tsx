import { AlertTriangle, ArrowRight, CheckCircle2, CircleDotDashed, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export type GeoStatusGuideProps = {
  stage: string;
  completion: number;
  nextAction: string;
  why: string;
  risk: string;
  ctaLabel?: string;
  ctaPath?: string;
};

export function GeoStatusGuide({ stage, completion, nextAction, why, risk, ctaLabel, ctaPath }: GeoStatusGuideProps) {
  const [, setLocation] = useLocation();
  const safeCompletion = Math.min(100, Math.max(0, completion));

  return (
    <section className="geo-status-guide ai-glass-card border-blue-200 p-5 text-gray-900 md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <CircleDotDashed className="h-3.5 w-3.5" /> 当前阶段：{stage}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> 当前完成度 {safeCompletion}%
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="flex items-center gap-2 text-xs font-medium text-blue-600"><ArrowRight className="h-4 w-4" /> 下一步动作</p>
              <p className="mt-2 text-sm leading-6 text-gray-700">{nextAction}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="flex items-center gap-2 text-xs font-medium text-violet-600"><Sparkles className="h-4 w-4" /> 为什么要做</p>
              <p className="mt-2 text-sm leading-6 text-gray-700">{why}</p>
            </div>
            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
              <p className="flex items-center gap-2 text-xs font-medium text-amber-200"><AlertTriangle className="h-4 w-4" /> 风险提醒</p>
              <p className="mt-2 text-sm leading-6 text-gray-700">{risk}</p>
            </div>
          </div>
        </div>
        {ctaLabel && ctaPath ? (
          <Button onClick={() => setLocation(ctaPath)} variant="ai" className="shrink-0">
            {ctaLabel}
          </Button>
        ) : null}
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400" style={{ width: `${safeCompletion}%` }} />
      </div>
    </section>
  );
}

export const pageGuides: Record<string, GeoStatusGuideProps> = {
  "总览": {
    stage: "总览",
    completion: 60,
    nextAction: "根据当前项目状态点击继续下一步，按企业档案、内容诊断、内容生成、内容发布、收录监测、交付报告推进。",
    why: "客户需要看到一条可购买、可理解、可交付的主流程，而不是分散的后台工具入口。",
    risk: "指标只引用当前系统数据；样本不足时必须提示风险，不能虚构效果。",
    ctaLabel: "继续下一步",
    ctaPath: "/enterprise-profile",
  },
  "企业档案": {
    stage: "企业档案",
    completion: 20,
    nextAction: "补齐企业基础资料、产品服务资料、客户案例、竞品资料、合规规则和发布策略。",
    why: "企业档案是诊断、内容生成和发布准入的事实来源。",
    risk: "资料不足时不得编造案例、数据、价格和效果承诺。",
    ctaLabel: "补齐企业档案",
    ctaPath: "/enterprise-profile",
  },
  "内容诊断": {
    stage: "内容诊断",
    completion: 42,
    nextAction: "围绕客户问题导入 AI 回答，生成诊断结果、内容缺口和下一步建议。",
    why: "诊断结果决定后续内容写什么、补什么证据以及如何解释竞品差距。",
    risk: "不得用模拟回答替代真实样本；样本量有限时不能代表全网绝对排名。",
    ctaLabel: "进入内容生成",
    ctaPath: "/content-generation",
  },
  "内容生成": {
    stage: "内容生成",
    completion: 64,
    nextAction: "优先生成竞品对比文章、产品能力说明文章、行业选型 / FAQ 文章，并查看发布准入状态。",
    why: "内容生成应直接回应诊断缺口和客户高意向问题，而不是随机铺量。",
    risk: "质量分、事实确认或合规检查未通过时禁止发布。",
    ctaLabel: "进入内容发布",
    ctaPath: "/content-publishing",
  },
  "内容发布": {
    stage: "内容发布",
    completion: 78,
    nextAction: "只处理可发布内容和已发布内容；第三方平台素材放在折叠区，当前只生成素材不自动登录发布。",
    why: "发布页要让客户确认哪些内容能上线、哪些内容被阻断以及阻断原因。",
    risk: "不保存第三方平台明文凭证，不代替客户登录外部平台发布。",
    ctaLabel: "进入收录监测",
    ctaPath: "/inclusion-monitoring",
  },
  "收录监测": {
    stage: "收录监测",
    completion: 88,
    nextAction: "查看已发布内容的收录、AI 提及、AI 推荐、最近检测时间和当前建议。",
    why: "发布不是终点，监测结果决定是否进入复测和优化。",
    risk: "系统不承诺保证收录、保证排名或保证被 AI 推荐。",
    ctaLabel: "生成交付报告",
    ctaPath: "/delivery-reports",
  },
  "交付报告": {
    stage: "交付报告",
    completion: 96,
    nextAction: "交付 内容诊断报告、内容生产报告、发布监测报告和复测优化报告。",
    why: "报告把建档、诊断、内容、发布和监测串成客户可解释结果。",
    risk: "报告只能引用已确认事实，不承诺保证收录、排名或 AI 推荐。",
    ctaLabel: "返回总览",
    ctaPath: "/",
  },
  "项目管理": { stage: "企业档案", completion: 20, nextAction: "补齐企业档案六类资料。", why: "旧路径兼容到 V1.2 企业档案。", risk: "资料不足时不得进入对外承诺。", ctaLabel: "补齐企业档案", ctaPath: "/enterprise-profile" },
  "问题库": { stage: "内容诊断", completion: 35, nextAction: "整理客户问题并导入 AI 回答。", why: "客户问题是诊断入口。", risk: "样本不足时需提示风险。", ctaLabel: "进入内容诊断", ctaPath: "/ai-diagnosis" },
  "AI 回答导入": { stage: "内容诊断", completion: 42, nextAction: "导入 AI 回答并生成诊断结果。", why: "真实回答决定诊断可信度。", risk: "不得伪造 AI 回答。", ctaLabel: "进入内容诊断", ctaPath: "/ai-diagnosis" },
  "AI 语义分析": { stage: "内容诊断", completion: 50, nextAction: "把回答转化为诊断结果和内容缺口。", why: "分析结果支撑内容生成。", risk: "人工修订必须保留依据。", ctaLabel: "进入内容生成", ctaPath: "/content-generation" },
  "内容评分": { stage: "内容诊断", completion: 56, nextAction: "根据诊断结果形成评分。", why: "评分用于解释优先级。", risk: "不能用高分掩盖资料缺口。", ctaLabel: "进入内容生成", ctaPath: "/content-generation" },
  "优化工作台": { stage: "内容生成", completion: 64, nextAction: "把缺口转成三类推荐内容。", why: "旧路径兼容到内容生成。", risk: "任务没有来源时不得发布。", ctaLabel: "进入内容生成", ctaPath: "/content-generation" },
  "客户交付中心": { stage: "交付报告", completion: 92, nextAction: "生成四类交付报告。", why: "客户需要闭环交付物。", risk: "不承诺保证排名或收录。", ctaLabel: "查看交付报告", ctaPath: "/delivery-reports" },
  "文章发布": { stage: "内容发布", completion: 78, nextAction: "查看可发布内容和已发布内容。", why: "旧路径兼容到内容发布。", risk: "第三方平台只生成素材不自动登录发布。", ctaLabel: "进入内容发布", ctaPath: "/content-publishing" },
};
