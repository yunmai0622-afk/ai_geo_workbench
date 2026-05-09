import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Archive, Brain, CheckCircle2, ClipboardList, Database, Factory, FileCheck2, FileText, Gauge, Layers3, Radar, Rocket, ShieldCheck, Sparkles, Target, TrendingUp, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const statusLabels: Record<string, string> = {
  created: "项目已建档",
  questions_ready: "AI 诊断问题库已就绪",
  responses_imported: "AI 回答已导入",
  analysis_done: "AI 认知扫描完成",
  score_done: "GEO 评分完成",
  tasks_ready: "内容策略已生成",
  report_ready: "客户报告已就绪",
};

const journey = [
  { label: "企业资产", desc: "确认企业资料、产品、案例、竞品、合规、风格与发布策略", icon: Archive, path: "/assets" },
  { label: "AI 诊断", desc: "扫描 AI 是否提及/推荐品牌、推荐竞品和未推荐原因", icon: Brain, path: "/diagnosis" },
  { label: "内容策略", desc: "把诊断缺口转成优先任务与选题队列", icon: ClipboardList, path: "/tasks" },
  { label: "内容生产", desc: "生成有资产引用、质量评分和发布前检查的 GEO 内容", icon: Factory, path: "/articles" },
  { label: "平台发布", desc: "按平台优先级复制/导出素材，不自动登录第三方平台", icon: Rocket, path: "/publish" },
  { label: "收录监测", desc: "记录收录、AI 提及、推荐变化、竞品压制和复测建议", icon: Radar, path: "/monitoring" },
  { label: "报告中心", desc: "输出诊断、发布、监测、复测和客户交付报告", icon: FileText, path: "/reports" },
];

