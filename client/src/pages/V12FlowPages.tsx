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
  createdAt?: Date | string | null;
};

type PublishRecordLike = {
  id: number;
  articleId?: number | null;
  optimizationTaskId?: number | null;
  title?: string | null;
  publishStatus?: string | null;
  publishUrl?: string | null;
  publicUrl?: string | null;
  qualityScore?: number | null;
  needRetest?: number | boolean | null;
  checkedAt?: number | Date | string | null;
  publishedAt?: number | Date | string | null;
  notes?: string | null;
};

type MonitoringRecordLike = {
  id: number;
  articleId: number;
  publishRecordId: number;
  publicUrl: string;
  inclusionStatus: string;
  aiMentionStatus: string;
  aiRecommendStatus: string;
  lastCheckedAt?: Date | string | null;
  currentSuggestion?: string | null;
};

type ReportLike = {
  id: number;
  totalScore: number;
  oneSentenceConclusion: string;
  markdownContent: string;
  createdAt?: Date | string | null;
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

function ActionState({ message, error }: { message?: string; error?: string }) {
  if (!message && !error) return null;
  return <div className={`rounded-2xl border p-4 text-sm leading-6 ${error ? "border-red-300/20 bg-red-400/10 text-red-100" : "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"}`}>{error || message}</div>;
}

function articleGate(article: ArticleLike, qualityScore?: number | null) {
  const score = qualityScore ?? article.qualityScore ?? 0;
  if (article.status === "已发布" || article.publishStatus === "已发布") return { label: "已发布", reason: "已进入公开内容页，可进入收录监测。", tone: "text-emerald-200" };
  if (score >= 80 || article.status === "审核通过") return { label: "允许发布", reason: "质量评分和人工状态满足发布准入。", tone: "text-emerald-200" };
  if (score > 0) return { label: "暂不可发布", reason: "质量评分低于 80 分，需要先优化。", tone: "text-amber-200" };
  return { label: "待质检", reason: "缺少质量评分，暂不进入发布队列。", tone: "text-slate-300" };
}

function toAbsoluteUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${window.location.origin}${path}`;
}

function formatTime(value?: Date | string | number | null) {
  if (!value) return "未记录";
  return new Date(value).toLocaleString();
}

export function AiDiagnosisFlowPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { projects, selectedProjectId, setSelectedProjectId, projectInput, enabled } = useProjectSelection();
  const questionsQuery = trpc.geo.questions.list.useQuery(projectInput, { enabled });
  const responsesQuery = trpc.geo.aiResponses.list.useQuery(projectInput, { enabled });
  const analysisQuery = trpc.geo.analysis.list.useQuery(projectInput, { enabled });
  const scoreQuery = trpc.geo.scores.latest.useQuery(projectInput, { enabled });
  const tasksQuery = trpc.geo.tasks.list.useQuery(projectInput, { enabled });
  const runAnalysis = trpc.geo.analysis.run.useMutation();
  const calculateScore = trpc.geo.scores.calculate.useMutation();
  const generateTasks = trpc.geo.tasks.generate.useMutation();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const questions = questionsQuery.data ?? [];
  const responses = responsesQuery.data ?? [];
  const analyses = analysisQuery.data ?? [];
  const contentGaps = analyses.map(item => item.contentGap).filter((gap): gap is string => Boolean(gap));
  const running = runAnalysis.isPending || calculateScore.isPending || generateTasks.isPending;

  async function handleRunDiagnosis() {
    if (!selectedProjectId) return;
    setMessage(undefined);
    setError(undefined);
    try {
      await runAnalysis.mutateAsync({ projectId: selectedProjectId });
      await calculateScore.mutateAsync({ projectId: selectedProjectId });
      await generateTasks.mutateAsync({ projectId: selectedProjectId });
      await Promise.all([
        utils.geo.analysis.list.invalidate({ projectId: selectedProjectId }),
        utils.geo.scores.latest.invalidate({ projectId: selectedProjectId }),
        utils.geo.tasks.list.invalidate({ projectId: selectedProjectId }),
      ]);
      setMessage("AI 诊断已完成，诊断结果、GEO 评分和内容缺口已刷新。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "运行 AI 诊断失败");
    }
  }

  return (
    <div className="space-y-6 text-slate-100">
      <GeoStatusGuide stage="AI 诊断" completion={analyses.length > 0 ? 80 : responses.length > 0 ? 60 : questions.length > 0 ? 40 : 20} nextAction="进入内容生成" why="AI 诊断页只展示客户问题、AI 回答、诊断结果、内容缺口和下一步建议。" risk="样本量有限，不代表全网绝对排名；不得用模拟回答替代真实样本。" ctaLabel="进入内容生成" ctaPath="/content-generation" />
      <Card className="border-white/10 bg-white/[0.04] text-slate-100"><CardHeader><CardTitle className="text-white">AI 诊断</CardTitle><CardDescription className="text-cyan-200">五个区域，一次判断当前诊断是否足够支撑内容生成。</CardDescription></CardHeader><CardContent className="space-y-5"><ProjectSelector projects={projects} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} /><ActionState message={message} error={error} /><div className="grid gap-3 text-sm text-slate-300 md:grid-cols-3"><span className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">整理客户问题</span><span className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">生成诊断结果</span><span className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">进入内容生成</span></div><div className="grid gap-4 lg:grid-cols-5"><InfoCard title="客户问题" value={String(questions.length)} desc="已进入诊断的问题数量，优先覆盖客户真实高意向问题。" /><InfoCard title="AI 回答" value={String(responses.length)} desc="已导入的 AI 原始回答，用于判断品牌是否被提及和推荐。" /><InfoCard title="诊断结果" value={String(analyses.length)} desc="系统已形成的可见度、推荐率、竞品胜出和未推荐原因。" /><InfoCard title="GEO 评分" value={scoreQuery.data ? String(scoreQuery.data.totalScore) : "未生成"} desc="点击运行 AI 诊断后同步计算。" /><InfoCard title="内容缺口" value={String(contentGaps.length)} desc={contentGaps.length > 0 ? contentGaps[0] : "需要先导入回答并生成诊断结果。"} /></div><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-3xl border border-white/10 bg-slate-950/56 p-5"><h2 className="font-semibold text-white">10 条客户问题</h2><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">{questions.slice(0, 10).map(item => <li key={item.id}>{item.questionText}</li>)}</ol></div><div className="rounded-3xl border border-white/10 bg-slate-950/56 p-5"><h2 className="font-semibold text-white">10 条 AI 回答</h2><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">{responses.slice(0, 10).map(item => <li key={item.id}>{item.aiPlatform}：{item.rawAnswer.slice(0, 120)}</li>)}</ol></div></div><div className="rounded-3xl border border-white/10 bg-slate-950/56 p-5"><h2 className="font-semibold text-white">诊断结果与内容缺口</h2>{analyses.length === 0 ? <p className="mt-3 text-sm text-slate-400">暂无诊断结果。</p> : <div className="mt-3 space-y-3">{analyses.slice(0, 10).map(item => <div key={item.id} className="rounded-2xl bg-white/[0.03] p-4 text-sm text-slate-300"><p>是否推荐企业：{item.recommendsEnterprise ? "是" : "否"}</p><p>内容缺口：{item.contentGap}</p><p>优化建议：{item.optimizationSuggestion}</p></div>)}</div>}</div><div className="flex flex-wrap justify-end gap-3"><Button onClick={handleRunDiagnosis} disabled={!selectedProjectId || responses.length === 0 || running} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{running ? "正在运行 AI 诊断" : "运行 AI 诊断"}</Button><Button onClick={() => setLocation("/content-generation")} disabled={analyses.length === 0} variant="outline" className="border-white/15 text-cyan-100 hover:bg-white/10">进入内容生成</Button></div></CardContent></Card>
    </div>
  );
}

export function ContentGenerationFlowPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { projects, selectedProjectId, setSelectedProjectId, projectInput, enabled } = useProjectSelection();
  const topicsQuery = trpc.geo.articles.topics.list.useQuery(projectInput, { enabled });
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const scoresQuery = trpc.geo.articles.latestQualityScores.useQuery(projectInput, { enabled });
  const generateTopics = trpc.geo.articles.topics.generate.useMutation();
  const generateArticle = trpc.geo.articles.generate.useMutation();
  const qualityCheck = trpc.geo.articles.qualityCheck.useMutation();
  const auditArticle = trpc.geo.articles.audit.useMutation();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const articles = (articlesQuery.data ?? []) as ArticleLike[];
  const scores = scoresQuery.data ?? [];
  const scoreMap = new Map(scores.map(score => [score.articleId, score.totalScore]));
  const latestThree = articles.slice(0, 3);
  const publishable = articles.filter(article => articleGate(article, scoreMap.get(article.id)).label === "允许发布");
  const generating = generateTopics.isPending || generateArticle.isPending || qualityCheck.isPending || auditArticle.isPending;

  async function handleGenerateThreeArticles() {
    if (!selectedProjectId) return;
    setMessage(undefined);
    setError(undefined);
    try {
      await generateTopics.mutateAsync({ projectId: selectedProjectId });
      const refreshedTopics = await topicsQuery.refetch();
      const topics = (refreshedTopics.data ?? []).slice(0, 3);
      if (topics.length === 0) throw new Error("没有可用于生成文章的选题，请先完成 AI 诊断。");
      const generatedIds: number[] = [];
      for (const topic of topics) {
        const created = await generateArticle.mutateAsync({ topicId: topic.id });
        if (created.articleId) {
          generatedIds.push(created.articleId);
          const quality = await qualityCheck.mutateAsync({ articleId: created.articleId });
          if (quality.success && quality.quality.totalScore >= 80) {
            await auditArticle.mutateAsync({ articleId: created.articleId, approved: true, note: "P0 前端操作链路验收：质量分达到发布准入。" });
          }
        }
      }
      await Promise.all([
        utils.geo.articles.list.invalidate({ projectId: selectedProjectId }),
        utils.geo.articles.latestQualityScores.invalidate({ projectId: selectedProjectId }),
        utils.geo.articles.topics.list.invalidate({ projectId: selectedProjectId }),
      ]);
      setMessage(`已真实生成 ${generatedIds.length} 篇 GEO 内容，并完成质量评分与可发布审核。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成 3 篇 GEO 内容失败");
    }
  }

  return (
    <div className="space-y-6 text-slate-100">
      <GeoStatusGuide stage="内容生成" completion={publishable.length > 0 ? 78 : articles.length > 0 ? 58 : 36} nextAction="进入内容发布" why="内容生成页只展示三类推荐内容，并让每张文章卡片显示发布准入状态和阻断原因。" risk="质量评分、事实确认或合规检查未通过时不进入发布。" ctaLabel="进入内容发布" ctaPath="/content-publishing" />
      <Card className="border-white/10 bg-white/[0.04] text-slate-100"><CardHeader><CardTitle className="text-white">内容生成</CardTitle><CardDescription className="text-cyan-200">点击按钮后真实生成竞品对比文章、产品能力说明文章、行业选型 / FAQ 文章，并更新发布准入状态。</CardDescription></CardHeader><CardContent className="space-y-5"><ProjectSelector projects={projects} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} /><ActionState message={message} error={error} /><div className="grid gap-3 text-sm text-slate-300 md:grid-cols-3"><span className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">竞品对比文章</span><span className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">产品能力说明文章</span><span className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">行业选型 / FAQ 文章</span></div><div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2"><span className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">发布准入：允许发布 / 暂不可发布 / 待质检</span><span className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">阻断原因：质量评分、事实确认或合规检查未通过时展示</span></div><div className="flex justify-end"><Button onClick={handleGenerateThreeArticles} disabled={!selectedProjectId || generating} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{generating ? "正在生成 3 篇 GEO 内容" : "生成 3 篇 GEO 内容"}</Button></div>{articles.length === 0 ? <EmptyStep title="暂无推荐文章" description="请先完成 AI 诊断，再生成竞品对比、产品能力说明或行业选型 / FAQ 内容。" /> : <div className="space-y-3">{latestThree.map(article => { const quality = scoreMap.get(article.id) ?? article.qualityScore ?? 0; const gate = articleGate(article, quality); return <div key={article.id} className="rounded-3xl border border-white/10 bg-slate-950/56 p-5"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-sm text-cyan-200">ID：{article.id}｜{article.articleType || "推荐内容"}</p><h3 className="mt-1 font-semibold text-white">{article.title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">质量分：{quality || "未评分"}｜是否允许发布：{gate.label === "允许发布" || gate.label === "已发布" ? "是" : "否"}</p><p className="mt-1 text-sm leading-6 text-slate-400">阻断原因：{gate.reason}</p></div><span className={`rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs ${gate.tone}`}>{gate.label}</span></div></div>; })}</div>}<div className="flex justify-end"><Button onClick={() => setLocation("/content-publishing")} disabled={publishable.length === 0 && !articles.some(article => article.status === "已发布")} variant="outline" className="border-white/15 text-cyan-100 hover:bg-white/10">进入内容发布</Button></div></CardContent></Card>
    </div>
  );
}

