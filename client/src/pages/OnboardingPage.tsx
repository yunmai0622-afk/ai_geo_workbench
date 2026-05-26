import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLoginUrl, isLoginConfigured } from "@/const";
import { trpc } from "@/lib/trpc";
import { GEO_ARTICLE_MIN_PASS_SCORE } from "@shared/const";
import { BarChart3, Check, Circle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getActiveProjectId, setActiveProjectId, buildProjectUrl } from "@/lib/activeProject";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { toUserFacingCreateProjectError } from "@shared/userFacingMutationErrors";

type Phase = "input" | "processing" | "result";
type StepStatus = "pending" | "active" | "done";

type GeneratedArticleState = {
  articleId?: number;
  title?: string;
  markdownContent?: string;
  qualityScore?: number;
  passed?: boolean;
};

const PROCESS_STEPS = [
  { key: 1, label: "保存你的信息", hint: "正在保存你的信息..." },
  { key: 2, label: "分析你的内容方向", hint: "正在分析哪些客户问题你还没有覆盖..." },
  { key: 3, label: "生成内容建议", hint: "正在生成本周内容建议..." },
  { key: 4, label: "生成你的第一篇文章", hint: "正在生成你的第一篇文章..." },
] as const;

function buildProfilePayload(projectId: number, brandName: string, productDesc: string, targetCustomer: string) {
  const brand = brandName.trim();
  const product = productDesc.trim();
  const target = targetCustomer.trim();
  return {
    projectId,
    enterpriseName: brand,
    shortName: brand.slice(0, 20),
    officialWebsite: "https://",
    industry: "待补充",
    region: "中国",
    productServiceIntro: product,
    targetCustomers: target,
    coreSellingPoints: "待补充",
    servicePriceRange: "待补充",
    serviceModel: "待补充",
    fitCustomers: "待补充",
    unfitCustomers: "待补充",
    salesChannels: [] as string[],
    commonQuestions: [] as string[],
    purchaseDecisionFactors: [] as string[],
    productIntro: product,
    featureNotes: "",
    serviceProcess: "",
    deliveryPlan: "",
    afterSalesService: "",
    competitorDifference: "",
    priceExplanation: "",
    salesTalkTracks: "",
    commonObjections: "",
    brandName: brand,
    industryTag: "",
    productDesc: product,
    mainChannel: "",
    targetCustomer: target,
    customerPains: [] as string[],
    competitors: [] as string[],
    oneLiner: product.slice(0, 80),
    keyPoints: [] as string[],
    keywords: [] as string[],
  };
}

