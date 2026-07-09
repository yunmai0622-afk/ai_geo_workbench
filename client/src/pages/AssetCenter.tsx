import { AdvancedMaterialsSection } from "@/components/enterpriseProfile/AdvancedMaterialsSection";
import { OnboardingWizardShell } from "@/components/enterpriseProfile/wizard/OnboardingWizardShell";
import { WizardStepFooter } from "@/components/enterpriseProfile/wizard/WizardStepFooter";
import { WizardStepHeader } from "@/components/enterpriseProfile/wizard/WizardStepHeader";
import {
  WizardStepPanels,
  type WizardFormState,
} from "@/components/enterpriseProfile/wizard/WizardStepPanels";
import type { CaseDraft, FaqItem } from "@/components/enterpriseProfile/types";
import {
  parseAdvancedTrustNotes,
  parseFaqText,
  serializeAdvancedTrustNotes,
  serializeFaqItems,
} from "@/components/enterpriseProfile/types";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { useAuth } from "@/_core/hooks/useAuth";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { useMaturityAutoCalculate } from "@/hooks/useMaturityAutoCalculate";
import { buildProjectUrl, getSearchFromLocation } from "@/lib/activeProject";
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
  normalizeWizardTargetPlatforms,
  ONBOARDING_WIZARD_PAGE_SUBTITLE,
  ONBOARDING_WIZARD_PAGE_TITLE,
  ONBOARDING_WIZARD_STEPS,
} from "@shared/onboardingWizardSteps";
import {
  monthlyContentCapacityValueFromOptionId,
  resolveMonthlyContentCapacityOptionId,
} from "@shared/wizardStep8MonthlyContentCapacity";
import {
  buildWizardStep8GeoGoalSuggestions,
  resolveWizardStep8HasAiTestData,
} from "@shared/wizardStep8GeoGoalDisplay";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  PROFILE_CORE_LOAD_FAILED_MESSAGE,
  formatWizardSaveDraftError,
  shouldShowProfileCoreLoadFailure,
} from "@/lib/enterpriseProfileLoadDisplay";

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

