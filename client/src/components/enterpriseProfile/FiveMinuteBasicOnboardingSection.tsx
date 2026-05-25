import { AiSection } from "@/components/ai/ProductUi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { aiGlassPanel, aiInput, aiOutlineBtn, aiPrimaryBtn } from "@/lib/aiProductUi";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ENTERPRISE_INDUSTRY_OPTIONS } from "@shared/enterpriseProfileIndustry";
import { Loader2, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

export type FiveMinuteBasicValues = {
  brandName: string;
  brandShortName: string;
  industrySelect: string;
  industryCustom: string;
  oneLiner: string;
  productDesc: string;
  sellingPoint1: string;
  sellingPoint2: string;
  sellingPoint3: string;
  targetCustomer: string;
  primaryPain: string;
  commonNeed: string;
  searchQuestion1: string;
  searchQuestion2: string;
  searchQuestion3: string;
  basicCaseBrief: string;
  basicResultData: string;
};

type Props = {
  values: FiveMinuteBasicValues;
  onChange: (patch: Partial<FiveMinuteBasicValues>) => void;
  saving: boolean;
  projectId: number | undefined;
  onSave: () => void | Promise<void>;
};

function StepCard({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(aiGlassPanel, "space-y-4 p-4 md:p-5")} data-testid={`basic-step-${step}`}>
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-sm font-semibold text-cyan-100">
          {step}
        </span>
        <h4 className="text-base font-semibold text-white">{title}</h4>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

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
    <label className="block space-y-1.5 text-sm sm:col-span-1" data-testid={testId}>
      <span className="font-medium text-slate-200">
        {label}
        {required ? <span className="ml-1 text-amber-300/90">*</span> : null}
      </span>
      {children}
    </label>
  );
}

