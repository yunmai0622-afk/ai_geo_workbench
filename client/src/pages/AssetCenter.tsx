import { AdvancedMaterialsSection } from "@/components/enterpriseProfile/AdvancedMaterialsSection";
import { OnboardingWizardShell } from "@/components/enterpriseProfile/wizard/OnboardingWizardShell";
import { WizardStepFooter } from "@/components/enterpriseProfile/wizard/WizardStepFooter";
import { WizardStepHeader } from "@/components/enterpriseProfile/wizard/WizardStepHeader";
import {
  WizardStepPanels,
  type WizardFormState,
} from "@/components/enterpriseProfile/wizard/WizardStepPanels";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { trpc } from "@/lib/trpc";
import {
  ENTERPRISE_INDUSTRY_OPTIONS,
  resolveIndustryFromStored,
} from "@shared/enterpriseProfileIndustry";
import {
  emptyQuestionGuideExamples,
  parseGeoGoalNotesPayload,
} from "@shared/onboardingWizardGeoGoalNotes";
import {
  isWizardStepComplete,
  type OnboardingWizardCompleteness,
} from "@shared/onboardingWizardCompleteness";
import {
  ONBOARDING_WIZARD_PAGE_SUBTITLE,
  ONBOARDING_WIZARD_PAGE_TITLE,
  ONBOARDING_WIZARD_STEPS,
} from "@shared/onboardingWizardSteps";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  PROFILE_CORE_LOAD_FAILED_MESSAGE,
  profileSaveFailureMessage,
  shouldShowProfileCoreLoadFailure,
} from "@/lib/enterpriseProfileLoadDisplay";
import type { CaseDraft } from "@/components/enterpriseProfile/types";

type SummaryLike = {
  profile?: Record<string, unknown> | null;
  completionScore?: number | null;
  wizardCompleteness?: OnboardingWizardCompleteness | null;
  questionGuide?: ReturnType<typeof emptyQuestionGuideExamples> | null;
  customerCases?: Array<Record<string, unknown>>;
  counts?: Record<string, number>;
};

function textField(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function parseStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map(x => x.trim());
  return [];
}

function parseOptionalInt(v: string): number | null {
  const n = Number(v);
  if (!v.trim() || Number.isNaN(n)) return null;
  return Math.round(n);
}

const EMPTY_DRAFTS = {
  keyPointDraft: "",
  keywordDraft: "",
  painDraft: "",
  competitorDraft: "",
  brandSearchDraft: "",
  categoryRecommendDraft: "",
  sceneNeedDraft: "",
  comparisonDraft: "",
  longTailDraft: "",
  targetCompetitorDraft: "",
};

