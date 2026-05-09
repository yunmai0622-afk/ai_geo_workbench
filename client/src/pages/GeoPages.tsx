import { GeoStatusGuide } from "@/components/GeoStatusGuide";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Brain, FileBarChart2, FileText, RadioTower, Send, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Row = Record<string, any>;
type PublishSummaryInput = { totalScore?: number | null; blocked?: boolean | number | null; blockReasons?: string[] | null } | null | undefined;
type ConsistencyInput = { score?: number | null; publishAllowed?: boolean | null; riskLevel?: string | null; blockReasons?: string[] | null } | null | undefined;
type BasisInput = Record<string, any> | null | undefined;
type TraceabilityInput = Array<{ sourceName?: string | null; isPublic?: boolean | number | null; manuallyConfirmed?: boolean | number | null }> | null | undefined;

const projectInput = (projectId?: number) => ({ projectId });
const boolValue = (value: unknown) => value === true || value === 1;
const textValue = (value: unknown, fallback = "待补充") => typeof value === "string" && value.trim() ? value : fallback;

function useSelectedProject() {
  const { data: projects = [] } = trpc.geo.projects.list.useQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>();
  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);
  const selectedProject = useMemo(() => projects.find(project => project.id === selectedProjectId), [projects, selectedProjectId]);
  return { projects, selectedProject, selectedProjectId, setSelectedProjectId, input: projectInput(selectedProjectId), enabled: Boolean(selectedProjectId) };
}

function ProjectSelector({ projects, selectedProjectId, onChange }: { projects: Row[]; selectedProjectId?: number; onChange: (id?: number) => void }) {
  return (
    <select value={selectedProjectId ?? ""} onChange={event => onChange(Number(event.target.value) || undefined)} className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 md:max-w-md">
      <option value="">请选择项目</option>
      {projects.map(project => <option key={project.id} value={project.id}>{project.enterpriseName}</option>)}
    </select>
  );
}

function PageShell({ title, desc, guide, children }: { title: string; desc: string; guide: React.ComponentProps<typeof GeoStatusGuide>; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-6 text-slate-100 shadow-[0_0_34px_rgba(56,189,248,0.10)] backdrop-blur">
        <p className="text-sm font-medium text-cyan-200">AI GEO 增长工作台</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{desc}</p>
      </section>
      <GeoStatusGuide {...guide} />
      {children}
    </div>
  );
}