function MetricCard({ title, value, desc, icon: Icon, tone = "cyan" }: { title: string; value: string; desc: string; icon: typeof Sparkles; tone?: "cyan" | "violet" | "emerald" | "amber" | "rose" }) {
  const toneClass = {
    cyan: "border-cyan-300/15 text-cyan-200 shadow-[0_0_22px_rgba(56,189,248,0.10)]",
    violet: "border-violet-300/15 text-violet-200 shadow-[0_0_22px_rgba(168,85,247,0.10)]",
    emerald: "border-emerald-300/15 text-emerald-200 shadow-[0_0_22px_rgba(16,185,129,0.10)]",
    amber: "border-amber-300/15 text-amber-200 shadow-[0_0_22px_rgba(245,158,11,0.10)]",
    rose: "border-rose-300/15 text-rose-200 shadow-[0_0_22px_rgba(244,63,94,0.10)]",
  }[tone];

  return (
    <div className={`rounded-3xl border bg-slate-950/66 p-4 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-300">{title}</p>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{desc}</p>
    </div>
  );
}

function InsightCard({ title, desc, icon: Icon }: { title: string; desc: string; icon: typeof Target }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
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
  const riskReminders = summary?.riskReminders ?? ["尚未选择项目时，系统不能生成可引用的企业内容依据。"];

  const metrics = [
    { title: "项目总数", value: String(projects.length), desc: isLoading ? "正在读取项目与资产库" : "已纳入 AI GEO 工作台的企业项目", icon: Layers3, tone: "cyan" as const },
    { title: "当前 GEO 阶段", value: statusLabel, desc: "用于判断下一步应补资料、诊断、写内容还是复测", icon: Gauge, tone: "violet" as const },
    { title: "资产完整度", value: `${completionScore}%`, desc: "企业资料、产品服务、案例、竞品、合规、风格与发布策略", icon: Archive, tone: "cyan" as const },
    { title: "资料来源", value: String(assetSources.length), desc: `可公开 ${publicAssetCount} 条，可用于生成 ${usableAssetCount} 条`, icon: Database, tone: "violet" as const },
    { title: "真实案例", value: String(realCaseCount), desc: "只统计已确认真实案例；缺失时不能编造案例", icon: FileCheck2, tone: "emerald" as const },
    { title: "竞品资料", value: String(competitors.length), desc: "用于 AI 诊断、竞品压制判断与文章差异化引用", icon: Target, tone: "amber" as const },
    { title: "合规规则", value: String(enabledComplianceCount), desc: "禁用词、不允许承诺内容与价格/案例使用口径", icon: ShieldCheck, tone: "rose" as const },
    { title: "内容风格", value: String(summary?.styleProfiles.length ?? 0), desc: "控制语气、术语、读者、长度和 CTA 风格", icon: Sparkles, tone: "cyan" as const },
    { title: "发布策略", value: String(enabledStrategyCount), desc: "平台优先级、最低质量分、审核模式与禁用平台", icon: Rocket, tone: "violet" as const },
    { title: "平台授权状态", value: String(authorizedPlatformCount), desc: "仅保存安全引用，不保存明文密码、token 或 cookie", icon: CheckCircle2, tone: "emerald" as const },
    { title: "风险提示", value: String(riskReminders.length), desc: "不可公开资料、未确认事实和违规承诺会阻断发布", icon: AlertTriangle, tone: "amber" as const },
  ];

  return (
    <div className="relative min-h-[calc(100vh-3rem)] overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.24),transparent_30%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.28),transparent_30%),linear-gradient(135deg,#020617,#0f172a_45%,#111827)] p-5 text-slate-100 shadow-2xl">
      <div className="geo-grid-bg pointer-events-none absolute inset-0 opacity-25" />
      <div className="pointer-events-none absolute -left-20 top-28 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />

      <main className="relative z-10 space-y-6">
        <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <Card className="border-cyan-300/15 bg-white/[0.04] text-slate-100 backdrop-blur shadow-[0_0_42px_rgba(56,189,248,0.12)]">
            <CardHeader className="pb-4">
              <CardDescription className="flex items-center gap-2 text-cyan-200">
                <Sparkles className="h-4 w-4" /> AI GEO 自动增长系统
              </CardDescription>
              <CardTitle className="text-3xl font-semibold tracking-tight text-white md:text-5xl">AI GEO 增长中枢</CardTitle>
              <p className="max-w-4xl text-sm leading-6 text-slate-300">
                这里把企业资料、AI 诊断、内容策略、内容生产、平台发布、收录监测和客户报告串成一条客户可理解的增长闭环。系统判断当前 GEO 阶段后，只推荐下一步动作，不追求无依据铺量。
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-[260px] space-y-2">
                  <label className="text-xs font-medium text-slate-400">当前项目</label>
                  <select
                    value={selectedProjectId ?? ""}
                    onChange={event => setSelectedProjectId(Number(event.target.value) || undefined)}
                    className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    <option value="">请选择项目</option>
                    {projects.map(project => <option key={project.id} value={project.id}>{project.enterpriseName}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setLocation("/assets")} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">补充企业资产</Button>
                  <Button onClick={() => setLocation("/diagnosis")} variant="outline" className="border-white/15 bg-white/[0.04] text-slate-100 hover:bg-white/10">启动 AI 诊断</Button>
                  <Button onClick={() => setLocation("/articles")} variant="outline" className="border-white/15 bg-white/[0.04] text-slate-100 hover:bg-white/10">进入内容生产</Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <InsightCard title="系统判断" desc="当前项目处于哪个 GEO 阶段、资料是否足够、内容是否能发布，由系统根据诊断和资产库状态提示。" icon={Zap} />
                <InsightCard title="下一步动作" desc="每个页面都给出当前阶段、完成度、为什么要做、风险提醒和主操作按钮，避免客户迷路。" icon={Target} />
                <InsightCard title="风险阻断" desc="不可公开资料、编造案例、禁用词、保证收录或保证排名，都不能通过发布前检查。" icon={AlertTriangle} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-violet-300/15 bg-slate-950/62 text-slate-100 backdrop-blur shadow-[0_0_36px_rgba(168,85,247,0.12)]">
            <CardHeader>
              <CardDescription className="text-violet-200">当前项目状态</CardDescription>
              <CardTitle className="text-white">{statusLabel}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-slate-300">资料完整度</span>
                  <span className="font-semibold text-cyan-200">{completionScore}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 transition-all" style={{ width: `${Math.min(100, Math.max(0, completionScore))}%` }} />
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-slate-400">AI 今日建议</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">{summary?.nextAction ?? "请先创建或选择企业项目，再补充企业资产。"}</p>
              </div>
              <div className="rounded-3xl border border-amber-300/15 bg-amber-500/5 p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-medium text-amber-200"><AlertTriangle className="h-4 w-4" /> 待处理任务</p>
                {riskReminders.slice(0, 3).map(item => <p key={item} className="text-xs leading-5 text-slate-300">{item}</p>)}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
          {metrics.map(metric => <MetricCard key={metric.title} {...metric} />)}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <Card className="border-white/10 bg-white/[0.04] text-slate-100 backdrop-blur">
            <CardHeader>
              <CardDescription className="text-cyan-200">GEO 闭环流程</CardDescription>
              <CardTitle className="text-white">从资料到收录复测的客户路径</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {journey.map((item, index) => (
                <button key={item.label} onClick={() => setLocation(item.path)} className="group rounded-3xl border border-white/10 bg-slate-950/55 p-4 text-left transition hover:border-cyan-300/30 hover:bg-cyan-400/10">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200"><item.icon className="h-5 w-5" /></span>
                    <span className="text-xs text-slate-500">0{index + 1}</span>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-white">{item.label}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{item.desc}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-emerald-300/15 bg-emerald-400/5 text-slate-100">
              <CardHeader>
                <CardDescription className="text-emerald-200">AI 今日建议</CardDescription>
                <CardTitle className="text-white">优先处理资料与证据</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-slate-300">
                <p>先补齐客户案例、竞品差异、禁用词和价格口径，再生成高优先级 GEO 文章。</p>
                <p>没有公开来源的结果数据和价格数据，应保留“数据暂无公开来源”“价格口径需客户确认”。</p>
                <p>第三方平台仍只做素材复制与导出，不新增自动登录或自动发布能力。</p>
              </CardContent>
            </Card>
            <Card className="border-cyan-300/15 bg-cyan-400/5 text-slate-100">
              <CardHeader>
                <CardDescription className="text-cyan-200">链路保护</CardDescription>
                <CardTitle className="text-white">P0.9 / P1.1 / V1.2 保留</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-slate-300">
                <p>P0.9 诊断链路、轻量 Harness 状态机、P1.1 文章生成/质检/发布链路和 V1.2 企业资产库继续保留。</p>
                <Button onClick={() => setLocation("/tasks")} variant="outline" className="w-full border-white/15 bg-white/[0.04] text-slate-100 hover:bg-white/10">查看内容策略</Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {!selectedProject && !projectsLoading ? (
          <Card className="border-amber-300/15 bg-amber-500/5 text-slate-100">
            <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium text-amber-100">尚未创建企业项目</p>
                <p className="mt-1 text-sm text-slate-300">请先创建项目，再补充企业资产、执行诊断和生成内容。</p>
              </div>
              <Button onClick={() => setLocation("/projects")} className="bg-amber-300 text-slate-950 hover:bg-amber-200">创建项目</Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-cyan-300/10 bg-slate-950/50 p-4 text-xs text-slate-400">
          <Brain className="h-4 w-4 text-cyan-200" />
          <span>底线约束：不固定日更铺文、不保存明文平台凭证、不编造客户案例或效果数据、不把文件字节写入数据库、不自动代发第三方平台。</span>
        </div>
      </main>
    </div>
  );
}
