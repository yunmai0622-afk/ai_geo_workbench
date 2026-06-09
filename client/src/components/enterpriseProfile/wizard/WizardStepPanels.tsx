import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildProjectUrl } from "@/lib/activeProject";
import { ENTERPRISE_INDUSTRY_OPTIONS } from "@shared/enterpriseProfileIndustry";
import { ONBOARDING_TARGET_PLATFORMS } from "@shared/onboardingWizardSteps";
import type { QuestionGuideExamples } from "@shared/onboardingWizardGeoGoalNotes";
import { TrustEvidenceManager } from "@/components/enterpriseProfile/TrustEvidenceManager";
import { MultiValueInput } from "./MultiValueInput";
import { WizardQuestionGuideStep } from "./WizardQuestionGuideStep";

const inputClass = "h-10 rounded-lg border-gray-200 bg-white text-gray-900 shadow-sm";

export type WizardFormState = {
  brandName: string;
  enterpriseName: string;
  shortName: string;
  oneLiner: string;
  officialWebsite: string;
  region: string;
  industrySelect: string;
  industryCustom: string;
  productDesc: string;
  keyPoints: string[];
  keywords: string[];
  targetCustomer: string;
  customerPains: string[];
  fitCustomers: string;
  unfitCustomers: string;
  questionGuide: QuestionGuideExamples;
  competitors: string[];
  competitorDifference: string;
  targetMentionRate: string;
  targetRecommendationRate: string;
  targetPlatforms: string[];
  targetCompetitorsToBeat: string[];
  monthlyContentCapacity: string;
  internalOwnerName: string;
  geoGoalNotes: string;
};

type Drafts = {
  keyPointDraft: string;
  keywordDraft: string;
  painDraft: string;
  competitorDraft: string;
  brandSearchDraft: string;
  categoryRecommendDraft: string;
  sceneNeedDraft: string;
  comparisonDraft: string;
  longTailDraft: string;
  targetCompetitorDraft: string;
};

type Props = {
  step: number;
  form: WizardFormState;
  drafts: Drafts;
  projectId: number;
  customerCaseCount: number;
  trustEvidenceCount: number;
  brandSourceCount: number;
  brandSourcePlatformCount: number;
  onFormChange: (patch: Partial<WizardFormState>) => void;
  onDraftChange: (patch: Partial<Drafts>) => void;
  onNavigate: (path: string) => void;
};

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="text-sm font-medium text-gray-800">
      {children}
      {required ? <span className="ml-1 text-amber-600">*</span> : null}
    </span>
  );
}

