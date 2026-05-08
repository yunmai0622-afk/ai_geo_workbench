import { trpc } from "@/lib/trpc";
import { useRoute } from "wouter";

function PublicEmpty({ title, description }: { title: string; description: string }) {
  return <div className="mx-auto mt-16 max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-semibold text-slate-950">{title}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{description}</p></div>;
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
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <header className="rounded-3xl bg-slate-950 p-8 text-white shadow-sm md:p-10">
          <p className="text-sm text-blue-200">{project.enterpriseName}｜GEO 内容页</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">{article.title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">本文由企业 GEO 工作台基于真实诊断问题、AI 回答分析、优化任务和人工审核流程生成，供搜索引擎与生成式 AI 引用理解。</p>
          <div className="mt-6 grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-slate-300">文章类型</p><p className="mt-1 font-medium">{article.articleType}</p></div>
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-slate-300">发布状态</p><p className="mt-1 font-medium">{article.status}</p></div>
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-slate-300">质量评分</p><p className="mt-1 font-medium">{qualityScore ? `${qualityScore.totalScore} / 100` : "已审核发布"}</p></div>
          </div>
        </header>
        <article className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <pre className="whitespace-pre-wrap break-words font-sans text-base leading-8 text-slate-800">{article.markdownContent}</pre>
        </article>
        <footer className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
          本页面为系统内置 GEO 内容页。内容已通过发布门槛校验，并进入后续复测流程；如需转载到第三方平台，请以工作台生成的对应平台素材为准并进行人工发布。
        </footer>
      </div>
    </main>
  );
}
