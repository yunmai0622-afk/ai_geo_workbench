import { P0MetricTile, P0Section } from "@/components/geo/P0UiPrimitives";
import {
  BrandSourceDrawer,
  defaultBrandSourceForm,
  recordToBrandSourceForm,
  type BrandSourceFormState,
} from "@/components/source-graph/BrandSourceDrawer";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { useMaturityAutoCalculate } from "@/hooks/useMaturityAutoCalculate";
import { buildProjectUrl } from "@/lib/activeProject";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { trpc } from "@/lib/trpc";
import {
  BRAND_SOURCE_INDICATORS,
  resolveBrandSourceDisplayName,
  resolveBrandSourcePlatformLabel,
  resolveEntityConsistencyStatusLabel,
  resolveGapTypeLabel,
  type BrandSourceRecordRow,
} from "@shared/brandSourceGraph";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ExternalLink,
  Link2,
  Network,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildSourcePayload(form: BrandSourceFormState) {
  return {
    platform: form.platform,
    sourceName: form.sourceName.trim() || null,
    platformName: form.platform === "other" ? form.platformName.trim() || null : null,
    url: form.url.trim() || null,
    isPubliclyAccessible: form.isPubliclyAccessible,
    containsBrandName: form.containsBrandName,
    containsBusinessDescription: form.containsBusinessDescription,
    containsOfficialSite: form.containsOfficialSite,
    containsCoreKeywords: form.containsCoreKeywords,
    aiCitationConfirmed: form.aiCitationConfirmed,
    notes: form.notes.trim() || null,
    lastVerifiedAt: form.lastVerifiedAt ? new Date(form.lastVerifiedAt) : null,
  };
}

