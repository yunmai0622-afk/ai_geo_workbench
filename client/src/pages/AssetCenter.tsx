import { AdvancedMaterialsSection } from "@/components/enterpriseProfile/AdvancedMaterialsSection";
import {
  FiveMinuteBasicOnboardingSection,
  type FiveMinuteBasicValues,
} from "@/components/enterpriseProfile/FiveMinuteBasicOnboardingSection";
import { ProfileAiUnderstandingPreview } from "@/components/enterpriseProfile/ProfileAiUnderstandingPreview";
import { ProfilePublishEnvLightHint } from "@/components/enterpriseProfile/ProfilePublishEnvLightHint";
import { ProfileUploadAssistSection } from "@/components/enterpriseProfile/ProfileUploadAssistSection";
import type { ProfileApplyPatch } from "@/components/enterpriseProfile/ProfileIntakePanel";
import {
  parseFaqText,
  serializeFaqItems,
  type CaseDraft,
  type FaqItem,
  type SectionStatusTone,
} from "@/components/enterpriseProfile/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { geoP0Brand } from "@/lib/geoP0Visual";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { useActiveProjectId } from "@/hooks/useActiveProject";
import { buildProjectUrl } from "@/lib/activeProject";
import { trpc } from "@/lib/trpc";
import {
  ENTERPRISE_INDUSTRY_OPTIONS,
  resolveIndustryFromStored,
} from "@shared/enterpriseProfileIndustry";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SummaryLike = {
  profile?: Record<string, unknown> | null;
  completionScore?: number | null;
  customerCases?: Array<Record<string, unknown>>;
  counts?: Record<string, number>;
};

function textField(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function parseStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map(x => x.trim());
  if (typeof v === "string" && v.trim()) {
    try {
      const j = JSON.parse(v) as unknown;
      if (Array.isArray(j)) return j.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map(x => x.trim());
    } catch {
      /* ignore */
    }
  }
  return [];
}

function boolField(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  return undefined;
}

function joinListField(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
}

/** 与 `geo.assetLibrary.upsertProfile` 输入对齐的完整载荷 */
function buildFullProfilePayload(
  projectId: number,
  profile: Record<string, unknown> | null | undefined,
  projectRow: { enterpriseName: string } | undefined,
  v: {
    brandName: string;
    industryTag: string;
    productDesc: string;
    mainChannel: string;
    targetCustomer: string;
    customerPains: string[];
    competitors: string[];
    oneLiner: string;
    shortName?: string;
    keyPoints: string[];
    keywords: string[];
    hasCases?: boolean;
    officialWebsite?: string;
    region?: string;
    fitCustomers?: string;
    purchaseDecisionFactors?: string[];
    commonQuestions?: string[];
    coreSellingPoints?: string;
    servicePriceRange?: string;
    competitorDifference?: string;
    featureNotes?: string;
    commonObjections?: string;
  },
) {
  const p = profile ?? {};
  const leg = (k: string, fallback = "") => (typeof p[k] === "string" ? (p[k] as string) : fallback);
  const legList = (k: string) => joinListField(p[k]);
  const brand = v.brandName.trim() || leg("enterpriseName") || projectRow?.enterpriseName || "";
  const industryTag = v.industryTag.trim() || leg("industry");
  const productDesc = v.productDesc.trim() || leg("productServiceIntro") || leg("productIntro");
  const targetCustomer = v.targetCustomer.trim() || leg("targetCustomers");

  return {
    projectId,
    enterpriseName: brand,
    shortName: v.shortName?.trim() || leg("shortName"),
    officialWebsite: v.officialWebsite?.trim() || leg("officialWebsite"),
    industry: industryTag,
    region: v.region?.trim() || leg("region", "中国"),
    productServiceIntro: productDesc,
    targetCustomers: targetCustomer,
    coreSellingPoints: v.coreSellingPoints?.trim() || leg("coreSellingPoints"),
    servicePriceRange: v.servicePriceRange?.trim() || leg("servicePriceRange"),
    serviceModel: leg("serviceModel"),
    fitCustomers: v.fitCustomers?.trim() || leg("fitCustomers"),
    unfitCustomers: leg("unfitCustomers"),
    salesChannels: legList("salesChannels").length ? legList("salesChannels") : [],
    commonQuestions: v.commonQuestions?.length ? v.commonQuestions : legList("commonQuestions").length ? legList("commonQuestions") : [],
    purchaseDecisionFactors: v.purchaseDecisionFactors?.length
      ? v.purchaseDecisionFactors
      : legList("purchaseDecisionFactors").length
        ? legList("purchaseDecisionFactors")
        : [],
    productIntro: leg("productIntro"),
    featureNotes: v.featureNotes?.trim() || leg("featureNotes"),
    serviceProcess: leg("serviceProcess"),
    deliveryPlan: leg("deliveryPlan"),
    afterSalesService: leg("afterSalesService"),
    competitorDifference: v.competitorDifference?.trim() || leg("competitorDifference"),
    priceExplanation: leg("priceExplanation"),
    salesTalkTracks: leg("salesTalkTracks"),
    commonObjections: v.commonObjections?.trim() || leg("commonObjections"),
    brandName: v.brandName.trim() || brand,
    industryTag: v.industryTag.trim(),
    productDesc: v.productDesc.trim(),
    mainChannel: v.mainChannel.trim(),
    targetCustomer: v.targetCustomer.trim(),
    customerPains: v.customerPains,
    competitors: v.competitors,
    oneLiner: v.oneLiner.trim(),
    keyPoints: v.keyPoints,
    keywords: v.keywords,
    ...(v.hasCases !== undefined ? { hasCases: v.hasCases } : {}),
  };
}

