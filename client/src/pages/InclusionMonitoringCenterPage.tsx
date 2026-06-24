import { RetestDueReminderCard } from "@/components/diagnosis/RetestDueReminderCard";
import { FirstUseHintBanner } from "@/components/FirstUseHintBanner";
import { ContentAssetEffectFillPanel } from "@/components/inclusion-monitoring/ContentAssetEffectFillPanel";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { FIRST_USE_HINT_KEYS } from "@/lib/firstUseHints";
import { geoP0Brand } from "@/lib/geoP0Visual";
import {
  mapContentAssetEffectRecordForView,
  type ContentAssetEffectViewRecord,
} from "@/lib/contentAssetEffectView";
import { trpc } from "@/lib/trpc";
import {
  aggregateContentAssetEffectOverview,
  aggregatePlatformEffectSummary,
} from "@shared/contentAssetEffectTracking";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { BarChart3, RadioTower } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type MonitoringRecordRow = ContentAssetEffectViewRecord;

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
        <h1 className="text-2xl font-bold text-gray-900">内容资产效果</h1>
        <p className="text-sm text-gray-500">追踪已发布内容的收录、曝光与 AI 复测价值。</p>
      </header>

      <FirstUseHintBanner
        storageKey={FIRST_USE_HINT_KEYS.inclusionMonitoring}
        message="发布内容后在这里回填收录与阅读数据，7-10 天内看到第一批可验证成果"
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
        <h2 className="text-base font-semibold text-gray-900">总览指标</h2>
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
      )}

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
  );
}

export function InclusionMonitoringFlowPage() {
  return <InclusionMonitoringCenterPage />;
}
