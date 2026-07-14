import { useAuth } from "@/_core/hooks/useAuth";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { trpc } from "@/lib/trpc";
import { BRAND_TRUTH_CATEGORIES, BRAND_TRUTH_STATUS_LABELS, type BrandTruthVerificationStatus } from "@shared/brandTruth";
import { UNDERSTANDING_STATUS_LABELS, type UnderstandingFieldStatus } from "@shared/understandingEngine";
import { AlertTriangle, ArrowRight, Brain, CheckCircle2, Clock3, ExternalLink, FileWarning, Network, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "尚未验证";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "尚未验证" : date.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function statusClass(status: string) {
  if (["accurate", "mostly_accurate", "official_verified", "third_party_verified", "multi_source_verified"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["inaccurate", "hallucinated", "conflicting"].includes(status)) return "border-red-200 bg-red-50 text-red-800";
  if (["outdated", "missing", "partially_accurate"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-gray-200 bg-gray-50 text-gray-700";
}

function EmptyPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center"><p className="font-medium text-gray-800">{title}</p><p className="mt-1 text-sm text-gray-500">{children}</p></div>;
}

export default function AIUnderstandingPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { selectedProjectId, selectedProject, projectsLoading } = useActiveProjectSelection();
  const query = trpc.geo.understanding.getUnderstandingSummary.useQuery(
    { projectId: selectedProjectId ?? 0 },
    { enabled: Boolean(selectedProjectId), retry: false },
  );
  const data = query.data;
  const canOperate = user?.role === "admin" || user?.role === "operator";

  useEffect(() => {
    document.title = `${selectedProject?.enterpriseName || "企业"} - AI 如何理解你的品牌`;
  }, [selectedProject?.enterpriseName]);

  if (!selectedProjectId && !projectsLoading) return <ProjectContextEmptyState title="AI 如何理解你的品牌" description="请先选择项目，再检查 AI 对品牌的理解是否准确。" />;
  if (query.isLoading || projectsLoading) return <div className="space-y-4" data-testid="ai-understanding-loading"><div className="h-40 animate-pulse rounded-2xl bg-gray-100"/><div className="grid gap-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-gray-100"/>)}</div></div>;
  if (query.isError || !data) return <section className="rounded-2xl border border-red-200 bg-red-50 p-6" data-testid="ai-understanding-error"><h1 className="font-semibold text-red-900">AI 品牌理解数据暂时无法读取</h1><p className="mt-2 text-sm text-red-700">{query.error?.message || "请稍后重试。"}</p><Button className="mt-4" variant="outline" onClick={() => query.refetch()}><RefreshCw className="mr-2 size-4"/>重新加载</Button></section>;

  const verifiedFacts = data.facts.filter(fact => ["official_verified", "third_party_verified", "multi_source_verified"].includes(fact.verificationStatus));
  const pendingFacts = data.facts.filter(fact => fact.verificationStatus === "provided_unverified" || fact.verificationStatus === "unknown");
  const activeIssues = data.evaluations.filter(evaluation => !["accurate", "mostly_accurate"].includes(evaluation.finalStatus));
  const primaryPath = data.severityCounts.P0 + data.severityCounts.P1 > 0 ? "/monthly-plan" : pendingFacts.length ? "/enterprise-profile" : "/inclusion-monitoring";
  const primaryLabel = data.severityCounts.P0 + data.severityCounts.P1 > 0 ? "查看本月纠偏计划" : pendingFacts.length ? "补充标准事实与证据" : "安排再次验证";

  return <div className="space-y-6 pb-12" data-testid="ai-understanding-page">
    <header className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-sm sm:p-8" data-testid="ai-understanding-hero">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-sky-300">Know → Understand → Trust → Recommend → Grow</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">AI 如何理解你的品牌</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">检查 AI 是否准确理解品牌是谁、做什么、服务谁，以及是否存在错误、过时或疑似虚构描述。被提及不等于被正确理解，被理解也不等于被信任或推荐。</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-right">
          <p className="text-xs text-slate-400">AI 品牌理解准确度</p>
          <p className="mt-1 text-3xl font-bold tabular-nums" data-testid="understanding-total-score">{data.totalScore == null ? "暂无法评估" : `${data.totalScore} 分`}</p>
          <p className="mt-1 text-xs text-slate-400">{data.dataSufficient ? "8 个维度数据完整" : `仍缺 ${data.missingDimensions.length} 个维度`}</p>
        </div>
      </div>
      <div className="mt-6 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4" data-testid="understanding-one-sentence"><p className="text-xs font-medium uppercase tracking-wide text-sky-300">一句话判断</p><p className="mt-2 text-base font-semibold leading-7">{data.oneSentenceConclusion}</p></div>
      <div className="mt-5 flex flex-wrap gap-3"><Button className="bg-white text-slate-950 hover:bg-slate-100" onClick={() => setLocation(buildProjectUrl(primaryPath, selectedProjectId!))}>{primaryLabel}<ArrowRight className="ml-2 size-4"/></Button>{canOperate && <Button variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10" onClick={() => setLocation(buildProjectUrl("/operations/brand-truth", selectedProjectId!))}>进入运营校准台</Button>}</div>
    </header>

    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6" data-testid="understanding-dimensions">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-gray-900">8 维理解准确度</h2><p className="mt-1 text-sm text-gray-500">每项分数都来自固定问题、当时版本的事实基线与字段级比对；数据不足时不显示假分。</p></div><div className="flex gap-2 text-xs"><span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">P0 {data.severityCounts.P0}</span><span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">P1 {data.severityCounts.P1}</span><span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">P2 {data.severityCounts.P2}</span></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.dimensionResults.map(dimension => <article key={dimension.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4" data-testid={`understanding-dimension-${dimension.id}`}><div className="flex items-start justify-between gap-2"><h3 className="font-medium text-gray-900">{dimension.label}</h3><span className="text-xs text-gray-400">权重 {dimension.weight}%</span></div><p className="mt-4 text-2xl font-bold tabular-nums text-gray-950">{dimension.score == null ? "—" : dimension.score}</p><span className={`mt-3 inline-flex rounded-full border px-2 py-0.5 text-xs ${statusClass(dimension.status)}`}>{UNDERSTANDING_STATUS_LABELS[dimension.status as UnderstandingFieldStatus] ?? "暂无法核验"}</span></article>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500"><span>最近验证：{formatDate(data.latestTestedAt)}</span><span>下一验证：{data.nextValidationAt ? formatDate(data.nextValidationAt) : "待安排"}</span><span>事实基线版本：V{data.profile?.currentVersion ?? "待建立"}</span><span>问题集版本：V{data.questionSet?.version ?? "待建立"}</span></div>
    </section>

    <section className="grid gap-5 lg:grid-cols-2">
      <article className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5" data-testid="understanding-current-summary"><div className="flex items-center gap-2"><Brain className="size-5 text-blue-700"/><h2 className="font-semibold text-gray-900">AI 当前如何理解品牌</h2></div>{data.evaluations.length ? <div className="mt-4 space-y-3">{data.evaluations.slice(0, 5).map(evaluation => <div key={evaluation.id} className="rounded-xl bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-gray-500">问题 #{evaluation.questionId} · {evaluation.testedChannel}</p><span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(evaluation.finalStatus)}`}>{UNDERSTANDING_STATUS_LABELS[evaluation.finalStatus as UnderstandingFieldStatus]}</span></div><p className="mt-2 line-clamp-4 text-sm leading-6 text-gray-700">{evaluation.rawAnswer}</p><p className="mt-2 text-xs text-gray-400">依据事实基线 V{evaluation.truthProfileVersion} · 问题集 V{evaluation.questionSetVersion}</p></div>)}</div> : <div className="mt-4"><EmptyPanel title="尚未形成理解摘要">必须先完成事实公开核验，再执行真实 AI 理解测试。</EmptyPanel></div>}</article>

      <article className="rounded-2xl border border-red-100 bg-red-50/40 p-5" data-testid="understanding-issues"><div className="flex items-center gap-2"><FileWarning className="size-5 text-red-700"/><h2 className="font-semibold text-gray-900">理解错误与偏差</h2></div>{activeIssues.length ? <div className="mt-4 space-y-3">{activeIssues.map(issue => <div key={issue.id} className="rounded-xl border border-red-100 bg-white p-4" data-testid="understanding-issue-card"><div className="flex justify-between gap-2"><span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(issue.finalStatus)}`}>{UNDERSTANDING_STATUS_LABELS[issue.finalStatus as UnderstandingFieldStatus]}</span><span className="text-xs font-semibold text-red-700">{issue.severity}</span></div><p className="mt-3 text-sm text-gray-700">AI 原始表达已保留，待运营结合事实、证据和语义完成复核。</p><p className="mt-2 text-xs text-gray-500">影响 Understand 阶段；P0/P1 在人工确认前不自动生成效果结论。</p></div>)}</div> : <div className="mt-4"><EmptyPanel title="暂无已确认偏差">{data.latestTestedAt ? "当前没有已确认严重偏差，但这不代表 AI 已完全理解品牌。" : "尚未执行理解测试，不能判断是否存在错误、过时或疑似虚构描述。"}</EmptyPanel></div>}</article>
    </section>

    <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6" data-testid="brand-truth-baseline">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-emerald-700"/><h2 className="text-lg font-semibold text-gray-900">品牌标准事实基线</h2></div><p className="mt-1 text-sm text-gray-500">企业录入不是已验证事实。只有关联可访问、已审核的官方或第三方证据后，才进入核验状态。</p></div><span className={`rounded-full border px-3 py-1 text-xs ${data.profilePersisted ? "border-blue-200 bg-blue-50 text-blue-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{data.profilePersisted ? `正式基线 V${data.profile?.currentVersion}` : "事实基线待确认"}</span></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">{BRAND_TRUTH_CATEGORIES.map(category => { const facts = data.facts.filter(fact => fact.category === category.id); return <article key={category.id} className="rounded-2xl border border-gray-100 p-4"><h3 className="font-medium text-gray-900">{category.label}</h3><p className="mt-1 text-xs text-gray-500">{category.question}</p>{facts.length ? <div className="mt-3 divide-y divide-gray-100">{facts.map(fact => <div key={`${fact.id}-${fact.factKey}`} className="py-3"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-gray-400">{fact.factKey}</p><p className="mt-1 text-sm leading-6 text-gray-800">{fact.factValue}</p></div><span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${statusClass(fact.verificationStatus)}`}>{BRAND_TRUTH_STATUS_LABELS[fact.verificationStatus as BrandTruthVerificationStatus]}</span></div><p className="mt-1 text-xs text-gray-400">证据 {fact.sourceCount ?? 0} · 冲突 {fact.conflictCount ?? 0} · 版本 V{fact.version}</p></div>)}</div> : <p className="mt-4 text-sm text-gray-400">该类事实尚未提供。</p>}</article>; })}</div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs text-emerald-700">已核验事实</p><p className="mt-1 text-2xl font-bold text-emerald-900">{verifiedFacts.length}</p></div><div className="rounded-xl bg-amber-50 p-4"><p className="text-xs text-amber-700">待核验事实</p><p className="mt-1 text-2xl font-bold text-amber-900">{pendingFacts.length}</p></div><div className="rounded-xl bg-red-50 p-4"><p className="text-xs text-red-700">来源冲突 / 过时</p><p className="mt-1 text-2xl font-bold text-red-900">{data.conflicts.filter(item => item.resolutionStatus !== "resolved").length + data.facts.filter(fact => fact.verificationStatus === "outdated").length}</p></div></div>
    </section>

    <section className="grid gap-5 lg:grid-cols-2">
      <article className="rounded-2xl border border-gray-200 bg-white p-5" data-testid="brand-truth-evidence"><div className="flex items-center gap-2"><Network className="size-5 text-violet-700"/><h2 className="font-semibold text-gray-900">公开证据来源</h2></div>{data.evidence.length ? <div className="mt-4 space-y-3">{data.evidence.map(evidence => <div key={evidence.id} className="rounded-xl border border-gray-100 p-4"><div className="flex justify-between gap-3"><div><p className="font-medium text-gray-900">{evidence.title}</p><p className="mt-1 text-xs text-gray-500">{evidence.evidenceType} · {evidence.sourceClass === "official" ? "官方来源" : evidence.sourceClass === "third_party" ? "第三方来源" : "待确认来源"}</p></div><span className={`h-fit rounded-full border px-2 py-0.5 text-xs ${evidence.verificationStatus === "verified" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{evidence.verificationStatus === "verified" ? "已核验" : "待核验"}</span></div>{evidence.url && <a href={evidence.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center text-xs font-medium text-blue-700 hover:underline">查看公开来源<ExternalLink className="ml-1 size-3"/></a>}</div>)}</div> : <div className="mt-4"><EmptyPanel title="尚未关联公开证据">优先补官网定义页、FAQ、Schema 与独立第三方资料，而不是默认生成文章。</EmptyPanel></div>}</article>
      <article className="rounded-2xl border border-gray-200 bg-white p-5" data-testid="brand-truth-conflicts"><div className="flex items-center gap-2"><AlertTriangle className="size-5 text-amber-700"/><h2 className="font-semibold text-gray-900">来源冲突与过时信息</h2></div>{data.conflicts.length ? <div className="mt-4 space-y-3">{data.conflicts.map(conflict => <div key={conflict.id} className="rounded-xl border border-amber-100 bg-amber-50/50 p-4"><div className="flex justify-between gap-3"><p className="font-medium text-gray-900">{conflict.factKey}</p><span className="text-xs font-semibold text-amber-800">{conflict.severity}</span></div><p className="mt-2 text-sm text-gray-600">{conflict.conflictType}</p><p className="mt-2 text-xs text-gray-500">状态：{conflict.resolutionStatus}</p></div>)}</div> : <div className="mt-4"><EmptyPanel title="暂无已记录来源冲突">这表示尚未记录冲突，不代表所有公开来源已经一致。</EmptyPanel></div>}</article>
    </section>

    <section className="rounded-2xl border border-gray-200 bg-white p-5" data-testid="understanding-consistency"><h2 className="font-semibold text-gray-900">一致性与趋势验证</h2><div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-gray-50 p-4"><p className="text-sm font-medium text-gray-900">跨问题一致性</p><p className="mt-2 text-sm leading-6 text-gray-600">{data.evaluations.length > 1 ? "已有多问题回答，可由运营复核表达是否一致。" : "数据不足，尚不能形成跨问题一致性结论。"}</p></div><div className="rounded-xl bg-gray-50 p-4"><p className="text-sm font-medium text-gray-900">跨模型一致性</p><p className="mt-2 text-sm leading-6 text-gray-600">{data.crossModelConclusion}</p></div><div className="rounded-xl bg-gray-50 p-4"><p className="text-sm font-medium text-gray-900">跨时间趋势</p><p className="mt-2 text-sm leading-6 text-gray-600">{data.trendConclusion}</p></div></div></section>

    <section className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5" data-testid="understanding-correction-tasks"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-gray-900">理解纠偏任务</h2><p className="mt-1 text-sm text-gray-500">纠偏不会默认转成文章；官网、FAQ、Schema、案例、第三方资料和复测都是正式动作。</p></div><Clock3 className="size-5 text-blue-700"/></div>{data.correctionTasks.length ? <div className="mt-4 grid gap-3 lg:grid-cols-2">{data.correctionTasks.map(task => <article key={task.id} className="rounded-xl bg-white p-4"><div className="flex justify-between gap-3"><p className="font-medium text-gray-900">{task.actionDescription}</p><span className="text-xs font-semibold text-red-700">{task.priority}</span></div><p className="mt-2 text-sm text-gray-600">完成标准：{task.completionCriteria}</p><p className="mt-2 text-xs text-gray-400">{task.recommendedAssetType} · {task.actionType} · {task.status}</p></article>)}</div> : <div className="mt-4"><EmptyPanel title="尚无已确认纠偏任务">需要先完成真实理解测试和 P0/P1 人工复核，再生成对应资产动作。</EmptyPanel></div>}</section>

    <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm leading-6 text-gray-700" data-testid="understanding-method-note"><div className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-700"/><h2 className="font-semibold text-gray-900">判断方法与边界</h2></div><p className="mt-2">系统采用品牌事实基线、公开证据、确定性规则、结构化抽取、模型语义辅助和人工复核。没有提到不会自动判错；同义表达不会自动判错；未核验的企业自述不能作为绝对真相；没有公开证据时不能直接判“疑似虚构”。理解准确度与提及率、推荐率、信任分和品牌资产总分分别计算。</p></section>
  </div>;
}
