import { RetestDueReminderCard } from "@/components/diagnosis/RetestDueReminderCard";
import { FirstUseHintBanner } from "@/components/FirstUseHintBanner";
import { ContentAssetEffectFillPanel } from "@/components/inclusion-monitoring/ContentAssetEffectFillPanel";
import { ContentRetestAttributionPanel } from "@/components/inclusion-monitoring/ContentRetestAttributionPanel";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { FIRST_USE_HINT_KEYS } from "@/lib/firstUseHints";
import { geoP0Brand } from "@/lib/geoP0Visual";
import {
  mapContentAssetEffectRecordForView,
  resolveMonitoringRecordLifecycle,
  type ContentAssetEffectViewRecord,
} from "@/lib/contentAssetEffectView";
import { trpc } from "@/lib/trpc";
import { ContentAssetLifecycleProgress } from "@/components/content/ContentAssetLifecycleDisplay";
import {
  aggregateContentAssetEffectOverview,
  aggregatePlatformEffectSummary,
} from "@shared/contentAssetEffectTracking";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Eye,
  FileSearch,
  RadioTower,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type MonitoringRecordRow = ContentAssetEffectViewRecord;

type EffectVerificationPrimaryCta = {
  label: string;
  hint: string;
  path?: string;
};

type EffectVerificationIssue = {
  title: string;
  impact: string;
  nextStep: string;
};

type EffectVerificationStep = {
  title: string;
  status: "done" | "current" | "pending";
  description: string;
};

function mapRecordForView(record: ContentAssetEffectViewRecord & { canEnterAiRetest?: boolean }) {
  return mapContentAssetEffectRecordForView(record);
}

function toAbsoluteUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${window.location.origin}${path}`;
}

function formatTime(value?: Date | string | number | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function formatCount(value?: number | null) {
  if (value == null) return "—";
  return String(value);
}

function formatKeywords(keywords?: string[] | null) {
  if (!keywords?.length) return "—";
  return keywords.join("、");
}

function formatRate(rate: number | null) {
  if (rate == null) return "—";
  return `${rate}%`;
}

function formatCustomerCount(value: number | null | undefined, unit = "") {
  if (value == null || Number.isNaN(value)) return "暂无";
  return `${value.toLocaleString("zh-CN")}${unit}`;
}

function hasAiRetest(record: ContentAssetEffectViewRecord) {
  return Array.isArray(record.aiTestResults) && record.aiTestResults.length > 0;
}

function hasTrafficEvidence(overview: ReturnType<typeof aggregateContentAssetEffectOverview>) {
  return overview.totalReadCount != null || overview.totalImpressionCount != null;
}

function buildEffectVerificationConclusion(
  overview: ReturnType<typeof aggregateContentAssetEffectOverview>,
  records: ContentAssetEffectViewRecord[],
) {
  const testedCount = records.filter(hasAiRetest).length;
  if (overview.publishedCount === 0) {
    return "当前还没有已发布内容，暂时无法验证内容有没有被搜索和 AI 看见；建议先完成发布并回填公开链接。";
  }
  if (testedCount > 0) {
    return `本月已有 ${formatCustomerCount(testedCount, " 条")}内容完成 AI 复测，可开始判断内容是否影响品牌提及和推荐。`;
  }
  if (overview.retestReadyCount > 0) {
    return `已有 ${formatCustomerCount(overview.includedCount, " 条")}内容被搜索看见，其中 ${formatCustomerCount(overview.retestReadyCount, " 条")}可进入 AI 复测；下一步要验证 AI 是否识别并引用品牌。`;
  }
  if (overview.includedCount > 0) {
    return `已有 ${formatCustomerCount(overview.includedCount, " 条")}内容被搜索看见，正在等待复测窗口或补充效果数据；当前不伪造 AI 推荐变化。`;
  }
  return `已发布 ${formatCustomerCount(overview.publishedCount, " 条")}内容，但暂无确认收录证据；当前重点是确认内容是否能被搜索和 AI 读取。`;
}

function buildEffectVerificationIssues(
  overview: ReturnType<typeof aggregateContentAssetEffectOverview>,
  records: ContentAssetEffectViewRecord[],
): EffectVerificationIssue[] {
  const issues: EffectVerificationIssue[] = [];
  const testedCount = records.filter(hasAiRetest).length;

  if (overview.publishedCount === 0) {
    issues.push({
      title: "还没有可验证的公开内容",
      impact: "内容没有发布到公开平台前，AI 很难读取到新的品牌证据。",
      nextStep: "服务团队先完成公开发布和链接回填，再进入收录与 AI 复测。",
    });
  }
  if (overview.publishedCount > 0 && overview.includedCount === 0) {
    issues.push({
      title: "暂无确认收录证据",
      impact: "内容没有被搜索看见前，不能证明它会影响 AI 回答。",
      nextStep: "继续检查公开链接、收录状态和关键词触发情况。",
    });
  }
  if (overview.pendingCount > 0) {
    issues.push({
      title: "仍有内容待确认收录",
      impact: "待确认内容越多，报告里能证明的公开资产越少。",
      nextStep: "优先核实待收录内容，并补充截图或后台数据。",
    });
  }
  if (overview.includedCount > 0 && overview.retestReadyCount === 0 && testedCount === 0) {
    issues.push({
      title: "收录后还没进入 AI 复测",
      impact: "收录只能证明内容能被搜索看到，复测才能证明 AI 是否开始识别品牌。",
      nextStep: "等待复测窗口或补充满足复测条件的内容。",
    });
  }
  if (!hasTrafficEvidence(overview)) {
    issues.push({
      title: "阅读 / 曝光证据不足",
      impact: "客户需要看到内容是否被真实触达，只有发布记录还不够。",
      nextStep: "回填平台后台阅读、曝光或互动数据。",
    });
  }
  if (testedCount === 0 && overview.retestReadyCount > 0) {
    issues.push({
      title: "可复测内容还未验证 AI 变化",
      impact: "没有 AI 复测前，不能说明推荐率或提及率已经改善。",
      nextStep: "选择可复测内容加入 AI 复测，形成下次报告证据。",
    });
  }

  return issues.slice(0, 3);
}

function buildEffectVerificationPrimaryCta(
  overview: ReturnType<typeof aggregateContentAssetEffectOverview>,
): EffectVerificationPrimaryCta {
  const hint =
    overview.publishedCount === 0
      ? "当前仍在执行中，报告会说明哪些内容待发布、待验证。"
      : overview.retestReadyCount > 0 || overview.includedCount > 0
        ? "已有验证线索，下一步把发布、收录和复测情况汇总成客户可读报告。"
        : "已发布内容需要继续确认收录，报告会标明待验证项和复测时间。";
  return {
    label: "查看交付报告",
    hint,
    path: "/delivery-reports",
  };
}

function buildEffectVerificationSteps(
  overview: ReturnType<typeof aggregateContentAssetEffectOverview>,
  records: ContentAssetEffectViewRecord[],
): EffectVerificationStep[] {
  const testedCount = records.filter(hasAiRetest).length;
  const trafficReady = hasTrafficEvidence(overview);
  return [
    {
      title: "内容发布",
      status: overview.publishedCount > 0 ? "done" : "current",
      description: overview.publishedCount > 0 ? `已发布 ${formatCustomerCount(overview.publishedCount, " 条")}内容。` : "先把内容发布到公开平台。",
    },
    {
      title: "搜索收录",
      status: overview.includedCount > 0 ? "done" : overview.publishedCount > 0 ? "current" : "pending",
      description: overview.includedCount > 0 ? `${formatCustomerCount(overview.includedCount, " 条")}内容已被搜索看见。` : "确认内容是否被搜索引擎收录。",
    },
    {
      title: "数据回填",
      status: trafficReady ? "done" : overview.includedCount > 0 ? "current" : "pending",
      description: trafficReady ? "已有阅读或曝光证据。" : "补充阅读、曝光、互动或截图凭证。",
    },
    {
      title: "AI 复测",
      status: testedCount > 0 ? "done" : overview.retestReadyCount > 0 ? "current" : "pending",
      description: testedCount > 0 ? `${formatCustomerCount(testedCount, " 条")}内容已完成复测。` : overview.retestReadyCount > 0 ? `${formatCustomerCount(overview.retestReadyCount, " 条")}内容可进入复测。` : "收录后等待复测窗口。",
    },
    {
      title: "效果报告",
      status: testedCount > 0 ? "current" : "pending",
      description: testedCount > 0 ? "把复测变化沉淀到效果报告。" : "复测后形成客户可读证明。",
    },
  ];
}

function EffectVerificationMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-xl font-bold tabular-nums text-gray-900">{value}</p>
      <p className="mt-2 text-xs leading-5 text-gray-500">{hint}</p>
    </div>
  );
}

function EffectVerificationCustomerOverview({
  overview,
  records,
  selectedProjectId,
  onGoPath,
}: {
  overview: ReturnType<typeof aggregateContentAssetEffectOverview>;
  records: ContentAssetEffectViewRecord[];
  selectedProjectId: number;
  onGoPath: (path: string) => void;
}) {
  const conclusion = buildEffectVerificationConclusion(overview, records);
  const issues = buildEffectVerificationIssues(overview, records);
  const primaryCta = buildEffectVerificationPrimaryCta(overview);
  const testedCount = records.filter(hasAiRetest).length;

  const handlePrimaryCta = () => {
    if (primaryCta.path) {
      onGoPath(buildProjectUrl(primaryCta.path, selectedProjectId));
    }
  };

  return (
    <section
      className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm"
      data-testid="effect-verification-customer-overview"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <FileSearch className="size-5 text-blue-600" />
            <p className="text-sm font-semibold text-blue-700">客户可读结论</p>
          </div>
          <p className="mt-3 text-lg font-semibold leading-8 text-gray-900" data-testid="effect-verification-conclusion">
            {conclusion}
          </p>
          <p className="mt-3 text-sm leading-6 text-gray-600">{primaryCta.hint}</p>
        </div>
        <Button
          type="button"
          className={geoP0Brand.primary}
          onClick={handlePrimaryCta}
          data-testid="effect-verification-primary-cta"
        >
          <ArrowRight className="mr-2 size-4" />
          {primaryCta.label}
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="effect-verification-core-metrics">
        <EffectVerificationMetric
          label="已发布内容"
          value={formatCustomerCount(overview.publishedCount, " 条")}
          hint="进入公开平台后，才有机会被搜索和 AI 读取。"
        />
        <EffectVerificationMetric
          label="搜索是否看见"
          value={`${formatCustomerCount(overview.includedCount, " 条")}已收录`}
          hint={overview.inclusionRate == null ? "暂无收录率。" : `当前收录率 ${formatRate(overview.inclusionRate)}。`}
        />
        <EffectVerificationMetric
          label="AI 是否可复测"
          value={formatCustomerCount(overview.retestReadyCount, " 条")}
          hint={testedCount > 0 ? `${formatCustomerCount(testedCount, " 条")}已完成复测。` : "复测用于判断 AI 是否识别和引用品牌。"}
        />
        <EffectVerificationMetric
          label="阅读 / 曝光证据"
          value={
            hasTrafficEvidence(overview)
              ? [
                  overview.totalReadCount != null ? `阅读 ${formatCustomerCount(overview.totalReadCount)}` : null,
                  overview.totalImpressionCount != null ? `曝光 ${formatCustomerCount(overview.totalImpressionCount)}` : null,
                ]
                  .filter(Boolean)
                  .join(" / ")
              : "暂无"
          }
          hint="用于说明内容是否真实触达用户。"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4" data-testid="effect-verification-blockers">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-700" />
            <p className="text-sm font-semibold text-amber-950">当前还卡在哪里</p>
          </div>
          {issues.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-amber-900">暂无明显阻断，可继续扩大问题覆盖并保持复测节奏。</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {issues.map(issue => (
                <li key={issue.title} className="rounded-lg bg-white/70 p-3">
                  <p className="text-sm font-semibold text-amber-950">{issue.title}</p>
                  <p className="mt-1 text-xs leading-5 text-amber-900">
                    <span className="font-medium">客户影响：</span>
                    {issue.impact}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-amber-900">
                    <span className="font-medium">下一步：</span>
                    {issue.nextStep}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-blue-100 bg-white p-4" data-testid="effect-verification-next-proof">
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-blue-600" />
            <p className="text-sm font-semibold text-gray-900">下一份报告能证明什么</p>
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-600">
            <li>内容是否被搜索引擎看见，而不是只停留在“已发布”。</li>
            <li>AI 回答是否开始提到品牌、引用内容或给出推荐理由。</li>
            <li>哪些平台和问题值得继续投入，哪些内容需要补强。</li>
          </ul>
          <p className="mt-3 text-xs leading-5 text-gray-500">
            说明：本页只展示当前可验证证据，不承诺保证收录、排名或 AI 推荐。
          </p>
        </div>
      </div>
    </section>
  );
}

function EffectVerificationProcess({
  overview,
  records,
}: {
  overview: ReturnType<typeof aggregateContentAssetEffectOverview>;
  records: ContentAssetEffectViewRecord[];
}) {
  const steps = buildEffectVerificationSteps(overview, records);
  const statusLabel: Record<EffectVerificationStep["status"], string> = {
    done: "已完成",
    current: "进行中",
    pending: "待开始",
  };
  const statusClass: Record<EffectVerificationStep["status"], string> = {
    done: "border-emerald-200 bg-emerald-50 text-emerald-800",
    current: "border-blue-200 bg-blue-50 text-blue-800",
    pending: "border-gray-200 bg-gray-50 text-gray-500",
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="effect-verification-process">
      <div className="flex items-center gap-2">
        <RefreshCw className="size-4 text-blue-600" />
        <h2 className="text-base font-semibold text-gray-900">效果验证流程</h2>
      </div>
      <p className="mt-1 text-sm text-gray-500">发布 → 收录 → 数据回填 → AI 复测 → 效果报告。</p>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {steps.map(step => (
          <div key={step.title} className={`rounded-xl border p-3 ${statusClass[step.status]}`}>
            <p className="text-xs font-medium">{statusLabel[step.status]}</p>
            <p className="mt-1 text-sm font-semibold">{step.title}</p>
            <p className="mt-2 text-xs leading-5">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function EffectVerificationEvidenceSummary({
  overview,
  platformSummary,
  records,
}: {
  overview: ReturnType<typeof aggregateContentAssetEffectOverview>;
  platformSummary: ReturnType<typeof aggregatePlatformEffectSummary>;
  records: ContentAssetEffectViewRecord[];
}) {
  const testedCount = records.filter(hasAiRetest).length;
  return (
    <section
      id="effect-verification-evidence-summary"
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      data-testid="effect-verification-evidence-summary"
    >
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-4 text-emerald-600" />
        <h2 className="text-base font-semibold text-gray-900">客户可见证据摘要</h2>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <EffectVerificationMetric
          label="发布证据"
          value={formatCustomerCount(overview.publishedCount, " 条")}
          hint="来自已登记公开链接的发布记录。"
        />
        <EffectVerificationMetric
          label="收录证据"
          value={formatCustomerCount(overview.includedCount, " 条")}
          hint="证明内容已被搜索看见。"
        />
        <EffectVerificationMetric
          label="复测证据"
          value={formatCustomerCount(testedCount, " 条")}
          hint="证明 AI 回答是否发生变化。"
        />
        <EffectVerificationMetric
          label="平台覆盖"
          value={formatCustomerCount(platformSummary.length, " 个")}
          hint="用于判断哪些平台更值得继续投入。"
        />
      </div>
      {platformSummary.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">暂无平台效果数据。完成发布和收录确认后，这里会形成证据摘要。</p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {platformSummary.slice(0, 4).map(row => (
            <div key={row.platform} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-sm font-semibold text-gray-900">{row.platform}</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                已发布 {row.publishedCount} 条，已收录 {row.includedCount} 条，收录率 {formatRate(row.inclusionRate)}
                {row.totalReadCount != null ? `，累计阅读 ${row.totalReadCount}` : ""}。
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function InclusionMonitoringCenterPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { selectedProjectId, projectInput, enabled, projectsLoading } = useActiveProjectSelection();

  const workspaceSummaryQuery = trpc.geo.workspace.summary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );
  const monitoringQuery = trpc.geo.articles.inclusionMonitoringRecords.useQuery(projectInput, { enabled });
  const publishRecordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });

  const records = useMemo(
    () =>
      (monitoringQuery.data ?? [])
        .filter(record => record != null && typeof record?.id === "number")
        .map(record => mapRecordForView(record as MonitoringRecordRow & { canEnterAiRetest?: boolean })),
    [monitoringQuery.data],
  );

  const publishRecordCount = publishRecordsQuery.data?.length ?? 0;
  const loading = monitoringQuery.isLoading || publishRecordsQuery.isLoading;

  const overview = useMemo(
    () => aggregateContentAssetEffectOverview(publishRecordCount, records),
    [publishRecordCount, records],
  );

  const platformSummary = useMemo(() => aggregatePlatformEffectSummary(records), [records]);

  const retestReadyRecords = useMemo(
    () => records.filter(record => record.eligibleForAiRetest),
    [records],
  );

  const [runningRecordId, setRunningRecordId] = useState<number | null>(null);
  const [linkCheckTriggered, setLinkCheckTriggered] = useState(false);

  const checkPublishLinks = trpc.geo.inclusionMonitoring.checkPublishLinks.useMutation({
    onSuccess: async () => {
      if (selectedProjectId) {
        await utils.geo.articles.inclusionMonitoringRecords.invalidate({ projectId: selectedProjectId });
      }
      await monitoringQuery.refetch();
    },
  });

  useEffect(() => {
    setLinkCheckTriggered(false);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || records.length === 0 || linkCheckTriggered || checkPublishLinks.isPending) return;
    setLinkCheckTriggered(true);
    checkPublishLinks.mutate({ projectId: selectedProjectId });
  }, [selectedProjectId, records.length, linkCheckTriggered, checkPublishLinks.isPending]);

  const invalidateRecords = async () => {
    if (selectedProjectId) {
      await utils.geo.articles.inclusionMonitoringRecords.invalidate({ projectId: selectedProjectId });
    }
    await monitoringQuery.refetch();
  };

  const markIncluded = trpc.geo.inclusionMonitoring.markEffectIncluded.useMutation({
    onSuccess: async () => {
      toast.success("已标记为已收录");
      await invalidateRecords();
    },
    onError: e => toast.error(toUserFacingErrorFromUnknown(e, "操作失败")),
  });

  const markIgnored = trpc.geo.inclusionMonitoring.markEffectIgnored.useMutation({
    onSuccess: async () => {
      toast.success("已标记忽略");
      await invalidateRecords();
    },
    onError: e => toast.error(toUserFacingErrorFromUnknown(e, "操作失败")),
  });

  const runCheck = trpc.geo.aiMentionCheck.run.useMutation({
    onSuccess: async () => {
      toast.success("已加入 AI 复测队列");
      await invalidateRecords();
    },
    onError: e => toast.error(toUserFacingErrorFromUnknown(e, "复测失败")),
    onSettled: () => setRunningRecordId(null),
  });

  const handleNextAction = (record: MonitoringRecordRow) => {
    if (!selectedProjectId) return;
    const action = record.nextAction;
    if (!action) return;

    if (action.kind === "mark_included") {
      markIncluded.mutate({ projectId: selectedProjectId, recordId: record.id });
      return;
    }
    if (action.kind === "join_retest") {
      setRunningRecordId(record.id);
      runCheck.mutate({
        projectId: selectedProjectId,
        recordId: record.id,
        engines: ["doubao", "deepseek", "kimi"],
        testStage: "after_publish",
      });
      return;
    }
    if (action.kind === "republish") {
      setLocation(buildProjectUrl("/content-publishing", selectedProjectId));
      return;
    }
    if (action.kind === "ignore") {
      markIgnored.mutate({ projectId: selectedProjectId, recordId: record.id });
    }
  };

  if (!enabled && !projectsLoading) {
    return (
      <div data-testid="inclusion-monitoring-page">
        <ProjectContextEmptyState />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-gray-500" data-testid="inclusion-monitoring-page">
        <Spinner className="size-6 text-blue-600" />
        <p className="text-sm">正在加载内容资产效果数据…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12" data-testid="inclusion-monitoring-page">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">效果验证</h1>
        <p className="text-sm text-gray-500">
          用客户能理解的方式确认内容有没有被搜索看见、AI 有没有识别，以及下一步如何形成效果报告。
        </p>
      </header>

      {selectedProjectId ? (
        <EffectVerificationCustomerOverview
          overview={overview}
          records={records}
          selectedProjectId={selectedProjectId}
          onGoPath={setLocation}
        />
      ) : null}

      <FirstUseHintBanner
        storageKey={FIRST_USE_HINT_KEYS.inclusionMonitoring}
        message="发布内容后先确认是否被搜索看见，再按复测节奏验证 AI 是否开始识别和引用品牌。"
        data-testid="first-use-hint-inclusion-monitoring"
      />

      {workspaceSummaryQuery.data?.retestDueReminder && selectedProjectId ? (
        <details className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-gray-900">
            运营复测提醒
          </summary>
          <div className="border-t border-gray-100 p-5">
            <RetestDueReminderCard
              reminder={workspaceSummaryQuery.data.retestDueReminder}
              testId="inclusion-monitoring-retest-due-reminder"
              onGoRetest={() =>
                setLocation(
                  buildProjectUrl(workspaceSummaryQuery.data!.retestDueReminder!.ctaPath, selectedProjectId),
                )
              }
            />
          </div>
        </details>
      ) : null}

      <EffectVerificationProcess overview={overview} records={records} />

      <EffectVerificationEvidenceSummary
        overview={overview}
        platformSummary={platformSummary}
        records={records}
      />

      <section
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        data-testid="inclusion-monitoring-overview"
      >
        <h2 className="text-base font-semibold text-gray-900">运营指标</h2>
        <p className="mt-1 text-xs text-gray-500">以下指标用于交付人员核对发布、收录和复测队列。</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "已发布内容数", value: overview.publishedCount, testId: "overview-published-count" },
            { label: "已收录内容数", value: overview.includedCount, testId: "overview-included-count" },
            { label: "收录率", value: formatRate(overview.inclusionRate), testId: "overview-inclusion-rate" },
            { label: "待收录内容数", value: overview.pendingCount, testId: "overview-pending-count" },
            {
              label: "可进入AI复测数",
              value: overview.retestReadyCount,
              testId: "overview-retest-ready-count",
            },
            ...(overview.totalReadCount != null || overview.totalImpressionCount != null
              ? [
                  {
                    label: "累计阅读/曝光",
                    value: [
                      overview.totalReadCount != null ? `阅读 ${overview.totalReadCount}` : null,
                      overview.totalImpressionCount != null ? `曝光 ${overview.totalImpressionCount}` : null,
                    ]
                      .filter(Boolean)
                      .join(" / "),
                    testId: "overview-read-impression",
                  },
                ]
              : []),
          ].map(item => (
            <div
              key={item.testId}
              className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
              data-testid={item.testId}
            >
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      {publishRecordCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <RadioTower className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-4 text-sm font-medium text-gray-700">暂无已发布内容</p>
          <p className="mt-1 text-xs text-gray-500">当前说明为“正在执行中”，发布与回填由服务团队继续处理。</p>
        </div>
      ) : (
        <details
          id="monitoring-operation-details"
          className="rounded-xl border border-gray-200 bg-white shadow-sm"
          data-testid="effect-verification-advanced-details"
        >
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900">
            <span>运营明细与数据回填</span>
            <span className="text-xs font-normal text-gray-500">内容资产列表、平台汇总和 AI 复测操作已降级到运营区</span>
          </summary>
          <div className="space-y-6 border-t border-gray-100 p-5">
            <section
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              data-testid="inclusion-monitoring-content-table"
            >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">内容资产列表</h2>
              <p className="mt-1 text-xs text-gray-500">查看每条已发布内容的收录状态与效果数据，支持手动回填。</p>
            </div>
          </div>

          {records.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">已有发布记录，系统正在同步监测数据…</p>
          ) : (
            <div className="mt-4 space-y-4">
              {records.map(record => {
                const platform = (record.publishChannel ?? "").trim() || "未标注";
                const nextAction = record.nextAction;
                const isRunning = runCheck.isPending && runningRecordId === record.id;
                const lifecycle = resolveMonitoringRecordLifecycle(record);
                return (
                  <article
                    key={record.id}
                    id={`monitoring-record-${record.id}`}
                    className="rounded-lg border border-gray-100 bg-gray-50/50 p-4"
                    data-testid={`inclusion-content-row-${record.id}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                          {record.articleTitle?.trim() || `内容 #${record.articleId}`}
                        </h3>
                        <p className="text-xs text-gray-500">
                          平台：{platform}
                          {record.linkedDetectionQuestion ? ` · 关联问题：${record.linkedDetectionQuestion}` : ""}
                        </p>
                      </div>
                      <span
                        className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200"
                        data-testid={`inclusion-status-badge-${record.id}`}
                      >
                        {record.effectStatusLabel ?? "待收录"}
                      </span>
                    </div>

                    <ContentAssetLifecycleProgress
                      stage={lifecycle.stage}
                      compact
                      testId={`inclusion-lifecycle-${record.id}`}
                    />

                    <dl className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <dt className="text-gray-400">发布时间</dt>
                        <dd className="mt-0.5">{formatTime(record.publishedAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-400">公开链接</dt>
                        <dd className="mt-0.5">
                          {toAbsoluteUrl(record.publicUrl) ? (
                            <a
                              href={toAbsoluteUrl(record.publicUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              查看链接
                            </a>
                          ) : (
                            "—"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-400">收录时间</dt>
                        <dd className="mt-0.5">{formatTime(record.inclusionVerifiedAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-400">可进入AI复测</dt>
                        <dd className="mt-0.5">{record.eligibleForAiRetest ? "是" : "否"}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-400">收录验证关键词</dt>
                        <dd className="mt-0.5">{formatKeywords(record.inclusionKeywords)}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-400">阅读量</dt>
                        <dd className="mt-0.5">{formatCount(record.readCount)}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-400">曝光量</dt>
                        <dd className="mt-0.5">{formatCount(record.impressionCount)}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-400">互动量</dt>
                        <dd className="mt-0.5">{formatCount(record.interactionCount)}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-400">搜索触发关键词</dt>
                        <dd className="mt-0.5">{formatKeywords(record.searchTriggerKeywords)}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-400">数据来源</dt>
                        <dd className="mt-0.5">{record.dataSourceLabel ?? "—"}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-gray-400">截图凭证</dt>
                        <dd className="mt-0.5">
                          {record.evidenceScreenshotUrl ? (
                            <a
                              href={toAbsoluteUrl(record.evidenceScreenshotUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline break-all"
                            >
                              查看凭证
                            </a>
                          ) : (
                            "—"
                          )}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {nextAction?.kind === "wait_retest" ? (
                        <Button type="button" size="sm" variant="outline" disabled className="h-7 px-2 text-xs">
                          {nextAction.label}
                        </Button>
                      ) : nextAction ? (
                        <Button
                          type="button"
                          size="sm"
                          className={`h-7 px-2 text-xs ${geoP0Brand.primary}`}
                          disabled={
                            isRunning ||
                            markIncluded.isPending ||
                            markIgnored.isPending ||
                            (nextAction.kind === "join_retest" && runCheck.isPending)
                          }
                          onClick={() => handleNextAction(record)}
                          data-testid={`content-asset-next-action-${record.id}`}
                        >
                          {isRunning ? "复测中…" : nextAction.label}
                        </Button>
                      ) : null}
                      {nextAction?.kind === "republish" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={`h-7 px-2 text-xs ${geoP0Brand.primaryOutline}`}
                          onClick={() => selectedProjectId && markIgnored.mutate({ projectId: selectedProjectId, recordId: record.id })}
                        >
                          标记忽略
                        </Button>
                      ) : null}
                    </div>

                    {record.retestAttribution ? (
                      <ContentRetestAttributionPanel
                        recordId={record.id}
                        attribution={record.retestAttribution}
                        included={record.effectStatusLabel === "已收录"}
                      />
                    ) : null}

                    {selectedProjectId ? (
                      <ContentAssetEffectFillPanel
                        projectId={selectedProjectId}
                        record={record}
                        onSaved={invalidateRecords}
                      />
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
            </section>

            <section
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              data-testid="content-asset-platform-summary"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-gray-500" />
                <h2 className="text-base font-semibold text-gray-900">平台效果汇总</h2>
              </div>
              {platformSummary.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">暂无平台效果数据</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                        <th className="py-2 pr-4 font-medium">平台名称</th>
                        <th className="py-2 pr-4 font-medium">发布数量</th>
                        <th className="py-2 pr-4 font-medium">已收录数量</th>
                        <th className="py-2 pr-4 font-medium">收录率</th>
                        <th className="py-2 font-medium">累计阅读量</th>
                      </tr>
                    </thead>
                    <tbody>
                      {platformSummary.map(row => (
                        <tr key={row.platform} className="border-b border-gray-50 text-gray-800">
                          <td className="py-3 pr-4 whitespace-nowrap">{row.platform}</td>
                          <td className="py-3 pr-4">{row.publishedCount}</td>
                          <td className="py-3 pr-4">{row.includedCount}</td>
                          <td className="py-3 pr-4">{formatRate(row.inclusionRate)}</td>
                          <td className="py-3">{formatCount(row.totalReadCount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              data-testid="content-asset-retest-ready"
            >
              <h2 className="text-base font-semibold text-gray-900">以下内容已收录，可加入AI复测</h2>
              {retestReadyRecords.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">收录验证后3天可进入AI复测</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {retestReadyRecords.map(record => (
                    <li
                      key={record.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                      data-testid={`retest-ready-row-${record.id}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 line-clamp-1">
                          {record.articleTitle?.trim() || `内容 #${record.articleId}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(record.publishChannel ?? "").trim() || "未标注"} · 收录于 {formatTime(record.inclusionVerifiedAt)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className={geoP0Brand.primary}
                        disabled={runCheck.isPending && runningRecordId === record.id}
                        onClick={() => {
                          if (!selectedProjectId) return;
                          setRunningRecordId(record.id);
                          runCheck.mutate({
                            projectId: selectedProjectId,
                            recordId: record.id,
                            engines: ["doubao", "deepseek", "kimi"],
                            testStage: "after_publish",
                          });
                        }}
                        data-testid={`retest-ready-action-${record.id}`}
                      >
                        {runCheck.isPending && runningRecordId === record.id ? "复测中…" : "加入AI复测"}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </details>
      )}
    </div>
  );
}

export function InclusionMonitoringFlowPage() {
  return <InclusionMonitoringCenterPage />;
}
