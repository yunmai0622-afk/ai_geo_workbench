import { GeoStatusGuide } from "@/components/GeoStatusGuide";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Brain, CheckCircle2, FileBarChart2, FileText, HelpCircle, RadioTower, Send, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type ProjectOption = { id: number; enterpriseName: string };

type ArticleLike = {
  id: number;
  title: string;
  articleType?: string | null;
  status?: string | null;
  qualityScore?: number | null;
  publishStatus?: string | null;
};

type PublishRecordLike = {
  id: number;
  articleId?: number | null;
  title?: string | null;
  publishStatus?: string | null;
  publicUrl?: string | null;
  needRetest?: number | boolean | null;
  checkedAt?: number | null;
  notes?: string | null;
};

function useProjectSelection() {
  const { data: projects = [] } = trpc.geo.projects.list.useQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>();

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  const projectInput = useMemo(() => ({ projectId: selectedProjectId }), [selectedProjectId]);
  return { projects: projects as ProjectOption[], selectedProjectId, setSelectedProjectId, projectInput, enabled: Boolean(selectedProjectId) };
}

function ProjectSelector({ projects, selectedProjectId, setSelectedProjectId }: { projects: ProjectOption[]; selectedProjectId?: number; setSelectedProjectId: (id?: number) => void }) {
  return (
    <select value={selectedProjectId ?? ""} onChange={event => setSelectedProjectId(Number(event.target.value) || undefined)} className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 md:max-w-md">
      <option value="">请选择项目</option>
      {projects.map(project => <option key={project.id} value={project.id}>{project.enterpriseName}</option>)}
    </select>
  );
}

function InfoCard({ title, desc, value }: { title: string; desc: string; value?: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/56 p-5 text-slate-100">
      <p className="text-sm font-semibold text-cyan-100">{title}</p>
      {value ? <p className="mt-2 text-2xl font-semibold text-white">{value}</p> : null}
      <p className="mt-2 text-sm leading-6 text-slate-400">{desc}</p>
    </div>
  );
}

function EmptyStep({ title, description }: { title: string; description: string }) {
  return <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-sm leading-6 text-slate-300"><p className="font-semibold text-white">{title}</p><p className="mt-2">{description}</p></div>;
}

function articleGate(article: ArticleLike, qualityScore?: number | null) {
  const score = qualityScore ?? article.qualityScore ?? 0;
  if (article.status === "已发布" || article.publishStatus === "已发布") return { label: "已发布", reason: "已进入公开内容页，可进入收录监测。", tone: "text-emerald-200" };
  if (score >= 80 || article.status === "审核通过") return { label: "允许发布", reason: "质量评分和人工状态满足发布准入。", tone: "text-emerald-200" };
  if (score > 0) return { label: "暂不可发布", reason: "质量评分低于 80 分，需要先优化。", tone: "text-amber-200" };
  return { label: "待质检", reason: "缺少质量评分，暂不进入发布队列。", tone: "text-slate-300" };
}

export function AiDiagnosisFlowPage() {
  const [, setLocation] = useLocation();
  const { projects, selectedProjectId, setSelectedProjectId, projectInput, enabled } = useProjectSelection();
  const questionsQuery = trpc.geo.questions.list.useQuery(projectInput, { enabled });
  const responsesQuery = trpc.geo.aiResponses.list.useQuery(projectInput, { enabled });
  const analysisQuery = trpc.geo.analysis.list.useQuery(projectInput, { enabled });
  const questions = questionsQuery.data ?? [];
  const responses = responsesQuery.data ?? [];
  const analyses = analysisQuery.data ?? [];
  const completion = analyses.length > 0 ? 80 : responses.length > 0 ? 60 : questions.length > 0 ? 40 : 20;
  const primaryAction = analyses.length > 0 ? { label: "进入内容生成", path: "/content-generation" } : responses.length > 0 ? { label: "生成诊断结果", path: "/analysis" } : { label: "整理客户问题", path: "/questions" };

  return (
    <div className="space-y-6 text-slate-100">
      <GeoStatusGuide stage="AI 诊断" completion={completion} nextAction={primaryAction.label} why="AI 诊断页只展示客户问题、AI 回答、诊断结果、内容缺口和下一步建议。" risk="样本量有限，不代表全网绝对排名；不得用模拟回答替代真实样本。" ctaLabel={primaryAction.label} ctaPath={primaryAction.path} />
      <Card className="border-white/10 bg-white/[0.04] text-slate-100"><CardHeader><CardTitle className="text-white">AI 诊断</CardTitle><CardDescription className="text-cyan-200">五个区域，一次判断当前诊断是否足够支撑内容生成。</CardDescription></CardHeader><CardContent className="space-y-5"><ProjectSelector projects={projects} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} /><div className="grid gap-4 lg:grid-cols-5"><InfoCard title="客户问题" value={String(questions.length)} desc="已进入诊断的问题数量，优先覆盖客户真实高意向问题。" /><InfoCard title="AI 回答" value={String(responses.length)} desc="已导入的 AI 原始回答，用于判断品牌是否被提及和推荐。" /><InfoCard title="诊断结果" value={String(analyses.length)} desc="系统已形成的可见度、推荐率、竞品胜出和未推荐原因。" /><InfoCard title="内容缺口" desc={analyses.length > 0 ? "已从诊断结果中提取待补齐内容方向。" : "需要先导入回答并生成诊断结果。"} /><InfoCard title="下一步建议" desc={primaryAction.label} /></div><div className="flex justify-end"><Button onClick={() => setLocation(primaryAction.path)} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{primaryAction.label}</Button></div></CardContent></Card>
    </div>
  );
}

