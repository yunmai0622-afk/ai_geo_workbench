import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import { cn } from "@/lib/utils";
import { ENTERPRISE_INDUSTRY_OPTIONS } from "@shared/enterpriseProfileIndustry";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export type FiveMinuteBasicValues = {
  brandName: string;
  industrySelect: string;
  industryCustom: string;
  oneLiner: string;
  productDesc: string;
  targetCustomer: string;
  primaryPain: string;
  coreAdvantage: string;
};

type Props = {
  values: FiveMinuteBasicValues;
  onChange: (patch: Partial<FiveMinuteBasicValues>) => void;
  keywords: string[];
  keywordDraft: string;
  onKeywordDraftChange: (v: string) => void;
  onAddKeyword: () => void;
  onRemoveKeyword: (k: string) => void;
};

const inputClass =
  "h-10 border-slate-200 bg-white text-slate-900 shadow-sm focus-visible:ring-blue-500";

function Field({
  label,
  required,
  testId,
  children,
}: {
  label: string;
  required?: boolean;
  testId: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm" data-testid={testId}>
      <span className="font-medium text-slate-700">
        {label}
        {required ? <span className="ml-1 text-amber-600">*</span> : null}
      </span>
      {children}
    </label>
  );
}

export function FiveMinuteBasicOnboardingSection({
  values,
  onChange,
  keywords,
  keywordDraft,
  onKeywordDraftChange,
  onAddKeyword,
  onRemoveKeyword,
}: Props) {
  const set = (key: keyof FiveMinuteBasicValues, v: string) => onChange({ [key]: v });

  return (
    <P0Card testId="five-minute-basic-onboarding">
      <div id="profile-basic-five-min" className="scroll-mt-24">
        <p className={geoP0Surfaces.sectionTitle}>核心建档字段</p>
        <p className={`mt-1 ${geoP0Surfaces.muted}`}>填写 8 项即可开始 AI 诊断，其余素材可稍后补充。</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="企业名称" required testId="p0-field-brand-name">
            <Input className={inputClass} value={values.brandName} onChange={e => set("brandName", e.target.value)} />
          </Field>
          <Field label="所属行业" required testId="p0-field-industry">
            <select
              className={cn(inputClass, "w-full rounded-md border px-3")}
              value={values.industrySelect}
              onChange={e => set("industrySelect", e.target.value)}
            >
              {ENTERPRISE_INDUSTRY_OPTIONS.map(o => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          {values.industrySelect === "其他" ? (
            <Field label="自定义行业" required testId="p0-field-industry-custom">
              <Input className={inputClass} value={values.industryCustom} onChange={e => set("industryCustom", e.target.value)} />
            </Field>
          ) : null}
          <Field label="一句话介绍" required testId="p0-field-one-liner">
            <Input
              className={cn(inputClass, "sm:col-span-2")}
              value={values.oneLiner}
              onChange={e => set("oneLiner", e.target.value)}
              placeholder="用一句话说明企业是谁、做什么"
            />
          </Field>
          <Field label="核心产品 / 服务" required testId="p0-field-product">
            <Input className={inputClass} value={values.productDesc} onChange={e => set("productDesc", e.target.value)} />
          </Field>
          <Field label="目标客户" required testId="p0-field-target-customer">
            <Input className={inputClass} value={values.targetCustomer} onChange={e => set("targetCustomer", e.target.value)} />
          </Field>
          <Field label="主要解决的问题" required testId="p0-field-primary-pain">
            <Input
              className={inputClass}
              value={values.primaryPain}
              onChange={e => set("primaryPain", e.target.value)}
              placeholder="客户最常遇到的痛点"
            />
          </Field>
          <Field label="核心优势" required testId="p0-field-core-advantage">
            <Input
              className={inputClass}
              value={values.coreAdvantage}
              onChange={e => set("coreAdvantage", e.target.value)}
              placeholder="相比同行，客户为什么选你"
            />
          </Field>
          <div className="sm:col-span-2" data-testid="p0-field-keywords">
            <Field label="希望被 AI 推荐的关键词" required testId="p0-field-keywords-label">
              <div className="flex flex-wrap gap-2">
                {keywords.map(k => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-700"
                  >
                    {k}
                    <button
                      type="button"
                      className="text-slate-400 hover:text-slate-700"
                      aria-label={`移除 ${k}`}
                      onClick={() => onRemoveKeyword(k)}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <Input
                  className={cn(inputClass, "max-w-[220px]")}
                  value={keywordDraft}
                  onChange={e => onKeywordDraftChange(e.target.value)}
                  placeholder="输入后回车添加"
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onAddKeyword();
                    }
                  }}
                />
                <Button type="button" size="sm" variant="outline" className={geoP0Brand.primaryOutline} onClick={onAddKeyword}>
                  添加
                </Button>
              </div>
            </Field>
          </div>
        </div>
      </div>
    </P0Card>
  );
}
