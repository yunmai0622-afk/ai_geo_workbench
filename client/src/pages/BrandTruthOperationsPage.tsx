import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { trpc } from "@/lib/trpc";
import {
  BRAND_TRUTH_STATUS_LABELS,
  type BrandTruthVerificationStatus,
} from "@shared/brandTruth";
import {
  UNDERSTANDING_STATUS_LABELS,
  type UnderstandingFieldStatus,
} from "@shared/understandingEngine";
import {
  AlertTriangle,
  Brain,
  Database,
  FileCheck2,
  History,
  Link2,
  ListChecks,
  PlayCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400";

export default function BrandTruthOperationsPage() {
  const { user } = useAuth();
  const { selectedProjectId, selectedProject, projectsLoading } =
    useActiveProjectSelection();
  const canOperate = user?.role === "admin" || user?.role === "operator";
  const utils = trpc.useUtils();
  const input = { projectId: selectedProjectId ?? 0 };
  const profileQuery = trpc.geo.brandTruth.getProfile.useQuery(input, {
    enabled: Boolean(selectedProjectId && canOperate),
    retry: false,
  });
  const summaryQuery = trpc.geo.understanding.getUnderstandingSummary.useQuery(
    input,
    { enabled: Boolean(selectedProjectId && canOperate), retry: false }
  );
  const questionSetsQuery = trpc.geo.understanding.listQuestionSets.useQuery(
    input,
    { enabled: Boolean(selectedProjectId && canOperate), retry: false }
  );
  const shadowQuery = trpc.geo.understanding.readUnderstandingCutover.useQuery(
    input,
    { enabled: Boolean(selectedProjectId && canOperate), retry: false }
  );
  const [factDraft, setFactDraft] = useState({
    category: "business" as const,
    factKey: "",
    factValue: "",
    importance: "high" as const,
  });
  const [evidenceDraft, setEvidenceDraft] = useState({
    title: "",
    url: "",
    evidenceType: "官网首页" as const,
    sourceClass: "official" as const,
  });
  const [selectedFactId, setSelectedFactId] = useState<number | null>(null);
  const [verificationPlanJson, setVerificationPlanJson] = useState("");
  const [correctionTasksJson, setCorrectionTasksJson] = useState("");
  const [correctionAction, setCorrectionAction] = useState<
    | "manual_review"
    | "official_definition_page"
    | "faq"
    | "organization_schema"
    | "brand_schema"
    | "product_service_schema"
    | "customer_case"
    | "third_party_profile"
    | "update_old_content"
    | "capability_boundary"
    | "schedule_retest"
  >("manual_review");
  const versionsQuery = trpc.geo.brandTruth.listFactVersions.useQuery(
    { projectId: selectedProjectId ?? 0, factId: selectedFactId ?? 0 },
    { enabled: Boolean(selectedProjectId && selectedFactId), retry: false }
  );

  useEffect(() => {
    document.title = `${selectedProject?.enterpriseName || "企业"} - 品牌事实与理解校准`;
  }, [selectedProject?.enterpriseName]);

  const invalidate = async () => {
    if (!selectedProjectId) return;
    await Promise.all([
      utils.geo.brandTruth.getProfile.invalidate({
        projectId: selectedProjectId,
      }),
      utils.geo.understanding.getUnderstandingSummary.invalidate({
        projectId: selectedProjectId,
      }),
      utils.geo.understanding.listQuestionSets.invalidate({
        projectId: selectedProjectId,
      }),
      utils.geo.understanding.readUnderstandingCutover.invalidate({
        projectId: selectedProjectId,
      }),
    ]);
  };
  const createProfile = trpc.geo.brandTruth.createProfile.useMutation({
    onSuccess: async () => {
      toast.success("已创建品牌事实基线；导入项均为待核验");
      await invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const applyVerificationBatch = trpc.geo.brandTruth.applyVerificationBatch.useMutation({
    onSuccess: async result => {
      toast.success(`事实核验已形成 Profile V${result.profileVersion}，问题集 V${result.questionSetVersion}`);
      setVerificationPlanJson("");
      await invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const createFact = trpc.geo.brandTruth.createFact.useMutation({
    onSuccess: async () => {
      toast.success("事实已保存为待核验");
      setFactDraft({
        category: "business",
        factKey: "",
        factValue: "",
        importance: "high",
      });
      await invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const addEvidence = trpc.geo.brandTruth.addEvidence.useMutation({
    onSuccess: async () => {
      toast.success("证据已添加，仍需人工审核和关联事实");
      setEvidenceDraft({
        title: "",
        url: "",
        evidenceType: "官网首页",
        sourceClass: "official",
      });
      await invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const reviewEvidence = trpc.geo.brandTruth.reviewEvidence.useMutation({
    onSuccess: async () => {
      toast.success("证据审核状态已更新");
      await invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const linkEvidence = trpc.geo.brandTruth.linkEvidence.useMutation({
    onSuccess: async () => {
      toast.success("证据已关联到所选事实");
      await invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const updateFact = trpc.geo.brandTruth.updateFact.useMutation({
    onSuccess: async () => {
      toast.success("事实已基于公开证据确认，并生成新版本");
      await invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const createConflict = trpc.geo.brandTruth.createConflict.useMutation({
    onSuccess: async () => {
      toast.success("事实冲突已登记");
      await invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const ensureQuestions =
    trpc.geo.understanding.ensureDefaultQuestionSet.useMutation({
      onSuccess: async () => {
        toast.success("Understand 固定问题集已准备");
        await invalidate();
      },
      onError: error => toast.error(error.message),
    });
  const runTest = trpc.geo.understanding.runUnderstandingTest.useMutation({
    onSuccess: async result => {
      if (result.failedQuestionCount > 0) {
        toast.warning(`真实测试完成 ${result.questionCount}/${result.plannedQuestionCount} 题，${result.failedQuestionCount} 题失败并已保留失败原因`);
      } else {
        toast.success(`已完成 ${result.questionCount} 个真实问题测试并写入评价`);
      }
      await invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const reviewEvaluation = trpc.geo.understanding.reviewEvaluation.useMutation({
    onSuccess: async () => {
      toast.success("人工复核已保存");
      await invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const createCorrectionTask =
    trpc.geo.understanding.createCorrectionTask.useMutation({
      onSuccess: async () => {
        toast.success("纠偏任务已创建");
        await invalidate();
      },
      onError: error => toast.error(error.message),
    });
  const createCorrectionTasksBatch = trpc.geo.understanding.createCorrectionTasksBatch.useMutation({
    onSuccess: async result => {
      toast.success(`已创建 ${result.count} 项经人工复核的纠偏任务`);
      setCorrectionTasksJson("");
      await invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const scheduleRetest = trpc.geo.understanding.scheduleRetest.useMutation({
    onSuccess: async () => {
      toast.success("已安排下一轮复测");
      await invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const busy =
    createProfile.isPending ||
    applyVerificationBatch.isPending ||
    createFact.isPending ||
    addEvidence.isPending ||
    reviewEvidence.isPending ||
    linkEvidence.isPending ||
    updateFact.isPending ||
    createConflict.isPending ||
    ensureQuestions.isPending ||
    runTest.isPending ||
    reviewEvaluation.isPending ||
    createCorrectionTask.isPending ||
    createCorrectionTasksBatch.isPending ||
    scheduleRetest.isPending;
  const summary = summaryQuery.data;
  const facts = profileQuery.data?.facts ?? [];
  const sets = questionSetsQuery.data ?? [];
  const activeSet = sets.find(set => set.status === "active") ?? sets[0];
  const selectedFact = facts.find(fact => fact.id === selectedFactId);
  const confirmedCount = useMemo(
    () =>
      facts.filter(fact =>
        [
          "official_verified",
          "third_party_verified",
          "multi_source_verified",
        ].includes(fact.verificationStatus)
      ).length,
    [facts]
  );

  if (!selectedProjectId && !projectsLoading)
    return (
      <ProjectContextEmptyState
        title="品牌事实与理解校准"
        description="请先选择项目，再维护项目独立的事实基线和理解评价。"
      />
    );
  if (!canOperate)
    return (
      <section
        className="rounded-2xl border border-amber-200 bg-amber-50 p-6"
        data-testid="brand-truth-operations-forbidden"
      >
        <h1 className="font-semibold text-amber-950">
          该页面仅供运营和管理员使用
        </h1>
        <p className="mt-2 text-sm text-amber-800">
          客户账号可在“AI 品牌理解”页面只读查看事实、证据和评价结论。
        </p>
      </section>
    );
  if (profileQuery.isLoading || summaryQuery.isLoading)
    return (
      <div
        className="h-72 animate-pulse rounded-2xl bg-gray-100"
        data-testid="brand-truth-operations-loading"
      />
    );
  if (profileQuery.isError || summaryQuery.isError)
    return (
      <div
        className="rounded-2xl border border-red-200 bg-red-50 p-6"
        data-testid="brand-truth-operations-error"
      >
        <h1 className="font-semibold text-red-900">运营校准台暂时无法读取</h1>
        <p className="mt-2 text-sm text-red-700">
          {profileQuery.error?.message || summaryQuery.error?.message}
        </p>
      </div>
    );

  return (
    <div className="space-y-6 pb-12" data-testid="brand-truth-operations-page">
      <header className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white sm:p-8">
        <p className="text-sm text-sky-300">运营后台 · AI Trust Engine</p>
        <h1 className="mt-2 text-2xl font-bold">品牌事实与理解校准</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          维护版本化标准事实、公开证据和来源冲突，复核 AI
          原始回答与字段比对，并将 P0/P1 偏差转为可验证的纠偏动作。
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
            事实 {facts.length}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
            已核验 {confirmedCount}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
            问题 {activeSet?.questions.length ?? 0}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
            待复核{" "}
            {summary?.evaluations.filter(
              item => item.manualReviewStatus === "pending"
            ).length ?? 0}
          </span>
        </div>
      </header>

      {shadowQuery.data?.mode === "shadow_read" && (
        <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5" data-testid="understand-shadow-read-operations">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">仅运营可见 · Shadow Read</p>
              <h2 className="mt-1 text-lg font-semibold text-violet-950">Legacy / v2 差异观察</h2>
              <p className="mt-1 text-sm text-violet-800">客户主读仍为 Legacy；shadow 结果不进入客户页面或趋势。</p>
            </div>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-800">暂不建议切换 v2_primary</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">Legacy 结果</p><p className="mt-1 text-xl font-semibold">{shadowQuery.data.legacyHistory.length}</p></div>
            <div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">v2 Assessment</p><p className="mt-1 text-xl font-semibold">{shadowQuery.data.v2.length}</p></div>
            <div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">趋势资格</p><p className="mt-1 font-semibold">不进入趋势</p></div>
            <div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">写入路径</p><p className="mt-1 font-semibold">Legacy（无双写）</p></div>
          </div>
          <p className="mt-3 text-xs text-violet-700">分数仅在事实覆盖满足正式方法论时生成；方法论不兼容时只解释差异，不强求分数一致。切换建议须等待运营人工复核。</p>
        </section>
      )}

      {!profileQuery.data?.profile && (
        <section
          className="rounded-2xl border border-amber-200 bg-amber-50 p-5"
          data-testid="brand-truth-create-profile"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-amber-950">
                尚未建立正式 Brand Truth Profile
              </h2>
              <p className="mt-1 text-sm text-amber-800">
                可从现有企业档案创建草稿。所有导入内容都保持“企业提供，待公开核验”。
              </p>
            </div>
            <Button
              disabled={busy}
              onClick={() =>
                createProfile.mutate({ projectId: selectedProjectId! })
              }
            >
              <Database className="mr-2 size-4" />
              建立事实基线
            </Button>
          </div>
        </section>
      )}

      {user?.role === "admin" && profileQuery.data?.profile && (
        <details className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="brand-truth-verification-batch">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">导入经人工复核的事实核验计划</summary>
          <p className="mt-2 text-xs leading-5 text-slate-500">仅接受带来源主体、公开 URL、抓取时间和摘要的 JSON 计划；服务端会在同一事务内校验证据门槛、保留旧版本并生成一个新 Profile 版本。</p>
          <textarea
            className={`${inputClass} mt-3 min-h-48 font-mono text-xs`}
            placeholder="粘贴经过人工复核的核验计划 JSON"
            value={verificationPlanJson}
            onChange={event => setVerificationPlanJson(event.target.value)}
          />
          <Button
            className="mt-3"
            disabled={busy || !verificationPlanJson.trim()}
            onClick={() => {
              try {
                applyVerificationBatch.mutate({
                  projectId: selectedProjectId!,
                  plan: JSON.parse(verificationPlanJson),
                });
              } catch {
                toast.error("核验计划不是有效 JSON");
              }
            }}
          >
            <ShieldCheck className="mr-2 size-4" />
            校验并生成新事实版本
          </Button>
        </details>
      )}

      <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <article
          className="rounded-2xl border border-gray-200 bg-white p-5"
          data-testid="operations-truth-profile"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-emerald-700" />
              <h2 className="font-semibold">Brand Truth Profile</h2>
            </div>
            <span className="text-xs text-gray-500">
              V{profileQuery.data?.profile?.currentVersion ?? "待建立"}
            </span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b text-xs text-gray-500">
                <tr>
                  <th className="pb-2">事实</th>
                  <th className="pb-2">标准值</th>
                  <th className="pb-2">核验状态</th>
                  <th className="pb-2">证据</th>
                  <th className="pb-2">版本</th>
                </tr>
              </thead>
              <tbody>
                {facts.map(fact => (
                  <tr
                    key={fact.id}
                    className="border-b border-gray-50 align-top"
                  >
                    <td className="py-3 font-medium">{fact.factKey}</td>
                    <td className="max-w-sm py-3 text-gray-600">
                      {fact.factValue}
                    </td>
                    <td className="py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs">
                        {
                          BRAND_TRUTH_STATUS_LABELS[
                            fact.verificationStatus as BrandTruthVerificationStatus
                          ]
                        }
                      </span>
                    </td>
                    <td className="py-3">{fact.sourceCount ?? 0}</td>
                    <td className="py-3">
                      <button
                        className="text-blue-700 hover:underline"
                        onClick={() =>
                          fact.id > 0 && setSelectedFactId(fact.id)
                        }
                      >
                        V{fact.version}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-800">
              添加一条待核验事实
            </summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <select
                className={inputClass}
                value={factDraft.category}
                onChange={event =>
                  setFactDraft(value => ({
                    ...value,
                    category: event.target.value as typeof value.category,
                  }))
                }
              >
                <option value="identity">品牌身份</option>
                <option value="business">业务定义</option>
                <option value="capability_boundary">能力与边界</option>
                <option value="temporal">时效事实</option>
              </select>
              <input
                className={inputClass}
                placeholder="factKey，例如 category"
                value={factDraft.factKey}
                onChange={event =>
                  setFactDraft(value => ({
                    ...value,
                    factKey: event.target.value,
                  }))
                }
              />
              <textarea
                className={`${inputClass} sm:col-span-2`}
                placeholder="企业确认的标准表达（保存后仍为待核验）"
                value={factDraft.factValue}
                onChange={event =>
                  setFactDraft(value => ({
                    ...value,
                    factValue: event.target.value,
                  }))
                }
              />
              <Button
                className="sm:col-span-2"
                disabled={
                  busy ||
                  !profileQuery.data?.profile ||
                  !factDraft.factKey.trim() ||
                  !factDraft.factValue.trim()
                }
                onClick={() =>
                  createFact.mutate({
                    projectId: selectedProjectId!,
                    data: {
                      ...factDraft,
                      factType: factDraft.factKey,
                      verificationStatus: "provided_unverified",
                    },
                  })
                }
              >
                <Plus className="mr-2 size-4" />
                保存待核验事实
              </Button>
            </div>
          </details>
        </article>
        <aside className="space-y-5">
          <article
            className="rounded-2xl border border-gray-200 bg-white p-5"
            data-testid="operations-version-history"
          >
            <div className="flex items-center gap-2">
              <History className="size-5 text-blue-700" />
              <h2 className="font-semibold">事实版本历史</h2>
            </div>
            {selectedFactId ? (
              <div className="mt-4 space-y-3">
                {(versionsQuery.data ?? []).map(version => (
                  <div key={version.id} className="rounded-xl bg-gray-50 p-3">
                    <p className="text-sm font-medium">
                      事实 V{version.version} · 基线 V{version.profileVersion}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {version.changeReason}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      修改前：{version.previousValue || "首次创建"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      修改后：{version.newValue}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      需重测：{version.requiresRevalidation ? "是" : "否"}
                    </p>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      const fact = facts.find(
                        item => item.id === selectedFactId
                      );
                      if (fact)
                        createConflict.mutate({
                          projectId: selectedProjectId!,
                          factId: fact.id,
                          factKey: fact.factKey,
                          conflictType: "来源表达不一致",
                          severity: "P1",
                        });
                    }}
                  >
                    <AlertTriangle className="mr-1 size-3" />
                    标记来源冲突
                  </Button>
                  {selectedFact &&
                    selectedFact.sourceCount > 0 &&
                    ![
                      "official_verified",
                      "third_party_verified",
                      "multi_source_verified",
                    ].includes(selectedFact.verificationStatus) && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          updateFact.mutate({
                            projectId: selectedProjectId!,
                            id: selectedFact.id,
                            data: {
                              category: selectedFact.category,
                              factType: selectedFact.factType,
                              factKey: selectedFact.factKey,
                              factValue: selectedFact.factValue,
                              description: selectedFact.description,
                              importance: selectedFact.importance,
                              verificationStatus:
                                selectedFact.officialSourceCount > 0 &&
                                selectedFact.thirdPartySourceCount > 0
                                  ? "multi_source_verified"
                                  : selectedFact.officialSourceCount > 0
                                    ? "official_verified"
                                    : "third_party_verified",
                              validFrom: selectedFact.validFrom,
                              validTo: selectedFact.validTo,
                            },
                            changeReason: "运营已核对关联的公开证据并确认事实",
                            affectsHistoricalInterpretation: false,
                          })
                        }
                      >
                        <ShieldCheck className="mr-1 size-3" />
                        基于证据确认事实
                      </Button>
                    )}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">
                点击事实版本号查看修改前后值、原因和重测标记。
              </p>
            )}
          </article>
          <article className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="font-semibold">安全原则</h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li>客户只读，运营维护事实和任务。</li>
              <li>已核验状态必须有可访问且审核通过的证据。</li>
              <li>历史评价绑定当时的事实版本，不被新值覆盖。</li>
            </ul>
          </article>
        </aside>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article
          className="rounded-2xl border border-gray-200 bg-white p-5"
          data-testid="operations-evidence"
        >
          <div className="flex items-center gap-2">
            <Link2 className="size-5 text-violet-700" />
            <h2 className="font-semibold">证据关联</h2>
          </div>
          {selectedFact && (
            <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
              当前所选事实：{selectedFact.factKey}。审核证据后，再关联到该事实。
            </p>
          )}
          <div className="mt-4 space-y-3">
            {(summary?.evidence ?? []).map(item => (
              <div
                key={item.id}
                className="rounded-xl border border-gray-100 p-3"
              >
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {item.evidenceType} · {item.sourceClass} ·{" "}
                  {item.verificationStatus} / {item.manualReviewStatus}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.manualReviewStatus === "pending" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          reviewEvidence.mutate({
                            projectId: selectedProjectId!,
                            id: item.id,
                            verificationStatus: "verified",
                            manualReviewStatus: "approved",
                            accessible: true,
                          })
                        }
                      >
                        确认可访问证据
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          reviewEvidence.mutate({
                            projectId: selectedProjectId!,
                            id: item.id,
                            verificationStatus: "rejected",
                            manualReviewStatus: "rejected",
                            accessible: false,
                          })
                        }
                      >
                        驳回
                      </Button>
                    </>
                  )}
                  {selectedFactId &&
                    item.verificationStatus === "verified" &&
                    item.manualReviewStatus === "approved" &&
                    item.accessible && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          linkEvidence.mutate({
                            projectId: selectedProjectId!,
                            factId: selectedFactId,
                            evidenceId: item.id,
                            supportType: "supports",
                            confidence: 90,
                          })
                        }
                      >
                        <Link2 className="mr-1 size-3" />
                        关联所选事实
                      </Button>
                    )}
                </div>
              </div>
            ))}
            {!summary?.evidence.length && (
              <p className="text-sm text-gray-500">
                尚无证据。添加后仍需审核并关联具体事实。
              </p>
            )}
          </div>
          <details className="mt-4 rounded-xl bg-gray-50 p-4">
            <summary className="cursor-pointer text-sm font-medium">
              添加公开证据
            </summary>
            <div className="mt-3 space-y-3">
              <input
                className={inputClass}
                placeholder="证据标题"
                value={evidenceDraft.title}
                onChange={event =>
                  setEvidenceDraft(value => ({
                    ...value,
                    title: event.target.value,
                  }))
                }
              />
              <input
                className={inputClass}
                placeholder="公开 URL"
                value={evidenceDraft.url}
                onChange={event =>
                  setEvidenceDraft(value => ({
                    ...value,
                    url: event.target.value,
                  }))
                }
              />
              <Button
                disabled={busy || !evidenceDraft.title.trim()}
                onClick={() =>
                  addEvidence.mutate({
                    projectId: selectedProjectId!,
                    data: {
                      ...evidenceDraft,
                      url: evidenceDraft.url || null,
                      independentSource: false,
                      accessible: false,
                      authorityLevel: "unknown",
                      freshnessStatus: "unknown",
                      consistencyStatus: "unknown",
                      verificationStatus: "pending",
                      manualReviewStatus: "pending",
                    },
                  })
                }
              >
                <Plus className="mr-2 size-4" />
                添加待审核证据
              </Button>
            </div>
          </details>
        </article>
        <article
          className="rounded-2xl border border-gray-200 bg-white p-5"
          data-testid="operations-conflicts"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-700" />
            <h2 className="font-semibold">来源冲突</h2>
          </div>
          {summary?.conflicts.length ? (
            <div className="mt-4 space-y-3">
              {summary.conflicts.map(item => (
                <div key={item.id} className="rounded-xl bg-amber-50 p-3">
                  <div className="flex justify-between">
                    <p className="text-sm font-medium">{item.factKey}</p>
                    <span className="text-xs font-semibold">
                      {item.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">
                    {item.conflictType} · {item.resolutionStatus}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">
              暂无已登记冲突。没有记录不代表来源天然一致。
            </p>
          )}
        </article>
      </section>

      <section
        className="rounded-2xl border border-gray-200 bg-white p-5"
        data-testid="operations-question-set"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListChecks className="size-5 text-blue-700" />
            <div>
              <h2 className="font-semibold">Understand 问题池</h2>
              <p className="text-xs text-gray-500">
                固定题受版本保护，高风险、同名、过时和竞品混淆题可形成新版本。
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              ensureQuestions.mutate({ projectId: selectedProjectId! })
            }
          >
            <RefreshCw className="mr-2 size-4" />
            准备默认问题池
          </Button>
        </div>
        {activeSet ? (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {activeSet.questions.map(question => (
              <div key={question.id} className="rounded-xl bg-gray-50 p-3">
                <p className="text-sm text-gray-800">{question.questionText}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {question.questionType} ·{" "}
                  {question.verificationFactKeys.join("、")}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">尚未建立项目独立问题集。</p>
        )}
        <div className="mt-4 flex justify-end">
          <Button
            disabled={busy || !activeSet || confirmedCount === 0}
            onClick={() =>
              runTest.mutate({
                projectId: selectedProjectId!,
                questionIds: activeSet?.questions
                  .slice(0, 15)
                  .map(question => question.id),
                targetRetestRound: "first_understand_baseline",
              })
            }
          >
            <PlayCircle className="mr-2 size-4" />
            执行 15 题真实理解测试
          </Button>
        </div>
        {confirmedCount === 0 && (
          <p className="mt-2 text-right text-xs text-amber-700">
            至少需要一条带公开证据的已核验事实，系统不会用企业自述直接判 AI
            对错。
          </p>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <article
          className="rounded-2xl border border-gray-200 bg-white p-5"
          data-testid="operations-manual-review"
        >
          <div className="flex items-center gap-2">
            <Brain className="size-5 text-fuchsia-700" />
            <h2 className="font-semibold">AI 回答评估与人工复核</h2>
          </div>
          {summary?.evaluations.length ? (
            <div className="mt-4 space-y-4">
              {summary.evaluations.map(item => (
                <div
                  key={item.id}
                  className="rounded-xl border border-gray-100 p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="text-xs text-gray-500">
                      问题 #{item.questionId} · {item.testedChannel}
                    </span>
                    <span className="text-xs font-semibold text-red-700">
                      {item.severity} ·{" "}
                      {
                        UNDERSTANDING_STATUS_LABELS[
                          item.finalStatus as UnderstandingFieldStatus
                        ]
                      }
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                    {item.rawAnswer}
                  </p>
                  <details className="mt-3 rounded-lg bg-gray-50 p-3">
                    <summary className="cursor-pointer text-xs font-medium">
                      查看结构化抽取、规则比对与版本
                    </summary>
                    <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-xs text-gray-600">
                      {JSON.stringify(
                        {
                          extractedFacts: item.extractedFacts,
                          ruleResults: item.ruleResults,
                          evidenceReferences: item.evidenceReferences,
                          truthProfileVersion: item.truthProfileVersion,
                          questionSetVersion: item.questionSetVersion,
                          extractionVersion: item.extractionVersion,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </details>
                  {item.manualReviewStatus === "pending" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          reviewEvaluation.mutate({
                            projectId: selectedProjectId!,
                            id: item.id,
                            finalStatus: item.finalStatus,
                            reviewNote:
                              "运营已对照事实与证据，确认当前系统判断。",
                          })
                        }
                      >
                        <FileCheck2 className="mr-1 size-3" />
                        确认判断
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          reviewEvaluation.mutate({
                            projectId: selectedProjectId!,
                            id: item.id,
                            finalStatus: "unverifiable",
                            reviewNote:
                              "证据不足，暂不能判定理解错误或疑似虚构。",
                          })
                        }
                      >
                        改为暂无法核验
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">
              尚无真实 Understand
              回答。执行测试后会保存原始回答、结构化抽取、规则结果和事实版本。
            </p>
          )}
        </article>
        <article
          className="rounded-2xl border border-gray-200 bg-white p-5"
          data-testid="operations-correction-tasks"
        >
          <div className="flex items-center gap-2">
            <FileCheck2 className="size-5 text-emerald-700" />
            <h2 className="font-semibold">纠偏任务与再次验证</h2>
          </div>
          <select
            className={`${inputClass} mt-4`}
            value={correctionAction}
            onChange={event =>
              setCorrectionAction(event.target.value as typeof correctionAction)
            }
          >
            <option value="manual_review">人工核验</option>
            <option value="official_definition_page">官网定义页</option>
            <option value="faq">FAQ</option>
            <option value="organization_schema">Organization Schema</option>
            <option value="brand_schema">Brand Schema</option>
            <option value="product_service_schema">
              Product / Service Schema
            </option>
            <option value="customer_case">客户案例</option>
            <option value="third_party_profile">第三方资料</option>
            <option value="update_old_content">更新旧内容</option>
            <option value="capability_boundary">能力边界说明</option>
            <option value="schedule_retest">再次复测</option>
          </select>
          {summary?.evaluations.find(
            item => item.manualReviewStatus === "pending" && item.severity
          ) && (
            <Button
              className="mt-3 w-full"
              variant="outline"
              disabled={busy}
              onClick={() => {
                const evaluation = summary.evaluations.find(
                  item => item.manualReviewStatus === "pending" && item.severity
                );
                if (!evaluation?.severity) return;
                createCorrectionTask.mutate({
                  projectId: selectedProjectId!,
                  evaluationId: evaluation.id,
                  factKey: "manual_review_required",
                  expectedFact: null,
                  observedStatement: evaluation.rawAnswer,
                  severity: evaluation.severity,
                  recommendedAssetType: correctionAction.includes("schema")
                    ? "品牌实体资产"
                    : correctionAction === "customer_case" ||
                        correctionAction === "third_party_profile"
                      ? "可信信源资产"
                      : "业务定义资产",
                  actionType: correctionAction,
                  actionDescription: `根据已复核偏差执行：${correctionAction}`,
                  requiredEvidence:
                    "形成可访问、可追溯且与标准事实一致的公开证据",
                  completionCriteria:
                    "动作完成、证据审核通过，并使用原固定问题再次复测",
                  verificationQuestionIds: [evaluation.questionId],
                });
              }}
            >
              按所选动作创建纠偏任务
            </Button>
          )}
          {summary?.correctionTasks.length ? (
            <div className="mt-4 space-y-3">
              {summary.correctionTasks.map(task => (
                <div key={task.id} className="rounded-xl bg-gray-50 p-3">
                  <div className="flex justify-between gap-2">
                    <p className="text-sm font-medium">
                      {task.actionDescription}
                    </p>
                    <span className="text-xs font-semibold text-red-700">
                      {task.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {task.actionType} · {task.recommendedAssetType}
                  </p>
                  <p className="mt-2 text-xs text-gray-600">
                    完成标准：{task.completionCriteria}
                  </p>
                  {task.status === "pending" && (
                    <Button
                      className="mt-3"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        scheduleRetest.mutate({
                          projectId: selectedProjectId!,
                          taskId: task.id,
                          targetRetestRound: "next_understand_retest",
                        })
                      }
                    >
                      安排再次验证
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">
              P0/P1
              复核后可创建官网、FAQ、Schema、案例、第三方资料或人工核验任务；不会默认转成文章。
            </p>
          )}
          {user?.role === "admin" && summary?.evaluations.length ? (
            <details className="mt-4 rounded-xl border border-gray-200 bg-white p-3" data-testid="correction-task-batch-import">
              <summary className="cursor-pointer text-sm font-medium text-gray-800">导入经人工复核的纠偏任务计划</summary>
              <p className="mt-2 text-xs leading-5 text-gray-500">用于把真实偏差一次性转为官网、FAQ、Schema、案例、第三方资料或复测动作；每项必须引用当前项目的评价 ID。</p>
              <textarea className={`${inputClass} mt-3 min-h-40 font-mono text-xs`} value={correctionTasksJson} onChange={event => setCorrectionTasksJson(event.target.value)} placeholder="粘贴纠偏任务 JSON 数组" />
              <Button className="mt-3 w-full" variant="outline" disabled={busy || !correctionTasksJson.trim()} onClick={() => {
                try {
                  createCorrectionTasksBatch.mutate({ projectId: selectedProjectId!, tasks: JSON.parse(correctionTasksJson) });
                } catch {
                  toast.error("纠偏任务计划不是有效 JSON");
                }
              }}>创建纠偏任务</Button>
            </details>
          ) : null}
        </article>
      </section>
    </div>
  );
}
