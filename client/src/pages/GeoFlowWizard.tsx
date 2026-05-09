import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowRight, Brain, Building2, CheckCircle2, CircleDashed, FileBarChart2, FileText, Lock, RadioTower, Send, Sparkles, type LucideIcon } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const workflowSteps: Array<{
  label: string;
  path: string;
  desc: string;
  criteria: string;
  icon: LucideIcon;
  advancedSignals: string[];
}> = [
  {
    label: "企业档案",
    path: "/enterprise-profile",
    desc: "确认企业、产品、客户案例、竞品、合规与发布策略资料。",
    criteria: "资料完整度达到 80% 以上，且关键企业资料可被后续诊断和内容生成引用。",
    icon: Building2,
    advancedSignals: ["事实溯源资料池", "第三方素材清单"],
  },
  {
    label: "AI 诊断",
    path: "/ai-diagnosis",
    desc: "围绕客户核心问题读取 AI 回答，识别提及率、推荐率与内容缺口。",
    criteria: "已形成至少一条 AI 回答诊断记录，并能看到企业是否被提及、是否被推荐。",
    icon: Brain,
    advancedSignals: ["一致性检查状态", "AI 未推荐原因"],
  },
  {
    label: "内容生成",
    path: "/content-generation",
    desc: "基于诊断缺口生成可公开的 GEO 文章与 AI 可引用片段。",
    criteria: "至少生成一篇非“待生成”状态的内容，并完成发布前需要的质量检查。",
    icon: FileText,
    advancedSignals: ["事实溯源", "一致性检查", "AI 可引用片段"],
  },
  {
    label: "内容发布",
    path: "/content-publishing",
    desc: "确认可发布内容，完成系统内置 GEO 内容页发布与第三方素材准备。",
    criteria: "至少一篇内容进入已发布状态，或已有对应发布记录可核验。",
    icon: Send,
    advancedSignals: ["发布前检查", "第三方素材"],
  },
  {
    label: "收录监测",
    path: "/inclusion-monitoring",
    desc: "记录公开链接、收录状态、AI 提及状态与最近一次检测时间。",
    criteria: "已形成可追踪的发布记录，监测页能够展示收录与 AI 提及状态。",
    icon: RadioTower,
    advancedSignals: ["AI 可引用片段", "监测记录"],
  },
  {
    label: "交付报告",
    path: "/delivery-reports",
    desc: "汇总诊断、内容、发布、监测和风险边界，形成客户交付报告。",
    criteria: "已生成最新交付报告，可向客户说明本轮试跑结论和下一步建议。",
    icon: FileBarChart2,
    advancedSignals: ["风险边界", "复测建议"],
  },
];

const toBool = (value: unknown) => value === true || value === 1;

function currentStepIndex(args: { completionScore: number; analyses: unknown[]; generatedArticles: number; publishedArticles: number; records: unknown[]; reportReady: boolean }) {
  if (args.completionScore < 80) return 0;
  if (args.analyses.length === 0) return 1;
  if (args.generatedArticles === 0) return 2;
  if (args.publishedArticles === 0) return 3;
  if (args.records.length === 0) return 4;
  if (!args.reportReady) return 5;
  return 6;
}

function statusForStep(index: number, stepIndex: number, allDone: boolean) {
  if (allDone || index < stepIndex) return { label: "已完成", className: "border-emerald-300/30 bg-emerald-300/12 text-emerald-100", icon: CheckCircle2 };
  if (index === stepIndex) return { label: "进行中", className: "border-cyan-300/35 bg-cyan-300/12 text-cyan-100", icon: CircleDashed };
  return { label: "有风险", className: "border-amber-300/35 bg-amber-300/12 text-amber-100", icon: AlertTriangle };
}

function mainButtonLabel(index: number, stepIndex: number, allDone: boolean) {
  if (!allDone && index > stepIndex) return "需先完成上一环节";
  if (allDone || index < stepIndex) return "查看本步骤";
  return "继续本步骤";
}

