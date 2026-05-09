import fs from 'node:fs';
import path from 'node:path';

const root = '/home/ubuntu/ai_geo_workbench';
const homePath = path.join(root, 'client/src/pages/Home.tsx');
const assetPath = path.join(root, 'client/src/pages/AssetCenter.tsx');

const home = String.raw`import { GeoStatusGuide } from "@/components/GeoStatusGuide";
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
  { label: "企业资产", desc: "补齐企业资料、产品、案例、竞品、合规与发布策略", icon: Archive, path: "/assets" },
  { label: "AI 诊断", desc: "判断 AI 是否提及、推荐品牌，以及竞品是否胜出", icon: Brain, path: "/diagnosis" },
  { label: "内容生产", desc: "围绕真实问题和内容缺口生成可质检的 GEO 文章", icon: Factory, path: "/articles" },
  { label: "平台发布", desc: "按平台优先级生成素材，内置内容页可发布，第三方仅复制", icon: Rocket, path: "/publish" },
  { label: "收录监测", desc: "监测已发布内容的收录、AI 提及和 AI 推荐状态", icon: Radar, path: "/monitoring" },
  { label: "再优化", desc: "把未收录、未提及、未推荐内容推进下一轮复测", icon: TrendingUp, path: "/tasks" },
];

const metricTone = {
  cyan: "border-cyan-300/15 text-cyan-200 shadow-[0_0_22px_rgba(56,189,248,0.10)]",
  violet: "border-violet-300/15 text-violet-200 shadow-[0_0_22px_rgba(168,85,247,0.10)]",
  emerald: "border-emerald-300/15 text-emerald-200 shadow-[0_0_22px_rgba(16,185,129,0.10)]",
  amber: "border-amber-300/15 text-amber-200 shadow-[0_0_22px_rgba(245,158,11,0.10)]",
  rose: "border-rose-300/15 text-rose-200 shadow-[0_0_22px_rgba(244,63,94,0.10)]",
} as const;

function MetricCard({ title, value, desc, icon: Icon, tone = "cyan" }: { title: string; value: string; desc: string; icon: typeof Sparkles; tone?: keyof typeof metricTone }) {
  return (
    <div className={\`rounded-3xl border bg-slate-950/66 p-4 \${metricTone[tone]}\`}>
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

const toBool = (value: unknown) => value === true || value === 1;
const pct = (value: number, total: number) => total > 0 ? Math.round((value / total) * 100) : 0;

export default function Home() {
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
  const scoreQuery = trpc.geo.scores.latest.useQuery(projectInput, { enabled });
  const tasksQuery = trpc.geo.tasks.list.useQuery(projectInput, { enabled });
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const scoresQuery = trpc.geo.articles.latestQualityScores.useQuery(projectInput, { enabled });
  const recordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });

  const completionScore = summary?.completionScore ?? 0;
  const statusLabel = selectedProject?.status ? statusLabels[selectedProject.status] ?? selectedProject.status : "暂无项目";
  const riskReminders = summary?.riskReminders ?? ["尚未选择项目时，系统不能生成可引用的企业内容依据。"];
  const analyses = (analysisQuery.data ?? []) as Array<Record<string, unknown>>;
  const latestScore = (scoreQuery.data ?? {}) as Record<string, unknown>;
  const tasks = tasksQuery.data ?? [];
  const articles = articlesQuery.data ?? [];
  const qualityScores = scoresQuery.data ?? [];
  const records = recordsQuery.data ?? [];
  const generatedArticles = articles.filter(article => article.status !== "待生成");
  const publishedArticles = records.length || articles.filter(article => article.status === "已发布").length;
  const mentioned = analyses.filter(item => toBool(item.mentionsEnterprise)).length;
  const recommended = analyses.filter(item => toBool(item.recommendsEnterprise)).length;
  const enterpriseWins = analyses.filter(item => toBool(item.enterpriseWins)).length;
  const avgQuality = qualityScores.length > 0 ? Math.round(qualityScores.reduce((sum, item) => sum + (item.totalScore ?? 0), 0) / qualityScores.length) : 0;
  const collectedContent = records.filter(record => /已收录|收录/.test(`${record.notes ?? ""}${record.publishStatus ?? ""}`)).length;
  const aiMentionedContent = Math.min(publishedArticles, mentioned);
  const pendingRetest = records.filter(record => record.needRetest === 1).length + tasks.filter(task => task.status === "retest" || task.needRetest === 1).length;
  const aiVisibility = typeof latestScore.visibilityScore === "number" ? latestScore.visibilityScore : pct(mentioned, analyses.length);
  const recommendationRate = typeof latestScore.recommendationScore === "number" ? latestScore.recommendationScore : pct(recommended, analyses.length);
  const competitorWinRate = typeof latestScore.competitorScore === "number" ? latestScore.competitorScore : pct(enterpriseWins, analyses.length);
  const totalScore = typeof latestScore.totalScore === "number" ? latestScore.totalScore : 0;
  const isLoading = projectsLoading || summaryLoading || analysisQuery.isLoading || scoreQuery.isLoading;
  const nextAction = completionScore === 0
    ? "先建立企业 GEO 资产：补企业资料、上传资料文档、补客户案例、补竞品和配置合规发布策略。"
    : summary?.nextAction ?? "按企业资产 → AI 诊断 → 内容生产 → 平台发布 → 收录监测 → 再优化继续推进。";

  const metrics = [
    { title: "GEO 总分", value: `${totalScore}`, desc: isLoading ? "正在读取评分" : "综合 AI 可见度、推荐率、竞品胜出和资产完整度", icon: Gauge, tone: "cyan" as const },
    { title: "AI 可见度", value: `${aiVisibility}%`, desc: `${mentioned}/${analyses.length || 0} 条 AI 回答提及企业`, icon: Brain, tone: "violet" as const },
    { title: "AI 推荐率", value: `${recommendationRate}%`, desc: `${recommended}/${analyses.length || 0} 条 AI 回答推荐企业`, icon: Sparkles, tone: "emerald" as const },
    { title: "竞品胜出率", value: `${competitorWinRate}%`, desc: `${enterpriseWins}/${analyses.length || 0} 条 AI 回答中企业胜出`, icon: Target, tone: "amber" as const },
    { title: "内容质量均分", value: `${avgQuality}`, desc: "来自已质检 GEO 文章的平均总分", icon: ShieldCheck, tone: "rose" as const },
    { title: "已生成文章", value: String(generatedArticles.length), desc: "含待质检、待审核、审核通过和已发布文章", icon: Factory, tone: "cyan" as const },
    { title: "已发布内容", value: String(publishedArticles), desc: "以内置 GEO 内容页发布记录为主", icon: Rocket, tone: "violet" as const },
    { title: "已收录内容", value: String(collectedContent), desc: "根据发布记录中的收录备注与状态统计", icon: FileCheck2, tone: "emerald" as const },
    { title: "AI 已提及内容", value: String(aiMentionedContent), desc: "已发布内容中进入 AI 提及跟踪的数量", icon: Radar, tone: "amber" as const },
    { title: "待复测任务", value: String(pendingRetest), desc: "发布后待复测记录与优化任务", icon: ClipboardList, tone: "rose" as const },
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
                这里把企业资产、AI 诊断、内容生产、平台发布、收录监测和客户报告串成一条客户可理解的增长闭环。系统判断当前 GEO 阶段后，只推荐下一步动作，不做无依据铺量。
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
                  <Button onClick={() => setLocation('/assets')} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">下一步动作：补充企业资产</Button>
                  <Button onClick={() => setLocation('/diagnosis')} variant="outline" className="border-white/15 bg-white/[0.04] text-slate-100 hover:bg-white/10">启动 AI 诊断</Button>
                  <Button onClick={() => setLocation('/articles')} variant="outline" className="border-white/15 bg-white/[0.04] text-slate-100 hover:bg-white/10">进入内容生产</Button>
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
                  <span className="text-slate-300">当前 GEO 阶段</span>
                  <span className="font-semibold text-cyan-200">{statusLabel}</span>
                </div>
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
                <p className="mt-2 text-sm leading-6 text-slate-200">{nextAction}</p>
              </div>
              <div className="rounded-3xl border border-amber-300/15 bg-amber-500/5 p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-medium text-amber-200"><AlertTriangle className="h-4 w-4" /> 待处理任务</p>
                {riskReminders.slice(0, 3).map(item => <p key={item} className="text-xs leading-5 text-slate-300">{item}</p>)}
              </div>
            </CardContent>
          </Card>
        </section>

        <GeoStatusGuide
          stage="总览指挥舱"
          completion={Math.max(completionScore, totalScore)}
          nextAction={nextAction}
          why="总览页用于让客户在第一眼理解当前项目、当前 GEO 阶段、核心指标、风险与下一步动作，避免把系统误用成普通后台。"
          risk={riskReminders[0] ?? "资料不足时，系统不得编造案例、数据、价格和效果承诺。"}
          ctaLabel="开始下一步"
          ctaPath={completionScore === 0 ? "/assets" : "/tasks"}
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {metrics.map(metric => <MetricCard key={metric.title} {...metric} />)}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <Card className="border-white/10 bg-white/[0.04] text-slate-100 backdrop-blur">
            <CardHeader>
              <CardDescription className="text-cyan-200">GEO 增长路径</CardDescription>
              <CardTitle className="text-white">企业资产 → AI 诊断 → 内容生产 → 平台发布 → 收录监测 → 再优化</CardTitle>
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
                <CardDescription className="text-emerald-200">AI 今日建议卡片</CardDescription>
                <CardTitle className="text-white">优先处理证据链与发布准入</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-slate-300">
                <p>{nextAction}</p>
                <p>没有公开来源的结果数据和价格数据，应保留“数据暂无公开来源”“价格口径需客户确认”。</p>
                <p>第三方平台当前只生成素材，不自动登录发布。</p>
              </CardContent>
            </Card>
            <Card className="border-cyan-300/15 bg-cyan-400/5 text-slate-100">
              <CardHeader>
                <CardDescription className="text-cyan-200">待处理任务卡片</CardDescription>
                <CardTitle className="text-white">下一轮应优先完成</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-slate-300">
                {(tasks.length ? tasks.slice(0, 3).map(task => task.title) : ["补齐企业资料与客户案例", "检查内容质量分是否达到 80 分", "发布后进入收录与 AI 推荐复测"]).map(item => <p key={item}>• {item}</p>)}
                <Button onClick={() => setLocation('/tasks')} variant="outline" className="w-full border-white/15 bg-white/[0.04] text-slate-100 hover:bg-white/10">查看内容策略</Button>
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
              <Button onClick={() => setLocation('/projects')} className="bg-amber-300 text-slate-950 hover:bg-amber-200">创建项目</Button>
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
`;

