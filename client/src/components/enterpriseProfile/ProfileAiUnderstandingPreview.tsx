import { P0Card } from "@/components/geo/P0UiPrimitives";
import { geoP0Surfaces } from "@/lib/geoP0Visual";

export type ProfileAiPreviewModel = {
  brandName: string;
  industry: string;
  oneLiner: string;
  productDesc: string;
  targetCustomer: string;
  primaryPain: string;
  coreAdvantage: string;
  keywords: string[];
};

type Props = {
  model: ProfileAiPreviewModel;
};

function line(value: string, fallback = "待补充") {
  const t = value.trim();
  return t || fallback;
}

export function ProfileAiUnderstandingPreview({ model }: Props) {
  const keywordLine =
    model.keywords.filter(Boolean).length > 0 ? model.keywords.filter(Boolean).join("、") : "待补充";

  return (
    <P0Card testId="profile-ai-understanding-preview">
      <p className={geoP0Surfaces.sectionTitle}>AI 理解预览</p>
      <p className={`mt-1 ${geoP0Surfaces.muted}`}>保存后，系统将按以下理解生成诊断与内容，请核对是否准确。</p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2" data-testid="geo-onboarding-preview">
        <PreviewRow label="企业" value={line(model.brandName)} />
        <PreviewRow label="行业" value={line(model.industry)} />
        <PreviewRow label="一句话" value={line(model.oneLiner)} className="sm:col-span-2" />
        <PreviewRow label="产品 / 服务" value={line(model.productDesc)} className="sm:col-span-2" />
        <PreviewRow label="目标客户" value={line(model.targetCustomer)} />
        <PreviewRow label="解决的问题" value={line(model.primaryPain)} />
        <PreviewRow label="核心优势" value={line(model.coreAdvantage)} className="sm:col-span-2" />
        <PreviewRow label="推荐关键词" value={keywordLine} className="sm:col-span-2" />
      </dl>
    </P0Card>
  );
}

function PreviewRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 leading-relaxed text-slate-800">{value}</dd>
    </div>
  );
}
