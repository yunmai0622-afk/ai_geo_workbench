import { GeoStatusGuide } from "@/components/GeoStatusGuide";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Building2, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const INDUSTRY_OPTIONS = ["知识付费", "在线教育", "个人IP", "教育培训机构", "内容电商", "企业服务", "其他"] as const;

const PAIN_PRESETS = [
  "流量有但不成交",
  "私域转化率低",
  "直播没有转化",
  "不知道问题在哪",
  "团队无法复制",
  "课程卖不动",
  "投流ROI低",
  "客户留存差",
] as const;

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

export default function AssetCenterPage() {
  const [, setLocation] = useLocation();
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
  const [industrySelect, setIndustrySelect] = useState<string>(INDUSTRY_OPTIONS[0]);
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

  const createProject = trpc.geo.projects.create.useMutation();
  const upsertProfile = trpc.geo.assetLibrary.upsertProfile.useMutation();
  const createCustomerCase = trpc.geo.assetLibrary.createCustomerCase.useMutation();
  const updateCustomerCase = trpc.geo.assetLibrary.updateCustomerCase.useMutation();
  const generateMarketing = trpc.geo.assetLibrary.generateProfileMarketingCopy.useMutation();

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  const projectInput = useMemo(() => ({ projectId: selectedProjectId }), [selectedProjectId]);
  const { data: summaryData, isLoading, isFetched, error: summaryError } = trpc.geo.assetLibrary.summary.useQuery(projectInput, { enabled: Boolean(selectedProjectId) });
  const summary = summaryData as SummaryLike | undefined;
  const profile = summary?.profile ?? null;
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const industryTagValue = industrySelect === "其他" ? industryCustom.trim() : industrySelect;

  const hydrateFromProfile = useCallback(() => {
    if (!summaryData) return;
    const p = (summaryData.profile ?? {}) as Record<string, unknown>;
    const bn = textField(p.brandName) || textField(p.enterpriseName) || selectedProject?.enterpriseName || "";
    setBrandName(bn);
    const it = textField(p.industryTag) || textField(p.industry);
    if (it && INDUSTRY_OPTIONS.includes(it as (typeof INDUSTRY_OPTIONS)[number])) {
      setIndustrySelect(it);
      setIndustryCustom("");
    } else if (it) {
      setIndustrySelect("其他");
      setIndustryCustom(it);
    } else {
      setIndustrySelect(INDUSTRY_OPTIONS[0]);
      setIndustryCustom("");
    }
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
  }, [selectedProjectId]);

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

  const primaryAction = completionPercent >= 60 ? { label: "进入内容诊断", path: "/ai-diagnosis" } : { label: "补齐企业档案", path: "/enterprise-profile" };
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
    await runSave("企业项目", async () => {
      const enterpriseName = projectForm.enterpriseName.trim();
      if (!enterpriseName) throw new Error("请填写企业名称");
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
    });
  }

  return (
    <div className="space-y-6 text-slate-100">
      <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-6 shadow-[0_0_34px_rgba(56,189,248,0.10)] backdrop-blur">
        <p className="text-sm font-medium text-cyan-200">内容增长系统</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">企业档案</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">按步骤填写基本身份、客户信息与案例证明；保存后用于 内容诊断与内容生成。合规与发布边界由系统统一配置。</p>
      </div>

      <GeoStatusGuide
        stage="企业档案"
        completion={completionPercent}
        nextAction={primaryAction.label}
        why="企业档案是后续诊断与内容生成的事实来源。"
        risk="资料不足时不得编造案例、数据、价格和效果承诺。"
        ctaLabel={primaryAction.label}
        ctaPath={primaryAction.path}
      />

      <Card className="border-cyan-300/15 bg-white/[0.04] text-slate-100">
        <CardHeader>
          <CardDescription className="text-cyan-200">项目</CardDescription>
          <CardTitle className="text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-cyan-200" />
            新建或选择企业项目
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {projects.length === 0 ? (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-50">当前还没有项目，请先创建。</div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-300">
              <span className="font-medium text-slate-100">企业名称</span>
              <Input
                value={projectForm.enterpriseName}
                onChange={e => setProjectForm(f => ({ ...f, enterpriseName: e.target.value }))}
                className="border-white/10 bg-slate-950/70"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span className="font-medium text-slate-100">行业</span>
              <Input value={projectForm.industry} onChange={e => setProjectForm(f => ({ ...f, industry: e.target.value }))} className="border-white/10 bg-slate-950/70" />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span className="font-medium text-slate-100">官网</span>
              <Input value={projectForm.website} onChange={e => setProjectForm(f => ({ ...f, website: e.target.value }))} className="border-white/10 bg-slate-950/70" />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span className="font-medium text-slate-100">地区</span>
              <Input value={projectForm.region} onChange={e => setProjectForm(f => ({ ...f, region: e.target.value }))} className="border-white/10 bg-slate-950/70" />
            </label>
          </div>
          <div className="flex justify-end">
            <Button disabled={saving} onClick={() => void handleCreateProject()} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
              {createProject.isPending ? "创建中…" : "创建企业项目"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.04]">
        <CardHeader>
          <CardDescription className="text-cyan-200">当前项目</CardDescription>
          <CardTitle className="text-white">选择项目</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <select
            disabled={loading}
            value={selectedProjectId ?? ""}
            onChange={e => setSelectedProjectId(Number(e.target.value) || undefined)}
            className="h-10 w-full max-w-md rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <option value="">请选择项目</option>
            {projects.map(pr => (
              <option key={pr.id} value={pr.id}>
                {pr.enterpriseName}
              </option>
            ))}
          </select>
          {loading ? <div className="text-sm text-slate-400">正在加载…</div> : null}
          {queryError ? <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-3 text-sm text-red-100">{queryError}</div> : null}
          {message ? <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">{message}</div> : null}
          {error ? <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-3 text-sm text-red-100">{error}</div> : null}
        </CardContent>
      </Card>

      {selectedProjectId ? (
        <>
          <Card className="border-white/10 bg-slate-950/56">
            <CardHeader>
              <CardTitle className="text-white">Section 1 · 基本身份</CardTitle>
              <CardDescription className="text-slate-400">企业定位与产品一句话，用于后续内容与诊断。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <label className="space-y-2 text-sm text-slate-300">
                <span className="font-medium text-slate-100">企业/品牌名称（必填）</span>
                <Input value={brandName} onChange={e => setBrandName(e.target.value)} className="border-white/10 bg-slate-950/70" />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-300">
                  <span className="font-medium text-slate-100">行业方向（必填）</span>
                  <select
                    value={industrySelect}
                    onChange={e => setIndustrySelect(e.target.value)}
                    className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    {INDUSTRY_OPTIONS.map(o => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
                {industrySelect === "其他" ? (
                  <label className="space-y-2 text-sm text-slate-300">
                    <span className="font-medium text-slate-100">自定义行业</span>
                    <Input value={industryCustom} onChange={e => setIndustryCustom(e.target.value)} placeholder="请输入行业" className="border-white/10 bg-slate-950/70" />
                  </label>
                ) : null}
              </div>
              <label className="space-y-2 text-sm text-slate-300">
                <span className="font-medium text-slate-100">你主要卖什么（必填，200 字内）</span>
                <textarea
                  value={productDesc}
                  maxLength={200}
                  onChange={e => setProductDesc(e.target.value)}
                  placeholder="描述你的产品或服务，200字以内"
                  rows={4}
                  className="w-full resize-y rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                />
                <span className="text-xs text-slate-500">{productDesc.length}/200</span>
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span className="font-medium text-slate-100">主要阵地（选填）</span>
                <Input
                  value={mainChannel}
                  onChange={e => setMainChannel(e.target.value)}
                  placeholder="官网/抖音号/公众号，任填一个"
                  className="border-white/10 bg-slate-950/70"
                />
              </label>
              <div className="flex justify-end">
                <Button
                  className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
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
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-slate-950/56">
            <CardHeader>
              <CardTitle className="text-white">Section 2 · 你的客户</CardTitle>
              <CardDescription className="text-slate-400">客户画像与痛点，用于内容与 AI 生成区。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <label className="space-y-2 text-sm text-slate-300">
                <span className="font-medium text-slate-100">目标客户是谁（必填）</span>
                <textarea
                  value={targetCustomer}
                  onChange={e => setTargetCustomer(e.target.value)}
                  placeholder="描述你的典型客户"
                  rows={4}
                  className="w-full resize-y rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                />
              </label>
              <div className="space-y-2 text-sm text-slate-300">
                <span className="font-medium text-slate-100">客户最大的痛点（必填，至少 1 个）</span>
                <div className="flex flex-wrap gap-3 pt-1">
                  {PAIN_PRESETS.map(p => (
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
                    .filter(p => !PAIN_PRESETS.includes(p as (typeof PAIN_PRESETS)[number]))
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
                <span className="font-medium text-slate-100">主要竞品（选填，回车添加）</span>
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
              <div className="flex justify-end">
                <Button
                  className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
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
            </CardContent>
          </Card>

          {showAiCard ? (
            <Card className="border-white/10 bg-slate-950/56">
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="text-white">AI 已为你生成以下内容，确认后保存</CardTitle>
                  <CardDescription className="text-slate-400">基于基本身份与客户信息生成，可手动修改。</CardDescription>
                </div>
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
              </CardHeader>
              <CardContent className="space-y-4">
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
                <div className="flex justify-end">
                  <Button
                    className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
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
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-white/10 bg-slate-950/56">
            <CardHeader>
              <CardTitle className="text-white">Section 3 · 有什么证明</CardTitle>
              <CardDescription className="text-slate-400">客户案例可选；与内容生成引用策略相关。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setCasesChoice("has")}
                  className={`rounded-2xl border p-4 text-left text-sm transition ${casesChoice === "has" ? "border-cyan-400/60 bg-cyan-400/10 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"}`}
                >
                  <span className="font-medium text-cyan-100">有可以引用的客户案例</span>
                  <p className="mt-1 text-xs text-slate-500">填写并保存至少一条案例</p>
                </button>
                <button
                  type="button"
                  onClick={() => setCasesChoice("none")}
                  className={`rounded-2xl border p-4 text-left text-sm transition ${casesChoice === "none" ? "border-cyan-400/60 bg-cyan-400/10 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"}`}
                >
                  <span className="font-medium text-cyan-100">暂时没有，跳过</span>
                  <p className="mt-1 text-xs text-slate-500">内容生成不引用具体案例</p>
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
                <div className="space-y-6">
                  {caseRows.map((row, idx) => (
                    <div key={row.id ?? `new-${idx}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
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
                                projectId: selectedProjectId,
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
            </CardContent>
          </Card>

          <div className="rounded-3xl border border-white/10 bg-slate-950/70 px-5 py-4 text-center">
            <p className="text-xs uppercase tracking-wide text-slate-500">资料完整度</p>
            <p className="mt-1 text-3xl font-semibold text-cyan-200">{completionPercent}%</p>
            <p className="mt-2 text-xs text-slate-400">必填项 60% · 案例区 20% · AI 生成三项 20%</p>
            <div className="mt-4 flex justify-center gap-3">
              <Button variant="outline" className="border-white/15" onClick={() => setLocation("/ai-diagnosis")}>
                进入内容诊断
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
