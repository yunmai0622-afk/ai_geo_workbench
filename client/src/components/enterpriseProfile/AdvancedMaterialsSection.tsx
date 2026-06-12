import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomerCaseLibrarySection } from "@/components/enterpriseProfile/CustomerCaseLibrarySection";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import type { CaseDraft, FaqItem, SectionStatusTone } from "./types";

const textareaClass = "w-full min-h-[4rem] max-w-none resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100";

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
  showCompetitorSection?: boolean;
};

function FoldGroup({
  title,
  summary,
  testId,
  id,
  children,
}: {
  title: string;
  summary: string;
  testId: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <details id={id} className="rounded-lg border border-gray-200 bg-white text-sm" data-testid={testId}>
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-medium text-gray-800 hover:text-gray-900 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-4 text-gray-400 transition-transform [[open]>&]:rotate-180" />
        <span>{title}</span>
        <span className="ml-2 text-xs font-normal text-gray-500">{summary}</span>
      </summary>
      <div className="space-y-4 border-t border-gray-100 px-4 pb-4 pt-3">{children}</div>
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
    showCompetitorSection = true,
  } = props;

  const addFaq = () => {
    onFaqItemsChange([...faqItems, { id: `faq-${Date.now()}`, question: "", answer: "" }]);
  };

  return (
    <section
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      data-testid="advanced-materials-section"
    >
      <h3 className="text-base font-semibold text-gray-900">高级素材补充</h3>
      <p className="mt-1 text-sm text-gray-500">
        这些信息不是必填，但会提升内容可信度和 AI 引用概率。
      </p>

      <details className="mt-4 rounded-lg border border-gray-200 bg-gray-50 text-sm" data-testid="advanced-materials-collapsed">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-gray-700 hover:text-gray-900 [&::-webkit-details-marker]:hidden">
          <ChevronDown className="size-4 text-gray-400 transition-transform [[open]>&]:rotate-180" />
          展开高级素材（案例 {caseCount} · 品牌与背书 {trustCount} · FAQ {faqCount}）
        </summary>
        <div className="space-y-3 border-t border-gray-200 p-4">
          <FoldGroup title="案例详情" summary={`${caseCount} 条`} testId="advanced-fold-cases" id="customer-cases-detail">
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
              <span className="text-gray-600">品牌故事与定位说明</span>
              <textarea className={textareaClass} value={authorityText} onChange={e => onAuthorityTextChange(e.target.value)} />
            </label>
            <Button type="button" size="sm" className="bg-blue-600 text-white hover:bg-blue-700" disabled={saving} onClick={onSaveTrust}>
              保存品牌故事
            </Button>
          </FoldGroup>

          <FoldGroup title="团队介绍" summary={partnersText.trim() ? "已填写" : "待补充"} testId="advanced-fold-team">
            <label className="block space-y-1 text-sm">
              <span className="text-gray-600">团队 / 合作客户</span>
              <Input value={partnersText} onChange={e => onPartnersTextChange(e.target.value)} />
            </label>
          </FoldGroup>

          <FoldGroup title="资质证书" summary={credentialsText.trim() ? "已填写" : "待补充"} testId="advanced-fold-credentials">
            <label className="block space-y-1 text-sm">
              <span className="text-gray-600">资质证书</span>
              <Input value={credentialsText} onChange={e => onCredentialsTextChange(e.target.value)} />
            </label>
          </FoldGroup>

          <FoldGroup title="媒体报道" summary={mediaText.trim() ? "已填写" : "待补充"} testId="advanced-fold-media">
            <label className="block space-y-1 text-sm">
              <span className="text-gray-600">媒体报道</span>
              <Input value={mediaText} onChange={e => onMediaTextChange(e.target.value)} />
            </label>
          </FoldGroup>

          <FoldGroup title="客户评价" summary={reviewsText.trim() ? "已填写" : "待补充"} testId="advanced-fold-reviews">
            <label className="block space-y-1 text-sm">
              <span className="text-gray-600">客户评价</span>
              <Input value={reviewsText} onChange={e => onReviewsTextChange(e.target.value)} />
            </label>
            <Button type="button" size="sm" className="bg-blue-600 text-white hover:bg-blue-700" disabled={saving} onClick={onSaveTrust}>
              保存客户评价与媒体报道
            </Button>
          </FoldGroup>

          {showCompetitorSection ? (
            <FoldGroup title="竞品差异" summary={competitors.length ? `${competitors.length} 个竞品` : "待补充"} testId="advanced-fold-competitor">
              <label className="block space-y-1 text-sm">
                <span className="text-gray-600">常被比较的竞品</span>
                <div className="flex flex-wrap gap-2">
                  {competitors.map(c => (
                    <span key={c} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                      {c}
                      <button type="button" className="text-gray-400 hover:text-red-500" onClick={() => onRemoveCompetitor(c)}>
                        ×
                      </button>
                    </span>
                  ))}
                  <Input
                    className="max-w-[200px]"
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
                  <Button type="button" size="sm" variant="outline" onClick={onAddCompetitor}>
                    添加
                  </Button>
                </div>
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-gray-600">我们的差异</span>
                <Input value={competitorDifferenceText} onChange={e => onCompetitorDifferenceChange(e.target.value)} />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-gray-600">不承诺什么</span>
                <Input value={unfitCustomers} onChange={e => onUnfitCustomersChange(e.target.value)} placeholder="如不承诺效果、不适用于某类客户" />
              </label>
              <Button type="button" size="sm" className="bg-blue-600 text-white hover:bg-blue-700" disabled={saving} onClick={onSaveCompetitor}>
                保存竞品差异
              </Button>
            </FoldGroup>
          ) : null}

          <FoldGroup title="常见问答" summary={`${faqCount} 条`} testId="advanced-fold-faq">
            <div className="space-y-3">
              {faqItems.map((item, i) => (
                <div key={item.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex justify-end">
                    <Button type="button" size="icon" variant="ghost" className="size-8 text-gray-400 hover:text-red-500" onClick={() => onFaqItemsChange(faqItems.filter((_, j) => j !== i))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <Input className="mb-2" value={item.question} placeholder="客户疑虑" onChange={e => onFaqItemsChange(faqItems.map((f, j) => (j === i ? { ...f, question: e.target.value } : f)))} />
                  <textarea
                    className={textareaClass}
                    value={item.answer}
                    placeholder="标准回答"
                    onChange={e => onFaqItemsChange(faqItems.map((f, j) => (j === i ? { ...f, answer: e.target.value } : f)))}
                  />
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={addFaq}>
                <Plus className="mr-1 size-3.5" />
                添加 FAQ
              </Button>
            </div>
            <Button type="button" size="sm" className="mt-3 bg-blue-600 text-white hover:bg-blue-700" disabled={saving} onClick={onSaveTrust}>
              保存 FAQ
            </Button>
          </FoldGroup>
        </div>
      </details>
    </section>
  );
}
