import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { sentimentLabelCn } from "@shared/aiTestEvidence";
import type { DeliveryReportPublicEvidencePayload } from "@shared/deliveryReportPublicShare";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

function boolLabel(v: boolean) {
  return v ? "是" : "否";
}

function EvidenceSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/50 p-5">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

export type AiSearchEvidenceFooterAction = { label: string; onClick: () => void };

export function AiSearchEvidenceView({
  evidence,
  footerActions = [],
}: {
  evidence: DeliveryReportPublicEvidencePayload;
  footerActions?: AiSearchEvidenceFooterAction[];
}) {
  const competitorMentionCount = evidence.competitorMentions.filter(c => c.mentioned).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12 pt-6 text-slate-100">
      <div className="border-b border-white/10 pb-4">
        <p className="text-xs uppercase tracking-wide text-cyan-300/80">AI 搜索实测证据</p>
        <h1 className="mt-2 text-2xl font-bold text-white">单次实测完整证据链</h1>
        <p className="mt-2 text-sm text-slate-400">
          以下内容为系统对主流 AI 搜索引擎的真实提问与回答记录，可用于复查品牌提及、推荐与竞品对比情况。
        </p>
        {evidence.brandName ? (
          <p className="mt-2 text-sm text-slate-500">
            <span className="text-slate-500">品牌：</span>
            {evidence.brandName}
            {evidence.enterpriseName && evidence.enterpriseName !== evidence.brandName ? (
              <span className="text-slate-600"> · {evidence.enterpriseName}</span>
            ) : null}
          </p>
        ) : null}
      </div>

      <Card className="border-cyan-400/20 bg-cyan-500/5">
        <CardHeader>
          <CardTitle className="text-lg text-white">测试概要</CardTitle>
          <CardDescription className="text-cyan-100/80">本页展示该次测试的关键结论</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <p>
            <span className="text-slate-500">测试引擎：</span>
            {evidence.engineName}
          </p>
          <p>
            <span className="text-slate-500">测试时间：</span>
            {new Date(evidence.testedAt).toLocaleString()}
          </p>
          <p>
            <span className="text-slate-500">测试阶段：</span>
            {evidence.stageLabel}
          </p>
          <p>
            <span className="text-slate-500">是否提及品牌：</span>
            {boolLabel(evidence.mentionedBrand)}
          </p>
          <p>
            <span className="text-slate-500">是否推荐品牌：</span>
            {boolLabel(evidence.recommendedBrand)}
          </p>
          <p>
            <span className="text-slate-500">品牌排名：</span>
            {evidence.brandRank ?? "未识别"}
          </p>
          <p>
            <span className="text-slate-500">情感倾向：</span>
            {sentimentLabelCn(evidence.sentiment)}
          </p>
          <p>
            <span className="text-slate-500">竞品提及数量：</span>
            {competitorMentionCount}
          </p>
          <p>
            <span className="text-slate-500">引用来源数量：</span>
            {evidence.citedUrls.length}
          </p>
          <p className="sm:col-span-2 lg:col-span-3">
            <span className="text-slate-500">测试问题：</span>
            {evidence.question}
          </p>
          {evidence.evidenceSummary ? (
            <p className="sm:col-span-2 lg:col-span-3 text-slate-300">{evidence.evidenceSummary}</p>
          ) : null}
        </CardContent>
      </Card>

      <EvidenceSection title="AI 原始回答">
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200">
            <ChevronDown className="h-4 w-4" />
            展开 / 收起全文
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-slate-900/80 p-4 text-sm leading-relaxed text-slate-200">
              {evidence.aiAnswerText}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </EvidenceSection>

      <EvidenceSection title="品牌识别结果">
        <ul className="space-y-2 text-sm text-slate-300">
          <li>是否提及本品牌：{boolLabel(evidence.mentionedBrand)}</li>
          <li>是否推荐本品牌：{boolLabel(evidence.recommendedBrand)}</li>
          <li>品牌出现排名：{evidence.brandRank ?? "未识别"}</li>
          <li>
            判断依据片段：
            <span className="mt-1 block rounded-lg bg-slate-900/60 p-3 text-slate-400">{evidence.brandMentionExcerpt}</span>
          </li>
        </ul>
      </EvidenceSection>

      <EvidenceSection title="竞品提及结果">
        {!evidence.competitorConfigured ? (
          <p className="text-sm text-slate-400">当前企业暂未配置竞品，本次未进行竞品提及分析。</p>
        ) : evidence.competitorMentions.length === 0 ? (
          <p className="text-sm text-slate-400">已配置竞品，但本次回答中未识别到竞品提及。</p>
        ) : (
          <div className="space-y-3">
            {evidence.competitorMentions.map(c => (
              <div key={c.name} className="rounded-xl border border-white/10 bg-slate-900/50 p-3 text-sm">
                <p className="font-medium text-white">{c.name}</p>
                <p className="mt-1 text-slate-400">是否出现：{c.mentioned ? "是" : "否"}</p>
                {c.mentioned ? (
                  <>
                    <p className="text-slate-400">出现排名：{c.rank ?? "未识别"}</p>
                    {c.context ? <p className="mt-2 text-slate-500">相关片段：{c.context}</p> : null}
                  </>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </EvidenceSection>

      <EvidenceSection title="引用来源">
        {evidence.citedUrls.length === 0 ? (
          <p className="text-sm text-slate-400">本次 AI 回答未返回明确引用来源。</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {evidence.citedUrls.map(url => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer" className="break-all text-cyan-300 underline">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        )}
      </EvidenceSection>

      {evidence.parseNeedsAttention ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          本次 AI 回答已保存，但部分结构化解析未完成（{evidence.parseStatusLabel}），不影响原始证据查看。
        </div>
      ) : null}

      {footerActions.length > 0 ? (
        <div className="flex flex-wrap gap-3 border-t border-white/10 pt-4">
          {footerActions.map(action => (
            <Button key={action.label} variant="outline" className="border-white/15 text-slate-100" onClick={action.onClick}>
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
