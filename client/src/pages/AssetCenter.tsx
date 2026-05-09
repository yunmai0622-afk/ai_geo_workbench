import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { GeoStatusGuide } from "@/components/GeoStatusGuide";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Archive, Building2, CheckCircle2, Database, FileText, LockKeyhole, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const sourceTypes = ["企业基础资料", "产品服务资料", "客户案例资料", "竞品资料", "合规资料", "内容风格资料", "发布策略资料", "通用资料"] as const;
const trustLevels = ["高", "中", "低"] as const;
const caseTypes = ["真实案例", "待补充案例线索"] as const;
const verificationStatuses = ["待确认", "已确认", "不可公开", "信息不足"] as const;
const reviewModes = ["全人工审核", "高分自动发布", "全自动发布"] as const;
const authorizationStatuses = ["未配置", "待人工授权", "已授权", "已失效", "无需授权"] as const;

const splitLines = (value: string) => value.split(/\n|,|，/).map(item => item.trim()).filter(Boolean);
const parseIds = (value: string) => splitLines(value).map(Number).filter(item => Number.isInteger(item) && item > 0);
const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

type SelectProps<T extends string> = {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
};

function SelectField<T extends string>({ label, value, options, onChange }: SelectProps<T>) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={event => onChange(event.target.value as T)}
        className="h-10 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-cyan-400"
      >
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="border-white/10 bg-slate-950/70 text-slate-100 placeholder:text-slate-500" />
    </div>
  );
}

function AreaField({ label, value, onChange, placeholder, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} rows={rows} className="border-white/10 bg-slate-950/70 text-slate-100 placeholder:text-slate-500" />
    </div>
  );
}

function SwitchLine({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-200">
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="mt-1" />
      <span><span className="font-medium">{label}</span>{hint ? <span className="block text-xs text-slate-400">{hint}</span> : null}</span>
    </label>
  );
}

function StatCard({ title, value, desc, icon: Icon }: { title: string; value: string; desc: string; icon: typeof Database }) {
  return (
    <div className="rounded-2xl border border-cyan-300/15 bg-slate-950/60 p-4 shadow-[0_0_24px_rgba(56,189,248,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-300">{title}</p>
        <Icon className="h-4 w-4 text-cyan-300" />
      </div>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{desc}</p>
    </div>
  );
}

