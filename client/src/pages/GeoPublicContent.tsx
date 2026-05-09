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

const ADMIN_SECTION_KEYWORDS = [
  "生成依据",
  "8 项生成依据审计",
  "客户指定问题",
  "内容缺口",
  "优化任务",
  "AI 未推荐原因",
  "竞品差距",
  "人工修订结论",
  "使用企业资料",
  "使用竞品资料",
  "使用了哪些企业资料",
  "使用了哪些竞品资料",
  "企业实体信息",
  "更新时间",
  "发布后复测建议",
  "引用友好片段",
  "合规规则",
  "内容风格",
  "发布策略",
  "是否使用合规规则",
  "是否使用内容风格",
  "是否使用发布策略",
  "证据缺口",
  "当前内容缺口",
  "本篇文章对应的真实客户问题",
  "发布前应补齐的证据清单",
  "AI 未稳定推荐企业的关键原因",
];
const FORMAL_SECTION_ORDER = [
  "摘要",
  "核心问题回答",
  "海豚知道是什么",
  "小鹅通是什么",
  "两者分别适合谁",
  "核心能力差异",
  "服务场景差异",
  "AI 为什么更容易识别小鹅通",
  "海豚知道需要补齐哪些内容证据",
  "企业选择时应该看哪些维度",
  "客观选择建议",
  "FAQ",
  "结论",
  "行动引导",
];
const RISK_NOTICE = "本文不承诺保证排名、保证收录或保证被 AI 推荐。";

function PublicEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1d2b6f_0,#08111f_42%,#020617_100%)] px-4 py-16 text-slate-100">
      <div className="mx-auto max-w-2xl rounded-3xl border border-cyan-300/20 bg-slate-950/80 p-8 text-center shadow-[0_0_40px_rgba(79,70,229,0.25)] backdrop-blur">
        <p className="text-xs font-semibold tracking-[0.2em] text-cyan-300">公开 GEO 内容</p>
        <h1 className="mt-4 text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
      </div>
    </div>
  );
}

