import { AiSection } from "@/components/ai/ProductUi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomerCaseLibrarySection } from "@/components/enterpriseProfile/CustomerCaseLibrarySection";
import { aiGlassPanel, aiInput, aiOutlineBtn, aiPrimaryBtn } from "@/lib/aiProductUi";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import type { CaseDraft, FaqItem, SectionStatusTone } from "./types";

const textareaClass = `${aiInput} min-h-[4rem] w-full max-w-none resize-y py-2`;

type Props = {
  caseCount: number;
  trustCount: number;
  faqCount: number;
  casesChoice: "unset" | "has" | "none";
  onCasesChoice: (v: "unset" | "has" | "none") => void;
  caseRows: CaseDraft[];
  onCaseRowsChange: (rows: CaseDraft[]) => void;
  onSaveCase: (row: CaseDraft, idx: number) => Promise<void>;
  onSaveChoiceNone: () => Promise<void>;
  onDeleteCase: (idx: number) => void;
  caseStatus: SectionStatusTone;
  trustStatus: SectionStatusTone;
  saving: boolean;
  competitors: string[];
  competitorDraft: string;
  onCompetitorDraftChange: (v: string) => void;
  onAddCompetitor: () => void;
  onRemoveCompetitor: (c: string) => void;
  competitorDifferenceText: string;
  onCompetitorDifferenceChange: (v: string) => void;
  unfitCustomers: string;
  onUnfitCustomersChange: (v: string) => void;
  authorityText: string;
  onAuthorityTextChange: (v: string) => void;
  partnersText: string;
  onPartnersTextChange: (v: string) => void;
  credentialsText: string;
  onCredentialsTextChange: (v: string) => void;
  mediaText: string;
  onMediaTextChange: (v: string) => void;
  reviewsText: string;
  onReviewsTextChange: (v: string) => void;
  faqItems: FaqItem[];
  onFaqItemsChange: (items: FaqItem[]) => void;
  onSaveTrust: () => void;
  onSaveCompetitor: () => void;
};

function FoldGroup({
  title,
  summary,
  testId,
  children,
}: {
  title: string;
  summary: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <details className={cn(aiGlassPanel, "text-sm")} data-testid={testId}>
      <summary className="cursor-pointer px-4 py-3 font-medium text-slate-200 hover:text-white [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="ml-2 text-xs font-normal text-slate-500">{summary}</span>
      </summary>
      <div className="space-y-4 border-t border-white/8 px-4 pb-4 pt-3">{children}</div>
    </details>
  );
}

