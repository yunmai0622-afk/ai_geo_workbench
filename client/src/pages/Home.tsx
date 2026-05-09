import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Brain, Building2, CheckCircle2, ClipboardList, FileBarChart2, FileText, Gauge, RadioTower, Send, ShieldCheck, Sparkles, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const statusLabels: Record<string, string> = {
  created: "项目已建档",
  questions_ready: "诊断问题已就绪",
  responses_imported: "AI 回答已导入",
  analysis_done: "诊断结果已生成",
  score_done: "质量评分已完成",
  tasks_ready: "内容任务已生成",
  report_ready: "交付报告已就绪",
};

const workflowSteps = [
  { label: "企业档案", desc: "补齐企业基础、产品服务、客户案例、竞品、合规与发布策略", icon: Building2, path: "/enterprise-profile" },
  { label: "AI 诊断", desc: "围绕客户问题读取 AI 回答，形成诊断结果和内容缺口", icon: Brain, path: "/ai-diagnosis" },
  { label: "内容生成", desc: "生成竞品对比、产品能力说明、行业选型或 FAQ 内容", icon: FileText, path: "/content-generation" },
  { label: "内容发布", desc: "确认可发布内容、已发布内容和第三方平台素材", icon: Send, path: "/content-publishing" },
  { label: "收录监测", desc: "记录收录、AI 提及、AI 推荐和最近检测时间", icon: RadioTower, path: "/inclusion-monitoring" },
  { label: "交付报告", desc: "整理诊断、内容、发布监测与复测优化交付物", icon: FileBarChart2, path: "/delivery-reports" },
];

const toBool = (value: unknown) => value === true || value === 1;
const pct = (value: number, total: number) => total > 0 ? Math.round((value / total) * 100) : 0;

function MetricCard({ title, value, desc, icon: Icon }: { title: string; value: string; desc: string; icon: typeof Sparkles }) {
  return (
    <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/66 p-4 text-slate-100 shadow-[0_0_22px_rgba(56,189,248,0.10)]">
      <div className="flex items-center justify-between gap-3"><p className="text-sm text-slate-300">{title}</p><Icon className="h-4 w-4 text-cyan-200" /></div>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{desc}</p>
    </div>
  );
}