export default function AssetCenterPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const {
    selectedProjectId: currentProjectId,
    selectedProject: activeSelectionProject,
    projects,
    projectsLoading,
  } = useActiveProjectSelection();
  const currentProject = useMemo(
    () => activeSelectionProject ?? (currentProjectId ? projects.find(p => p.id === currentProjectId) : undefined),
    [activeSelectionProject, projects, currentProjectId],
  );

  const [message, setMessage] = useState<string>();
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<WizardFormState>({
    brandName: "",
    enterpriseName: "",
    shortName: "",
    oneLiner: "",
    officialWebsite: "",
    region: "中国",
    industrySelect: ENTERPRISE_INDUSTRY_OPTIONS[0],
    industryCustom: "",
    productDesc: "",
    keyPoints: [],
    keywords: [],
    targetCustomer: "",
    customerPains: [],
    fitCustomers: "",
    unfitCustomers: "",
    questionGuide: emptyQuestionGuideExamples(),
    competitors: [],
    competitorDifference: "",
    targetMentionRate: "",
    targetRecommendationRate: "",
    targetPlatforms: [],
    targetCompetitorsToBeat: [],
    monthlyContentCapacity: "",
    internalOwnerName: "",
    geoGoalNotes: "",
  });
  const [drafts, setDrafts] = useState(EMPTY_DRAFTS);
  const [caseRows, setCaseRows] = useState<CaseDraft[]>([]);

  const upsertProfile = trpc.geo.assetLibrary.upsertProfile.useMutation();

  const projectInput = useMemo(() => ({ projectId: currentProjectId! }), [currentProjectId]);
  const { data: summaryData, isLoading, isFetched, error: summaryError } = trpc.geo.assetLibrary.summary.useQuery(
    projectInput,
    { enabled: Boolean(currentProjectId), retry: 1 },
  );
  const completenessReportQuery = trpc.geo.onboarding.getCompletenessReport.useQuery(projectInput, {
    enabled: Boolean(currentProjectId),
    retry: 1,
  });
  const summary = summaryData as SummaryLike | undefined;
  const profile = summary?.profile ?? null;

  const industryTagValue = form.industrySelect === "其他" ? form.industryCustom.trim() : form.industrySelect;

  const hydrateFromProfile = useCallback(() => {
    if (!summaryData) return;
    const p = (summaryData.profile ?? {}) as Record<string, unknown>;
    const goalPayload = parseGeoGoalNotesPayload(textField(p.geoGoalNotes) || null);
    const guide = summaryData.questionGuide ?? goalPayload.questionGuide ?? emptyQuestionGuideExamples();
    const bn = textField(p.brandName) || textField(p.enterpriseName) || currentProject?.enterpriseName || "";
    const en = textField(p.enterpriseName) || bn;
    const it = textField(p.industryTag) || textField(p.industry);
    const resolved = resolveIndustryFromStored(it);

    setForm({
      brandName: bn,
      enterpriseName: en,
      shortName: textField(p.shortName),
      oneLiner: textField(p.oneLiner),
      officialWebsite: textField(p.officialWebsite),
      region: textField(p.region) || "中国",
      industrySelect: resolved.select,
      industryCustom: resolved.custom,
      productDesc: textField(p.productDesc) || textField(p.productServiceIntro) || textField(p.productIntro),
      keyPoints: parseStringArray(p.keyPoints),
      keywords: parseStringArray(p.keywords),
      targetCustomer: textField(p.targetCustomer) || textField(p.targetCustomers),
      customerPains: parseStringArray(p.customerPains),
      fitCustomers: textField(p.fitCustomers),
      unfitCustomers: textField(p.unfitCustomers),
      questionGuide: guide,
      competitors: parseStringArray(p.competitors),
      competitorDifference: textField(p.competitorDifference),
      targetMentionRate: typeof p.targetMentionRate === "number" ? String(p.targetMentionRate) : "",
      targetRecommendationRate: typeof p.targetRecommendationRate === "number" ? String(p.targetRecommendationRate) : "",
      targetPlatforms: parseStringArray(p.targetPlatforms),
      targetCompetitorsToBeat: parseStringArray(p.targetCompetitorsToBeat),
      monthlyContentCapacity: typeof p.monthlyContentCapacity === "number" ? String(p.monthlyContentCapacity) : "",
      internalOwnerName: textField(p.internalOwnerName),
      geoGoalNotes: goalPayload.goalNotes ?? "",
    });

    const wizardStep = typeof p.wizardStep === "number" ? p.wizardStep : 0;
    if (wizardStep >= 1 && wizardStep <= 8) setCurrentStep(wizardStep);

    const cases = (summaryData.customerCases ?? []) as Array<Record<string, unknown>>;
    setCaseRows(
      cases.map(c => ({
        id: typeof c.id === "number" ? c.id : undefined,
        caseType: (textField(c.caseType) === "真实案例" ? "真实案例" : "待补充案例线索") as CaseDraft["caseType"],
        customerBackground: textField(c.customerBackground),
        originalProblem: textField(c.originalProblem),
        executionProcess: textField(c.executionProcess),
        resultData: textField(c.resultData),
        allowPublic: Boolean(c.allowPublic),
      })),
    );
  }, [summaryData, currentProject]);

  useEffect(() => {
    if (!currentProjectId || !isFetched) return;
    hydrateFromProfile();
  }, [hydrateFromProfile, currentProjectId, isFetched]);

  const wizardCompleteness = summary?.wizardCompleteness;
  const completenessReport = completenessReportQuery.data;
  const completionScore =
    completenessReport?.totalScore ?? wizardCompleteness?.completionScore ?? summary?.completionScore ?? 0;
  const dimensionScores = useMemo(() => {
    const dims = completenessReport?.dimensions;
    if (!dims) return undefined;
    return [
      { step: dims.brandIdentity.step, title: dims.brandIdentity.title, score: dims.brandIdentity.score },
      { step: dims.categoryPositioning.step, title: dims.categoryPositioning.title, score: dims.categoryPositioning.score },
      { step: dims.targetCustomer.step, title: dims.targetCustomer.title, score: dims.targetCustomer.score },
      { step: dims.questionCoverage.step, title: dims.questionCoverage.title, score: dims.questionCoverage.score },
      { step: dims.competitorInfo.step, title: dims.competitorInfo.title, score: dims.competitorInfo.score },
      { step: dims.trustEvidence.step, title: dims.trustEvidence.title, score: dims.trustEvidence.score },
      { step: dims.sourceGraph.step, title: dims.sourceGraph.title, score: dims.sourceGraph.score },
      { step: dims.geoGoal.step, title: dims.geoGoal.title, score: dims.geoGoal.score },
    ];
  }, [completenessReport]);
  const customerCaseCount = summary?.counts?.customerCases ?? 0;
  const trustEvidenceCount = summary?.counts?.trustEvidenceItems ?? 0;
  const brandSourceCount = summary?.counts?.brandSources ?? 0;
  const brandSourcePlatformCount = summary?.counts?.brandSourcePlatforms ?? 0;
  const questionCount = summary?.counts?.questions ?? 0;

  const profileForCompletion = useMemo(
    () => ({
      brandName: form.brandName,
      enterpriseName: form.enterpriseName,
      shortName: form.shortName,
      oneLiner: form.oneLiner,
      officialWebsite: form.officialWebsite,
      region: form.region,
      industryTag: industryTagValue,
      industry: industryTagValue,
      productDesc: form.productDesc,
      keyPoints: form.keyPoints,
      keywords: form.keywords,
      targetCustomer: form.targetCustomer,
      customerPains: form.customerPains,
      fitCustomers: form.fitCustomers,
      unfitCustomers: form.unfitCustomers,
      competitors: form.competitors,
      competitorDifference: form.competitorDifference,
      targetMentionRate: parseOptionalInt(form.targetMentionRate),
      targetRecommendationRate: parseOptionalInt(form.targetRecommendationRate),
      targetPlatforms: form.targetPlatforms,
      targetCompetitorsToBeat: form.targetCompetitorsToBeat,
      monthlyContentCapacity: parseOptionalInt(form.monthlyContentCapacity),
      internalOwnerName: form.internalOwnerName,
      geoGoalNotes: form.geoGoalNotes,
    }),
    [form, industryTagValue],
  );

  const stepComplete = useMemo(() => {
    const ctx = {
      questionCount,
      customerCaseCount,
      brandSourceCount,
      questionGuide: form.questionGuide,
    };
    const map: Record<number, boolean> = {};
    for (let i = 1; i <= 8; i += 1) {
      map[i] = isWizardStepComplete(i, profileForCompletion, ctx);
    }
    return map;
  }, [profileForCompletion, questionCount, customerCaseCount, brandSourceCount, form.questionGuide]);

  const buildPayload = useCallback(
    (wizardStep: number) => {
      if (!currentProjectId) throw new Error("请先在客户管理台选择客户项目");
      const brand = form.brandName.trim() || form.enterpriseName.trim() || currentProject?.enterpriseName || "未命名企业";
      return {
        projectId: currentProjectId,
        enterpriseName: form.enterpriseName.trim() || brand,
        shortName: form.shortName.trim(),
        officialWebsite: form.officialWebsite.trim(),
        industry: industryTagValue,
        region: form.region.trim() || "中国",
        productServiceIntro: form.productDesc.trim(),
        targetCustomers: form.targetCustomer.trim(),
        coreSellingPoints: form.keyPoints.join("；"),
        fitCustomers: form.fitCustomers.trim(),
        unfitCustomers: form.unfitCustomers.trim(),
        salesChannels: [] as string[],
        commonQuestions: [] as string[],
        purchaseDecisionFactors: [] as string[],
        competitorDifference: form.competitorDifference.trim(),
        brandName: form.brandName.trim() || brand,
        industryTag: industryTagValue,
        productDesc: form.productDesc.trim(),
        mainChannel: "",
        targetCustomer: form.targetCustomer.trim(),
        customerPains: form.customerPains,
        competitors: form.competitors,
        oneLiner: form.oneLiner.trim(),
        keyPoints: form.keyPoints,
        keywords: form.keywords,
        wizardStep,
        targetMentionRate: parseOptionalInt(form.targetMentionRate),
        targetRecommendationRate: parseOptionalInt(form.targetRecommendationRate),
        targetPlatforms: form.targetPlatforms,
        targetCompetitorsToBeat: form.targetCompetitorsToBeat,
        monthlyContentCapacity: parseOptionalInt(form.monthlyContentCapacity),
        internalOwnerName: form.internalOwnerName.trim(),
        geoGoalNotes: form.geoGoalNotes.trim(),
        questionGuide: form.questionGuide,
      };
    },
    [currentProjectId, form, industryTagValue, currentProject],
  );

  async function refreshSummary() {
    if (!currentProjectId) return;
    await Promise.all([
      utils.geo.projects.list.invalidate(),
      utils.geo.assetLibrary.summary.invalidate({ projectId: currentProjectId }),
      utils.geo.workspace.summary.invalidate({ projectId: currentProjectId }),
      utils.geo.onboarding.getCompletenessReport.invalidate({ projectId: currentProjectId }),
    ]);
  }

  async function saveDraft(step = currentStep) {
    setMessage(undefined);
    try {
      await upsertProfile.mutateAsync(buildPayload(step));
      await refreshSummary();
      setMessage("草稿已保存。");
    } catch (e) {
      toast.error(profileSaveFailureMessage(toUserFacingErrorFromUnknown(e, "保存失败")));
    }
  }

  const hasRenderableProfile = Boolean(
    form.brandName.trim() || form.oneLiner.trim() || form.productDesc.trim() || completionScore > 0,
  );
  const coreProfileLoadFailed = shouldShowProfileCoreLoadFailure({
    summaryError: Boolean(summaryError),
    hasSummaryData: Boolean(summaryData),
    isFetched,
    hasRenderableProfile,
  });

  const loading = projectsLoading || isLoading;
  const saving = upsertProfile.isPending;
  const stepMeta = ONBOARDING_WIZARD_STEPS.find(s => s.step === currentStep) ?? ONBOARDING_WIZARD_STEPS[0];

  if (!currentProjectId && !projectsLoading) {
    return (
      <div className="space-y-6 pb-12" data-testid="enterprise-profile-page">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">{ONBOARDING_WIZARD_PAGE_TITLE}</h1>
          <p className="text-sm text-gray-500">{ONBOARDING_WIZARD_PAGE_SUBTITLE}</p>
        </header>
        <ProjectContextEmptyState
          description="品牌资产建档必须归属一个客户项目。请先到客户管理台选择或新建客户项目。"
          testId="enterprise-profile-empty"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12" data-testid="enterprise-profile-page">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">{ONBOARDING_WIZARD_PAGE_TITLE}</h1>
        <p className="text-sm text-gray-500">{ONBOARDING_WIZARD_PAGE_SUBTITLE}</p>
      </header>

      {loading ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
          <Spinner className="size-6 text-blue-600" />
          <p className="text-sm text-gray-400">正在加载…</p>
        </div>
      ) : null}

      {!loading && coreProfileLoadFailed ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-800"
          role="alert"
          data-testid="enterprise-profile-core-load-failed"
        >
          <p>{PROFILE_CORE_LOAD_FAILED_MESSAGE}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => void refreshSummary()}>
            刷新重试
          </Button>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{message}</div>
      ) : null}

      {currentProjectId && !coreProfileLoadFailed ? (
        <>
          <span id="publish-platform-accounts" className="sr-only" aria-hidden="true" />
          <OnboardingWizardShell
            currentStep={currentStep}
            stepComplete={stepComplete}
            completionScore={completionScore}
            dimensionScores={dimensionScores}
            onStepSelect={setCurrentStep}
          >
            <WizardStepHeader meta={stepMeta} />
            <div className="mt-6">
              <WizardStepPanels
                step={currentStep}
                form={form}
                drafts={drafts}
                projectId={currentProjectId}
                customerCaseCount={customerCaseCount}
                trustEvidenceCount={trustEvidenceCount}
                brandSourceCount={brandSourceCount}
                brandSourcePlatformCount={brandSourcePlatformCount}
                onFormChange={patch => setForm(prev => ({ ...prev, ...patch }))}
                onDraftChange={patch => setDrafts(prev => ({ ...prev, ...patch }))}
                onNavigate={path => setLocation(path)}
              />
            </div>
            <WizardStepFooter
              currentStep={currentStep}
              saving={saving}
              onPrev={() => setCurrentStep(s => Math.max(1, s - 1))}
              onNext={() => setCurrentStep(s => Math.min(8, s + 1))}
              onSaveDraft={() => void saveDraft(currentStep)}
            />
          </OnboardingWizardShell>

          <details id="customer-cases" className="rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="profile-fold-advanced-materials">
            <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-gray-800">客户案例管理（高级）</summary>
            <div className="border-t border-gray-100 p-5">
              <AdvancedMaterialsSection
                caseCount={caseRows.length}
                trustCount={0}
                faqCount={0}
                casesChoice={caseRows.length > 0 ? "has" : "unset"}
                onCasesChoice={() => undefined}
                caseRows={caseRows}
                onCaseRowsChange={setCaseRows}
                onSaveCase={async () => undefined}
                onSaveChoiceNone={async () => undefined}
                onDeleteCase={() => undefined}
                caseStatus="待完善"
                trustStatus="待完善"
                saving={saving}
                competitors={form.competitors}
                competitorDraft=""
                onCompetitorDraftChange={() => undefined}
                onAddCompetitor={() => undefined}
                onRemoveCompetitor={() => undefined}
                competitorDifferenceText={form.competitorDifference}
                onCompetitorDifferenceChange={() => undefined}
                unfitCustomers={form.unfitCustomers}
                onUnfitCustomersChange={() => undefined}
                authorityText=""
                onAuthorityTextChange={() => undefined}
                partnersText=""
                onPartnersTextChange={() => undefined}
                credentialsText=""
                onCredentialsTextChange={() => undefined}
                mediaText=""
                onMediaTextChange={() => undefined}
                reviewsText=""
                onReviewsTextChange={() => undefined}
                faqItems={[]}
                onFaqItemsChange={() => undefined}
                onSaveTrust={() => undefined}
                onSaveCompetitor={() => undefined}
                showCompetitorSection={false}
              />
            </div>
          </details>
        </>
      ) : null}
    </div>
  );
}
