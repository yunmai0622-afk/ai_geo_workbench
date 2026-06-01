import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ENTERPRISE_INDUSTRY_OPTIONS } from "@shared/enterpriseProfileIndustry";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { ProfileCompletenessFieldKey } from "@shared/enterpriseProfileCompleteness";

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
  missingFieldKeys?: ProfileCompletenessFieldKey[];
};

const inputClass =
  "h-10 rounded-lg border-gray-200 bg-white text-gray-900 shadow-sm focus-visible:ring-blue-500 placeholder:text-gray-400";

function Field({
  label,
  hint,
  required,
  testId,
  highlightMissing,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  testId: string;
  highlightMissing?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "block space-y-1.5 rounded-lg text-sm transition-colors",
        highlightMissing && "border border-amber-300 bg-amber-50/80 p-3 ring-1 ring-amber-200",
      )}
      data-testid={testId}
      data-missing={highlightMissing ? "true" : undefined}
    >
      <span className="font-medium text-gray-800">
        {label}
        {required ? <span className="ml-1 text-amber-600">*</span> : null}
        {highlightMissing ? (
          <span className="ml-2 text-[11px] font-normal text-amber-700">待填写</span>
        ) : null}
      </span>
      {hint ? <span className="block text-[12px] leading-snug text-gray-400">{hint}</span> : null}
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
  missingFieldKeys = [],
}: Props) {
  const set = (key: keyof FiveMinuteBasicValues, v: string) => onChange({ [key]: v });
  const isMissing = (key: ProfileCompletenessFieldKey) => missingFieldKeys.includes(key);

  return (
    <div className="geo-card p-6" data-testid="five-minute-basic-onboarding" id="profile-basic-five-min">
      <h3 className="text-base font-bold text-gray-900">核心建档字段</h3>
      <p className="mt-1 text-sm text-gray-500">
        填写以下 8 项信息，AI 即可理解你的企业并开始诊断。其余素材可稍后补充。
      </p>

      <div className="mt-6 space-y-5">
        {/* Row 1 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="企业名称" hint="AI 识别品牌的第一依据" required testId="p0-field-brand-name" highlightMissing={isMissing("brandName")}>
            <Input className={inputClass} value={values.brandName} onChange={e => set("brandName", e.target.value)} placeholder="如：海豚知道" />
          </Field>
          <Field label="所属行业" hint="帮助 AI 匹配行业场景" required testId="p0-field-industry" highlightMissing={isMissing("industry")}>
            <select
              className={cn(inputClass, "w-full rounded-lg border px-3")}
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
        </div>

        {values.industrySelect === "其他" ? (
          <Field label="自定义行业" required testId="p0-field-industry-custom" highlightMissing={isMissing("industry")}>
            <Input className={inputClass} value={values.industryCustom} onChange={e => set("industryCustom", e.target.value)} placeholder="请输入行业名称" />
          </Field>
        ) : null}

        {/* Row 2 */}
        <Field label="一句话介绍" hint="AI 回答用户问题时引用的核心描述" required testId="p0-field-one-liner" highlightMissing={isMissing("oneLiner")}>
          <Input
            className={inputClass}
            value={values.oneLiner}
            onChange={e => set("oneLiner", e.target.value)}
            placeholder="用一句话说明企业是谁、做什么、为谁服务"
          />
        </Field>

        {/* Row 3 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="核心产品 / 服务" hint="AI 推荐时会引用的产品描述" required testId="p0-field-product" highlightMissing={isMissing("productDesc")}>
            <Input className={inputClass} value={values.productDesc} onChange={e => set("productDesc", e.target.value)} placeholder="如：企业级 AI 搜索优化 SaaS" />
          </Field>
          <Field label="目标客户" hint="AI 判断推荐场景的依据" required testId="p0-field-target-customer" highlightMissing={isMissing("targetCustomer")}>
            <Input className={inputClass} value={values.targetCustomer} onChange={e => set("targetCustomer", e.target.value)} placeholder="如：中小型 B2B 企业" />
          </Field>
        </div>

        {/* Row 4 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="主要解决的问题" hint="客户最常遇到的痛点" required testId="p0-field-primary-pain" highlightMissing={isMissing("primaryPain")}>
            <Input
              className={inputClass}
              value={values.primaryPain}
              onChange={e => set("primaryPain", e.target.value)}
              placeholder="如：品牌在 AI 搜索中不可见"
            />
          </Field>
          <Field label="核心优势" hint="相比同行，客户为什么选你" required testId="p0-field-core-advantage" highlightMissing={isMissing("coreAdvantage")}>
            <Input
              className={inputClass}
              value={values.coreAdvantage}
              onChange={e => set("coreAdvantage", e.target.value)}
              placeholder="如：一站式 GEO 诊断+内容+发布"
            />
          </Field>
        </div>

        {/* Keywords */}
        <div
          data-testid="p0-field-keywords"
          className={cn(
            isMissing("keywords") && "rounded-lg border border-amber-300 bg-amber-50/80 p-3 ring-1 ring-amber-200",
          )}
          data-missing={isMissing("keywords") ? "true" : undefined}
        >
          <Field label="希望被 AI 推荐的关键词" hint="用户搜索这些词时，AI 应该提到你" required testId="p0-field-keywords-label" highlightMissing={isMissing("keywords")}>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {keywords.map(k => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"
                >
                  {k}
                  <button
                    type="button"
                    className="text-blue-400 hover:text-blue-700"
                    aria-label={`移除 ${k}`}
                    onClick={() => onRemoveKeyword(k)}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <Input
                className={cn(inputClass, "max-w-[200px]")}
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
              <Button type="button" size="sm" variant="outline" className="border-blue-200 text-blue-600 hover:bg-blue-50" onClick={onAddKeyword}>
                添加
              </Button>
            </div>
          </Field>
        </div>
      </div>
    </div>
  );
}