export function WizardStepPanels({
  step,
  form,
  drafts,
  projectId,
  customerCaseCount,
  trustEvidenceCount,
  brandSourceCount,
  brandSourcePlatformCount,
  onFormChange,
  onDraftChange,
  onNavigate,
}: Props) {
  const addToList = (key: keyof WizardFormState, draftKey: keyof Drafts, draft: string, max = 20) => {
    const t = draft.trim();
    const list = form[key] as string[];
    if (!t || list.includes(t) || list.length >= max) return;
    onFormChange({ [key]: [...list, t] } as Partial<WizardFormState>);
    onDraftChange({ [draftKey]: "" } as Partial<Drafts>);
  };

  const removeFromList = (key: keyof WizardFormState, value: string) => {
    const list = form[key] as string[];
    onFormChange({ [key]: list.filter(x => x !== value) } as Partial<WizardFormState>);
  };

  if (step === 1) {
    return (
      <div className="space-y-4" data-testid="wizard-step-1">
        <label className="block space-y-1">
          <FieldLabel required>品牌名称</FieldLabel>
          <Input className={inputClass} value={form.brandName} onChange={e => onFormChange({ brandName: e.target.value })} placeholder="海豚知道" />
        </label>
        <label className="block space-y-1">
          <FieldLabel required>公司名称</FieldLabel>
          <Input className={inputClass} value={form.enterpriseName} onChange={e => onFormChange({ enterpriseName: e.target.value })} />
        </label>
        <label className="block space-y-1">
          <FieldLabel>品牌简称</FieldLabel>
          <Input className={inputClass} value={form.shortName} onChange={e => onFormChange({ shortName: e.target.value })} />
        </label>
        <label className="block space-y-1">
          <FieldLabel required>一句话介绍</FieldLabel>
          <Input className={inputClass} value={form.oneLiner} onChange={e => onFormChange({ oneLiner: e.target.value })} />
        </label>
        <label className="block space-y-1">
          <FieldLabel required>官网</FieldLabel>
          <Input className={inputClass} value={form.officialWebsite} onChange={e => onFormChange({ officialWebsite: e.target.value })} placeholder="https://" />
        </label>
        <label className="block space-y-1">
          <FieldLabel>所在城市</FieldLabel>
          <Input className={inputClass} value={form.region} onChange={e => onFormChange({ region: e.target.value })} />
        </label>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-4" data-testid="wizard-step-2">
        <label className="block space-y-1">
          <FieldLabel>所属行业</FieldLabel>
          <select
            className={`${inputClass} w-full rounded-lg border px-3`}
            value={form.industrySelect}
            onChange={e => onFormChange({ industrySelect: e.target.value })}
          >
            {ENTERPRISE_INDUSTRY_OPTIONS.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
        {form.industrySelect === "其他" ? (
          <label className="block space-y-1">
            <FieldLabel>自定义行业</FieldLabel>
            <Input className={inputClass} value={form.industryCustom} onChange={e => onFormChange({ industryCustom: e.target.value })} />
          </label>
        ) : null}
        <label className="block space-y-1">
          <FieldLabel required>核心产品/服务</FieldLabel>
          <Textarea value={form.productDesc} onChange={e => onFormChange({ productDesc: e.target.value })} rows={3} />
        </label>
        <label className="block space-y-1">
          <FieldLabel>主要卖点（最多 5 条）</FieldLabel>
          <MultiValueInput
            values={form.keyPoints}
            draft={drafts.keyPointDraft}
            onDraftChange={v => onDraftChange({ keyPointDraft: v })}
            onAdd={() => addToList("keyPoints", "keyPointDraft", drafts.keyPointDraft, 5)}
            onRemove={v => removeFromList("keyPoints", v)}
            testId="wizard-key-points"
          />
        </label>
        <label className="block space-y-1">
          <FieldLabel>希望被 AI 推荐的品类关键词</FieldLabel>
          <MultiValueInput
            values={form.keywords}
            draft={drafts.keywordDraft}
            onDraftChange={v => onDraftChange({ keywordDraft: v })}
            onAdd={() => addToList("keywords", "keywordDraft", drafts.keywordDraft)}
            onRemove={v => removeFromList("keywords", v)}
            placeholder="知识付费 SaaS、课程交付系统"
            testId="wizard-keywords"
          />
        </label>
        <p className="text-xs text-gray-400">示例：知识付费 SaaS、课程交付系统</p>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="space-y-4" data-testid="wizard-step-3">
        <label className="block space-y-1">
          <FieldLabel required>目标客户描述</FieldLabel>
          <Textarea value={form.targetCustomer} onChange={e => onFormChange({ targetCustomer: e.target.value })} rows={3} />
        </label>
        <label className="block space-y-1">
          <FieldLabel>客户主要痛点</FieldLabel>
          <MultiValueInput
            values={form.customerPains}
            draft={drafts.painDraft}
            onDraftChange={v => onDraftChange({ painDraft: v })}
            onAdd={() => addToList("customerPains", "painDraft", drafts.painDraft)}
            onRemove={v => removeFromList("customerPains", v)}
            testId="wizard-customer-pains"
          />
        </label>
        <label className="block space-y-1">
          <FieldLabel>适合的客户</FieldLabel>
          <Textarea value={form.fitCustomers} onChange={e => onFormChange({ fitCustomers: e.target.value })} rows={2} />
        </label>
        <label className="block space-y-1">
          <FieldLabel>不适合的客户</FieldLabel>
          <Textarea value={form.unfitCustomers} onChange={e => onFormChange({ unfitCustomers: e.target.value })} rows={2} />
        </label>
      </div>
    );
  }

  if (step === 4) {
    return (
      <WizardQuestionGuideStep
        form={form}
        drafts={drafts}
        onFormChange={onFormChange}
        onDraftChange={onDraftChange}
      />
    );
  }

  if (step === 5) {
    return (
      <div className="space-y-4" data-testid="wizard-step-5">
        <label className="block space-y-1">
          <FieldLabel>主要竞品列表</FieldLabel>
          <MultiValueInput
            values={form.competitors}
            draft={drafts.competitorDraft}
            onDraftChange={v => onDraftChange({ competitorDraft: v })}
            onAdd={() => addToList("competitors", "competitorDraft", drafts.competitorDraft)}
            onRemove={v => removeFromList("competitors", v)}
            testId="wizard-competitors"
          />
        </label>
        <label className="block space-y-1">
          <FieldLabel>与竞品的核心差异</FieldLabel>
          <Textarea value={form.competitorDifference} onChange={e => onFormChange({ competitorDifference: e.target.value })} rows={3} />
        </label>
      </div>
    );
  }

  if (step === 6) {
    return (
      <div className="space-y-4" data-testid="wizard-step-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">已录入客户案例</p>
            <p className="mt-1 text-2xl font-bold text-gray-900" data-testid="wizard-case-count">{customerCaseCount}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">已录入信任证据</p>
            <p className="mt-1 text-2xl font-bold text-gray-900" data-testid="wizard-trust-evidence-count">{trustEvidenceCount}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600">信任证据越充分，AI 越有理由推荐你。</p>
        <Button
          type="button"
          variant="outline"
          data-testid="wizard-manage-cases"
          onClick={() => onNavigate(buildProjectUrl("/enterprise-profile", projectId) + "#customer-cases")}
        >
          管理客户案例
        </Button>
        <TrustEvidenceManager projectId={projectId} embedded />
      </div>
    );
  }

  if (step === 7) {
    return (
      <div className="space-y-4" data-testid="wizard-step-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">已录入信源数量</p>
            <p className="mt-1 text-2xl font-bold text-gray-900" data-testid="wizard-source-count">{brandSourceCount}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">覆盖平台数</p>
            <p className="mt-1 text-2xl font-bold text-gray-900" data-testid="wizard-source-platform-count">{brandSourcePlatformCount}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          AI 需要在多个独立平台找到关于你的信息，才会稳定识别和推荐你。
        </p>
        <Button
          type="button"
          variant="outline"
          data-testid="wizard-manage-sources"
          onClick={() => onNavigate(buildProjectUrl("/brand-source-graph", projectId))}
        >
          管理信源图谱
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="wizard-step-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <FieldLabel>目标提及率 %</FieldLabel>
          <Input
            className={inputClass}
            type="number"
            min={0}
            max={100}
            value={form.targetMentionRate}
            onChange={e => onFormChange({ targetMentionRate: e.target.value })}
          />
        </label>
        <label className="block space-y-1">
          <FieldLabel>目标推荐率 %</FieldLabel>
          <Input
            className={inputClass}
            type="number"
            min={0}
            max={100}
            value={form.targetRecommendationRate}
            onChange={e => onFormChange({ targetRecommendationRate: e.target.value })}
          />
        </label>
      </div>
      <label className="block space-y-2">
        <FieldLabel>重点目标平台</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {ONBOARDING_TARGET_PLATFORMS.map(platform => {
            const selected = form.targetPlatforms.includes(platform);
            return (
              <button
                key={platform}
                type="button"
                className={`rounded-full border px-3 py-1 text-xs ${selected ? "border-blue-600 bg-blue-50 text-blue-800" : "border-gray-200 text-gray-600"}`}
                onClick={() => {
                  const next = selected
                    ? form.targetPlatforms.filter(p => p !== platform)
                    : [...form.targetPlatforms, platform];
                  onFormChange({ targetPlatforms: next });
                }}
              >
                {platform}
              </button>
            );
          })}
        </div>
      </label>
      <label className="block space-y-1">
        <FieldLabel>希望超越的竞品</FieldLabel>
        <MultiValueInput
          values={form.targetCompetitorsToBeat}
          draft={drafts.targetCompetitorDraft}
          onDraftChange={v => onDraftChange({ targetCompetitorDraft: v })}
          onAdd={() => addToList("targetCompetitorsToBeat", "targetCompetitorDraft", drafts.targetCompetitorDraft)}
          onRemove={v => removeFromList("targetCompetitorsToBeat", v)}
          testId="wizard-target-competitors"
        />
      </label>
      <label className="block space-y-1">
        <FieldLabel>每月可配合发布内容数</FieldLabel>
        <Input
          className={inputClass}
          type="number"
          min={0}
          value={form.monthlyContentCapacity}
          onChange={e => onFormChange({ monthlyContentCapacity: e.target.value })}
        />
      </label>
      <label className="block space-y-1">
        <FieldLabel>内部负责人</FieldLabel>
        <Input className={inputClass} value={form.internalOwnerName} onChange={e => onFormChange({ internalOwnerName: e.target.value })} />
      </label>
      <label className="block space-y-1">
        <FieldLabel>90 天目标备注</FieldLabel>
        <Textarea value={form.geoGoalNotes} onChange={e => onFormChange({ geoGoalNotes: e.target.value })} rows={4} />
      </label>
    </div>
  );
}
