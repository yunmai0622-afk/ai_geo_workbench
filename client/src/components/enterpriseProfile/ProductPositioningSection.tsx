import { Input } from "@/components/ui/input";
import { aiGlassPanel, aiInput } from "@/lib/aiProductUi";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { ProfileSectionShell } from "./ProfileSectionShell";
import type { SectionStatusTone } from "./types";

const textareaClass = `${aiInput} min-h-[5rem] w-full max-w-none resize-y py-2`;

type Props = {
  status: SectionStatusTone;
  saving: boolean;
  productDesc: string;
  onProductDescChange: (v: string) => void;
  keyPoints: string[];
  keyPointDraft: string;
  onKeyPointDraftChange: (v: string) => void;
  onAddKeyPoint: () => void;
  onRemoveKeyPoint: (idx: number) => void;
  serviceProcess: string;
  onServiceProcessChange: (v: string) => void;
  servicePriceRange: string;
  onServicePriceRangeChange: (v: string) => void;
  competitorDifferenceText: string;
  onCompetitorDifferenceChange: (v: string) => void;
  unfitCustomers: string;
  onUnfitCustomersChange: (v: string) => void;
  onSave: () => void;
};

export function ProductPositioningSection({
  status,
  saving,
  productDesc,
  onProductDescChange,
  keyPoints,
  keyPointDraft,
  onKeyPointDraftChange,
  onAddKeyPoint,
  onRemoveKeyPoint,
  serviceProcess,
  onServiceProcessChange,
  servicePriceRange,
  onServicePriceRangeChange,
  competitorDifferenceText,
  onCompetitorDifferenceChange,
  unfitCustomers,
  onUnfitCustomersChange,
  onSave,
}: Props) {
  return (
    <ProfileSectionShell
      id="profile-product"
      title="产品 / 服务定位"
      description="说清客户真正购买的价值，而不是堆砌产品名称。"
      hint="按卡片填写主营服务、卖点、流程与竞品差异，保存后用于 GEO 选题与内容生成。"
      status={status}
      saveLabel="保存产品定位"
      onSave={onSave}
      saving={saving}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className={cn(aiGlassPanel, "space-y-2 p-4 md:col-span-2")}>
          <p className="text-sm font-medium text-white">主营服务</p>
          <p className="text-xs text-slate-500">客户真正买的不是产品名称，而是你解决的问题。</p>
          <textarea value={productDesc} maxLength={200} onChange={e => onProductDescChange(e.target.value)} rows={3} className={textareaClass} />
        </div>
        <div className={cn(aiGlassPanel, "space-y-2 p-4")}>
          <p className="text-sm font-medium text-white">核心卖点</p>
          <p className="text-xs text-slate-500">建议 3 条：每条写清一个差异化价值，回车添加。</p>
          <div className="flex flex-wrap gap-2">
            {keyPoints.map((k, i) => (
              <span key={`${k}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs">
                {k}
                <button type="button" onClick={() => onRemoveKeyPoint(i)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <Input
            value={keyPointDraft}
            onChange={e => onKeyPointDraftChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddKeyPoint();
              }
            }}
            placeholder="回车添加卖点"
            className="border-gray-200 bg-white"
          />
        </div>
        <div className={cn(aiGlassPanel, "space-y-2 p-4")}>
          <p className="text-sm font-medium text-white">服务流程</p>
          <p className="text-xs text-slate-500">从接触到交付的关键步骤，帮助 AI 理解你的交付方式。</p>
          <textarea value={serviceProcess} onChange={e => onServiceProcessChange(e.target.value)} rows={4} className={textareaClass} placeholder="例如：诊断 → 方案 → 陪跑 → 复盘" />
        </div>
        <div className={cn(aiGlassPanel, "space-y-2 p-4")}>
          <p className="text-sm font-medium text-white">价格区间</p>
          <p className="text-xs text-slate-500">可写区间或起步价，避免空泛「面议」。</p>
          <Input value={servicePriceRange} onChange={e => onServicePriceRangeChange(e.target.value)} placeholder="例如：¥3,000–¥30,000 / 月" className="border-gray-200 bg-white" />
        </div>
        <div className={cn(aiGlassPanel, "space-y-2 p-4 md:col-span-2")}>
          <p className="text-sm font-medium text-white">竞品差异</p>
          <p className="text-xs text-slate-500">与主要竞品相比，客户为什么选你而不是别人。</p>
          <textarea value={competitorDifferenceText} onChange={e => onCompetitorDifferenceChange(e.target.value)} rows={2} className={textareaClass} placeholder="与主要竞品的差异点" />
        </div>
        <div className={cn(aiGlassPanel, "space-y-2 p-4 md:col-span-2")}>
          <p className="text-sm font-medium text-white">不适合客户</p>
          <p className="text-xs text-slate-500">明确边界可减少无效线索，也让 AI 引用更可信。</p>
          <textarea value={unfitCustomers} onChange={e => onUnfitCustomersChange(e.target.value)} rows={2} className={textareaClass} placeholder="哪些客户不适合购买你的服务" />
        </div>
      </div>
    </ProfileSectionShell>
  );
}
