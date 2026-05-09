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
    <section className="geo-status-guide rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-5 text-slate-100 shadow-[0_0_34px_rgba(56,189,248,0.12)] backdrop-blur">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
              <CircleDotDashed className="h-3.5 w-3.5" /> 当前阶段：{stage}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
              <CheckCircle2 className="h-3.5 w-3.5" /> 当前完成度 {safeCompletion}%
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="flex items-center gap-2 text-xs font-medium text-cyan-200"><ArrowRight className="h-4 w-4" /> 下一步动作</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">{nextAction}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="flex items-center gap-2 text-xs font-medium text-violet-200"><Sparkles className="h-4 w-4" /> 为什么要做</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">{why}</p>
            </div>
            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
              <p className="flex items-center gap-2 text-xs font-medium text-amber-200"><AlertTriangle className="h-4 w-4" /> 风险提醒</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">{risk}</p>
            </div>
          </div>
        </div>
        {ctaLabel && ctaPath ? (
          <Button onClick={() => setLocation(ctaPath)} className="shrink-0 bg-cyan-400 text-slate-950 hover:bg-cyan-300">
            {ctaLabel}
          </Button>
        ) : null}
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400" style={{ width: `${safeCompletion}%` }} />
      </div>
    </section>
  );
}

export const pageGuides: Record<string, GeoStatusGuideProps> = {

  "总览指挥舱": {
    stage: "总览指挥舱",
    completion: 68,
    nextAction: "从当前项目与当前 GEO 阶段进入下一步动作，优先处理资产、诊断、内容或复测缺口。",
    why: "客户需要第一眼看到 GEO 增长闭环，而不是普通后台列表。",
    risk: "指标来自当前系统数据；缺少样本时必须提示待补齐，不能虚构成果。",
    ctaLabel: "补充企业资产",
    ctaPath: "/assets",
  },
  "企业资产": {
    stage: "企业资产",
    completion: 20,
    nextAction: "补充企业基础资料、产品服务资料、客户案例、竞品资料、合规规则和发布策略。",
    why: "企业资产是文章生成、质量评分和发布准入的事实来源。",
    risk: "资料不足时，系统不得编造案例、数据、价格和效果承诺。",
    ctaLabel: "开始补充企业资料",
    ctaPath: "/assets",
  },
  "AI 诊断": {
    stage: "AI 诊断",
    completion: 55,
    nextAction: "导入真实 AI 回答，完成语义分析和 GEO 评分，定位未提及、未推荐和竞品胜出原因。",
    why: "诊断结果决定内容机会池和优化任务，不能跳过真实问题与回答。",
    risk: "不得用模拟回答替代真实 AI 诊断样本。",
    ctaLabel: "查看内容策略",
    ctaPath: "/tasks",
  },
  "内容策略": {
    stage: "内容策略",
    completion: 72,
    nextAction: "把诊断缺口转化为可执行任务，并明确优先级、内容选题和复测指标。",
    why: "内容策略连接 AI 诊断与内容生产，避免随机写文章。",
    risk: "没有来源的任务会破坏诊断链路和客户交付可信度。",
    ctaLabel: "进入内容生产",
    ctaPath: "/articles",
  },
  "内容生产": {
    stage: "内容生产",
    completion: 82,
    nextAction: "从内容机会池生成文章，检查生成依据、GEO 内容质量评分和是否允许发布。",
    why: "客户需要确认每篇文章为什么写、解决哪个问题、是否达到发布标准。",
    risk: "低于 80 分、依据不足或存在合规阻断时禁止发布。",
    ctaLabel: "查看平台发布",
    ctaPath: "/publish",
  },
  "平台发布": {
    stage: "平台发布",
    completion: 86,
    nextAction: "确认第一优先级平台、第二优先级平台、不建议平台、发布注意事项和复测指标。",
    why: "平台选择影响内容形式和复测效果，不能把所有文章当普通发布列表处理。",
    risk: "第三方平台当前只生成素材，不自动登录发布。",
    ctaLabel: "进入收录监测",
    ctaPath: "/monitoring",
  },
  "报告中心": {
    stage: "报告中心",
    completion: 92,
    nextAction: "汇总诊断、内容、发布、收录监测、复测和客户交付报告。",
    why: "客户交付需要把 GEO 增长闭环串成可解释结果和下一步计划。",
    risk: "报告只能引用已确认事实，不承诺保证收录、排名或 AI 推荐。",
    ctaLabel: "查看收录监测",
    ctaPath: "/monitoring",
  },
  "项目管理": {
    stage: "项目建档",
    completion: 15,
    nextAction: "补齐企业名称、行业、官网、核心卖点与竞品，作为后续 AI 诊断的实体基础。",
    why: "AI 搜索判断品牌时首先识别实体、服务边界和竞争对象，项目资料越清晰，诊断问题越准确。",
    risk: "项目资料缺失会导致问题库偏泛、竞品比较失真，后续文章也缺少可信实体来源。",
    ctaLabel: "补充企业资产",
    ctaPath: "/assets",
  },
  "问题库": {
    stage: "AI 认知扫描",
    completion: 30,
    nextAction: "围绕品牌认知、行业推荐、竞品对比、痛点解决和价格选型生成问题库。",
    why: "问题库决定后续导入哪些 AI 回答，也决定是否能看见 AI 是否提及、是否推荐、推荐了哪些竞品。",
    risk: "问题太少或太泛会漏掉关键成交场景，诊断结论不能代表真实 GEO 风险。",
    ctaLabel: "导入 AI 回答",
    ctaPath: "/responses",
  },
  "AI 回答导入": {
    stage: "AI 认知扫描",
    completion: 42,
    nextAction: "导入 ChatGPT、DeepSeek、豆包、Kimi 等平台回答，进入 AI 语义分析。",
    why: "只有真实回答才能判断 AI 是否提及品牌、是否推荐竞品，以及未推荐的具体原因。",
    risk: "不要伪造 AI 回答；来源不明的回答会污染评分与后续内容策略。",
    ctaLabel: "开始语义分析",
    ctaPath: "/analysis",
  },
  "AI 语义分析": {
    stage: "AI 认知扫描",
    completion: 55,
    nextAction: "分析 AI 是否提及/推荐品牌、推荐竞品、未推荐原因、内容缺口与人工修订状态。",
    why: "语义分析把原始回答转化为可执行的 GEO 缺口，后续任务和文章都从这里继承依据。",
    risk: "人工修订必须保留原始依据；未确认事实不能被当作确定结论使用。",
    ctaLabel: "生成 GEO 评分",
    ctaPath: "/scores",
  },
  "GEO 评分": {
    stage: "AI 认知扫描",
    completion: 64,
    nextAction: "把提及、推荐、竞品压制、内容缺口和资产证据强度转成客户可理解的风险分。",
    why: "评分用于解释为什么要先补资料、写哪些内容、优先在哪些平台发布。",
    risk: "缺少事实来源、不可公开资料或合规风险会降低可信度，不能用高分掩盖未确认事实。",
    ctaLabel: "生成优化任务",
    ctaPath: "/tasks",
  },
  "优化工作台": {
    stage: "内容策略",
    completion: 72,
    nextAction: "把诊断缺口转为待处理任务，明确优先级、责任动作、复测时间和内容选题。",
    why: "客户需要看到不是随机写文章，而是每篇内容对应一个 GEO 缺口和复测指标。",
    risk: "任务没有来源会导致内容策略不可审计，也会破坏 P0.9 诊断链路。",
    ctaLabel: "进入内容生产",
    ctaPath: "/articles",
  },
  "客户交付中心": {
    stage: "报告中心",
    completion: 82,
    nextAction: "生成 GEO 诊断报告、内容发布报告、收录监测报告、复测报告与客户交付报告。",
    why: "报告是客户理解投入产出的交付物，需要把诊断、内容、发布和复测串成闭环。",
    risk: "报告只能引用系统中已有事实，不应承诺保证收录、保证排名或虚构效果数据。",
    ctaLabel: "查看内容生产",
    ctaPath: "/articles",
  },
  "文章发布": {
    stage: "内容生产 / 平台发布",
    completion: 86,
    nextAction: "生成 GEO 文章、查看资产库引用、完成质量评分和发布前检查，再复制/导出平台素材。",
    why: "每篇文章都要回答为什么写、解决哪个 GEO 问题、引用哪些企业资料、是否允许发布。",
    risk: "不可公开资料、编造案例、禁用词、保证收录或保证排名会阻断发布。",
    ctaLabel: "查看发布记录",
    ctaPath: "/monitoring",
  },
  "收录监测": {
    stage: "收录监测",
    completion: 90,
    nextAction: "记录内容是否被搜索收录、是否被 AI 提及或推荐，并把结果回流到下一轮内容优化。",
    why: "GEO 不是发布即结束，必须通过复测判断 AI 是否改变回答、是否仍被竞品压制。",
    risk: "当前不做自动抓取和定时任务；收录与排名不能保证，只能记录真实检测事实。",
    ctaLabel: "生成交付报告",
    ctaPath: "/reports",
  },
};
