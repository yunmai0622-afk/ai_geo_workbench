import { AiPageHero, AiPageShell, AiSection, AiStatusBadge } from "@/components/ai/ProductUi";
import { AiFilledMark, ProfileIntakePanel, type ProfileApplyPatch } from "@/components/enterpriseProfile/ProfileIntakePanel";
import { PlatformAccountBindingSection } from "@/components/PlatformAccountBindingSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { aiChipActive, aiChipIdle, aiGlassPanel, aiInput, aiOutlineBtn, aiPrimaryBtn } from "@/lib/aiProductUi";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ENTERPRISE_INDUSTRY_OPTIONS,
  getPainOptionsForIndustry,
  resolveIndustryFromStored,
} from "@shared/enterpriseProfileIndustry";
import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

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

type CaseDraft = {
  id?: number;
  caseType: "真实案例" | "待补充案例线索";
  customerBackground: string;
  originalProblem: string;
  executionProcess: string;
  resultData: string;
  allowPublic: boolean;
};

/** 与 `geo.assetLibrary.upsertProfile` 输入对齐的完整载荷（合并库内旧字段，避免空字段写坏 NOT NULL JSON） */
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
    shortName: leg("shortName"),
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

function fieldHint(text: string) {
  return <p className="text-xs leading-relaxed text-slate-500">{text}</p>;
}

function labelBlock(label: ReactNode, required: boolean | undefined, children: ReactNode) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="font-medium text-slate-100">
        {label}
        {required ? <span className="ml-1 text-amber-300/90">（必填）</span> : null}
      </span>
      {children}
    </label>
  );
}

function computeProfileSectionStatuses(params: {
  brandName: string;
  industryTagValue: string;
  productDesc: string;
  targetCustomer: string;
  customerPains: string[];
  casesChoice: "unset" | "has" | "none";
  profileHasCases: boolean | undefined;
  customerCasesCount: number;
}) {
  const brandDone =
    Boolean(params.brandName.trim()) && Boolean(params.industryTagValue.trim()) && Boolean(params.productDesc.trim());
  const customerDone = Boolean(params.targetCustomer.trim()) && params.customerPains.length > 0;
  let casesDone = false;
  let casesHint = "待补充，补充后可提升内容可信度";
  if (params.casesChoice === "none" || params.profileHasCases === false) {
    casesDone = true;
    casesHint = "已选择暂不填写案例";
  } else if (params.profileHasCases === true && params.customerCasesCount > 0) {
    casesDone = true;
    casesHint = "已录入可引用案例";
  }
  return {
    brand: { done: brandDone, label: brandDone ? "已完成" : "待补充", hint: "影响品牌与品类识别" },
    customer: { done: customerDone, label: customerDone ? "已完成" : "待补充", hint: "影响目标问题与内容选题" },
    cases: { done: casesDone, label: casesDone ? "已完成" : "待补充", hint: casesHint },
  } as const;
}

const CUSTOMER_TYPE_PRESETS = [
  "知识付费老师",
  "教培机构",
  "咨询顾问",
  "企业培训公司",
  "本地生活商家",
  "连锁门店",
  "个人 IP",
  "B2B 企业",
] as const;

const PROFILE_STEPS = [
  { id: "profile-upload", label: "上传资料" },
  { id: "profile-brand", label: "品牌与业务" },
  { id: "profile-customer", label: "客户画像" },
  { id: "profile-trust", label: "信任素材" },
  { id: "platform-accounts", label: "发布账号" },
] as const;

const textareaClass = `${aiInput} min-h-[6rem] w-full max-w-none resize-y py-2`;

