import { Button } from "@/components/ui/button";
import { MultiValueInput } from "./MultiValueInput";
import type { WizardFormState } from "./WizardStepPanels";
import { extractProfileForQuestionGeneration } from "@shared/geoProfileQuestionMapping";
import {
  emptyQuestionGuideExamples,
  type QuestionGuideExamples,
} from "@shared/onboardingWizardGeoGoalNotes";
import {
  ONBOARDING_QUESTION_GUIDE_CATEGORIES,
  ONBOARDING_QUESTION_GUIDE_MIN_COUNT,
  ONBOARDING_QUESTION_GUIDE_TARGET_MAX,
  ONBOARDING_QUESTION_GUIDE_USAGE_ITEMS,
} from "@shared/onboardingWizardSteps";
import { generateRuleBasedSearchPoolQuestions } from "@shared/searchPoolQuestionGenerator";
import type { SearchPoolQuestionType } from "@shared/questionSearchPool";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Drafts = {
  brandSearchDraft: string;
  categoryRecommendDraft: string;
  sceneNeedDraft: string;
  comparisonDraft: string;
  longTailDraft: string;
};

const DRAFT_KEY_BY_CATEGORY: Record<
  keyof QuestionGuideExamples,
  keyof Drafts
> = {
  brandSearch: "brandSearchDraft",
  categoryRecommend: "categoryRecommendDraft",
  sceneNeed: "sceneNeedDraft",
  comparison: "comparisonDraft",
  longTail: "longTailDraft",
};

const POOL_TYPE_TO_GUIDE_KEY: Partial<Record<SearchPoolQuestionType, keyof QuestionGuideExamples>> = {
  brand_search: "brandSearch",
  category_recommend: "categoryRecommend",
  scene_need: "sceneNeed",
  comparison: "comparison",
  long_tail: "longTail",
};

function resolveIndustryTag(form: WizardFormState): string {
  return form.industrySelect === "其他" ? form.industryCustom.trim() : form.industrySelect.trim();
}

function buildProfileFromForm(form: WizardFormState) {
  return extractProfileForQuestionGeneration({
    profile: {
      brandName: form.brandName,
      enterpriseName: form.enterpriseName,
      industryTag: resolveIndustryTag(form),
      industry: resolveIndustryTag(form),
      productDesc: form.productDesc,
      targetCustomer: form.targetCustomer,
      customerPains: form.customerPains,
      competitors: form.competitors,
      keyPoints: form.keyPoints,
      keywords: form.keywords,
    },
    project: null,
  });
}

function mergeGeneratedGuide(
  current: QuestionGuideExamples,
  generated: QuestionGuideExamples,
): QuestionGuideExamples {
  const next = { ...current };
  for (const category of ONBOARDING_QUESTION_GUIDE_CATEGORIES) {
    const key = category.key;
    const merged = [...next[key]];
    for (const text of generated[key]) {
      const trimmed = text.trim();
      if (trimmed && !merged.includes(trimmed)) merged.push(trimmed);
    }
    next[key] = merged;
  }
  return next;
}

function generateGuideFromProfile(form: WizardFormState): QuestionGuideExamples | null {
  const profile = buildProfileFromForm(form);
  const { questions, readiness } = generateRuleBasedSearchPoolQuestions(profile);
  if (!readiness.ready) {
    toast.error(`请先完善前面步骤的资料：${readiness.missingFields.join("、")}`);
    return null;
  }
  const guide = emptyQuestionGuideExamples();
  for (const item of questions) {
    const key = POOL_TYPE_TO_GUIDE_KEY[item.searchPoolType];
    if (!key) continue;
    const text = item.questionText.trim();
    if (text && !guide[key].includes(text)) guide[key].push(text);
  }
  const hasAny = ONBOARDING_QUESTION_GUIDE_CATEGORIES.some(c => guide[c.key].length > 0);
  if (!hasAny) {
    toast.message(
      "自动生成问题能力正在接入中。你可以先根据下方示例补充关键问题。",
    );
    return null;
  }
  return guide;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-gray-800">{children}</span>;
}

