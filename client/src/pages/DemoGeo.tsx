import React from "react";
import { Button } from "@/components/ui/button";
import { AUTH_PRODUCT_NAME } from "@/components/auth/authMarketing";
import {
  demoArticles,
  demoFlowStepTitles,
  demoGeoGapAnalysis,
  demoProject,
  demoT0Detection,
  demoT0T1Comparison,
  diagnosisQuestions,
  publishRecords,
} from "@/lib/demoGeoData";
import { BarChart3, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";

const TOTAL_STEPS = demoFlowStepTitles.length;

function DemoShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 via-white to-blue-50/40 text-gray-900">
      <header className="border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
              <BarChart3 className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{AUTH_PRODUCT_NAME}</p>
              <p className="text-xs text-gray-500">演示模式 · {demoProject.shortName} 样板数据</p>
            </div>
          </div>
          <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">无需登录</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}

function StepProgress({ step }: { step: number }) {
  return (
    <div className="mb-8">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
        第 {step} / {TOTAL_STEPS} 步
      </p>
      <div className="mt-3 flex gap-2">
        {demoFlowStepTitles.map((title, index) => {
          const n = index + 1;
          const active = n === step;
          const done = n < step;
          return (
            <div key={title} className="flex-1">
              <div
                className={`h-1.5 rounded-full ${done ? "bg-blue-600" : active ? "bg-blue-400" : "bg-gray-200"}`}
                title={title}
              />
              <p className={`mt-2 hidden text-[10px] leading-tight sm:block ${active ? "font-medium text-blue-700" : "text-gray-400"}`}>
                {title}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 text-gray-600">{hint}</p> : null}
    </div>
  );
}

function StepT0Detection() {
  const t0 = demoT0Detection;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">基线检测结果</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          展示「{t0.brandName}」在 AI 实测诊断阶段的初始结果（{t0.testedAt} 样本，脱敏展示）。
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="GEO 总分（基线）" value={`${t0.geoScore}`} hint={`可见度：${t0.visibilityLevel}`} />
        <MetricCard label="客户指定问题" value={`${t0.questionCount} 条`} />
        <MetricCard label="品牌提及" value={`${t0.mentionCount} 次`} hint={`提及率 ${t0.mentionRateLabel}`} />
        <MetricCard label="品牌推荐" value={`${t0.recommendCount} 次`} hint={`推荐率 ${t0.recommendRateLabel}`} />
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">分引擎汇总</h2>
        <ul className="mt-3 divide-y divide-gray-100 text-sm">
          {t0.engines.map(engine => (
            <li key={engine.name} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:justify-between">
              <span className="font-medium text-gray-900">{engine.name}</span>
              <span className="text-gray-600">
                {engine.questionCount} 题 · 提及 {engine.mentionRate} · 推荐 {engine.recommendRate}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">关键问题样例</h2>
        {t0.sampleQuestions.map(item => (
          <article key={item.question} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">{item.engine}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${item.mentioned ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}
              >
                {item.mentioned ? "已提及" : "未提及"}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${item.recommended ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}
              >
                {item.recommended ? "已推荐" : "未推荐"}
              </span>
            </div>
            <p className="mt-2 text-sm font-medium text-gray-900">{item.question}</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">{item.answerExcerpt}</p>
          </article>
        ))}
      </div>
      <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">{t0.summary}</p>
    </div>
  );
}

function StepGeoGapAnalysis() {
  const gaps = demoGeoGapAnalysis;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">GEO 缺口分析</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">{gaps.headline}</p>
      </div>
      <div className="space-y-3">
        {gaps.priorityGaps.map(gap => (
          <article key={gap.title} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-semibold text-gray-900">{gap.title}</h2>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${gap.severity === "高" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}
              >
                优先级 {gap.severity}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-gray-600">{gap.detail}</p>
          </article>
        ))}
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">竞品差距</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-600">
          {gaps.competitorGaps.map(item => (
            <li key={item.competitor}>
              <span className="font-medium text-gray-900">{item.competitor}：</span>
              {item.gap}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
        <h2 className="text-sm font-semibold text-blue-900">建议优化路径</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-blue-900/90">
          {gaps.recommendedActions.map(action => (
            <li key={action}>{action}</li>
          ))}
        </ol>
      </div>
      <p className="text-xs text-gray-500">以下展示 3 条诊断问题摘要（共 {diagnosisQuestions.length} 条样本中的节选）。</p>
      <div className="grid gap-3 md:grid-cols-3">
        {diagnosisQuestions.slice(0, 3).map((item, index) => (
          <div key={item.question} className="rounded-xl border border-dashed border-gray-200 bg-white/80 p-3 text-xs">
            <p className="font-medium text-gray-800">
              {index + 1}. {item.question}
            </p>
            <p className="mt-2 text-gray-600">缺口：{item.gap}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepContentAssets() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">生成的内容资产</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          基于诊断缺口与企业资产，系统生成可被 AI 引用的 GEO 内容（含生成依据、事实溯源与质检结果）。
        </p>
      </div>
      <div className="space-y-4">
        {demoArticles.map(article => (
          <article key={article.title} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium text-blue-600">{article.type}</p>
                <h2 className="mt-1 text-lg font-semibold text-gray-900">{article.title}</h2>
                <p className="mt-1 text-sm text-gray-500">{article.status}</p>
              </div>
              <span className="inline-flex shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                质量评分 {article.qualityScore}/100
              </span>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              <span className="font-medium text-gray-800">AI 可引用片段：</span>
              {article.aiQuotableSnippets[0]}
            </p>
            <p className="mt-2 text-xs text-gray-500">生成依据 {article.generatedBasis.length} 项 · 事实溯源 {article.factTrace.length} 条</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function StepPublishRecords() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">发布记录</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">展示内容发布至系统内置 GEO 内容页的记录（Demo 不执行真实发布操作）。</p>
      </div>
      {publishRecords.map(record => (
        <article key={record.title} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">{record.status}</span>
            <span className="text-xs text-gray-500">{record.channel}</span>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-gray-900">{record.title}</h2>
          <p className="mt-2 text-sm text-gray-600">{record.notes}</p>
          <p className="mt-3 text-sm">
            <span className="text-gray-500">发布路径：</span>
            <span className="text-gray-800">{record.publicPath}</span>
            <span className="mt-1 block text-xs text-gray-500">Demo 仅展示样板路径，不跳转至后台发布页。</span>
          </p>
          <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600">第三方素材：{record.thirdPartyMaterial}</p>
        </article>
      ))}
    </div>
  );
}

function StepT0T1Comparison() {
  const cmp = demoT0T1Comparison;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">基线 → 优化后效果对比</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">用示例数据说明试跑前后指标变化方向（非效果承诺）。</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">指标</th>
              <th className="px-4 py-3 font-medium">基线阶段</th>
              <th className="px-4 py-3 font-medium">优化后阶段</th>
              <th className="px-4 py-3 font-medium">变化</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cmp.rows.map(row => (
              <tr key={row.metric}>
                <td className="px-4 py-3 font-medium text-gray-900">{row.metric}</td>
                <td className="px-4 py-3 text-gray-600">{row.t0}</td>
                <td className="px-4 py-3 text-gray-600">{row.t1}</td>
                <td className="px-4 py-3 text-blue-700">{row.change}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2">
        {cmp.highlights.map(item => (
          <li key={item} className="flex gap-2 text-sm leading-6 text-gray-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
      <p className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-700">{cmp.narrative}</p>
      <p className="text-xs leading-5 text-gray-500">{cmp.disclaimer}</p>
    </div>
  );
}

function DemoCompleteScreen() {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600">
        <CheckCircle2 className="h-8 w-8" aria-hidden />
      </div>
      <h1 className="mt-6 text-2xl font-semibold text-gray-900">演示完成</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-gray-600">
        你已了解从 AI 诊断、缺口分析、内容生成、发布到效果对比的完整 GEO 增长路径。注册后即可为你的企业建立专属项目。
      </p>
      <Button size="lg" className="mt-8 bg-blue-600 px-8 text-white hover:bg-blue-700" asChild>
        <Link href="/register">开始你的 GEO 之旅</Link>
      </Button>
      <p className="mt-4 text-xs text-gray-500">
        需要查看完整只读模块？
        <Link href="/demo/geo" className="ml-1 text-blue-600 underline underline-offset-2">
          打开全模块浏览
        </Link>
      </p>
    </div>
  );
}

export default function DemoGeoPage() {
  const [step, setStep] = useState(1);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    document.title = `演示模式 - ${demoProject.shortName} | ${AUTH_PRODUCT_NAME}`;
  }, []);

  const handleNext = () => {
    if (step >= TOTAL_STEPS) {
      setFinished(true);
      return;
    }
    setStep(s => s + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(s => s - 1);
  };

  return (
    <DemoShell>
      {finished ? (
        <DemoCompleteScreen />
      ) : (
        <>
          <StepProgress step={step} />
          {step === 1 ? <StepT0Detection /> : null}
          {step === 2 ? <StepGeoGapAnalysis /> : null}
          {step === 3 ? <StepContentAssets /> : null}
          {step === 4 ? <StepPublishRecords /> : null}
          {step === 5 ? <StepT0T1Comparison /> : null}
          <div className="mt-10 flex flex-col items-stretch gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="order-2 text-xs leading-5 text-gray-500 sm:order-1 sm:max-w-md">{demoProject.riskNotice}</p>
            <div className="order-1 flex gap-3 sm:order-2">
              <Button
                type="button"
                variant="outline"
                disabled={step <= 1}
                className="shrink-0 sm:min-w-[120px]"
                onClick={handlePrev}
              >
                <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
                上一步
              </Button>
              <Button type="button" className="shrink-0 bg-blue-600 text-white hover:bg-blue-700 sm:min-w-[140px]" onClick={handleNext}>
                {step >= TOTAL_STEPS ? "完成演示" : "下一步"}
                <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        </>
      )}
    </DemoShell>
  );
}
