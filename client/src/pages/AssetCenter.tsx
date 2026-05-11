import { GeoStatusGuide } from "@/components/GeoStatusGuide";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Building2, CheckCircle2, FileText, Globe2, KeyRound, ShieldCheck, Target, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const profileSections = [
  { key: "profile", title: "企业基础资料", icon: Building2, desc: "企业名称、行业、官网、区域和品牌实体信息。" },
  { key: "product", title: "产品服务资料", icon: FileText, desc: "产品服务说明、核心能力、服务流程和交付边界。" },
  { key: "cases", title: "客户案例", icon: Users, desc: "真实客户场景、可公开案例和待补充案例线索。" },
  { key: "competitors", title: "竞品资料", icon: Target, desc: "主要竞品、差异点和客户常见比较问题。" },
  { key: "compliance", title: "合规规则", icon: ShieldCheck, desc: "禁用词、不可承诺事项和需人工确认的信息。" },
  { key: "publishing", title: "发布策略", icon: Globe2, desc: "官网内容页与第三方平台素材的发布边界。" },
] as const;

type SummaryLike = {
  profile?: Record<string, unknown> | null;
  completionScore?: number | null;
  riskReminders?: string[];
  customerCases?: Array<Record<string, unknown>>;
  competitors?: Array<Record<string, unknown>>;
  complianceRules?: Array<Record<string, unknown>>;
  styleProfiles?: Array<Record<string, unknown>>;
  publishStrategies?: Array<Record<string, unknown>>;
  platformAuthorizations?: Array<Record<string, unknown>>;
  counts?: Record<string, number>;
};

type ProfileForm = {
  enterpriseName: string;
  shortName: string;
  officialWebsite: string;
  industry: string;
  region: string;
  productServiceIntro: string;
  targetCustomers: string;
  coreSellingPoints: string;
  servicePriceRange: string;
  serviceModel: string;
  fitCustomers: string;
  unfitCustomers: string;
  salesChannelsText: string;
  commonQuestionsText: string;
  purchaseDecisionFactorsText: string;
  productIntro: string;
  featureNotes: string;
  serviceProcess: string;
  deliveryPlan: string;
  afterSalesService: string;
  competitorDifference: string;
  priceExplanation: string;
  salesTalkTracks: string;
  commonObjections: string;
};

type CaseForm = {
  id?: number;
  caseType: "真实案例" | "待补充案例线索";
  customerName: string;
  customerIndustry: string;
  customerBackground: string;
  originalProblem: string;
  chosenReason: string;
  usedProductService: string;
  executionProcess: string;
  resultData: string;
  customerFeedback: string;
  allowPublic: boolean;
  publicVersion: string;
  sensitiveNotes: string;
  verificationStatus: "待确认" | "已确认" | "信息不足" | "不可公开";
};

type CompetitorForm = {
  id?: number;
  competitorName: string;
  website: string;
  positioning: string;
  strengths: string;
  weaknesses: string;
  priceInfo: string;
  contentAssets: string;
  aiRecommendationSignals: string;
  comparisonNotes: string;
  canReference: boolean;
};

type ComplianceForm = {
  id?: number;
  ruleName: string;
  forbiddenClaims: string;
  forbiddenWordsText: string;
  requiredDisclaimers: string;
  dataUsageRules: string;
  caseUsageRules: string;
  priceUsageRules: string;
  competitorMentionRules: string;
  reviewRequiredTopicsText: string;
  enabled: boolean;
};

type PublishForm = {
  id?: number;
  strategyName: string;
  reviewMode: "全人工审核" | "高分自动发布" | "全自动发布";
  dailyLimit: string;
  minQualityScore: string;
  preferredPlatformsText: string;
  bannedPlatformsText: string;
  platformNotes: string;
  enabled: boolean;
};

type PlatformAuthForm = {
  id?: number;
  platformName: string;
  accountAlias: string;
  authorizationStatus: "未配置" | "待人工授权" | "已授权" | "已失效" | "无需授权";
  secureCredentialRef: string;
  authorizationNotes: string;
};

const emptyProfileForm: ProfileForm = {
  enterpriseName: "",
  shortName: "",
  officialWebsite: "",
  industry: "",
  region: "",
  productServiceIntro: "",
  targetCustomers: "",
  coreSellingPoints: "",
  servicePriceRange: "",
  serviceModel: "",
  fitCustomers: "",
  unfitCustomers: "",
  salesChannelsText: "",
  commonQuestionsText: "",
  purchaseDecisionFactorsText: "",
  productIntro: "",
  featureNotes: "",
  serviceProcess: "",
  deliveryPlan: "",
  afterSalesService: "",
  competitorDifference: "",
  priceExplanation: "",
  salesTalkTracks: "",
  commonObjections: "",
};

const emptyCaseForm: CaseForm = {
  caseType: "真实案例",
  customerName: "",
  customerIndustry: "",
  customerBackground: "",
  originalProblem: "",
  chosenReason: "",
  usedProductService: "",
  executionProcess: "",
  resultData: "",
  customerFeedback: "",
  allowPublic: false,
  publicVersion: "",
  sensitiveNotes: "",
  verificationStatus: "待确认",
};

