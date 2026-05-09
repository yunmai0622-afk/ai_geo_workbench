import React from "react";
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

type ArticleSection = {
  title: string;
  body: string[];
};

const ADMIN_SECTION_KEYWORDS = ["生成依据", "企业实体信息", "更新时间", "发布后复测建议", "引用友好片段"];
const FORMAL_SECTION_ORDER = ["摘要", "核心问题回答", "适合客户", "不适合客户", "竞品/方案对比", "选择建议", "FAQ", "结论", "行动引导"];
const RISK_NOTICE = "本文不承诺保证排名、保证收录或保证被 AI 推荐。";

function PublicEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1d2b6f_0,#08111f_42%,#020617_100%)] px-4 py-16 text-slate-100">
      <div className="mx-auto max-w-2xl rounded-3xl border border-cyan-300/20 bg-slate-950/80 p-8 text-center shadow-[0_0_40px_rgba(79,70,229,0.25)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">GEO Public Content</p>
        <h1 className="mt-4 text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
      </div>
    </div>
  );
}

function normalizeText(value: string) {
  return value
    .replace(/海豚知道补全\s*海豚知道\s*/g, "海豚知道补全")
    .replace(/暂无关键证据缺口。。/g, "暂无关键证据缺口。")
    .replace(/。。+/g, "。")
    .replace(/；缺少[」"]?的可引用说明。?/g, "，仍需补充更完整的可引用说明。")
    .replace(/example\.com/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripNumberPrefix(title: string) {
  return title.replace(/^[一二三四五六七八九十]+[、.．]\s*/, "").trim();
}

function cleanTitle(title: string) {
  const normalized = normalizeText(stripNumberPrefix(title).replace(/#+/g, ""));
  if (normalized === "建议发布的内容结构" || normalized === "发布前应补齐的证据清单") return "选择建议";
  if (normalized === "当前内容缺口" || normalized === "AI 未稳定推荐企业的关键原因" || normalized === "本篇文章对应的真实客户问题") return "核心问题回答";
  return normalized;
}

function parseMarkdownSections(markdown: string): { intro: string[]; sections: ArticleSection[]; faqItems: ArticleCitableSnippetView[] } {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const intro: string[] = [];
  const sections: ArticleSection[] = [];
  const faqItems: ArticleCitableSnippetView[] = [];
  let current: ArticleSection | null = null;
  let inFaq = false;
  let currentFaq: ArticleCitableSnippetView | null = null;

  const commitCurrent = () => {
    if (current && current.title && current.body.some(Boolean)) sections.push({ title: cleanTitle(current.title), body: current.body.map(normalizeText).filter(Boolean) });
    current = null;
  };
  const commitFaq = () => {
    if (currentFaq?.question && currentFaq.answer) faqItems.push({ question: normalizeText(currentFaq.question), answer: normalizeText(currentFaq.answer) });
    currentFaq = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    if (line.startsWith("# ")) {
      commitCurrent();
      continue;
    }
    if (h2) {
      commitFaq();
      commitCurrent();
      const title = cleanTitle(h2[1]);
      inFaq = title === "FAQ";
      current = ADMIN_SECTION_KEYWORDS.some(keyword => title.includes(keyword)) ? null : { title, body: [] };
      continue;
    }
    if (h3 && inFaq) {
      commitFaq();
      currentFaq = { question: h3[1], answer: "" };
      continue;
    }
    const cleaned = normalizeText(line.replace(/^[-*]\s*/, ""));
    if (!cleaned) continue;
    if (currentFaq && inFaq) {
      currentFaq.answer = currentFaq.answer ? `${currentFaq.answer} ${cleaned}` : cleaned;
      continue;
    }
    if (current) current.body.push(cleaned);
    else if (sections.length === 0 && !ADMIN_SECTION_KEYWORDS.some(keyword => cleaned.includes(keyword))) intro.push(cleaned);
  }
  commitFaq();
  commitCurrent();
  return { intro: intro.map(normalizeText).filter(Boolean), sections, faqItems };
}

function buildFormalArticle(markdown: string, snippets: ArticleCitableSnippetView[]) {
  const parsed = parseMarkdownSections(markdown);
  const grouped = new Map<string, string[]>();
  for (const section of parsed.sections) {
    if (section.title === "FAQ") continue;
    const existing = grouped.get(section.title) ?? [];
    grouped.set(section.title, [...existing, ...section.body]);
  }
  if (parsed.intro.length > 0) grouped.set("摘要", [...parsed.intro, ...(grouped.get("摘要") ?? [])]);
  const faqItems = dedupeSnippets(parsed.faqItems.length > 0 ? parsed.faqItems : snippets).slice(0, 4).map(item => ({
    question: item.question ?? "常见问题",
    answer: makeShortAnswer(item.answer ?? "", 220),
  }));
  const result: Array<{ title: string; paragraphs: string[]; faq?: ArticleCitableSnippetView[] }> = [];
  for (const title of FORMAL_SECTION_ORDER) {
    if (title === "FAQ") {
      if (faqItems.length > 0) result.push({ title, paragraphs: [], faq: faqItems });
      continue;
    }
    const paragraphs = (grouped.get(title) ?? []).filter(Boolean);
    if (paragraphs.length > 0) result.push({ title, paragraphs: paragraphs.slice(0, title === "核心问题回答" ? 5 : 3) });
  }
  return result;
}

function dedupeSnippets(snippets: ArticleCitableSnippetView[]) {
  const seen = new Set<string>();
  return snippets.filter(item => {
    const question = normalizeText(item.question ?? "");
    const answer = normalizeText(item.answer ?? "");
    if (!question || !answer || seen.has(question)) return false;
    seen.add(question);
    return true;
  });
}

function makeShortAnswer(value: string, maxLength = 180) {
  const cleaned = normalizeText(value);
  if (cleaned.length <= maxLength) return cleaned;
  const clipped = cleaned.slice(0, maxLength).replace(/[，；、：][^，；、：]*$/, "");
  return `${clipped}。`;
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
    ["使用了哪些企业资料", basis.assetLibraryUsage?.enterpriseMaterials?.map(item => `${item.title ?? "未命名资料"}（${item.sourceType ?? "资料"}，${item.trustLevel ?? "可信度未标注"}，${item.isPublic ? "可公开" : "已脱敏"}）`).join("；") ?? ""],
    ["使用了哪些竞品资料", basis.assetLibraryUsage?.competitorMaterials?.map(item => `${item.competitorName ?? "未命名竞品"}：${item.differentiation ?? "差异待补充"}`).join("；") ?? ""],
    ["是否使用客户案例", basis.assetLibraryUsage?.customerCaseUsage?.status ?? ""],
    ["是否使用合规规则", basis.assetLibraryUsage?.complianceRules?.join("；") ?? ""],
    ["是否使用内容风格", basis.assetLibraryUsage?.contentStyles?.join("；") ?? ""],
    ["是否使用发布策略", basis.assetLibraryUsage?.publishStrategy?.join("；") ?? ""],
    ["证据缺口", basis.assetLibraryUsage?.missingEvidenceNotes?.join("；") ?? ""],
  ];
  return rows.map(([label, value]) => [label, normalizeText(value)] as [string, string]).filter(([, value]) => value.trim().length > 0);
}

function safeJsonRows(value: unknown): Array<[string, string]> {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.slice(0, 8).map((item, index) => [`溯源 ${index + 1}`, normalizeText(typeof item === "string" ? item : JSON.stringify(item))]);
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).slice(0, 10).map(([key, val]) => [key, normalizeText(typeof val === "string" ? val : JSON.stringify(val))]);
  }
  return [["审计信息", normalizeText(String(value))]];
}

function renderParagraph(text: string, index: number) {
  const ordered = text.match(/^\d+[.、]\s*(.+)$/);
  if (ordered) {
    return <li key={index} className="ml-5 list-decimal text-slate-200/90">{ordered[1]}</li>;
  }
  return <p key={index} className="text-base leading-8 text-slate-200/90">{text}</p>;
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
  const snippets = dedupeSnippets(((article.citableSnippets ?? []) as ArticleCitableSnippetView[]).filter(item => item.question && item.answer)).slice(0, 5);
  const formalSections = buildFormalArticle(article.markdownContent, snippets);
  const traceRows = safeJsonRows(article.factTraceability);
  const consistencyRows = safeJsonRows(article.consistencyCheck);
  const updatedAt = new Date(article.updatedAt).toLocaleString();
  const createdAt = new Date(article.createdAt).toLocaleString();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_8%_0%,rgba(79,70,229,0.45),transparent_30%),radial-gradient(circle_at_92%_12%,rgba(6,182,212,0.24),transparent_28%),linear-gradient(180deg,#020617_0%,#08111f_48%,#020617_100%)] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <header className="relative overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-950/75 p-7 shadow-[0_0_60px_rgba(79,70,229,0.28)] backdrop-blur md:p-10">
          <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-[0.26em] text-cyan-200">
            <span>{project.enterpriseName}</span>
            <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[11px] tracking-normal text-cyan-100">公开 GEO 内容页</span>
          </div>
          <h1 className="mt-5 max-w-4xl text-3xl font-semibold tracking-tight text-white md:text-5xl">{normalizeText(article.title)}</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">这是一篇面向外部访客阅读的正式 GEO 文章。页面优先呈现正文、结论与可引用片段，生成依据、事实溯源和一致性检查保留在后方折叠区，便于需要时核验。</p>
          <div className="mt-7 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><p className="text-xs text-slate-400">文章类型</p><p className="mt-2 font-semibold text-white">{article.articleType}</p></div>
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4"><p className="text-xs text-emerald-100/80">发布状态</p><p className="mt-2 font-semibold text-emerald-100">{article.status}</p></div>
            <div className="rounded-2xl border border-violet-300/20 bg-violet-300/10 p-4"><p className="text-xs text-violet-100/80">质量评分</p><p className="mt-2 font-semibold text-violet-100">{qualityScore ? `${qualityScore.totalScore} / 100` : "已审核发布"}</p></div>
            <div className="rounded-2xl border border-sky-300/20 bg-sky-300/10 p-4"><p className="text-xs text-sky-100/80">发布时间 / 更新时间</p><p className="mt-2 text-sm font-semibold leading-6 text-sky-100">{createdAt}<br />{updatedAt}</p></div>
          </div>
          <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-100">风险提示：{RISK_NOTICE}</div>
        </header>

        <article className="mt-8 rounded-[2rem] border border-white/10 bg-slate-950/72 p-6 shadow-[0_0_45px_rgba(15,23,42,0.45)] backdrop-blur md:p-10">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Formal Article</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">正式文章正文</h2>
            </div>
            <span className="hidden rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs text-cyan-100 md:inline-flex">正文优先展示</span>
          </div>
          <div className="mt-8 space-y-9">
            {formalSections.map(section => (
              <section key={section.title} className="rounded-3xl border border-white/8 bg-white/[0.035] p-5 md:p-6">
                <h3 className="text-xl font-semibold text-white">{section.title}</h3>
                {section.faq ? (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {section.faq.map((item, index) => (
                      <div key={`${item.question}-${index}`} className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] p-4">
                        <p className="font-semibold leading-6 text-cyan-100">{item.question}</p>
                        <p className="mt-2 text-sm leading-7 text-slate-300">{item.answer}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">{section.paragraphs.map(renderParagraph)}</div>
                )}
              </section>
            ))}
          </div>
        </article>

        <section className="mt-8 rounded-[2rem] border border-cyan-300/15 bg-cyan-300/[0.055] p-6 shadow-[0_0_35px_rgba(6,182,212,0.12)] md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">AI Quotable Answers</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">AI 可引用片段</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-slate-300">短答案用于帮助搜索引擎与生成式 AI 理解文章结论，避免重复整段 FAQ。</p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {snippets.map((item, index) => (
              <div key={`${item.question}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
                <p className="text-sm font-semibold leading-6 text-cyan-100">{item.question}</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">{makeShortAnswer(item.answer ?? "")}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-violet-300/15 bg-slate-950/60 p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-white">企业实体信息</h2>
          <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><b className="text-slate-100">企业名称：</b><span className="text-slate-300">{project.enterpriseName}</span></p>
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><b className="text-slate-100">行业与地区：</b><span className="text-slate-300">{project.industry}｜{project.region}</span></p>
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><b className="text-slate-100">官网：</b><span className="text-slate-300">{project.website}</span></p>
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><b className="text-slate-100">目标客户：</b><span className="text-slate-300">{project.targetCustomers}</span></p>
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:col-span-2"><b className="text-slate-100">核心卖点：</b><span className="text-slate-300">{project.coreSellingPoints}</span></p>
          </div>
        </section>

        <section className="mt-8 space-y-4">
          <details className="group rounded-3xl border border-white/10 bg-white/[0.035] p-5 text-slate-300 open:bg-white/[0.055]">
            <summary className="cursor-pointer list-none text-lg font-semibold text-white marker:hidden">生成依据与 8 项审计信息 <span className="ml-2 text-sm font-normal text-slate-400">默认折叠，仅供核验</span></summary>
            <dl className="mt-5 space-y-3">
              {basisRows.map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <dt className="text-xs font-medium text-slate-400">{label}</dt>
                  <dd className="mt-2 text-sm leading-7 text-slate-300">{value}</dd>
                </div>
              ))}
            </dl>
          </details>
          <details className="group rounded-3xl border border-white/10 bg-white/[0.035] p-5 text-slate-300 open:bg-white/[0.055]">
            <summary className="cursor-pointer list-none text-lg font-semibold text-white marker:hidden">事实溯源与一致性检查 <span className="ml-2 text-sm font-normal text-slate-400">默认折叠，不前置打断阅读</span></summary>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <h3 className="font-semibold text-slate-100">事实溯源摘要</h3>
                <div className="mt-3 space-y-3">{traceRows.length ? traceRows.map(([label, value]) => <p key={label} className="text-sm leading-7 text-slate-300"><b>{label}：</b>{value}</p>) : <p className="text-sm text-slate-400">暂无额外事实溯源记录。</p>}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <h3 className="font-semibold text-slate-100">一致性检查摘要</h3>
                <div className="mt-3 space-y-3">{consistencyRows.length ? consistencyRows.map(([label, value]) => <p key={label} className="text-sm leading-7 text-slate-300"><b>{label}：</b>{value}</p>) : <p className="text-sm text-slate-400">暂无额外一致性检查记录。</p>}</div>
              </div>
            </div>
          </details>
        </section>

        <footer className="mt-8 rounded-3xl border border-amber-300/20 bg-amber-300/[0.07] p-5 text-sm leading-7 text-amber-50/90">
          风险说明：本页面为公开 GEO 内容页，样板内容用于展示文章阅读与引用结构。{RISK_NOTICE} 转载或对外发布前仍建议进行人工复核，避免把样板数据理解为全网绝对排名结果。
        </footer>
      </div>
    </main>
  );
}
