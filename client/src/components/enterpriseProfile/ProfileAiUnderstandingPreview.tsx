import { Eye, AlertCircle } from "lucide-react";

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

function filled(v: string): boolean {
  return v.trim().length > 0;
}

export function ProfileAiUnderstandingPreview({ model }: Props) {
  const fields = [
    { label: "企业", value: model.brandName },
    { label: "行业", value: model.industry },
    { label: "一句话介绍", value: model.oneLiner },
    { label: "核心产品/服务", value: model.productDesc },
    { label: "目标客户", value: model.targetCustomer },
    { label: "你的产品主要解决什么问题？", value: model.primaryPain },
    { label: "你的核心优势是什么？", value: model.coreAdvantage },
    { label: "推荐关键词", value: model.keywords.filter(Boolean).join("、") },
  ];

  const filledCount = fields.filter(f => filled(f.value)).length;
  const missingFields = fields.filter(f => !filled(f.value));
  const allFilled = missingFields.length === 0;

  return (
    <div
      className="geo-card border-blue-100 bg-gradient-to-br from-blue-50/60 to-white p-6"
      data-testid="profile-ai-understanding-preview"
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Eye className="h-4.5 w-4.5 text-blue-600" />
        <h3 className="text-base font-bold text-gray-900">AI 当前会这样理解你的企业</h3>
      </div>
      <p className="mb-4 text-[13px] leading-relaxed text-gray-500">
        保存后，系统将按以下理解生成诊断与内容。信息越完整，AI 推荐越精准。
      </p>

      {/* Preview content */}
      <dl className="space-y-3 text-sm" data-testid="geo-onboarding-preview">
        {fields.map(f => (
          <div key={f.label} className="flex items-start gap-3">
            <dt className="w-[90px] shrink-0 text-[12px] font-medium text-gray-400">{f.label}</dt>
            <dd className={filled(f.value) ? "leading-relaxed text-gray-800" : "text-gray-300 italic"}>
              {filled(f.value) ? f.value : "待补充"}
            </dd>
          </div>
        ))}
      </dl>

      {/* Completion hint */}
      <div className="mt-5 rounded-lg border border-gray-100 bg-white/80 px-4 py-3">
        {allFilled ? (
          <p className="text-[13px] font-medium text-emerald-700">
            核心信息已完整（{filledCount}/8），保存后即可开始 AI 实测诊断。
          </p>
        ) : (
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <p className="text-[13px] font-medium text-amber-700">
                还有 {missingFields.length} 项未填写（{filledCount}/8）
              </p>
              <p className="mt-0.5 text-[12px] text-gray-500">
                缺失：{missingFields.map(f => f.label).join("、")}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