function currentStepIndex(args: { completionScore: number; analyses: unknown[]; generatedArticles: number; publishedArticles: number; records: unknown[]; reportReady: boolean }) {
  if (args.completionScore < 80) return 0;
  if (args.analyses.length === 0) return 1;
  if (args.generatedArticles === 0) return 2;
  if (args.publishedArticles === 0) return 3;
  if (args.records.length === 0) return 4;
  if (!args.reportReady) return 5;
  return 6;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: projects = [], isLoading: projectsLoading } = trpc.geo.projects.list.useQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>();

  useEffect(() => { if (!selectedProjectId && projects[0]?.id) setSelectedProjectId(projects[0].id); }, [projects, selectedProjectId]);

  const selectedProject = useMemo(() => projects.find(project => project.id === selectedProjectId), [projects, selectedProjectId]);
  const projectInput = useMemo(() => ({ projectId: selectedProjectId }), [selectedProjectId]);
  const enabled = Boolean(selectedProjectId);
  const { data: summary, isLoading: summaryLoading } = trpc.geo.assetLibrary.summary.useQuery(projectInput, { enabled });
  const analysisQuery = trpc.geo.analysis.list.useQuery(projectInput, { enabled });
  const scoreQuery = trpc.geo.scores.latest.useQuery(projectInput, { enabled });
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const scoresQuery = trpc.geo.articles.latestQualityScores.useQuery(projectInput, { enabled });
  const recordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });
  const reportQuery = trpc.geo.reports.latest.useQuery(projectInput, { enabled });

  const analyses = (analysisQuery.data ?? []) as Array<Record<string, unknown>>;
  const latestScore = (scoreQuery.data ?? {}) as Record<string, unknown>;
  const articles = articlesQuery.data ?? [];
  const records = recordsQuery.data ?? [];
  const qualityScores = scoresQuery.data ?? [];
  const completionScore = summary?.completionScore ?? 0;
  const generatedArticles = articles.filter(article => article.status !== "待生成").length;
  const publishedArticles = records.length || articles.filter(article => article.status === "已发布").length;
  const mentioned = analyses.filter(item => toBool(item.mentionsEnterprise)).length;
  const recommended = analyses.filter(item => toBool(item.recommendsEnterprise)).length;
  const avgQuality = qualityScores.length > 0 ? Math.round(qualityScores.reduce((sum, item) => sum + (item.totalScore ?? 0), 0) / qualityScores.length) : 0;
  const totalScore = typeof latestScore.totalScore === "number" ? latestScore.totalScore : 0;
  const aiVisibility = typeof latestScore.visibilityScore === "number" ? latestScore.visibilityScore : pct(mentioned, analyses.length);
  const recommendationRate = typeof latestScore.recommendationScore === "number" ? latestScore.recommendationScore : pct(recommended, analyses.length);
  const stepIndex = currentStepIndex({ completionScore, analyses, generatedArticles, publishedArticles, records, reportReady: Boolean(reportQuery.data) });
  const allDone = stepIndex >= workflowSteps.length;
  const nextStep = allDone ? workflowSteps[5] : workflowSteps[stepIndex];
  const progress = allDone ? 100 : Math.round((stepIndex / workflowSteps.length) * 100);
  const riskReminders = summary?.riskReminders?.length ? summary.riskReminders : ["样本量有限，诊断和监测结果不代表全网绝对排名。", "系统不承诺保证收录、保证排名或保证被 AI 推荐。"];
  const isLoading = projectsLoading || summaryLoading || analysisQuery.isLoading || scoreQuery.isLoading;

  return (
    <div className="relative min-h-[calc(100vh-3rem)] overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.24),transparent_30%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.28),transparent_30%),linear-gradient(135deg,#020617,#0f172a_45%,#111827)] p-5 text-slate-100 shadow-2xl">
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.16)_1px,transparent_1px)] [background-size:32px_32px]" />
      <main className="relative z-10 space-y-6">
        <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <Card className="border-cyan-300/15 bg-white/[0.04] text-slate-100 backdrop-blur shadow-[0_0_42px_rgba(56,189,248,0.12)]">
            <CardHeader className="pb-4">
              <CardDescription className="flex items-center gap-2 text-cyan-200"><Sparkles className="h-4 w-4" /> V1.2 可售卖版主流程</CardDescription>
              <CardTitle className="text-3xl font-semibold tracking-tight text-white md:text-5xl">AI GEO 增长工作台</CardTitle>
              <p className="max-w-4xl text-sm leading-6 text-slate-300">以企业建档、AI 诊断、内容生成、内容发布、收录监测、交付报告为闭环，围绕建档、诊断、内容、发布、监测、报告六步推进，帮助团队从资料准备推进到客户可交付结果。</p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="min-w-[260px] space-y-2">
                  <label className="text-xs font-medium text-slate-400">当前项目</label>
                  <select value={selectedProjectId ?? ""} onChange={event => setSelectedProjectId(Number(event.target.value) || undefined)} className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-cyan-400">
                    <option value="">请选择项目</option>
                    {projects.map(project => <option key={project.id} value={project.id}>{project.enterpriseName}</option>)}
                  </select>
                </div>
                <Button onClick={() => setLocation(nextStep.path)} disabled={isLoading || !selectedProjectId} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{allDone ? "查看交付报告" : `继续下一步：${nextStep.label}`}</Button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs font-medium text-cyan-200">当前进度</p><p className="mt-2 text-2xl font-semibold text-white">{allDone ? "本轮试跑闭环已完成" : `${stepIndex + 1} / ${workflowSteps.length}`}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400" style={{ width: `${progress}%` }} /></div></div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs font-medium text-violet-200">当前任务</p><p className="mt-2 text-lg font-semibold text-white">{allDone ? "本轮试跑闭环已完成" : `继续推进：${nextStep.label}`}</p><p className="mt-2 text-xs leading-5 text-slate-400">项目状态：{selectedProject?.status ? statusLabels[selectedProject.status] ?? selectedProject.status : "尚未选择项目"}</p></div>
                <div className="rounded-3xl border border-amber-300/20 bg-amber-400/10 p-4"><p className="flex items-center gap-2 text-xs font-medium text-amber-200"><AlertTriangle className="h-4 w-4" /> 当前风险提醒</p><p className="mt-2 text-xs leading-5 text-slate-200">{riskReminders[0]}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-violet-300/15 bg-slate-950/62 text-slate-100 backdrop-blur shadow-[0_0_36px_rgba(168,85,247,0.12)]"><CardHeader><CardDescription className="text-violet-200">项目概览</CardDescription><CardTitle className="text-white">{selectedProject?.enterpriseName ?? "请选择项目"}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-slate-300"><p>行业：{selectedProject?.industry ?? "待选择"}</p><p>官网：{selectedProject?.website ?? "待补充"}</p><p>资料完整度：{completionScore}%</p><p>风险规则：不承诺保证收录、保证排名或保证被 AI 推荐。</p></CardContent></Card>
        </section>
        <section className="space-y-3" aria-label="6 步进度条">
          <h2 className="text-lg font-semibold text-white">6 步进度条</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            {workflowSteps.map((step, index) => {
              const Icon = step.icon;
              const done = allDone || index < stepIndex;
              const active = !allDone && index === stepIndex;
              return (
                <button key={step.label} onClick={() => setLocation(step.path)} className={`rounded-3xl border p-4 text-left transition hover:border-cyan-300/30 hover:bg-cyan-400/10 ${active ? "border-cyan-300/35 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,0.16)]" : "border-white/10 bg-white/[0.04]"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950/70 text-cyan-200"><Icon className="h-5 w-5" /></div>
                    {done ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : null}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">{index + 1}. {step.label}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{step.desc}</p>
                </button>
              );
            })}
          </div>
        </section>
        <section className="space-y-3"><h2 className="text-lg font-semibold text-white">核心指标</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><MetricCard title="GEO 总分" value={String(totalScore)} desc="综合 AI 可见度、推荐率和资料完整度" icon={Gauge} /><MetricCard title="AI 可见度" value={`${aiVisibility}%`} desc={`${mentioned}/${analyses.length || 0} 条 AI 回答提及企业`} icon={Brain} /><MetricCard title="AI 推荐率" value={`${recommendationRate}%`} desc={`${recommended}/${analyses.length || 0} 条 AI 回答推荐企业`} icon={Sparkles} /><MetricCard title="内容质量均分" value={String(avgQuality)} desc="来自已质检文章的平均质量评分" icon={ShieldCheck} /><MetricCard title="已发布内容" value={String(publishedArticles)} desc="以内置公开内容页发布记录为主" icon={ClipboardList} /></div></section>
        <Card className="border-amber-300/20 bg-amber-400/10 text-slate-100"><CardHeader><CardTitle className="flex items-center gap-2 text-lg text-amber-100"><Target className="h-5 w-5" /> 风险与边界</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm leading-6 text-slate-200 md:grid-cols-2">{riskReminders.slice(0, 4).map(item => <p key={item}>• {item}</p>)}<p>• 样本量有限，不代表全网绝对排名。</p><p>• 所有报告只能引用已确认资料和系统记录。</p></CardContent></Card>
      </main>
    </div>
  );
}
