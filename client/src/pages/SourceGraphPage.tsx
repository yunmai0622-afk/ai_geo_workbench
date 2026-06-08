import { P0MetricTile, P0Section } from "@/components/geo/P0UiPrimitives";
import {
  BrandSourceDrawer,
  defaultBrandSourceForm,
  recordToBrandSourceForm,
  type BrandSourceFormState,
} from "@/components/source-graph/BrandSourceDrawer";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { trpc } from "@/lib/trpc";
import {
  BRAND_SOURCE_INDICATORS,
  buildBrandSourceOverviewMetrics,
  formatCoreKeywordsInput,
  groupBrandSourcesByPlatformType,
  parseCoreKeywordsInput,
  resolveBrandSourcePlatformLabel,
  type BrandSourceRecordRow,
  type EntityAnchorRow,
} from "@shared/brandSourceGraph";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Link2,
  Network,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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

function defaultAnchorForm(): EntityAnchorRow {
  return {
    projectId: 0,
    brandName: "",
    companyName: "",
    coreBusiness: "",
    targetCustomer: "",
    coreKeywords: [],
    officialSite: "",
    founderName: "",
    typicalCases: "",
  };
}

function anchorToForm(anchor: EntityAnchorRow | null | undefined): EntityAnchorRow & { coreKeywordsText: string } {
  const base = anchor ?? defaultAnchorForm();
  return {
    ...base,
    coreKeywordsText: formatCoreKeywordsInput(base.coreKeywords),
  };
}

function validateAnchorForm(form: EntityAnchorRow & { coreKeywordsText: string }): string | null {
  if (!form.brandName?.trim()) return "请填写品牌名";
  if (!form.companyName?.trim()) return "请填写公司名";
  if (!form.coreBusiness?.trim()) return "请填写主营业务";
  if (!form.targetCustomer?.trim()) return "请填写目标客户";
  if (!form.officialSite?.trim()) return "请填写官网";
  if (parseCoreKeywordsInput(form.coreKeywordsText).length === 0) return "请至少填写一个核心关键词";
  return null;
}

function buildSourcePayload(form: BrandSourceFormState) {
  return {
    platform: form.platform,
    platformName: form.platform === "other" ? form.platformName.trim() || null : null,
    url: form.url.trim() || null,
    isPubliclyAccessible: form.isPubliclyAccessible,
    containsBrandName: form.containsBrandName,
    containsOfficialSite: form.containsOfficialSite,
    containsCoreKeywords: form.containsCoreKeywords,
    aiCitationConfirmed: form.aiCitationConfirmed,
    isCrossSourceConsistent: form.isCrossSourceConsistent,
    notes: form.notes.trim() || null,
    lastVerifiedAt: form.lastVerifiedAt ? new Date(form.lastVerifiedAt) : null,
  };
}