function parseKeyPointsFromProfile(p: Record<string, unknown>): string[] {
  const fromArray = parseStringArray(p.keyPoints);
  if (fromArray.length > 0) return fromArray;
  const coreSelling = textField(p.coreSellingPoints);
  if (!coreSelling) return [];
  return coreSelling
    .split(/[；;、\n]/)
    .map(s => s.trim())
    .filter(Boolean);
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
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === "admin";
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

  const [wizardCompleted, setWizardCompleted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const wizardStepHydratedForProjectRef = useRef<number | null>(null);
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
  const [casesChoice, setCasesChoice] = useState<"unset" | "has" | "none">("unset");
  const [authorityText, setAuthorityText] = useState("");
  const [partnersText, setPartnersText] = useState("");
  const [credentialsText, setCredentialsText] = useState("");
  const [mediaText, setMediaText] = useState("");
  const [reviewsText, setReviewsText] = useState("");
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [customerCasesOpen, setCustomerCasesOpen] = useState(false);
  const customerCasesSectionRef = useRef<HTMLDetailsElement | null>(null);

  const upsertProfile = trpc.geo.assetLibrary.upsertProfile.useMutation();
  const createCustomerCase = trpc.geo.assetLibrary.createCustomerCase.useMutation();
  const updateCustomerCase = trpc.geo.assetLibrary.updateCustomerCase.useMutation();
  const deleteCustomerCase = trpc.geo.assetLibrary.deleteCustomerCase.useMutation();
  const { triggerMaturityCalculate } = useMaturityAutoCalculate(currentProjectId);

  const projectInput = useMemo(() => ({ projectId: currentProjectId! }), [currentProjectId]);
  const { data: summaryData, isLoading, isFetched, error: summaryError } = trpc.geo.assetLibrary.summary.useQuery(
    projectInput,
    { enabled: Boolean(currentProjectId), retry: 1 },
  );
  const completenessReportQuery = trpc.geo.onboarding.getCompletenessReport.useQuery(projectInput, {
    enabled: Boolean(currentProjectId),
    retry: 1,
  });
  const workspaceSummaryQuery = trpc.geo.workspace.summary.useQuery(projectInput, {
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
      keyPoints: parseKeyPointsFromProfile(p),
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
      targetPlatforms: normalizeWizardTargetPlatforms(parseStringArray(p.targetPlatforms)),
      targetCompetitorsToBeat: parseStringArray(p.targetCompetitorsToBeat).filter(name =>
        parseStringArray(p.competitors).includes(name),
      ),
      monthlyContentCapacity: resolveMonthlyContentCapacityOptionId(
        typeof p.monthlyContentCapacity === "number" ? p.monthlyContentCapacity : null,
      ),
      internalOwnerName: textField(p.internalOwnerName),
      geoGoalNotes: goalPayload.goalNotes ?? "",
    });

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
    setCasesChoice(cases.length > 0 ? "has" : typeof p.hasCases === "boolean" && !p.hasCases ? "none" : "unset");

    const trustNotes = parseAdvancedTrustNotes(textField(p.featureNotes));
    setAuthorityText(trustNotes.authorityText);
    setPartnersText(trustNotes.partnersText);
    setCredentialsText(trustNotes.credentialsText);
    setMediaText(trustNotes.mediaText);
    setReviewsText(trustNotes.reviewsText);
    setFaqItems(parseFaqText(textField(p.commonObjections)));
  }, [summaryData, currentProject]);

  useEffect(() => {
    wizardStepHydratedForProjectRef.current = null;
    setCurrentStep(1);
    setWizardCompleted(false);
  }, [currentProjectId]);

  useEffect(() => {
    if (!currentProjectId || !isFetched) return;
    hydrateFromProfile();
  }, [hydrateFromProfile, currentProjectId, isFetched]);

  useEffect(() => {
    if (!currentProjectId || !summaryData || wizardStepHydratedForProjectRef.current === currentProjectId) return;
    const search = getSearchFromLocation(location);
    const stepParam = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("step");
    const urlStep = stepParam ? Number.parseInt(stepParam, 10) : Number.NaN;
    if (Number.isFinite(urlStep) && urlStep >= 1 && urlStep <= 8) {
      setCurrentStep(urlStep);
    } else {
      const p = (summaryData.profile ?? {}) as Record<string, unknown>;
      const wizardStep = typeof p.wizardStep === "number" ? p.wizardStep : 0;
      if (wizardStep >= 1 && wizardStep <= 8) setCurrentStep(wizardStep);
    }
    wizardStepHydratedForProjectRef.current = currentProjectId;
  }, [currentProjectId, summaryData, location]);

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

  const trustMaterialCount = useMemo(() => {
    return [authorityText, partnersText, credentialsText, mediaText, reviewsText].filter(text => text.trim()).length;
  }, [authorityText, partnersText, credentialsText, mediaText, reviewsText]);

  const faqFilledCount = useMemo(
    () => faqItems.filter(item => item.question.trim() && item.answer.trim()).length,
    [faqItems],
  );

  const trustStatus = useMemo<"未填写" | "待完善" | "已完成">(() => {
    if (faqItems.some(item => item.question.trim() && item.answer.trim()) || authorityText.trim()) {
      return "已完成";
    }
    if (partnersText.trim() || credentialsText.trim() || mediaText.trim() || reviewsText.trim()) {
      return "待完善";
    }
    return "待完善";
  }, [authorityText, partnersText, credentialsText, mediaText, reviewsText, faqItems]);

  const geoGoalSuggestions = useMemo(() => {
    const ws = workspaceSummaryQuery.data;
    const hasAiTestData = resolveWizardStep8HasAiTestData({
      hasCompletedT0Baseline: ws?.hasCompletedT0Baseline,
      aiTestResultCount: ws?.aiTestResultCount,
      brandMentionRate: ws?.brandMentionRate ?? null,
      recommendRate: ws?.recommendRate ?? null,
    });
    return buildWizardStep8GeoGoalSuggestions({
      brandMentionRate: ws?.brandMentionRate ?? null,
      recommendRate: ws?.recommendRate ?? null,
      hasAiTestData,
    });
  }, [workspaceSummaryQuery.data]);

  useEffect(() => {
    const mentionTarget = geoGoalSuggestions.mention.suggestedTargetPercent;
    const recommendTarget = geoGoalSuggestions.recommend.suggestedTargetPercent;
    setForm(prev => {
      const patch: Partial<WizardFormState> = {};
      if (mentionTarget != null && prev.targetMentionRate !== String(mentionTarget)) {
        patch.targetMentionRate = String(mentionTarget);
      }
      if (recommendTarget != null && prev.targetRecommendationRate !== String(recommendTarget)) {
        patch.targetRecommendationRate = String(recommendTarget);
      }
      if (Object.keys(patch).length === 0) return prev;
      return { ...prev, ...patch };
    });
  }, [geoGoalSuggestions]);

  useEffect(() => {
    setForm(prev => {
      const pruned = prev.targetCompetitorsToBeat.filter(name => prev.competitors.includes(name));
      if (pruned.length === prev.targetCompetitorsToBeat.length) return prev;
      return { ...prev, targetCompetitorsToBeat: pruned };
    });
  }, [form.competitors]);

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
      coreSellingPoints: form.keyPoints.join("；"),
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
      monthlyContentCapacity: monthlyContentCapacityValueFromOptionId(form.monthlyContentCapacity),
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
        monthlyContentCapacity: monthlyContentCapacityValueFromOptionId(form.monthlyContentCapacity),
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
      utils.geo.trustEvidence.getTrustEvidenceSummary.invalidate({ projectId: currentProjectId }),
    ]);
  }

  const buildAdvancedMaterialsPayload = useCallback(() => {
    return {
      ...buildPayload(currentStep),
      featureNotes: serializeAdvancedTrustNotes({
        authorityText,
        partnersText,
        credentialsText,
        mediaText,
        reviewsText,
      }),
      commonObjections: serializeFaqItems(faqItems),
    };
  }, [
    authorityText,
    partnersText,
    credentialsText,
    mediaText,
    reviewsText,
    faqItems,
    buildPayload,
    currentStep,
  ]);

  const handleSaveTrustMaterials = useCallback(async () => {
    if (!currentProjectId) {
      toast.error("请先在客户管理台选择客户项目");
      return;
    }
    try {
      await upsertProfile.mutateAsync(buildAdvancedMaterialsPayload());
      await refreshSummary();
      toast.success("运营素材已保存");
      void triggerMaturityCalculate({ silent: true });
    } catch (e) {
      toast.error(formatWizardSaveDraftError(e));
    }
  }, [buildAdvancedMaterialsPayload, currentProjectId, refreshSummary, triggerMaturityCalculate, upsertProfile]);

  const buildCustomerCasePayload = useCallback(
    (row: CaseDraft) => {
      if (!currentProjectId) throw new Error("请先在客户管理台选择客户项目");
      const customerName = row.customerBackground.trim().slice(0, 255) || "未命名客户";
      return {
        projectId: currentProjectId,
        caseType: row.caseType,
        customerName,
        customerBackground: row.customerBackground.trim() || undefined,
        originalProblem: row.originalProblem.trim() || undefined,
        executionProcess: row.executionProcess.trim() || undefined,
        resultData: row.resultData.trim() || undefined,
        allowPublic: row.allowPublic,
        sourceAssetIds: [] as number[],
        verificationStatus: "待确认" as const,
      };
    },
    [currentProjectId],
  );

  const handleSaveCase = useCallback(
    async (row: CaseDraft, idx: number) => {
      if (!currentProjectId) {
        toast.error("请先在客户管理台选择客户项目");
        return;
      }
      try {
        const payload = buildCustomerCasePayload(row);
        if (row.id) {
          console.info("[enterprise-profile] updateCustomerCase", {
            projectId: currentProjectId,
            caseId: row.id,
            caseType: row.caseType,
          });
          await updateCustomerCase.mutateAsync({ ...payload, id: row.id });
          toast.success("客户案例已更新");
        } else {
          console.info("[enterprise-profile] createCustomerCase", {
            projectId: currentProjectId,
            caseType: row.caseType,
            customerName: payload.customerName,
          });
          const result = await createCustomerCase.mutateAsync(payload);
          if (!result.id) {
            console.error("[enterprise-profile] createCustomerCase returned empty id", {
              projectId: currentProjectId,
              payload,
              result,
            });
            throw new Error("案例保存失败：未获得有效记录 ID");
          }
          setCaseRows(prev => prev.map((item, i) => (i === idx ? { ...item, id: result.id } : item)));
          toast.success("客户案例已保存");
        }
        await refreshSummary();
        void triggerMaturityCalculate({ silent: true });
      } catch (e) {
        console.error("[enterprise-profile] saveCustomerCase failed", {
          projectId: currentProjectId,
          caseId: row.id,
          caseType: row.caseType,
          customerBackground: row.customerBackground.trim(),
          message: e instanceof Error ? e.message : String(e),
          error: e,
        });
        toast.error(e instanceof Error ? e.message : "客户案例保存失败，请稍后重试");
        throw e;
      }
    },
    [buildCustomerCasePayload, createCustomerCase, currentProjectId, triggerMaturityCalculate, updateCustomerCase],
  );

  const handleDeleteCase = useCallback(
    async (idx: number) => {
      if (!currentProjectId) {
        toast.error("请先在客户管理台选择客户项目");
        return;
      }
      const row = caseRows[idx];
      if (!row) return;
      if (!window.confirm("确定删除这条客户案例？")) return;
      try {
        if (row.id) {
          await deleteCustomerCase.mutateAsync({ projectId: currentProjectId, id: row.id });
        }
        setCaseRows(prev => prev.filter((_, i) => i !== idx));
        toast.success("客户案例已删除");
        await refreshSummary();
        void triggerMaturityCalculate({ silent: true });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "客户案例删除失败，请稍后重试");
      }
    },
    [caseRows, currentProjectId, deleteCustomerCase, triggerMaturityCalculate],
  );


  async function persistWizardStep(step: number): Promise<boolean> {
    if (!currentProjectId) {
      toast.error("请先在客户管理台选择客户项目");
      return false;
    }
    const brand = form.brandName.trim() || form.enterpriseName.trim() || currentProject?.enterpriseName || "";
    if (!brand) {
      toast.error("请填写企业名称后再保存");
      return false;
    }
    try {
      const payload = buildPayload(step);
      console.info("[enterprise-profile] saveDraft", { projectId: currentProjectId, wizardStep: step });
      await upsertProfile.mutateAsync(payload);
      await refreshSummary();
      return true;
    } catch (e) {
      const errObj = e as { message?: string; data?: { code?: string; zodError?: unknown } };
      console.error("[enterprise-profile] saveDraft failed", {
        projectId: currentProjectId,
        wizardStep: step,
        enterpriseName: form.enterpriseName.trim() || form.brandName.trim(),
        message: errObj?.message,
        code: errObj?.data?.code,
        zodError: errObj?.data?.zodError,
        error: e,
      });
      toast.error(formatWizardSaveDraftError(e));
      return false;
    }
  }

  async function handleSaveDraftOnly() {
    const ok = await persistWizardStep(currentStep);
    if (ok) toast.success("草稿已保存");
  }

  async function handleSaveAndContinue() {
    const ok = await persistWizardStep(currentStep);
    if (!ok) return;
    void triggerMaturityCalculate({ silent: true });
    toast.success("已保存，继续完善下一步");
    setCurrentStep(step => Math.min(8, step + 1));
  }

  async function handleCompleteWizard() {
    const ok = await persistWizardStep(8);
    if (!ok) return;
    toast.success("建档完成！");
    void triggerMaturityCalculate({ silent: true });
    setWizardCompleted(true);
  }

  const handleManageCustomerCases = useCallback(() => {
    setCustomerCasesOpen(true);
    window.requestAnimationFrame(() => {
      const outerSection = customerCasesSectionRef.current;
      if (outerSection) outerSection.open = true;

      const advancedCollapsed = document.querySelector(
        '[data-testid="advanced-materials-collapsed"]',
      ) as HTMLDetailsElement | null;
      if (advancedCollapsed) advancedCollapsed.open = true;

      const casesFold = document.querySelector('[data-testid="advanced-fold-cases"]') as HTMLDetailsElement | null;
      if (casesFold) casesFold.open = true;

      const target =
        document.getElementById("customer-cases-detail") ??
        document.querySelector('[data-testid="advanced-fold-cases"]');
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      outerSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

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
  const saving = upsertProfile.isPending || createCustomerCase.isPending || updateCustomerCase.isPending || deleteCustomerCase.isPending;
  const stepMeta = ONBOARDING_WIZARD_STEPS.find(s => s.step === currentStep) ?? ONBOARDING_WIZARD_STEPS[0];

  if (!currentProjectId && !projectsLoading) {
    return (
      <div className="space-y-6 pb-12" data-testid="enterprise-profile-page">
        <header className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              运营后台
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              不建议客户第一轮演示
            </span>
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              用于内部交付
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">运营后台｜品牌资料建档</h1>
          <p className="text-sm text-gray-500">
            用于运营团队补齐企业被 AI 识别和信任所需的基础资料，不作为客户第一轮演示页面。
          </p>
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
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            运营后台
          </span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            不建议客户第一轮演示
          </span>
          <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-700">
            用于内部交付
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">运营后台｜品牌资料建档</h1>
        <p className="text-sm text-gray-500">
          用于运营团队补齐企业被 AI 识别和信任所需的基础资料，保留资料填写、案例、信源和发布账号准备能力。
        </p>
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

      {wizardCompleted && currentProjectId ? (
        <div
          className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6"
          data-testid="wizard-completion-panel"
        >
          <p className="text-sm leading-relaxed text-emerald-950">
            建档完成！系统正在计算 AI 品牌成熟度，建议接下来进行 AI 能见度诊断，了解 AI 目前是否推荐你的品牌。
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700"
              data-testid="wizard-completion-go-diagnosis"
              onClick={() => setLocation(buildProjectUrl("/ai-diagnosis", currentProjectId))}
            >
              去做AI现状检测
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="wizard-completion-go-maturity"
              onClick={() => setLocation(buildProjectUrl("/maturity", currentProjectId))}
            >
              查看成熟度
            </Button>
          </div>
        </div>
      ) : null}

      {currentProjectId && !coreProfileLoadFailed ? (
        <>
          <section
            className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-6 shadow-sm"
            data-testid="enterprise-profile-readiness-hero"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold text-blue-700">品牌资料准备 / AI 识别基础建设向导</p>
                <h2 className="mt-2 text-xl font-bold text-gray-950">
                  先让 AI 看懂 {currentProject?.enterpriseName ?? "这个品牌"} 是谁、服务谁、凭什么值得推荐
                </h2>
                <p className="mt-3 text-sm leading-6 text-gray-600">
                  这不是内部资料库，而是后续 AI 能见度诊断、月度优化计划、内容生产与发布和交付报告的基础。资料越清楚，AI 越容易识别同一个品牌并形成推荐理由。
                </p>
              </div>
              <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500">AI 识别基础准备度</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-blue-700">{completionScore}%</p>
                <p className="mt-2 text-xs leading-5 text-gray-500">
                  低于 80% 时，诊断和内容生成容易缺少可靠依据。
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white bg-white/80 p-4">
                <p className="text-xs font-semibold text-gray-500">当前页面回答</p>
                <p className="mt-2 text-sm font-semibold text-gray-900">AI 能不能确认这是同一个品牌？</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">品牌实体、官网、品类定位和公开信源要先统一。</p>
              </div>
              <div className="rounded-xl border border-white bg-white/80 p-4">
                <p className="text-xs font-semibold text-gray-500">本月先补齐</p>
                <p className="mt-2 text-sm font-semibold text-gray-900">客户画像、信任证据、竞品差异</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">这些资料会决定问题池、内容选题和推荐理由。</p>
              </div>
              <div className="rounded-xl border border-white bg-white/80 p-4">
                <p className="text-xs font-semibold text-gray-500">完成后去哪里</p>
                <p className="mt-2 text-sm font-semibold text-gray-900">进入 AI 能见度诊断，建立优化前基线</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">诊断结果会转成本月 3 件可交付服务事项。</p>
              </div>
            </div>
          </section>

          <span id="publish-platform-accounts" className="sr-only" aria-hidden="true" />
          <OnboardingWizardShell
            currentStep={currentStep}
            stepComplete={stepComplete}
            completionScore={completionScore}
            dimensionScores={dimensionScores}
            projectId={currentProjectId}
            onStepSelect={step => setCurrentStep(Math.min(8, Math.max(1, step)))}
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
                geoGoalSuggestions={geoGoalSuggestions}
                onFormChange={patch => setForm(prev => ({ ...prev, ...patch }))}
                onDraftChange={patch => setDrafts(prev => ({ ...prev, ...patch }))}
                onNavigate={path => setLocation(path)}
                onManageCustomerCases={handleManageCustomerCases}
                onGoToStep={step => setCurrentStep(Math.min(8, Math.max(1, step)))}
              />
            </div>
            <WizardStepFooter
              currentStep={currentStep}
              saving={saving}
              onPrev={() => setCurrentStep(s => Math.max(1, s - 1))}
              onSaveDraft={() => void handleSaveDraftOnly()}
              onPrimaryAction={() =>
                void (currentStep >= 8 ? handleCompleteWizard() : handleSaveAndContinue())
              }
            />
          </OnboardingWizardShell>

          {isPlatformAdmin ? (
            <details
              id="customer-cases"
              ref={customerCasesSectionRef}
              open={customerCasesOpen}
              onToggle={e => setCustomerCasesOpen(e.currentTarget.open)}
              className="rounded-xl border border-gray-200 bg-white shadow-sm"
              data-testid="profile-fold-advanced-materials"
            >
              <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-gray-800">
                高级运营素材（仅内部）
              </summary>
              <div className="border-t border-gray-100 p-5">
                <AdvancedMaterialsSection
                  caseCount={caseRows.length}
                  trustCount={trustMaterialCount}
                  faqCount={faqFilledCount}
                  casesChoice={casesChoice}
                  onCasesChoice={setCasesChoice}
                  caseRows={caseRows}
                  onCaseRowsChange={setCaseRows}
                  onSaveCase={handleSaveCase}
                  onSaveChoiceNone={async () => {
                    if (!currentProjectId) {
                      toast.error("请先在客户管理台选择客户项目");
                      return;
                    }
                    try {
                      await upsertProfile.mutateAsync({ ...buildPayload(currentStep), hasCases: false });
                      setCasesChoice("none");
                      await refreshSummary();
                      toast.success("已标记暂不填写案例");
                    } catch (e) {
                      toast.error(formatWizardSaveDraftError(e));
                    }
                  }}
                  onDeleteCase={idx => void handleDeleteCase(idx)}
                  caseStatus="待完善"
                  trustStatus={trustStatus}
                  saving={saving}
                  competitors={form.competitors}
                  competitorDraft={drafts.competitorDraft}
                  onCompetitorDraftChange={value => setDrafts(prev => ({ ...prev, competitorDraft: value }))}
                  onAddCompetitor={() => {
                    const name = drafts.competitorDraft.trim();
                    if (!name || form.competitors.includes(name)) return;
                    setForm(prev => ({ ...prev, competitors: [...prev.competitors, name] }));
                    setDrafts(prev => ({ ...prev, competitorDraft: "" }));
                  }}
                  onRemoveCompetitor={name =>
                    setForm(prev => ({ ...prev, competitors: prev.competitors.filter(item => item !== name) }))
                  }
                  competitorDifferenceText={form.competitorDifference}
                  onCompetitorDifferenceChange={value => setForm(prev => ({ ...prev, competitorDifference: value }))}
                  unfitCustomers={form.unfitCustomers}
                  onUnfitCustomersChange={value => setForm(prev => ({ ...prev, unfitCustomers: value }))}
                  authorityText={authorityText}
                  onAuthorityTextChange={setAuthorityText}
                  partnersText={partnersText}
                  onPartnersTextChange={setPartnersText}
                  credentialsText={credentialsText}
                  onCredentialsTextChange={setCredentialsText}
                  mediaText={mediaText}
                  onMediaTextChange={setMediaText}
                  reviewsText={reviewsText}
                  onReviewsTextChange={setReviewsText}
                  faqItems={faqItems}
                  onFaqItemsChange={setFaqItems}
                  onSaveTrust={() => void handleSaveTrustMaterials()}
                  onSaveCompetitor={() => void handleSaveTrustMaterials()}
                  showCompetitorSection={false}
                />
              </div>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