function previewMarkdown(markdown: string, max = 300) {
  const text = markdown.replace(/^#+\s*/gm, "").replace(/\*\*/g, "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function stepStatusFor(index: number, current: number): StepStatus {
  const stepNum = index + 1;
  if (current > stepNum) return "done";
  if (current === stepNum) return "active";
  return "pending";
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

  const [phase, setPhase] = useState<Phase>("input");
  const [brandName, setBrandName] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");

  const [pipelineStep, setPipelineStep] = useState(0);
  const [stepHint, setStepHint] = useState("");
  const [skipNote, setSkipNote] = useState<string | null>(null);
  const [generatedArticle, setGeneratedArticle] = useState<GeneratedArticleState | null>(null);
  const [copied, setCopied] = useState(false);

  const createProject = trpc.geo.projects.create.useMutation();
  const upsertProfile = trpc.geo.assetLibrary.upsertProfile.useMutation();
  const generateTargetQuestions = trpc.geo.questions.generateTargetQuestions.useMutation();
  const runAnalysis = trpc.geo.analysis.run.useMutation();
  const generateTasks = trpc.geo.tasks.generate.useMutation();
  const generateTopics = trpc.geo.articles.topics.generate.useMutation();
  const generateArticle = trpc.geo.articles.generate.useMutation();

  const canStart = brandName.trim() && productDesc.trim() && targetCustomer.trim();
  const progressPct = pipelineStep * 25;

  const stepStatuses = useMemo(() => PROCESS_STEPS.map((_, i) => stepStatusFor(i, pipelineStep)), [pipelineStep]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 3000);
    return () => window.clearTimeout(t);
  }, [copied]);

  async function ensureProjectId(name: string): Promise<number> {
    if (projects.length > 0) {
      throw new Error("系统已有客户项目，请前往客户管理台新建");
    }
    await createProject.mutateAsync({
      enterpriseName: name.trim(),
      industry: "待补充",
      website: "https://",
      region: "中国",
      productIntro: productDesc.trim() || "待补充",
      targetCustomers: targetCustomer.trim() || "待补充",
      coreSellingPoints: "待补充",
      competitorNames: [],
      coreKeywords: [],
    });
    const refreshed = await utils.geo.projects.list.fetch();
    const created =
      refreshed.find(p => p.enterpriseName === name.trim()) ?? refreshed[refreshed.length - 1];
    if (!created?.id) throw new Error("创建项目失败，请重试");
    setActiveProjectId(created.id);
    return created.id;
  }

  async function runStep<T>(stepNum: number, hint: string, fn: () => Promise<T>): Promise<T | undefined> {
    setPipelineStep(stepNum);
    setStepHint(hint);
    try {
      return await fn();
    } catch {
      setSkipNote("这步遇到了问题，跳过继续");
      toast.message("这步遇到了问题，跳过继续");
      return undefined;
    }
  }

  async function handleStart() {
    if (!canStart) return;
    setPhase("processing");
    setPipelineStep(0);
    setSkipNote(null);
    setGeneratedArticle(null);

    let projectId: number;
    try {
      projectId = await ensureProjectId(brandName);
    } catch (err) {
      console.error("[legacy-onboarding-create-project]", err);
      toast.error(toUserFacingCreateProjectError(err));
      setPhase("input");
      return;
    }

    await runStep(1, PROCESS_STEPS[0].hint, async () => {
      await upsertProfile.mutateAsync(buildProfilePayload(projectId, brandName, productDesc, targetCustomer));
      await utils.geo.assetLibrary.summary.invalidate({ projectId });
    });

    await runStep(2, PROCESS_STEPS[1].hint, async () => {
      await generateTargetQuestions.mutateAsync({ projectId });
      await runAnalysis.mutateAsync({ projectId });
    });

    await runStep(3, PROCESS_STEPS[2].hint, async () => {
      await generateTasks.mutateAsync({ projectId });
    });

    const articleResult = await runStep(4, PROCESS_STEPS[3].hint, async () => {
      await generateTopics.mutateAsync({ projectId });
      const topics = await utils.geo.articles.topics.list.fetch({ projectId });
      if (!topics?.length) return null;
      const firstTopic = topics[0] as { id: number };
      const gen = await generateArticle.mutateAsync({ topicId: firstTopic.id });
      if (!gen.articleId) return null;
      const list = await utils.geo.articles.list.fetch({ projectId });
      const row = (list as Array<{ id: number; title?: string; markdownContent?: string }>).find(a => a.id === gen.articleId);
      const score = gen.quality?.totalScore;
      const passed =
        gen.finalStatus === "质检通过" || (typeof score === "number" && score >= GEO_ARTICLE_MIN_PASS_SCORE && !gen.quality?.blocked);
      return {
        articleId: gen.articleId,
        title: row?.title,
        markdownContent: row?.markdownContent,
        qualityScore: score,
        passed,
      } satisfies GeneratedArticleState;
    });

    setPipelineStep(4);
    setStepHint("");
    if (articleResult) setGeneratedArticle(articleResult);
    setActiveProjectId(projectId);
    setPhase("result");
  }

  async function handleCopy() {
    const body = generatedArticle?.markdownContent ?? "";
    if (!body.trim()) return;
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      toast.success("已复制文章内容");
    } catch {
      toast.error("复制失败，请手动选择复制");
    }
  }

  if (authLoading || projectsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-gray-600">
        加载中...
      </div>
    );
  }

  if (projects.length > 0) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-4 text-center text-gray-900"
        data-testid="onboarding-has-projects"
      >
        <h1 className="text-xl font-semibold">已有客户项目</h1>
        <p className="max-w-md text-sm leading-relaxed text-gray-400">
          日常新增客户请前往客户管理台操作。本引导仅用于系统首次创建第一个客户项目。
        </p>
        <Button
          className="bg-blue-600 text-white hover:bg-blue-700"
          data-testid="onboarding-go-clients"
          onClick={() => setLocation("/clients")}
        >
          去客户管理台
        </Button>
      </div>
    );
  }

  if (!user) {
    const loginConfigured = isLoginConfigured();
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4 text-gray-900">
        <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white/[0.04] p-8 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-blue-600" />
          <h1 className="mt-4 text-xl font-semibold">登录后继续</h1>
          <p className="mt-2 text-sm text-gray-400">完成引导需要先登录</p>
          {loginConfigured ? (
            <Button className="mt-6 w-full bg-blue-600 text-white" onClick={() => { window.location.href = getLoginUrl(); }}>
              登录
            </Button>
          ) : (
            <Button className="mt-6 w-full bg-blue-600 text-white" disabled={devLogin.isPending} onClick={() => devLogin.mutate()}>
              {devLogin.isPending ? "正在登录" : "本地开发登录"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (phase === "input") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4 py-12 text-gray-900">
        <div className="w-full max-w-[500px]">
          <p className="text-center text-sm font-medium tracking-wide text-blue-600/90">内容增长系统</p>
          <h1 className="mt-6 text-center text-[28px] font-semibold leading-tight text-white">让AI持续为你推荐精准客户</h1>
          <p className="mt-3 text-center text-sm text-gray-400">填写3个信息，系统自动生成你的第一篇内容</p>

          <div className="my-8 border-t border-gray-200" />

          <div className="space-y-5">
            <label className="block space-y-2 text-sm">
              <span className="text-gray-700">
                你的品牌或名字 <span className="text-rose-400">*</span>
              </span>
              <Input
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                placeholder="例如：张老师、海豚知道"
                className="h-11 border-gray-200 bg-gray-50"
              />
            </label>
            <label className="block space-y-2 text-sm">
              <span className="text-gray-700">
                你主要卖什么 <span className="text-rose-400">*</span>
              </span>
              <Input
                value={productDesc}
                onChange={e => setProductDesc(e.target.value)}
                placeholder="例如：帮助知识付费老师提升直播转化率的AI经营系统"
                className="h-11 border-gray-200 bg-gray-50"
              />
            </label>
            <label className="block space-y-2 text-sm">
              <span className="text-gray-700">
                你的客户是谁 <span className="text-rose-400">*</span>
              </span>
              <Input
                value={targetCustomer}
                onChange={e => setTargetCustomer(e.target.value)}
                placeholder="例如：有课程但转化率低的知识付费老师"
                className="h-11 border-gray-200 bg-gray-50"
              />
            </label>
          </div>

          <div className="my-8 border-t border-gray-200" />

          <Button
            type="button"
            className="h-12 w-full rounded-xl bg-blue-600 text-base font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={!canStart}
            onClick={() => void handleStart()}
          >
            开始分析，约8分钟 →
          </Button>
          <p className="mt-4 text-center text-xs text-gray-500">预计完成时间：约8分钟，全程自动，无需等待</p>
        </div>
      </div>
    );
  }

  if (phase === "processing") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4 py-12 text-gray-900">
        <div className="w-full max-w-[400px]">
          <h2 className="text-center text-xl font-semibold text-white">正在为你准备内容方向...</h2>
          {skipNote ? <p className="mt-2 text-center text-xs text-amber-200">{skipNote}</p> : null}

          <ul className="mt-8 space-y-4">
            {PROCESS_STEPS.map((step, i) => {
              const st = stepStatuses[i];
              return (
                <li key={step.key} className="flex items-center gap-3 text-sm">
                  {st === "done" ? (
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : st === "active" ? (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center text-blue-600">●</span>
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-gray-600" />
                  )}
                  <span className={st === "pending" ? "text-gray-500" : "text-gray-700"}>{step.label}</span>
                  <span className="ml-auto text-xs text-gray-500">
                    {st === "done" ? "完成✓" : st === "active" ? "进行中..." : "待执行○"}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-8 h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-3 text-center text-xs text-gray-500">{stepHint || "请稍候..."}</p>
        </div>
      </div>
    );
  }

  const hasArticle = Boolean(generatedArticle?.markdownContent?.trim());
  const showScore = typeof generatedArticle?.qualityScore === "number";

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-12 text-gray-900">
      <div className="w-full max-w-[600px]">
        {hasArticle ? (
          <>
            <h1 className="text-center text-2xl font-semibold text-white">🎉 你的第一篇文章已准备好！</h1>
            {showScore ? (
              <p className="mt-4 text-center text-sm text-gray-600">
                质量评分：{generatedArticle!.qualityScore} 分{" "}
                {generatedArticle!.passed ? <span className="text-emerald-400">✓ 通过</span> : <span className="text-amber-300">待优化</span>}
              </p>
            ) : null}
            <div className="my-8 border-t border-gray-200" />
            <div className="rounded-2xl bg-gray-50 px-5 py-4">
              <h2 className="text-lg font-semibold leading-snug text-white">{generatedArticle?.title || "文章标题"}</h2>
            </div>
            <div className="relative mt-4 overflow-hidden rounded-2xl bg-gray-100 px-5 py-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{previewMarkdown(generatedArticle?.markdownContent ?? "")}</p>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-800 to-transparent" />
            </div>
            <div className="my-8 border-t border-gray-200" />
            <Button type="button" className="h-12 w-full bg-blue-600 text-white hover:bg-blue-700" onClick={() => void handleCopy()}>
              {copied ? "已复制 ✓" : "复制文章内容"}
            </Button>
            <Button
              type="button"
              className="mt-3 h-12 w-full bg-blue-600 text-white hover:bg-blue-700"
              data-testid="onboarding-go-profile"
              onClick={() => {
                const pid = getActiveProjectId();
                setLocation(pid ? buildProjectUrl("/enterprise-profile", pid) : "/clients");
              }}
            >
              继续 GEO 建档
            </Button>
            <Button
              type="button"
              variant="outline"
              className="mt-3 h-12 w-full border-gray-200 text-blue-700"
              onClick={() => {
                const pid = getActiveProjectId();
                setLocation(pid ? buildProjectUrl("/workspace", pid) : "/clients");
              }}
            >
              进入工作台
            </Button>
            <p className="mt-6 text-center text-xs leading-relaxed text-gray-500">
              复制后粘贴到微信公众号、知乎、百家号等平台发布
              <br />
              发布后回到产品登记链接，系统会追踪你的内容进展
            </p>
          </>
        ) : (
          <>
            <h1 className="text-center text-xl font-semibold text-white">内容方向已分析完成，文章生成遇到了问题</h1>
            <p className="mt-3 text-center text-sm text-gray-400">你可以在「本周内容」页查看内容建议并手动生成</p>
            <Button type="button" className="mt-8 h-12 w-full bg-blue-600 text-white hover:bg-blue-700" onClick={() => {
              const pid = getActiveProjectId();
              setLocation(pid ? buildProjectUrl("/weekly", pid) : "/clients");
            }}>
              进入工作台
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