export default function AssetCenterPage() {
  const [, setLocation] = useLocation();
  const searchString = typeof window !== "undefined" ? window.location.search : "";
  const utils = trpc.useUtils();
  const { data: projects = [], isLoading: projectsLoading, error: projectsError, refetch: refetchProjects } = trpc.geo.projects.list.useQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const [projectForm, setProjectForm] = useState({
    enterpriseName: "",
    industry: "",
    website: "",
    region: "中国",
    productIntro: "",
    targetCustomers: "",
    coreSellingPoints: "",
    competitorNamesText: "",
    coreKeywordsText: "",
  });

  const [brandName, setBrandName] = useState("");
  const [industrySelect, setIndustrySelect] = useState<string>(ENTERPRISE_INDUSTRY_OPTIONS[0]);
  const [industryCustom, setIndustryCustom] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [mainChannel, setMainChannel] = useState("");

  const [targetCustomer, setTargetCustomer] = useState("");
  const [customerPains, setCustomerPains] = useState<string[]>([]);
  const [painDraft, setPainDraft] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorDraft, setCompetitorDraft] = useState("");
  const [section2Saved, setSection2Saved] = useState(false);

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
  const [dataProofText, setDataProofText] = useState("");
  const [authorityText, setAuthorityText] = useState("");
  const [faqConcernText, setFaqConcernText] = useState("");
  const intakeSectionRef = useRef<HTMLDivElement>(null);
  const brandSectionRef = useRef<HTMLDivElement>(null);
  const customerSectionRef = useRef<HTMLDivElement>(null);
  const trustSectionRef = useRef<HTMLDivElement>(null);

  const createProject = trpc.geo.projects.create.useMutation();
  const upsertProfile = trpc.geo.assetLibrary.upsertProfile.useMutation();
  const createCustomerCase = trpc.geo.assetLibrary.createCustomerCase.useMutation();
  const updateCustomerCase = trpc.geo.assetLibrary.updateCustomerCase.useMutation();
  const generateMarketing = trpc.geo.assetLibrary.generateProfileMarketingCopy.useMutation();

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const fromUrl = params.get("projectId");
    if (fromUrl) {
      const id = Number.parseInt(fromUrl, 10);
      if (!Number.isNaN(id) && projects.some(p => p.id === id)) {
        setSelectedProjectId(id);
        return;
      }
    }
    if (!selectedProjectId && projects[0]?.id) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId, searchString]);

  const projectInput = useMemo(() => ({ projectId: selectedProjectId }), [selectedProjectId]);
  const { data: summaryData, isLoading, isFetched, error: summaryError } = trpc.geo.assetLibrary.summary.useQuery(projectInput, { enabled: Boolean(selectedProjectId) });
  const platformAccountsQuery = trpc.geo.platformAccounts.list.useQuery(
    { projectId: selectedProjectId ?? 0 },
    { enabled: Boolean(selectedProjectId) },
  );
  const summary = summaryData as SummaryLike | undefined;
  const profile = summary?.profile ?? null;
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const industryTagValue = industrySelect === "其他" ? industryCustom.trim() : industrySelect;
  const painPresets = useMemo(() => [...getPainOptionsForIndustry(industryTagValue)], [industryTagValue]);

  const hydrateFromProfile = useCallback(() => {
    if (!summaryData) return;
    const p = (summaryData.profile ?? {}) as Record<string, unknown>;
    const bn = textField(p.brandName) || textField(p.enterpriseName) || selectedProject?.enterpriseName || "";
    setBrandName(bn);
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
    const fit = textField(p.fitCustomers);
    setCustomerTypeTags(fit ? fit.split(/[、,，]/).map(s => s.trim()).filter(Boolean) : []);
    setPurchaseTriggers(joinListField(p.purchaseDecisionFactors));
    setCommonQuestionsList(joinListField(p.commonQuestions));
    const proofParts = [textField(p.coreSellingPoints), textField(p.servicePriceRange)].filter(Boolean);
    setDataProofText(proofParts.join("\n"));
    const authParts = [textField(p.competitorDifference), textField(p.featureNotes), textField(p.salesTalkTracks)].filter(Boolean);
    setAuthorityText(authParts.join("\n"));
    setFaqConcernText(textField(p.commonObjections));

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
  }, [summaryData, selectedProject]);

  useEffect(() => {
    setSection2Saved(false);
    setAiFilledFields(new Set());
  }, [selectedProjectId]);

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
    brandSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const enabledPlatformAccountCount = useMemo(() => {
    const groups = (platformAccountsQuery.data?.accounts ?? []) as Array<{ accounts: Array<{ isEnabled: boolean }> }>;
    return groups.reduce((n, g) => n + g.accounts.filter(a => a.isEnabled).length, 0);
  }, [platformAccountsQuery.data]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (typeof window === "undefined" || !selectedProjectId) return;
    const hash = window.location.hash.replace(/^#/, "");
    if (hash === "platform-accounts") {
      requestAnimationFrame(() => scrollToSection("platform-accounts"));
    }
  }, [selectedProjectId]);

  const customerMissingCount = useMemo(() => {
    let n = 0;
    if (!targetCustomer.trim()) n += 1;
    if (customerPains.length === 0) n += 1;
    if (purchaseTriggers.length === 0) n += 1;
    return n;
  }, [targetCustomer, customerPains.length, purchaseTriggers.length]);

  const profileGaps = useMemo(() => {
    const gaps: string[] = [];
    if (!brandName.trim() || !industryTagValue.trim() || !productDesc.trim()) gaps.push("品牌与产品信息");
    if (!targetCustomer.trim() || customerPains.length === 0) gaps.push("目标客户画像 / 客户痛点");
    if (boolField(profile?.hasCases) === undefined && casesChoice === "unset") gaps.push("案例与信任素材");
    return gaps;
  }, [brandName, industryTagValue, productDesc, targetCustomer, customerPains.length, profile?.hasCases, casesChoice]);

  useEffect(() => {
    if (!selectedProjectId || !isFetched) return;
    hydrateFromProfile();
  }, [hydrateFromProfile, selectedProjectId, isFetched]);

  const basePayload = useCallback(() => {
    if (!selectedProjectId) throw new Error("请先选择项目");
    return buildFullProfilePayload(selectedProjectId, profile, selectedProject, {
      brandName,
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
      fitCustomers: customerTypeTags.join("、"),
      purchaseDecisionFactors: purchaseTriggers,
      commonQuestions: commonQuestionsList,
      coreSellingPoints: dataProofText,
      servicePriceRange: "",
      competitorDifference: authorityText,
      featureNotes: "",
      commonObjections: faqConcernText,
    });
  }, [
    selectedProjectId,
    profile,
    selectedProject,
    brandName,
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
    purchaseTriggers,
    commonQuestionsList,
    dataProofText,
    authorityText,
    faqConcernText,
  ]);

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

  const completionPercent = useMemo(() => {
    const baseOk =
      brandName.trim().length > 0 &&
      industryTagValue.trim().length > 0 &&
      productDesc.trim().length > 0 &&
      targetCustomer.trim().length > 0 &&
      customerPains.length > 0;
    const basePart = baseOk ? 60 : 0;
    const hc = boolField(profile?.hasCases);
    let s3 = 0;
    if (hc === false) s3 = 20;
    else if (hc === true && (summary?.customerCases?.length ?? 0) > 0) s3 = 20;
    const aiOk = oneLiner.trim().length > 0 && keyPoints.length > 0 && keywords.length > 0;
    const aiPart = aiOk ? 20 : 0;
    return Math.min(100, basePart + s3 + aiPart);
  }, [
    brandName,
    industryTagValue,
    productDesc,
    targetCustomer,
    customerPains,
    profile?.hasCases,
    summary?.customerCases?.length,
    oneLiner,
    keyPoints,
    keywords,
  ]);

  const showAiCard =
    section2Saved || (brandName.trim() && industryTagValue.trim() && productDesc.trim() && targetCustomer.trim() && customerPains.length > 0);

  const sectionStatuses = useMemo(
    () =>
      computeProfileSectionStatuses({
        brandName,
        industryTagValue,
        productDesc,
        targetCustomer,
        customerPains,
        casesChoice,
        profileHasCases: boolField(profile?.hasCases),
        customerCasesCount: summary?.customerCases?.length ?? 0,
      }),
    [
      brandName,
      industryTagValue,
      productDesc,
      targetCustomer,
      customerPains,
      casesChoice,
      profile?.hasCases,
      summary?.customerCases?.length,
    ],
  );

  const diagnosisReady = completionPercent >= 60;
  const nextActionLabel = diagnosisReady
    ? "可进入 AI 内容诊断"
    : "建议至少补齐品牌基础信息与目标客户画像";
  const loading = projectsLoading || isLoading;
  const queryError = projectsError?.message || summaryError?.message;
  const saving =
    createProject.isPending ||
    upsertProfile.isPending ||
    createCustomerCase.isPending ||
    updateCustomerCase.isPending ||
    generateMarketing.isPending;

  async function refreshSummary() {
    if (!selectedProjectId) return;
    await utils.geo.assetLibrary.summary.invalidate({ projectId: selectedProjectId });
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

  async function handleCreateProject() {
    const enterpriseName = projectForm.enterpriseName.trim();
    if (!enterpriseName) {
      setError("请填写企业名称");
      return;
    }
    setMessage(undefined);
    setError(undefined);
    try {
      await createProject.mutateAsync({
        enterpriseName,
        industry: projectForm.industry.trim() || "待补充",
        website: projectForm.website.trim() || "https://",
        region: projectForm.region.trim() || "中国",
        productIntro: projectForm.productIntro.trim() || "待补充",
        targetCustomers: projectForm.targetCustomers.trim() || "待补充",
        coreSellingPoints: projectForm.coreSellingPoints.trim() || "待补充",
        competitorNames: projectForm.competitorNamesText.split(/[、,，\n]/).map(s => s.trim()).filter(Boolean),
        coreKeywords: projectForm.coreKeywordsText.split(/[、,，\n]/).map(s => s.trim()).filter(Boolean),
      });
      const refreshed = await refetchProjects();
      const created = refreshed.data?.find(pr => pr.enterpriseName === enterpriseName) ?? refreshed.data?.[0];
      if (created?.id) setSelectedProjectId(created.id);
      setMessage("企业已创建，现在可以上传资料进行 AI 建档。");
      intakeSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    }
  }

  const hasProjects = projects.length > 0;
  const hasSelectedProject = Boolean(selectedProjectId);

  const createProjectFields = (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="space-y-2 text-sm text-slate-300">
        <span className="font-medium text-slate-100">企业名称</span>
        <Input
          value={projectForm.enterpriseName}
          onChange={e => setProjectForm(f => ({ ...f, enterpriseName: e.target.value }))}
          className="border-white/10 bg-slate-950/70"
          placeholder="客户企业或品牌全称"
        />
      </label>
      <label className="space-y-2 text-sm text-slate-300">
        <span className="font-medium text-slate-100">行业</span>
        <Input value={projectForm.industry} onChange={e => setProjectForm(f => ({ ...f, industry: e.target.value }))} className="border-white/10 bg-slate-950/70" placeholder="选填" />
      </label>
      <label className="space-y-2 text-sm text-slate-300">
        <span className="font-medium text-slate-100">官网</span>
        <Input value={projectForm.website} onChange={e => setProjectForm(f => ({ ...f, website: e.target.value }))} className="border-white/10 bg-slate-950/70" placeholder="https://" />
      </label>
      <label className="space-y-2 text-sm text-slate-300">
        <span className="font-medium text-slate-100">地区</span>
        <Input value={projectForm.region} onChange={e => setProjectForm(f => ({ ...f, region: e.target.value }))} className="border-white/10 bg-slate-950/70" />
      </label>
      <div className="flex justify-end md:col-span-2">
        <Button disabled={saving || createProject.isPending} onClick={() => void handleCreateProject()} className={aiPrimaryBtn}>
          {createProject.isPending ? "创建中…" : "创建企业项目"}
        </Button>
      </div>
    </div>
  );

  return (
    <AiPageShell className="pb-16">
      <AiPageHero
        title="企业 AI 搜索档案"
        description="上传企业资料，AI 会自动识别品牌、业务、客户、案例和信任素材。你只需要确认和补充，系统会用这些信息生成内容、诊断问题和交付报告。"
        badge="档案配置台"
      >
        {hasSelectedProject ? (
          <div className="flex w-full min-w-0 flex-col gap-3 sm:w-auto">
            <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3">
              <p className="text-xs text-slate-500">当前企业</p>
              <p className="mt-1 text-lg font-semibold text-white">{selectedProject?.enterpriseName}</p>
            </div>
            {hasProjects ? (
              <select
                disabled={loading}
                value={selectedProjectId ?? ""}
                onChange={e => setSelectedProjectId(Number(e.target.value) || undefined)}
                className={cn(aiInput, "max-w-none text-sm")}
                aria-label="切换企业"
              >
                {projects.map(pr => (
                  <option key={pr.id} value={pr.id}>
                    {pr.enterpriseName}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        ) : (
          <p className="max-w-md text-sm leading-relaxed text-slate-400">请先新建第一个企业项目，创建完成后即可从顶部上传资料开始配置。</p>
        )}
      </AiPageHero>

      {loading ? <p className="text-sm text-slate-400">正在加载…</p> : null}
      {queryError ? <div className="rounded-xl border border-red-300/20 bg-red-400/10 p-3 text-sm text-red-100">{queryError}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">{message}</div> : null}
      {error ? <div className="rounded-xl border border-red-300/20 bg-red-400/10 p-3 text-sm text-red-100">{error}</div> : null}

      {!hasProjects ? (
        <AiSection title="先新建第一个企业项目" description="创建企业项目后，即可从顶部上传资料开始 AI 建档。">
          <div className={cn(aiGlassPanel, "space-y-4 p-5 md:p-6")}>
            <p className="text-sm text-amber-100/90">创建企业后可上传资料并自动建档，无需先填写完整表单。</p>
            {createProjectFields}
          </div>
        </AiSection>
      ) : (
        <details className={cn(aiGlassPanel, "text-sm")}>
          <summary className="cursor-pointer px-4 py-3 font-medium text-slate-400 hover:text-slate-200">新增企业项目</summary>
          <div className="space-y-3 border-t border-white/8 px-4 pb-4 pt-3">
            <p className="text-xs text-slate-500">为新的客户或品牌单独建立档案，创建后将自动切换。</p>
            {createProjectFields}
          </div>
        </details>
      )}

      {hasSelectedProject ? (
        <>
          <nav className="sticky top-16 z-10 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-slate-950/90 p-2 backdrop-blur">
            {PROFILE_STEPS.map(step => (
              <button
                key={step.id}
                type="button"
                className={cn(aiChipIdle, "px-3 py-1.5 text-xs")}
                onClick={() => scrollToSection(step.id)}
              >
                {step.label}
              </button>
            ))}
          </nav>

          <div ref={intakeSectionRef}>
            <ProfileIntakePanel
              projectId={selectedProjectId}
              enterpriseName={selectedProject?.enterpriseName ?? ""}
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

          <AiSection title="档案完成度" description={`整体完成度约 ${completionPercent}%，补齐后诊断与内容生成更准确。`}>
            <div className="mb-4 h-2 overflow-hidden rounded-full border border-white/8 bg-slate-950/60">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-500/80 to-violet-500/70 transition-all" style={{ width: `${completionPercent}%` }} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  {
                    id: "profile-brand",
                    title: "品牌与业务",
                    done: sectionStatuses.brand.done,
                    hint: sectionStatuses.brand.done ? "品牌信息已就绪" : "请补充名称、行业与主营业务",
                  },
                  {
                    id: "profile-customer",
                    title: "客户画像",
                    done: sectionStatuses.customer.done && customerMissingCount === 0,
                    hint: sectionStatuses.customer.done
                      ? customerMissingCount > 0
                        ? `待补充 ${customerMissingCount} 项`
                        : "目标客户与痛点已填写"
                      : "请填写客户是谁与核心痛点",
                  },
                  {
                    id: "profile-trust",
                    title: "信任素材",
                    done: sectionStatuses.cases.done,
                    hint: sectionStatuses.cases.hint,
                  },
                  {
                    id: "platform-accounts",
                    title: "发布账号",
                    done: enabledPlatformAccountCount > 0,
                    hint:
                      enabledPlatformAccountCount > 0
                        ? `已绑定 ${enabledPlatformAccountCount} 个启用账号`
                        : "建议至少绑定一个发布账号",
                  },
                ] as const
              ).map(card => (
                <button
                  key={card.id}
                  type="button"
                  className={cn(aiGlassPanel, "p-4 text-left transition hover:border-cyan-400/30")}
                  onClick={() => scrollToSection(card.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-white">{card.title}</p>
                    <AiStatusBadge tone={card.done ? "success" : "warning"}>{card.done ? "完成" : "待补充"}</AiStatusBadge>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{card.hint}</p>
                </button>
              ))}
            </div>
          </AiSection>

          {aiFilledFields.size > 0 ? (
            <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
              部分字段已由 AI 填入，请核对各区块后点击对应「保存」按钮写入档案（不会自动保存）。
            </div>
          ) : null}

          <div ref={brandSectionRef} id="profile-brand" className="scroll-mt-28">
          <AiSection title="品牌与业务" description="用于让 AI 理解你是谁、做什么、适合在哪些场景被推荐。">
            <div className="flex justify-end">
              <AiStatusBadge tone={sectionStatuses.brand.done ? "success" : "warning"}>{sectionStatuses.brand.label}</AiStatusBadge>
            </div>
            <div className={cn(aiGlassPanel, "space-y-5 p-5 md:p-6")}>
              <div className="grid gap-5 md:grid-cols-2">
                {labelBlock(
                  <>
                    企业/品牌名称
                    <AiFilledMark show={aiFilledFields.has("brandName")} />
                  </>,
                  true,
                  (
                  <>
                    <Input value={brandName} onChange={e => setBrandName(e.target.value)} className={cn(aiInput, "max-w-none")} />
                    {fieldHint("用于在内容与诊断中识别你的品牌名称")}
                  </>
                ))}
                {labelBlock(
                  <>
                    行业方向
                    <AiFilledMark show={aiFilledFields.has("industry")} />
                  </>,
                  true,
                  (
                  <>
                    <select value={industrySelect} onChange={e => setIndustrySelect(e.target.value)} className={cn(aiInput, "max-w-none")}>
                      {ENTERPRISE_INDUSTRY_OPTIONS.map(o => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                    {fieldHint("帮助系统判断品类与竞争语境")}
                  </>
                ))}
              </div>
              {industrySelect === "其他" ? (
                labelBlock("自定义行业", true, (
                  <Input value={industryCustom} onChange={e => setIndustryCustom(e.target.value)} placeholder="请输入行业" className={cn(aiInput, "max-w-none")} />
                ))
              ) : null}
              {labelBlock(
                <>
                  你主要卖什么
                  <AiFilledMark show={aiFilledFields.has("productDesc")} />
                </>,
                true,
                (
                <>
                  <textarea
                    value={productDesc}
                    maxLength={200}
                    onChange={e => setProductDesc(e.target.value)}
                    placeholder="描述你的产品或服务，200字以内"
                    rows={4}
                    className={textareaClass}
                  />
                  <span className="text-xs text-slate-500">{productDesc.length}/200</span>
                  {fieldHint("一句话说清主营业务，影响内容方向与表达")}
                </>
              ))}
              {labelBlock(
                <>
                  主要阵地
                  <AiFilledMark show={aiFilledFields.has("mainChannel")} />
                </>,
                false,
                (
                <>
                  <Input
                    value={mainChannel}
                    onChange={e => setMainChannel(e.target.value)}
                    placeholder="官网/抖音号/公众号，任填一个"
                    className={cn(aiInput, "max-w-none")}
                  />
                  {fieldHint("选填，用于判断内容分发渠道偏好")}
                </>
              ))}
              {labelBlock("官网", false, (
                <Input value={officialWebsite} onChange={e => setOfficialWebsite(e.target.value)} placeholder="https://" className={cn(aiInput, "max-w-none")} />
              ))}
              {labelBlock("地区", false, (
                <Input value={region} onChange={e => setRegion(e.target.value)} className={cn(aiInput, "max-w-none")} />
              ))}
              <div className="flex justify-end border-t border-white/8 pt-4 md:col-span-2">
                <Button
                  className={aiPrimaryBtn}
                  disabled={saving}
                  onClick={() =>
                    void runSave("基本身份", async () => {
                      if (!brandName.trim()) throw new Error("请填写企业/品牌名称");
                      if (!industryTagValue.trim()) throw new Error("请选择或填写行业方向");
                      if (!productDesc.trim()) throw new Error("请填写你主要卖什么");
                      await upsertProfile.mutateAsync(basePayload());
                    })
                  }
                >
                  保存品牌与业务
                </Button>
              </div>
            </div>
          </AiSection>
          </div>

          <div ref={customerSectionRef} id="profile-customer" className="scroll-mt-28">
          <AiSection title="客户画像与购买场景" description="这些信息会决定系统生成哪些客户问题、内容选题和 AI 搜索测试问题。">
            <div className="flex justify-end">
              <AiStatusBadge tone={sectionStatuses.customer.done ? "success" : "warning"}>{sectionStatuses.customer.label}</AiStatusBadge>
            </div>
            <div className={cn(aiGlassPanel, "grid gap-6 p-5 md:grid-cols-2 md:p-6")}>
              <div className="space-y-5">
                <p className="text-sm font-medium text-cyan-200/90">目标客户画像</p>
              {labelBlock(
                <>
                  目标客户是谁
                  <AiFilledMark show={aiFilledFields.has("targetCustomer")} />
                </>,
                true,
                (
                <>
                  <textarea
                    value={targetCustomer}
                    onChange={e => setTargetCustomer(e.target.value)}
                    placeholder="例如：在抖音、视频号、小红书卖课的知识付费老师"
                    rows={4}
                    className={textareaClass}
                  />
                  {fieldHint("越具体，系统生成的问题和内容越贴近真实业务")}
                </>
              ))}
              <div className="space-y-2 text-sm text-slate-300">
                <span className="font-medium text-slate-100">客户类型标签</span>
                <p className="text-xs text-slate-500">可多选，也可自定义补充。</p>
                <div className="flex flex-wrap gap-2">
                  {CUSTOMER_TYPE_PRESETS.map(tag => (
                    <label key={tag} className={cn("cursor-pointer rounded-full border px-3 py-1 text-xs", customerTypeTags.includes(tag) ? aiChipActive : aiChipIdle)}>
                      <input type="checkbox" className="sr-only" checked={customerTypeTags.includes(tag)} onChange={e => toggleCustomerType(tag, e.target.checked)} />
                      {tag}
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {customerTypeTags
                    .filter(t => !(CUSTOMER_TYPE_PRESETS as readonly string[]).includes(t))
                    .map(t => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                        {t}
                        <button type="button" className="text-slate-400 hover:text-white" onClick={() => setCustomerTypeTags(customerTypeTags.filter(x => x !== t))}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={customerTypeDraft}
                    onChange={e => setCustomerTypeDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomCustomerType();
                      }
                    }}
                    placeholder="自定义客户类型，回车添加"
                    className="border-white/10 bg-slate-950/70"
                  />
                  <Button type="button" variant="outline" size="icon" className="border-white/15 shrink-0" onClick={addCustomCustomerType}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              </div>
              <div className="space-y-5">
                <p className="text-sm font-medium text-cyan-200/90">客户痛点与购买触发点</p>
              <div className="space-y-2 text-sm text-slate-300">
                <span className="font-medium text-slate-100">
                  客户最大痛点（必填，至少 1 个）
                  <AiFilledMark show={aiFilledFields.has("customerPains")} />
                </span>
                <p className="text-xs text-slate-500">选项随「行业方向」变化，请先在品牌区选择行业。</p>
                <div className="flex flex-wrap gap-3 pt-1">
                  {painPresets.map(p => (
                    <label key={p} className="flex cursor-pointer items-center gap-2 text-slate-200">
                      <input
                        type="checkbox"
                        checked={customerPains.includes(p)}
                        onChange={e => togglePain(p, e.target.checked)}
                        className="h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-400"
                      />
                      {p}
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {customerPains
                    .filter(p => !painPresets.includes(p))
                    .map(p => (
                      <span key={p} className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                        {p}
                        <button type="button" className="text-slate-400 hover:text-white" onClick={() => setCustomerPains(customerPains.filter(x => x !== p))}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <Input
                    value={painDraft}
                    onChange={e => setPainDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomPain();
                      }
                    }}
                    placeholder="自定义痛点，回车添加"
                    className="border-white/10 bg-slate-950/70"
                  />
                  <Button type="button" variant="outline" size="icon" className="border-white/15 shrink-0" onClick={addCustomPain}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2 text-sm text-slate-300">
                <span className="font-medium text-slate-100">购买触发点</span>
                <p className="text-xs text-slate-500">客户通常在什么情况下会认真考虑购买。</p>
                <div className="flex flex-wrap gap-2">
                  {purchaseTriggers.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">
                      {t}
                      <button type="button" className="text-slate-400 hover:text-white" onClick={() => setPurchaseTriggers(purchaseTriggers.filter(x => x !== t))}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={purchaseTriggerDraft}
                    onChange={e => setPurchaseTriggerDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addPurchaseTrigger();
                      }
                    }}
                    placeholder="例如：课程卖不动、直播转化下降、团队服务不过来"
                    className="border-white/10 bg-slate-950/70"
                  />
                  <Button type="button" variant="outline" size="icon" className="border-white/15 shrink-0" onClick={addPurchaseTrigger}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2 text-sm text-slate-300">
                <span className="font-medium text-slate-100">客户常问问题</span>
                <div className="flex flex-wrap gap-2">
                  {commonQuestionsList.map(q => (
                    <span key={q} className="inline-flex items-center gap-1 rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1 text-xs text-violet-100">
                      {q}
                      <button type="button" className="text-slate-400 hover:text-white" onClick={() => setCommonQuestionsList(commonQuestionsList.filter(x => x !== q))}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={commonQuestionDraft}
                    onChange={e => setCommonQuestionDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCommonQuestion();
                      }
                    }}
                    placeholder="例如：你们和小鹅通/有赞教育有什么区别？"
                    className="border-white/10 bg-slate-950/70"
                  />
                  <Button type="button" variant="outline" size="icon" className="border-white/15 shrink-0" onClick={addCommonQuestion}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              </div>
              <div className="space-y-2 text-sm text-slate-300 md:col-span-2">
                <span className="font-medium text-slate-100">
                  主要竞品（选填）
                  <AiFilledMark show={aiFilledFields.has("competitors")} />
                </span>
                <div className="flex flex-wrap gap-2">
                  {competitors.map(c => (
                    <span key={c} className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs">
                      {c}
                      <button type="button" className="text-slate-400 hover:text-white" onClick={() => setCompetitors(competitors.filter(x => x !== c))}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <Input
                  value={competitorDraft}
                  onChange={e => setCompetitorDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCompetitor();
                    }
                  }}
                  placeholder="输入竞品名称，回车添加"
                  className="border-white/10 bg-slate-950/70"
                />
              </div>
              <div className="flex justify-end border-t border-white/8 pt-4 md:col-span-2">
                <Button
                  className={aiPrimaryBtn}
                  disabled={saving}
                  onClick={() =>
                    void runSave("客户画像", async () => {
                      if (!targetCustomer.trim()) throw new Error("请填写目标客户");
                      if (customerPains.length === 0) throw new Error("请至少选择一个痛点");
                      await upsertProfile.mutateAsync(basePayload());
                      setSection2Saved(true);
                    })
                  }
                >
                  保存客户画像
                </Button>
              </div>
            </div>
          </AiSection>
          </div>

          {showAiCard ? (
            <AiSection title="AI 推荐表达" description="基于品牌与客户信息生成，可手动修改后保存。">
              <div className={cn(aiGlassPanel, "space-y-4 p-5 md:p-6")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-sm text-slate-400">确认后将用于诊断与内容生成中的品牌表达。</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/15 text-cyan-100 shrink-0"
                  disabled={generateMarketing.isPending}
                  onClick={() => {
                    void (async () => {
                      setError(undefined);
                      setMessage(undefined);
                      try {
                        if (!selectedProjectId) throw new Error("请先选择项目");
                        const genInput = { projectId: selectedProjectId };
                        const r = await generateMarketing.mutateAsync(genInput);
                        const ol = typeof r.oneLiner === "string" ? r.oneLiner.trim() : "";
                        const kp = Array.isArray(r.keyPoints) ? r.keyPoints.map(x => String(x).trim()).filter(Boolean) : [];
                        const kw = Array.isArray(r.keywords) ? r.keywords.map(x => String(x).trim()).filter(Boolean) : [];
                        setOneLiner(ol);
                        setKeyPoints(kp);
                        setKeywords(kw);
                        setMessage("已重新生成，请确认后点击「保存 AI 生成内容」。");
                        await refreshSummary();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "生成失败");
                      }
                    })();
                  }}
                >
                  {generateMarketing.isPending ? "生成中…" : "重新生成"}
                </Button>
                </div>
                <label className="space-y-2 text-sm text-slate-300">
                  <span className="font-medium text-slate-100">一句话介绍</span>
                  <Input value={oneLiner} onChange={e => setOneLiner(e.target.value)} className="border-white/10 bg-slate-950/70" />
                </label>
                <div className="space-y-2 text-sm text-slate-300">
                  <span className="font-medium text-slate-100">核心卖点</span>
                  <div className="flex flex-wrap gap-2">
                    {keyPoints.map((k, i) => (
                      <span key={`${k}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
                        {k}
                        <button type="button" onClick={() => setKeyPoints(keyPoints.filter((_, j) => j !== i))} className="text-slate-400 hover:text-white">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={keyPointDraft}
                      onChange={e => setKeyPointDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const t = keyPointDraft.trim();
                          if (t) setKeyPoints([...keyPoints, t]);
                          setKeyPointDraft("");
                        }
                      }}
                      placeholder="回车添加卖点"
                      className="border-white/10 bg-slate-950/70"
                    />
                  </div>
                </div>
                <div className="space-y-2 text-sm text-slate-300">
                  <span className="font-medium text-slate-100">核心关键词</span>
                  <div className="flex flex-wrap gap-2">
                    {keywords.map((k, i) => (
                      <span key={`${k}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1 text-xs text-violet-100">
                        {k}
                        <button type="button" onClick={() => setKeywords(keywords.filter((_, j) => j !== i))} className="text-slate-400 hover:text-white">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <Input
                    value={keywordDraft}
                    onChange={e => setKeywordDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const t = keywordDraft.trim();
                        if (t) setKeywords([...keywords, t]);
                        setKeywordDraft("");
                      }
                    }}
                    placeholder="回车添加关键词"
                    className="border-white/10 bg-slate-950/70"
                  />
                </div>
                <div className="flex justify-end border-t border-white/8 pt-4">
                  <Button
                    className={aiPrimaryBtn}
                    disabled={saving}
                    onClick={() =>
                      void runSave("AI 生成内容", async () => {
                        await upsertProfile.mutateAsync(basePayload());
                      })
                    }
                  >
                    保存 AI 生成内容
                  </Button>
                </div>
              </div>
            </AiSection>
          ) : null}

          <div ref={trustSectionRef} id="profile-trust" className="scroll-mt-28">
          <AiSection title="案例与信任素材" description="这些素材会用于生成案例文章、FAQ、竞品对比、种草内容和客户交付报告。">
            <div className="flex justify-end">
              <AiStatusBadge tone={sectionStatuses.cases.done ? "success" : "warning"}>{sectionStatuses.cases.label}</AiStatusBadge>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className={cn(aiGlassPanel, "space-y-4 p-5 lg:col-span-2")}>
                <div>
                  <p className="font-medium text-white">客户案例</p>
                  <p className="mt-1 text-xs text-slate-500">填写真实服务过的客户案例，AI 会转化成可被搜索引用的内容。</p>
                </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setCasesChoice("has")}
                  className={casesChoice === "has" ? aiChipActive : aiChipIdle}
                >
                  <span className="font-medium">有客户案例 / 能公开</span>
                  <p className="mt-1 text-xs opacity-80">填写并保存至少一条案例</p>
                </button>
                <button type="button" onClick={() => setCasesChoice("none")} className={casesChoice === "none" ? aiChipActive : aiChipIdle}>
                  <span className="font-medium">暂时没有，跳过</span>
                  <p className="mt-1 text-xs opacity-80">内容生成不引用具体案例</p>
                </button>
              </div>
              {casesChoice === "none" ? (
                <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                  内容生成时将不引用具体案例数据，可随时补充。
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="outline"
                      className="border-white/15"
                      disabled={saving}
                      onClick={() =>
                        void runSave("案例选择", async () => {
                          await upsertProfile.mutateAsync({ ...basePayload(), hasCases: false });
                        })
                      }
                    >
                      保存选择
                    </Button>
                  </div>
                </div>
              ) : null}
              {casesChoice === "has" ? (
                <div className="space-y-4">
                  {caseRows.map((row, idx) => (
                    <div key={row.id ?? `new-${idx}`} className="space-y-4 rounded-xl border border-white/8 bg-slate-950/40 p-4">
                      <p className="text-sm font-medium text-cyan-200">案例 {idx + 1}</p>
                      <label className="space-y-2 text-sm text-slate-300 block">
                        <span className="font-medium text-slate-100">客户是谁</span>
                        <textarea
                          value={row.customerBackground}
                          placeholder="客户背景、行业、规模等"
                          onChange={e => {
                            const v = e.target.value;
                            setCaseRows(rows => rows.map((r, i) => (i === idx ? { ...r, customerBackground: v } : r)));
                          }}
                          rows={3}
                          className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm outline-none"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-slate-300 block">
                        <span className="font-medium text-slate-100">客户遇到什么问题</span>
                        <textarea
                          value={row.originalProblem}
                          onChange={e => {
                            const v = e.target.value;
                            setCaseRows(rows => rows.map((r, i) => (i === idx ? { ...r, originalProblem: v } : r)));
                          }}
                          rows={2}
                          placeholder="客户当时的核心困境"
                          className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm outline-none"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-slate-300 block">
                        <span className="font-medium text-slate-100">我们做了什么</span>
                        <textarea
                          value={row.executionProcess}
                          onChange={e => {
                            const v = e.target.value;
                            setCaseRows(rows => rows.map((r, i) => (i === idx ? { ...r, executionProcess: v } : r)));
                          }}
                          rows={3}
                          className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm outline-none"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-slate-300 block">
                        <span className="font-medium text-slate-100">结果或变化</span>
                        <textarea
                          value={row.resultData}
                          onChange={e => {
                            const v = e.target.value;
                            setCaseRows(rows => rows.map((r, i) => (i === idx ? { ...r, resultData: v } : r)));
                          }}
                          placeholder="直播转化率提升X%，收入提升X倍……"
                          rows={2}
                          className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm outline-none"
                        />
                      </label>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <Switch checked={row.allowPublic} onCheckedChange={c => setCaseRows(rows => rows.map((r, i) => (i === idx ? { ...r, allowPublic: c } : r)))} />
                          <span>是否允许公开引用</span>
                        </div>
                        <Button
                          size="sm"
                          className="bg-cyan-400 text-slate-950"
                          disabled={saving}
                          onClick={() =>
                            void runSave("客户案例", async () => {
                              const name = row.customerBackground.trim().slice(0, 60) || `案例 ${idx + 1}`;
                              const caseType = row.id ? row.caseType : ("待补充案例线索" as const);
                              const verificationStatus = caseType === "待补充案例线索" ? ("信息不足" as const) : ("待确认" as const);
                              const payload = {
                                projectId: selectedProjectId!,
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
                              await upsertProfile.mutateAsync({ ...basePayload(), hasCases: true });
                            })
                          }
                        >
                          保存本条案例
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    className="border-white/15"
                    onClick={() =>
                      setCaseRows([
                        ...caseRows,
                        { caseType: "待补充案例线索", customerBackground: "", originalProblem: "", executionProcess: "", resultData: "", allowPublic: false },
                      ])
                    }
                  >
                    添加案例
                  </Button>
                </div>
              ) : null}
              </div>

              <div className={cn(aiGlassPanel, "space-y-3 p-5")}>
                <div>
                  <p className="font-medium text-white">数据证明</p>
                  <p className="mt-1 text-xs text-slate-500">填写能证明实力的数据，越具体越容易增强 AI 对品牌的信任判断。</p>
                </div>
                <textarea
                  value={dataProofText}
                  onChange={e => setDataProofText(e.target.value)}
                  rows={5}
                  placeholder="例如：服务 3000+ 知识付费老师；帮助客户直播转化率提升 30%"
                  className={textareaClass}
                />
              </div>

              <div className={cn(aiGlassPanel, "space-y-3 p-5")}>
                <div>
                  <p className="font-medium text-white">权威背书</p>
                  <p className="mt-1 text-xs text-slate-500">合作品牌、媒体报道、资质认证、专家身份等。</p>
                </div>
                <textarea
                  value={authorityText}
                  onChange={e => setAuthorityText(e.target.value)}
                  rows={5}
                  placeholder="例如：与 XX 品牌合作；获 XX 媒体报道；XX 平台认证讲师"
                  className={textareaClass}
                />
              </div>

              <div className={cn(aiGlassPanel, "space-y-3 p-5 lg:col-span-2")}>
                <div>
                  <p className="font-medium text-white">客户疑虑与回答</p>
                  <p className="mt-1 text-xs text-slate-500">客户最常问的问题，适合生成 FAQ 与 AI 搜索内容。</p>
                </div>
                <textarea
                  value={faqConcernText}
                  onChange={e => setFaqConcernText(e.target.value)}
                  rows={5}
                  placeholder={'客户疑虑：AI 生成内容会不会很假？\n回答：我们不是批量洗稿，而是基于企业资料、客户痛点与案例生成结构化内容。'}
                  className={textareaClass}
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                className={aiPrimaryBtn}
                disabled={saving}
                onClick={() =>
                  void runSave("信任素材", async () => {
                    await upsertProfile.mutateAsync(basePayload());
                  })
                }
              >
                保存信任素材
              </Button>
            </div>
          </AiSection>
          </div>

          <AiSection
            id="platform-accounts"
            title="发布账号绑定"
            description="为不同平台、不同账号组绑定发布账号，后续发布时系统会按内容策略推荐对应账号组。"
          >
            <PlatformAccountBindingSection projectId={selectedProjectId!} />
          </AiSection>

          <section className={cn(aiGlassPanel, "space-y-4 p-6 md:p-8")}>
            <div className="text-center md:text-left">
              <p className="text-lg font-semibold text-white">
                {diagnosisReady ? "企业档案已准备好，可以进入 AI 内容诊断" : "完成企业档案，进入 AI 内容诊断"}
              </p>
              {!diagnosisReady && profileGaps.length > 0 ? (
                <p className="mt-2 text-sm text-amber-100/90">还缺：{profileGaps.join("、")}</p>
              ) : null}
              {diagnosisReady ? (
                <p className="mt-2 text-sm text-slate-400">档案已达到可诊断门槛，可生成目标问题与内容缺口分析。</p>
              ) : (
                <p className="mt-2 text-sm text-amber-100/90">建议先上传资料 AI 解析，或手动补齐品牌基础信息与目标客户画像。</p>
              )}
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <Button
                className={cn(aiPrimaryBtn, "h-12 flex-1 sm:flex-none sm:px-10")}
                disabled={!diagnosisReady}
                onClick={() => setLocation("/ai-diagnosis")}
              >
                进入 AI 内容诊断
              </Button>
              <p className="text-center text-xs text-slate-500 sm:text-left">
                档案完整度 {completionPercent}% · 保存品牌与业务与客户画像为必填 · 资料不足时不得编造案例、数据、价格和效果承诺
              </p>
            </div>
          </section>
        </>
      ) : null}
    </AiPageShell>
  );
}