export default function GeoFlowWizardPage() {
  const [, setLocation] = useLocation();
  const { data: projects = [], isLoading: projectsLoading } = trpc.geo.projects.list.useQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>();

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  const selectedProject = useMemo(() => projects.find(project => project.id === selectedProjectId), [projects, selectedProjectId]);
  const projectInput = useMemo(() => ({ projectId: selectedProjectId }), [selectedProjectId]);
  const enabled = Boolean(selectedProjectId);
  const { data: summary, isLoading: summaryLoading } = trpc.geo.assetLibrary.summary.useQuery(projectInput, { enabled });
  const analysisQuery = trpc.geo.analysis.list.useQuery(projectInput, { enabled });
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const recordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });
  const reportQuery = trpc.geo.reports.latest.useQuery(projectInput, { enabled });

  const analyses = (analysisQuery.data ?? []) as Array<Record<string, unknown>>;
  const articles = articlesQuery.data ?? [];
  const records = recordsQuery.data ?? [];
  const completionScore = summary?.completionScore ?? 0;
  const generatedArticles = articles.filter(article => article.status !== "待生成").length;
  const publishedArticles = records.length || articles.filter(article => article.status === "已发布").length;
  const mentioned = analyses.filter(item => toBool(item.mentionsEnterprise)).length;
  const recommended = analyses.filter(item => toBool(item.recommendsEnterprise)).length;
  const stepIndex = currentStepIndex({ completionScore, analyses, generatedArticles, publishedArticles, records, reportReady: Boolean(reportQuery.data) });
  const allDone = stepIndex >= workflowSteps.length;
  const currentIndex = allDone ? workflowSteps.length - 1 : stepIndex;
  const currentStep = workflowSteps[currentIndex];
  const currentStepNumber = allDone ? workflowSteps.length : currentIndex + 1;
  const progress = allDone ? 100 : Math.round((stepIndex / workflowSteps.length) * 100);
  const isLoading = projectsLoading || summaryLoading || analysisQuery.isLoading || articlesQuery.isLoading || recordsQuery.isLoading || reportQuery.isLoading;
  const riskReminders = summary?.riskReminders?.length ? summary.riskReminders : ["当前试跑需要按企业档案、AI 诊断、内容生成、内容发布、收录监测、交付报告顺序推进。"];
  const currentSuggestion = allDone
    ? "本轮试跑闭环已完成，建议进入交付报告页复核结论、风险边界与下一轮优化建议。"
    : `建议继续推进“${currentStep.label}”：${currentStep.criteria}`;

  return (
    <div className="relative min-h-[calc(100vh-3rem)] overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_10%_0%,rgba(34,211,238,0.24),transparent_30%),radial-gradient(circle_at_88%_12%,rgba(168,85,247,0.26),transparent_32%),linear-gradient(135deg,#020617,#0f172a_48%,#111827)] p-5 text-slate-100 shadow-2xl">
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.16)_1px,transparent_1px)] [background-size:32px_32px]" />
      <main className="relative z-10 space-y-6">
        <section className="grid gap-5 xl:grid-cols-[1.45fr_0.55fr]">
          <Card className="border-cyan-300/15 bg-white/[0.045] text-slate-100 backdrop-blur shadow-[0_0_46px_rgba(56,189,248,0.13)]">
            <CardHeader className="pb-4">
              <CardDescription className="flex items-center gap-2 text-cyan-200"><Sparkles className="h-4 w-4" /> V1.2 客户试跑向导页</CardDescription>
              <CardTitle className="text-3xl font-semibold tracking-tight text-white md:text-5xl">AI GEO 试跑向导</CardTitle>
              <p className="max-w-4xl text-sm leading-6 text-slate-300">按 6 步完成一次企业 AI 搜索诊断、内容生成、发布监测和交付报告</p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(240px,0.8fr)_minmax(280px,1fr)_auto] lg:items-end">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400">当前项目</label>
                  <select value={selectedProjectId ?? ""} onChange={event => setSelectedProjectId(Number(event.target.value) || undefined)} className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-cyan-400">
                    <option value="">请选择项目</option>
                    {projects.map(project => <option key={project.id} value={project.id}>{project.enterpriseName}｜{project.industry}</option>)}
                  </select>
                  <p className="text-xs leading-5 text-slate-400">{selectedProject ? `${selectedProject.enterpriseName}｜${selectedProject.industry}` : "海豚知道｜知识付费 SaaS"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <p className="text-xs font-medium text-cyan-200">当前步骤 {currentStepNumber}/6</p>
                  <p className="mt-2 text-lg font-semibold text-white">{allDone ? "本轮试跑闭环已完成" : currentStep.label}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-300">{currentSuggestion}</p>
                </div>
                <Button disabled={isLoading || !selectedProjectId} onClick={() => setLocation(currentStep.path)} className="h-11 bg-cyan-400 px-5 text-slate-950 hover:bg-cyan-300">
                  继续当前步骤
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400" style={{ width: `${progress}%` }} />
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-300/20 bg-amber-400/10 text-slate-100 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-amber-100"><AlertTriangle className="h-5 w-5" /> 当前建议</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-slate-200">
              <p>{riskReminders[0]}</p>
              <p>高级能力仅作为状态信号展示，不作为本页主入口，避免客户试跑路径分散。</p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="AI GEO 试跑 6 步卡片">
          {workflowSteps.map((step, index) => {
            const Icon = step.icon;
            const status = statusForStep(index, stepIndex, allDone);
            const StatusIcon = status.icon;
            const locked = !allDone && index > stepIndex;
            return (
              <Card key={step.label} className={`flex min-h-[310px] flex-col border text-slate-100 backdrop-blur ${locked ? "border-amber-300/18 bg-slate-950/52" : "border-cyan-300/15 bg-white/[0.045] shadow-[0_0_30px_rgba(56,189,248,0.10)]"}`}>
                <CardHeader className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/15 bg-slate-950/72 text-cyan-200"><Icon className="h-6 w-6" /></div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${status.className}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {status.label}
                    </span>
                  </div>
                  <div>
                    <CardDescription className="text-cyan-200">第 {index + 1} 步</CardDescription>
                    <CardTitle className="mt-1 text-xl text-white">{step.label}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col space-y-4">
                  <p className="text-sm leading-6 text-slate-300">{step.desc}</p>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                    <p className="text-xs font-semibold tracking-[0.18em] text-slate-400">完成标准</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">{step.criteria}</p>
                  </div>
                  <div className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.07] p-4">
                    <p className="text-xs font-semibold tracking-[0.18em] text-violet-200">高级能力状态</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {step.advancedSignals.map(signal => <span key={signal} className="rounded-full border border-violet-300/20 bg-slate-950/50 px-3 py-1 text-xs text-violet-100">{signal}</span>)}
                    </div>
                  </div>
                  <Button disabled={isLoading || !selectedProjectId || locked} onClick={() => setLocation(step.path)} className={`mt-auto w-full ${locked ? "border border-amber-300/25 bg-slate-900 text-amber-100 hover:bg-slate-900" : "bg-cyan-400 text-slate-950 hover:bg-cyan-300"}`}>
                    {locked ? <Lock className="mr-2 h-4 w-4" /> : null}
                    {mainButtonLabel(index, stepIndex, allDone)}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-4 md:grid-cols-4" aria-label="试跑状态摘要">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs text-slate-400">资料完整度</p><p className="mt-2 text-2xl font-semibold text-white">{completionScore}%</p></div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs text-slate-400">AI 提及</p><p className="mt-2 text-2xl font-semibold text-white">{mentioned}/{analyses.length || 0}</p></div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs text-slate-400">AI 推荐</p><p className="mt-2 text-2xl font-semibold text-white">{recommended}/{analyses.length || 0}</p></div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs text-slate-400">已发布记录</p><p className="mt-2 text-2xl font-semibold text-white">{publishedArticles}</p></div>
        </section>
      </main>
    </div>
  );
}