export function ContentGenerationFlowPage() {
  const [, setLocation] = useLocation();
  const { projects, selectedProjectId, setSelectedProjectId, projectInput, enabled } = useProjectSelection();
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const scoresQuery = trpc.geo.articles.latestQualityScores.useQuery(projectInput, { enabled });
  const articles = (articlesQuery.data ?? []) as ArticleLike[];
  const scores = scoresQuery.data ?? [];
  const scoreMap = new Map(scores.map(score => [score.articleId, score.totalScore]));
  const types = ["竞品对比文章", "产品能力说明文章", "行业选型 / FAQ 文章"];
  const publishable = articles.filter(article => articleGate(article, scoreMap.get(article.id)).label === "允许发布").length;
  const primaryAction = publishable > 0 ? { label: "进入内容发布", path: "/content-publishing" } : { label: "生成推荐内容", path: "/articles" };

  return (
    <div className="space-y-6 text-slate-100">
      <GeoStatusGuide stage="内容生成" completion={publishable > 0 ? 78 : articles.length > 0 ? 58 : 36} nextAction={primaryAction.label} why="内容生成页只展示三类推荐内容，并让每张文章卡片显示发布准入状态和阻断原因。" risk="质量评分、事实确认或合规检查未通过时不进入发布。" ctaLabel={primaryAction.label} ctaPath={primaryAction.path} />
      <Card className="border-white/10 bg-white/[0.04] text-slate-100"><CardHeader><CardTitle className="text-white">内容生成</CardTitle><CardDescription className="text-cyan-200">推荐内容类型：竞品对比、产品能力说明、行业选型 / FAQ。</CardDescription></CardHeader><CardContent className="space-y-5"><ProjectSelector projects={projects} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} /><div className="grid gap-4 lg:grid-cols-3">{types.map(type => <InfoCard key={type} title={type} desc="围绕 AI 诊断中的高意向问题和内容缺口生成，发布前必须通过质量与风险检查。" />)}</div>{articles.length === 0 ? <EmptyStep title="暂无推荐文章" description="请先完成 AI 诊断，再生成竞品对比、产品能力说明或行业选型 / FAQ 内容。" /> : <div className="space-y-3">{articles.map(article => { const gate = articleGate(article, scoreMap.get(article.id)); return <div key={article.id} className="rounded-3xl border border-white/10 bg-slate-950/56 p-5"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-sm text-cyan-200">{article.articleType || "推荐内容"}</p><h3 className="mt-1 font-semibold text-white">{article.title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">阻断原因：{gate.reason}</p></div><span className={`rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs ${gate.tone}`}>{gate.label}</span></div></div>; })}</div>}<div className="flex justify-end"><Button onClick={() => setLocation(primaryAction.path)} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{primaryAction.label}</Button></div></CardContent></Card>
    </div>
  );
}