const emptyCompetitorForm: CompetitorForm = {
  competitorName: "",
  website: "",
  positioning: "",
  strengths: "",
  weaknesses: "",
  priceInfo: "",
  contentAssets: "",
  aiRecommendationSignals: "",
  comparisonNotes: "",
  canReference: true,
};

const emptyComplianceForm: ComplianceForm = {
  ruleName: "默认合规规则",
  forbiddenClaims: "",
  forbiddenWordsText: "",
  requiredDisclaimers: "",
  dataUsageRules: "",
  caseUsageRules: "",
  priceUsageRules: "",
  competitorMentionRules: "",
  reviewRequiredTopicsText: "",
  enabled: true,
};

const emptyPublishForm: PublishForm = {
  strategyName: "官网 GEO 内容页发布策略",
  reviewMode: "全人工审核",
  dailyLimit: "3",
  minQualityScore: "80",
  preferredPlatformsText: "GEO 内容页",
  bannedPlatformsText: "自动登录第三方平台",
  platformNotes: "本轮只自动发布官网 GEO 内容页；公众号、知乎、小红书、百家号/头条号仅生成可复制素材。",
  enabled: true,
};

const emptyPlatformAuthForm: PlatformAuthForm = {
  platformName: "公众号 / 知乎 / 小红书",
  accountAlias: "",
  authorizationStatus: "待人工授权",
  secureCredentialRef: "",
  authorizationNotes: "仅记录授权状态和外部安全凭证引用，不填写账号密码、Cookie 或 Token；第三方平台仍由人工复制素材后发布。",
};

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function boolValue(value: unknown, defaultValue = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return defaultValue;
}

function joinList(value: unknown) {
  return Array.isArray(value) ? value.filter(item => typeof item === "string" && item.trim()).join("、") : "";
}

function splitList(value: string) {
  return value.split(/[、,，\n]/).map(item => item.trim()).filter(Boolean);
}

function sectionStatus(summary: SummaryLike | undefined, key: string) {
  if (!summary) return { label: "待读取", tone: "border-slate-500/20 bg-slate-500/10 text-slate-200" };
  const profile = summary.profile ?? undefined;
  const hasProfile = Boolean(profile?.enterpriseName && profile?.industry && profile?.officialWebsite);
  const hasProduct = Boolean(profile?.productServiceIntro || profile?.productIntro || profile?.coreSellingPoints);
  const counts = summary.counts;
  const value = key === "profile"
    ? hasProfile
    : key === "product"
      ? hasProduct
      : key === "cases"
        ? (counts?.customerCases ?? summary.customerCases?.length ?? 0) > 0
        : key === "competitors"
          ? (counts?.competitors ?? summary.competitors?.length ?? 0) > 0
          : key === "compliance"
            ? (counts?.complianceRules ?? summary.complianceRules?.length ?? 0) > 0
            : (counts?.publishStrategies ?? summary.publishStrategies?.length ?? 0) > 0;
  return value ? { label: "已补齐", tone: "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" } : { label: "待补齐", tone: "border-amber-300/20 bg-amber-400/10 text-amber-100" };
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="space-y-2 text-sm text-slate-300">
      <span className="font-medium text-slate-100">{label}</span>
      <input type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-cyan-400" />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; rows?: number }) {
  return (
    <label className="space-y-2 text-sm text-slate-300">
      <span className="font-medium text-slate-100">{label}</span>
      <textarea value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} rows={rows} className="w-full resize-y rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-cyan-400" />
    </label>
  );
}

function SelectField<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: T[] }) {
  return (
    <label className="space-y-2 text-sm text-slate-300">
      <span className="font-medium text-slate-100">{label}</span>
      <select value={value} onChange={event => onChange(event.target.value as T)} className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200">
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="h-4 w-4 rounded border-white/20 bg-slate-950" />
      {label}
    </label>
  );
}

