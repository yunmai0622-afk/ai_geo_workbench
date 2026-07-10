import { P0MetricTile, P0Section } from "@/components/geo/P0UiPrimitives";
import { DiscoveryCandidatesPanel } from "@/components/discovery/DiscoveryCandidatesPanel";
import {
  BrandSourceDrawer,
  defaultBrandSourceForm,
  recordToBrandSourceForm,
  type BrandSourceFormState,
} from "@/components/source-graph/BrandSourceDrawer";
import {
  SourceEvidenceOperatorOverview,
  type SourceEvidenceConsistencyRow,
  type SourceEvidenceDistribution,
  type SourceEvidenceMetric,
  type SourceEvidenceSuggestion,
  type SourceEvidenceWeakness,
} from "@/components/source-graph/SourceEvidenceOperatorOverview";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { useMaturityAutoCalculate } from "@/hooks/useMaturityAutoCalculate";
import { buildProjectUrl } from "@/lib/activeProject";
import {
  buildWeeklyContentEntryUrl,
  type WeeklyContentEntryContext,
} from "@shared/weeklyContentEntryContext";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { trpc } from "@/lib/trpc";
import {
  BRAND_SOURCE_INDICATORS,
  BRAND_SOURCE_TRUST_FILTER_LABELS,
  BRAND_SOURCE_TRUST_FILTERS,
  buildBrandSourceTrustSummary,
  filterBrandSourcesByTrust,
  groupBrandSourcesByPlatformType,
  isBrandSourceIncomplete,
  resolveBrandSourceCompletenessHint,
  resolveBrandSourceDisplayName,
  resolveBrandSourcePlatformLabel,
  resolveEntityConsistencyStatusLabel,
  resolveGapTypeLabel,
  type BrandSourceRecordRow,
  type BrandSourceTrustFilter,
  type EnrichedBrandSourceTrust,
} from "@shared/brandSourceGraph";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
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

function trustLevelBadgeClass(level: string): string {
  if (level === "high") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (level === "medium") return "border-blue-200 bg-blue-50 text-blue-800";
  if (level === "low") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-gray-200 bg-gray-50 text-gray-600";
}

function verificationBadgeClass(status: string): string {
  if (status === "valid") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "invalid") return "border-red-200 bg-red-50 text-red-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function recommendationBadgeClass(): string {
  return "border-violet-200 bg-violet-50 text-violet-800";
}

function resolveSuggestionPriorityLabel(priority: string): string {
  if (priority === "P0") return "最高优先级（P0）";
  if (priority === "P1") return "高优先级（P1）";
  return "普通优先级（P2）";
}

function resolveSuggestionReason(gapType: string): string {
  const reasons: Record<string, string> = {
    company_name: "不同平台对公司名称表述不一致，会影响 AI 判断这些内容是否属于同一个品牌。",
    brand_name: "品牌名称缺少统一表达，会降低 AI 识别并合并品牌公开信息的稳定性。",
    business_description: "公开内容对业务的说明不够一致，AI 难以准确理解品牌提供什么服务。",
    official_site: "公开内容缺少统一的官网指向，AI 难以确认品牌信息的权威来源。",
    core_keywords: "核心业务关键词覆盖不足，用户提出相关问题时 AI 不容易把品牌与需求关联起来。",
  };
  return reasons[gapType] ?? "现有公开内容对这项品牌信息的证明不足，会影响 AI 识别、引用和推荐品牌。";
}

function resolveSuggestionAction(input: {
  contentDirection: string;
  targetPlatform: string | null;
}): string {
  const platform = input.targetPlatform
    ? resolveBrandSourcePlatformLabel(input.targetPlatform)
    : "合适的公开平台";
  return `生成一篇适合发布到${platform}的内容，${input.contentDirection.replace(/[。；;]+$/, "")}。`;
}

function formatSourceOperatorCount(value: number | null | undefined, fallback = "暂无"): string {
  if (value === null || value === undefined) return fallback;
  return `${value}`;
}