fs.writeFileSync(homePath, home);

let asset = fs.readFileSync(assetPath, 'utf8');
asset = asset.replace('          ctaLabel="进入内容生产"\n          ctaPath="/articles"', '          ctaLabel={summary?.completionScore === 0 ? "开始补充企业资料" : "进入内容生产"}\n          ctaPath={summary?.completionScore === 0 ? "/assets" : "/articles"}');
const zeroCard = String.raw`

        {(summary?.completionScore ?? 0) === 0 ? (
          <Card className="border-amber-300/25 bg-amber-400/10 text-slate-100 shadow-[0_0_32px_rgba(251,191,36,0.12)]">
            <CardHeader>
              <CardDescription className="text-amber-200">企业资产 0% 引导</CardDescription>
              <CardTitle className="text-white">企业 GEO 资产尚未建立</CardTitle>
              <p className="text-sm leading-6 text-slate-300">系统需要先了解企业资料，才能生成准确、可溯源、高质量的 GEO 内容。</p>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-4">
                <p className="text-sm font-semibold text-white">下一步建议</p>
                <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                  <li>1. 补充企业基础资料</li>
                  <li>2. 上传产品介绍或服务资料</li>
                  <li>3. 补充 1-3 个真实客户案例</li>
                  <li>4. 补充主要竞品资料</li>
                  <li>5. 配置合规规则和发布策略</li>
                </ol>
              </div>
              <div className="space-y-3 rounded-3xl border border-amber-300/15 bg-slate-950/55 p-4">
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => document.getElementById('asset-profile-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="bg-amber-300 text-slate-950 hover:bg-amber-200">开始补充企业资料</Button>
                  <Button onClick={() => document.getElementById('asset-source-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} variant="outline" className="border-white/15 bg-white/[0.04] text-slate-100 hover:bg-white/10">上传资料文档</Button>
                </div>
                <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100">
                  风险提醒：资料不足时，系统不得编造案例、数据、价格和效果承诺。
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}`;
asset = asset.replace('\n\n        <div className="grid gap-4 md:grid-cols-4">', `${zeroCard}\n\n        <div className="grid gap-4 md:grid-cols-4">`);
asset = asset.replace('<TabsContent value="profile">', '<TabsContent value="profile" id="asset-profile-section">');
asset = asset.replace('<TabsContent value="sources">', '<TabsContent value="sources" id="asset-source-section">');
fs.writeFileSync(assetPath, asset);
`;
