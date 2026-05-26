import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { aiGlassPanel, aiInput, aiOutlineBtn } from "@/lib/aiProductUi";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { ProfileSectionShell } from "./ProfileSectionShell";
import { type FaqItem, type SectionStatusTone } from "./types";

const textareaClass = `${aiInput} min-h-[4rem] w-full max-w-none resize-y py-2`;

type Props = {
  status: SectionStatusTone;
  saving: boolean;
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
  onSave: () => void;
};

export function TrustMaterialSection({
  status,
  saving,
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
  onSave,
}: Props) {
  const addFaq = () => {
    onFaqItemsChange([
      ...faqItems,
      { id: `faq-${Date.now()}`, question: "", answer: "" },
    ]);
  };

  return (
    <ProfileSectionShell
      id="profile-trust"
      title="信任背书与常见疑虑"
      description="权威背书与 FAQ 会进入种草内容、对比文与客户交付报告。"
      hint="常见疑虑请逐条填写「问题 + 标准回答」，便于 AI 搜索引用。"
      status={status}
      saveLabel="保存信任素材"
      onSave={onSave}
      saving={saving}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn(aiGlassPanel, "space-y-2 p-4")}>
          <p className="font-medium text-white">权威背书</p>
          <textarea className={textareaClass} rows={3} value={authorityText} onChange={e => onAuthorityTextChange(e.target.value)} placeholder="专家身份、行业地位等" />
        </div>
        <div className={cn(aiGlassPanel, "space-y-2 p-4")}>
          <p className="font-medium text-white">合作客户</p>
          <textarea className={textareaClass} rows={3} value={partnersText} onChange={e => onPartnersTextChange(e.target.value)} placeholder="服务过的典型客户类型或品牌" />
        </div>
        <div className={cn(aiGlassPanel, "space-y-2 p-4")}>
          <p className="font-medium text-white">资质 / 认证</p>
          <textarea className={textareaClass} rows={3} value={credentialsText} onChange={e => onCredentialsTextChange(e.target.value)} />
        </div>
        <div className={cn(aiGlassPanel, "space-y-2 p-4")}>
          <p className="font-medium text-white">媒体报道</p>
          <textarea className={textareaClass} rows={3} value={mediaText} onChange={e => onMediaTextChange(e.target.value)} />
        </div>
        <div className={cn(aiGlassPanel, "space-y-2 p-4 lg:col-span-2")}>
          <p className="font-medium text-white">客户评价</p>
          <textarea className={textareaClass} rows={2} value={reviewsText} onChange={e => onReviewsTextChange(e.target.value)} />
        </div>
      </div>

      <div className="mt-6 space-y-3" data-testid="trust-faq-cards">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-white">常见疑虑 FAQ</p>
          <Button type="button" size="sm" variant="outline" className={aiOutlineBtn} onClick={addFaq}>
            <Plus className="mr-1 size-3.5" />
            添加 FAQ
          </Button>
        </div>
        {faqItems.length === 0 ? (
          <p className="text-sm text-slate-500">暂无 FAQ，点击添加常见客户问题与标准回答。</p>
        ) : (
          faqItems.map((item, idx) => (
            <div key={item.id} className={cn(aiGlassPanel, "space-y-2 p-4")}>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">FAQ {idx + 1}</span>
                <button
                  type="button"
                  className="text-slate-500 hover:text-red-300"
                  onClick={() => onFaqItemsChange(faqItems.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <Input
                className="border-gray-200 bg-white"
                placeholder="客户常问的问题"
                value={item.question}
                onChange={e => {
                  const next = [...faqItems];
                  next[idx] = { ...item, question: e.target.value };
                  onFaqItemsChange(next);
                }}
              />
              <textarea
                className={textareaClass}
                rows={3}
                placeholder="标准回答"
                value={item.answer}
                onChange={e => {
                  const next = [...faqItems];
                  next[idx] = { ...item, answer: e.target.value };
                  onFaqItemsChange(next);
                }}
              />
            </div>
          ))
        )}
      </div>
    </ProfileSectionShell>
  );
}