export default function AssetCenterPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: projects = [] } = trpc.geo.projects.list.useQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfileForm);
  const [caseForm, setCaseForm] = useState<CaseForm>(emptyCaseForm);
  const [competitorForm, setCompetitorForm] = useState<CompetitorForm>(emptyCompetitorForm);
  const [complianceForm, setComplianceForm] = useState<ComplianceForm>(emptyComplianceForm);
  const [publishForm, setPublishForm] = useState<PublishForm>(emptyPublishForm);
  const [platformAuthForm, setPlatformAuthForm] = useState<PlatformAuthForm>(emptyPlatformAuthForm);

  const upsertProfile = trpc.geo.assetLibrary.upsertProfile.useMutation();
  const createCustomerCase = trpc.geo.assetLibrary.createCustomerCase.useMutation();
  const updateCustomerCase = trpc.geo.assetLibrary.updateCustomerCase.useMutation();
  const createCompetitor = trpc.geo.assetLibrary.createCompetitor.useMutation();
  const updateCompetitor = trpc.geo.assetLibrary.updateCompetitor.useMutation();
  const createComplianceRule = trpc.geo.assetLibrary.createComplianceRule.useMutation();
  const updateComplianceRule = trpc.geo.assetLibrary.updateComplianceRule.useMutation();
  const createPublishStrategy = trpc.geo.assetLibrary.createPublishStrategy.useMutation();
  const updatePublishStrategy = trpc.geo.assetLibrary.updatePublishStrategy.useMutation();
  const createPlatformAuthorization = trpc.geo.assetLibrary.createPlatformAuthorization.useMutation();
  const updatePlatformAuthorization = trpc.geo.assetLibrary.updatePlatformAuthorization.useMutation();

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  const projectInput = useMemo(() => ({ projectId: selectedProjectId }), [selectedProjectId]);
  const { data: summaryData, isLoading } = trpc.geo.assetLibrary.summary.useQuery(projectInput, { enabled: Boolean(selectedProjectId) });
  const summary = summaryData as SummaryLike | undefined;
  const completionScore = summary?.completionScore ?? 0;
  const riskReminders = summary?.riskReminders?.length ? summary.riskReminders : ["资料不足时，系统不得编造案例、数据、价格和效果承诺。"];
  const primaryAction = completionScore >= 60 ? { label: "进入 AI 诊断", path: "/ai-diagnosis" } : { label: "补齐企业档案", path: "/enterprise-profile" };
  const saving = upsertProfile.isPending || createCustomerCase.isPending || updateCustomerCase.isPending || createCompetitor.isPending || updateCompetitor.isPending || createComplianceRule.isPending || updateComplianceRule.isPending || createPublishStrategy.isPending || updatePublishStrategy.isPending || createPlatformAuthorization.isPending || updatePlatformAuthorization.isPending;

  useEffect(() => {
    const profile = summary?.profile;
    const firstCase = summary?.customerCases?.[0];
    const firstCompetitor = summary?.competitors?.[0];
    const firstCompliance = summary?.complianceRules?.[0];
    const firstPublish = summary?.publishStrategies?.[0];
    const firstAuthorization = summary?.platformAuthorizations?.[0];
    const selectedProject = projects.find(project => project.id === selectedProjectId);

    setProfileForm({
      enterpriseName: textValue(profile?.enterpriseName) || selectedProject?.enterpriseName || "",
      shortName: textValue(profile?.shortName),
      officialWebsite: textValue(profile?.officialWebsite),
      industry: textValue(profile?.industry),
      region: textValue(profile?.region),
      productServiceIntro: textValue(profile?.productServiceIntro),
      targetCustomers: textValue(profile?.targetCustomers),
      coreSellingPoints: textValue(profile?.coreSellingPoints),
      servicePriceRange: textValue(profile?.servicePriceRange),
      serviceModel: textValue(profile?.serviceModel),
      fitCustomers: textValue(profile?.fitCustomers),
      unfitCustomers: textValue(profile?.unfitCustomers),
      salesChannelsText: joinList(profile?.salesChannels),
      commonQuestionsText: joinList(profile?.commonQuestions),
      purchaseDecisionFactorsText: joinList(profile?.purchaseDecisionFactors),
      productIntro: textValue(profile?.productIntro),
      featureNotes: textValue(profile?.featureNotes),
      serviceProcess: textValue(profile?.serviceProcess),
      deliveryPlan: textValue(profile?.deliveryPlan),
      afterSalesService: textValue(profile?.afterSalesService),
      competitorDifference: textValue(profile?.competitorDifference),
      priceExplanation: textValue(profile?.priceExplanation),
      salesTalkTracks: textValue(profile?.salesTalkTracks),
      commonObjections: textValue(profile?.commonObjections),
    });
    setCaseForm(firstCase ? {
      id: numberValue(firstCase.id),
      caseType: (textValue(firstCase.caseType) || "真实案例") as CaseForm["caseType"],
      customerName: textValue(firstCase.customerName),
      customerIndustry: textValue(firstCase.customerIndustry),
      customerBackground: textValue(firstCase.customerBackground),
      originalProblem: textValue(firstCase.originalProblem),
      chosenReason: textValue(firstCase.chosenReason),
      usedProductService: textValue(firstCase.usedProductService),
      executionProcess: textValue(firstCase.executionProcess),
      resultData: textValue(firstCase.resultData),
      customerFeedback: textValue(firstCase.customerFeedback),
      allowPublic: boolValue(firstCase.allowPublic),
      publicVersion: textValue(firstCase.publicVersion),
      sensitiveNotes: textValue(firstCase.sensitiveNotes),
      verificationStatus: (textValue(firstCase.verificationStatus) || "待确认") as CaseForm["verificationStatus"],
    } : emptyCaseForm);
    setCompetitorForm(firstCompetitor ? {
      id: numberValue(firstCompetitor.id),
      competitorName: textValue(firstCompetitor.competitorName),
      website: textValue(firstCompetitor.website),
      positioning: textValue(firstCompetitor.positioning),
      strengths: textValue(firstCompetitor.strengths),
      weaknesses: textValue(firstCompetitor.weaknesses),
      priceInfo: textValue(firstCompetitor.priceInfo),
      contentAssets: textValue(firstCompetitor.contentAssets),
      aiRecommendationSignals: textValue(firstCompetitor.aiRecommendationSignals),
      comparisonNotes: textValue(firstCompetitor.comparisonNotes),
      canReference: boolValue(firstCompetitor.canReference, true),
    } : emptyCompetitorForm);
    setComplianceForm(firstCompliance ? {
      id: numberValue(firstCompliance.id),
      ruleName: textValue(firstCompliance.ruleName) || "默认合规规则",
      forbiddenClaims: textValue(firstCompliance.forbiddenClaims),
      forbiddenWordsText: joinList(firstCompliance.forbiddenWords),
      requiredDisclaimers: textValue(firstCompliance.requiredDisclaimers),
      dataUsageRules: textValue(firstCompliance.dataUsageRules),
      caseUsageRules: textValue(firstCompliance.caseUsageRules),
      priceUsageRules: textValue(firstCompliance.priceUsageRules),
      competitorMentionRules: textValue(firstCompliance.competitorMentionRules),
      reviewRequiredTopicsText: joinList(firstCompliance.reviewRequiredTopics),
      enabled: boolValue(firstCompliance.enabled, true),
    } : emptyComplianceForm);
    setPublishForm(firstPublish ? {
      id: numberValue(firstPublish.id),
      strategyName: textValue(firstPublish.strategyName) || "官网 GEO 内容页发布策略",
      reviewMode: (textValue(firstPublish.reviewMode) || "全人工审核") as PublishForm["reviewMode"],
      dailyLimit: firstPublish.dailyLimit === null || firstPublish.dailyLimit === undefined ? "" : String(firstPublish.dailyLimit),
      minQualityScore: firstPublish.minQualityScore === null || firstPublish.minQualityScore === undefined ? "80" : String(firstPublish.minQualityScore),
      preferredPlatformsText: joinList(firstPublish.preferredPlatforms),
      bannedPlatformsText: joinList(firstPublish.bannedPlatforms),
      platformNotes: textValue(firstPublish.platformNotes),
      enabled: boolValue(firstPublish.enabled, true),
    } : emptyPublishForm);
    setPlatformAuthForm(firstAuthorization ? {
      id: numberValue(firstAuthorization.id),
      platformName: textValue(firstAuthorization.platformName) || "公众号 / 知乎 / 小红书",
      accountAlias: textValue(firstAuthorization.accountAlias),
      authorizationStatus: (textValue(firstAuthorization.authorizationStatus) || "待人工授权") as PlatformAuthForm["authorizationStatus"],
      secureCredentialRef: textValue(firstAuthorization.secureCredentialRef),
      authorizationNotes: textValue(firstAuthorization.authorizationNotes) || "仅记录授权状态和外部安全凭证引用，不填写账号密码、Cookie 或 Token；第三方平台仍由人工复制素材后发布。",
    } : emptyPlatformAuthForm);
  }, [summary, projects, selectedProjectId]);

  async function refreshSummary() {
    if (!selectedProjectId) return;
    await utils.geo.assetLibrary.summary.invalidate({ projectId: selectedProjectId });
  }

  async function runSave(label: string, callback: () => Promise<unknown>) {
    if (!selectedProjectId) return;
    setMessage(undefined);
    setError(undefined);
    try {
      await callback();
      await refreshSummary();
      setMessage(`${label}已保存，后续诊断与内容生成将引用最新企业资料。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label}保存失败`);
    }
  }

  function profilePayload() {
    if (!selectedProjectId) throw new Error("请先选择项目");
    return {
      projectId: selectedProjectId,
      enterpriseName: profileForm.enterpriseName.trim(),
      shortName: profileForm.shortName,
      officialWebsite: profileForm.officialWebsite,
      industry: profileForm.industry,
      region: profileForm.region,
      productServiceIntro: profileForm.productServiceIntro,
      targetCustomers: profileForm.targetCustomers,
      coreSellingPoints: profileForm.coreSellingPoints,
      servicePriceRange: profileForm.servicePriceRange,
      serviceModel: profileForm.serviceModel,
      fitCustomers: profileForm.fitCustomers,
      unfitCustomers: profileForm.unfitCustomers,
      salesChannels: splitList(profileForm.salesChannelsText),
      commonQuestions: splitList(profileForm.commonQuestionsText),
      purchaseDecisionFactors: splitList(profileForm.purchaseDecisionFactorsText),
      productIntro: profileForm.productIntro,
      featureNotes: profileForm.featureNotes,
      serviceProcess: profileForm.serviceProcess,
      deliveryPlan: profileForm.deliveryPlan,
      afterSalesService: profileForm.afterSalesService,
      competitorDifference: profileForm.competitorDifference,
      priceExplanation: profileForm.priceExplanation,
      salesTalkTracks: profileForm.salesTalkTracks,
      commonObjections: profileForm.commonObjections,
    };
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-6 text-slate-100 shadow-[0_0_34px_rgba(56,189,248,0.10)] backdrop-blur">
        <p className="text-sm font-medium text-cyan-200">AI GEO 增长工作台</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">企业档案</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">企业档案页现在可直接编辑企业基础资料、产品服务资料、客户案例、竞品资料、合规规则和发布策略六类资料。当前页面只保留一个主动作，并把补齐资料或进入 AI 诊断作为唯一下一步。保存后，诊断、文章生成、质检和发布准入会引用这些事实来源。</p>
      </div>
      <GeoStatusGuide stage="企业档案" completion={completionScore} nextAction={primaryAction.label} why="企业档案是 AI 诊断、内容生成和发布准入的事实来源。" risk="资料不足时不得编造案例、数据、价格和效果承诺。" ctaLabel={primaryAction.label} ctaPath={primaryAction.path} />

      <Card className="border-white/10 bg-white/[0.04] text-slate-100">
        <CardHeader>
          <CardDescription className="text-cyan-200">当前项目</CardDescription>
          <CardTitle className="text-white">企业资料状态</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <select value={selectedProjectId ?? ""} onChange={event => setSelectedProjectId(Number(event.target.value) || undefined)} className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 md:max-w-md">
            <option value="">请选择项目</option>
            {projects.map(project => <option key={project.id} value={project.id}>{project.enterpriseName}</option>)}
          </select>
          {message ? <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-100">{message}</div> : null}
          {error ? <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-sm leading-6 text-red-100">{error}</div> : null}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {profileSections.map(section => {
              const Icon = section.icon;
              const status = sectionStatus(summary, section.key);
              return (
                <div key={section.key} className="rounded-3xl border border-white/10 bg-slate-950/56 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200"><Icon className="h-5 w-5" /></div>
                    <span className={`rounded-full border px-3 py-1 text-xs ${status.tone}`}>{isLoading ? "读取中" : status.label}</span>
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-white">{section.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{section.desc}</p>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">资料完整度：{completionScore}%</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">六类资料会作为文章生成依据，缺失时系统必须阻断编造案例、效果、价格和第三方自动发布。</p>
            </div>
            <Button onClick={() => setLocation(primaryAction.path)} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{primaryAction.label}</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.04] text-slate-100">
        <CardHeader><CardTitle className="text-white">企业基础资料</CardTitle><CardDescription className="text-cyan-200">用于建立企业实体识别、官网归因和行业语境。</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2"><Field label="企业名称" value={profileForm.enterpriseName} onChange={value => setProfileForm(form => ({ ...form, enterpriseName: value }))} /><Field label="简称" value={profileForm.shortName} onChange={value => setProfileForm(form => ({ ...form, shortName: value }))} /><Field label="官网" value={profileForm.officialWebsite} onChange={value => setProfileForm(form => ({ ...form, officialWebsite: value }))} /><Field label="行业" value={profileForm.industry} onChange={value => setProfileForm(form => ({ ...form, industry: value }))} /><Field label="区域" value={profileForm.region} onChange={value => setProfileForm(form => ({ ...form, region: value }))} /><Field label="销售渠道（用顿号或逗号分隔）" value={profileForm.salesChannelsText} onChange={value => setProfileForm(form => ({ ...form, salesChannelsText: value }))} /></div>
          <TextArea label="目标客户" value={profileForm.targetCustomers} onChange={value => setProfileForm(form => ({ ...form, targetCustomers: value }))} />
          <TextArea label="常见客户问题（用顿号、逗号或换行分隔）" value={profileForm.commonQuestionsText} onChange={value => setProfileForm(form => ({ ...form, commonQuestionsText: value }))} />
          <TextArea label="购买决策因素（用顿号、逗号或换行分隔）" value={profileForm.purchaseDecisionFactorsText} onChange={value => setProfileForm(form => ({ ...form, purchaseDecisionFactorsText: value }))} />
          <div className="flex justify-end"><Button disabled={!selectedProjectId || saving} onClick={() => runSave("企业基础资料", () => upsertProfile.mutateAsync(profilePayload()))} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">保存企业基础资料</Button></div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.04] text-slate-100">
        <CardHeader><CardTitle className="text-white">产品服务资料</CardTitle><CardDescription className="text-cyan-200">用于内容生成时引用产品能力、服务流程和适配边界。</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <TextArea label="产品服务简介" value={profileForm.productServiceIntro} onChange={value => setProfileForm(form => ({ ...form, productServiceIntro: value }))} />
          <TextArea label="产品详细介绍" value={profileForm.productIntro} onChange={value => setProfileForm(form => ({ ...form, productIntro: value }))} />
          <TextArea label="核心卖点" value={profileForm.coreSellingPoints} onChange={value => setProfileForm(form => ({ ...form, coreSellingPoints: value }))} />
          <div className="grid gap-4 md:grid-cols-2"><TextArea label="服务流程" value={profileForm.serviceProcess} onChange={value => setProfileForm(form => ({ ...form, serviceProcess: value }))} /><TextArea label="交付方案" value={profileForm.deliveryPlan} onChange={value => setProfileForm(form => ({ ...form, deliveryPlan: value }))} /><TextArea label="售后服务" value={profileForm.afterSalesService} onChange={value => setProfileForm(form => ({ ...form, afterSalesService: value }))} /><TextArea label="竞品差异" value={profileForm.competitorDifference} onChange={value => setProfileForm(form => ({ ...form, competitorDifference: value }))} /></div>
          <div className="grid gap-4 md:grid-cols-2"><Field label="价格区间" value={profileForm.servicePriceRange} onChange={value => setProfileForm(form => ({ ...form, servicePriceRange: value }))} /><TextArea label="价格说明" value={profileForm.priceExplanation} onChange={value => setProfileForm(form => ({ ...form, priceExplanation: value }))} /></div>
          <div className="grid gap-4 md:grid-cols-2"><TextArea label="适合客户" value={profileForm.fitCustomers} onChange={value => setProfileForm(form => ({ ...form, fitCustomers: value }))} /><TextArea label="不适合客户" value={profileForm.unfitCustomers} onChange={value => setProfileForm(form => ({ ...form, unfitCustomers: value }))} /></div>
          <TextArea label="销售话术与常见异议" value={`${profileForm.salesTalkTracks}${profileForm.commonObjections ? `\n\n常见异议：${profileForm.commonObjections}` : ""}`} onChange={value => setProfileForm(form => ({ ...form, salesTalkTracks: value, commonObjections: form.commonObjections }))} />
          <div className="flex justify-end"><Button disabled={!selectedProjectId || saving} onClick={() => runSave("产品服务资料", () => upsertProfile.mutateAsync(profilePayload()))} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">保存产品服务资料</Button></div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.04] text-slate-100">
        <CardHeader><CardTitle className="text-white">客户案例</CardTitle><CardDescription className="text-cyan-200">仅保存已确认或待补充线索；没有真实资料时不会编造案例。</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3"><SelectField label="案例类型" value={caseForm.caseType} onChange={value => setCaseForm(form => ({ ...form, caseType: value }))} options={["真实案例", "待补充案例线索"]} /><Field label="客户名称" value={caseForm.customerName} onChange={value => setCaseForm(form => ({ ...form, customerName: value }))} /><Field label="客户行业" value={caseForm.customerIndustry} onChange={value => setCaseForm(form => ({ ...form, customerIndustry: value }))} /></div>
          <div className="grid gap-4 md:grid-cols-2"><TextArea label="客户背景" value={caseForm.customerBackground} onChange={value => setCaseForm(form => ({ ...form, customerBackground: value }))} /><TextArea label="原始问题" value={caseForm.originalProblem} onChange={value => setCaseForm(form => ({ ...form, originalProblem: value }))} /><TextArea label="选择原因" value={caseForm.chosenReason} onChange={value => setCaseForm(form => ({ ...form, chosenReason: value }))} /><TextArea label="使用产品服务" value={caseForm.usedProductService} onChange={value => setCaseForm(form => ({ ...form, usedProductService: value }))} /><TextArea label="执行过程" value={caseForm.executionProcess} onChange={value => setCaseForm(form => ({ ...form, executionProcess: value }))} /><TextArea label="结果数据" value={caseForm.resultData} onChange={value => setCaseForm(form => ({ ...form, resultData: value }))} /></div>
          <TextArea label="客户反馈" value={caseForm.customerFeedback} onChange={value => setCaseForm(form => ({ ...form, customerFeedback: value }))} />
          <TextArea label="公开版本与敏感说明" value={`${caseForm.publicVersion}${caseForm.sensitiveNotes ? `\n\n敏感说明：${caseForm.sensitiveNotes}` : ""}`} onChange={value => setCaseForm(form => ({ ...form, publicVersion: value }))} />
          <div className="grid gap-4 md:grid-cols-2"><SelectField label="核验状态" value={caseForm.verificationStatus} onChange={value => setCaseForm(form => ({ ...form, verificationStatus: value }))} options={["待确认", "已确认", "信息不足", "不可公开"]} /><CheckField label="允许公开引用" checked={caseForm.allowPublic} onChange={checked => setCaseForm(form => ({ ...form, allowPublic: checked }))} /></div>
          <div className="flex justify-end"><Button disabled={!selectedProjectId || saving} onClick={() => runSave("客户案例", () => {
            if (!selectedProjectId) throw new Error("请先选择项目");
            const payload = { ...caseForm, projectId: selectedProjectId, sourceAssetIds: [] };
            return caseForm.id ? updateCustomerCase.mutateAsync({ ...payload, id: caseForm.id }) : createCustomerCase.mutateAsync(payload);
          })} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{caseForm.id ? "更新客户案例" : "新增客户案例"}</Button></div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.04] text-slate-100">
        <CardHeader><CardTitle className="text-white">竞品资料</CardTitle><CardDescription className="text-cyan-200">用于解释差距与对比，但不会夸大竞品或企业能力。</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2"><Field label="竞品名称" value={competitorForm.competitorName} onChange={value => setCompetitorForm(form => ({ ...form, competitorName: value }))} /><Field label="官网" value={competitorForm.website} onChange={value => setCompetitorForm(form => ({ ...form, website: value }))} /></div>
          <div className="grid gap-4 md:grid-cols-2"><TextArea label="定位" value={competitorForm.positioning} onChange={value => setCompetitorForm(form => ({ ...form, positioning: value }))} /><TextArea label="优势" value={competitorForm.strengths} onChange={value => setCompetitorForm(form => ({ ...form, strengths: value }))} /><TextArea label="弱点" value={competitorForm.weaknesses} onChange={value => setCompetitorForm(form => ({ ...form, weaknesses: value }))} /><TextArea label="价格信息" value={competitorForm.priceInfo} onChange={value => setCompetitorForm(form => ({ ...form, priceInfo: value }))} /></div>
          <TextArea label="内容资产与 AI 推荐信号" value={`${competitorForm.contentAssets}${competitorForm.aiRecommendationSignals ? `\n\nAI 推荐信号：${competitorForm.aiRecommendationSignals}` : ""}`} onChange={value => setCompetitorForm(form => ({ ...form, contentAssets: value }))} />
          <TextArea label="对比说明" value={competitorForm.comparisonNotes} onChange={value => setCompetitorForm(form => ({ ...form, comparisonNotes: value }))} />
          <CheckField label="允许在内容中引用该竞品" checked={competitorForm.canReference} onChange={checked => setCompetitorForm(form => ({ ...form, canReference: checked }))} />
          <div className="flex justify-end"><Button disabled={!selectedProjectId || saving} onClick={() => runSave("竞品资料", () => {
            if (!selectedProjectId) throw new Error("请先选择项目");
            const payload = { ...competitorForm, projectId: selectedProjectId, sourceAssetIds: [] };
            return competitorForm.id ? updateCompetitor.mutateAsync({ ...payload, id: competitorForm.id }) : createCompetitor.mutateAsync(payload);
          })} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{competitorForm.id ? "更新竞品资料" : "新增竞品资料"}</Button></div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.04] text-slate-100">
        <CardHeader><CardTitle className="text-white">合规规则</CardTitle><CardDescription className="text-cyan-200">用于质检时阻断虚假承诺、敏感价格和未经授权案例。</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <Field label="规则名称" value={complianceForm.ruleName} onChange={value => setComplianceForm(form => ({ ...form, ruleName: value }))} />
          <div className="grid gap-4 md:grid-cols-2"><TextArea label="禁止承诺" value={complianceForm.forbiddenClaims} onChange={value => setComplianceForm(form => ({ ...form, forbiddenClaims: value }))} /><TextArea label="禁用词（用顿号、逗号或换行分隔）" value={complianceForm.forbiddenWordsText} onChange={value => setComplianceForm(form => ({ ...form, forbiddenWordsText: value }))} /><TextArea label="必须声明" value={complianceForm.requiredDisclaimers} onChange={value => setComplianceForm(form => ({ ...form, requiredDisclaimers: value }))} /><TextArea label="需人工审核主题（用顿号、逗号或换行分隔）" value={complianceForm.reviewRequiredTopicsText} onChange={value => setComplianceForm(form => ({ ...form, reviewRequiredTopicsText: value }))} /></div>
          <div className="grid gap-4 md:grid-cols-2"><TextArea label="数据使用规则" value={complianceForm.dataUsageRules} onChange={value => setComplianceForm(form => ({ ...form, dataUsageRules: value }))} /><TextArea label="案例使用规则" value={complianceForm.caseUsageRules} onChange={value => setComplianceForm(form => ({ ...form, caseUsageRules: value }))} /><TextArea label="价格使用规则" value={complianceForm.priceUsageRules} onChange={value => setComplianceForm(form => ({ ...form, priceUsageRules: value }))} /><TextArea label="竞品提及规则" value={complianceForm.competitorMentionRules} onChange={value => setComplianceForm(form => ({ ...form, competitorMentionRules: value }))} /></div>
          <CheckField label="启用该规则" checked={complianceForm.enabled} onChange={checked => setComplianceForm(form => ({ ...form, enabled: checked }))} />
          <div className="flex justify-end"><Button disabled={!selectedProjectId || saving} onClick={() => runSave("合规规则", () => {
            if (!selectedProjectId) throw new Error("请先选择项目");
            const payload = { ...complianceForm, projectId: selectedProjectId, forbiddenWords: splitList(complianceForm.forbiddenWordsText), reviewRequiredTopics: splitList(complianceForm.reviewRequiredTopicsText) };
            const { forbiddenWordsText, reviewRequiredTopicsText, ...values } = payload;
            return complianceForm.id ? updateComplianceRule.mutateAsync({ ...values, id: complianceForm.id }) : createComplianceRule.mutateAsync(values);
          })} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{complianceForm.id ? "更新合规规则" : "新增合规规则"}</Button></div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.04] text-slate-100">
        <CardHeader><CardTitle className="text-white">发布策略</CardTitle><CardDescription className="text-cyan-200">明确自动发布边界：当前只自动发布 GEO 内容页，第三方平台只保留素材。</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2"><Field label="策略名称" value={publishForm.strategyName} onChange={value => setPublishForm(form => ({ ...form, strategyName: value }))} /><SelectField label="审核方式" value={publishForm.reviewMode} onChange={value => setPublishForm(form => ({ ...form, reviewMode: value }))} options={["全人工审核", "高分自动发布", "全自动发布"]} /><Field label="每日发布上限" value={publishForm.dailyLimit} onChange={value => setPublishForm(form => ({ ...form, dailyLimit: value }))} type="number" /><Field label="最低质量分" value={publishForm.minQualityScore} onChange={value => setPublishForm(form => ({ ...form, minQualityScore: value }))} type="number" /></div>
          <div className="grid gap-4 md:grid-cols-2"><TextArea label="优先平台（用顿号、逗号或换行分隔）" value={publishForm.preferredPlatformsText} onChange={value => setPublishForm(form => ({ ...form, preferredPlatformsText: value }))} /><TextArea label="禁止自动发布平台" value={publishForm.bannedPlatformsText} onChange={value => setPublishForm(form => ({ ...form, bannedPlatformsText: value }))} /></div>
          <TextArea label="平台说明" value={publishForm.platformNotes} onChange={value => setPublishForm(form => ({ ...form, platformNotes: value }))} />
          <CheckField label="启用该发布策略" checked={publishForm.enabled} onChange={checked => setPublishForm(form => ({ ...form, enabled: checked }))} />
          <div className="flex justify-end"><Button disabled={!selectedProjectId || saving} onClick={() => runSave("发布策略", () => {
            if (!selectedProjectId) throw new Error("请先选择项目");
            const payload = {
              projectId: selectedProjectId,
              strategyName: publishForm.strategyName,
              reviewMode: publishForm.reviewMode,
              dailyLimit: publishForm.dailyLimit.trim() ? Number(publishForm.dailyLimit) : null,
              minQualityScore: publishForm.minQualityScore.trim() ? Number(publishForm.minQualityScore) : 80,
              preferredPlatforms: splitList(publishForm.preferredPlatformsText),
              bannedPlatforms: splitList(publishForm.bannedPlatformsText),
              platformNotes: publishForm.platformNotes,
              enabled: publishForm.enabled,
            };
            return publishForm.id ? updatePublishStrategy.mutateAsync({ ...payload, id: publishForm.id }) : createPublishStrategy.mutateAsync(payload);
          })} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{publishForm.id ? "更新发布策略" : "新增发布策略"}</Button></div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.04] text-slate-100">
        <CardHeader><CardTitle className="flex items-center gap-2 text-white"><KeyRound className="h-5 w-5 text-cyan-200" /> 第三方平台授权</CardTitle><CardDescription className="text-cyan-200">只记录授权状态和安全凭证引用；系统不保存明文账号密码，也不会自动登录第三方平台发布。</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50">第三方平台发布是人工动作：内容发布页只提供可复制素材和阻断提示。即使状态为“已授权”，也必须由操作者人工确认平台规则、复制素材并点击第三方平台发布按钮。</div>
          <div className="grid gap-4 md:grid-cols-2"><Field label="平台名称" value={platformAuthForm.platformName} onChange={value => setPlatformAuthForm(form => ({ ...form, platformName: value }))} /><Field label="账号别名（不要填写密码）" value={platformAuthForm.accountAlias} onChange={value => setPlatformAuthForm(form => ({ ...form, accountAlias: value }))} /></div>
          <div className="grid gap-4 md:grid-cols-2"><SelectField label="授权状态" value={platformAuthForm.authorizationStatus} onChange={value => setPlatformAuthForm(form => ({ ...form, authorizationStatus: value }))} options={["未配置", "待人工授权", "已授权", "已失效", "无需授权"]} /><Field label="安全凭证引用（可选，不填明文）" value={platformAuthForm.secureCredentialRef} onChange={value => setPlatformAuthForm(form => ({ ...form, secureCredentialRef: value }))} placeholder="例如：企业密码库记录编号，不填密码/Token/Cookie" /></div>
          <TextArea label="授权备注（禁止填写密码、Token、Cookie）" value={platformAuthForm.authorizationNotes} onChange={value => setPlatformAuthForm(form => ({ ...form, authorizationNotes: value }))} rows={4} />
          <div className="flex justify-end"><Button disabled={!selectedProjectId || saving} onClick={() => runSave("第三方平台授权", () => {
            if (!selectedProjectId) throw new Error("请先选择项目");
            const payload = { projectId: selectedProjectId, ...platformAuthForm };
            return platformAuthForm.id ? updatePlatformAuthorization.mutateAsync({ ...payload, id: platformAuthForm.id }) : createPlatformAuthorization.mutateAsync(payload);
          })} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{platformAuthForm.id ? "更新授权状态" : "新增授权记录"}</Button></div>
        </CardContent>
      </Card>

      <Card className="border-amber-300/15 bg-amber-400/10 text-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-50"><AlertTriangle className="h-5 w-5" /> 风险说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {riskReminders.slice(0, 4).map((item, index) => <p key={`${item}-${index}`} className="text-sm leading-6">{item}</p>)}
          <p className="text-sm leading-6"><CheckCircle2 className="mr-2 inline h-4 w-4" />不承诺保证收录、保证排名或保证被 AI 推荐。</p>
        </CardContent>
      </Card>
    </div>
  );
}