export function AdvancedMaterialsSection(props: Props) {
  const {
    caseCount,
    trustCount,
    faqCount,
    casesChoice,
    onCasesChoice,
    caseRows,
    onCaseRowsChange,
    onSaveCase,
    onSaveChoiceNone,
    onDeleteCase,
    caseStatus,
    trustStatus,
    saving,
    competitors,
    competitorDraft,
    onCompetitorDraftChange,
    onAddCompetitor,
    onRemoveCompetitor,
    competitorDifferenceText,
    onCompetitorDifferenceChange,
    unfitCustomers,
    onUnfitCustomersChange,
    authorityText,
    onAuthorityTextChange,
    partnersText,
    onPartnersTextChange,
    credentialsText,
    onCredentialsTextChange,
    mediaText,
    onMediaTextChange,
    reviewsText,
    onReviewsTextChange,
    faqItems,
    onFaqItemsChange,
    onSaveTrust,
    onSaveCompetitor,
  } = props;

  const addFaq = () => {
    onFaqItemsChange([...faqItems, { id: `faq-${Date.now()}`, question: "", answer: "" }]);
  };

  return (
    <AiSection
      id="profile-advanced"
      title="高级素材补充"
      description="这些信息不是必填，但会提升内容可信度和 AI 引用概率。"
      data-testid="advanced-materials-section"
    >
      <details className={cn(aiGlassPanel, "text-sm")} data-testid="advanced-materials-collapsed">
        <summary className="cursor-pointer px-4 py-3 text-slate-300 hover:text-white">
          展开高级素材（案例 {caseCount} · 品牌与背书 {trustCount} · FAQ {faqCount}）
        </summary>
        <div className="space-y-3 border-t border-white/8 p-4">
          <FoldGroup title="案例详情" summary={`${caseCount} 条`} testId="advanced-fold-cases">
            <CustomerCaseLibrarySection
              embedded
              status={caseStatus}
              saving={saving}
              casesChoice={casesChoice}
              onCasesChoice={onCasesChoice}
              caseRows={caseRows}
              onCaseRowsChange={onCaseRowsChange}
              onSaveCase={onSaveCase}
              onSaveChoiceNone={onSaveChoiceNone}
              onDeleteCase={onDeleteCase}
            />
          </FoldGroup>

          <FoldGroup title="品牌故事" summary={authorityText.trim() ? "已填写" : "待补充"} testId="advanced-fold-brand-story">
            <label className="block space-y-1 text-sm md:col-span-2">
              <span className="text-slate-400">品牌故事与定位说明</span>
              <textarea className={textareaClass} value={authorityText} onChange={e => onAuthorityTextChange(e.target.value)} />
            </label>
            <Button type="button" size="sm" className={aiPrimaryBtn} disabled={saving} onClick={onSaveTrust}>
              保存品牌故事
            </Button>
          </FoldGroup>

          <FoldGroup title="团队介绍" summary={partnersText.trim() ? "已填写" : "待补充"} testId="advanced-fold-team">
            <label className="block space-y-1 text-sm">
              <span className="text-slate-400">团队 / 合作客户</span>
              <Input className={aiInput} value={partnersText} onChange={e => onPartnersTextChange(e.target.value)} />
            </label>
          </FoldGroup>

          <FoldGroup title="资质证书" summary={credentialsText.trim() ? "已填写" : "待补充"} testId="advanced-fold-credentials">
            <label className="block space-y-1 text-sm">
              <span className="text-slate-400">资质证书</span>
              <Input className={aiInput} value={credentialsText} onChange={e => onCredentialsTextChange(e.target.value)} />
            </label>
          </FoldGroup>

          <FoldGroup title="媒体报道" summary={mediaText.trim() ? "已填写" : "待补充"} testId="advanced-fold-media">
            <label className="block space-y-1 text-sm">
              <span className="text-slate-400">媒体报道</span>
              <Input className={aiInput} value={mediaText} onChange={e => onMediaTextChange(e.target.value)} />
            </label>
          </FoldGroup>

          <FoldGroup title="客户评价" summary={reviewsText.trim() ? "已填写" : "待补充"} testId="advanced-fold-reviews">
            <label className="block space-y-1 text-sm">
              <span className="text-slate-400">客户评价</span>
              <Input className={aiInput} value={reviewsText} onChange={e => onReviewsTextChange(e.target.value)} />
            </label>
            <Button type="button" size="sm" className={aiPrimaryBtn} disabled={saving} onClick={onSaveTrust}>
              保存客户评价与媒体报道
            </Button>
          </FoldGroup>

          <FoldGroup title="竞品差异" summary={competitors.length ? `${competitors.length} 个竞品` : "待补充"} testId="advanced-fold-competitor">
            <label className="block space-y-1 text-sm">
              <span className="text-slate-400">常被比较的竞品</span>
              <div className="flex flex-wrap gap-2">
                {competitors.map(c => (
                  <span key={c} className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-xs">
                    {c}
                    <button type="button" className="text-slate-500 hover:text-red-300" onClick={() => onRemoveCompetitor(c)}>
                      ×
                    </button>
                  </span>
                ))}
                <Input
                  className={cn(aiInput, "max-w-[200px]")}
                  value={competitorDraft}
                  onChange={e => onCompetitorDraftChange(e.target.value)}
                  placeholder="输入后回车"
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onAddCompetitor();
                    }
                  }}
                />
                <Button type="button" size="sm" variant="outline" className={aiOutlineBtn} onClick={onAddCompetitor}>
                  添加
                </Button>
              </div>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-slate-400">我们的差异</span>
              <Input className={aiInput} value={competitorDifferenceText} onChange={e => onCompetitorDifferenceChange(e.target.value)} />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-slate-400">不承诺什么</span>
              <Input className={aiInput} value={unfitCustomers} onChange={e => onUnfitCustomersChange(e.target.value)} placeholder="如不承诺效果、不适用于某类客户" />
            </label>
            <Button type="button" size="sm" className={aiPrimaryBtn} disabled={saving} onClick={onSaveCompetitor}>
              保存竞品差异
            </Button>
          </FoldGroup>

          <FoldGroup title="常见问答" summary={`${faqCount} 条`} testId="advanced-fold-faq">
            <div className="space-y-3">
              {faqItems.map((item, i) => (
                <div key={item.id} className="rounded-lg border border-white/10 p-3">
                  <div className="flex justify-end">
                    <Button type="button" size="icon" variant="ghost" className="size-8 text-slate-500" onClick={() => onFaqItemsChange(faqItems.filter((_, j) => j !== i))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <Input className={cn(aiInput, "mb-2")} value={item.question} placeholder="客户疑虑" onChange={e => onFaqItemsChange(faqItems.map((f, j) => (j === i ? { ...f, question: e.target.value } : f)))} />
                  <textarea
                    className={textareaClass}
                    value={item.answer}
                    placeholder="标准回答"
                    onChange={e => onFaqItemsChange(faqItems.map((f, j) => (j === i ? { ...f, answer: e.target.value } : f)))}
                  />
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" className={aiOutlineBtn} onClick={addFaq}>
                <Plus className="mr-1 size-3.5" />
                添加 FAQ
              </Button>
            </div>
            <Button type="button" size="sm" className={cn(aiPrimaryBtn, "mt-3")} disabled={saving} onClick={onSaveTrust}>
              保存 FAQ
            </Button>
          </FoldGroup>
        </div>
      </details>
    </AiSection>
  );
}
