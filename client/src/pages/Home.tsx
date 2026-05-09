import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Archive, Brain, CheckCircle2, ClipboardList, Database, FileCheck2, Gauge, Layers3, Rocket, ShieldCheck, Sparkles, Target, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const statusLabels: Record<string, string> = {
  created: "已创建项目",
  questions_ready: "问题库已就绪",
  responses_imported: "AI 回答已导入",
  analysis_done: "AI 语义分析完成",
  score_done: "GEO 评分完成",
  tasks_ready: "优化任务已生成",
  report_ready: "诊断报告已就绪",
};

function CommandStat({ title, value, desc, icon: Icon, accent = "cyan" }: { title: string; value: string; desc: string; icon: typeof Sparkles; accent?: "cyan" | "violet" | "emerald" | "amber" }) {
  const accentClass = {
    cyan: "border-cyan-300/15 text-cyan-200 shadow-[0_0_24px_rgba(56,189,248,0.12)]",
    violet: "border-violet-300/15 text-violet-200 shadow-[0_0_24px_rgba(168,85,247,0.14)]",
    emerald: "border-emerald-300/15 text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.12)]",
    amber: "border-amber-300/15 text-amber-200 shadow-[0_0_24px_rgba(245,158,11,0.12)]",
  }[accent];

  return (
    <div className={`rounded-2xl border bg-slate-950/60 p-4 ${accentClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-300">{title}</p>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{desc}</p>
    </div>
  );
}

function PrincipleCard({ title, desc, icon: Icon }: { title: string; desc: string; icon: typeof Target }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-200">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-slate-400">{desc}</p>
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: projects = [], isLoading: projectsLoading } = trpc.geo.projects.list.useQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>();

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  const selectedProject = useMemo(() => projects.find(project => project.id === selectedProjectId), [projects, selectedProjectId]);
  const { data: summary, isLoading: summaryLoading } = trpc.geo.assetLibrary.summary.useQuery(
    { projectId: selectedProjectId },
    { enabled: Boolean(selectedProjectId) },
  );

  const assetSources = summary?.assetSources ?? [];
  const customerCases = summary?.customerCases ?? [];
  const competitors = summary?.competitors ?? [];
  const complianceRules = summary?.complianceRules ?? [];
  const publishStrategies = summary?.publishStrategies ?? [];
  const platformAuthorizations = summary?.platformAuthorizations ?? [];
  const completionScore = summary?.completionScore ?? 0;

  const publicAssetCount = assetSources.filter(source => Boolean(source.isPublic)).length;
  const usableAssetCount = assetSources.filter(source => Boolean(source.canUseForGeneration) && Boolean(source.manuallyConfirmed)).length;
  const realCaseCount = customerCases.filter(item => item.caseType === "真实案例" && item.verificationStatus === "已确认").length;
  const enabledComplianceCount = complianceRules.filter(item => Boolean(item.enabled)).length;
  const enabledStrategyCount = publishStrategies.filter(item => Boolean(item.enabled)).length;
  const authorizedPlatformCount = platformAuthorizations.filter(item => item.authorizationStatus === "已授权" || item.authorizationStatus === "无需授权").length;
  const statusLabel = selectedProject?.status ? statusLabels[selectedProject.status] ?? selectedProject.status : "暂无项目";
  const isLoading = projectsLoading || summaryLoading;

  return (
    <div className="relative min-h-[calc(100vh-3rem)] overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.24),transparent_30%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.28),transparent_30%),linear-gradient(135deg,#020617,#0f172a_45%,#111827)] p-5 text-slate-100 shadow-2xl">
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,.18)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.18)_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="pointer-events-none absolute -left-20 top-28 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />

      <main className="relative z-10 space-y-6">
        <section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <Card className="border-cyan-300/15 bg-white/[0.04] text-slate-100 backdrop-blur shadow-[0_0_40px_rgba(56,189,248,0.10)]">
            <CardHeader className="pb-4">
              <CardDescription className="flex items-center gap-2 text-cyan-200">
                <Sparkles className="h-4 w-4" /> AI GEO 自动增长系统
              </CardDescription>
              <CardTitle className="text-3xl font-semibold tracking-tight text-white md:text-4xl">增长指挥舱</CardTitle>
              <p className="max-w-4xl text-sm leading-6 text-slate-300">
                这里汇总企业资料完整度、内容资产、真实案例、竞品资料、合规规则与发布策略。系统不会为了固定日更数量批量铺文，而是围绕真实诊断、优先平台和复测指标推进高质量 GEO 内容闭环。
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-[260px] space-y-2">
                  <label className="text-xs font-medium text-slate-400">当前项目</label>
                  <select
                    value={selectedProjectId ?? ""}
                    onChange={event => setSelectedProjectId(Number(event.target.value) || undefined)}
                    className="h-10 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    <option value="">请选择项目</option>
                    {projects.map(project => <option key={project.id} value={project.id}>{project.enterpriseName}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setLocation("/assets")} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">补充企业资料</Button>
                  <Button onClick={() => setLocation("/projects")} variant="outline" className="border-white/15 bg-white/[0.04] text-slate-100 hover:bg-white/10">进入项目管理</Button>
                  <Button onClick={() => setLocation("/articles")} variant="outline" className="border-white/15 bg-white/[0.04] text-slate-100 hover:bg-white/10">查看文章发布</Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <PrincipleCard title="高质量内容" desc="每篇内容必须有客户问题、AI 未推荐原因、内容缺口、优化任务、竞品差距、资产来源、目标平台和复测指标作为生成依据。" icon={Target} />
                <PrincipleCard title="优先平台发布" desc="发布策略记录最低质量分、审核模式、优先平台和禁用平台；第三方平台仅生成素材、复制和导出，不自动代发。" icon={Rocket} />
                <PrincipleCard title="监测与再优化" desc="轻量 Harness 保留当前进度、下一步动作、任务状态、执行记录和复测入口，支持诊断—内容—发布—复测闭环。" icon={TrendingUp} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-violet-300/15 bg-slate-950/60 text-slate-100 backdrop-blur shadow-[0_0_36px_rgba(168,85,247,0.12)]">
            <CardHeader>
              <CardDescription className="text-violet-200">当前链路状态</CardDescription>
              <CardTitle className="text-white">{statusLabel}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-slate-300">企业资料完整度</span>
                  <span className="font-semibold text-cyan-200">{completionScore}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-all" style={{ width: `${Math.min(100, Math.max(0, completionScore))}%` }} />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-slate-400">下一步建议</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">{summary?.nextAction ?? "请先创建或选择企业项目，再补充企业资料中心。"}</p>
              </div>
              <div className="rounded-2xl border border-amber-300/15 bg-amber-500/5 p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-medium text-amber-200"><AlertTriangle className="h-4 w-4" /> 风险提醒</p>
                {(summary?.riskReminders ?? ["暂无项目时不能生成可引用的企业内容依据。"] ).slice(0, 3).map(item => <p key={item} className="text-xs leading-5 text-slate-300">{item}</p>)}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CommandStat title="项目总数" value={String(projects.length)} desc={isLoading ? "正在读取项目与资产库" : "已纳入 GEO 工作台的企业项目"} icon={Layers3} accent="cyan" />
          <CommandStat title="资料来源" value={String(assetSources.length)} desc={`可公开 ${publicAssetCount} 条，可用于生成 ${usableAssetCount} 条`} icon={Archive} accent="violet" />
          <CommandStat title="真实案例" value={String(realCaseCount)} desc="仅统计已确认真实案例；无来源时系统不得编造案例" icon={FileCheck2} accent="emerald" />
          <CommandStat title="竞品资料" value={String(competitors.length)} desc="用于后续诊断、差距分析和文章生成引用" icon={Database} accent="amber" />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="border-white/10 bg-white/[0.04] text-slate-100 backdrop-blur">
            <CardHeader>
              <CardDescription className="text-cyan-200">合规与内容风格</CardDescription>
              <CardTitle className="flex items-center gap-2 text-white"><ShieldCheck className="h-5 w-5 text-cyan-200" /> 生成前约束</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <p>已启用合规规则：<span className="font-semibold text-white">{enabledComplianceCount}</span> 条。</p>
              <p>内容风格配置：<span className="font-semibold text-white">{summary?.styleProfiles.length ?? 0}</span> 套。</p>
              <p className="text-xs leading-5 text-slate-400">后续 Sprint 2 应把这些约束接入诊断驱动文章生成、质量评分和发布前检查，当前 Sprint 1 已完成资产沉淀与可查询能力。</p>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.04] text-slate-100 backdrop-blur">
            <CardHeader>
              <CardDescription className="text-violet-200">发布策略</CardDescription>
              <CardTitle className="flex items-center gap-2 text-white"><ClipboardList className="h-5 w-5 text-violet-200" /> 审核与平台</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <p>已启用策略：<span className="font-semibold text-white">{enabledStrategyCount}</span> 个。</p>
              <p>已授权或无需授权平台：<span className="font-semibold text-white">{authorizedPlatformCount}</span> 个。</p>
              <p className="text-xs leading-5 text-slate-400">平台授权只保存安全引用和状态，不保存明文密码、token 或 cookie；第三方平台仍只支持素材复制与导出。</p>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.04] text-slate-100 backdrop-blur">
            <CardHeader>
              <CardDescription className="text-emerald-200">链路保护</CardDescription>
              <CardTitle className="flex items-center gap-2 text-white"><CheckCircle2 className="h-5 w-5 text-emerald-200" /> P0.9 / P1.1 保留</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <p>P0.9 诊断链路、轻量 Harness、P1.1 文章质检与内置内容页发布入口继续保留。</p>
              <p className="text-xs leading-5 text-slate-400">企业资产库目前作为独立资料底座运行，正式强制接入文章生成依据属于 Sprint 2 范围。</p>
              <Button onClick={() => setLocation("/tasks")} variant="outline" className="w-full border-white/15 bg-white/[0.04] text-slate-100 hover:bg-white/10">
                查看优化工作台
              </Button>
            </CardContent>
          </Card>
        </section>

        {!selectedProject && !projectsLoading ? (
          <Card className="border-amber-300/15 bg-amber-500/5 text-slate-100">
            <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium text-amber-100">尚未创建企业项目</p>
                <p className="mt-1 text-sm text-slate-300">请先进入项目管理创建企业，再补充资料中心与后续诊断链路。</p>
              </div>
              <Button onClick={() => setLocation("/projects")} className="bg-amber-300 text-slate-950 hover:bg-amber-200">创建项目</Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-300/10 bg-slate-950/50 p-4 text-xs text-slate-400">
          <Brain className="h-4 w-4 text-cyan-200" />
          <span>底线约束：不固定日更铺文、不保存明文平台凭证、不编造客户案例或效果数据、不把文件字节写入数据库、不自动代发第三方平台。</span>
        </div>
      </main>
    </div>
  );
}
