import { useAuth } from "@/_core/hooks/useAuth";
import { PLATFORM_PRODUCT_NAME } from "@/components/auth/authMarketing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLoginUrl, isLoginConfigured } from "@/const";
import { buildProjectUrl, getActiveProjectId, setActiveProjectId, syncActiveProjectIdFromUrl } from "@/lib/activeProject";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { ENTERPRISE_INDUSTRY_OPTIONS } from "@shared/enterpriseProfileIndustry";
import { handleSubscriptionLimitMutationError } from "@/lib/subscriptionUpgrade";
import { toUserFacingCreateProjectError } from "@shared/userFacingMutationErrors";
import { BarChart3, Check, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { toast } from "sonner";

type OnboardingStep = 1 | 2 | 3;

const STEP_LABELS = ["企业资料", "问题集", "AI 检测"] as const;

type ProfileForm = {
  enterpriseName: string;
  industry: string;
  coreBusiness: string;
  targetCustomer: string;
};

function buildProfilePayload(projectId: number, form: ProfileForm) {
  const enterpriseName = form.enterpriseName.trim();
  const industry = form.industry.trim();
  const productDesc = form.coreBusiness.trim();
  const targetCustomer = form.targetCustomer.trim();
  return {
    projectId,
    enterpriseName,
    shortName: enterpriseName.slice(0, 20),
    officialWebsite: "https://",
    industry,
    region: "中国",
    productServiceIntro: productDesc,
    targetCustomers: targetCustomer,
    coreSellingPoints: productDesc.slice(0, 80) || "待补充",
    servicePriceRange: "待补充",
    serviceModel: "待补充",
    fitCustomers: "待补充",
    unfitCustomers: "待补充",
    salesChannels: [] as string[],
    commonQuestions: [] as string[],
    purchaseDecisionFactors: [] as string[],
    productIntro: productDesc,
    featureNotes: "",
    serviceProcess: "",
    deliveryPlan: "",
    afterSalesService: "",
    competitorDifference: "",
    priceExplanation: "",
    salesTalkTracks: "",
    commonObjections: "",
    brandName: enterpriseName,
    industryTag: industry,
    productDesc,
    mainChannel: "",
    targetCustomer,
    customerPains: [] as string[],
    competitors: [] as string[],
    oneLiner: productDesc.slice(0, 80),
    keyPoints: [] as string[],
    keywords: [] as string[],
  };
}

function OnboardingProgressBar({ currentStep }: { currentStep: OnboardingStep }) {
  return (
    <nav className="flex items-center justify-center gap-2 sm:gap-4" data-testid="onboarding-progress">
      {STEP_LABELS.map((label, index) => {
        const stepNum = (index + 1) as OnboardingStep;
        const isDone = currentStep > stepNum;
        const isActive = currentStep === stepNum;
        return (
          <div key={label} className="flex items-center gap-2 sm:gap-4">
            {index > 0 ? <div className={cn("h-px w-6 sm:w-10", isDone || isActive ? "bg-blue-600" : "bg-gray-200")} /> : null}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                  isDone ? "bg-blue-600 text-white" : isActive ? "bg-blue-600 text-white ring-4 ring-blue-100" : "bg-gray-100 text-gray-400",
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : stepNum}
              </span>
              <span className={cn("hidden text-sm font-medium sm:inline", isActive ? "text-gray-900" : "text-gray-400")}>{label}</span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function SkipButton({ onSkip }: { onSkip: () => void }) {
  return (
    <Button type="button" variant="ghost" className="text-gray-500 hover:text-gray-700" data-testid="onboarding-skip" onClick={onSkip}>
      跳过
    </Button>
  );
}

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { loading: authLoading, user } = useAuth();

  const { data: projects = [], isLoading: projectsLoading } = trpc.geo.projects.list.useQuery(undefined, { enabled: Boolean(user) });

  const devLogin = trpc.auth.devLogin.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      window.location.reload();
    },
  });

  const [step, setStep] = useState<OnboardingStep>(1);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    enterpriseName: "",
    industry: "",
    coreBusiness: "",
    targetCustomer: "",
  });
  const [questionsGenerated, setQuestionsGenerated] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  useEffect(() => {
    syncActiveProjectIdFromUrl();
    const activeId = getActiveProjectId();
    if (activeId) setProjectId(prev => prev ?? activeId);
  }, []);

  useEffect(() => {
    if (!projectId || projects.length === 0) return;
    const selected = projects.find(p => p.id === projectId);
    if (!selected) return;
    setForm(prev => ({
      enterpriseName: prev.enterpriseName || selected.enterpriseName,
      industry:
        prev.industry ||
        (selected.industry?.trim() && selected.industry !== "待补充" ? selected.industry : ""),
      coreBusiness: prev.coreBusiness,
      targetCustomer: prev.targetCustomer,
    }));
  }, [projectId, projects]);

  const createProject = trpc.geo.projects.create.useMutation();
  const upsertProfile = trpc.geo.assetLibrary.upsertProfile.useMutation();
  const generateTargetQuestions = trpc.geo.questions.generateTargetQuestions.useMutation();

  const { data: questionRows = [], isLoading: questionsLoading } = trpc.geo.questions.list.useQuery(
    { projectId: projectId ?? undefined },
    { enabled: Boolean(projectId) && step >= 2 },
  );

  const canSubmitStep1 =
    form.enterpriseName.trim() && form.industry.trim() && form.coreBusiness.trim() && form.targetCustomer.trim();

  function goClients() {
    setLocation("/clients");
  }

  useEffect(() => {
    if (step !== 2 || !projectId || questionsGenerated) return;
    let cancelled = false;
    setGenerateError(null);
    void (async () => {
      try {
        await generateTargetQuestions.mutateAsync({ projectId });
        if (!cancelled) {
          setQuestionsGenerated(true);
          await utils.geo.questions.list.invalidate({ projectId });
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[onboarding-generate-questions]", err);
          setGenerateError("问题生成遇到问题，你可以确认继续或跳过");
          setQuestionsGenerated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per step-2 entry
  }, [step, projectId, questionsGenerated]);

  async function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitStep1) return;

    const enterpriseName = form.enterpriseName.trim();
    const industry = form.industry.trim();
    const productDesc = form.coreBusiness.trim();
    const targetCustomer = form.targetCustomer.trim();

    try {
      let pid = projectId;
      if (!pid) {
        await createProject.mutateAsync({
          enterpriseName,
          industry,
          website: "https://",
          region: "中国",
          productIntro: productDesc,
          targetCustomers: targetCustomer,
          coreSellingPoints: productDesc.slice(0, 80) || "待补充",
          competitorNames: [],
          coreKeywords: [],
        });
        const list = await utils.geo.projects.list.fetch();
        const created = list.find(p => p.enterpriseName === enterpriseName) ?? list[list.length - 1];
        if (!created?.id) {
          toast.error("创建项目失败，请重试");
          return;
        }
        pid = created.id;
        setProjectId(pid);
        setActiveProjectId(pid);
      }

      await upsertProfile.mutateAsync(buildProfilePayload(pid, form));
      await utils.geo.assetLibrary.summary.invalidate({ projectId: pid });
      setStep(2);
    } catch (err) {
      console.error("[onboarding-step1]", err);
      if (!handleSubscriptionLimitMutationError(err)) {
        toast.error(toUserFacingCreateProjectError(err));
      }
    }
  }

  if (authLoading || projectsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const continuingProjectId = projectId ?? getActiveProjectId();
  if (user && projects.length > 0 && !continuingProjectId) {
    return <Redirect to="/clients" />;
  }

  if (!user) {
    const loginConfigured = isLoginConfigured();
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 text-gray-900">
        <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-lg">
          <BarChart3 className="mx-auto h-10 w-10 text-blue-600" />
          <h1 className="mt-4 text-xl font-semibold">登录后继续</h1>
          <p className="mt-2 text-sm text-gray-500">完成引导需要先登录</p>
          {loginConfigured ? (
            <Button className="mt-6 w-full bg-blue-600 text-white hover:bg-blue-700" onClick={() => { window.location.href = getLoginUrl(); }}>
              登录
            </Button>
          ) : (
            <Button
              className="mt-6 w-full bg-blue-600 text-white hover:bg-blue-700"
              disabled={devLogin.isPending}
              onClick={() => devLogin.mutate()}
            >
              {devLogin.isPending ? "正在登录" : "本地开发登录"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const activeProjectId = projectId ?? undefined;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 text-gray-900" data-testid="onboarding-page">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <header className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">G</div>
            <span className="text-lg font-bold text-gray-900">{PLATFORM_PRODUCT_NAME}</span>
          </div>
          <p className="text-sm text-gray-500">3 步完成首个企业项目设置，开始 AI 搜索可见性检测</p>
          <OnboardingProgressBar currentStep={step} />
        </header>

        {step === 1 ? (
          <section className="rounded-3xl border border-gray-200 bg-white p-8 shadow-lg" data-testid="onboarding-step-1">
            <div className="mb-6 space-y-1">
              <h1 className="text-xl font-semibold">填写企业资料</h1>
              <p className="text-sm text-gray-500">这些信息将用于生成 AI 检索问题与 AI 现状检测</p>
            </div>
            <form className="space-y-5" onSubmit={e => void handleStep1Submit(e)}>
              <div className="space-y-2">
                <Label htmlFor="onboarding-enterprise-name">企业名称</Label>
                <Input
                  id="onboarding-enterprise-name"
                  data-testid="onboarding-enterprise-name"
                  required
                  value={form.enterpriseName}
                  onChange={e => setForm(f => ({ ...f, enterpriseName: e.target.value }))}
                  placeholder="客户企业或品牌全称"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboarding-industry">所属行业</Label>
                <select
                  id="onboarding-industry"
                  data-testid="onboarding-industry"
                  required
                  value={form.industry}
                  onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                  className="flex h-10 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="">请选择行业</option>
                  {ENTERPRISE_INDUSTRY_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboarding-core-business">核心业务</Label>
                <Input
                  id="onboarding-core-business"
                  data-testid="onboarding-core-business"
                  required
                  value={form.coreBusiness}
                  onChange={e => setForm(f => ({ ...f, coreBusiness: e.target.value }))}
                  placeholder="例如：帮助知识付费老师提升直播转化率的 AI 经营系统"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboarding-target-customer">目标客户</Label>
                <Input
                  id="onboarding-target-customer"
                  data-testid="onboarding-target-customer"
                  required
                  value={form.targetCustomer}
                  onChange={e => setForm(f => ({ ...f, targetCustomer: e.target.value }))}
                  placeholder="例如：有课程但转化率低的知识付费老师"
                  className="rounded-xl"
                />
              </div>
              <div className="flex items-center justify-between gap-3 pt-2">
                <SkipButton onSkip={goClients} />
                <Button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-6 text-white hover:bg-blue-700"
                  data-testid="onboarding-step1-next"
                  disabled={!canSubmitStep1 || createProject.isPending || upsertProfile.isPending}
                >
                  {createProject.isPending || upsertProfile.isPending ? "保存中…" : "下一步：生成问题集"}
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="rounded-3xl border border-gray-200 bg-white p-8 shadow-lg" data-testid="onboarding-step-2">
            <div className="mb-6 space-y-1">
              <h1 className="text-xl font-semibold">确认 AI 检索问题</h1>
              <p className="text-sm text-gray-500">系统根据企业资料自动生成以下问题，用于 AI 现状检测</p>
            </div>

            {generateTargetQuestions.isPending || (questionsLoading && !questionsGenerated) ? (
              <div className="flex min-h-[20vh] flex-col items-center justify-center gap-3 text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <p className="text-sm">正在生成问题集…</p>
              </div>
            ) : (
              <>
                {generateError ? <p className="mb-4 text-sm text-amber-700">{generateError}</p> : null}
                {questionRows.length > 0 ? (
                  <ul className="space-y-3" data-testid="onboarding-question-list">
                    {questionRows.map((q, i) => (
                      <li key={q.id} className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-800">
                        <span className="shrink-0 font-medium text-blue-600">{i + 1}.</span>
                        <span>{q.questionText}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                    暂未生成问题，你可以跳过或在检测页手动补充
                  </p>
                )}
              </>
            )}

            <div className="mt-8 flex items-center justify-between gap-3">
              <SkipButton onSkip={goClients} />
              <Button
                type="button"
                className="rounded-xl bg-blue-600 px-6 text-white hover:bg-blue-700"
                data-testid="onboarding-step2-next"
                disabled={generateTargetQuestions.isPending}
                onClick={() => setStep(3)}
              >
                确认并继续
              </Button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="rounded-3xl border border-gray-200 bg-white p-8 shadow-lg text-center" data-testid="onboarding-step-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
              <Sparkles className="h-7 w-7 text-blue-600" />
            </div>
            <h1 className="mt-5 text-xl font-semibold">你的企业资料已就绪</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
              企业资料与问题集已保存。建议立即开始 AI 现状检测，了解当前 AI 搜索可见性水平。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                type="button"
                className="rounded-xl bg-blue-600 px-6 text-white hover:bg-blue-700"
                data-testid="onboarding-start-diagnosis"
                onClick={() => {
                  if (activeProjectId) setActiveProjectId(activeProjectId);
                  setLocation(activeProjectId ? buildProjectUrl("/ai-diagnosis", activeProjectId) : "/clients");
                }}
              >
                开始 AI 现状检测
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                data-testid="onboarding-go-workspace"
                onClick={() => {
                  if (activeProjectId) setActiveProjectId(activeProjectId);
                  setLocation(activeProjectId ? buildProjectUrl("/workspace", activeProjectId) : "/clients");
                }}
              >
                先看看工作台
              </Button>
            </div>
            <div className="mt-6 flex justify-center">
              <SkipButton onSkip={goClients} />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