export default function SourceGraphPage() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const anchorSectionRef = useRef<HTMLDivElement>(null);
  const { selectedProjectId, selectedProject, enabled, projectsLoading } = useActiveProjectSelection();
  const projectQueryInput = { projectId: selectedProjectId! };

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editRecord, setEditRecord] = useState<BrandSourceRecordRow | null>(null);
  const [sourceFormInitial, setSourceFormInitial] = useState<BrandSourceFormState>(() => defaultBrandSourceForm());
  const [anchorForm, setAnchorForm] = useState(() => anchorToForm(null));

  const sourcesQuery = trpc.geo.brandSourceGraph.getBrandSources.useQuery(projectQueryInput, {
    enabled: enabled && Boolean(selectedProjectId),
  });
  const anchorsQuery = trpc.geo.brandSourceGraph.getEntityAnchors.useQuery(projectQueryInput, {
    enabled: enabled && Boolean(selectedProjectId),
  });
  const scoreQuery = trpc.geo.brandSourceGraph.getConsistencyScore.useQuery(projectQueryInput, {
    enabled: enabled && Boolean(selectedProjectId),
  });
  const suggestionsQuery = trpc.geo.brandSourceGraph.getEnhancementSuggestions.useQuery(projectQueryInput, {
    enabled: enabled && Boolean(selectedProjectId),
  });

  const createSourceMutation = trpc.geo.brandSourceGraph.createBrandSource.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.geo.brandSourceGraph.getBrandSources.invalidate(projectQueryInput),
        utils.geo.brandSourceGraph.getConsistencyScore.invalidate(projectQueryInput),
        utils.geo.brandSourceGraph.getEnhancementSuggestions.invalidate(projectQueryInput),
      ]);
      toast.success("信源已添加");
      setDrawerOpen(false);
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "添加失败")),
  });
  const updateSourceMutation = trpc.geo.brandSourceGraph.updateBrandSource.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.geo.brandSourceGraph.getBrandSources.invalidate(projectQueryInput),
        utils.geo.brandSourceGraph.getConsistencyScore.invalidate(projectQueryInput),
        utils.geo.brandSourceGraph.getEnhancementSuggestions.invalidate(projectQueryInput),
      ]);
      toast.success("信源已更新");
      setDrawerOpen(false);
      setEditRecord(null);
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "更新失败")),
  });
  const deleteSourceMutation = trpc.geo.brandSourceGraph.deleteBrandSource.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.geo.brandSourceGraph.getBrandSources.invalidate(projectQueryInput),
        utils.geo.brandSourceGraph.getConsistencyScore.invalidate(projectQueryInput),
        utils.geo.brandSourceGraph.getEnhancementSuggestions.invalidate(projectQueryInput),
      ]);
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
  const upsertAnchorsMutation = trpc.geo.brandSourceGraph.upsertEntityAnchors.useMutation({
    onSuccess: async () => {
      await utils.geo.brandSourceGraph.getEntityAnchors.invalidate(projectQueryInput);
      toast.success("实体锚点已保存");
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "保存失败")),
  });

  const records = (sourcesQuery.data ?? []) as BrandSourceRecordRow[];
  const loading =
    enabled &&
    (sourcesQuery.isLoading ||
      anchorsQuery.isLoading ||
      scoreQuery.isLoading ||
      suggestionsQuery.isLoading ||
      projectsLoading);
  const mutating =
    createSourceMutation.isPending ||
    updateSourceMutation.isPending ||
    deleteSourceMutation.isPending ||
    verifySourceMutation.isPending ||
    upsertAnchorsMutation.isPending;

  const overview = useMemo(() => buildBrandSourceOverviewMetrics(records), [records]);
  const groupedSources = useMemo(() => groupBrandSourcesByPlatformType(records), [records]);
  const suggestions = suggestionsQuery.data ?? [];

  useEffect(() => {
    if (anchorsQuery.data !== undefined) {
      setAnchorForm(anchorToForm(anchorsQuery.data as EntityAnchorRow | null));
    }
  }, [anchorsQuery.data]);

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

  function handleSaveAnchors() {
    if (!selectedProjectId) {
      toast.error("请先选择企业项目");
      return;
    }
    const error = validateAnchorForm(anchorForm);
    if (error) {
      toast.error(error);
      return;
    }
    upsertAnchorsMutation.mutate({
      projectId: selectedProjectId,
      data: {
        brandName: anchorForm.brandName!.trim(),
        companyName: anchorForm.companyName!.trim(),
        coreBusiness: anchorForm.coreBusiness!.trim(),
        targetCustomer: anchorForm.targetCustomer!.trim(),
        coreKeywords: parseCoreKeywordsInput(anchorForm.coreKeywordsText),
        officialSite: anchorForm.officialSite!.trim(),
        founderName: anchorForm.founderName?.trim() || null,
        typicalCases: anchorForm.typicalCases?.trim() || null,
      },
    });
  }

  function scrollToAnchors() {
    anchorSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goWeekly() {
    if (!selectedProjectId) return;
    setLocation(buildProjectUrl("/weekly", selectedProjectId));
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
            录入各平台信源、维护实体锚点，查看一致性评分并获得内容增强建议。
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
            className={geoP0Brand.primary}
            disabled={!selectedProjectId || mutating}
            onClick={scrollToAnchors}
            data-testid="source-graph-edit-anchors"
          >
            <Pencil className="mr-1.5 h-4 w-4" />
            编辑实体锚点
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : (
        <>
          <P0Section title="信源总览" description="当前项目信源录入与一致性概况">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="source-graph-overview">
              <P0MetricTile label="已录入信源数" value={String(overview.total)} hint="各平台信源总量" />
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <p className="text-xs font-medium text-gray-500">实体一致性评分</p>
                <p className="mt-2 text-4xl font-bold text-blue-600" data-testid="source-graph-consistency-score">
                  {overview.consistencyScore}
                </p>
                <p className="mt-1 text-xs text-gray-500">0-100 分，基于六项指标加权</p>
              </div>
              <P0MetricTile
                label="AI 已引用信源"
                value={overview.aiCitedRatio}
                hint="人工确认被 AI 引用的信源占比"
              />
              <P0MetricTile
                label="待完善信源数"
                value={String(overview.incompleteCount)}
                hint="不可抓取或未含品牌名"
              />
            </div>
          </P0Section>

          <div ref={anchorSectionRef}>
            <P0Section title="实体锚点配置" description="AI 识别企业实体的核心依据">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="entity-anchors-card">
                <p className="mb-4 text-sm text-gray-600">
                  这些锚点是 AI 识别企业实体的核心依据，请确保所有信源内容与此保持一致。
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="anchor-brand-name">品牌名 *</Label>
                    <Input
                      id="anchor-brand-name"
                      data-testid="anchor-brand-name"
                      value={anchorForm.brandName ?? ""}
                      onChange={e => setAnchorForm(current => ({ ...current, brandName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="anchor-company-name">公司名 *</Label>
                    <Input
                      id="anchor-company-name"
                      data-testid="anchor-company-name"
                      value={anchorForm.companyName ?? ""}
                      onChange={e => setAnchorForm(current => ({ ...current, companyName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="anchor-core-business">主营业务 *</Label>
                    <Textarea
                      id="anchor-core-business"
                      data-testid="anchor-core-business"
                      rows={2}
                      value={anchorForm.coreBusiness ?? ""}
                      onChange={e => setAnchorForm(current => ({ ...current, coreBusiness: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="anchor-target-customer">目标客户 *</Label>
                    <Textarea
                      id="anchor-target-customer"
                      data-testid="anchor-target-customer"
                      rows={2}
                      value={anchorForm.targetCustomer ?? ""}
                      onChange={e => setAnchorForm(current => ({ ...current, targetCustomer: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="anchor-core-keywords">核心关键词（多值输入）*</Label>
                    <Input
                      id="anchor-core-keywords"
                      data-testid="anchor-core-keywords"
                      value={anchorForm.coreKeywordsText}
                      onChange={e => setAnchorForm(current => ({ ...current, coreKeywordsText: e.target.value }))}
                      placeholder="用顿号、逗号或换行分隔"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="anchor-official-site">官网 *</Label>
                    <Input
                      id="anchor-official-site"
                      data-testid="anchor-official-site"
                      value={anchorForm.officialSite ?? ""}
                      onChange={e => setAnchorForm(current => ({ ...current, officialSite: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="anchor-founder">创始人/团队</Label>
                    <Input
                      id="anchor-founder"
                      data-testid="anchor-founder"
                      value={anchorForm.founderName ?? ""}
                      onChange={e => setAnchorForm(current => ({ ...current, founderName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="anchor-cases">典型客户案例</Label>
                    <Textarea
                      id="anchor-cases"
                      data-testid="anchor-cases"
                      rows={3}
                      value={anchorForm.typicalCases ?? ""}
                      onChange={e => setAnchorForm(current => ({ ...current, typicalCases: e.target.value }))}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  className={`mt-4 ${geoP0Brand.primary}`}
                  disabled={!selectedProjectId || mutating}
                  onClick={handleSaveAnchors}
                  data-testid="anchor-save-button"
                >
                  保存锚点配置
                </Button>
              </div>
            </P0Section>
          </div>

          <P0Section title="信源列表" description="按平台类型分组展示">
            <div className="space-y-6" data-testid="source-graph-list">
              {groupedSources.map(group => (
                <div key={group.key} className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {group.label}
                    <span className="ml-2 font-normal text-gray-500">({group.records.length})</span>
                  </h3>
                  {group.records.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                      暂无{group.label}信源
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {group.records.map(record => (
                        <div
                          key={record.id}
                          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                          data-testid={`brand-source-row-${record.id}`}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-gray-900">
                                  {resolveBrandSourcePlatformLabel(record.platform, record.platformName)}
                                </p>
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
                                  <span className="text-sm text-gray-400">未填写 URL</span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {BRAND_SOURCE_INDICATORS.map(indicator => {
                                  const active = Boolean(record[indicator.key]);
                                  return (
                                    <span
                                      key={indicator.key}
                                      className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 text-xs text-gray-700"
                                      title={indicator.label}
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
                              <p className="text-xs text-gray-500">
                                最近验证：{formatDateTime(record.lastVerifiedAt)}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={mutating}
                                onClick={() => openEditDrawer(record)}
                              >
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
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </P0Section>

          <P0Section title="内容增强建议" description="基于一致性缺口与问题池信源需求">
            <div className="space-y-3" data-testid="source-graph-suggestions">
              {suggestions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                  录入信源后将根据缺口生成增强建议
                </div>
              ) : (
                suggestions.map(suggestion => (
                  <div
                    key={suggestion.id}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    data-testid={`enhancement-suggestion-${suggestion.id}`}
                  >
                    <div className="flex items-start gap-3">
                      {suggestion.icon === "citation" ? (
                        <Sparkles className="mt-0.5 h-5 w-5 text-blue-600" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                      )}
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="font-medium text-gray-900">{suggestion.description}</p>
                        <p className="text-sm text-gray-600">
                          受影响信源：{suggestion.affectedSources.join("、") || "—"}
                        </p>
                        {suggestion.relatedQuestions.length > 0 ? (
                          <p className="text-sm text-gray-600">
                            需要此信源的问题：{suggestion.relatedQuestions.join("；")}
                          </p>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          className={geoP0Brand.primaryOutline}
                          onClick={goWeekly}
                          data-testid="enhancement-go-weekly"
                        >
                          去补充内容
                        </Button>
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
