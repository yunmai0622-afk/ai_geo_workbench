import { P0MetricTile, P0Section } from "@/components/geo/P0UiPrimitives";
import {
  buildQuestionPoolMutationPayload,
  defaultQuestionPoolForm,
  QuestionSearchPoolDrawer,
  questionToPoolForm,
  type QuestionPoolFormState,
} from "@/components/questions/QuestionSearchPoolDrawer";
import { QuestionOpportunityMapPanel } from "@/components/questions/QuestionOpportunityMapPanel";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import {
  buildWeeklyContentEntryUrl,
  type WeeklyContentEntryContext,
} from "@shared/weeklyContentEntryContext";
import { trpc } from "@/lib/trpc";
import type { EnrichedSearchPoolQuestion } from "@shared/questionSearchPoolEnrichment";
import {
  buildQuestionOpportunityMapView,
  type QuestionOpportunityLabel,
  type QuestionOpportunityMapItem,
} from "@shared/questionOpportunityMap";
import {
  formatQuestionPoolGapMetricValue,
  groupQuestionsBySearchPoolType,
  isQuestionPoolPriority,
  resolveSearchPoolTypeLabel,
  resolveSourceTypeLabel,
  SEARCH_POOL_QUESTION_TYPES,
  SEARCH_POOL_SORT_MODE_LABELS,
  SEARCH_POOL_SORT_MODES,
  sortSearchPoolQuestions,
  type SearchPoolQuestionType,
  type SearchPoolSortMode,
} from "@shared/questionSearchPool";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { Library, Plus, Sparkles, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function opportunityBadgeClass(label: QuestionOpportunityLabel): string {
  switch (label) {
    case "高价值":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "竞品占位":
      return "border-red-200 bg-red-50 text-red-800";
    case "已覆盖":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "待优化":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

function buildGenerateMessage(result: {
  count: number;
  newCount?: number;
  filteredCount?: number;
  hadPreviousQuestions?: boolean;
}) {
  const n = result.newCount ?? result.count;
  if ((result.filteredCount ?? 0) > 0) {
    return `已过滤部分重复问题，本次生成 ${n} 个新问题。请优先标记 5-10 个高价值问题，用于下一轮 AI 实测。`;
  }
  if (result.hadPreviousQuestions) {
    return "已生成一组新的目标客户问题。请优先标记 5-10 个高价值问题，用于下一轮 AI 实测。";
  }
  return `已生成并写入 ${result.count} 条目标客户问题。请优先标记 5-10 个高价值问题，用于下一轮 AI 实测。`;
}

function validatePoolForm(form: QuestionPoolFormState): string | null {
  if (!form.questionText.trim()) return "请输入问题内容";
  if (!form.searchPoolType) return "请选择问题类型";
  return null;
}

export default function QuestionsLibraryPage() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const { selectedProjectId, selectedProject, projectInput, enabled, projectsLoading } = useActiveProjectSelection();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editQuestion, setEditQuestion] = useState<EnrichedSearchPoolQuestion | null>(null);
  const [formInitial, setFormInitial] = useState<QuestionPoolFormState>(() => defaultQuestionPoolForm());
  const [activeTab, setActiveTab] = useState<string>(SEARCH_POOL_QUESTION_TYPES[0].value);
  const [sortMode, setSortMode] = useState<SearchPoolSortMode>("value");
  const [pendingContentQuestion, setPendingContentQuestion] = useState<EnrichedSearchPoolQuestion | null>(null);

  const searchPoolQuery = trpc.geo.questions.listSearchPool.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const optimizationBriefQuery = trpc.geo.monthlyPlan.getOptimizationBrief.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const assetSummaryQuery = trpc.geo.assetLibrary.summary.useQuery(projectInput, { enabled });

  const createMutation = trpc.geo.questions.create.useMutation({
    onSuccess: async () => {
      await utils.geo.questions.listSearchPool.invalidate({ projectId: selectedProjectId! });
      toast.success("问题已添加");
      setDrawerOpen(false);
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "添加失败")),
  });
  const updateMutation = trpc.geo.questions.update.useMutation({
    onSuccess: async () => {
      await utils.geo.questions.listSearchPool.invalidate({ projectId: selectedProjectId! });
      toast.success("问题已更新");
      setDrawerOpen(false);
      setEditQuestion(null);
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "更新失败")),
  });
  const generateMutation = trpc.geo.questions.generateSearchPool.useMutation({
    onSuccess: async result => {
      await utils.geo.questions.listSearchPool.invalidate({ projectId: selectedProjectId! });
      toast.success(buildGenerateMessage(result));
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "生成高质量问题失败")),
  });
  const togglePriorityMutation = trpc.geo.questions.togglePriority.useMutation({
    onSuccess: async () => {
      await utils.geo.questions.listSearchPool.invalidate({ projectId: selectedProjectId! });
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "更新优先级失败")),
  });
  const toggleEnableMutation = trpc.geo.questions.toggle.useMutation({
    onSuccess: async () => {
      await utils.geo.questions.listSearchPool.invalidate({ projectId: selectedProjectId! });
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "更新启用状态失败")),
  });
  const addToRoundMutation = trpc.geo.questions.addToDiagnosisRound.useMutation({
    onSuccess: async result => {
      await utils.geo.questions.listSearchPool.invalidate({ projectId: selectedProjectId! });
      if (result.bound) {
        toast.success("已加入本轮诊断");
      } else {
        toast.message("问题已启用", { description: "当前无进行中的检测轮次，请前往 AI 诊断创建实测。" });
        if (selectedProjectId) setLocation(buildProjectUrl("/ai-diagnosis", selectedProjectId));
      }
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "加入诊断失败")),
  });
  const createContentTaskMutation = trpc.geo.questions.createContentTaskFromQuestion.useMutation({
    onSuccess: async result => {
      await utils.geo.questions.listSearchPool.invalidate({ projectId: selectedProjectId! });
      toast.success("已生成内容任务");
      if (selectedProjectId && pendingContentQuestion) {
        const entryPayload: WeeklyContentEntryContext = {
          questionId: pendingContentQuestion.id,
          questionText: pendingContentQuestion.questionText,
          sourceType: "search_pool",
          relatedGeoGap: pendingContentQuestion.diagnosisGap,
          autoGenerate: true,
        };
        if (result.taskId) entryPayload.taskId = result.taskId;
        setLocation(buildWeeklyContentEntryUrl(selectedProjectId, entryPayload));
        setPendingContentQuestion(null);
      } else if (selectedProjectId) {
        const fallbackEntry: WeeklyContentEntryContext = {};
        if (result.taskId) fallbackEntry.taskId = result.taskId;
        setLocation(buildWeeklyContentEntryUrl(selectedProjectId, fallbackEntry));
      }
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "生成内容任务失败")),
  });

  const poolPayload = searchPoolQuery.data;
  const questions = poolPayload?.questions ?? [];
  const gapOverview = poolPayload?.overview;
  const groupStats = poolPayload?.groupStats;
  const hasDiagnosisData = poolPayload?.hasDiagnosisData ?? false;
  const hasProfile = Boolean(assetSummaryQuery.data?.profile);
  const loading = enabled && (searchPoolQuery.isLoading || assetSummaryQuery.isLoading || projectsLoading);
  const mutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    generateMutation.isPending ||
    togglePriorityMutation.isPending ||
    toggleEnableMutation.isPending ||
    addToRoundMutation.isPending ||
    createContentTaskMutation.isPending;

  const grouped = useMemo(() => {
    const poolContext = {
      brandName: selectedProject?.enterpriseName ?? null,
    };
    const base = groupQuestionsBySearchPoolType(questions, poolContext) as Record<
      SearchPoolQuestionType,
      EnrichedSearchPoolQuestion[]
    >;
    return Object.fromEntries(
      SEARCH_POOL_QUESTION_TYPES.map(type => [
        type.value,
        sortSearchPoolQuestions(base[type.value], sortMode),
      ]),
    ) as Record<SearchPoolQuestionType, EnrichedSearchPoolQuestion[]>;
  }, [questions, selectedProject?.enterpriseName, sortMode]);
  const opportunityMapView = useMemo(
    () =>
      buildQuestionOpportunityMapView({
        questions,
        hasDiagnosisData,
        monthlyPriorityNames: optimizationBriefQuery.data?.priorities.map(priority => priority.relatedDimensionName),
      }),
    [questions, hasDiagnosisData, optimizationBriefQuery.data?.priorities],
  );

  function openCreateDrawer() {
    setDrawerMode("create");
    setEditQuestion(null);
    setFormInitial(defaultQuestionPoolForm());
    setDrawerOpen(true);
  }

  function openEditDrawer(question: EnrichedSearchPoolQuestion) {
    setDrawerMode("edit");
    setEditQuestion(question);
    setFormInitial(questionToPoolForm(question));
    setDrawerOpen(true);
  }

  function handleSubmit(form: QuestionPoolFormState) {
    if (!selectedProjectId) {
      toast.error("请先选择企业项目");
      return;
    }
    const error = validatePoolForm(form);
    if (error) {
      toast.error(error);
      return;
    }
    const payload = buildQuestionPoolMutationPayload(
      form,
      selectedProjectId,
      drawerMode === "edit" ? Number(editQuestion?.enabled) !== 0 : true,
    );
    if (drawerMode === "edit" && editQuestion) {
      updateMutation.mutate({ id: editQuestion.id, ...payload });
      return;
    }
    createMutation.mutate(payload);
  }

  function handleGenerate() {
    if (!selectedProjectId) {
      toast.error("请先选择企业项目");
      return;
    }
    if (!hasProfile) {
      toast.error("请先完成企业档案建档，再生成高质量问题");
      return;
    }
    generateMutation.mutate({ projectId: selectedProjectId });
  }

  function handleAddToRound(question: EnrichedSearchPoolQuestion) {
    if (!selectedProjectId) return;
    addToRoundMutation.mutate({ projectId: selectedProjectId, questionId: question.id });
  }

  function handleCreateContentTask(question: EnrichedSearchPoolQuestion) {
    if (!selectedProjectId) {
      toast.error("请先选择企业项目");
      return;
    }
    if (!hasDiagnosisData) {
      toast.message("暂无诊断数据，请先执行 AI 实测诊断", {
        description: "完成诊断后可围绕问题缺口生成内容任务。",
      });
      setLocation(buildProjectUrl("/ai-diagnosis", selectedProjectId));
      return;
    }
    setPendingContentQuestion(question);
    createContentTaskMutation.mutate({ projectId: selectedProjectId, questionId: question.id });
  }

  function handleOpportunityItemAction(item: QuestionOpportunityMapItem) {
    if (!selectedProjectId) {
      toast.error("请先选择企业项目");
      return;
    }
    const question = questions.find(q => q.id === item.questionId);
    if (!question) {
      toast.error("未找到对应问题，请刷新后重试");
      return;
    }
    if (item.nextActionKind === "add_to_diagnosis") {
      handleAddToRound(question);
      return;
    }
    if (item.nextActionKind === "monitor_retest") {
      setLocation(buildProjectUrl("/inclusion-monitoring", selectedProjectId));
      return;
    }
    if (item.nextActionKind === "open_weekly_task") {
      setLocation(
        buildWeeklyContentEntryUrl(selectedProjectId, {
          questionId: question.id,
          questionText: question.questionText,
          sourceType: "search_pool",
          relatedGeoGap: question.diagnosisGap,
        }),
      );
      return;
    }
    handleCreateContentTask(question);
  }

  function handleOpportunityPrimaryAction() {
    if (!selectedProjectId) {
      toast.error("请先选择企业项目");
      return;
    }
    if (!hasDiagnosisData) {
      setLocation(buildProjectUrl("/ai-diagnosis", selectedProjectId));
      return;
    }
    const topItem = opportunityMapView.topItems[0];
    if (topItem) {
      handleOpportunityItemAction(topItem);
      return;
    }
    setLocation(buildProjectUrl("/monthly-plan", selectedProjectId));
  }

  function handleViewQuestionEvidence(question: EnrichedSearchPoolQuestion) {
    if (!hasDiagnosisData || !question.lastTestResult) {
      toast.message("暂无诊断证据，请先执行 AI 实测诊断");
      return;
    }
    if (!selectedProjectId) return;
    setLocation(buildProjectUrl("/ai-diagnosis", selectedProjectId));
  }

  function handleTogglePriority(question: EnrichedSearchPoolQuestion) {
    togglePriorityMutation.mutate({ id: question.id });
  }

  function handleToggleEnabled(question: EnrichedSearchPoolQuestion, enabledNext: boolean) {
    toggleEnableMutation.mutate({ id: question.id, enabled: enabledNext });
  }

  if (!enabled && !projectsLoading) {
    return <ProjectContextEmptyState />;
  }

  return (
    <div className="space-y-6" data-testid="questions-search-pool-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Library className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900" data-testid="questions-page-title">
              AI 搜索机会地图
            </h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-gray-500" data-testid="questions-page-subtitle">
            了解客户会怎么问 AI，发现品牌可见度机会与竞品占位风险。
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
            data-testid="questions-library-add"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            新增问题
          </Button>
          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={!selectedProjectId || !hasProfile || mutating}
            onClick={handleGenerate}
            data-testid="questions-library-generate"
          >
            {generateMutation.isPending ? (
              <>
                <Spinner className="mr-1.5 h-4 w-4" />
                生成中…
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-4 w-4" />
                生成高质量问题
              </>
            )}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : (
        <>
          <QuestionOpportunityMapPanel
            view={opportunityMapView}
            mutating={mutating}
            onPrimaryAction={selectedProjectId ? handleOpportunityPrimaryAction : undefined}
            onItemAction={handleOpportunityItemAction}
          />

          <P0Section title="机会总览" description="核心问题覆盖、竞品占位与本月重点">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="question-pool-overview">
              <P0MetricTile
                label="核心问题总数"
                value={String(gapOverview?.totalQuestions ?? 0)}
                hint="当前项目问题池总量"
              />
              <P0MetricTile
                label="已覆盖内容问题数"
                value={String(gapOverview?.coveredContentQuestions ?? 0)}
                hint="已发布关联内容的问题"
              />
              <P0MetricTile
                label="竞品占位问题数"
                value={formatQuestionPoolGapMetricValue(
                  gapOverview?.competitorOccupiedQuestions ?? 0,
                  hasDiagnosisData,
                )}
                hint="AI 诊断中竞品出现率超过 50% 的问题"
              />
              <P0MetricTile
                label="本月重点问题数"
                value={String(gapOverview?.monthlyFocusQuestions ?? 0)}
                hint="本月优化计划中标记的问题"
              />
            </div>
          </P0Section>

          <P0Section title="问题分组" description="按 AI 搜索问题类型浏览机会分布">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">各分组内默认按价值排序，可切换排序方式</p>
              <Select
                value={sortMode}
                onValueChange={value => setSortMode(value as SearchPoolSortMode)}
              >
                <SelectTrigger className="w-[180px]" data-testid="question-pool-sort-mode">
                  <SelectValue placeholder="排序方式" />
                </SelectTrigger>
                <SelectContent>
                  {SEARCH_POOL_SORT_MODES.map(mode => (
                    <SelectItem key={mode} value={mode} data-testid={`question-pool-sort-${mode}`}>
                      {SEARCH_POOL_SORT_MODE_LABELS[mode]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="question-pool-tabs">
              <TabsList className="flex w-full flex-wrap gap-1">
                {SEARCH_POOL_QUESTION_TYPES.map(type => {
                  const stats = groupStats?.[type.value];
                  return (
                    <TabsTrigger
                      key={type.value}
                      value={type.value}
                      data-testid={`question-pool-tab-${type.value}`}
                      className="gap-1.5"
                    >
                      <span>{type.label}</span>
                      <span className="text-xs text-gray-500">({stats?.total ?? grouped[type.value].length})</span>
                      {hasDiagnosisData && (stats?.competitorOccupiedCount ?? 0) > 0 ? (
                        <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                          竞品 {stats?.competitorOccupiedCount}
                        </span>
                      ) : null}
                      {(stats?.coveredCount ?? 0) > 0 ? (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                          已覆盖 {stats?.coveredCount}
                        </span>
                      ) : null}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {SEARCH_POOL_QUESTION_TYPES.map(type => {
                const stats = groupStats?.[type.value];
                return (
                  <TabsContent key={type.value} value={type.value} className="mt-4 space-y-2">
                    {stats ? (
                      <p className="text-xs text-gray-500" data-testid={`question-pool-group-stats-${type.value}`}>
                        启用 {stats.enabled} · 已实测 {hasDiagnosisData ? stats.tested : "暂无诊断数据"} · 缺口{" "}
                        {hasDiagnosisData ? stats.gapCount : "暂无诊断数据"} · 内容就绪 {stats.contentReadyCount}
                      </p>
                    ) : null}
                    <QuestionPoolTable
                      questions={grouped[type.value]}
                      hasDiagnosisData={hasDiagnosisData}
                      mutating={mutating}
                      onAddToRound={handleAddToRound}
                      onCreateContentTask={handleCreateContentTask}
                      onViewEvidence={handleViewQuestionEvidence}
                      onTogglePriority={handleTogglePriority}
                      onToggleEnabled={handleToggleEnabled}
                      onEdit={openEditDrawer}
                    />
                  </TabsContent>
                );
              })}
            </Tabs>
          </P0Section>
        </>
      )}

      <QuestionSearchPoolDrawer
        open={drawerOpen}
        mode={drawerMode}
        saving={createMutation.isPending || updateMutation.isPending}
        initial={formInitial}
        onOpenChange={setDrawerOpen}
        onSubmit={handleSubmit}
      />

      {!hasProfile && selectedProjectId ? (
        <p className="text-sm text-gray-500">
          提示：完成企业档案后可使用「生成高质量问题」，基于品牌与行业信息自动写入客户搜索问题。
        </p>
      ) : null}
    </div>
  );
}

type TableProps = {
  questions: EnrichedSearchPoolQuestion[];
  hasDiagnosisData: boolean;
  mutating: boolean;
  onAddToRound: (question: EnrichedSearchPoolQuestion) => void;
  onCreateContentTask: (question: EnrichedSearchPoolQuestion) => void;
  onViewEvidence: (question: EnrichedSearchPoolQuestion) => void;
  onTogglePriority: (question: EnrichedSearchPoolQuestion) => void;
  onToggleEnabled: (question: EnrichedSearchPoolQuestion, enabled: boolean) => void;
  onEdit: (question: EnrichedSearchPoolQuestion) => void;
};

function QuestionPoolTable({
  questions,
  hasDiagnosisData,
  mutating,
  onAddToRound,
  onCreateContentTask,
  onViewEvidence,
  onTogglePriority,
  onToggleEnabled,
  onEdit,
}: TableProps) {
  if (questions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        该分组暂无问题（0 条）
      </div>
    );
  }

  return (
    <div className="rounded-lg border" data-testid="question-pool-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>问题内容</TableHead>
            <TableHead>机会标签</TableHead>
            <TableHead>类型</TableHead>
            <TableHead>诊断缺口</TableHead>
            <TableHead>AI 表现</TableHead>
            <TableHead>内容状态</TableHead>
            <TableHead>启用</TableHead>
            <TableHead>本轮重点</TableHead>
            <TableHead>需要强化的信源</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {questions.map(question => (
            <TableRow key={question.id} data-testid={`question-pool-row-${question.id}`}>
              <TableCell className="max-w-xs whitespace-normal">{question.questionText}</TableCell>
              <TableCell data-testid={`question-opportunity-label-${question.id}`}>
                {question.opportunityLabel ? (
                  <Badge variant="outline" className={opportunityBadgeClass(question.opportunityLabel)}>
                    {question.opportunityLabel}
                  </Badge>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>{resolveSearchPoolTypeLabel(question.searchPoolType)}</TableCell>
              <TableCell className="max-w-[10rem] whitespace-normal text-sm text-gray-700">
                {question.diagnosisGap}
              </TableCell>
              <TableCell data-testid={`question-ai-performance-${question.id}`}>
                {hasDiagnosisData ? question.aiPerformanceLabel : "暂无诊断数据"}
              </TableCell>
              <TableCell data-testid={`question-content-status-${question.id}`}>
                {question.contentStatus}
              </TableCell>
              <TableCell>
                <Switch
                  checked={Number(question.enabled) !== 0}
                  disabled={mutating}
                  data-testid={`question-toggle-enabled-${question.id}`}
                  onCheckedChange={checked => onToggleEnabled(question, checked)}
                />
              </TableCell>
              <TableCell>
                {isQuestionPoolPriority(question) ? (
                  <Badge className="border-rose-200 bg-rose-50 text-rose-800">是</Badge>
                ) : (
                  "否"
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {(question.requiredSourceTypes ?? []).map(sourceType => (
                    <Badge key={sourceType} variant="outline" className="text-xs">
                      {resolveSourceTypeLabel(sourceType)}
                    </Badge>
                  ))}
                  {(question.requiredSourceTypes ?? []).length === 0 ? "—" : null}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-wrap justify-end gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={mutating}
                    data-testid={`question-view-evidence-${question.id}`}
                    onClick={() => onViewEvidence(question)}
                  >
                    查看证据
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={mutating}
                    data-testid={`question-add-round-${question.id}`}
                    onClick={() => onAddToRound(question)}
                  >
                    加入本轮诊断
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={mutating || question.hasContentTask}
                    data-testid={`question-create-task-${question.id}`}
                    onClick={() => onCreateContentTask(question)}
                  >
                    生成内容任务
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={question.priorityLevel === "high" ? "default" : "outline"}
                    disabled={mutating}
                    data-testid={`question-toggle-priority-${question.id}`}
                    onClick={() => onTogglePriority(question)}
                  >
                    <Star className="mr-1 h-3.5 w-3.5" />
                    {question.priorityLevel === "high" ? "取消重点" : "标记重点"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={mutating}
                    data-testid={`question-edit-${question.id}`}
                    onClick={() => onEdit(question)}
                  >
                    编辑
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
