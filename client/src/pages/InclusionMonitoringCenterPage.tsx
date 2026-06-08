import { RetestDueReminderCard } from "@/components/diagnosis/RetestDueReminderCard";
import { FirstUseHintBanner } from "@/components/FirstUseHintBanner";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { recordPublicLink } from "@/lib/assetProgressDisplay";
import { FIRST_USE_HINT_KEYS } from "@/lib/firstUseHints";
import { geoP0Brand } from "@/lib/geoP0Visual";
import {
  daysSincePublish,
  formatMentionDelta,
  retestPhaseStatusLabel,
} from "@/lib/inclusionMonitoringDisplay";
import { trpc } from "@/lib/trpc";
import {
  aggregateAiTestEvidence,
  buildEvidenceDetailPath,
  isAiTestMissReason,
  missReasonLabelCn,
  sentimentLabelCn,
  type AiTestStage,
} from "@shared/aiTestEvidence";
import { publishLinkAccessLabel } from "@shared/inclusionMonitoringDisplay";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { RadioTower } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type AiTestResultLike = {
  engine?: string;
  engineName?: string;
  question?: string;
  mentionsBrand?: boolean;
  recommendsBrand?: boolean;
  mentionedBrand?: boolean;
  recommendedBrand?: boolean;
  citedUrls?: string[];
  sentiment?: "positive" | "neutral" | "negative";
  missReason?: string;
  testStage?: string;
};

type MonitoringRecordRow = {
  id: number;
  articleId: number;
  publishRecordId: number;
  publicUrl: string;
  inclusionStatus: string;
  aiMentionStatus: string;
  aiRecommendStatus: string;
  lastCheckedAt?: Date | string | null;
  lastAiTestedAt?: Date | string | null;
  currentSuggestion?: string | null;
  aiTestResults?: AiTestResultLike[] | null;
  articleTitle?: string | null;
  linkAccess?: {
    accessible: boolean;
    checkedAt: string;
    statusCode?: number | null;
    errorMessage?: string | null;
  } | null;
  nextAction?: string | null;
};

type PublishRecordRow = {
  id: number;
  publishChannel?: string | null;
  publishedAt?: Date | string | number | null;
  publishUrl?: string | null;
  publicUrl?: string | null;
};

const MONITORING_TEST_STAGE_OPTIONS: { value: AiTestStage; label: string }[] = [
  { value: "manual_check", label: "人工复测" },
  { value: "before_publish", label: "发布前测试" },
  { value: "after_publish", label: "发布后复测" },
];

function toAbsoluteUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${window.location.origin}${path}`;
}

function formatTime(value?: Date | string | number | null) {
  if (!value) return "未记录";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function hasPhaseTest(record: MonitoringRecordRow, phase: "T1" | "T2" | "T3"): boolean {
  const results = record.aiTestResults ?? [];
  const marker = phase === "T1" ? "T1" : phase === "T2" ? "T2" : "T3";
  return results.some(r => (r.testStage ?? "").includes(marker) || record.lastAiTestedAt != null);
}

export function InclusionMonitoringCenterPage() {
  const [location, setLocation] = useLocation();
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
      (monitoringQuery.data ?? []).filter(
        record => record != null && typeof record?.id === "number",
      ) as MonitoringRecordRow[],
    [monitoringQuery.data],
  );
  const publishRecords = useMemo(
    () => (publishRecordsQuery.data ?? []) as PublishRecordRow[],
    [publishRecordsQuery.data],
  );
  const publishRecordById = useMemo(
    () => new Map(publishRecords.map(record => [record.id, record])),
    [publishRecords],
  );

  const publishRecordCount = publishRecords.length;
  const publishRecordsWithLink = publishRecords.filter(record => Boolean(recordPublicLink(record)));
  const missingPublicLinkCount = Math.max(0, publishRecordCount - publishRecordsWithLink.length);
  const loading = monitoringQuery.isLoading || publishRecordsQuery.isLoading;

  const [runningRecordId, setRunningRecordId] = useState<number | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [selectedTestStage, setSelectedTestStage] = useState<AiTestStage>("manual_check");
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
    setSelectedRecordId(null);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || records.length === 0 || linkCheckTriggered || checkPublishLinks.isPending) return;
    setLinkCheckTriggered(true);
    checkPublishLinks.mutate({ projectId: selectedProjectId });
  }, [selectedProjectId, records.length, linkCheckTriggered, checkPublishLinks.isPending]);

  const runCheck = trpc.geo.aiMentionCheck.run.useMutation({
    onSuccess: async () => {
      toast.success("复测结果已更新");
      if (selectedProjectId) {
        await utils.geo.articles.inclusionMonitoringRecords.invalidate({ projectId: selectedProjectId });
      }
      await monitoringQuery.refetch();
    },
    onError: e => toast.error(toUserFacingErrorFromUnknown(e, "复测失败")),
    onSettled: () => setRunningRecordId(null),
  });

  const aiAggregate = useMemo(
    () =>
      aggregateAiTestEvidence(
        records.map(record => ({
          monitoringRecordId: record.id,
          results: Array.isArray(record.aiTestResults) ? record.aiTestResults : [],
        })),
      ),
    [records],
  );

  const baselineMentionRate = workspaceSummaryQuery.data?.brandMentionRate ?? null;
  const mentionDelta =
    baselineMentionRate != null && aiAggregate.questionCount > 0
      ? aiAggregate.mentionRate - baselineMentionRate
      : null;

  const retestPlan = workspaceSummaryQuery.data?.retestPlan;
  const pendingT1 = retestPlan?.milestones.find(m => m.phase === "T1" && m.status !== "completed") ? 1 : 0;
  const pendingT2 = retestPlan?.milestones.find(m => m.phase === "T2" && m.status !== "completed") ? 1 : 0;
  const pendingT3 = retestPlan?.milestones.find(m => m.phase === "T3" && m.status !== "completed") ? 1 : 0;
  const completedRetestCount = records.filter(r => r.lastAiTestedAt).length;

  const selectedRecord = records.find(r => r.id === selectedRecordId) ?? null;

  const optimizationItems = useMemo(() => {
    const items: string[] = [];
    if (missingPublicLinkCount > 0) {
      items.push(`需要补 ${missingPublicLinkCount} 条公开链接后再安排复测`);
    }
    const untested = records.filter(r => !r.lastAiTestedAt).length;
    if (untested > 0) {
      items.push(`有 ${untested} 篇已发布内容尚未执行复测`);
    }
    const lowMention = records.filter(r => r.aiMentionStatus === "未提及" || r.aiMentionStatus === "未检测");
    if (lowMention.length > 0) {
      items.push(`${lowMention.length} 篇内容 AI 尚未提及，建议补充 FAQ/案例类内容`);
    }
    const platforms = new Set(
      publishRecords.map(r => (r.publishChannel ?? "").trim()).filter(Boolean),
    );
    if (platforms.size > 0) {
      items.push(`建议继续在 ${Array.from(platforms).slice(0, 3).join("、")} 等平台发布`);
    }
    if (items.length === 0) {
      items.push("当前监测样本正常，可进入交付报告汇总结果");
    }
    return items;
  }, [missingPublicLinkCount, records, publishRecords]);

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
        <p className="text-sm">正在加载收录复测数据…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12" data-testid="inclusion-monitoring-page">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">收录复测中心</h1>
        <p className="text-sm text-gray-500">
          查看已发布内容、管理 T1/T2/T3 复测，跟踪 AI 引用并输出下一轮优化建议。
        </p>
      </header>

      <FirstUseHintBanner
        storageKey={FIRST_USE_HINT_KEYS.inclusionMonitoring}
        message="发布内容后在这里追踪 AI 是否收录并引用你的内容"
        data-testid="first-use-hint-inclusion-monitoring"
      />

      {workspaceSummaryQuery.data?.retestDueReminder && selectedProjectId ? (
        <RetestDueReminderCard
          reminder={workspaceSummaryQuery.data.retestDueReminder}
          testId="inclusion-monitoring-retest-due-reminder"
          onGoRetest={() =>
            setLocation(
              buildProjectUrl(workspaceSummaryQuery.data!.retestDueReminder!.ctaPath, selectedProjectId),
            )
          }
        />
      ) : null}

      <section
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        data-testid="inclusion-monitoring-overview"
      >
        <h2 className="text-base font-semibold text-gray-900">监测总览</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {[
            { label: "已发布内容数", value: publishRecordCount, testId: "overview-published-count" },
            { label: "已回填公开链接数", value: publishRecordsWithLink.length, testId: "overview-linked-count" },
            { label: "待 T1", value: pendingT1, testId: "overview-pending-t1" },
            { label: "待 T2", value: pendingT2, testId: "overview-pending-t2" },
            { label: "待 T3", value: pendingT3, testId: "overview-pending-t3" },
            { label: "已完成复测数", value: completedRetestCount, testId: "overview-completed-retest" },
            {
              label: "AI提及变化",
              value: formatMentionDelta(mentionDelta),
              testId: "overview-mention-delta",
            },
            {
              label: "下一次复测时间",
              value: retestPlan?.nextSuggestion?.suggestedAtLabel ?? "暂无",
              testId: "overview-next-retest",
            },
          ].map(item => (
            <div key={item.testId} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2" data-testid={item.testId}>
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      {publishRecordCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <RadioTower className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-4 text-sm font-medium text-gray-700">暂无可监测内容</p>
          <p className="mt-1 text-xs text-gray-500">请先完成发布并回填公开链接。</p>
          <Button
            type="button"
            className={`mt-5 ${geoP0Brand.primary}`}
            onClick={() => selectedProjectId && setLocation(buildProjectUrl("/content-publishing", selectedProjectId))}
          >
            去发布执行中心
          </Button>
        </div>
      ) : (
        <section
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          data-testid="inclusion-monitoring-content-table"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">已发布内容监测表</h2>
              <p className="mt-1 text-xs text-gray-500">按内容查看复测进度与 AI 引用状态。</p>
            </div>
            {missingPublicLinkCount > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={geoP0Brand.primaryOutline}
                onClick={() =>
                  selectedProjectId &&
                  setLocation(buildProjectUrl("/content-publishing", selectedProjectId))
                }
              >
                回填链接（{missingPublicLinkCount}）
              </Button>
            ) : null}
          </div>

          {records.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">已有发布记录，点击「补录监测记录」后可在此管理复测。</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                    <th className="py-2 pr-4 font-medium">平台</th>
                    <th className="py-2 pr-4 font-medium">标题</th>
                    <th className="py-2 pr-4 font-medium">公开链接</th>
                    <th className="py-2 pr-4 font-medium">发布时间</th>
                    <th className="py-2 pr-4 font-medium">T1状态</th>
                    <th className="py-2 pr-4 font-medium">T2状态</th>
                    <th className="py-2 pr-4 font-medium">T3状态</th>
                    <th className="py-2 pr-4 font-medium">AI引用</th>
                    <th className="py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(record => {
                    const publishRecord = publishRecordById.get(record.publishRecordId);
                    const platform = (publishRecord?.publishChannel ?? "").trim() || "未标注";
                    const days = daysSincePublish(publishRecord?.publishedAt);
                    return (
                      <tr
                        key={record.id}
                        id={`monitoring-record-${record.id}`}
                        className="border-b border-gray-50 text-gray-800"
                        data-testid={`inclusion-content-row-${record.id}`}
                      >
                        <td className="py-3 pr-4 whitespace-nowrap">{platform}</td>
                        <td className="py-3 pr-4 max-w-[12rem]">
                          <span className="line-clamp-2 font-medium text-gray-900">
                            {record.articleTitle?.trim() || `文章 #${record.articleId}`}
                          </span>
                        </td>
                        <td className="py-3 pr-4 max-w-[10rem]">
                          {toAbsoluteUrl(record.publicUrl) ? (
                            <a
                              href={toAbsoluteUrl(record.publicUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline line-clamp-1"
                            >
                              查看链接
                            </a>
                          ) : (
                            <span className="text-gray-400">未回填</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap text-gray-500">
                          {formatTime(publishRecord?.publishedAt)}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {retestPhaseStatusLabel("T1", days, hasPhaseTest(record, "T1"))}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {retestPhaseStatusLabel("T2", days, hasPhaseTest(record, "T2"))}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {retestPhaseStatusLabel("T3", days, hasPhaseTest(record, "T3"))}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">{record.aiMentionStatus || "未检测"}</td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={`h-7 px-2 text-xs ${geoP0Brand.primaryOutline}`}
                              onClick={() =>
                                selectedProjectId &&
                                setLocation(buildProjectUrl("/content-publishing", selectedProjectId))
                              }
                            >
                              回填链接
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className={`h-7 px-2 text-xs ${geoP0Brand.primary}`}
                              disabled={!selectedProjectId || runCheck.isPending}
                              onClick={() => {
                                if (!selectedProjectId) return;
                                setRunningRecordId(record.id);
                                runCheck.mutate({
                                  projectId: selectedProjectId,
                                  recordId: record.id,
                                  engines: ["doubao", "deepseek", "kimi"],
                                  testStage: selectedTestStage,
                                });
                              }}
                            >
                              {runCheck.isPending && runningRecordId === record.id ? "复测中…" : "执行复测"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={`h-7 px-2 text-xs ${geoP0Brand.primaryOutline}`}
                              onClick={() => setSelectedRecordId(record.id)}
                            >
                              查看证据
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={`h-7 px-2 text-xs ${geoP0Brand.primaryOutline}`}
                              onClick={() =>
                                selectedProjectId &&
                                setLocation(buildProjectUrl("/delivery-reports", selectedProjectId))
                              }
                            >
                              进入交付报告
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              复测阶段
              <select
                value={selectedTestStage}
                onChange={e => setSelectedTestStage(e.target.value as AiTestStage)}
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm"
              >
                {MONITORING_TEST_STAGE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}

      <details
        className="rounded-xl border border-gray-200 bg-white shadow-sm"
        open={selectedRecordId != null}
        data-testid="inclusion-monitoring-ai-evidence-fold"
      >
        <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-gray-800">
          AI 实测证据{selectedRecord ? `：${selectedRecord.articleTitle?.trim() || `文章 #${selectedRecord.articleId}`}` : ""}
        </summary>
        <div className="border-t border-gray-100 p-5">
          {!selectedRecord ? (
            <p className="text-sm text-gray-500">在上方内容表中点击「查看证据」展开本条实测明细。</p>
          ) : (
            <div className="space-y-3">
              {(selectedRecord.aiTestResults ?? []).length === 0 ? (
                <p className="text-sm text-gray-500">暂无实测证据，请先执行复测。</p>
              ) : (
                (selectedRecord.aiTestResults ?? []).map((result, index) => (
                  <div
                    key={`${result.engine}-${index}`}
                    className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm"
                    data-testid={`inclusion-ai-evidence-row-${selectedRecord.id}-${index}`}
                  >
                    <dl className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-gray-500">测试问题</dt>
                        <dd className="mt-0.5 text-gray-800">{result.question ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500">AI平台</dt>
                        <dd className="mt-0.5 text-gray-800">{result.engineName ?? result.engine ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500">是否提及</dt>
                        <dd className="mt-0.5 text-gray-800">
                          {(result.mentionedBrand ?? result.mentionsBrand) ? "是" : "否"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500">是否推荐</dt>
                        <dd className="mt-0.5 text-gray-800">
                          {(result.recommendedBrand ?? result.recommendsBrand) ? "是" : "否"}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-2 text-xs text-gray-500">
                      引用证据：
                      {Array.isArray(result.citedUrls) && result.citedUrls.length > 0
                        ? result.citedUrls.join("；")
                        : "暂无引用链接"}
                    </p>
                    <p className="mt-2 text-xs text-gray-600">
                      结论：
                      {(result.mentionedBrand ?? result.mentionsBrand)
                        ? "AI 已提及品牌"
                        : isAiTestMissReason(result.missReason)
                          ? missReasonLabelCn(result.missReason)
                          : "尚未提及，建议补充内容"}
                      {result.sentiment ? `（${sentimentLabelCn(result.sentiment)}）` : ""}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="mt-2 h-7 px-2 text-blue-600"
                      onClick={() => setLocation(buildEvidenceDetailPath(selectedRecord.id, index))}
                    >
                      打开完整证据页
                    </Button>
                  </div>
                ))
              )}
              <p className="text-xs text-gray-500">
                链接可访问性：{publishLinkAccessLabel(selectedRecord.linkAccess)}
                {selectedRecord.linkAccess?.checkedAt
                  ? `（检测于 ${formatTime(selectedRecord.linkAccess.checkedAt)}）`
                  : ""}
              </p>
            </div>
          )}
        </div>
      </details>

      <section
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        data-testid="inclusion-monitoring-optimization-section"
      >
        <h2 className="text-base font-semibold text-gray-900">下一轮优化建议</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          {optimizationItems.map(item => (
            <li key={item} className="flex gap-2">
              <span className="text-gray-400">-</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            className={geoP0Brand.primary}
            onClick={() => selectedProjectId && setLocation(buildProjectUrl("/weekly", selectedProjectId))}
          >
            进入下一轮内容任务
          </Button>
          <Button
            type="button"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            onClick={() => selectedProjectId && setLocation(buildProjectUrl("/delivery-reports", selectedProjectId))}
          >
            进入交付报告
          </Button>
        </div>
      </section>
    </div>
  );
}

export function InclusionMonitoringFlowPage() {
  return <InclusionMonitoringCenterPage />;
}
