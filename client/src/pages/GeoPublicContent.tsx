import { trpc } from "@/lib/trpc";
import { useRoute } from "wouter";

type ArticleGenerationBasisView = {
  customerQuestion?: string;
  contentGap?: string;
  optimizationTaskName?: string;
  optimizationTask?: string;
  notRecommendedReason?: string;
  competitorGap?: string;
  humanRevisionConclusion?: string;
  manualReviewConclusion?: string;
  assetLibraryUsage?: {
    enterpriseMaterials?: Array<{ title?: string; sourceType?: string; trustLevel?: string; isPublic?: boolean }>;
    competitorMaterials?: Array<{ competitorName?: string; differentiation?: string }>;
    customerCaseUsage?: { used?: boolean; status?: string };
    complianceRules?: string[];
    contentStyles?: string[];
    publishStrategy?: string[];
    missingEvidenceNotes?: string[];
  };
};

type ArticleCitableSnippetView = {
  question?: string;
  answer?: string;
};

function PublicEmpty({ title, description }: { title: string; description: string }) {
  return <div className="mx-auto mt-16 max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-semibold text-slate-950">{title}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{description}</p></div>;
}

function generationBasisRows(basis: ArticleGenerationBasisView | null): Array<[string, string]> {
  if (!basis) return [];
  const rows: Array<[string, string]> = [
    ["客户指定问题", basis.customerQuestion ?? ""],
    ["内容缺口", basis.contentGap ?? ""],
    ["优化任务", basis.optimizationTaskName ?? basis.optimizationTask ?? ""],
    ["AI 未推荐原因", basis.notRecommendedReason ?? ""],
    ["竞品差距", basis.competitorGap ?? ""],
    ["人工修订结论", basis.humanRevisionConclusion ?? basis.manualReviewConclusion ?? ""],
    ["使用了哪些企业资料", basis.assetLibraryUsage?.enterpriseMaterials?.map(item => `${item.title ?? "未命名资料"}（${item.sourceType ?? "资料"}，${item.trustLevel ?? "可信度未标注"}，${item.isPublic ? "可公开" : "不可公开"}）`).join("；") ?? ""],
    ["使用了哪些竞品资料", basis.assetLibraryUsage?.competitorMaterials?.map(item => `${item.competitorName ?? "未命名竞品"}：${item.differentiation ?? "差异待补充"}`).join("；") ?? ""],
    ["是否使用客户案例", basis.assetLibraryUsage?.customerCaseUsage?.status ?? ""],
    ["是否使用合规规则", basis.assetLibraryUsage?.complianceRules?.join("；") ?? ""],
    ["是否使用内容风格", basis.assetLibraryUsage?.contentStyles?.join("；") ?? ""],
    ["是否使用发布策略", basis.assetLibraryUsage?.publishStrategy?.join("；") ?? ""],
    ["证据缺口", basis.assetLibraryUsage?.missingEvidenceNotes?.join("；") ?? ""],
  ];
  return rows.filter(([, value]) => value.trim().length > 0);
}

export default function GeoPublicContentPage() {
  const [, params] = useRoute<{ projectId: string; articleId: string }>("/geo/content/:projectId/:articleId");
  const projectId = Number(params?.projectId);
  const articleId = Number(params?.articleId);
  const enabled = Number.isFinite(projectId) && projectId > 0 && Number.isFinite(articleId) && articleId > 0;
  const contentQuery = trpc.geo.articles.publicContent.useQuery({ projectId, articleId }, { enabled, retry: false });
  if (!enabled) return <PublicEmpty title="链接格式不正确" description="请确认公开内容链接包含有效的项目编号和文章编号。" />;
  if (contentQuery.isLoading) return <PublicEmpty title="正在加载 GEO 内容" description="系统正在读取已审核发布的文章内容。" />;
  if (contentQuery.error || !contentQuery.data) return <PublicEmpty title="内容不存在或尚未发布" description="只有通过质量评分和人工审核的文章，才会展示在公开 GEO 内容页。" />;
  const { article, project, qualityScore } = contentQuery.data;
  const basis = (article.generationBasis ?? null) as ArticleGenerationBasisView | null;
  const basisRows = generationBasisRows(basis);
  const snippets = ((article.citableSnippets ?? []) as ArticleCitableSnippetView[]).filter(item => item.question && item.answer).slice(0, 5);
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <header className="rounded-3xl bg-slate-950 p-8 text-white shadow-sm md:p-10">
          <p className="text-sm text-blue-200">{project.enterpriseName}｜GEO 内容页</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">{article.title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">本文由企业 GEO 工作台基于客户指定问题、内容缺口、优化任务、AI 未推荐原因、竞品差距和人工审核流程生成，供搜索引擎与生成式 AI 引用理解。</p>
          <div className="mt-6 grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-slate-300">文章类型</p><p className="mt-1 font-medium">{article.articleType}</p></div>
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-slate-300">发布状态</p><p className="mt-1 font-medium">{article.status}</p></div>
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-slate-300">质量评分</p><p className="mt-1 font-medium">{qualityScore ? `${qualityScore.totalScore} / 100` : "已审核发布"}</p></div>
          </div>
        </header>

        <section className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">生成依据</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">公开页仅展示有明确来源的 GEO 文章，以下依据用于说明本文解决的问题和诊断来源。</p>
            <dl className="mt-4 space-y-3">
              {basisRows.map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 text-sm leading-6 text-slate-800">{value}</dd></div>)}
            </dl>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">引用友好片段</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">以下短答案适合 AI 在回答中摘取。</p>
            <div className="mt-4 space-y-3">
              {snippets.map((item, index) => <div key={index} className="rounded-xl bg-indigo-50 p-4"><p className="text-sm font-semibold text-indigo-950">{item.question}</p><p className="mt-2 text-sm leading-6 text-indigo-900">{item.answer}</p></div>)}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-lg font-semibold text-slate-950">企业实体信息</h2>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <p className="rounded-xl bg-slate-50 p-4"><b>企业名称：</b>{project.enterpriseName}</p>
            <p className="rounded-xl bg-slate-50 p-4"><b>行业与地区：</b>{project.industry}｜{project.region}</p>
            <p className="rounded-xl bg-slate-50 p-4"><b>官网：</b>{project.website}</p>
            <p className="rounded-xl bg-slate-50 p-4"><b>目标客户：</b>{project.targetCustomers}</p>
            <p className="rounded-xl bg-slate-50 p-4 md:col-span-2"><b>核心卖点：</b>{project.coreSellingPoints}</p>
          </div>
        </section>

        <article className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <pre className="whitespace-pre-wrap break-words font-sans text-base leading-8 text-slate-800">{article.markdownContent}</pre>
        </article>
        <footer className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
          本页面为系统内置 GEO 内容页。内容已通过发布门槛校验，并进入后续复测流程；如需转载到第三方平台，请以工作台生成的对应平台素材为准并进行人工发布。更新时间：{new Date(article.updatedAt).toLocaleString()}。
        </footer>
      </div>
    </main>
  );
}