export function ContentPublishingFlowPage() {
  const [, setLocation] = useLocation();
  const { projects, selectedProjectId, setSelectedProjectId, projectInput, enabled } = useProjectSelection();
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const scoresQuery = trpc.geo.articles.latestQualityScores.useQuery(projectInput, { enabled });
  const recordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });
  const articles = (articlesQuery.data ?? []) as ArticleLike[];
  const records = (recordsQuery.data ?? []) as PublishRecordLike[];
  const scores = scoresQuery.data ?? [];
  const scoreMap = new Map(scores.map(score => [score.articleId, score.totalScore]));
  const publishable = articles.filter(article => articleGate(article, scoreMap.get(article.id)).label === "允许发布");
  const primaryAction = records.length > 0 ? { label: "进入收录监测", path: "/inclusion-monitoring" } : publishable.length > 0 ? { label: "查看可发布内容", path: "/content-publishing" } : { label: "返回内容生成", path: "/content-generation" };

  return (
    <div className="space-y-6 text-slate-100">
      <GeoStatusGuide stage="内容发布" completion={records.length > 0 ? 86 : publishable.length > 0 ? 72 : 48} nextAction={primaryAction.label} why="内容发布页只展示可发布内容和已发布内容，避免把后台辅助能力作为一级流程。" risk="第三方平台素材仅用于复制参考，当前不自动登录外部平台发布。" ctaLabel={primaryAction.label} ctaPath={primaryAction.path} />
      <Card className="border-white/10 bg-white/[0.04] text-slate-100"><CardHeader><CardTitle className="text-white">内容发布</CardTitle><CardDescription className="text-cyan-200">可发布内容与已发布内容。</CardDescription></CardHeader><CardContent className="space-y-5"><ProjectSelector projects={projects} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} /><section><h2 className="text-lg font-semibold text-white">可发布内容</h2>{publishable.length === 0 ? <EmptyStep title="暂无可发布内容" description="请先让文章满足质量评分、事实确认和合规要求。" /> : <div className="mt-3 space-y-3">{publishable.map(article => <div key={article.id} className="rounded-3xl border border-emerald-300/15 bg-emerald-400/10 p-5"><p className="font-semibold text-white">{article.title}</p><p className="mt-2 text-sm text-emerald-100">允许发布：已满足当前发布准入。</p></div>)}</div>}</section><section><h2 className="text-lg font-semibold text-white">已发布内容</h2>{records.length === 0 ? <EmptyStep title="暂无已发布内容" description="发布后会在这里显示公开地址、状态和后续监测建议。" /> : <div className="mt-3 space-y-3">{records.map(record => <div key={record.id} className="rounded-3xl border border-white/10 bg-slate-950/56 p-5"><p className="font-semibold text-white">{record.title ?? `内容 #${record.articleId ?? record.id}`}</p><p className="mt-2 text-sm text-slate-300">状态：{record.publishStatus ?? "已发布"}</p>{record.publicUrl ? <a className="mt-2 inline-block text-sm text-cyan-200 underline" href={record.publicUrl}>查看公开内容页</a> : null}</div>)}</div>}</section><details className="rounded-3xl border border-white/10 bg-slate-950/56 p-5"><summary className="cursor-pointer font-semibold text-cyan-100">第三方平台素材</summary><p className="mt-3 text-sm leading-6 text-slate-300">当前只生成可复制素材，不自动登录第三方平台，不保存外部账号明文凭证。</p></details><div className="flex justify-end"><Button onClick={() => setLocation(primaryAction.path)} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{primaryAction.label}</Button></div></CardContent></Card>
    </div>
  );
}