function InfoCard({ title, desc, icon: Icon, children }: { title: string; desc?: string; icon: typeof Brain; children?: React.ReactNode }) {
  return (
    <Card className="border-white/10 bg-white/[0.04] text-slate-100">
      <CardHeader>
        <CardDescription className="flex items-center gap-2 text-cyan-200"><Icon className="h-4 w-4" /> {desc ?? "主流程信息"}</CardDescription>
        <CardTitle className="text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function projectPublishSummary(statuses: Array<{ status: string }>, publishedCount: number) {
  const readyCount = statuses.filter(item => item.status === "允许发布").length;
  const waitingCount = statuses.filter(item => ["未质检", "质检未通过", "待审核"].includes(item.status)).length;
  if (publishedCount > 0) {
    return { stage: "内容发布", completion: 82, nextAction: "进入收录监测，检查是否被收录、被 AI 提及、被 AI 推荐", why: "发布完成后需要用监测结果决定复测和优化。", risk: `已发布 ${publishedCount} 篇，另有 ${waitingCount} 篇待质检或待审核；不承诺保证收录、保证排名或保证被 AI 推荐。`, ctaLabel: "进入收录监测", ctaPath: "/inclusion-monitoring" };
  }
  if (readyCount > 0) {
    return { stage: "内容发布", completion: 76, nextAction: "选择通过检查的文章发布到 GEO 内容页", why: "只有通过质量、事实和一致性检查的内容才能进入发布链路。", risk: "第三方平台素材仅作为辅助材料，当前只生成素材不自动登录发布。", ctaLabel: "发布到 GEO 内容页", ctaPath: "/content-publishing" };
  }
  return { stage: "内容发布", completion: 68, nextAction: "先生成高质量 GEO 文章", why: "没有可发布内容时应回到内容生成，补齐文章和质检。", risk: "低于发布标准或事实未确认的文章不能发布。", ctaLabel: "去内容生成", ctaPath: "/content-generation" };
}

export function buildPublishCheckSummary(score: PublishSummaryInput, consistency: ConsistencyInput, basis: BasisInput, traceability: TraceabilityInput, content = "") {
  const blockReasons: string[] = [];
  const sourceBasisKeys = ["customerQuestion", "contentGap", "optimizationTaskName", "notRecommendedReason", "competitorGap", "humanRevisionConclusion"];
  if (!score || (score.totalScore ?? 0) < 80 || boolValue(score.blocked)) blockReasons.push("内容质量分低于最低发布标准。");
  if (Array.isArray(score?.blockReasons)) blockReasons.push(...score.blockReasons.filter(Boolean));
  if (!consistency || (consistency.score ?? 0) < 80 || consistency.publishAllowed === false || consistency.riskLevel === "高") blockReasons.push("一致性评分低于 80。");
  if (Array.isArray(consistency?.blockReasons)) blockReasons.push(...consistency.blockReasons.filter(Boolean));
  if (!basis || sourceBasisKeys.some(key => !String(basis[key] ?? "").trim())) blockReasons.push("生成依据不完整，请补齐来源说明。");
  if (!traceability?.length || traceability.some(item => !item.sourceName)) blockReasons.push("存在缺少来源的关键事实。");
  if (traceability?.some(item => !boolValue(item.manuallyConfirmed))) blockReasons.push("存在未确认事实，请先完成人工确认。");
  if (/保证排名|保证收录|保证被 AI 推荐|绝对第一|100%/.test(content)) blockReasons.push("存在绝对化或承诺性表述。");
  const uniqueReasons = Array.from(new Set(blockReasons));
  return { allowPublish: uniqueReasons.length === 0, blockReasons: uniqueReasons };
}

export function publishStatusForArticle(rawStatus: string, score?: PublishSummaryInput, check?: ReturnType<typeof buildPublishCheckSummary>, record?: { needRetest?: boolean | number | null }) {
  if (rawStatus === "已发布") return boolValue(record?.needRetest) ? "待复测" : "已发布";
  if (rawStatus === "待复测") return "待复测";
  if (check && !check.allowPublish) return "质检未通过";
  if (!score || (score.totalScore ?? 0) < 80 || boolValue(score.blocked)) return "质检未通过";
  if (["审核通过", "待发布", "ready"].includes(rawStatus)) return "允许发布";
  if (["已生成", "待质检", "draft"].includes(rawStatus)) return "未质检";
  if (rawStatus === "待审核") return "待审核";
  return rawStatus || "未质检";
}

export function ProjectsPage() {
  const [, setLocation] = useLocation();
  const { projects, selectedProjectId, setSelectedProjectId } = useSelectedProject();
  return (
    <PageShell title="企业档案" desc="旧项目管理路径已兼容到 V1.2 企业档案。请从六类资料状态进入主流程。" guide={{ stage: "企业档案", completion: 20, nextAction: "查看企业档案六类资料", why: "企业档案是后续诊断和内容生成的事实来源。", risk: "资料不足时不得编造效果承诺。", ctaLabel: "进入企业档案", ctaPath: "/enterprise-profile" }}>
      <InfoCard title="当前项目" icon={Target}><div className="space-y-4"><ProjectSelector projects={projects as Row[]} selectedProjectId={selectedProjectId} onChange={setSelectedProjectId} /><Button onClick={() => setLocation("/enterprise-profile")} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">进入企业档案</Button></div></InfoCard>
    </PageShell>
  );
}

export function QuestionsPage() {
  const utils = trpc.useUtils();
  const { projects, selectedProjectId, setSelectedProjectId, input, enabled } = useSelectedProject();
  const questions = trpc.geo.questions.list.useQuery(input, { enabled });
  const responses = trpc.geo.aiResponses.list.useQuery(input, { enabled });
  const analyses = trpc.geo.analysis.list.useQuery(input, { enabled });
  const score = trpc.geo.scores.latest.useQuery(input, { enabled });
  const tasks = trpc.geo.tasks.list.useQuery(input, { enabled });
  const generateQuestions = trpc.geo.questions.generate.useMutation({ onSuccess: async () => { toast.success("客户问题已生成"); await utils.geo.questions.list.invalidate(); }, onError: error => toast.error(error.message) });
  const runAnalysis = trpc.geo.analysis.run.useMutation({ onSuccess: async () => { toast.success("诊断结果已生成"); await utils.geo.analysis.list.invalidate(); }, onError: error => toast.error(error.message) });
  const calculateScore = trpc.geo.scores.calculate.useMutation({ onSuccess: async () => { toast.success("GEO 评分已生成"); await utils.geo.scores.latest.invalidate(); }, onError: error => toast.error(error.message) });
  const generateTasks = trpc.geo.tasks.generate.useMutation({ onSuccess: async () => { toast.success("下一步建议已生成"); await utils.geo.tasks.list.invalidate(); }, onError: error => toast.error(error.message) });
  const q = questions.data ?? [];
  const r = responses.data ?? [];
  const a = analyses.data ?? [];
  const t = tasks.data ?? [];
  const next = q.length === 0 ? { label: "生成客户问题", action: () => selectedProjectId && generateQuestions.mutate({ projectId: selectedProjectId }) } : r.length === 0 ? { label: "导入 AI 回答", action: () => toast.info("请补充真实 AI 回答后再运行诊断") } : a.length === 0 ? { label: "生成诊断结果", action: () => selectedProjectId && runAnalysis.mutate({ projectId: selectedProjectId }) } : !score.data ? { label: "生成诊断评分", action: () => selectedProjectId && calculateScore.mutate({ projectId: selectedProjectId }) } : t.length === 0 ? { label: "生成下一步建议", action: () => selectedProjectId && generateTasks.mutate({ projectId: selectedProjectId }) } : { label: "进入内容生成", action: () => { window.location.href = "/content-generation"; } };
  return (
    <PageShell title="AI 诊断" desc="AI 诊断页只展示客户问题、AI 回答、诊断结果、内容缺口、下一步建议五个区域，并保留一个主动作按钮。" guide={{ stage: "AI 诊断", completion: a.length ? 58 : q.length ? 35 : 20, nextAction: next.label, why: "诊断结果决定内容写什么、补什么证据以及如何解释竞品差距。", risk: "样本量有限时不代表全网绝对排名。", ctaLabel: next.label, ctaPath: "/ai-diagnosis" }}>
      <InfoCard title="项目选择" icon={Target}><ProjectSelector projects={projects as Row[]} selectedProjectId={selectedProjectId} onChange={setSelectedProjectId} /></InfoCard>
      <div className="grid gap-4 lg:grid-cols-5">
        {[{ title: "客户问题", value: q.length, desc: q[0]?.questionText }, { title: "AI 回答", value: r.length, desc: r[0]?.aiPlatform }, { title: "诊断结果", value: a.length, desc: a[0]?.contentGap }, { title: "内容缺口", value: a.filter(item => item.contentGap).length, desc: a[0]?.optimizationSuggestion }, { title: "下一步建议", value: t.length, desc: t[0]?.taskName }].map(item => <div key={item.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-slate-100"><p className="text-sm text-cyan-200">{item.title}</p><p className="mt-2 text-3xl font-semibold text-white">{item.value}</p><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">{textValue(item.desc, "暂无数据")}</p></div>)}
      </div>
      <Button onClick={next.action} disabled={!selectedProjectId} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{next.label}</Button>
    </PageShell>
  );
}

export function ResponsesPage() { return <QuestionsPage />; }
export function AnalysisPage() { return <QuestionsPage />; }
export function ScoresPage() { return <QuestionsPage />; }
export function TasksPage() { return <ArticlesPage />; }

const recommendedTypes = ["竞品对比文章", "产品能力说明文章", "行业选型 / FAQ 文章"];

export function ArticlesPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { projects, selectedProjectId, setSelectedProjectId, input, enabled } = useSelectedProject();
  const [location] = useLocation();
  const isPublishing = location === "/content-publishing" || location === "/publish";
  const topics = trpc.geo.articles.topics.list.useQuery(input, { enabled });
  const articles = trpc.geo.articles.list.useQuery(input, { enabled });
  const qualityScores = trpc.geo.articles.latestQualityScores.useQuery(input, { enabled });
  const records = trpc.geo.articles.publishRecords.useQuery(input, { enabled });
  const generateTopics = trpc.geo.articles.topics.generate.useMutation({ onSuccess: async () => { toast.success("推荐内容已生成"); await utils.geo.articles.topics.list.invalidate(); }, onError: error => toast.error(error.message) });
  const publishArticle = trpc.geo.articles.publish.useMutation({ onSuccess: async data => { toast.success(`已发布：${data.publicPath}`); await Promise.all([utils.geo.articles.list.invalidate(), utils.geo.articles.publishRecords.invalidate()]); }, onError: error => toast.error(error.message) });
  const scoreByArticle = new Map((qualityScores.data ?? []).map(item => [item.articleId, item]));
  const articleStatuses = (articles.data ?? []).map(article => {
    const score = scoreByArticle.get(article.id);
    const check = buildPublishCheckSummary(score as any, article.consistencyCheck as any, article.generationBasis as any, article.factTraceability as any, `${article.title}\n${article.markdownContent ?? ""}`);
    return { article, score, check, status: publishStatusForArticle(article.status, score as any, check, records.data?.find(record => record.articleId === article.id)) };
  });

  if (isPublishing) {
    const guide = projectPublishSummary(articleStatuses.map(item => ({ status: item.status })), records.data?.length ?? 0);
    return (
      <PageShell title="内容发布" desc="内容发布页只展示可发布内容和已发布内容；第三方平台素材放入折叠区，当前只生成素材不自动登录发布。" guide={guide}>
        <InfoCard title="项目选择" icon={Target}><ProjectSelector projects={projects as Row[]} selectedProjectId={selectedProjectId} onChange={setSelectedProjectId} /></InfoCard>
        <div className="grid gap-4 lg:grid-cols-2">
          <InfoCard title="可发布内容" desc="通过准入检查" icon={Send}><div className="space-y-3">{articleStatuses.filter(item => item.status === "允许发布").map(item => <div key={item.article.id} className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4"><p className="font-semibold text-white">{item.article.title}</p><p className="mt-1 text-sm text-emerald-100">质量评分：{item.score?.totalScore ?? "待评分"} · 发布准入状态：允许发布</p><Button onClick={() => publishArticle.mutate({ articleId: item.article.id })} className="mt-3 bg-cyan-400 text-slate-950 hover:bg-cyan-300">发布到 GEO 内容页</Button></div>)}{articleStatuses.filter(item => item.status === "允许发布").length === 0 ? <p className="text-sm text-slate-400">暂无可发布内容，请先在内容生成页完成文章和质检。</p> : null}</div></InfoCard>
          <InfoCard title="已发布内容" desc="进入监测链路" icon={RadioTower}><div className="space-y-3">{(records.data ?? []).map(record => <div key={record.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="font-semibold text-white">{record.publishChannel}</p><p className="mt-1 text-sm text-slate-300">{record.publishUrl} · {record.publishStatus}</p><p className="mt-1 text-xs text-slate-400">质量评分：{record.qualityScore ?? "未记录"}</p></div>)}{(records.data ?? []).length === 0 ? <p className="text-sm text-slate-400">暂无已发布内容。</p> : null}</div></InfoCard>
        </div>
        <details className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-slate-100"><summary className="cursor-pointer font-semibold text-white">第三方平台素材</summary><p className="mt-3 text-sm leading-6 text-slate-300">当前只生成官网 / 知识库 / 社媒等第三方平台的素材建议，不自动登录、不自动发布、不保存第三方平台明文账号密码。</p></details>
      </PageShell>
    );
  }

  return (
    <PageShell title="内容生成" desc="内容生成页只展示竞品对比文章、产品能力说明文章、行业选型 / FAQ 文章三类推荐内容，文章卡片显示发布准入状态和阻断原因。" guide={{ stage: "内容生成", completion: (articles.data ?? []).length ? 70 : 55, nextAction: (topics.data ?? []).length ? "生成或质检推荐文章" : "生成三类推荐内容", why: "内容必须回应诊断缺口和客户高意向问题。", risk: "质量分、事实确认或合规检查未通过时禁止发布。", ctaLabel: (articles.data ?? []).length ? "进入内容发布" : "生成推荐内容", ctaPath: (articles.data ?? []).length ? "/content-publishing" : "/content-generation" }}>
      <InfoCard title="项目选择" icon={Target}><ProjectSelector projects={projects as Row[]} selectedProjectId={selectedProjectId} onChange={setSelectedProjectId} /></InfoCard>
      <div className="grid gap-4 lg:grid-cols-3">{recommendedTypes.map(type => <div key={type} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-slate-100"><FileText className="h-5 w-5 text-cyan-200" /><h2 className="mt-3 text-lg font-semibold text-white">{type}</h2><p className="mt-2 text-sm leading-6 text-slate-400">围绕客户指定问题、诊断缺口和已确认企业资料生成，避免无来源内容。</p></div>)}</div>
      <div className="grid gap-4 lg:grid-cols-2">{(articles.data ?? []).map(article => { const score = scoreByArticle.get(article.id); const check = buildPublishCheckSummary(score as any, article.consistencyCheck as any, article.generationBasis as any, article.factTraceability as any, `${article.title}\n${article.markdownContent ?? ""}`); const status = publishStatusForArticle(article.status, score as any, check); return <div key={article.id} className="rounded-3xl border border-white/10 bg-slate-950/56 p-5"><p className="text-xs text-cyan-200">{article.articleType}</p><h3 className="mt-2 font-semibold text-white">{article.title}</h3><p className="mt-2 text-sm text-slate-300">发布准入状态：{status} · 质量评分：{score?.totalScore ?? "待评分"}</p>{check.blockReasons.length ? <p className="mt-2 text-xs leading-5 text-amber-100">阻断原因：{check.blockReasons.join("；")}</p> : <p className="mt-2 text-xs text-emerald-100">当前未发现发布阻断项。</p>}</div>; })}</div>
      <div className="flex gap-3"><Button onClick={() => selectedProjectId && generateTopics.mutate({ projectId: selectedProjectId })} disabled={!selectedProjectId} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">生成推荐内容</Button><Button onClick={() => setLocation("/content-publishing")} variant="outline" className="border-white/15 text-slate-100 hover:bg-white/10">进入内容发布</Button></div>
    </PageShell>
  );
}

export function MonitoringPage() {
  const { projects, selectedProjectId, setSelectedProjectId, input, enabled } = useSelectedProject();
  const records = trpc.geo.articles.publishRecords.useQuery(input, { enabled });
  const rows = records.data ?? [];
  return (
    <PageShell title="收录监测" desc="收录监测页只展示已发布内容监测卡片，显示收录、AI 提及、AI 推荐、最近检测时间和当前建议。" guide={{ stage: "收录监测", completion: rows.length ? 88 : 74, nextAction: rows.length ? "查看监测结果并准备报告" : "先发布内容后再监测", why: "发布后的监测结果决定是否复测和优化。", risk: "不承诺保证收录、保证排名或保证被 AI 推荐。", ctaLabel: rows.length ? "进入交付报告" : "进入内容发布", ctaPath: rows.length ? "/delivery-reports" : "/content-publishing" }}>
      <InfoCard title="项目选择" icon={Target}><ProjectSelector projects={projects as Row[]} selectedProjectId={selectedProjectId} onChange={setSelectedProjectId} /></InfoCard>
      <div className="grid gap-4 lg:grid-cols-2">{rows.map(record => <div key={record.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-slate-100"><RadioTower className="h-5 w-5 text-cyan-200" /><h2 className="mt-3 font-semibold text-white">{record.publishUrl}</h2><div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2"><span>收录：待检测</span><span>AI 提及：待检测</span><span>AI 推荐：待检测</span><span>最近检测时间：{record.publishedAt ? new Date(record.publishedAt).toLocaleString() : "待检测"}</span></div><p className="mt-3 text-sm leading-6 text-slate-400">当前建议：{record.needRetest ? "进入复测，观察是否被收录、被 AI 提及、被 AI 推荐。" : "保持监测，等待更多样本。"}</p></div>)}{rows.length === 0 ? <p className="text-sm text-slate-400">暂无已发布内容监测卡片。</p> : null}</div>
    </PageShell>
  );
}

export function ReportsPage() {
  const utils = trpc.useUtils();
  const { projects, selectedProjectId, setSelectedProjectId, input, enabled } = useSelectedProject();
  const report = trpc.geo.reports.latest.useQuery(input, { enabled });
  const generateReport = trpc.geo.reports.generate.useMutation({ onSuccess: async () => { toast.success("交付报告已生成"); await utils.geo.reports.latest.invalidate(); }, onError: error => toast.error(error.message) });
  const reportTypes = ["GEO 诊断报告", "内容生产报告", "发布监测报告", "复测优化报告"];
  return (
    <PageShell title="交付报告" desc="交付报告页只展示 GEO 诊断报告、内容生产报告、发布监测报告、复测优化报告四类报告卡片，并保留风险说明。" guide={{ stage: "交付报告", completion: report.data ? 96 : 86, nextAction: report.data ? "查看并交付报告" : "生成交付报告", why: "报告把建档、诊断、内容、发布和监测串成客户可解释结果。", risk: "报告只能引用已确认事实，不承诺保证收录、排名或 AI 推荐。", ctaLabel: report.data ? "返回总览" : "生成交付报告", ctaPath: report.data ? "/" : "/delivery-reports" }}>
      <InfoCard title="项目选择" icon={Target}><ProjectSelector projects={projects as Row[]} selectedProjectId={selectedProjectId} onChange={setSelectedProjectId} /></InfoCard>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{reportTypes.map(type => <div key={type} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-slate-100"><FileBarChart2 className="h-5 w-5 text-cyan-200" /><h2 className="mt-3 font-semibold text-white">{type}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{report.data ? "已有最新报告数据，可用于客户交付。" : "等待生成最新报告。"}</p></div>)}</div>
      <Card className="border-amber-300/15 bg-amber-400/10 text-amber-50"><CardHeader><CardTitle className="flex items-center gap-2 text-amber-50"><AlertTriangle className="h-5 w-5" /> 风险说明</CardTitle></CardHeader><CardContent className="space-y-2 text-sm leading-6"><p>不承诺保证收录、保证排名或保证被 AI 推荐。</p><p>样本量有限，不代表全网绝对排名；报告只引用已确认事实和系统内记录。</p></CardContent></Card>
      <Button onClick={() => selectedProjectId && generateReport.mutate({ projectId: selectedProjectId })} disabled={!selectedProjectId} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">生成交付报告</Button>
    </PageShell>
  );
}