function CountHint({ count }: { count: number }) {
  const base = `建议补充 ${ONBOARDING_QUESTION_GUIDE_MIN_COUNT}-${ONBOARDING_QUESTION_GUIDE_TARGET_MAX} 个，系统会用于生成测试问题和内容任务。`;
  if (count < ONBOARDING_QUESTION_GUIDE_MIN_COUNT) {
    const need = ONBOARDING_QUESTION_GUIDE_MIN_COUNT - count;
    return (
      <p className="text-xs text-amber-700">
        {base} 建议再补充 {need} 个，让 AI 实测覆盖更完整。
      </p>
    );
  }
  return <p className="text-xs text-gray-500">{base}</p>;
}

type Props = {
  form: WizardFormState;
  drafts: Drafts;
  onFormChange: (patch: Partial<WizardFormState>) => void;
  onDraftChange: (patch: Partial<Drafts>) => void;
};

export function WizardQuestionGuideStep({ form, drafts, onFormChange, onDraftChange }: Props) {
  const [generating, setGenerating] = useState(false);

  const addGuide = (guideKey: keyof QuestionGuideExamples, draftKey: keyof Drafts, draft: string) => {
    const t = draft.trim();
    if (!t) return;
    const next = { ...form.questionGuide, [guideKey]: [...form.questionGuide[guideKey], t] };
    onFormChange({ questionGuide: next });
    onDraftChange({ [draftKey]: "" } as Partial<Drafts>);
  };

  const removeGuide = (guideKey: keyof QuestionGuideExamples, value: string) => {
    const next = {
      ...form.questionGuide,
      [guideKey]: form.questionGuide[guideKey].filter(x => x !== value),
    };
    onFormChange({ questionGuide: next });
  };

  const handleAutoGenerate = () => {
    setGenerating(true);
    try {
      const generated = generateGuideFromProfile(form);
      if (!generated) return;
      onFormChange({ questionGuide: mergeGeneratedGuide(form.questionGuide, generated) });
      toast.success("已根据资料生成问题，你可以继续修改、删除或补充。");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="wizard-step-4">
      <section
        className="rounded-xl border border-blue-100 bg-blue-50/60 p-4"
        data-testid="wizard-question-guide-usage"
      >
        <p className="text-sm font-medium text-gray-900">这些问题会用于</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-700">
          {ONBOARDING_QUESTION_GUIDE_USAGE_ITEMS.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>

      <section
        className="rounded-xl border border-gray-200 bg-gray-50 p-4"
        data-testid="wizard-question-auto-generate"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-gray-900">根据前面资料自动生成问题</p>
            <p className="text-sm leading-relaxed text-gray-600">
              系统可以根据品牌实体、品类定位、目标客户和竞品信息，生成一组客户可能会问 AI
              的问题。生成后你可以继续修改、删除或补充。
            </p>
          </div>
          <Button
            type="button"
            variant="default"
            className="shrink-0 bg-blue-600 text-white hover:bg-blue-700"
            data-testid="wizard-question-auto-generate-btn"
            disabled={generating}
            onClick={handleAutoGenerate}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {generating ? "生成中…" : "根据资料生成问题"}
          </Button>
        </div>
      </section>

      <div className="space-y-6">
        {ONBOARDING_QUESTION_GUIDE_CATEGORIES.map(category => {
          const draftKey = DRAFT_KEY_BY_CATEGORY[category.key];
          const values = form.questionGuide[category.key];
          return (
            <section
              key={category.key}
              className="space-y-2 rounded-lg border border-gray-100 bg-white p-4"
              data-testid={`wizard-guide-section-${category.key}`}
            >
              <FieldLabel>{category.label}</FieldLabel>
              <p className="text-sm text-gray-600">{category.description}</p>
              <ul className="space-y-0.5 text-xs text-gray-500">
                {category.examples.map(example => (
                  <li key={example}>· {example}</li>
                ))}
              </ul>
              <CountHint count={values.length} />
              <MultiValueInput
                values={values}
                draft={drafts[draftKey]}
                onDraftChange={v => onDraftChange({ [draftKey]: v } as Partial<Drafts>)}
                onAdd={() => addGuide(category.key, draftKey, drafts[draftKey])}
                onRemove={v => removeGuide(category.key, v)}
                placeholder={category.placeholder}
                testId={`wizard-guide-${category.key}`}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