function buildSourceEvidenceWeaknesses(input: {
  records: EnrichedBrandSourceTrust[];
  aiCitedCount: number;
  priorityFixCount: number;
  consistencyScore: number | null | undefined;
  consistencyChecks: Array<{
    anchorType: string;
    anchorLabel: string;
    status: string;
    issueSummary: string;
    suggestion: string;
  }>;
}): SourceEvidenceWeakness[] {
  const { records, aiCitedCount, priorityFixCount, consistencyScore, consistencyChecks } = input;
  const weaknesses: SourceEvidenceWeakness[] = [];

  if (records.length === 0) {
    weaknesses.push({
      key: "no-sources",
      title: "公开信源尚未建立",
      problem: "当前没有可用于证明品牌可信度的公开信源记录。",
      impact: "AI 缺少可引用证据，容易无法识别品牌或不愿推荐。",
      nextStep: "先补充官网、平台主页、案例页和已发布内容链接。",
    });
  } else if (records.length < 5) {
    weaknesses.push({
      key: "low-source-count",
      title: "公开信源数量偏少",
      problem: `当前仅有 ${records.length} 条信源，证据面还不够完整。`,
      impact: "AI 对品牌的理解容易依赖单一来源，推荐稳定性不足。",
      nextStep: "补齐官网、知识平台、内容平台、媒体或案例证据。",
    });
  }

  if (aiCitedCount === 0 && records.length > 0) {
    weaknesses.push({
      key: "no-ai-citation",
      title: "缺少可被 AI 引用的证据",
      problem: "现有信源尚未确认能被 AI 实测引用。",
      impact: "客户问到相关问题时，AI 可能知道品牌但不给出有力推荐。",
      nextStep: "优先优化包含品牌名、业务描述、关键词和客户证明的信源。",
    });
  }

  if ((consistencyScore ?? 100) < 70) {
    weaknesses.push({
      key: "low-consistency",
      title: "品牌关键信息不够一致",
      problem: `当前一致性评分 ${consistencyScore ?? 0}，部分信源对品牌信息表达不一致。`,
      impact: "AI 会难以判断哪个说法可信，影响识别和推荐信心。",
      nextStep: "统一品牌名、官网、业务描述、核心产品和关键词表达。",
    });
  }

  if (priorityFixCount > 0) {
    weaknesses.push({
      key: "priority-fixes",
      title: "存在优先修复项",
      problem: `当前有 ${priorityFixCount} 个信源或关键信息项需要优先处理。`,
      impact: "这些缺口会直接影响 AI 能否把公开证据串成可信答案。",
      nextStep: "按下方修复建议生成内容任务或补充信源。",
    });
  }

  const unstableCheck = consistencyChecks.find(check => check.status === "conflict" || check.status === "missing");
  if (unstableCheck) {
    weaknesses.push({
      key: `check-${unstableCheck.anchorType}`,
      title: `${unstableCheck.anchorLabel}需要修复`,
      problem: unstableCheck.issueSummary,
      impact: "客户搜索相关问题时，AI 可能因为证据不完整而减少推荐。",
      nextStep: unstableCheck.suggestion,
    });
  }

  return weaknesses.slice(0, 3);
}

function buildFallbackSourceEvidenceSuggestion(weakness: SourceEvidenceWeakness): SourceEvidenceSuggestion {
  return {
    key: `fallback-${weakness.key}`,
    title: weakness.title,
    action: weakness.nextStep,
    priority: "建议优先处理",
  };
}

function consistencyLabelFromScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return "待确认";
  if (score >= 85) return "较稳定";
  if (score >= 70) return "需观察";
  return "需修复";
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
  const [trustFilter, setTrustFilter] = useState<BrandSourceTrustFilter>("all");

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
  const discoverySummaryQuery = trpc.geo.discovery.getSourceDiscoverySummary.useQuery(projectQueryInput, {
    enabled: enabled && Boolean(selectedProjectId),
  });

  const invalidateAll = async () => {
    await Promise.all([
      utils.geo.brandSourceGraph.getBrandSources.invalidate(projectQueryInput),
      utils.geo.brandSourceGraph.getPageMetrics.invalidate(projectQueryInput),
      utils.geo.brandSourceGraph.getEntityConsistencyChecks.invalidate(projectQueryInput),
      utils.geo.brandSourceGraph.getEnhancementSuggestions.invalidate(projectQueryInput),
      utils.geo.discovery.getSourceDiscoverySummary.invalidate(projectQueryInput),
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
        const entryPayload: WeeklyContentEntryContext = {
          sourceType: "brand_source",
          autoGenerate: true,
        };
        if (result.taskId) entryPayload.taskId = result.taskId;
        setLocation(buildWeeklyContentEntryUrl(selectedProjectId, entryPayload));
      }
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "生成内容任务失败")),
  });

  const records = (sourcesQuery.data ?? []) as EnrichedBrandSourceTrust[];
  const consistencyChecks = consistencyQuery.data ?? [];
  const suggestions = suggestionsQuery.data ?? [];
  const metrics = metricsQuery.data;
  const trustSummary = useMemo(() => buildBrandSourceTrustSummary(records), [records]);
  const completenessHint = useMemo(() => resolveBrandSourceCompletenessHint(trustSummary), [trustSummary]);
  const filteredRecords = useMemo(
    () => filterBrandSourcesByTrust(records, trustFilter),
    [records, trustFilter],
  );
  const discoverySummary = discoverySummaryQuery.data;
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
  const aiCitedCount = records.filter(record => record.aiCitationConfirmed).length;
  const priorityFixCount = metrics?.priorityFixCount ?? 0;
  const consistencyScore = metrics?.entityConsistency;
  const incompleteCount = records.filter(isBrandSourceIncomplete).length;

  const operatorMetrics: SourceEvidenceMetric[] = useMemo(
    () => [
      {
        label: "信源数量",
        value: formatSourceOperatorCount(trustSummary.totalCount),
        hint: "官网、内容平台、媒体、案例等公开证据总量",
      },
      {
        label: "一致性状态",
        value: consistencyLabelFromScore(consistencyScore),
        hint: `当前一致性评分 ${formatSourceOperatorCount(consistencyScore, "待确认")}`,
      },
      {
        label: "可被 AI 引用的证据",
        value: formatSourceOperatorCount(aiCitedCount),
        hint: "已确认能支撑 AI 识别和推荐的公开证据",
      },
      {
        label: "待修复信源",
        value: formatSourceOperatorCount(incompleteCount),
        hint: "可访问、品牌名、业务描述、官网、关键词或引用状态不完整",
      },
    ],
    [aiCitedCount, consistencyScore, incompleteCount, trustSummary.totalCount],
  );

  const operatorWeaknesses = useMemo(
    () =>
      buildSourceEvidenceWeaknesses({
        records,
        aiCitedCount,
        priorityFixCount,
        consistencyScore,
        consistencyChecks,
      }),
    [aiCitedCount, consistencyChecks, consistencyScore, priorityFixCount, records],
  );

  const operatorSuggestions: SourceEvidenceSuggestion[] = useMemo(() => {
    const persisted = suggestions.slice(0, 4).map(suggestion => ({
      key: String(suggestion.id),
      title: suggestion.suggestionTitle,
      action: suggestion.contentDirection,
      priority: suggestion.priority,
    }));
    if (persisted.length > 0) return persisted;
    return operatorWeaknesses.map(buildFallbackSourceEvidenceSuggestion);
  }, [operatorWeaknesses, suggestions]);

  const operatorDistribution: SourceEvidenceDistribution[] = useMemo(
    () =>
      groupBrandSourcesByPlatformType(records).map(group => ({
        key: group.key,
        label: group.label,
        count: group.records.length,
        hint:
          group.key === "official"
            ? "用于确认品牌身份、官网和业务描述"
            : group.key === "knowledge"
              ? "用于回答用户常问问题和建立专业认知"
              : group.key === "content"
                ? "用于承接内容覆盖、发布和复测"
                : group.key === "media"
                  ? "用于提供第三方背书和案例证明"
                  : "用于补充其他可公开验证证据",
      })),
    [records],
  );

  const operatorConsistencyRows: SourceEvidenceConsistencyRow[] = useMemo(() => {
    const rows = consistencyChecks.slice(0, 6).map(check => ({
      key: check.anchorType,
      label: check.anchorLabel,
      status: resolveEntityConsistencyStatusLabel(check.status),
      suggestion: check.suggestion,
    }));
    if (rows.length > 0) return rows;
    return [
      {
        key: "pending",
        label: "品牌关键信息",
        status: "待确认",
        suggestion: "补充公开信源后，系统会检查品牌名、官网、业务描述和关键词是否一致。",
      },
    ];
  }, [consistencyChecks]);

  const operatorConclusion = useMemo(() => {
    if (records.length === 0) {
      return "当前还没有可用信源证据。建议先补充官网、平台主页、客户案例和已发布内容，让 AI 有公开材料可以识别和引用。";
    }
    if (operatorWeaknesses.length === 0) {
      return `当前已有 ${records.length} 条信源证据，其中 ${aiCitedCount} 条已确认可被 AI 引用，品牌关键信息整体较稳定。下一步建议保持定期复测，并把高价值内容继续补充为公开证据。`;
    }
    return `当前已有 ${records.length} 条信源证据，其中 ${aiCitedCount} 条已确认可被 AI 引用。主要短板是${operatorWeaknesses
      .map(item => item.title)
      .join("、")}，建议优先补齐证据并统一品牌表达，提升 AI 对品牌可信度的判断。`;
  }, [aiCitedCount, operatorWeaknesses, records.length]);

  const operatorPrimaryAction = useMemo(() => {
    if (records.length === 0 || incompleteCount > 0) {
      return {
        label: "补充信源证据",
        hint: "先补齐公开证据，再判断哪些内容需要进入发布和复测。",
        disabled: !selectedProjectId || mutating,
        onClick: openCreateDrawer,
      };
    }

    const firstSuggestion = suggestions[0];
    if (firstSuggestion?.linkedTaskId) {
      return {
        label: "查看修复任务",
        hint: "已有信源修复内容任务，进入执行进度继续推进。",
        disabled: !selectedProjectId || mutating,
        onClick: () => goWeeklyWithTask(firstSuggestion.linkedTaskId),
      };
    }
    if (firstSuggestion) {
      return {
        label: "生成修复任务",
        hint: "把当前信源缺口转成内容生产任务，方便交付团队推进。",
        disabled: !selectedProjectId || mutating,
        onClick: () =>
          createTaskMutation.mutate({
            projectId: selectedProjectId!,
            suggestionId: firstSuggestion.id,
          }),
      };
    }

    return {
      label: "查看收录与 AI 复测",
      hint: "信源基础较完整时，进入收录和 AI 识别复测。",
      disabled: !selectedProjectId,
      onClick: () => selectedProjectId && setLocation(buildProjectUrl("/inclusion-monitoring", selectedProjectId)),
    };
  }, [incompleteCount, mutating, records.length, selectedProjectId, setLocation, suggestions]);

  function scrollToDiscovery() {
    document.getElementById("source-graph-discovery")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
    const entryPayload: WeeklyContentEntryContext = { sourceType: "brand_source" };
    if (taskId) entryPayload.taskId = taskId;
    setLocation(buildWeeklyContentEntryUrl(selectedProjectId, entryPayload));
  }

  function goContentPublishing() {
    if (!selectedProjectId) return;
    setLocation(buildProjectUrl("/content-publishing", selectedProjectId));
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
              信源引用监测
            </h1>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              运营后台
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              不建议客户第一轮演示
            </span>
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              用于内部交付
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-gray-500">
            检查 AI 是否有足够公开证据信任品牌。
          </p>
          {selectedProject?.enterpriseName ? (
            <p className="mt-2 text-sm text-gray-600">
              当前项目：<span className="font-medium text-gray-900">{selectedProject.enterpriseName}</span>
            </p>
          ) : null}
        </div>
        <details className="shrink-0 rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="source-graph-secondary-actions">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700">
            运营辅助操作
          </summary>
          <div className="flex flex-col gap-2 border-t border-gray-100 p-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!selectedProjectId || mutating}
              onClick={openCreateDrawer}
              data-testid="source-graph-add-source"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              手动添加信源
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
        </details>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : (
        <>
          <SourceEvidenceOperatorOverview
            conclusion={operatorConclusion}
            metrics={operatorMetrics}
            weaknesses={operatorWeaknesses}
            suggestions={operatorSuggestions}
            distribution={operatorDistribution}
            consistencyRows={operatorConsistencyRows}
            primaryAction={operatorPrimaryAction}
          />

          {completenessHint ? (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                completenessHint.kind === "low_count"
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-red-200 bg-red-50 text-red-900"
              }`}
              data-testid="source-graph-completeness-hint"
            >
              <p>{completenessHint.message}</p>
              {completenessHint.kind === "low_count" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={scrollToDiscovery}
                  data-testid="source-graph-discover-more"
                >
                  自动发现更多信源
                </Button>
              ) : null}
            </div>
          ) : null}

          {discoverySummary ? (
            <details className="rounded-xl border border-blue-100 bg-white shadow-sm" data-testid="source-graph-discovery-summary">
              <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-gray-900">
                自动发现摘要
                <span className="ml-2 text-xs font-normal text-gray-500">默认收起，不抢信源修复 Top 3</span>
              </summary>
              <div className="grid gap-3 border-t border-blue-50 bg-blue-50/50 p-4 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="text-xs text-gray-500">上次自动发现</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {formatDateTime(discoverySummary.lastDiscoveryAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">待处理新发现</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{discoverySummary.newDiscoveryCount} 条</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">已验证信源</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{discoverySummary.verifiedSourceCount} 条</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">待验证信源</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{discoverySummary.pendingVerificationCount} 条</p>
                </div>
              </div>
            </details>
          ) : null}

          <details
            className="group rounded-2xl border border-gray-200 bg-white shadow-sm"
            data-testid="source-graph-operator-details-fold"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
                展开运营明细：信源记录、实体一致性与修复建议
              </span>
              <span className="text-xs font-normal text-gray-500">长表、检测细节和内部状态已收起</span>
            </summary>
            <div className="space-y-5 border-t border-gray-100 px-5 pb-5 pt-4">
          <P0Section title="运营明细：信源总览" description="基于当前项目信源与关键信息一致性自动计算">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="source-graph-overview">
              <P0MetricTile
                label="信源完整度"
                value={`${metrics?.sourceCompleteness ?? 0}`}
                hint="信源数量 + 六项指标完成度"
              />
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <p className="text-xs font-medium text-gray-500">核心信息项</p>
                <p className="mt-2 text-4xl font-bold text-blue-600" data-testid="source-graph-consistency-score">
                  {metrics?.entityConsistency ?? 0}
                </p>
                <p className="mt-1 text-xs text-gray-500">8项品牌关键信息平均分</p>
              </div>
              <P0MetricTile
                label="AI 可识别度"
                value={`${metrics?.aiIdentifiability ?? 0}`}
                hint="品牌、业务、核心信息项、关键词与 AI 引用"
              />
              <P0MetricTile
                label="优先修复项"
                value={String(metrics?.priorityFixCount ?? 0)}
                hint="高风险信源 + 缺失/冲突核心信息项"
              />
            </div>
          </P0Section>

          <P0Section title="运营明细：信源列表" description="录入各平台公开信源，查看可信度与 AI 推荐理由支撑">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">默认按官网优先、高可信度已验证信源优先排序</p>
              <Select value={trustFilter} onValueChange={value => setTrustFilter(value as BrandSourceTrustFilter)}>
                <SelectTrigger className="w-[160px]" data-testid="source-graph-trust-filter">
                  <SelectValue placeholder="筛选信源" />
                </SelectTrigger>
                <SelectContent>
                  {BRAND_SOURCE_TRUST_FILTERS.map(filter => (
                    <SelectItem key={filter} value={filter} data-testid={`source-graph-trust-filter-${filter}`}>
                      {BRAND_SOURCE_TRUST_FILTER_LABELS[filter]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedProjectId ? (
              <DiscoveryCandidatesPanel
                projectId={selectedProjectId}
                candidateType="source"
                title="AI 自动发现信源"
                description="根据品牌名和关键词检索公开网络，发现可能有助于 AI 识别你的官网、平台主页和媒体内容"
                discoverButtonLabel="开始发现信源"
                acceptButtonLabel="采纳为信源"
                testIdPrefix="source-graph"
                onAccepted={invalidateAll}
              />
            ) : null}
            <div className="mt-4 space-y-3" data-testid="source-graph-list">
              {filteredRecords.length === 0 ? (
                <div
                  className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500"
                  data-testid="source-graph-empty-sources"
                >
                  暂未添加品牌信源。请先添加官网、知乎、小红书、媒体稿、客户案例页等公开链接，系统会检查这些信源是否有助于
                  AI 识别企业。
                </div>
              ) : (
                filteredRecords.map(record => (
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
                            className={`rounded-full border px-2 py-0.5 ${trustLevelBadgeClass(record.trustLevel)}`}
                            data-testid={`brand-source-trust-${record.id}`}
                          >
                            可信度：{record.trustLevelLabel}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 ${verificationBadgeClass(record.verificationStatus)}`}
                            data-testid={`brand-source-verification-${record.id}`}
                          >
                            状态：{record.verificationStatusLabel}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 ${recommendationBadgeClass()}`}
                            data-testid={`brand-source-recommendation-${record.id}`}
                          >
                            支撑推荐理由：{record.recommendationSupportLabel}
                          </span>
                          <span className="text-gray-500">最后验证：{formatDateTime(record.lastVerifiedAt)}</span>
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
                          data-testid={`brand-source-mark-valid-${record.id}`}
                        >
                          标记为有效
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

          <P0Section title="运营明细：品牌关键信息一致性" description="基于企业档案标准值与各信源观察值对比">
            <div className="space-y-3" data-testid="entity-consistency-section">
              {consistencyChecks.length === 0 ? (
                <div
                  className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500"
                  data-testid="entity-consistency-empty"
                >
                  暂无关键信息一致性检查结果。添加信源后，系统会基于企业档案检查品牌名称、主营业务、官网链接、核心关键词等品牌关键信息是否一致。
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

          <P0Section
            title="待补强的公开证据"
            description="这些内容用于补齐 AI 识别品牌时缺少的公开证据，运营团队可按优先级生成和发布。"
          >
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
                          <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-600">
                            {resolveSuggestionPriorityLabel(suggestion.priority)}
                          </span>
                        </div>
                        <div className="grid gap-3 text-sm text-gray-700 md:grid-cols-2">
                          <div>
                            <p className="font-medium text-gray-900">要补什么</p>
                            <p className="mt-1 leading-6">{suggestion.suggestionTitle}</p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">为什么要补</p>
                            <p className="mt-1 leading-6">{resolveSuggestionReason(suggestion.gapType)}</p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">建议怎么做</p>
                            <p className="mt-1 leading-6">{resolveSuggestionAction(suggestion)}</p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">完成标准</p>
                            <p className="mt-1 leading-6">内容发布到公开平台，并回填可访问的真实链接。</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {suggestion.status === "verified" ? (
                            <Button type="button" size="sm" variant="outline" onClick={goContentPublishing}>
                              查看发布记录
                            </Button>
                          ) : suggestion.status === "accepted" ? (
                            <Button type="button" size="sm" variant="outline" onClick={goContentPublishing}>
                              去内容生产与发布
                            </Button>
                          ) : suggestion.linkedTaskId ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => goWeeklyWithTask(suggestion.linkedTaskId)}
                              data-testid="enhancement-go-existing-task"
                            >
                              查看已有内容任务
                            </Button>
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
                              生成内容任务
                            </Button>
                          )}
                        </div>
                        {(!selectedProjectId || mutating) && !suggestion.linkedTaskId ? (
                          <p className="text-xs text-amber-700">
                            {!selectedProjectId ? "请先选择企业项目，再生成内容任务。" : "正在处理其他操作，请稍候。"}
                          </p>
                        ) : null}
                        <details className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                          <summary className="cursor-pointer font-medium text-gray-700">查看运营细节</summary>
                          <div className="mt-2 space-y-1 border-t border-gray-200 pt-2">
                            <p>对应缺口：{resolveGapTypeLabel(suggestion.gapType)}</p>
                            <p>建议平台：{suggestion.targetPlatform ? resolveBrandSourcePlatformLabel(suggestion.targetPlatform) : "未指定"}</p>
                            <p>强化关键词：{suggestion.targetKeywords?.length ? (suggestion.targetKeywords as string[]).join("、") : "暂无"}</p>
                            <p>内部优先级：{suggestion.priority}</p>
                            <p>任务编号：{suggestion.linkedTaskId ?? "尚未生成"}</p>
                            <p>内部状态：{suggestion.status}</p>
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </P0Section>
            </div>
          </details>
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