export default function AssetCenterPage() {
  const utils = trpc.useUtils();
  const { data: projects = [] } = trpc.geo.projects.list.useQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>();

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  const { data: summary, isLoading } = trpc.geo.assetLibrary.summary.useQuery(
    { projectId: selectedProjectId },
    { enabled: Boolean(selectedProjectId) },
  );

  const invalidate = async () => {
    await utils.geo.assetLibrary.summary.invalidate();
  };

  const upsertProfile = trpc.geo.assetLibrary.upsertProfile.useMutation({ onSuccess: async data => { toast.success(`企业资料已保存，完整度 ${data.completionScore}%`); await invalidate(); } });
  const addTextSource = trpc.geo.assetLibrary.addTextSource.useMutation({ onSuccess: async () => { toast.success("资料来源已保存"); await invalidate(); } });
  const addUploadedSource = trpc.geo.assetLibrary.addUploadedSource.useMutation({ onSuccess: async () => { toast.success("资料文件已上传，数据库仅保存 key、URL 与摘要"); await invalidate(); } });
  const createCustomerCase = trpc.geo.assetLibrary.createCustomerCase.useMutation({ onSuccess: async () => { toast.success("客户案例资料已保存"); await invalidate(); } });
  const createCompetitor = trpc.geo.assetLibrary.createCompetitor.useMutation({ onSuccess: async () => { toast.success("竞品资料已保存"); await invalidate(); } });
  const createComplianceRule = trpc.geo.assetLibrary.createComplianceRule.useMutation({ onSuccess: async () => { toast.success("合规规则已保存"); await invalidate(); } });
  const createStyleProfile = trpc.geo.assetLibrary.createStyleProfile.useMutation({ onSuccess: async () => { toast.success("内容风格已保存"); await invalidate(); } });
  const createPublishStrategy = trpc.geo.assetLibrary.createPublishStrategy.useMutation({ onSuccess: async () => { toast.success("发布策略已保存"); await invalidate(); } });
  const createPlatformAuthorization = trpc.geo.assetLibrary.createPlatformAuthorization.useMutation({ onSuccess: async () => { toast.success("平台授权占位已保存，未保存明文账号密码"); await invalidate(); } });

  const [profile, setProfile] = useState({
    enterpriseName: "", shortName: "", officialWebsite: "", industry: "", region: "", productServiceIntro: "", targetCustomers: "", coreSellingPoints: "", servicePriceRange: "", serviceModel: "", fitCustomers: "", unfitCustomers: "", salesChannels: "", commonQuestions: "", purchaseDecisionFactors: "", productIntro: "", featureNotes: "", serviceProcess: "", deliveryPlan: "", afterSalesService: "", competitorDifference: "", priceExplanation: "", salesTalkTracks: "", commonObjections: "",
  });
  useEffect(() => {
    if (summary?.profile) {
      setProfile({
        enterpriseName: summary.profile.enterpriseName ?? "",
        shortName: summary.profile.shortName ?? "",
        officialWebsite: summary.profile.officialWebsite ?? "",
        industry: summary.profile.industry ?? "",
        region: summary.profile.region ?? "",
        productServiceIntro: summary.profile.productServiceIntro ?? "",
        targetCustomers: summary.profile.targetCustomers ?? "",
        coreSellingPoints: summary.profile.coreSellingPoints ?? "",
        servicePriceRange: summary.profile.servicePriceRange ?? "",
        serviceModel: summary.profile.serviceModel ?? "",
        fitCustomers: summary.profile.fitCustomers ?? "",
        unfitCustomers: summary.profile.unfitCustomers ?? "",
        salesChannels: (summary.profile.salesChannels ?? []).join("\n"),
        commonQuestions: (summary.profile.commonQuestions ?? []).join("\n"),
        purchaseDecisionFactors: (summary.profile.purchaseDecisionFactors ?? []).join("\n"),
        productIntro: summary.profile.productIntro ?? "",
        featureNotes: summary.profile.featureNotes ?? "",
        serviceProcess: summary.profile.serviceProcess ?? "",
        deliveryPlan: summary.profile.deliveryPlan ?? "",
        afterSalesService: summary.profile.afterSalesService ?? "",
        competitorDifference: summary.profile.competitorDifference ?? "",
        priceExplanation: summary.profile.priceExplanation ?? "",
        salesTalkTracks: summary.profile.salesTalkTracks ?? "",
        commonObjections: summary.profile.commonObjections ?? "",
      });
    }
  }, [summary?.profile]);

  const [sourceForm, setSourceForm] = useState({ sourceType: "企业基础资料" as typeof sourceTypes[number], inputMode: "文本粘贴", title: "", contentDigest: "", trustLevel: "中" as typeof trustLevels[number], isPublic: false, canUseForGeneration: true, manuallyConfirmed: false });
  const [file, setFile] = useState<File | null>(null);
  const [caseForm, setCaseForm] = useState({ caseType: "真实案例" as typeof caseTypes[number], customerName: "", customerIndustry: "", customerBackground: "", originalProblem: "", chosenReason: "", usedProductService: "", executionProcess: "", resultData: "", customerFeedback: "", allowPublic: false, publicVersion: "", sensitiveNotes: "", sourceAssetIds: "", verificationStatus: "待确认" as typeof verificationStatuses[number] });
  const [competitorForm, setCompetitorForm] = useState({ competitorName: "", website: "", positioning: "", strengths: "", weaknesses: "", priceInfo: "", contentAssets: "", aiRecommendationSignals: "", comparisonNotes: "", sourceAssetIds: "", canReference: true });
  const [ruleForm, setRuleForm] = useState({ ruleName: "", forbiddenClaims: "", forbiddenWords: "", requiredDisclaimers: "", dataUsageRules: "", caseUsageRules: "", priceUsageRules: "", competitorMentionRules: "", reviewRequiredTopics: "", enabled: true });
  const [styleForm, setStyleForm] = useState({ profileName: "", tone: "专业可信", writingStyle: "", terminology: "", forbiddenTone: "", exampleTitles: "", exampleParagraphs: "", targetReader: "", preferredLength: "", ctaStyle: "", enabled: true });
  const [strategyForm, setStrategyForm] = useState({ strategyName: "默认 GEO 发布策略", reviewMode: "全人工审核" as typeof reviewModes[number], dailyLimit: "", minQualityScore: "80", preferredPlatforms: "系统内置 GEO 内容页", bannedPlatforms: "", platformNotes: "", enabled: true });
  const [authForm, setAuthForm] = useState({ platformName: "", accountAlias: "", authorizationStatus: "未配置" as typeof authorizationStatuses[number], secureCredentialRef: "", authorizationNotes: "" });

  const selectedProject = useMemo(() => projects.find(project => project.id === selectedProjectId), [projects, selectedProjectId]);

  const requireProject = () => {
    if (!selectedProjectId) {
      toast.error("请先选择项目");
      return null;
    }
    return selectedProjectId;
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] ?? null);

  return (
    <div className="min-h-[calc(100vh-3rem)] rounded-3xl bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.28),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.24),transparent_30%),linear-gradient(135deg,#020617,#0f172a_48%,#111827)] p-5 text-slate-100 shadow-2xl">
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.16)_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="relative z-10 space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-cyan-300/15 bg-white/[0.04] p-6 backdrop-blur md:flex-row md:items-end md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-cyan-200"><Sparkles className="h-4 w-4" /> AI 资料中枢</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">企业资产库接入控制台</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">用卡片化方式沉淀企业资料、产品服务、客户案例、竞品资料、合规规则、内容风格、发布策略与平台授权状态。后续文章生成、质量评分和发布前检查只能引用已确认且允许使用的资料。</p>
          </div>
          <div className="min-w-[260px] space-y-2">
            <Label>当前项目</Label>
            <select value={selectedProjectId ?? ""} onChange={event => setSelectedProjectId(Number(event.target.value) || undefined)} className="h-11 w-full rounded-xl border border-cyan-300/20 bg-slate-950/80 px-3 text-sm text-white">
              <option value="">请选择项目</option>
              {projects.map(project => <option key={project.id} value={project.id}>{project.enterpriseName} · {project.industry}</option>)}
            </select>
          </div>
        </div>

        <GeoStatusGuide
          stage="企业资产"
          completion={summary?.completionScore ?? 0}
          nextAction={summary?.nextAction ?? "先补齐企业基础资料、产品服务、客户案例、竞品资料、合规规则、内容风格和发布策略。"}
          why="资产库是后续文章生成、质量评分和发布前检查的证据来源；没有来源的关键事实不能写成确定性结论。"
          risk={(summary?.riskReminders ?? ["资料不足时，客户案例、结果数据和价格口径不能被编造或默认公开。"])[0]}
          ctaLabel={summary?.completionScore === 0 ? "开始补充企业资料" : "进入内容生产"}
          ctaPath={summary?.completionScore === 0 ? "/assets" : "/articles"}
        />

        {(summary?.completionScore ?? 0) === 0 ? (
          <Card className="border-amber-300/25 bg-amber-400/10 text-slate-100 shadow-[0_0_32px_rgba(251,191,36,0.12)]">
            <CardHeader>
              <CardDescription className="text-amber-200">企业资产 0% 引导</CardDescription>
              <CardTitle className="text-white">企业 GEO 资产尚未建立</CardTitle>
              <p className="text-sm leading-6 text-slate-300">系统需要先了解企业资料，才能生成准确、可溯源、高质量的 GEO 内容。</p>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-4">
                <p className="text-sm font-semibold text-white">下一步建议</p>
                <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                  <li>1. 补充企业基础资料</li>
                  <li>2. 上传产品介绍或服务资料</li>
                  <li>3. 补充 1-3 个真实客户案例</li>
                  <li>4. 补充主要竞品资料</li>
                  <li>5. 配置合规规则和发布策略</li>
                </ol>
              </div>
              <div className="space-y-3 rounded-3xl border border-amber-300/15 bg-slate-950/55 p-4">
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => document.getElementById('asset-profile-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="bg-amber-300 text-slate-950 hover:bg-amber-200">开始补充企业资料</Button>
                  <Button onClick={() => document.getElementById('asset-source-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} variant="outline" className="border-white/15 bg-white/[0.04] text-slate-100 hover:bg-white/10">上传资料文档</Button>
                </div>
                <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100">
                  风险提醒：资料不足时，系统不得编造案例、数据、价格和效果承诺。
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard title="资料完整度" value={`${summary?.completionScore ?? 0}%`} desc={selectedProject ? `${selectedProject.enterpriseName} 的资料沉淀状态` : "请先选择项目"} icon={Database} />
          <StatCard title="可引用资料" value={`${summary?.assetSources?.filter(item => item.canUseForGeneration && item.manuallyConfirmed).length ?? 0}`} desc="已确认且允许用于内容生成" icon={FileText} />
          <StatCard title="真实案例" value={`${summary?.customerCases?.filter(item => item.caseType === "真实案例" && item.verificationStatus === "已确认").length ?? 0}`} desc="无真实案例时不得编造案例" icon={CheckCircle2} />
          <StatCard title="竞品资料" value={`${summary?.competitors?.filter(item => item.canReference).length ?? 0}`} desc="可供后续诊断与文章生成引用" icon={Archive} />
        </div>

        <Card className="border-cyan-300/15 bg-slate-950/70 text-slate-100 shadow-[0_0_32px_rgba(14,165,233,0.12)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white"><AlertTriangle className="h-5 w-5 text-amber-300" /> 当前进度、下一步动作与风险提醒</CardTitle>
            <CardDescription className="text-slate-400">轻量 Harness 视角：先补资料、再确认来源，避免无依据内容进入后续生成链路。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">当前进度</p><p className="mt-2 font-medium text-white">{isLoading ? "正在读取资产库" : `资料完整度 ${summary?.completionScore ?? 0}%`}</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">下一步动作</p><p className="mt-2 text-sm text-cyan-100">{summary?.nextAction ?? "请选择项目并补充企业基础资料。"}</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">风险提醒</p><ul className="mt-2 space-y-1 text-sm text-amber-100">{(summary?.riskReminders ?? ["未选择项目，后续内容生成不能引用企业资料依据。受控上线前请先补齐资料来源。"] as string[]).map(item => <li key={item}>• {item}</li>)}</ul></div>
          </CardContent>
        </Card>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-slate-950/70 p-2 text-slate-300">
            <TabsTrigger value="profile">企业基础与产品服务</TabsTrigger>
            <TabsTrigger value="sources">资料上传 / 粘贴</TabsTrigger>
            <TabsTrigger value="cases">客户案例</TabsTrigger>
            <TabsTrigger value="competitors">竞品库</TabsTrigger>
            <TabsTrigger value="rules">合规规则</TabsTrigger>
            <TabsTrigger value="style">内容风格</TabsTrigger>
            <TabsTrigger value="strategy">发布策略与授权</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" id="asset-profile-section">
            <Card className="border-white/10 bg-slate-950/70 text-slate-100"><CardHeader><CardTitle>企业基础信息与产品服务资料</CardTitle><CardDescription className="text-slate-400">用于后续诊断、文章依据、质量评分和发布策略推荐。</CardDescription></CardHeader><CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <TextField label="企业名称" value={profile.enterpriseName} onChange={enterpriseName => setProfile(prev => ({ ...prev, enterpriseName }))} />
                <TextField label="企业简称" value={profile.shortName} onChange={shortName => setProfile(prev => ({ ...prev, shortName }))} />
                <TextField label="官网" value={profile.officialWebsite} onChange={officialWebsite => setProfile(prev => ({ ...prev, officialWebsite }))} placeholder="例如：https://www.haitunzhidao.com" />
                <TextField label="行业" value={profile.industry} onChange={industry => setProfile(prev => ({ ...prev, industry }))} />
                <TextField label="地区" value={profile.region} onChange={region => setProfile(prev => ({ ...prev, region }))} />
                <TextField label="服务价格区间" value={profile.servicePriceRange} onChange={servicePriceRange => setProfile(prev => ({ ...prev, servicePriceRange }))} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <AreaField label="产品/服务介绍" value={profile.productServiceIntro} onChange={productServiceIntro => setProfile(prev => ({ ...prev, productServiceIntro }))} />
                <AreaField label="目标客户" value={profile.targetCustomers} onChange={targetCustomers => setProfile(prev => ({ ...prev, targetCustomers }))} />
                <AreaField label="核心卖点" value={profile.coreSellingPoints} onChange={coreSellingPoints => setProfile(prev => ({ ...prev, coreSellingPoints }))} />
                <AreaField label="服务方式" value={profile.serviceModel} onChange={serviceModel => setProfile(prev => ({ ...prev, serviceModel }))} />
                <AreaField label="适合客户" value={profile.fitCustomers} onChange={fitCustomers => setProfile(prev => ({ ...prev, fitCustomers }))} />
                <AreaField label="不适合客户" value={profile.unfitCustomers} onChange={unfitCustomers => setProfile(prev => ({ ...prev, unfitCustomers }))} />
                <AreaField label="主要销售渠道（一行一个）" value={profile.salesChannels} onChange={salesChannels => setProfile(prev => ({ ...prev, salesChannels }))} />
                <AreaField label="客户常见问题（一行一个）" value={profile.commonQuestions} onChange={commonQuestions => setProfile(prev => ({ ...prev, commonQuestions }))} />
                <AreaField label="客户购买决策点（一行一个）" value={profile.purchaseDecisionFactors} onChange={purchaseDecisionFactors => setProfile(prev => ({ ...prev, purchaseDecisionFactors }))} />
                <AreaField label="产品介绍" value={profile.productIntro} onChange={productIntro => setProfile(prev => ({ ...prev, productIntro }))} />
                <AreaField label="功能说明" value={profile.featureNotes} onChange={featureNotes => setProfile(prev => ({ ...prev, featureNotes }))} />
                <AreaField label="服务流程" value={profile.serviceProcess} onChange={serviceProcess => setProfile(prev => ({ ...prev, serviceProcess }))} />
                <AreaField label="交付方案" value={profile.deliveryPlan} onChange={deliveryPlan => setProfile(prev => ({ ...prev, deliveryPlan }))} />
                <AreaField label="售后服务" value={profile.afterSalesService} onChange={afterSalesService => setProfile(prev => ({ ...prev, afterSalesService }))} />
                <AreaField label="和竞品差异" value={profile.competitorDifference} onChange={competitorDifference => setProfile(prev => ({ ...prev, competitorDifference }))} />
                <AreaField label="价格说明" value={profile.priceExplanation} onChange={priceExplanation => setProfile(prev => ({ ...prev, priceExplanation }))} />
                <AreaField label="销售话术" value={profile.salesTalkTracks} onChange={salesTalkTracks => setProfile(prev => ({ ...prev, salesTalkTracks }))} />
                <AreaField label="常见异议" value={profile.commonObjections} onChange={commonObjections => setProfile(prev => ({ ...prev, commonObjections }))} />
              </div>
              <Button disabled={upsertProfile.isPending} onClick={() => {
                const projectId = requireProject();
                if (!projectId) return;
                upsertProfile.mutate({ projectId, ...profile, salesChannels: splitLines(profile.salesChannels), commonQuestions: splitLines(profile.commonQuestions), purchaseDecisionFactors: splitLines(profile.purchaseDecisionFactors) });
              }}>保存企业与产品资料</Button>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="sources" id="asset-source-section">
            <Card className="border-white/10 bg-slate-950/70 text-slate-100"><CardHeader><CardTitle className="flex items-center gap-2"><UploadCloud className="h-5 w-5 text-cyan-300" /> 资料上传或粘贴</CardTitle><CardDescription className="text-slate-400">上传文件会先进入对象存储，数据库仅保存 fileKey、fileUrl、类型、解析状态和结构化摘要。</CardDescription></CardHeader><CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3"><TextField label="资料标题" value={sourceForm.title} onChange={title => setSourceForm(prev => ({ ...prev, title }))} /><SelectField label="资料类型" value={sourceForm.sourceType} options={sourceTypes} onChange={sourceType => setSourceForm(prev => ({ ...prev, sourceType }))} /><SelectField label="可信度" value={sourceForm.trustLevel} options={trustLevels} onChange={trustLevel => setSourceForm(prev => ({ ...prev, trustLevel }))} /></div>
              <AreaField label="资料摘要 / 粘贴内容" value={sourceForm.contentDigest} onChange={contentDigest => setSourceForm(prev => ({ ...prev, contentDigest }))} rows={5} />
              <div className="grid gap-3 md:grid-cols-3"><SwitchLine checked={sourceForm.isPublic} onChange={isPublic => setSourceForm(prev => ({ ...prev, isPublic }))} label="允许公开" /><SwitchLine checked={sourceForm.canUseForGeneration} onChange={canUseForGeneration => setSourceForm(prev => ({ ...prev, canUseForGeneration }))} label="可用于内容生成" hint="后续内容依据只允许引用已确认资料" /><SwitchLine checked={sourceForm.manuallyConfirmed} onChange={manuallyConfirmed => setSourceForm(prev => ({ ...prev, manuallyConfirmed }))} label="人工确认来源真实" /></div>
              <div className="rounded-2xl border border-cyan-300/15 bg-cyan-950/20 p-4"><Label>上传资料文件</Label><Input type="file" onChange={handleFileChange} className="mt-2 border-white/10 bg-slate-950/70 text-slate-100" /><p className="mt-2 text-xs text-slate-400">支持小型文本、PDF、Word 等资料。当前冲刺只保存文件 key / URL 与摘要，不把文件字节写入数据库。</p></div>
              <div className="flex flex-wrap gap-3"><Button variant="secondary" disabled={addTextSource.isPending} onClick={() => { const projectId = requireProject(); if (!projectId) return; addTextSource.mutate({ projectId, ...sourceForm, inputMode: "文本粘贴" }); }}>保存粘贴资料</Button><Button disabled={addUploadedSource.isPending || !file} onClick={async () => { const projectId = requireProject(); if (!projectId || !file) return; const fileBase64 = await toBase64(file); addUploadedSource.mutate({ projectId, sourceType: sourceForm.sourceType, title: sourceForm.title || file.name, contentDigest: sourceForm.contentDigest, trustLevel: sourceForm.trustLevel, isPublic: sourceForm.isPublic, canUseForGeneration: sourceForm.canUseForGeneration, manuallyConfirmed: sourceForm.manuallyConfirmed, originalFileName: file.name, mimeType: file.type || "application/octet-stream", fileBase64 }); }}>上传并保存资料</Button></div>
              <div className="grid gap-3 md:grid-cols-2">{summary?.assetSources?.map(item => <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm"><p className="font-medium text-white">#{item.id} {item.title}</p><p className="text-slate-400">{item.sourceType} · {item.trustLevel} · {item.parseStatus}</p><p className="text-slate-400">可生成：{item.canUseForGeneration ? "是" : "否"}；已确认：{item.manuallyConfirmed ? "是" : "否"}</p></div>)}</div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="cases">
            <Card className="border-white/10 bg-slate-950/70 text-slate-100"><CardHeader><CardTitle>客户案例资料</CardTitle><CardDescription className="text-slate-400">必须区分真实案例和待补充案例线索；没有真实案例时系统不得编造案例、数据、价格或效果。</CardDescription></CardHeader><CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3"><SelectField label="案例类型" value={caseForm.caseType} options={caseTypes} onChange={caseType => setCaseForm(prev => ({ ...prev, caseType }))} /><TextField label="客户名称" value={caseForm.customerName} onChange={customerName => setCaseForm(prev => ({ ...prev, customerName }))} /><TextField label="所属行业" value={caseForm.customerIndustry} onChange={customerIndustry => setCaseForm(prev => ({ ...prev, customerIndustry }))} /></div>
              <div className="grid gap-4 md:grid-cols-2"><AreaField label="客户背景" value={caseForm.customerBackground} onChange={customerBackground => setCaseForm(prev => ({ ...prev, customerBackground }))} /><AreaField label="原始问题" value={caseForm.originalProblem} onChange={originalProblem => setCaseForm(prev => ({ ...prev, originalProblem }))} /><AreaField label="选择原因" value={caseForm.chosenReason} onChange={chosenReason => setCaseForm(prev => ({ ...prev, chosenReason }))} /><AreaField label="使用产品/服务" value={caseForm.usedProductService} onChange={usedProductService => setCaseForm(prev => ({ ...prev, usedProductService }))} /><AreaField label="执行过程" value={caseForm.executionProcess} onChange={executionProcess => setCaseForm(prev => ({ ...prev, executionProcess }))} /><AreaField label="结果数据" value={caseForm.resultData} onChange={resultData => setCaseForm(prev => ({ ...prev, resultData }))} /><AreaField label="客户反馈" value={caseForm.customerFeedback} onChange={customerFeedback => setCaseForm(prev => ({ ...prev, customerFeedback }))} /><AreaField label="可公开版本" value={caseForm.publicVersion} onChange={publicVersion => setCaseForm(prev => ({ ...prev, publicVersion }))} /><AreaField label="敏感信息说明" value={caseForm.sensitiveNotes} onChange={sensitiveNotes => setCaseForm(prev => ({ ...prev, sensitiveNotes }))} /><AreaField label="来源资料 ID（逗号或换行分隔）" value={caseForm.sourceAssetIds} onChange={sourceAssetIds => setCaseForm(prev => ({ ...prev, sourceAssetIds }))} /></div>
              <div className="grid gap-3 md:grid-cols-2"><SelectField label="核验状态" value={caseForm.verificationStatus} options={verificationStatuses} onChange={verificationStatus => setCaseForm(prev => ({ ...prev, verificationStatus }))} /><SwitchLine checked={caseForm.allowPublic} onChange={allowPublic => setCaseForm(prev => ({ ...prev, allowPublic }))} label="允许公开" /></div>
              <Button disabled={createCustomerCase.isPending} onClick={() => { const projectId = requireProject(); if (!projectId) return; createCustomerCase.mutate({ projectId, ...caseForm, sourceAssetIds: parseIds(caseForm.sourceAssetIds) }); }}>保存客户案例</Button>
              <div className="grid gap-3 md:grid-cols-2">{summary?.customerCases?.map(item => <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm"><p className="font-medium text-white">#{item.id} {item.customerName}</p><p className="text-slate-400">{item.caseType} · {item.verificationStatus} · 允许公开：{item.allowPublic ? "是" : "否"}</p></div>)}</div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="competitors">
            <Card className="border-white/10 bg-slate-950/70 text-slate-100"><CardHeader><CardTitle>竞品资料库</CardTitle><CardDescription className="text-slate-400">用于后续 AI 认知差距诊断与内容依据引用，不用于攻击竞品。</CardDescription></CardHeader><CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2"><TextField label="竞品名称" value={competitorForm.competitorName} onChange={competitorName => setCompetitorForm(prev => ({ ...prev, competitorName }))} /><TextField label="官网" value={competitorForm.website} onChange={website => setCompetitorForm(prev => ({ ...prev, website }))} /></div>
              <div className="grid gap-4 md:grid-cols-2"><AreaField label="定位" value={competitorForm.positioning} onChange={positioning => setCompetitorForm(prev => ({ ...prev, positioning }))} /><AreaField label="优势" value={competitorForm.strengths} onChange={strengths => setCompetitorForm(prev => ({ ...prev, strengths }))} /><AreaField label="弱点" value={competitorForm.weaknesses} onChange={weaknesses => setCompetitorForm(prev => ({ ...prev, weaknesses }))} /><AreaField label="价格信息" value={competitorForm.priceInfo} onChange={priceInfo => setCompetitorForm(prev => ({ ...prev, priceInfo }))} /><AreaField label="内容资产" value={competitorForm.contentAssets} onChange={contentAssets => setCompetitorForm(prev => ({ ...prev, contentAssets }))} /><AreaField label="AI 推荐信号" value={competitorForm.aiRecommendationSignals} onChange={aiRecommendationSignals => setCompetitorForm(prev => ({ ...prev, aiRecommendationSignals }))} /><AreaField label="对比备注" value={competitorForm.comparisonNotes} onChange={comparisonNotes => setCompetitorForm(prev => ({ ...prev, comparisonNotes }))} /><AreaField label="来源资料 ID" value={competitorForm.sourceAssetIds} onChange={sourceAssetIds => setCompetitorForm(prev => ({ ...prev, sourceAssetIds }))} /></div>
              <SwitchLine checked={competitorForm.canReference} onChange={canReference => setCompetitorForm(prev => ({ ...prev, canReference }))} label="允许后续诊断与内容生成引用" />
              <Button disabled={createCompetitor.isPending} onClick={() => { const projectId = requireProject(); if (!projectId) return; createCompetitor.mutate({ projectId, ...competitorForm, sourceAssetIds: parseIds(competitorForm.sourceAssetIds) }); }}>保存竞品资料</Button>
              <div className="grid gap-3 md:grid-cols-2">{summary?.competitors?.map(item => <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm"><p className="font-medium text-white">#{item.id} {item.competitorName}</p><p className="text-slate-400">可引用：{item.canReference ? "是" : "否"}</p></div>)}</div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="rules">
            <Card className="border-white/10 bg-slate-950/70 text-slate-100"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-300" /> 合规规则</CardTitle><CardDescription className="text-slate-400">约束后续内容生成，防止编造数据、保证排名、攻击竞品或违规承诺。</CardDescription></CardHeader><CardContent className="space-y-4">
              <TextField label="规则名称" value={ruleForm.ruleName} onChange={ruleName => setRuleForm(prev => ({ ...prev, ruleName }))} />
              <div className="grid gap-4 md:grid-cols-2"><AreaField label="禁止宣称" value={ruleForm.forbiddenClaims} onChange={forbiddenClaims => setRuleForm(prev => ({ ...prev, forbiddenClaims }))} /><AreaField label="禁用词（一行一个）" value={ruleForm.forbiddenWords} onChange={forbiddenWords => setRuleForm(prev => ({ ...prev, forbiddenWords }))} /><AreaField label="必要免责声明" value={ruleForm.requiredDisclaimers} onChange={requiredDisclaimers => setRuleForm(prev => ({ ...prev, requiredDisclaimers }))} /><AreaField label="数据使用规则" value={ruleForm.dataUsageRules} onChange={dataUsageRules => setRuleForm(prev => ({ ...prev, dataUsageRules }))} /><AreaField label="案例使用规则" value={ruleForm.caseUsageRules} onChange={caseUsageRules => setRuleForm(prev => ({ ...prev, caseUsageRules }))} /><AreaField label="价格使用规则" value={ruleForm.priceUsageRules} onChange={priceUsageRules => setRuleForm(prev => ({ ...prev, priceUsageRules }))} /><AreaField label="竞品提及规则" value={ruleForm.competitorMentionRules} onChange={competitorMentionRules => setRuleForm(prev => ({ ...prev, competitorMentionRules }))} /><AreaField label="需要人工审核的主题" value={ruleForm.reviewRequiredTopics} onChange={reviewRequiredTopics => setRuleForm(prev => ({ ...prev, reviewRequiredTopics }))} /></div>
              <SwitchLine checked={ruleForm.enabled} onChange={enabled => setRuleForm(prev => ({ ...prev, enabled }))} label="启用规则" />
              <Button disabled={createComplianceRule.isPending} onClick={() => { const projectId = requireProject(); if (!projectId) return; createComplianceRule.mutate({ projectId, ...ruleForm, forbiddenWords: splitLines(ruleForm.forbiddenWords), reviewRequiredTopics: splitLines(ruleForm.reviewRequiredTopics) }); }}>保存合规规则</Button>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="style">
            <Card className="border-white/10 bg-slate-950/70 text-slate-100"><CardHeader><CardTitle>内容风格资料</CardTitle><CardDescription className="text-slate-400">统一后续内容的语气、术语、标题范式、读者和 CTA 风格。</CardDescription></CardHeader><CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3"><TextField label="风格名称" value={styleForm.profileName} onChange={profileName => setStyleForm(prev => ({ ...prev, profileName }))} /><TextField label="语气" value={styleForm.tone} onChange={tone => setStyleForm(prev => ({ ...prev, tone }))} /><TextField label="偏好长度" value={styleForm.preferredLength} onChange={preferredLength => setStyleForm(prev => ({ ...prev, preferredLength }))} /></div>
              <div className="grid gap-4 md:grid-cols-2"><AreaField label="写作风格" value={styleForm.writingStyle} onChange={writingStyle => setStyleForm(prev => ({ ...prev, writingStyle }))} /><AreaField label="术语（一行一个）" value={styleForm.terminology} onChange={terminology => setStyleForm(prev => ({ ...prev, terminology }))} /><AreaField label="禁用语气" value={styleForm.forbiddenTone} onChange={forbiddenTone => setStyleForm(prev => ({ ...prev, forbiddenTone }))} /><AreaField label="标题示例（一行一个）" value={styleForm.exampleTitles} onChange={exampleTitles => setStyleForm(prev => ({ ...prev, exampleTitles }))} /><AreaField label="段落示例（一行一个）" value={styleForm.exampleParagraphs} onChange={exampleParagraphs => setStyleForm(prev => ({ ...prev, exampleParagraphs }))} /><AreaField label="目标读者" value={styleForm.targetReader} onChange={targetReader => setStyleForm(prev => ({ ...prev, targetReader }))} /><AreaField label="CTA 风格" value={styleForm.ctaStyle} onChange={ctaStyle => setStyleForm(prev => ({ ...prev, ctaStyle }))} /></div>
              <SwitchLine checked={styleForm.enabled} onChange={enabled => setStyleForm(prev => ({ ...prev, enabled }))} label="启用风格" />
              <Button disabled={createStyleProfile.isPending} onClick={() => { const projectId = requireProject(); if (!projectId) return; createStyleProfile.mutate({ projectId, ...styleForm, terminology: splitLines(styleForm.terminology), exampleTitles: splitLines(styleForm.exampleTitles), exampleParagraphs: splitLines(styleForm.exampleParagraphs) }); }}>保存内容风格</Button>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="strategy">
            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="border-white/10 bg-slate-950/70 text-slate-100"><CardHeader><CardTitle>发布策略</CardTitle><CardDescription className="text-slate-400">每日数量由质量和策略决定，不默认固定发文数量。</CardDescription></CardHeader><CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2"><TextField label="策略名称" value={strategyForm.strategyName} onChange={strategyName => setStrategyForm(prev => ({ ...prev, strategyName }))} /><SelectField label="审核模式" value={strategyForm.reviewMode} options={reviewModes} onChange={reviewMode => setStrategyForm(prev => ({ ...prev, reviewMode }))} /><TextField label="每日上限（可为空）" value={strategyForm.dailyLimit} onChange={dailyLimit => setStrategyForm(prev => ({ ...prev, dailyLimit }))} type="number" /><TextField label="最低质量分" value={strategyForm.minQualityScore} onChange={minQualityScore => setStrategyForm(prev => ({ ...prev, minQualityScore }))} type="number" /></div>
                <AreaField label="优先平台（一行一个）" value={strategyForm.preferredPlatforms} onChange={preferredPlatforms => setStrategyForm(prev => ({ ...prev, preferredPlatforms }))} /><AreaField label="不建议平台（一行一个）" value={strategyForm.bannedPlatforms} onChange={bannedPlatforms => setStrategyForm(prev => ({ ...prev, bannedPlatforms }))} /><AreaField label="平台策略备注" value={strategyForm.platformNotes} onChange={platformNotes => setStrategyForm(prev => ({ ...prev, platformNotes }))} /><SwitchLine checked={strategyForm.enabled} onChange={enabled => setStrategyForm(prev => ({ ...prev, enabled }))} label="启用发布策略" />
                <Button disabled={createPublishStrategy.isPending} onClick={() => { const projectId = requireProject(); if (!projectId) return; createPublishStrategy.mutate({ projectId, ...strategyForm, dailyLimit: strategyForm.dailyLimit ? Number(strategyForm.dailyLimit) : null, minQualityScore: Number(strategyForm.minQualityScore || 80), preferredPlatforms: splitLines(strategyForm.preferredPlatforms), bannedPlatforms: splitLines(strategyForm.bannedPlatforms) }); }}>保存发布策略</Button>
              </CardContent></Card>
              <Card className="border-white/10 bg-slate-950/70 text-slate-100"><CardHeader><CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-violet-300" /> 平台授权配置占位</CardTitle><CardDescription className="text-slate-400">只保存授权状态、脱敏账号和安全凭证引用，不保存明文账号密码。</CardDescription></CardHeader><CardContent className="space-y-4">
                <TextField label="平台名称" value={authForm.platformName} onChange={platformName => setAuthForm(prev => ({ ...prev, platformName }))} /><TextField label="账号别名 / 脱敏账号" value={authForm.accountAlias} onChange={accountAlias => setAuthForm(prev => ({ ...prev, accountAlias }))} /><SelectField label="授权状态" value={authForm.authorizationStatus} options={authorizationStatuses} onChange={authorizationStatus => setAuthForm(prev => ({ ...prev, authorizationStatus }))} /><TextField label="安全凭证引用（可为空，不填密码）" value={authForm.secureCredentialRef} onChange={secureCredentialRef => setAuthForm(prev => ({ ...prev, secureCredentialRef }))} placeholder="例如 secrets:zhihu-oauth-ref，不要输入密码/token/cookie" /><AreaField label="授权备注" value={authForm.authorizationNotes} onChange={authorizationNotes => setAuthForm(prev => ({ ...prev, authorizationNotes }))} />
                <Button disabled={createPlatformAuthorization.isPending} onClick={() => { const projectId = requireProject(); if (!projectId) return; createPlatformAuthorization.mutate({ projectId, ...authForm }); }}>保存授权占位</Button>
                <div className="rounded-xl border border-amber-300/20 bg-amber-950/20 p-3 text-xs text-amber-100">安全边界：本系统不会保存客户平台明文账号密码；如果备注或引用字段包含 password、pwd、token、cookie、密码等敏感词，后端会拒绝保存。</div>
              </CardContent></Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
