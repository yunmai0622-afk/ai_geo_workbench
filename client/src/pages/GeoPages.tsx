import { GeoStatusGuide } from "@/components/GeoStatusGuide";
import { BusinessPageProjectHeader } from "@/components/BusinessPageProjectHeader";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import { buildProjectUrl } from "@/lib/activeProject";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { trpc } from "@/lib/trpc";
import { GEO_ARTICLE_MIN_PASS_SCORE } from "@shared/const";
import { AlertTriangle, Brain, FileBarChart2, FileText, RadioTower, Send, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Row = Record<string, any>;
type PublishSummaryInput = { totalScore?: number | null; blocked?: boolean | number | null; blockReasons?: string[] | null } | null | undefined;
type ConsistencyInput = { score?: number | null; publishAllowed?: boolean | null; riskLevel?: string | null; blockReasons?: string[] | null } | null | undefined;
type BasisInput = Record<string, any> | null | undefined;
type TraceabilityInput = Array<{ sourceName?: string | null; isPublic?: boolean | number | null; manuallyConfirmed?: boolean | number | null }> | null | undefined;
type PlatformAuthorizationInput = Array<{ platformName?: string | null; accountAlias?: string | null; authorizationStatus?: string | null }> | null | undefined;

const projectInput = (projectId?: number) => ({ projectId });
const boolValue = (value: unknown) => value === true || value === 1;
const textValue = (value: unknown, fallback = "待补充") => typeof value === "string" && value.trim() ? value : fallback;
const uniqueTexts = (values: unknown[], limit = 6) => Array.from(new Set(values.map(value => textValue(value, "")).filter(Boolean))).slice(0, limit);
const diagnosisRaw = (item: Row) => (item.rawJson && typeof item.rawJson === "object" ? item.rawJson as Row : {});
const diagnosisDetail = (item: Row) => {
  const raw = diagnosisRaw(item);
  const nested = raw.questionDiagnosis && typeof raw.questionDiagnosis === "object" ? raw.questionDiagnosis as Row : {};
  return { ...raw, ...nested } as Row;
};

function useSelectedProject() {
  const selection = useActiveProjectSelection();
  const selectedProject = useMemo(
    () => selection.projects.find(project => project.id === selection.selectedProjectId),
    [selection.projects, selection.selectedProjectId],
  );
  return {
    selectedProject,
    selectedProjectId: selection.selectedProjectId,
    input: projectInput(selection.selectedProjectId),
    enabled: selection.enabled,
  };
}

function PageShell({
  title,
  desc,
  guide,
  enabled = true,
  projectName,
  children,
}: {
  title: string;
  desc: string;
  guide: React.ComponentProps<typeof GeoStatusGuide>;
  enabled?: boolean;
  projectName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 text-gray-900 shadow-[0_0_34px_rgba(56,189,248,0.10)] backdrop-blur">
        <p className="text-sm font-medium text-blue-600">内容增长系统</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">{desc}</p>
      </section>
      {enabled ? <BusinessPageProjectHeader projectName={projectName} testId="geo-legacy-project-header" /> : null}
      <GeoStatusGuide {...guide} />
      {!enabled ? <ProjectContextEmptyState /> : children}
    </div>
  );
}

function InfoCard({ title, desc, icon: Icon, children }: { title: string; desc?: string; icon: typeof Brain; children?: React.ReactNode }) {
  return (
    <Card className="border-gray-200 bg-white/[0.04] text-gray-900">
      <CardHeader>
        <CardDescription className="flex items-center gap-2 text-blue-600"><Icon className="h-4 w-4" /> {desc ?? "主流程信息"}</CardDescription>
        <CardTitle className="text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function projectPublishSummary(statuses: Array<{ status: string }>, publishedCount: number) {
  const readyCount = statuses.filter(item => item.status === "允许发布").length;
  const waitingCount = statuses.filter(item => ["未检查", "质量未通过", "待审核", "需人工审核"].includes(item.status)).length;
  if (publishedCount > 0) {
    return { stage: "内容发布", completion: 82, nextAction: "进入收录监测，检查是否被收录、被 AI 提及、被 AI 推荐", why: "发布完成后需要用监测结果决定复测和优化。", risk: `已发布 ${publishedCount} 篇，另有 ${waitingCount} 篇待检查或待审核；不承诺保证收录、保证排名或保证被 AI 推荐。`, ctaLabel: "进入收录监测", ctaPath: "/inclusion-monitoring" };
  }
  if (readyCount > 0) {
    return { stage: "内容发布", completion: 76, nextAction: "选择通过检查的文章发布到 公开内容页", why: "只有通过质量、事实和一致性检查的内容才能进入发布链路。", risk: "第三方平台素材仅作为辅助材料，当前只生成素材不自动登录发布。", ctaLabel: "发布到 公开内容页", ctaPath: "/content-publishing" };
  }
  return { stage: "内容发布", completion: 68, nextAction: "先生成高质量文章", why: "没有可发布内容时应回到本周内容，补齐文章和质量检查。", risk: "低于发布标准或事实未确认的文章不能发布。", ctaLabel: "去本周内容", ctaPath: "/weekly" };
}

export function buildPublishCheckSummary(score: PublishSummaryInput, consistency: ConsistencyInput, basis: BasisInput, traceability: TraceabilityInput, content = "") {
  const blockReasons: string[] = [];
  const sourceBasisKeys = ["customerQuestion", "contentGap", "optimizationTaskName", "notRecommendedReason", "competitorGap", "humanRevisionConclusion"];
  if (!score || (score.totalScore ?? 0) < GEO_ARTICLE_MIN_PASS_SCORE || boolValue(score.blocked)) blockReasons.push(`内容质量分低于 ${GEO_ARTICLE_MIN_PASS_SCORE} 分。`);
  if (Array.isArray(score?.blockReasons)) blockReasons.push(...score.blockReasons.filter(Boolean));
  if (!consistency || (consistency.score ?? 0) < GEO_ARTICLE_MIN_PASS_SCORE || consistency.publishAllowed === false || consistency.riskLevel === "高") blockReasons.push(`一致性评分低于 ${GEO_ARTICLE_MIN_PASS_SCORE} 分或未通过检查。`);
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
  if (check && !check.allowPublish) return "质量未通过";
  if (!score || (score.totalScore ?? 0) < GEO_ARTICLE_MIN_PASS_SCORE || boolValue(score.blocked)) return "质量未通过";
  if (["审核通过", "待发布", "ready"].includes(rawStatus)) return "允许发布";
  if (["已生成", "待质检", "draft"].includes(rawStatus)) return "未检查";
  if (rawStatus === "需人工审核") return "需人工审核";
  if (rawStatus === "质检通过") return "待审核";
  if (rawStatus === "待审核") return "待审核";
  return rawStatus || "未检查";
}

export function buildThirdPartyPublishGate(platformName: string, authorizations: PlatformAuthorizationInput) {
  const normalized = platformName.trim().toLowerCase();
  const matched = (authorizations ?? []).find(item => {
    const name = String(item.platformName ?? "").trim().toLowerCase();
    return Boolean(name && (normalized.includes(name) || name.includes(normalized)));
  });
  const status = matched?.authorizationStatus || "未在系统登记";
  return {
    allowManualPublish: true,
    status,
    accountAlias: matched?.accountAlias || "",
    blockReason: matched ? "" : `系统内未匹配到「${platformName}」的历史登记记录；仍可复制素材到第三方后台人工发布，发布与账号合规由业务侧自行把控。`,
  };
}

export function ProjectsPage() {
  const [, setLocation] = useLocation();
  const { selectedProject, selectedProjectId, enabled } = useSelectedProject();
  return (
    <PageShell title="企业档案" desc="企业档案已升级为「基本身份 / 你的客户 / 案例证明」结构。请从企业档案页补齐必填项后进入主流程。" enabled={enabled} projectName={selectedProject?.enterpriseName} guide={{ stage: "企业档案", completion: 20, nextAction: "打开企业档案完成 Section 1～3", why: "企业档案是后续诊断和内容生成的事实来源。", risk: "资料不足时不得编造效果承诺。", ctaLabel: "进入企业档案", ctaPath: "/enterprise-profile" }}>
      <InfoCard title="进入企业档案" icon={Target}>
        <Button onClick={() => selectedProjectId && setLocation(buildProjectUrl("/enterprise-profile", selectedProjectId))} className="bg-blue-600 text-white hover:bg-blue-700">进入企业档案</Button>
      </InfoCard>
    </PageShell>
  );
}

export function QuestionsPage() {
  const utils = trpc.useUtils();
  const { selectedProject, selectedProjectId, input, enabled } = useSelectedProject();
  const questions = trpc.geo.questions.list.useQuery(input, { enabled });
  const responses = trpc.geo.aiResponses.list.useQuery(input, { enabled });
  const analyses = trpc.geo.analysis.list.useQuery(input, { enabled });
  const score = trpc.geo.scores.latest.useQuery(input, { enabled });
  const tasks = trpc.geo.tasks.list.useQuery(input, { enabled });
  const generateQuestions = trpc.geo.questions.generate.useMutation({ onSuccess: async () => { toast.success("客户问题已生成"); await utils.geo.questions.list.invalidate(); }, onError: error => toast.error(error.message) });
  const runAnalysis = trpc.geo.analysis.run.useMutation({ onSuccess: async () => { toast.success("诊断结果已生成"); await utils.geo.analysis.list.invalidate(); }, onError: error => toast.error(error.message) });
  const calculateScore = trpc.geo.scores.calculate.useMutation({ onSuccess: async () => { toast.success("内容评分已生成"); await utils.geo.scores.latest.invalidate(); }, onError: error => toast.error(error.message) });
  const generateTasks = trpc.geo.tasks.generate.useMutation({ onSuccess: async () => { toast.success("下一步建议已生成"); await utils.geo.tasks.list.invalidate(); }, onError: error => toast.error(error.message) });
  const q = questions.data ?? [];
  const r = responses.data ?? [];
  const a = analyses.data ?? [];
  const t = tasks.data ?? [];
  const gapSummary = uniqueTexts(a.map(item => item.contentGap), 5);
  const suggestionSummary = uniqueTexts(a.map(item => item.optimizationSuggestion), 5);
  const questionAnalyses = a.slice(0, 8).map(item => ({ item, detail: diagnosisDetail(item as Row) }));
  const next = q.length === 0 ? { label: "生成客户问题", action: () => selectedProjectId && generateQuestions.mutate({ projectId: selectedProjectId }) } : r.length === 0 ? { label: "导入 AI 回答", action: () => toast.info("请补充真实 AI 回答后再运行诊断") } : a.length === 0 ? { label: "生成诊断结果", action: () => selectedProjectId && runAnalysis.mutate({ projectId: selectedProjectId }) } : !score.data ? { label: "生成诊断评分", action: () => selectedProjectId && calculateScore.mutate({ projectId: selectedProjectId }) } : t.length === 0 ? { label: "生成下一步建议", action: () => selectedProjectId && generateTasks.mutate({ projectId: selectedProjectId }) } : { label: "进入内容生成", action: () => { window.location.href = "/content-generation"; } };
  return (
    <PageShell title="内容诊断" desc="内容诊断页只展示客户问题、AI 回答、诊断结果、内容缺口、下一步建议五个区域，并保留一个主动作按钮。" enabled={enabled} projectName={selectedProject?.enterpriseName} guide={{ stage: "内容诊断", completion: a.length ? 58 : q.length ? 35 : 20, nextAction: next.label, why: "诊断结果决定内容写什么、补什么证据以及如何解释竞品差距。", risk: "样本量有限时不代表全网绝对排名。", ctaLabel: next.label, ctaPath: "/ai-diagnosis" }}>
      <div className="grid gap-4 lg:grid-cols-5">
        {[{ title: "客户问题", value: q.length, desc: q[0]?.questionText }, { title: "AI 回答", value: r.length, desc: r[0]?.aiPlatform }, { title: "诊断结果", value: a.length, desc: a[0]?.contentGap }, { title: "内容缺口", value: a.filter(item => item.contentGap).length, desc: a[0]?.optimizationSuggestion }, { title: "下一步建议", value: t.length, desc: t[0]?.taskName }].map(item => <div key={item.title} className="rounded-3xl border border-gray-200 bg-white/[0.04] p-5 text-gray-900"><p className="text-sm text-blue-600">{item.title}</p><p className="mt-2 text-3xl font-semibold text-white">{item.value}</p><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">{textValue(item.desc, "暂无数据")}</p></div>)}
      </div>
      <Button onClick={next.action} disabled={!selectedProjectId} className="bg-blue-600 text-white hover:bg-blue-700">{next.label}</Button>
      {a.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <InfoCard title="去重后的内容缺口" desc="按问题语境合并展示" icon={AlertTriangle}>
            <div className="space-y-4 text-sm leading-6 text-gray-600">
              <div><p className="mb-2 font-medium text-white">内容缺口</p>{gapSummary.length ? <ul className="list-disc space-y-2 pl-5">{gapSummary.map(gap => <li key={gap}>{gap}</li>)}</ul> : <p className="text-slate-400">暂无明确缺口。</p>}</div>
              <div><p className="mb-2 font-medium text-white">优化建议</p>{suggestionSummary.length ? <ul className="list-disc space-y-2 pl-5">{suggestionSummary.map(item => <li key={item}>{item}</li>)}</ul> : <p className="text-slate-400">暂无建议。</p>}</div>
            </div>
          </InfoCard>
          <InfoCard title="逐题 内容诊断" desc="展示证据、原因和下一步动作" icon={Brain}>
            <div className="space-y-3">
              {questionAnalyses.map(({ item, detail }, index) => (
                <div key={item.id ?? index} className="rounded-2xl border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-600">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-blue-600"><span>{textValue(detail.aiPlatform, "AI 平台")}</span><span>·</span><span>{item.recommendsEnterprise ? "已推荐本企业" : "未推荐本企业"}</span><span>·</span><span>{textValue(detail.recommendedActionType, "待判断动作")}</span></div>
                  <p className="mt-2 font-medium text-white">{textValue((item as Row).questionText ?? detail.questionText, "未关联问题文本")}</p>
                  <p className="mt-2 text-gray-600"><span className="text-gray-900">诊断：</span>{textValue(detail.semanticSummary ?? item.recommendationReason ?? item.notRecommendedReason)}</p>
                  <p className="mt-1 text-slate-400"><span className="text-gray-700">证据：</span>{textValue(detail.evidenceExcerpt, "原回答未提供足够可引用证据")}</p>
                  <p className="mt-1 text-slate-400"><span className="text-gray-700">竞品差距：</span>{textValue(detail.competitorGap, "未形成明确竞品差距")}</p>
                  <p className="mt-1 text-slate-400"><span className="text-gray-700">下一步：</span>{textValue(item.optimizationSuggestion)}</p>
                </div>
              ))}
            </div>
          </InfoCard>
        </div>
      )}
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
  const { selectedProject, selectedProjectId, input, enabled } = useSelectedProject();
  const [location] = useLocation();
  const [selectedArticleId, setSelectedArticleId] = useState<number | undefined>();
  const isPublishing = location === "/content-publishing" || location === "/publish";
  const topics = trpc.geo.articles.topics.list.useQuery(input, { enabled });
  const articles = trpc.geo.articles.list.useQuery(input, { enabled });
  const qualityScores = trpc.geo.articles.latestQualityScores.useQuery(input, { enabled });
  const records = trpc.geo.articles.publishRecords.useQuery(input, { enabled });
  const assetSummary = trpc.geo.assetLibrary.summary.useQuery(input, { enabled });
  const generateTopics = trpc.geo.articles.topics.generate.useMutation({ onSuccess: async () => { toast.success("推荐选题已生成"); await utils.geo.articles.topics.list.invalidate(); }, onError: error => toast.error(error.message) });
  const generateArticle = trpc.geo.articles.generate.useMutation({ onSuccess: async data => { toast.success("文章正文已生成"); setSelectedArticleId(data.articleId); await Promise.all([utils.geo.articles.list.invalidate(), utils.geo.articles.topics.list.invalidate()]); }, onError: error => toast.error(error.message) });
  const qualityCheck = trpc.geo.articles.qualityCheck.useMutation({
    onSuccess: async data => {
      const ext = data as { autoRewriteCount?: number; finalStatus?: string };
      const n = ext.autoRewriteCount ?? 0;
      const suffix = n > 0 ? `（已自动换角重写 ${n} 次）` : "";
      if (data.success) toast.success(`质量通过，可进入人工审核${suffix}`);
      else if (ext.finalStatus === "需人工审核") toast.warning(`仍未通过质量检查，已尝试自动重写；请人工修订后再次检查。${suffix}`);
      else toast.warning(`质量未通过，请查看阻断原因${suffix}`);
      await Promise.all([utils.geo.articles.list.invalidate(), utils.geo.articles.latestQualityScores.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const optimizeArticle = trpc.geo.articles.optimizeVersion.useMutation({ onSuccess: async () => { toast.success("已生成优化版本并保留旧版记录"); await Promise.all([utils.geo.articles.list.invalidate(), utils.geo.articles.latestQualityScores.invalidate()]); }, onError: error => toast.error(error.message) });
  const publishArticle = trpc.geo.articles.publish.useMutation({ onSuccess: async data => { toast.success(`已发布：${data.publicPath}`); await Promise.all([utils.geo.articles.list.invalidate(), utils.geo.articles.publishRecords.invalidate()]); }, onError: error => toast.error(error.message) });
  const latestScoreByArticle = new Map<number, Row>();
  for (const item of qualityScores.data ?? []) {
    if (!latestScoreByArticle.has(item.articleId)) latestScoreByArticle.set(item.articleId, item as Row);
  }
  const articleStatuses = (articles.data ?? []).map(article => {
    const score = latestScoreByArticle.get(article.id);
    const check = buildPublishCheckSummary(score as any, article.consistencyCheck as any, article.generationBasis as any, article.factTraceability as any, `${article.title}\n${article.markdownContent ?? ""}`);
    return { article, score, check, status: publishStatusForArticle(article.status, score as any, check, records.data?.find(record => record.articleId === article.id)) };
  });
  const selectedArticle = (articles.data ?? []).find(article => article.id === selectedArticleId) ?? articles.data?.[0];
  const selectedScore = selectedArticle ? latestScoreByArticle.get(selectedArticle.id) : undefined;
  const selectedBasis = (selectedArticle?.generationBasis && typeof selectedArticle.generationBasis === "object" ? selectedArticle.generationBasis : {}) as Row;
  const selectedSnippets = Array.isArray(selectedArticle?.citableSnippets) ? selectedArticle.citableSnippets as Row[] : [];
  const selectedMaterials = (selectedArticle?.thirdPartyMaterials && typeof selectedArticle.thirdPartyMaterials === "object" ? selectedArticle.thirdPartyMaterials : {}) as Row;
  const materialKeys = Object.keys(selectedMaterials);
  const platformAuthorizations = (assetSummary.data?.platformAuthorizations ?? []) as Array<{ platformName?: string | null; accountAlias?: string | null; authorizationStatus?: string | null }>;
  const selectedCheck = selectedArticle ? buildPublishCheckSummary(selectedScore as any, selectedArticle.consistencyCheck as any, selectedArticle.generationBasis as any, selectedArticle.factTraceability as any, `${selectedArticle.title}\n${selectedArticle.markdownContent ?? ""}`) : null;

  if (isPublishing) {
    const guide = projectPublishSummary(articleStatuses.map(item => ({ status: item.status })), records.data?.length ?? 0);
    return (
      <PageShell title="内容发布" desc="内容发布页只展示可发布内容和已发布内容；第三方平台素材放入折叠区，当前只生成素材不自动登录发布；未授权或授权失效的平台会被阻断到人工发布前一步。" enabled={enabled} projectName={selectedProject?.enterpriseName} guide={guide}>
        <InfoCard title="企业资料" icon={Target}>
          <Button onClick={() => selectedProjectId && setLocation(buildProjectUrl("/enterprise-profile", selectedProjectId))} variant="outline" className="border-gray-200 text-gray-900 hover:bg-gray-100">进入企业档案</Button>
        </InfoCard>
        <div className="grid gap-4 lg:grid-cols-2">
          <InfoCard title="可发布内容" desc="通过准入检查" icon={Send}>
            <div className="space-y-3">
              {articleStatuses.filter(item => item.status === "允许发布").map(item => (
                <div key={item.article.id} className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
                  <p className="font-semibold text-white">{item.article.title}</p>
                  <p className="mt-1 text-sm text-emerald-700">质量评分：{item.score?.totalScore ?? "待评分"} · 发布准入状态：允许发布</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button onClick={() => publishArticle.mutate({ articleId: item.article.id })} className="bg-blue-600 text-white hover:bg-blue-700">发布到 公开内容页</Button>
                    <Button onClick={() => setSelectedArticleId(item.article.id)} variant="outline" className="border-gray-200 text-gray-900 hover:bg-gray-100">查看第三方素材</Button>
                  </div>
                </div>
              ))}
              {articleStatuses.filter(item => item.status === "允许发布").length === 0 ? <p className="text-sm text-slate-400">暂无可发布内容，请先在本周内容页完成文章、质量检查和人工审核。</p> : null}
            </div>
          </InfoCard>
          <InfoCard title="已发布内容" desc="进入监测链路" icon={RadioTower}>
            <div className="space-y-3">{(records.data ?? []).map(record => <div key={record.id} className="rounded-2xl border border-gray-200 bg-white/[0.04] p-4"><p className="font-semibold text-white">{record.publishChannel}</p><p className="mt-1 text-sm text-gray-600">{record.publishUrl} · {record.publishStatus}</p><p className="mt-1 text-xs text-slate-400">质量评分：{record.qualityScore ?? "未记录"}</p></div>)}{(records.data ?? []).length === 0 ? <p className="text-sm text-slate-400">暂无已发布内容。</p> : null}</div>
          </InfoCard>
        </div>
        <InfoCard title="第三方平台素材" desc="当前第三方平台暂不支持自动登录发布，只支持生成素材、复制发布、人工回填链接" icon={FileText}>
          {selectedArticle ? <div className="space-y-4 text-sm leading-6 text-gray-600">
            <div className="rounded-2xl border border-gray-200 bg-white p-4"><p className="font-semibold text-white">{selectedArticle.title}</p><p className="mt-1 text-slate-400">当前第三方平台暂不支持自动登录发布，只支持生成素材、复制发布、人工回填链接。素材用于人工复制到官网、公众号、知乎、小红书、百家号/头条号等平台；系统不会保存第三方平台明文账号密码，也不会自动代表用户发布。平台授权不在企业档案维护；复制与发布合规请在业务侧自行确认。</p></div>
            <div className="rounded-2xl border border-gray-200 bg-white/[0.03] p-4 text-sm text-gray-600">
              <p className="font-medium text-white">发布前提示</p>
              <p className="mt-2 text-slate-400">若历史数据中仍有平台登记信息，仅供参考；不阻断复制素材与人工发布流程。</p>
            </div>
            {materialKeys.map(key => {
              const gate = buildThirdPartyPublishGate(key, platformAuthorizations);
              const materialText = String(selectedMaterials[key] ?? "");
              return <details key={key} className="rounded-2xl border border-gray-200 bg-white/[0.03] p-4"><summary className="cursor-pointer font-medium text-blue-700">{key}</summary><div className={`mt-3 rounded-xl border p-3 ${gate.allowManualPublish ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-700" : "border-amber-300/20 bg-amber-400/10 text-amber-50"}`}>{gate.allowManualPublish ? `可人工复制发布：${gate.status} · ${gate.accountAlias}` : gate.blockReason}</div><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs text-gray-600">{materialText}</pre><div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3"><label className="text-xs font-medium text-gray-700">回填发布链接</label><input disabled={!gate.allowManualPublish} placeholder="人工发布后粘贴第三方平台公开链接；系统不会自动登录发布" className="mt-2 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none disabled:cursor-not-allowed disabled:opacity-50" /><p className="mt-2 text-xs text-slate-400">标记已人工发布前，请确认素材已由人工复制到第三方平台并完成公开发布。</p></div><div className="mt-3 flex flex-wrap gap-2"><Button disabled={!gate.allowManualPublish} onClick={async () => { await navigator.clipboard?.writeText(materialText); toast.success("已复制素材，请到第三方平台后台人工粘贴发布。"); }} className="bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">复制素材</Button><Button disabled={!gate.allowManualPublish} onClick={() => toast.info("请在第三方平台后台人工粘贴素材并自行确认发布，系统不会代发。")} variant="outline" className="border-gray-200 text-gray-900 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50">进入人工发布提示</Button><Button disabled={!gate.allowManualPublish} onClick={() => toast.info("已进入人工发布记录流程：请先回填发布链接，再由人工确认标记；当前不会调用第三方自动发布 API。")} variant="outline" className="border-gray-200 text-gray-900 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50">标记已人工发布</Button><Button onClick={() => selectedProjectId && setLocation(buildProjectUrl("/enterprise-profile", selectedProjectId))} variant="outline" className="border-gray-200 text-gray-900 hover:bg-gray-100">配置授权</Button></div></details>;
            })}
          </div> : <p className="text-sm text-slate-400">请选择一篇文章查看第三方平台素材。</p>}
        </InfoCard>
      </PageShell>
    );
  }

  return (
    <PageShell title="内容生成" desc="内容生成页展示推荐选题、文章正文详情、质量准入和重新生成动作，确保文章有真实依据后再进入发布。" enabled={enabled} projectName={selectedProject?.enterpriseName} guide={{ stage: "内容生成", completion: (articles.data ?? []).length ? 70 : 55, nextAction: (topics.data ?? []).length ? "生成或检查推荐文章" : "生成三类推荐内容", why: "内容必须回应诊断缺口和客户高意向问题。", risk: "质量分、事实确认或合规检查未通过时禁止发布。", ctaLabel: (articles.data ?? []).length ? "进入内容发布" : "生成推荐内容", ctaPath: (articles.data ?? []).length ? "/content-publishing" : "/weekly" }}>
      <div className="grid gap-4 lg:grid-cols-3">{recommendedTypes.map(type => <div key={type} className="rounded-3xl border border-gray-200 bg-white/[0.04] p-5 text-gray-900"><FileText className="h-5 w-5 text-blue-600" /><h2 className="mt-3 text-lg font-semibold text-white">{type}</h2><p className="mt-2 text-sm leading-6 text-slate-400">围绕客户指定问题、诊断缺口和已确认企业资料生成，避免无来源内容。</p></div>)}</div>
      <InfoCard title="推荐选题" desc="先生成选题，再生成正文" icon={Brain}>
        <div className="space-y-3">
          {(topics.data ?? []).map(topic => <div key={topic.id} className="rounded-2xl border border-gray-200 bg-white p-4"><p className="text-xs text-blue-600">{topic.articleType} · {topic.status}</p><h3 className="mt-2 font-semibold text-white">{topic.title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{topic.businessReason}</p><Button onClick={() => generateArticle.mutate({ topicId: topic.id })} disabled={generateArticle.isPending} className="mt-3 bg-blue-600 text-white hover:bg-blue-700">生成文章正文</Button></div>)}
          {(topics.data ?? []).length === 0 ? <p className="text-sm text-slate-400">暂无推荐选题，请点击下方按钮生成。</p> : null}
        </div>
      </InfoCard>
      <div className="grid gap-4 lg:grid-cols-2">{(articles.data ?? []).map(article => { const score = latestScoreByArticle.get(article.id); const check = buildPublishCheckSummary(score as any, article.consistencyCheck as any, article.generationBasis as any, article.factTraceability as any, `${article.title}\n${article.markdownContent ?? ""}`); const status = publishStatusForArticle(article.status, score as any, check); return <div key={article.id} className="rounded-3xl border border-gray-200 bg-white/56 p-5"><p className="text-xs text-blue-600">{article.articleType}</p><h3 className="mt-2 font-semibold text-white">{article.title}</h3><p className="mt-2 text-sm text-gray-600">发布准入状态：{status} · 质量评分：{score?.totalScore ?? "待评分"}</p>{check.blockReasons.length ? <p className="mt-2 text-xs leading-5 text-amber-700">阻断原因：{check.blockReasons.join("；")}</p> : <p className="mt-2 text-xs text-emerald-700">当前未发现发布阻断项。</p>}<div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => setSelectedArticleId(article.id)} variant="outline" className="border-gray-200 text-gray-900 hover:bg-gray-100">查看正文详情</Button><Button onClick={() => qualityCheck.mutate({ articleId: article.id })} disabled={qualityCheck.isPending || !(article.status === "已生成" || article.status === "待质检")} className="bg-blue-600 text-white hover:bg-blue-700">运行质检</Button><Button onClick={() => optimizeArticle.mutate({ articleId: article.id, mode: "增强版", reason: "用户在内容生成页手动重新生成增强版" })} disabled={optimizeArticle.isPending} variant="outline" className="border-gray-200 text-gray-900 hover:bg-gray-100">重新生成增强版</Button></div></div>; })}</div>
      {selectedArticle ? <InfoCard title="文章正文详情" desc="正文、生成依据和素材可审阅" icon={FileText}>
        <div className="space-y-4 text-sm leading-6 text-gray-600">
          <div className="rounded-2xl border border-gray-200 bg-white p-4"><p className="text-xs text-blue-600">{selectedArticle.articleType} · {selectedArticle.status}</p><h3 className="mt-2 text-lg font-semibold text-white">{selectedArticle.title}</h3><p className="mt-2 text-slate-400">客户指定问题：{textValue(selectedBasis.customerQuestion, "未记录")}</p><p className="mt-1 text-slate-400">内容缺口：{textValue(selectedBasis.contentGap, "未记录")}</p><p className="mt-1 text-slate-400">未推荐原因：{textValue(selectedBasis.notRecommendedReason, "未记录")}</p></div>
          <details open className="rounded-2xl border border-gray-200 bg-white/[0.03] p-4"><summary className="cursor-pointer font-medium text-blue-700">正文预览</summary><pre className="mt-3 max-h-[34rem] overflow-auto whitespace-pre-wrap rounded-xl bg-white p-4 text-xs text-gray-600">{selectedArticle.markdownContent}</pre></details>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white/[0.03] p-4"><p className="font-medium text-white">引用友好片段</p><div className="mt-2 space-y-2">{selectedSnippets.map((snippet, index) => <div key={index} className="rounded-xl bg-white p-3"><p className="text-blue-700">{textValue(snippet.question, `片段 ${index + 1}`)}</p><p className="mt-1 text-slate-400">{textValue(snippet.answer)}</p></div>)}{selectedSnippets.length === 0 ? <p className="text-slate-400">暂无引用片段。</p> : null}</div></div>
            <div className="rounded-2xl border border-gray-200 bg-white/[0.03] p-4"><p className="font-medium text-white">质量与一致性</p><p className="mt-2">质量评分：{selectedScore?.totalScore ?? "待评分"}</p><p className="mt-1">一致性评分：{(selectedArticle.consistencyCheck as Row | null)?.score ?? "待检查"}</p><p className="mt-1">发布阻断：{selectedCheck?.blockReasons.length ? selectedCheck.blockReasons.join("；") : "暂无"}</p></div>
          </div>
          <div className="flex flex-wrap gap-2"><Button onClick={() => qualityCheck.mutate({ articleId: selectedArticle.id })} disabled={qualityCheck.isPending || !(selectedArticle.status === "已生成" || selectedArticle.status === "待质检" || selectedArticle.status === "需人工审核")} className="bg-blue-600 text-white hover:bg-blue-700">重新检查</Button><Button onClick={() => optimizeArticle.mutate({ articleId: selectedArticle.id, mode: "FAQ", reason: "用户在详情页要求补齐 FAQ 版本" })} disabled={optimizeArticle.isPending} variant="outline" className="border-gray-200 text-gray-900 hover:bg-gray-100">生成 FAQ 优化版</Button><Button onClick={() => selectedProjectId && setLocation(buildProjectUrl("/content-publishing", selectedProjectId))} variant="outline" className="border-gray-200 text-gray-900 hover:bg-gray-100">进入发布页</Button></div>
        </div>
      </InfoCard> : null}
      <div className="flex gap-3"><Button onClick={() => selectedProjectId && generateTopics.mutate({ projectId: selectedProjectId })} disabled={!selectedProjectId || generateTopics.isPending} className="bg-blue-600 text-white hover:bg-blue-700">生成推荐选题</Button><Button onClick={() => selectedProjectId && setLocation(buildProjectUrl("/content-publishing", selectedProjectId))} variant="outline" className="border-gray-200 text-gray-900 hover:bg-gray-100">进入内容发布</Button></div>
    </PageShell>
  );
}

export function MonitoringPage() {
  const { selectedProject, input, enabled } = useSelectedProject();
  const records = trpc.geo.articles.publishRecords.useQuery(input, { enabled });
  const rows = records.data ?? [];
  return (
    <PageShell title="收录监测" desc="收录监测页只展示已发布内容监测卡片，显示收录、AI 提及、AI 推荐、最近检测时间和当前建议。" enabled={enabled} projectName={selectedProject?.enterpriseName} guide={{ stage: "收录监测", completion: rows.length ? 88 : 74, nextAction: rows.length ? "查看监测结果并准备报告" : "先发布内容后再监测", why: "发布后的监测结果决定是否复测和优化。", risk: "不承诺保证收录、保证排名或保证被 AI 推荐。", ctaLabel: rows.length ? "进入交付报告" : "进入内容发布", ctaPath: rows.length ? "/delivery-reports" : "/content-publishing" }}>
      <div className="grid gap-4 lg:grid-cols-2">{rows.map(record => <div key={record.id} className="rounded-3xl border border-gray-200 bg-white/[0.04] p-5 text-gray-900"><RadioTower className="h-5 w-5 text-blue-600" /><h2 className="mt-3 font-semibold text-white">{record.publishUrl}</h2><div className="mt-3 grid gap-2 text-sm text-gray-600 sm:grid-cols-2"><span>收录：待检测</span><span>AI 提及：待检测</span><span>AI 推荐：待检测</span><span>最近检测时间：{record.publishedAt ? new Date(record.publishedAt).toLocaleString() : "待检测"}</span></div><p className="mt-3 text-sm leading-6 text-slate-400">当前建议：{record.needRetest ? "进入复测，观察是否被收录、被 AI 提及、被 AI 推荐。" : "保持监测，等待更多样本。"}</p></div>)}{rows.length === 0 ? <p className="text-sm text-slate-400">暂无已发布内容监测卡片。</p> : null}</div>
    </PageShell>
  );
}

export function ReportsPage() {
  const utils = trpc.useUtils();
  const { selectedProject, selectedProjectId, input, enabled } = useSelectedProject();
  const report = trpc.geo.reports.latest.useQuery(input, { enabled });
  const generateReport = trpc.geo.reports.generate.useMutation({ onSuccess: async () => { toast.success("交付报告已生成"); await utils.geo.reports.latest.invalidate(); }, onError: error => toast.error(error.message) });
  const reportTypes = ["内容诊断报告", "内容生产报告", "发布监测报告", "复测优化报告"];
  return (
    <PageShell title="交付报告" desc="交付报告页只展示 内容诊断报告、内容生产报告、发布监测报告、复测优化报告四类报告卡片，并保留风险说明。" enabled={enabled} projectName={selectedProject?.enterpriseName} guide={{ stage: "交付报告", completion: report.data ? 96 : 86, nextAction: report.data ? "查看并交付报告" : "生成交付报告", why: "报告把建档、诊断、内容、发布和监测串成客户可解释结果。", risk: "报告只能引用已确认事实，不承诺保证收录、排名或 AI 推荐。", ctaLabel: report.data ? "返回总览" : "生成交付报告", ctaPath: report.data ? "/" : "/delivery-reports" }}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{reportTypes.map(type => <div key={type} className="rounded-3xl border border-gray-200 bg-white/[0.04] p-5 text-gray-900"><FileBarChart2 className="h-5 w-5 text-blue-600" /><h2 className="mt-3 font-semibold text-white">{type}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{report.data ? "已有最新报告数据，可用于客户交付。" : "等待生成最新报告。"}</p></div>)}</div>
      <Card className="border-amber-300/15 bg-amber-400/10 text-amber-50"><CardHeader><CardTitle className="flex items-center gap-2 text-amber-50"><AlertTriangle className="h-5 w-5" /> 风险说明</CardTitle></CardHeader><CardContent className="space-y-2 text-sm leading-6"><p>不承诺保证收录、保证排名或保证被 AI 推荐。</p><p>样本量有限，不代表全网绝对排名；报告只引用已确认事实和系统内记录。</p></CardContent></Card>
      <Button onClick={() => selectedProjectId && generateReport.mutate({ projectId: selectedProjectId })} disabled={!selectedProjectId} className="bg-blue-600 text-white hover:bg-blue-700">生成交付报告</Button>
    </PageShell>
  );
}