export function InclusionMonitoringFlowPage() {
  const [, setLocation] = useLocation();
  const { projects, selectedProjectId, setSelectedProjectId, projectInput, enabled } = useProjectSelection();
  const recordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });
  const records = (recordsQuery.data ?? []) as PublishRecordLike[];
  const primaryAction = records.length > 0 ? { label: "生成交付报告", path: "/delivery-reports" } : { label: "返回内容发布", path: "/content-publishing" };

  return (
    <div className="space-y-6 text-slate-100">
      <GeoStatusGuide stage="收录监测" completion={records.length > 0 ? 90 : 62} nextAction={primaryAction.label} why="收录监测页只展示已发布内容监测卡片，记录收录、AI 提及、AI 推荐、最近检测时间和当前建议。" risk="监测结果来自有限样本，不代表全网绝对排名。" ctaLabel={primaryAction.label} ctaPath={primaryAction.path} />
      <Card className="border-white/10 bg-white/[0.04] text-slate-100"><CardHeader><CardTitle className="text-white">收录监测</CardTitle><CardDescription className="text-cyan-200">已发布内容监测卡片。</CardDescription></CardHeader><CardContent className="space-y-5"><ProjectSelector projects={projects} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} />{records.length === 0 ? <EmptyStep title="暂无已发布内容" description="请先完成内容发布，再记录收录、AI 提及和 AI 推荐结果。" /> : <div className="grid gap-4 lg:grid-cols-2">{records.map(record => <div key={record.id} className="rounded-3xl border border-white/10 bg-slate-950/56 p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-white">{record.title ?? `内容 #${record.articleId ?? record.id}`}</p><p className="mt-2 text-sm text-slate-400">最近检测时间：{record.checkedAt ? new Date(record.checkedAt).toLocaleString() : "待检测"}</p></div><RadioTower className="h-5 w-5 text-cyan-200" /></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><InfoCard title="收录" desc={record.publishStatus?.includes("收录") ? "已记录收录" : "待确认"} /><InfoCard title="AI 提及" desc={record.notes?.includes("提及") ? "已提及" : "待复测"} /><InfoCard title="AI 推荐" desc={record.notes?.includes("推荐") ? "已推荐" : "待复测"} /></div><p className="mt-4 text-sm text-amber-100">当前建议：{record.needRetest ? "进入下一轮复测。" : "保持监测并更新客户报告。"}</p></div>)}</div>}<div className="flex justify-end"><Button onClick={() => setLocation(primaryAction.path)} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{primaryAction.label}</Button></div></CardContent></Card>
    </div>
  );
}

export function DeliveryReportsFlowPage() {
  const [, setLocation] = useLocation();
  const { projects, selectedProjectId, setSelectedProjectId, projectInput, enabled } = useProjectSelection();
  const reportQuery = trpc.geo.reports.latest.useQuery(projectInput, { enabled });
  const recordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });
  const reportCards = ["GEO 诊断报告", "内容生产报告", "发布监测报告", "复测优化报告"];

  return (
    <div className="space-y-6 text-slate-100">
      <GeoStatusGuide stage="交付报告" completion={reportQuery.data ? 96 : 82} nextAction="返回总览" why="交付报告页只展示四类报告卡片，帮助客户理解本轮试跑产出。" risk="报告只能引用已确认事实，不承诺保证收录、排名或 AI 推荐。" ctaLabel="返回总览" ctaPath="/" />
      <Card className="border-white/10 bg-white/[0.04] text-slate-100"><CardHeader><CardTitle className="text-white">交付报告</CardTitle><CardDescription className="text-cyan-200">四类客户交付报告。</CardDescription></CardHeader><CardContent className="space-y-5"><ProjectSelector projects={projects} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{reportCards.map((title, index) => <div key={title} className="rounded-3xl border border-white/10 bg-slate-950/56 p-5"><div className="flex items-start justify-between gap-3"><h2 className="font-semibold text-white">{title}</h2>{index === 0 ? <Brain className="h-5 w-5 text-cyan-200" /> : index === 1 ? <FileText className="h-5 w-5 text-cyan-200" /> : index === 2 ? <Send className="h-5 w-5 text-cyan-200" /> : <FileBarChart2 className="h-5 w-5 text-cyan-200" />}</div><p className="mt-3 text-sm leading-6 text-slate-400">{index === 0 ? "说明 AI 可见度、推荐率、竞品差距和内容缺口。" : index === 1 ? "说明已生成内容类型、质量状态和发布准入。" : index === 2 ? `说明 ${recordsQuery.data?.length ?? 0} 条已发布内容的监测状态。` : "说明待复测内容、优化建议和下一轮动作。"}</p></div>)}</div><Card className="border-amber-300/15 bg-amber-400/10 text-amber-50"><CardHeader><CardTitle className="flex items-center gap-2 text-amber-50"><AlertTriangle className="h-5 w-5" /> 风险说明</CardTitle></CardHeader><CardContent className="space-y-2 text-sm leading-6"><p>样本量有限，不代表全网绝对排名。</p><p>不承诺保证收录、保证排名或保证被 AI 推荐。</p><p>未确认事实、不可公开资料和客户未授权内容不能写入正式报告。</p><p className="flex items-center gap-2 text-emerald-100"><CheckCircle2 className="h-4 w-4" /> 报告需保留数据来源和人工复核结论。</p></CardContent></Card><div className="flex justify-end"><Button onClick={() => setLocation("/")} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">返回总览</Button></div></CardContent></Card>
    </div>
  );
}