export function FiveMinuteBasicOnboardingSection({ values, onChange, saving, projectId, onSave }: Props) {
  const generateTargetQuestions = trpc.geo.questions.generateTargetQuestions.useMutation();
  const utils = trpc.useUtils();

  const set = (key: keyof FiveMinuteBasicValues, v: string) => onChange({ [key]: v });

  async function handleGenerateMoreQuestions() {
    if (!projectId) {
      toast.error("请先选择企业项目");
      return;
    }
    if (!values.productDesc.trim() && !values.targetCustomer.trim()) {
      toast.error("请先填写「你卖什么」或「卖给谁」后再生成");
      return;
    }
    try {
      await generateTargetQuestions.mutateAsync({ projectId });
      const list = await utils.geo.questions.list.fetch({ projectId });
      const titles = (list ?? [])
        .map(q => (typeof q.questionText === "string" ? q.questionText : "").trim())
        .filter(Boolean)
        .slice(0, 8);
      if (titles.length === 0) {
        toast.message("已提交生成任务，请稍后刷新或手动填写搜索问题");
        return;
      }
      const [a, b, c, ...rest] = titles;
      onChange({
        searchQuestion1: values.searchQuestion1.trim() || a || "",
        searchQuestion2: values.searchQuestion2.trim() || b || "",
        searchQuestion3: values.searchQuestion3.trim() || c || "",
      });
      if (rest.length) toast.success(`已填入 ${Math.min(3, titles.length)} 个搜索问题，另有 ${rest.length} 条可在高级区查看`);
      else toast.success("已填入目标搜索问题");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成失败");
    }
  }

  return (
    <div data-testid="five-minute-basic-onboarding">
    <AiSection
      id="profile-basic-five-min"
      title="5 分钟基础建档"
      description="先填写最少信息，系统即可生成第一批 GEO 内容。后续可继续补充案例和信任素材。"
    >
      <div className="space-y-4">
        <StepCard step={1} title="企业是谁">
          <Field label="企业名称" required testId="p0-field-brand-name">
            <Input className={aiInput} value={values.brandName} onChange={e => set("brandName", e.target.value)} />
          </Field>
          <Field label="品牌简称" testId="p0-field-brand-short">
            <Input className={aiInput} value={values.brandShortName} onChange={e => set("brandShortName", e.target.value)} placeholder="对外常用简称" />
          </Field>
          <Field label="所属行业" required testId="p0-field-industry">
            <select className={aiInput} value={values.industrySelect} onChange={e => set("industrySelect", e.target.value)}>
              {ENTERPRISE_INDUSTRY_OPTIONS.map(o => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          {values.industrySelect === "其他" ? (
            <Field label="自定义行业" required testId="p0-field-industry-custom">
              <Input className={aiInput} value={values.industryCustom} onChange={e => set("industryCustom", e.target.value)} />
            </Field>
          ) : null}
          <Field label="一句话介绍" required testId="p0-field-one-liner">
            <Input
              className={aiInput}
              value={values.oneLiner}
              onChange={e => set("oneLiner", e.target.value)}
              placeholder="用一句话说明你是做什么的"
            />
          </Field>
        </StepCard>

        <StepCard step={2} title="你卖什么">
          <Field label="主营产品 / 服务" required testId="p0-field-product">
            <Input className={aiInput} value={values.productDesc} onChange={e => set("productDesc", e.target.value)} />
          </Field>
          <Field label="核心卖点 1" required testId="p0-field-sp1">
            <Input className={aiInput} value={values.sellingPoint1} onChange={e => set("sellingPoint1", e.target.value)} />
          </Field>
          <Field label="核心卖点 2" testId="p0-field-sp2">
            <Input className={aiInput} value={values.sellingPoint2} onChange={e => set("sellingPoint2", e.target.value)} />
          </Field>
          <Field label="核心卖点 3" testId="p0-field-sp3">
            <Input className={aiInput} value={values.sellingPoint3} onChange={e => set("sellingPoint3", e.target.value)} />
          </Field>
        </StepCard>

        <StepCard step={3} title="卖给谁">
          <Field label="目标客户" required testId="p0-field-target-customer">
            <Input className={aiInput} value={values.targetCustomer} onChange={e => set("targetCustomer", e.target.value)} />
          </Field>
          <Field label="客户最大痛点" required testId="p0-field-primary-pain">
            <Input className={aiInput} value={values.primaryPain} onChange={e => set("primaryPain", e.target.value)} />
          </Field>
          <Field label="客户最常见需求" testId="p0-field-common-need">
            <Input className={aiInput} value={values.commonNeed} onChange={e => set("commonNeed", e.target.value)} />
          </Field>
        </StepCard>

        <StepCard step={4} title="客户会搜什么">
          <Field label="目标搜索问题 1" required testId="p0-field-search-1">
            <Input className={aiInput} value={values.searchQuestion1} onChange={e => set("searchQuestion1", e.target.value)} placeholder="客户可能向 AI 提问的问题" />
          </Field>
          <Field label="目标搜索问题 2" testId="p0-field-search-2">
            <Input className={aiInput} value={values.searchQuestion2} onChange={e => set("searchQuestion2", e.target.value)} />
          </Field>
          <Field label="目标搜索问题 3" testId="p0-field-search-3">
            <Input className={aiInput} value={values.searchQuestion3} onChange={e => set("searchQuestion3", e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={aiOutlineBtn}
              disabled={saving || generateTargetQuestions.isPending}
              data-testid="ai-generate-more-questions"
              onClick={() => void handleGenerateMoreQuestions()}
            >
              {generateTargetQuestions.isPending ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Sparkles className="mr-1 size-3.5" />}
              AI 生成更多问题
            </Button>
          </div>
        </StepCard>

        <StepCard step={5} title="有什么可信证据">
          <Field label="一个客户案例简述（选填）" testId="p0-field-case-brief">
            <Input className={aiInput} value={values.basicCaseBrief} onChange={e => set("basicCaseBrief", e.target.value)} placeholder="谁 + 遇到什么问题" />
          </Field>
          <Field label="一个结果数据（选填）" testId="p0-field-case-result">
            <Input className={aiInput} value={values.basicResultData} onChange={e => set("basicResultData", e.target.value)} placeholder="如：转化率提升 30%" />
          </Field>
        </StepCard>

        <div className="flex justify-end border-t border-white/8 pt-4">
          <Button type="button" className={aiPrimaryBtn} disabled={saving} data-testid="save-basic-onboarding" onClick={() => void onSave()}>
            保存基础建档
          </Button>
        </div>
      </div>
    </AiSection>
    </div>
  );
}
