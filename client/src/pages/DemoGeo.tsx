import React, { type ReactNode } from "react";

import {
  assetSections,
  demoArticles,
  demoMetrics,
  demoProject,
  diagnosisQuestions,
  disabledOperations,
  growthPath,
  monitoringRecords,
  publishRecords,
  reportSummary,
} from "@/lib/demoGeoData";

type SectionProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

const toneClasses = {
  cyan: "border-cyan-300/20 bg-cyan-400/10 text-cyan-100 shadow-cyan-500/10",
  violet: "border-violet-300/20 bg-violet-400/10 text-violet-100 shadow-violet-500/10",
  emerald: "border-emerald-300/20 bg-emerald-400/10 text-emerald-100 shadow-emerald-500/10",
  amber: "border-amber-300/20 bg-amber-400/10 text-amber-100 shadow-amber-500/10",
  blue: "border-blue-300/20 bg-blue-400/10 text-blue-100 shadow-blue-500/10",
} as const;

function Section({ eyebrow, title, description, children }: SectionProps) {
  return (
    <section className="scroll-mt-28 rounded-[2rem] border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-blue-950/20 backdrop-blur md:p-7">
      <div className="mb-6 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">{eyebrow}</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
      </div>
      {children}
    </section>
  );
}

function StatusBadge({ children, tone = "cyan" }: { children: React.ReactNode; tone?: keyof typeof toneClasses }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium shadow-lg ${toneClasses[tone]}`}>{children}</span>;
}

function ReadOnlyNotice() {
  return (
    <div className="rounded-3xl border border-amber-300/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-50 shadow-xl shadow-amber-950/10">
      <p className="font-semibold">Demo 演示模式仅支持查看，不支持修改。</p>
      <p className="mt-2 text-amber-100/80">本页面不提供登录、编辑、生成、发布、删除、保存或更新状态能力；展示内容均为“海豚知道”样板项目脱敏数据。</p>
    </div>
  );
}

export default function DemoGeoPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#040816] text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-12%] top-[-18%] h-[32rem] w-[32rem] rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-[-10%] top-[12%] h-[36rem] w-[36rem] rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute bottom-[-18%] left-[24%] h-[34rem] w-[34rem] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(80,120,255,0.16),transparent_35%),linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:auto,48px_48px,48px_48px]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#040816]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <a href="#overview" className="group inline-flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-sm font-bold text-cyan-100 shadow-lg shadow-cyan-500/20">GEO</span>
            <span>
              <span className="block text-sm font-semibold text-white">V1.2 外部只读 Demo</span>
              <span className="block text-xs text-slate-400">{demoProject.shortName} 样板项目</span>
            </span>
          </a>
          <nav className="flex gap-2 overflow-x-auto text-xs text-slate-300 md:text-sm">
            {[
              ["总览", "overview"],
              ["资产", "assets"],
              ["诊断", "diagnosis"],
              ["内容", "content"],
              ["发布", "publish"],
              ["监测", "monitoring"],
              ["报告", "report"],
            ].map(([label, id]) => (
              <a key={id} href={`#${id}`} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-cyan-100">
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-6 md:py-12">
        <section id="overview" className="relative overflow-hidden rounded-[2.5rem] border border-cyan-300/20 bg-gradient-to-br from-slate-950 via-blue-950/55 to-violet-950/60 p-6 shadow-2xl shadow-cyan-950/30 md:p-10">
          <div className="absolute right-8 top-8 hidden h-40 w-40 rounded-full border border-cyan-200/20 bg-cyan-300/10 blur-sm md:block" />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <div className="mb-5 flex flex-wrap gap-3">
                <StatusBadge>公开只读</StatusBadge>
                <StatusBadge tone="violet">无需 Manus OAuth</StatusBadge>
                <StatusBadge tone="emerald">仅样板数据</StatusBadge>
              </div>
              <p className="text-sm font-semibold uppercase tracking-[0.42em] text-cyan-200/80">AI GEO Growth Workbench</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-6xl">{demoProject.name}</h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 md:text-lg">外部验收、销售演示和客户试跑展示专用入口。页面完整展示 V1.2 的核心样板能力，但不开放任何写操作、生成操作或发布操作。</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <StatusBadge tone="amber">当前阶段：{demoProject.stage}</StatusBadge>
                <StatusBadge tone="blue">下一步动作：发布后复测</StatusBadge>
              </div>
            </div>
            <ReadOnlyNotice />
          </div>
        </section>

        <Section eyebrow="01 / Overview" title="总览指挥舱" description="展示外部 Demo 的核心指标、当前阶段、下一步动作、GEO 增长路径、AI 今日建议和待复测任务。">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {demoMetrics.map((metric) => (
              <article key={metric.label} className={`rounded-3xl border p-5 shadow-xl ${toneClasses[metric.tone]}`}>
                <p className="text-sm text-slate-300">{metric.label}</p>
                <p className="mt-3 text-3xl font-semibold text-white">{metric.value}</p>
                <p className="mt-3 text-xs leading-5 text-slate-300">{metric.note}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <h3 className="text-lg font-semibold text-white">GEO 增长路径</h3>
              <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {growthPath.map((step, index) => (
                  <div key={step} className="relative rounded-2xl border border-cyan-300/15 bg-slate-950/75 p-4">
                    <span className="text-xs text-cyan-200">0{index + 1}</span>
                    <p className="mt-2 text-sm font-semibold text-white">{step}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-3xl border border-emerald-300/15 bg-emerald-400/5 p-5">
                <p className="text-sm font-semibold text-emerald-100">AI 今日建议</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{demoProject.nextAction}</p>
              </div>
              <div className="rounded-3xl border border-amber-300/15 bg-amber-400/5 p-5">
                <p className="text-sm font-semibold text-amber-100">待处理任务</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                  <li>复测已发布 GEO 内容页收录状态。</li>
                  <li>复测 AI 是否提及、是否推荐海豚知道。</li>
                  <li>补充客户案例证据链，避免泛化表述。</li>
                </ul>
              </div>
            </div>
          </div>
        </Section>

        <Section eyebrow="02 / Assets" title="企业资产" description="只读展示海豚知道样板项目的基础资料、产品服务、案例采集、竞品、合规、风格和发布策略，不展示真实客户敏感数据。">
          <div id="assets" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {assetSections.map((section) => (
              <article key={section.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-blue-950/10">
                <h3 className="text-base font-semibold text-white">{section.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{section.content}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section eyebrow="03 / Diagnosis" title="AI 诊断" description="展示 10 条客户指定问题、AI 回答、语义分析、GEO 评分、内容缺口、竞品差距和人工修订样本。">
          <div id="diagnosis" className="grid gap-4 lg:grid-cols-2">
            {diagnosisQuestions.map((item, index) => (
              <article key={item.question} className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-base font-semibold leading-6 text-white">{index + 1}. {item.question}</h3>
                  <StatusBadge tone={item.score >= 40 ? "emerald" : "blue"}>GEO {item.score}</StatusBadge>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-300"><span className="text-cyan-200">AI 回答：</span>{item.answer}</p>
                <div className="mt-4 grid gap-3 text-xs leading-5 text-slate-300 md:grid-cols-2">
                  <p><span className="text-violet-200">语义分析：</span>{item.analysis}</p>
                  <p><span className="text-amber-200">内容缺口：</span>{item.gap}</p>
                  <p><span className="text-blue-200">竞品差距：</span>{item.competitorGap}</p>
                  <p><span className="text-emerald-200">人工修订样本：</span>{item.manualRevision}</p>
                </div>
              </article>
            ))}
          </div>
        </Section>

        <Section eyebrow="04 / Content" title="内容生产" description="展示 3 篇核心 GEO 内容，每篇包含 8 项生成依据、事实溯源表、质量评分、一致性检查、发布前检查和 AI 可引用片段。">
          <div id="content" className="space-y-5">
            {demoArticles.map((article) => (
              <article key={article.title} className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-violet-950/10 md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">{article.type}</p>
                    <h3 className="mt-3 text-xl font-semibold text-white">{article.title}</h3>
                    <p className="mt-2 text-sm text-slate-400">{article.status}</p>
                  </div>
                  <StatusBadge tone={article.qualityScore >= 95 ? "emerald" : "violet"}>GEO 内容质量评分 {article.qualityScore}/100</StatusBadge>
                </div>
                <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-3xl border border-cyan-300/15 bg-cyan-400/5 p-4">
                    <h4 className="font-semibold text-cyan-100">8 项生成依据</h4>
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300">
                      {article.generatedBasis.map((basis) => <li key={basis}>{basis}</li>)}
                    </ol>
                  </div>
                  <div className="space-y-4">
                    <div className="overflow-hidden rounded-3xl border border-white/10">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-white/[0.06] text-slate-200">
                          <tr>
                            <th className="px-4 py-3">事实项</th>
                            <th className="px-4 py-3">来源</th>
                            <th className="px-4 py-3">状态</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10 text-slate-300">
                          {article.factTrace.map((fact) => (
                            <tr key={`${article.title}-${fact.item}`}>
                              <td className="px-4 py-3">{fact.item}</td>
                              <td className="px-4 py-3">{fact.source}</td>
                              <td className="px-4 py-3">{fact.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <p className="rounded-2xl border border-emerald-300/15 bg-emerald-400/5 p-4 text-sm leading-6 text-slate-300"><span className="text-emerald-100">一致性检查：</span>{article.consistencyCheck}</p>
                      <p className="rounded-2xl border border-blue-300/15 bg-blue-400/5 p-4 text-sm leading-6 text-slate-300"><span className="text-blue-100">发布前检查：</span>{article.prePublishCheck}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 rounded-3xl border border-violet-300/15 bg-violet-400/5 p-4">
                  <h4 className="font-semibold text-violet-100">AI 可引用片段</h4>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                    {article.aiQuotableSnippets.map((snippet) => <li key={snippet}>“{snippet}”</li>)}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </Section>

        <Section eyebrow="05 / Publish" title="平台发布" description="展示系统内置 GEO 内容页发布记录、可访问链接和第三方平台只读素材说明，不执行发布动作。">
          <div id="publish" className="space-y-4">
            {publishRecords.map((record) => (
              <article key={record.title} className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{record.title}</h3>
                    <p className="mt-2 text-sm text-slate-400">{record.channel}｜质量评分 {record.qualityScore}/100</p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{record.notes}</p>
                  </div>
                  <StatusBadge tone="emerald">{record.status}</StatusBadge>
                </div>
                <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-4 text-sm leading-6 text-slate-300">
                  <p className="text-cyan-100">发布链接可访问：</p>
                  <a className="mt-2 inline-flex break-all text-cyan-200 underline decoration-cyan-300/40 underline-offset-4 hover:text-cyan-100" href={record.publicPath}>{record.publicPath}</a>
                </div>
                <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-300">第三方平台素材：{record.thirdPartyMaterial}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section eyebrow="06 / Monitoring" title="收录监测" description="展示发布后监测记录、收录状态、AI 提及状态、AI 推荐状态、当前建议和未达成时的优化建议。">
          <div id="monitoring" className="grid gap-4 lg:grid-cols-2">
            {monitoringRecords.map((record) => (
              <article key={record.target} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <h3 className="text-lg font-semibold text-white">{record.target}</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusBadge tone="amber">收录状态：{record.indexStatus}</StatusBadge>
                  <StatusBadge tone="blue">AI 提及：{record.aiMentionStatus}</StatusBadge>
                  <StatusBadge tone="violet">AI 推荐：{record.aiRecommendStatus}</StatusBadge>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-300"><span className="text-cyan-200">当前建议：</span>{record.currentSuggestion}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300"><span className="text-amber-200">未收录 / 未提及 / 未推荐优化建议：</span>{record.optimizationSuggestion}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section eyebrow="07 / Report" title="报告中心" description="展示至少 1 份客户可读 GEO 试跑报告，并保留样本量有限的风险说明。">
          <div id="report" className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
            <article className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">客户可读报告</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">{reportSummary.title}</h3>
              <p className="mt-4 text-sm leading-6 text-slate-300"><span className="text-cyan-200">报告范围：</span>{reportSummary.scope}</p>
              <p className="mt-3 text-sm leading-6 text-slate-300"><span className="text-emerald-200">结论摘要：</span>{reportSummary.conclusion}</p>
            </article>
            <div className="rounded-3xl border border-amber-300/20 bg-amber-400/10 p-5 shadow-xl shadow-amber-950/10">
              <p className="text-sm font-semibold text-amber-100">风险提示卡</p>
              <p className="mt-3 text-sm leading-6 text-amber-50/90">{reportSummary.risk}</p>
              <p className="mt-3 text-xs leading-5 text-amber-100/75">Demo 中的监测状态为样板展示和待人工复测口径，不能用于对客户作效果保证。</p>
            </div>
          </div>
        </Section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 md:p-7">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">Read-only Guard</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">以下操作在 Demo 中均已禁用</h2>
            </div>
            <StatusBadge tone="amber">Demo 演示模式仅支持查看，不支持修改。</StatusBadge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            {disabledOperations.map((operation) => (
              <button key={operation} disabled title="Demo 演示模式仅支持查看，不支持修改。" className="cursor-not-allowed rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-500 opacity-75">
                {operation}
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