function parseFitCustomersMeta(fit: string) {
  const tags: string[] = [];
  let industry = "";
  let scale = "";
  for (const part of fit.split("|").map(s => s.trim()).filter(Boolean)) {
    if (part.startsWith("行业:")) industry = part.slice(3).trim();
    else if (part.startsWith("规模:")) scale = part.slice(3).trim();
    else tags.push(...part.split(/[、,，]/).map(s => s.trim()).filter(Boolean));
  }
  if (!industry && !scale && tags.length === 0 && fit.trim()) {
    return { tags: fit.split(/[、,，]/).map(s => s.trim()).filter(Boolean), industry: "", scale: "" };
  }
  return { tags, industry, scale };
}

function buildFitCustomersValue(tags: string[], industry: string, scale: string) {
  const base = tags.join("、");
  const meta = [industry.trim() ? `行业:${industry.trim()}` : "", scale.trim() ? `规模:${scale.trim()}` : ""].filter(Boolean);
  if (!meta.length) return base;
  return base ? `${base}|${meta.join("|")}` : meta.join("|");
}

export default function AssetCenterPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = trpc.geo.projects.list.useQuery();
  const { activeProjectId } = useActiveProjectId();
  const currentProjectId = useMemo(() => {
    if (!activeProjectId || projectsLoading) return undefined;
    return projects.some(p => p.id === activeProjectId) ? activeProjectId : undefined;
  }, [activeProjectId, projects, projectsLoading]);
  const currentProject = useMemo(
    () => (currentProjectId ? projects.find(p => p.id === currentProjectId) : undefined),
    [projects, currentProjectId],
  );
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const [brandName, setBrandName] = useState("");
  const [brandShortName, setBrandShortName] = useState("");
  const [industrySelect, setIndustrySelect] = useState<string>(ENTERPRISE_INDUSTRY_OPTIONS[0]);
  const [industryCustom, setIndustryCustom] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [mainChannel, setMainChannel] = useState("");

  const [targetCustomer, setTargetCustomer] = useState("");
  const [customerPains, setCustomerPains] = useState<string[]>([]);
  const [painDraft, setPainDraft] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorDraft, setCompetitorDraft] = useState("");

  const [oneLiner, setOneLiner] = useState("");
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keyPointDraft, setKeyPointDraft] = useState("");
  const [keywordDraft, setKeywordDraft] = useState("");

  const [casesChoice, setCasesChoice] = useState<"unset" | "has" | "none">("unset");
  const [caseRows, setCaseRows] = useState<CaseDraft[]>([]);
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(() => new Set());
  const [officialWebsite, setOfficialWebsite] = useState("");
  const [region, setRegion] = useState("中国");
  const [customerTypeTags, setCustomerTypeTags] = useState<string[]>([]);
  const [customerTypeDraft, setCustomerTypeDraft] = useState("");
  const [purchaseTriggers, setPurchaseTriggers] = useState<string[]>([]);
  const [purchaseTriggerDraft, setPurchaseTriggerDraft] = useState("");
  const [commonQuestionsList, setCommonQuestionsList] = useState<string[]>([]);
  const [commonQuestionDraft, setCommonQuestionDraft] = useState("");
  const [customerIndustry, setCustomerIndustry] = useState("");
  const [customerScale, setCustomerScale] = useState("");
  const [decisionFocusList, setDecisionFocusList] = useState<string[]>([]);
  const [decisionFocusDraft, setDecisionFocusDraft] = useState("");
  const [objectionList, setObjectionList] = useState<string[]>([]);
  const [objectionDraft, setObjectionDraft] = useState("");
  const [serviceProcess, setServiceProcess] = useState("");
  const [servicePriceRange, setServicePriceRange] = useState("");
  const [unfitCustomers, setUnfitCustomers] = useState("");
  const [competitorDifferenceText, setCompetitorDifferenceText] = useState("");
  const [authorityText, setAuthorityText] = useState("");
  const [partnersText, setPartnersText] = useState("");
  const [credentialsText, setCredentialsText] = useState("");
  const [mediaText, setMediaText] = useState("");
  const [reviewsText, setReviewsText] = useState("");
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  // publishEnvRef removed - publish env config moved to /content-publishing
  const intakeSectionRef = useRef<HTMLDivElement>(null);
  const basicSectionRef = useRef<HTMLDivElement>(null);

  const upsertProfile = trpc.geo.assetLibrary.upsertProfile.useMutation();
  const createCustomerCase = trpc.geo.assetLibrary.createCustomerCase.useMutation();
  const updateCustomerCase = trpc.geo.assetLibrary.updateCustomerCase.useMutation();

  const projectInput = useMemo(() => ({ projectId: currentProjectId! }), [currentProjectId]);
  const { data: summaryData, isLoading, isFetched, error: summaryError } = trpc.geo.assetLibrary.summary.useQuery(
    projectInput,
    { enabled: Boolean(currentProjectId) },
  );
  const platformAccountsQuery = trpc.geo.platformAccounts.list.useQuery(
    { projectId: currentProjectId! },
    { enabled: Boolean(currentProjectId) },
  );
  const summary = summaryData as SummaryLike | undefined;
  const profile = summary?.profile ?? null;

  const industryTagValue = industrySelect === "其他" ? industryCustom.trim() : industrySelect;
  const hydrateFromProfile = useCallback(() => {
    if (!summaryData) return;
    const p = (summaryData.profile ?? {}) as Record<string, unknown>;
    const bn = textField(p.brandName) || textField(p.enterpriseName) || currentProject?.enterpriseName || "";
    setBrandName(bn);
    setBrandShortName(textField(p.shortName));
    const it = textField(p.industryTag) || textField(p.industry);
    const resolved = resolveIndustryFromStored(it);
    setIndustrySelect(resolved.select);
    setIndustryCustom(resolved.custom);
    setProductDesc(textField(p.productDesc) || textField(p.productServiceIntro) || textField(p.productIntro));
    setMainChannel(textField(p.mainChannel));
    setTargetCustomer(textField(p.targetCustomer) || textField(p.targetCustomers));
    const pains = parseStringArray(p.customerPains);
    setCustomerPains(pains.length ? pains : []);
    setCompetitors(parseStringArray(p.competitors));
    const nextOne = textField(p.oneLiner);
    const nextKp = parseStringArray(p.keyPoints);
    const nextKw = parseStringArray(p.keywords);
    setOneLiner(prev => {
      const written = nextOne ? nextOne : prev;
      return written;
    });
    setKeyPoints(prev => (nextKp.length > 0 ? nextKp : prev));
    setKeywords(prev => (nextKw.length > 0 ? nextKw : prev));
    const hc = boolField(p.hasCases);
    if (hc === true) setCasesChoice("has");
    else if (hc === false) setCasesChoice("none");
    else setCasesChoice("unset");

    const cases = (summaryData.customerCases ?? []) as Array<Record<string, unknown>>;
    setOfficialWebsite(textField(p.officialWebsite));
    setRegion(textField(p.region) || "中国");
    const fitParsed = parseFitCustomersMeta(textField(p.fitCustomers));
    setCustomerTypeTags(fitParsed.tags);
    setCustomerIndustry(fitParsed.industry);
    setCustomerScale(fitParsed.scale);
    setPurchaseTriggers(joinListField(p.purchaseDecisionFactors));
    setDecisionFocusList(
      textField(p.deliveryPlan)
        ? textField(p.deliveryPlan)
            .split(/\n/)
            .map(s => s.trim())
            .filter(Boolean)
        : [],
    );
    setObjectionList(
      textField(p.salesTalkTracks)
        ? textField(p.salesTalkTracks)
            .split(/\n/)
            .map(s => s.trim())
            .filter(Boolean)
        : [],
    );
    setCommonQuestionsList(joinListField(p.commonQuestions));
    setServiceProcess(textField(p.serviceProcess));
    setServicePriceRange(textField(p.servicePriceRange));
    setUnfitCustomers(textField(p.unfitCustomers));
    setCompetitorDifferenceText(textField(p.competitorDifference));
    setAuthorityText(textField(p.featureNotes) || textField(p.coreSellingPoints));
    setPartnersText(textField(p.fitCustomers));
    setCredentialsText(textField(p.salesTalkTracks));
    setMediaText("");
    setReviewsText("");
    setFaqItems(parseFaqText(textField(p.commonObjections)));

    setCaseRows(
      cases.map(c => ({
        id: typeof c.id === "number" ? c.id : undefined,
        caseType: (textField(c.caseType) === "真实案例" ? "真实案例" : "待补充案例线索") as CaseDraft["caseType"],
        customerBackground: textField(c.customerBackground),
        originalProblem: textField(c.originalProblem),
        executionProcess: textField(c.executionProcess),
        resultData: textField(c.resultData),
        allowPublic: boolField(c.allowPublic) ?? false,
      })),
    );
  }, [summaryData, currentProject]);

  useEffect(() => {
    setAiFilledFields(new Set());
  }, [currentProjectId]);

  function handleApplyAnalysis(patch: ProfileApplyPatch) {
    if (patch.brandName) setBrandName(patch.brandName);
    if (patch.industrySelect) {
      setIndustrySelect(patch.industrySelect);
      setIndustryCustom(patch.industryCustom ?? "");
    }
    if (patch.productDesc) setProductDesc(patch.productDesc);
    if (patch.mainChannel) setMainChannel(patch.mainChannel);
    if (patch.targetCustomer) setTargetCustomer(patch.targetCustomer);
    if (patch.customerPains) setCustomerPains(patch.customerPains);
    if (patch.competitors) setCompetitors(patch.competitors);
    if (patch.caseDraft) {
      setCasesChoice("has");
      setCaseRows(prev => {
        if (prev.length === 0) {
          return [
            {
              caseType: "待补充案例线索",
              customerBackground: patch.caseDraft!.customerBackground,
              originalProblem: "",
              executionProcess: patch.caseDraft!.executionProcess,
              resultData: patch.caseDraft!.resultData,
              allowPublic: false,
            },
          ];
        }
        return prev.map((r, i) =>
          i === 0
            ? {
                ...r,
                customerBackground: patch.caseDraft!.customerBackground || r.customerBackground,
                executionProcess: patch.caseDraft!.executionProcess || r.executionProcess,
                resultData: patch.caseDraft!.resultData || r.resultData,
              }
            : r,
        );
      });
    }
    setAiFilledFields(new Set(patch.aiFilledKeys));
    setMessage("AI 识别结果已填入表单，请核对各区块后点击保存。");
    basicSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const fiveMinuteValues: FiveMinuteBasicValues = useMemo(
    () => ({
      brandName,
      industrySelect,
      industryCustom,
      oneLiner,
      productDesc,
      targetCustomer,
      primaryPain: customerPains[0] ?? "",
      coreAdvantage: keyPoints[0] ?? "",
    }),
    [brandName, industrySelect, industryCustom, oneLiner, productDesc, targetCustomer, customerPains, keyPoints],
  );

  const aiPreviewModel = useMemo(
    () => ({
      brandName: brandName.trim() || currentProject?.enterpriseName || "",
      industry: industryTagValue,
      oneLiner: oneLiner.trim(),
      productDesc: productDesc.trim(),
      targetCustomer: targetCustomer.trim(),
      primaryPain: customerPains[0]?.trim() ?? "",
      coreAdvantage: keyPoints[0]?.trim() ?? "",
      keywords: keywords.filter(Boolean),
    }),
    [
      brandName,
      currentProject?.enterpriseName,
      industryTagValue,
      oneLiner,
      productDesc,
      targetCustomer,
      customerPains,
      keyPoints,
      keywords,
    ],
  );

  function applyFiveMinutePatch(patch: Partial<FiveMinuteBasicValues>) {
    if (patch.brandName !== undefined) setBrandName(patch.brandName);
    if (patch.industrySelect !== undefined) setIndustrySelect(patch.industrySelect);
    if (patch.industryCustom !== undefined) setIndustryCustom(patch.industryCustom);
    if (patch.oneLiner !== undefined) setOneLiner(patch.oneLiner);
    if (patch.productDesc !== undefined) setProductDesc(patch.productDesc);
    if (patch.targetCustomer !== undefined) setTargetCustomer(patch.targetCustomer);
    if (patch.primaryPain !== undefined) setCustomerPains(patch.primaryPain.trim() ? [patch.primaryPain] : []);
    if (patch.coreAdvantage !== undefined) {
      setKeyPoints(patch.coreAdvantage.trim() ? [patch.coreAdvantage] : []);
    }
  }

  function addKeyword() {
    const t = keywordDraft.trim();
    if (!t || keywords.includes(t)) return;
    setKeywords([...keywords, t]);
    setKeywordDraft("");
  }

  function removeKeyword(k: string) {
    setKeywords(keywords.filter(x => x !== k));
  }

  const trustMaterialCount = useMemo(() => {
    let n = 0;
    if (partnersText.trim()) n += 1;
    if (credentialsText.trim()) n += 1;
    if (mediaText.trim()) n += 1;
    if (reviewsText.trim()) n += 1;
    if (authorityText.trim()) n += 1;
    return n;
  }, [partnersText, credentialsText, mediaText, reviewsText, authorityText]);

  const faqFilledCount = useMemo(
    () => faqItems.filter(f => f.question.trim() && f.answer.trim()).length,
    [faqItems],
  );

  const enabledPlatformAccountCount = useMemo(() => {
    const groups = (platformAccountsQuery.data?.accounts ?? []) as Array<{ accounts: Array<{ isEnabled: boolean }> }>;
    return groups.reduce((n, g) => n + g.accounts.filter(a => a.isEnabled).length, 0);
  }, [platformAccountsQuery.data]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (typeof window === "undefined" || !currentProjectId) return;
    const hash = window.location.hash.replace(/^#/, "");
    if (hash === "platform-accounts" || hash === "profile-publish-env") {
      requestAnimationFrame(() => scrollToSection("profile-publish-env"));
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (!currentProjectId || !isFetched) return;
    hydrateFromProfile();
  }, [hydrateFromProfile, currentProjectId, isFetched]);

  const basePayload = useCallback(() => {
    if (!currentProjectId) throw new Error("请先在客户管理台选择客户项目");
    return buildFullProfilePayload(currentProjectId, profile, currentProject, {
      brandName,
      shortName: brandShortName,
      industryTag: industryTagValue,
      productDesc,
      mainChannel,
      targetCustomer,
      customerPains,
      competitors,
      oneLiner,
      keyPoints,
      keywords,
      officialWebsite,
      region,
      fitCustomers: buildFitCustomersValue(customerTypeTags, customerIndustry, customerScale),
      purchaseDecisionFactors: purchaseTriggers,
      commonQuestions: commonQuestionsList,
      coreSellingPoints: keyPoints.join("；") || oneLiner,
      servicePriceRange: servicePriceRange.trim(),
      competitorDifference: competitorDifferenceText.trim(),
      featureNotes: [partnersText, credentialsText, mediaText, reviewsText].filter(Boolean).join("\n"),
      commonObjections: serializeFaqItems(faqItems),
    });
  }, [
    currentProjectId,
    profile,
    currentProject,
    brandName,
    brandShortName,
    industryTagValue,
    productDesc,
    mainChannel,
    targetCustomer,
    customerPains,
    competitors,
    oneLiner,
    keyPoints,
    keywords,
    officialWebsite,
    region,
    customerTypeTags,
    customerIndustry,
    customerScale,
    purchaseTriggers,
    decisionFocusList,
    objectionList,
    commonQuestionsList,
    servicePriceRange,
    competitorDifferenceText,
    authorityText,
    partnersText,
    credentialsText,
    mediaText,
    reviewsText,
    faqItems,
    keyPoints,
    oneLiner,
  ]);

  const basePayloadWithExtras = useCallback(() => {
    const p = basePayload();
    return {
      ...p,
      serviceProcess: serviceProcess.trim() || (typeof profile?.serviceProcess === "string" ? profile.serviceProcess : ""),
      unfitCustomers: unfitCustomers.trim() || (typeof profile?.unfitCustomers === "string" ? profile.unfitCustomers : ""),
      deliveryPlan: decisionFocusList.join("\n") || (typeof profile?.deliveryPlan === "string" ? profile.deliveryPlan : ""),
      salesTalkTracks: objectionList.join("\n") || (typeof profile?.salesTalkTracks === "string" ? profile.salesTalkTracks : ""),
    };
  }, [basePayload, serviceProcess, unfitCustomers, decisionFocusList, objectionList, profile]);

  function toggleCustomerType(tag: string, on: boolean) {
    setCustomerTypeTags(prev => {
      const set = new Set(prev);
      if (on) set.add(tag);
      else set.delete(tag);
      return Array.from(set);
    });
  }

  function addCustomCustomerType() {
    const t = customerTypeDraft.trim();
    if (!t || customerTypeTags.includes(t)) return;
    setCustomerTypeTags([...customerTypeTags, t]);
    setCustomerTypeDraft("");
  }

  function addPurchaseTrigger() {
    const t = purchaseTriggerDraft.trim();
    if (!t || purchaseTriggers.includes(t)) return;
    setPurchaseTriggers([...purchaseTriggers, t]);
    setPurchaseTriggerDraft("");
  }

  function addCommonQuestion() {
    const t = commonQuestionDraft.trim();
    if (!t || commonQuestionsList.includes(t)) return;
    setCommonQuestionsList([...commonQuestionsList, t]);
    setCommonQuestionDraft("");
  }

  function addDecisionFocus() {
    const t = decisionFocusDraft.trim();
    if (!t || decisionFocusList.includes(t)) return;
    setDecisionFocusList([...decisionFocusList, t]);
    setDecisionFocusDraft("");
  }

  function addObjection() {
    const t = objectionDraft.trim();
    if (!t || objectionList.includes(t)) return;
    setObjectionList([...objectionList, t]);
    setObjectionDraft("");
  }

  const completionPercent = useMemo(() => {
    const checks = [
      brandName.trim().length > 0,
      industryTagValue.trim().length > 0,
      oneLiner.trim().length > 0,
      productDesc.trim().length > 0,
      targetCustomer.trim().length > 0,
      customerPains.some(p => p.trim().length > 0),
      keyPoints.some(k => k.trim().length > 0),
      keywords.length > 0,
    ];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  }, [
    brandName,
    industryTagValue,
    oneLiner,
    productDesc,
    targetCustomer,
    customerPains,
    keyPoints,
    keywords,
  ]);

  const computeProfileSectionStatuses = useMemo(() => {
    const brandDone =
      Boolean(brandName.trim()) && Boolean(industryTagValue.trim()) && Boolean(productDesc.trim());
    const customerDone = Boolean(targetCustomer.trim()) && customerPains.length > 0;
    let casesDone = false;
    let casesHint = "待补充，补充后可提升内容可信度";
    const profileHasCases = boolField(profile?.hasCases);
    if (casesChoice === "none" || profileHasCases === false) {
      casesDone = true;
      casesHint = "已选择暂不填写案例";
    } else if (profileHasCases === true && (summary?.customerCases?.length ?? 0) > 0) {
      casesDone = true;
      casesHint = "已录入可引用案例";
    }
    return {
      brand: { done: brandDone, label: brandDone ? "已完成" : "待补充", hint: "影响品牌与品类识别" },
      customer: { done: customerDone, label: customerDone ? "已完成" : "待补充", hint: "影响目标问题与内容选题" },
      cases: { done: casesDone, label: casesDone ? "已完成" : "待补充", hint: casesHint },
    } as const;
  }, [brandName, industryTagValue, productDesc, targetCustomer, customerPains, casesChoice, profile?.hasCases, summary?.customerCases?.length]);

  const saveCustomerCaseRow = async (row: CaseDraft, idx: number) => {
    const name = row.customerBackground.trim().slice(0, 60) || `案例 ${idx + 1}`;
    const caseType = row.id ? row.caseType : ("待补充案例线索" as const);
    const verificationStatus = caseType === "待补充案例线索" ? ("信息不足" as const) : ("待确认" as const);
    const payload = {
      projectId: currentProjectId!,
      caseType,
      customerName: name,
      customerIndustry: "",
      customerBackground: row.customerBackground.trim(),
      originalProblem: row.originalProblem.trim(),
      chosenReason: "",
      usedProductService: "",
      executionProcess: row.executionProcess.trim(),
      resultData: row.resultData.trim(),
      customerFeedback: "",
      allowPublic: row.allowPublic,
      publicVersion: "",
      sensitiveNotes: "",
      sourceAssetIds: [] as number[],
      verificationStatus,
    };
    if (row.id) await updateCustomerCase.mutateAsync({ ...payload, id: row.id });
    else {
      const res = await createCustomerCase.mutateAsync(payload);
      setCaseRows(rows => rows.map((r, i) => (i === idx ? { ...r, id: res.id } : r)));
    }
    await upsertProfile.mutateAsync({ ...basePayloadWithExtras(), hasCases: true });
  };

  const trustStatus: SectionStatusTone =
    faqItems.some(f => f.question.trim() && f.answer.trim()) || authorityText.trim()
      ? "已完成"
      : "待完善";

  const loading = projectsLoading || isLoading;
  const queryError = projectsError?.message || summaryError?.message;
  const saving =
    upsertProfile.isPending ||
    createCustomerCase.isPending ||
    updateCustomerCase.isPending;

  async function refreshSummary() {
    if (!currentProjectId) return;
    await utils.geo.assetLibrary.summary.invalidate({ projectId: currentProjectId });
  }

  async function runSave(label: string, fn: () => Promise<unknown>) {
    setMessage(undefined);
    setError(undefined);
    try {
      await fn();
      await refreshSummary();
      setMessage(`${label}已保存。`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  }

  function togglePain(preset: string, on: boolean) {
    setCustomerPains(prev => {
      const set = new Set(prev);
      if (on) set.add(preset);
      else set.delete(preset);
      return Array.from(set);
    });
  }

  function addCustomPain() {
    const t = painDraft.trim();
    if (!t || customerPains.includes(t)) return;
    setCustomerPains([...customerPains, t]);
    setPainDraft("");
  }

  function addCompetitor() {
    const t = competitorDraft.trim();
    if (!t || competitors.includes(t)) return;
    setCompetitors([...competitors, t]);
    setCompetitorDraft("");
  }

  async function saveFiveMinuteAndStartDiagnosis() {
    if (!currentProjectId) return;
    setMessage(undefined);
    setError(undefined);
    try {
      if (!brandName.trim()) throw new Error("请填写企业名称");
      if (!industryTagValue.trim()) throw new Error("请选择所属行业");
      if (!oneLiner.trim()) throw new Error("请填写一句话介绍");
      if (!productDesc.trim()) throw new Error("请填写核心产品 / 服务");
      if (!targetCustomer.trim()) throw new Error("请填写目标客户");
      if (!fiveMinuteValues.primaryPain.trim()) throw new Error("请填写主要解决的问题");
      if (!fiveMinuteValues.coreAdvantage.trim()) throw new Error("请填写核心优势");
      if (keywords.length === 0) throw new Error("请至少添加一个希望被 AI 推荐的关键词");
      setCustomerPains([fiveMinuteValues.primaryPain.trim()]);
      setKeyPoints([fiveMinuteValues.coreAdvantage.trim()]);
      await upsertProfile.mutateAsync(basePayloadWithExtras());
      await refreshSummary();
      setMessage("品牌资产建档已保存。");
      setLocation(buildProjectUrl("/ai-diagnosis", currentProjectId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  }

  const profileEmptyDescription =
    "品牌资产建档必须归属一个客户项目。请先在企业项目列表中新建或选择客户项目。";

  if (!currentProjectId && !projectsLoading) {
    return (
      <div className="space-y-6 pb-12" data-testid="enterprise-profile-page">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">品牌资产建档</h1>
          <p className="text-sm text-gray-500">
            用 5 分钟补齐 AI 理解企业所需的核心信息。请先选择或新建客户项目。
          </p>
        </header>
        <ProjectContextEmptyState description={profileEmptyDescription} testId="enterprise-profile-empty" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12" data-testid="enterprise-profile-page">
      {/* ═══ 页面标题 ═══ */}
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">品牌资产建档</h1>
        <p className="text-sm text-gray-500">
          用 5 分钟补齐 AI 理解企业所需的核心信息，完成后即可开始 AI 实测诊断。
        </p>
      </header>

      {/* ═══ 消息提示 ═══ */}
      {loading ? <p className="text-sm text-gray-400">正在加载…</p> : null}
      {queryError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{queryError}</div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{message}</div>
      ) : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

      {currentProjectId ? (
        <>
          {/* ═══ 建档完成度 ═══ */}
          <div className="geo-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">建档完成度</p>
                <p className="text-[12px] text-gray-400">基于 8 项核心建档字段计算</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
                <span className="text-lg font-bold tabular-nums text-gray-900">{completionPercent}%</span>
              </div>
            </div>
            {completionPercent === 100 ? (
              <div className="mt-3 flex items-center gap-2 text-[13px] text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                <span>核心信息已完整，可保存并开始 AI 实测诊断</span>
              </div>
            ) : null}
          </div>

          {/* ═══ 主体两栏：左核心字段 + 右 AI 预览 ═══ */}
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            {/* 左侧：核心字段 */}
            <div className="space-y-6" ref={basicSectionRef}>
              <FiveMinuteBasicOnboardingSection
                values={fiveMinuteValues}
                onChange={applyFiveMinutePatch}
                keywords={keywords}
                keywordDraft={keywordDraft}
                onKeywordDraftChange={setKeywordDraft}
                onAddKeyword={addKeyword}
                onRemoveKeyword={removeKeyword}
              />

              {aiFilledFields.size > 0 ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  部分字段已由 AI 解析填入，请核对核心建档字段后点击「保存并开始 AI 实测诊断」。
                </div>
              ) : null}

              {/* 主按钮 */}
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  className={cn("rounded-xl px-6", geoP0Brand.primary)}
                  disabled={saving || loading}
                  data-testid="save-profile-start-diagnosis"
                  onClick={() => void saveFiveMinuteAndStartDiagnosis()}
                >
                  {saving ? "保存中…" : "保存并开始 AI 实测诊断"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 右侧：AI 理解预览（sticky） */}
            <div className="hidden lg:block">
              <div className="sticky top-24">
                <ProfileAiUnderstandingPreview model={aiPreviewModel} />
              </div>
            </div>
          </div>

          {/* 移动端 AI 预览 */}
          <div className="lg:hidden">
            <ProfileAiUnderstandingPreview model={aiPreviewModel} />
          </div>

          {/* ═══ 发布环境轻提示 ═══ */}
          <ProfilePublishEnvLightHint
            projectId={currentProjectId}
            configured={enabledPlatformAccountCount > 0}
          />

          {/* ═══ 资料上传辅助 ═══ */}
          <div ref={intakeSectionRef}>
            <ProfileUploadAssistSection
              projectId={currentProjectId}
              enterpriseName={currentProject?.enterpriseName ?? ""}
              disabled={loading || saving}
              showPendingSaveHint={aiFilledFields.size > 0}
              current={{
                brandName,
                industryTagValue,
                productDesc,
                mainChannel,
                targetCustomer,
                customerPains,
                competitors,
                hasCaseContent: caseRows.some(r => r.customerBackground.trim() || r.executionProcess.trim()),
              }}
              onApply={handleApplyAnalysis}
            />
          </div>

          {/* ═══ 高级素材（默认折叠） ═══ */}
          <AdvancedMaterialsSection
            caseCount={caseRows.length}
            trustCount={trustMaterialCount}
            faqCount={faqFilledCount}
            casesChoice={casesChoice}
            onCasesChoice={setCasesChoice}
            caseRows={caseRows}
            onCaseRowsChange={setCaseRows}
            onSaveCase={async (row, idx) => {
              await runSave("客户案例", async () => {
                await saveCustomerCaseRow(row, idx);
              });
            }}
            onSaveChoiceNone={async () => {
              await runSave("案例选择", async () => {
                await upsertProfile.mutateAsync({ ...basePayloadWithExtras(), hasCases: false });
              });
            }}
            onDeleteCase={idx => setCaseRows(rows => rows.filter((_, i) => i !== idx))}
            caseStatus={computeProfileSectionStatuses.cases.label === "已完成" ? "已完成" : "待完善"}
            trustStatus={trustStatus}
            saving={saving}
            competitors={competitors}
            competitorDraft={competitorDraft}
            onCompetitorDraftChange={setCompetitorDraft}
            onAddCompetitor={addCompetitor}
            onRemoveCompetitor={c => setCompetitors(competitors.filter(x => x !== c))}
            competitorDifferenceText={competitorDifferenceText}
            onCompetitorDifferenceChange={setCompetitorDifferenceText}
            unfitCustomers={unfitCustomers}
            onUnfitCustomersChange={setUnfitCustomers}
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
            onSaveTrust={() =>
              void runSave("信任素材", async () => {
                await upsertProfile.mutateAsync(basePayloadWithExtras());
              })
            }
            onSaveCompetitor={() =>
              void runSave("竞品差异", async () => {
                await upsertProfile.mutateAsync(basePayloadWithExtras());
              })
            }
          />

          {/* 发布环境配置已移至 /content-publishing，此处只做轻提示 */}
        </>
      ) : null}
    </div>
  );
}