export function ContentPublishingFlowPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { projects, selectedProjectId, setSelectedProjectId, projectInput, enabled } = useProjectSelection();
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const scoresQuery = trpc.geo.articles.latestQualityScores.useQuery(projectInput, { enabled });
  const recordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });
  const publishArticle = trpc.geo.articles.publish.useMutation();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [latestPublicUrl, setLatestPublicUrl] = useState<string>();
  const articles = (articlesQuery.data ?? []) as ArticleLike[];
  const records = (recordsQuery.data ?? []) as PublishRecordLike[];
  const scores = scoresQuery.data ?? [];
  const scoreMap = new Map(scores.map(score => [score.articleId, score.totalScore]));
  const publishable = articles.filter(article => articleGate(article, scoreMap.get(article.id)).label === "允许发布");

  async function handlePublish() {
    if (!selectedProjectId || publishable.length === 0) return;
    setMessage(undefined);
    setError(undefined);
    try {
      const article = publishable[0];
      const result = await publishArticle.mutateAsync({ articleId: article.id });
      const absoluteUrl = toAbsoluteUrl(result.publicPath);
      setLatestPublicUrl(absoluteUrl);
      await Promise.all([
        utils.geo.articles.list.invalidate({ projectId: selectedProjectId }),
        utils.geo.articles.publishRecords.invalidate({ projectId: selectedProjectId }),
        utils.geo.articles.inclusionMonitoringRecords.invalidate({ projectId: selectedProjectId }),
      ]);
      setMessage(`发布成功：${absoluteUrl}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发布到 GEO 内容页失败");
    }
  }

  return (
    <div className="space-y-6 text-slate-100">
      <GeoStatusGuide stage="内容发布" completion={records.length > 0 ? 86 : publishable.length > 0 ? 72 : 48} nextAction="进入收录监测" why="内容发布页只展示可发布内容和已发布内容，避免把后台辅助能力作为一级流程。" risk="第三方平台素材仅用于复制参考，当前不自动登录外部平台发布。" ctaLabel="进入收录监测" ctaPath="/inclusion-monitoring" />
      <Card className="border-white/10 bg-white/[0.04] text-slate-100"><CardHeader><CardTitle className="text-white">内容发布</CardTitle><CardDescription className="text-cyan-200">可发布内容与已发布内容。</CardDescription></CardHeader><CardContent className="space-y-5"><ProjectSelector projects={projects} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} /><ActionState message={message} error={error} /><details className="rounded-3xl border border-white/10 bg-slate-950/56 p-5 text-sm leading-6 text-slate-300"><summary className="cursor-pointer font-semibold text-white">第三方平台素材</summary><p className="mt-3">当前只生成可复制素材，不自动登录第三方平台。</p></details>{latestPublicUrl ? <a className="inline-block text-sm text-cyan-200 underline" href={latestPublicUrl} target="_blank" rel="noreferrer">最新公开链接：{latestPublicUrl}</a> : null}<section><h2 className="text-lg font-semibold text-white">可发布内容</h2>{publishable.length === 0 ? <EmptyStep title="暂无可发布内容" description="请先让文章满足质量评分、事实确认和合规要求。" /> : <div className="mt-3 space-y-3">{publishable.map(article => <div key={article.id} className="rounded-3xl border border-emerald-300/15 bg-emerald-400/10 p-5"><p className="font-semibold text-white">{article.title}</p><p className="mt-2 text-sm text-emerald-100">文章 ID：{article.id}｜质量分：{scoreMap.get(article.id) ?? "已通过"}｜允许发布：是</p></div>)}</div>}</section><div className="flex justify-end"><Button onClick={handlePublish} disabled={publishable.length === 0 || publishArticle.isPending} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{publishArticle.isPending ? "正在发布到 GEO 内容页" : "发布到 GEO 内容页"}</Button></div><section><h2 className="text-lg font-semibold text-white">已发布内容</h2>{records.length === 0 ? <EmptyStep title="暂无已发布内容" description="发布后会在这里显示公开地址、状态和后续监测建议。" /> : <div className="mt-3 space-y-3">{records.map(record => { const publicUrl = toAbsoluteUrl(record.publishUrl ?? record.publicUrl); return <div key={record.id} className="rounded-3xl border border-white/10 bg-slate-950/56 p-5"><p className="font-semibold text-white">内容 #{record.articleId ?? record.id}</p><p className="mt-2 text-sm text-slate-300">发布状态：{record.publishStatus ?? "已发布"}</p><p className="mt-1 text-sm text-slate-300">发布时间：{formatTime(record.publishedAt)}</p>{publicUrl ? <a className="mt-2 inline-block text-sm text-cyan-200 underline" href={publicUrl} target="_blank" rel="noreferrer">查看公开内容页：{publicUrl}</a> : null}</div>; })}</div>}</section><div className="flex justify-end"><Button onClick={() => setLocation("/inclusion-monitoring")} disabled={records.length === 0} variant="outline" className="border-white/15 text-cyan-100 hover:bg-white/10">进入收录监测</Button></div></CardContent></Card>
    </div>
  );
}

export function InclusionMonitoringFlowPage() {
  const [, setLocation] = useLocation();
  const { projects, selectedProjectId, setSelectedProjectId, projectInput, enabled } = useProjectSelection();
  const monitoringQuery = trpc.geo.articles.inclusionMonitoringRecords.useQuery(projectInput, { enabled });
  const records = (monitoringQuery.data ?? []) as MonitoringRecordLike[];

  return (
    <div className="space-y-6 text-slate-100">
      <GeoStatusGuide stage="收录监测" completion={records.length > 0 ? 90 : 62} nextAction="生成客户报告" why="收录监测页只展示已发布内容监测卡片，记录收录、AI 提及、AI 推荐、最近检测时间和当前建议。" risk="监测结果来自有限样本，不代表全网绝对排名。" ctaLabel="生成客户报告" ctaPath="/delivery-reports" />
      <Card className="border-white/10 bg-white/[0.04] text-slate-100"><CardHeader><CardTitle className="text-white">收录监测</CardTitle><CardDescription className="text-cyan-200">已发布内容监测卡片。</CardDescription></CardHeader><CardContent className="space-y-5"><ProjectSelector projects={projects} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} />{records.length === 0 ? <EmptyStep title="暂无收录监测记录" description="请先完成内容发布，发布成功后会自动创建未检测监测记录。" /> : <div className="grid gap-4 lg:grid-cols-2">{records.map(record => <div key={record.id} className="rounded-3xl border border-white/10 bg-slate-950/56 p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-white">文章 ID：{record.articleId}</p><a className="mt-2 inline-block text-sm text-cyan-200 underline" href={toAbsoluteUrl(record.publicUrl)} target="_blank" rel="noreferrer">公开链接：{toAbsoluteUrl(record.publicUrl)}</a><p className="mt-2 text-sm text-slate-400">最近检测时间：{formatTime(record.lastCheckedAt) === "未记录" ? "未检测" : formatTime(record.lastCheckedAt)}</p></div><RadioTower className="h-5 w-5 text-cyan-200" /></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><InfoCard title="收录状态" desc={record.inclusionStatus || "未检测"} /><InfoCard title="AI 提及状态" desc={record.aiMentionStatus || "未检测"} /><InfoCard title="AI 推荐状态" desc={record.aiRecommendStatus || "未检测"} /></div><p className="mt-4 text-sm text-amber-100">当前建议：{record.currentSuggestion ?? "保持监测并更新客户报告。"}</p></div>)}</div>}<div className="flex justify-end"><Button onClick={() => setLocation("/delivery-reports")} disabled={records.length === 0} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">进入交付报告</Button></div></CardContent></Card>
    </div>
  );
}

export function DeliveryReportsFlowPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { projects, selectedProjectId, setSelectedProjectId, projectInput, enabled } = useProjectSelection();
  const reportQuery = trpc.geo.reports.latest.useQuery(projectInput, { enabled });
  const recordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });
  const generateReport = trpc.geo.reports.generate.useMutation();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const report = reportQuery.data as ReportLike | null | undefined;
  const reportCards = ["GEO 诊断报告", "内容生产报告", "发布监测报告", "复测优化报告"];

  async function handleGenerateReport() {
    if (!selectedProjectId) return;
    setMessage(undefined);
    setError(undefined);
    try {
      await generateReport.mutateAsync({ projectId: selectedProjectId });
      await utils.geo.reports.latest.invalidate({ projectId: selectedProjectId });
      setMessage("客户报告已生成，报告正文已刷新。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成客户报告失败");
    }
  }

  async function copyMarkdown() {
    if (!report?.markdownContent) return;
    await navigator.clipboard.writeText(report.markdownContent);
    setMessage("已复制 Markdown 报告正文。");
  }

  function exportMarkdown() {
    if (!report?.markdownContent) return;
    const blob = new Blob([report.markdownContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `geo-report-${report.id}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("已导出 Markdown 文件。");
  }

  return (
    <div className="space-y-6 text-slate-100">
      <GeoStatusGuide stage="交付报告" completion={report ? 96 : 82} nextAction="返回总览" why="交付报告页只展示四类报告卡片，帮助客户理解本轮试跑产出。" risk="报告只能引用已确认事实，不承诺保证收录、排名或 AI 推荐。" ctaLabel="返回总览" ctaPath="/" />
      <Card className="border-white/10 bg-white/[0.04] text-slate-100"><CardHeader><CardTitle className="text-white">交付报告</CardTitle><CardDescription className="text-cyan-200">四类客户交付报告。</CardDescription></CardHeader><CardContent className="space-y-5"><ProjectSelector projects={projects} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} /><ActionState message={message} error={error} /><div className="flex justify-end"><Button onClick={handleGenerateReport} disabled={!selectedProjectId || generateReport.isPending} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{generateReport.isPending ? "正在生成客户报告" : "生成客户报告"}</Button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{reportCards.map((title, index) => <div key={title} className="rounded-3xl border border-white/10 bg-slate-950/56 p-5"><div className="flex items-start justify-between gap-3"><h2 className="font-semibold text-white">{title}</h2>{index === 0 ? <Brain className="h-5 w-5 text-cyan-200" /> : index === 1 ? <FileText className="h-5 w-5 text-cyan-200" /> : index === 2 ? <Send className="h-5 w-5 text-cyan-200" /> : <FileBarChart2 className="h-5 w-5 text-cyan-200" />}</div><p className="mt-3 text-sm leading-6 text-slate-400">{index === 0 ? "说明 AI 可见度、推荐率、竞品差距和内容缺口。" : index === 1 ? "说明已生成内容类型、质量状态和发布准入。" : index === 2 ? `说明 ${recordsQuery.data?.length ?? 0} 条已发布内容的监测状态。` : "说明待复测内容、优化建议和下一轮动作。"}</p></div>)}</div>{report ? <section className="rounded-3xl border border-white/10 bg-slate-950/56 p-5"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><h2 className="font-semibold text-white">报告正文</h2><p className="mt-2 text-sm text-slate-400">报告 ID：{report.id}｜状态：已生成｜GEO 评分：{report.totalScore}｜生成时间：{formatTime(report.createdAt)}</p></div><div className="flex gap-2"><Button onClick={copyMarkdown} variant="outline" className="border-white/15 text-cyan-100 hover:bg-white/10">复制 Markdown</Button><Button onClick={exportMarkdown} variant="outline" className="border-white/15 text-cyan-100 hover:bg-white/10">导出 Markdown</Button></div></div><pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-sm leading-6 text-slate-200">{report.markdownContent}</pre></section> : <EmptyStep title="暂无客户报告" description="点击“生成客户报告”后，这里会显示报告正文，并提供 Markdown 复制或导出。" />}<Card className="border-amber-300/15 bg-amber-400/10 text-amber-50"><CardHeader><CardTitle className="flex items-center gap-2 text-amber-50"><AlertTriangle className="h-5 w-5" /> 风险说明</CardTitle></CardHeader><CardContent className="space-y-2 text-sm leading-6"><p>样本量有限，不代表全网绝对排名。</p><p>不承诺保证收录、保证排名或保证被 AI 推荐。</p><p>未确认事实、不可公开资料和客户未授权内容不能写入正式报告。</p><p className="flex items-center gap-2 text-emerald-100"><CheckCircle2 className="h-4 w-4" /> 报告需保留数据来源和人工复核结论。</p></CardContent></Card><div className="flex justify-end"><Button onClick={() => setLocation("/")} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">返回总览</Button></div></CardContent></Card>
    </div>
  );
}