function riskBadgeClass(level?: string | null): string {
  if (level === "high") return "border-red-200 bg-red-50 text-red-700";
  if (level === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-gray-200 bg-gray-50 text-gray-600";
}

export default function SourceGraphPage() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const { selectedProjectId, selectedProject, enabled, projectsLoading } = useActiveProjectSelection();
  const projectQueryInput = { projectId: selectedProjectId! };
  const { triggerMaturityCalculate } = useMaturityAutoCalculate(selectedProjectId);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editRecord, setEditRecord] = useState<BrandSourceRecordRow | null>(null);
  const [sourceFormInitial, setSourceFormInitial] = useState<BrandSourceFormState>(() => defaultBrandSourceForm());

  const sourcesQuery = trpc.geo.brandSourceGraph.getBrandSources.useQuery(projectQueryInput, {
    enabled: enabled && Boolean(selectedProjectId),
  });
  const metricsQuery = trpc.geo.brandSourceGraph.getPageMetrics.useQuery(projectQueryInput, {
    enabled: enabled && Boolean(selectedProjectId),
  });
  const consistencyQuery = trpc.geo.brandSourceGraph.getEntityConsistencyChecks.useQuery(projectQueryInput, {
    enabled: enabled && Boolean(selectedProjectId),
  });
  const suggestionsQuery = trpc.geo.brandSourceGraph.getEnhancementSuggestions.useQuery(projectQueryInput, {
    enabled: enabled && Boolean(selectedProjectId),
  });

  const invalidateAll = async () => {
    await Promise.all([
      utils.geo.brandSourceGraph.getBrandSources.invalidate(projectQueryInput),
      utils.geo.brandSourceGraph.getPageMetrics.invalidate(projectQueryInput),
      utils.geo.brandSourceGraph.getEntityConsistencyChecks.invalidate(projectQueryInput),
      utils.geo.brandSourceGraph.getEnhancementSuggestions.invalidate(projectQueryInput),
    ]);
  };

  const createSourceMutation = trpc.geo.brandSourceGraph.createBrandSource.useMutation({
    onSuccess: async () => {
      await invalidateAll();
      void triggerMaturityCalculate({ silent: true });
      toast.success("信源已添加");
      setDrawerOpen(false);
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "添加失败")),
  });
  const updateSourceMutation = trpc.geo.brandSourceGraph.updateBrandSource.useMutation({
    onSuccess: async () => {
      await invalidateAll();
      void triggerMaturityCalculate({ silent: true });
      toast.success("信源已更新");
      setDrawerOpen(false);
      setEditRecord(null);
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "更新失败")),
  });
  const deleteSourceMutation = trpc.geo.brandSourceGraph.deleteBrandSource.useMutation({
    onSuccess: async () => {
      await invalidateAll();
      toast.success("信源已删除");
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "删除失败")),
  });
  const verifySourceMutation = trpc.geo.brandSourceGraph.markBrandSourceVerified.useMutation({
    onSuccess: async () => {
      await utils.geo.brandSourceGraph.getBrandSources.invalidate(projectQueryInput);
      toast.success("已标记为已验证");
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "标记失败")),
  });
  const createTaskMutation = trpc.geo.brandSourceGraph.createContentTaskFromSuggestion.useMutation({
    onSuccess: async result => {
      await invalidateAll();
      if (result.alreadyExists) {
        toast.message("该建议已创建内容任务");
      } else {
        toast.success("已生成内容任务");
      }
      if (selectedProjectId) {
        const suffix = result.taskId ? `&taskId=${result.taskId}` : "";
        setLocation(`${buildProjectUrl("/weekly", selectedProjectId)}${suffix}`);
      }
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "生成内容任务失败")),
  });

  const records = (sourcesQuery.data ?? []) as BrandSourceRecordRow[];
  const consistencyChecks = consistencyQuery.data ?? [];
  const suggestions = suggestionsQuery.data ?? [];
  const metrics = metricsQuery.data;

  const loading =
    enabled &&
    (sourcesQuery.isLoading ||
      metricsQuery.isLoading ||
      consistencyQuery.isLoading ||
      suggestionsQuery.isLoading ||
      projectsLoading);
  const mutating =
    createSourceMutation.isPending ||
    updateSourceMutation.isPending ||
    deleteSourceMutation.isPending ||
    verifySourceMutation.isPending ||
    createTaskMutation.isPending;

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()),
    [records],
  );

  function openCreateDrawer() {
    setDrawerMode("create");
    setEditRecord(null);
    setSourceFormInitial(defaultBrandSourceForm());
    setDrawerOpen(true);
  }

  function openEditDrawer(record: BrandSourceRecordRow) {
    setDrawerMode("edit");
    setEditRecord(record);
    setSourceFormInitial(recordToBrandSourceForm(record));
    setDrawerOpen(true);
  }

  function handleSourceSubmit(form: BrandSourceFormState) {
    if (!selectedProjectId) {
      toast.error("请先选择企业项目");
      return;
    }
    const payload = buildSourcePayload(form);
    if (drawerMode === "edit" && editRecord) {
      updateSourceMutation.mutate({ id: editRecord.id, data: payload });
      return;
    }
    createSourceMutation.mutate({ projectId: selectedProjectId, data: payload });
  }

  function goEnterpriseProfile() {
    if (!selectedProjectId) return;
    setLocation(buildProjectUrl("/enterprise-profile", selectedProjectId));
  }

  function goWeeklyWithTask(taskId?: number | null) {
    if (!selectedProjectId) return;
    const suffix = taskId ? `&taskId=${taskId}` : "";
    setLocation(`${buildProjectUrl("/weekly", selectedProjectId)}${suffix}`);
  }

  if (!enabled && !projectsLoading) {
    return <ProjectContextEmptyState />;
  }

  return (
    <div className="space-y-6" data-testid="source-graph-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Network className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900" data-testid="source-graph-page-title">
              品牌信源图谱
            </h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            检查企业在官网、内容平台、媒体稿、客户案例等公开信源中的品牌信息是否一致，帮助 AI
            更稳定地识别、引用和推荐企业。
          </p>
          {selectedProject?.enterpriseName ? (
            <p className="mt-2 text-sm text-gray-600">
              当前项目：<span className="font-medium text-gray-900">{selectedProject.enterpriseName}</span>
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!selectedProjectId || mutating}
            onClick={openCreateDrawer}
            data-testid="source-graph-add-source"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            添加信源
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!selectedProjectId}
            onClick={goEnterpriseProfile}
            data-testid="source-graph-edit-profile"
          >
            <ExternalLink className="mr-1.5 h-4 w-4" />
            查看企业档案
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : (
        <>
          <P0Section title="信源总览" description="基于当前项目信源与实体一致性自动计算">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="source-graph-overview">
              <P0MetricTile
                label="信源完整度"
                value={`${metrics?.sourceCompleteness ?? 0}`}
                hint="信源数量 + 六项指标完成度"
              />
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <p className="text-xs font-medium text-gray-500">实体一致性</p>
                <p className="mt-2 text-4xl font-bold text-blue-600" data-testid="source-graph-consistency-score">
                  {metrics?.entityConsistency ?? 0}
                </p>
                <p className="mt-1 text-xs text-gray-500">8 个锚点平均分</p>
              </div>
              <P0MetricTile
                label="AI 可识别度"
                value={`${metrics?.aiIdentifiability ?? 0}`}
                hint="品牌、业务、锚点、关键词与 AI 引用"
              />
              <P0MetricTile
                label="优先修复项"
                value={String(metrics?.priorityFixCount ?? 0)}
                hint="高风险信源 + 缺失/冲突锚点"
              />
            </div>
          </P0Section>

          <P0Section title="信源列表" description="录入各平台公开信源并手动标记六项指标">
            <div className="space-y-3" data-testid="source-graph-list">
              {sortedRecords.length === 0 ? (
                <div
                  className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500"
                  data-testid="source-graph-empty-sources"
                >
                  暂未添加品牌信源。请先添加官网、知乎、小红书、媒体稿、客户案例页等公开链接，系统会检查这些信源是否有助于
                  AI 识别企业。
                </div>
              ) : (
                sortedRecords.map(record => (
                  <div
                    key={record.id}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    data-testid={`brand-source-row-${record.id}`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                            {resolveBrandSourcePlatformLabel(record.platform, record.platformName)}
                          </span>
                          <p className="font-medium text-gray-900">{resolveBrandSourceDisplayName(record)}</p>
                          {record.url ? (
                            <a
                              href={record.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                            >
                              <Link2 className="h-3.5 w-3.5" />
                              {record.url}
                            </a>
                          ) : (
                            <span className="text-sm text-gray-400">未填写链接</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {BRAND_SOURCE_INDICATORS.map(indicator => {
                            const active = Boolean(record[indicator.key]);
                            return (
                              <span
                                key={indicator.key}
                                className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 text-xs text-gray-700"
                              >
                                {active ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Circle className="h-3.5 w-3.5 text-gray-300" />
                                )}
                                {indicator.label}
                              </span>
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={`rounded-full border px-2 py-0.5 ${riskBadgeClass(record.riskLevel)}`}
                            data-testid={`brand-source-risk-${record.id}`}
                          >
                            风险：{record.riskLevel === "high" ? "高" : record.riskLevel === "medium" ? "中" : "低"}
                          </span>
                          {record.riskNotes ? <span className="text-gray-500">{record.riskNotes}</span> : null}
                          <span className="text-gray-500">最近验证：{formatDateTime(record.lastVerifiedAt)}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" disabled={mutating} onClick={() => openEditDrawer(record)}>
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          编辑
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={mutating}
                          onClick={() => verifySourceMutation.mutate({ id: record.id })}
                        >
                          标记已验证
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          disabled={mutating}
                          onClick={() => deleteSourceMutation.mutate({ id: record.id })}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          删除
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </P0Section>

          <P0Section title="实体一致性评分" description="基于企业档案标准值与各信源观察值对比">
            <div className="space-y-3" data-testid="entity-consistency-section">
              {consistencyChecks.length === 0 ? (
                <div
                  className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500"
                  data-testid="entity-consistency-empty"
                >
                  暂无实体一致性检查结果。添加信源后，系统会基于企业档案检查品牌名称、主营业务、官网链接、核心关键词等锚点是否一致。
                </div>
              ) : (
                consistencyChecks.map(check => (
                  <div
                    key={check.anchorType}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    data-testid={`entity-consistency-row-${check.anchorType}`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-gray-900">{check.anchorLabel}</p>
                          <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-700">
                            {resolveEntityConsistencyStatusLabel(check.status)}
                          </span>
                          <span className="text-xs text-gray-500">评分 {check.score}</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          企业档案标准值：{check.standardValue || "—"}
                        </p>
                        <p className="text-sm text-gray-600">
                          各信源观察值：{check.observedValues.length ? check.observedValues.join("；") : "—"}
                        </p>
                        <p className="text-sm text-amber-700">{check.issueSummary}</p>
                        <p className="text-sm text-gray-600">修复建议：{check.suggestion}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </P0Section>

          <P0Section title="内容增强建议" description="根据信源缺口与问题池提及情况生成">
            <div className="space-y-3" data-testid="source-graph-suggestions">
              {suggestions.length === 0 ? (
                <div
                  className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500"
                  data-testid="source-graph-suggestions-empty"
                >
                  当前暂无需要优先修复的信源问题。后续可结合 AI 实测结果继续优化。
                </div>
              ) : (
                suggestions.map(suggestion => (
                  <div
                    key={suggestion.id}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    data-testid={`enhancement-suggestion-${suggestion.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-gray-900">{suggestion.suggestionTitle}</p>
                          <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-600">
                            {suggestion.priority}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">对应缺口：{resolveGapTypeLabel(suggestion.gapType)}</p>
                        {suggestion.targetPlatform ? (
                          <p className="text-sm text-gray-600">
                            建议平台：{resolveBrandSourcePlatformLabel(suggestion.targetPlatform)}
                          </p>
                        ) : null}
                        <p className="text-sm text-gray-600">建议内容方向：{suggestion.contentDirection}</p>
                        {suggestion.targetKeywords?.length ? (
                          <p className="text-sm text-gray-600">
                            强化关键词：{(suggestion.targetKeywords as string[]).join("、")}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          {suggestion.linkedTaskId ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => goWeeklyWithTask(suggestion.linkedTaskId)}
                                data-testid="enhancement-go-existing-task"
                              >
                                查看已有内容任务
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              className={geoP0Brand.primaryOutline}
                              disabled={mutating || !selectedProjectId}
                              onClick={() =>
                                createTaskMutation.mutate({
                                  projectId: selectedProjectId!,
                                  suggestionId: suggestion.id,
                                })
                              }
                              data-testid="enhancement-create-task"
                            >
                              生成该平台内容
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </P0Section>
        </>
      )}

      <BrandSourceDrawer
        open={drawerOpen}
        mode={drawerMode}
        saving={createSourceMutation.isPending || updateSourceMutation.isPending}
        initial={sourceFormInitial}
        onOpenChange={setDrawerOpen}
        onSubmit={handleSourceSubmit}
      />
    </div>
  );
}