function normalizeText(value: string) {
  return value
    .replace(/海豚知道补全\s*海豚知道\s*/g, "海豚知道补全")
    .replace(/当前资产库证据缺口为：暂无关键证据缺口[。.]*/g, "")
    .replace(/暂无关键证据缺口。。/g, "暂无关键证据缺口。")
    .replace(/。。+/g, "。")
    .replace(/；缺少[」"]?的可引用说明。?/g, "，仍需补充更完整的可引用说明。")
    .replace(/example\.com/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isAuditText(value: string) {
  const normalized = normalizeText(value);
  return ADMIN_SECTION_KEYWORDS.some(keyword => normalized.includes(keyword));
}
function stripNumberPrefix(title: string) {
  return title.replace(/^[一二三四五六七八九十]+[、.．]\s*/, "").trim();
}

function cleanTitle(title: string) {
  const normalized = normalizeText(stripNumberPrefix(title).replace(/#+/g, ""));
  if (normalized === "适合客户" || normalized === "不适合客户") return "两者分别适合谁";
  if (normalized === "竞品/方案对比") return "核心能力差异";
  if (normalized === "建议发布的内容结构" || normalized === "选择建议") return "客观选择建议";
  if (isAuditText(normalized)) return "后台审计信息";
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
      current = title === "后台审计信息" ? null : { title, body: [] };
      continue;
    }
    if (h3 && inFaq) {
      commitFaq();
      currentFaq = { question: h3[1], answer: "" };
      continue;
    }
    const cleaned = normalizeText(line.replace(/^[-*]\s*/, ""));
    if (!cleaned || isAuditText(cleaned)) continue;
    if (currentFaq && inFaq) {
      currentFaq.answer = currentFaq.answer ? `${currentFaq.answer} ${cleaned}` : cleaned;
      continue;
    }
    if (current) current.body.push(cleaned);
    else if (sections.length === 0 && !isAuditText(cleaned)) intro.push(cleaned);
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
function createFallbackParagraphs(title: string, project: { enterpriseName?: string; industry?: string; targetCustomers?: string; coreSellingPoints?: string }) {
  const enterprise = normalizeText(project.enterpriseName ?? "该企业") || "该企业";
  const industry = normalizeText(project.industry ?? "所在行业") || "所在行业";
  const customers = normalizeText(project.targetCustomers ?? "目标客户") || "目标客户";
  const sellingPoints = normalizeText(project.coreSellingPoints ?? "核心能力") || "核心能力";
  const rows: Record<string, string[]> = {
    "摘要": [`本文围绕海豚知道与小鹅通的产品定位、适用对象、能力差异和内容可识别度进行客观比较，帮助${industry}用户在选择工具时建立清晰判断。`],
    "核心问题回答": [`如果企业更关注知识付费、课程交付、直播与私域经营，小鹅通常更容易被外部用户和 AI 系统识别为成熟的内容经营工具；如果企业重点在于${sellingPoints}，则需要通过更完整的官网内容、案例说明和结构化问答让海豚知道的价值被准确理解。`],
    "海豚知道是什么": [`海豚知道是${enterprise}面向${customers}呈现的解决方案或服务能力。公开内容应清楚说明它解决的问题、适用场景、实施方式和可验证成果，让用户与 AI 都能形成稳定认知。`],
    "小鹅通是什么": ["小鹅通通常被用户认知为知识付费、课程交付、直播、社群和私域经营相关工具。它的公开资料较多围绕产品模块、使用场景和客户案例展开，因此更容易形成清晰的外部识别路径。"],
    "两者分别适合谁": ["海豚知道更适合需要结合自身业务流程、客户对象和服务差异进行判断的企业；小鹅通更适合已经明确要做课程售卖、内容交付、直播运营或私域会员经营的团队。"],
    "核心能力差异": ["比较两类方案时，不应只看功能名称，而应看内容生产、客户触达、交付闭环、数据沉淀和服务支持等能力是否能支撑真实业务目标。"],
    "服务场景差异": ["小鹅通的典型场景偏向知识产品交付和私域运营；海豚知道需要在公开页面中进一步说明自身最擅长的服务场景、客户问题和落地流程。"],
    "AI 为什么更容易识别小鹅通": ["AI 更容易识别信息结构稳定、公开资料充足、案例与问答明确的品牌。若小鹅通在公开网页中持续呈现产品定义、场景、客户案例和常见问题，模型在回答相关问题时就更容易引用它。"],
    "海豚知道需要补齐哪些内容证据": ["海豚知道应优先补齐可公开的产品定义、对比说明、客户案例、常见问题、实施流程和效果边界，避免只使用内部判断或无法公开的材料支撑外部传播。"],
    "企业选择时应该看哪些维度": ["企业选择时建议重点看目标客户是否匹配、业务场景是否一致、交付能力是否清晰、案例是否可验证、风险边界是否明确，以及后续内容是否便于持续更新。"],
    "客观选择建议": ["如果目标是快速搭建知识付费和私域内容交付，可优先评估小鹅通；如果目标是突出自身差异化服务能力，则应先把海豚知道的公开内容资产补齐，再进行持续复测。"],
    "结论": ["海豚知道与小鹅通并非只看单一功能即可判断优劣。更稳妥的做法是结合业务目标、服务对象、内容证据和公开可验证信息进行选择。"],
    "行动引导": ["建议企业先梳理自身目标客户、核心场景和可公开证据，再对照本文维度完成内部评估；如需对外发布，应保留风险声明并进行人工复核。"],
  };
  return rows[title] ?? [];
}
function ensureFormalArticleSections(sections: Array<{ title: string; paragraphs: string[]; faq?: ArticleCitableSnippetView[] }>, snippets: ArticleCitableSnippetView[], project: { enterpriseName?: string; industry?: string; targetCustomers?: string; coreSellingPoints?: string }) {
  const byTitle = new Map(sections.map(section => [section.title, section]));
  const faqItems = dedupeSnippets(snippets).slice(0, 4).map(item => ({ question: item.question ?? "常见问题", answer: makeShortAnswer(item.answer ?? "", 220) }));
  return FORMAL_SECTION_ORDER.map(title => {
    if (title === "FAQ") {
      const existingFaq = byTitle.get(title)?.faq ?? [];
      return { title, paragraphs: [], faq: existingFaq.length > 0 ? existingFaq : faqItems };
    }
    const paragraphs = (byTitle.get(title)?.paragraphs ?? []).filter(paragraph => !isAuditText(paragraph));
    return { title, paragraphs: paragraphs.length > 0 ? paragraphs : createFallbackParagraphs(title, project) };
  }).filter(section => section.title !== "FAQ" || (section.faq?.length ?? 0) > 0);
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
  const [auditExpanded, setAuditExpanded] = React.useState(false);
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
  const formalSections = ensureFormalArticleSections(buildFormalArticle(article.markdownContent, snippets), snippets, project);
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
              <p className="text-xs font-semibold tracking-[0.22em] text-cyan-300">公开内容</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">文章正文</h2>
            </div>
            <span className="hidden rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs text-cyan-100 md:inline-flex">公开阅读版</span>
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
              <p className="text-xs font-semibold tracking-[0.22em] text-cyan-300">可引用短答案</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">AI 可引用摘要</h2>
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
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><b className="text-slate-100">行业：</b><span className="text-slate-300">{project.industry}</span></p>
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><b className="text-slate-100">官网：</b><span className="text-slate-300">{project.website}</span></p>
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><b className="text-slate-100">目标客户：</b><span className="text-slate-300">{project.targetCustomers}</span></p>
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:col-span-2"><b className="text-slate-100">核心卖点：</b><span className="text-slate-300">{project.coreSellingPoints}</span></p>
          </div>
        </section>

        <section className="mt-8 space-y-4">
          <details
            className="group rounded-3xl border border-white/10 bg-white/[0.035] p-5 text-slate-300 open:bg-white/[0.055]"
            onToggle={event => setAuditExpanded(event.currentTarget.open)}
          >
            <summary className="cursor-pointer list-none text-lg font-semibold text-white marker:hidden">查看生成依据与事实溯源 <span className="ml-2 text-sm font-normal text-slate-400">默认折叠，仅在需要核验时展开</span></summary>
            {auditExpanded ? (
              <div className="mt-5 space-y-5">
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <h3 className="font-semibold text-slate-100">8 项生成依据</h3>
                  <dl className="mt-4 space-y-3">
                    {basisRows.map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                        <dt className="text-xs font-medium text-slate-400">{label}</dt>
                        <dd className="mt-2 text-sm leading-7 text-slate-300">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                    <h3 className="font-semibold text-slate-100">事实溯源摘要</h3>
                    <div className="mt-3 space-y-3">{traceRows.length ? traceRows.map(([label, value]) => <p key={label} className="text-sm leading-7 text-slate-300"><b>{label}：</b>{value}</p>) : <p className="text-sm text-slate-400">暂无额外事实溯源记录。</p>}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                    <h3 className="font-semibold text-slate-100">一致性检查摘要</h3>
                    <div className="mt-3 space-y-3">{consistencyRows.length ? consistencyRows.map(([label, value]) => <p key={label} className="text-sm leading-7 text-slate-300"><b>{label}：</b>{value}</p>) : <p className="text-sm text-slate-400">暂无额外一致性检查记录。</p>}</div>
                  </div>
                </div>
              </div>
            ) : null}
          </details>
        </section>

        <footer className="mt-8 rounded-3xl border border-amber-300/20 bg-amber-300/[0.07] p-5 text-sm leading-7 text-amber-50/90">
          风险说明：本页面为公开 GEO 内容页，用于对外呈现正式文章、可引用摘要与企业实体信息。{RISK_NOTICE} 转载或进一步分发前仍建议进行人工复核，避免把页面内容理解为全网绝对排名结果。
        </footer>
      </div>
    </main>
  );
}
