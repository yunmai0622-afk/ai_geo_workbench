import { AiMetricCard, AiPageHero, AiPageShell, AiSection, AiStatusBadge } from "@/components/ai/ProductUi";
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
import { Building2, Plus, X } from "lucide-react";
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
  },
) {
  const p = profile ?? {};
  const leg = (k: string, fallback = "") => (typeof p[k] === "string" ? (p[k] as string) : fallback);
  const brand = v.brandName.trim() || leg("enterpriseName") || projectRow?.enterpriseName || "";
  const industryTag = v.industryTag.trim() || leg("industry");
  const productDesc = v.productDesc.trim() || leg("productServiceIntro") || leg("productIntro");
  const targetCustomer = v.targetCustomer.trim() || leg("targetCustomers");

  return {
    projectId,
    enterpriseName: brand,
    shortName: leg("shortName"),
    officialWebsite: leg("officialWebsite"),
    industry: industryTag,
    region: leg("region", "中国"),
    productServiceIntro: productDesc,
    targetCustomers: targetCustomer,
    coreSellingPoints: leg("coreSellingPoints"),
    servicePriceRange: leg("servicePriceRange"),
    serviceModel: leg("serviceModel"),
    fitCustomers: leg("fitCustomers"),
    unfitCustomers: leg("unfitCustomers"),
    salesChannels: joinListField(p.salesChannels).length ? joinListField(p.salesChannels) : [],
    commonQuestions: joinListField(p.commonQuestions).length ? joinListField(p.commonQuestions) : [],
    purchaseDecisionFactors: joinListField(p.purchaseDecisionFactors).length ? joinListField(p.purchaseDecisionFactors) : [],
    productIntro: leg("productIntro"),
    featureNotes: leg("featureNotes"),
    serviceProcess: leg("serviceProcess"),
    deliveryPlan: leg("deliveryPlan"),
    afterSalesService: leg("afterSalesService"),
    competitorDifference: leg("competitorDifference"),
    priceExplanation: leg("priceExplanation"),
    salesTalkTracks: leg("salesTalkTracks"),
    commonObjections: leg("commonObjections"),
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
  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const manualSectionRef = useRef<HTMLDivElement>(null);

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
    setCaseRows(
      cases.map(c => ({
        id: typeof c.id === "number" ? c.id : undefined,
        caseType: (textField(c.caseType) === "真实案例" ? "真实案例" : "待补充案例线索") as CaseDraft["caseType"],
        customerBackground: textField(c.customerBackground),
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
    manualSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
  ]);

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
      uploadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        description="先选择或创建一个企业项目，再上传企业资料，系统将自动生成品牌、客户、痛点与案例信息，用于后续 AI 内容诊断。"
        badge="档案配置台"
      >
        {hasSelectedProject ? (
          <div className="w-full min-w-[200px] rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 sm:w-auto">
            <p className="text-xs text-slate-500">当前企业</p>
            <p className="mt-1 text-lg font-semibold text-white">{selectedProject?.enterpriseName}</p>
          </div>
        ) : (
          <p className="max-w-md text-sm leading-relaxed text-slate-400">请先新建第一个企业项目，创建完成后即可上传资料并 AI 自动建档。</p>
        )}
      </AiPageHero>

      {loading ? <p className="text-sm text-slate-400">正在加载…</p> : null}
      {queryError ? <div className="rounded-xl border border-red-300/20 bg-red-400/10 p-3 text-sm text-red-100">{queryError}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">{message}</div> : null}
      {error ? <div className="rounded-xl border border-red-300/20 bg-red-400/10 p-3 text-sm text-red-100">{error}</div> : null}

      <AiSection
        title={hasProjects ? "已有企业档案" : "先新建第一个企业项目"}
        description={
          hasProjects
            ? "选择一个企业后，系统会读取该企业的品牌资料、客户画像与案例信息。当前上传和保存的资料将归属于所选企业。"
            : "创建企业项目后，才能上传资料并进行 AI 智能建档。"
        }
      >
        <div className={cn(aiGlassPanel, "space-y-5 p-5 md:p-6")}>
          {hasProjects ? (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <label className="block min-w-0 flex-1 space-y-2 text-sm">
                  <span className="font-medium text-slate-100">选择当前企业</span>
                  <select
                    disabled={loading}
                    value={selectedProjectId ?? ""}
                    onChange={e => setSelectedProjectId(Number(e.target.value) || undefined)}
                    className={cn(aiInput, "max-w-none")}
                  >
                    {projects.map(pr => (
                      <option key={pr.id} value={pr.id}>
                        {pr.enterpriseName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <details className="rounded-xl border border-white/8 bg-slate-950/30 text-sm">
                <summary className="cursor-pointer px-4 py-3 font-medium text-slate-400 hover:text-slate-200">新增企业项目</summary>
                <div className="space-y-3 border-t border-white/8 px-4 pb-4 pt-3">
                  <p className="text-xs text-slate-500">用于为新的客户或品牌单独建立档案。创建后将自动切换到新企业。</p>
                  {createProjectFields}
                </div>
              </details>
            </>
          ) : (
            <>
              <p className="text-sm text-amber-100/90">创建企业后可上传资料并自动建档，无需先填写完整表单。</p>
              {createProjectFields}
            </>
          )}
        </div>
      </AiSection>

      {hasSelectedProject ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <AiMetricCard label="当前企业" value={selectedProject?.enterpriseName?.slice(0, 14) ?? "—"} hint="资料归属企业" accent="violet" />
            <AiMetricCard label="档案完整度" value={`${completionPercent}%`} hint="完成必填项后可进入诊断" accent="cyan" />
            <AiMetricCard label="下一步动作" value={diagnosisReady ? "内容诊断" : "上传建档"} hint={nextActionLabel} accent="emerald" />
          </div>

          <div className="h-2 overflow-hidden rounded-full border border-white/8 bg-slate-950/60">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500/80 to-violet-500/70 transition-all" style={{ width: `${completionPercent}%` }} />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button className={aiPrimaryBtn} type="button" onClick={() => uploadSectionRef.current?.scrollIntoView({ behavior: "smooth" })}>
              上传企业资料
            </Button>
            <Button type="button" variant="outline" className={aiOutlineBtn} onClick={() => manualSectionRef.current?.scrollIntoView({ behavior: "smooth" })}>
              手动填写档案
            </Button>
          </div>

          <PlatformAccountBindingSection projectId={selectedProjectId!} />

          <div ref={uploadSectionRef}>
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

          <AiSection title="档案完成进度" description="按模块补齐信息，直接影响 AI 内容诊断质量。">
        <div className="grid gap-3 md:grid-cols-3">
          {(
            [
              ["brand", "品牌基础信息", sectionStatuses.brand],
              ["customer", "目标客户画像", sectionStatuses.customer],
              ["cases", "客户案例", sectionStatuses.cases],
            ] as const
          ).map(([key, title, st]) => (
            <div key={key} className={cn(aiGlassPanel, "p-4")}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-white">{title}</p>
                <AiStatusBadge tone={st.done ? "success" : "warning"}>{st.label}</AiStatusBadge>
              </div>
              <p className="mt-2 text-xs text-slate-500">{st.hint}</p>
            </div>
          ))}
        </div>
      </AiSection>

          <AiSection title="档案确认与修改" description="核对 AI 填充结果或手动补充，保存后进入内容诊断。">
          <div ref={manualSectionRef} id="profile-manual-form" className="scroll-mt-24 space-y-8">
          {aiFilledFields.size > 0 ? (
            <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
              部分字段已由 AI 填入，请核对后点击各区块「保存」写入档案。
            </div>
          ) : null}
          <AiSection title="品牌与产品信息" description="这部分决定系统如何理解你的品牌、品类和主营业务。">
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
              <div className="flex justify-end border-t border-white/8 pt-4">
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
                  保存基本身份
                </Button>
              </div>
            </div>
          </AiSection>

          <AiSection title="目标客户与购买场景" description="这部分决定系统生成哪些客户问题、内容选题和 AI 搜索测试问题。">
            <div className={cn(aiGlassPanel, "space-y-5 p-5 md:p-6")}>
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
                    placeholder="描述你的典型客户：行业、规模、决策角色等"
                    rows={5}
                    className={textareaClass}
                  />
                  {fieldHint("越具体，生成的目标问题与内容选题越贴近真实业务")}
                </>
              ))}
              <div className="space-y-2 text-sm text-slate-300">
                <span className="font-medium text-slate-100">
                  客户最大的痛点（必填，至少 1 个）
                  <AiFilledMark show={aiFilledFields.has("customerPains")} />
                </span>
                <p className="text-xs text-slate-500">系统会根据行业方向推荐常见痛点，你也可以补充自定义痛点。</p>
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
                <span className="font-medium text-slate-100">
                  主要竞品（选填，回车添加）
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
              <div className="flex justify-end border-t border-white/8 pt-4">
                <Button
                  className={aiPrimaryBtn}
                  disabled={saving}
                  onClick={() =>
                    void runSave("客户信息", async () => {
                      if (!targetCustomer.trim()) throw new Error("请填写目标客户");
                      if (customerPains.length === 0) throw new Error("请至少选择一个痛点");
                      await upsertProfile.mutateAsync(basePayload());
                      setSection2Saved(true);
                    })
                  }
                >
                  保存客户信息
                </Button>
              </div>
            </div>
          </AiSection>

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

          <AiSection title="案例与信任素材" description="客户案例会增强品牌在内容中的可信度，也有助于 AI 更准确理解你的业务价值。">
            <div className={cn(aiGlassPanel, "space-y-5 p-5 md:p-6")}>
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
                        <span className="font-medium text-slate-100">客户画像</span>
                        <textarea
                          value={row.customerBackground}
                          onChange={e => {
                            const v = e.target.value;
                            setCaseRows(rows => rows.map((r, i) => (i === idx ? { ...r, customerBackground: v } : r)));
                          }}
                          rows={3}
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
                        <span className="font-medium text-slate-100">结果数据（脱敏）</span>
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
                                originalProblem: "",
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
                        { caseType: "待补充案例线索", customerBackground: "", executionProcess: "", resultData: "", allowPublic: false },
                      ])
                    }
                  >
                    添加案例
                  </Button>
                </div>
              ) : null}
            </div>
          </AiSection>

          </div>

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
                档案完整度 {completionPercent}% · 保存基本身份与客户信息为必填 · 资料不足时不得编造案例、数据、价格和效果承诺
              </p>
            </div>
          </section>
          </AiSection>
        </>
      ) : null}
    </AiPageShell>
  );
}
