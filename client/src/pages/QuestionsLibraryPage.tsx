import { P0MetricTile, P0Section } from "@/components/geo/P0UiPrimitives";
import {
  buildQuestionPoolMutationPayload,
  defaultQuestionPoolForm,
  QuestionSearchPoolDrawer,
  questionToPoolForm,
  type QuestionPoolFormState,
} from "@/components/questions/QuestionSearchPoolDrawer";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
import { trpc } from "@/lib/trpc";
import {
  buildSearchPoolOverviewMetrics,
  groupQuestionsBySearchPoolType,
  resolveLastTestResultLabel,
  resolveSearchPoolPriorityLabel,
  resolveSearchPoolTypeLabel,
  resolveSourceTypeLabel,
  SEARCH_POOL_QUESTION_TYPES,
  type SearchPoolQuestionRow,
} from "@shared/questionSearchPool";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { Library, Plus, Sparkles, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

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
  const [editQuestion, setEditQuestion] = useState<SearchPoolQuestionRow | null>(null);
  const [formInitial, setFormInitial] = useState<QuestionPoolFormState>(() => defaultQuestionPoolForm());
  const [activeTab, setActiveTab] = useState<string>(SEARCH_POOL_QUESTION_TYPES[0].value);

  const questionsQuery = trpc.geo.questions.list.useQuery(projectInput, { enabled });
  const assetSummaryQuery = trpc.geo.assetLibrary.summary.useQuery(projectInput, { enabled });

  const createMutation = trpc.geo.questions.create.useMutation({
    onSuccess: async () => {
      await utils.geo.questions.list.invalidate(projectInput);
      toast.success("问题已添加");
      setDrawerOpen(false);
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "添加失败")),
  });
  const updateMutation = trpc.geo.questions.update.useMutation({
    onSuccess: async () => {
      await utils.geo.questions.list.invalidate(projectInput);
      toast.success("问题已更新");
      setDrawerOpen(false);
      setEditQuestion(null);
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "更新失败")),
  });
  const generateMutation = trpc.geo.questions.generateTargetQuestions.useMutation({
    onSuccess: async result => {
      await utils.geo.questions.list.invalidate(projectInput);
      toast.success(buildGenerateMessage(result));
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "生成高质量问题失败")),
  });
  const togglePriorityMutation = trpc.geo.questions.togglePriority.useMutation({
    onSuccess: async () => {
      await utils.geo.questions.list.invalidate(projectInput);
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "更新优先级失败")),
  });
  const addToRoundMutation = trpc.geo.questions.addToDiagnosisRound.useMutation({
    onSuccess: async result => {
      await utils.geo.questions.list.invalidate(projectInput);
      if (result.bound) {
        toast.success("已加入本轮诊断");
      } else {
        toast.message("问题已启用", { description: "当前无进行中的检测轮次，请前往 AI 诊断创建实测。" });
        if (selectedProjectId) setLocation(buildProjectUrl("/ai-diagnosis", selectedProjectId));
      }
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "加入诊断失败")),
  });

  const hasProfile = Boolean(assetSummaryQuery.data?.profile);
  const questions = (questionsQuery.data ?? []) as SearchPoolQuestionRow[];
  const loading = enabled && (questionsQuery.isLoading || assetSummaryQuery.isLoading || projectsLoading);
  const mutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    generateMutation.isPending ||
    togglePriorityMutation.isPending ||
    addToRoundMutation.isPending;

  const overview = useMemo(() => buildSearchPoolOverviewMetrics(questions), [questions]);
  const grouped = useMemo(() => groupQuestionsBySearchPoolType(questions), [questions]);

  function openCreateDrawer() {
    setDrawerMode("create");
    setEditQuestion(null);
    setFormInitial(defaultQuestionPoolForm());
    setDrawerOpen(true);
  }

  function openEditDrawer(question: SearchPoolQuestionRow) {
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

  function handleAddToRound(question: SearchPoolQuestionRow) {
    if (!selectedProjectId) return;
    addToRoundMutation.mutate({ projectId: selectedProjectId, questionId: question.id });
  }

  function handleCreateContentTask(question: SearchPoolQuestionRow) {
    if (!selectedProjectId) return;
    setLocation(`${buildProjectUrl("/weekly", selectedProjectId)}&questionId=${question.id}`);
  }

  function handleTogglePriority(question: SearchPoolQuestionRow) {
    togglePriorityMutation.mutate({ id: question.id });
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
              AI 搜索问题池
            </h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-gray-500" data-testid="questions-page-subtitle">
            结构化管理 AI 搜索问题，绑定诊断缺口、内容任务与信源类型，支撑后续信源图谱与多平台实测。
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
          <P0Section title="问题池概览" description="核心问题覆盖与本轮重点">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" data-testid="question-pool-overview">
              <P0MetricTile label="核心问题总数" value={String(overview.total)} hint="当前项目问题池总量" />
              <P0MetricTile
                label="已覆盖"
                value={String(overview.covered)}
                hint="最近实测结果为已提及或已推荐"
              />
              <P0MetricTile
                label="未提及品牌"
                value={String(overview.notMentioned)}
                hint="最近实测未提及本品牌"
              />
              <P0MetricTile label="竞品占优" value={String(overview.competitorWon)} hint="最近实测竞品占优" />
              <P0MetricTile
                label="本轮重点问题"
                value={String(overview.highPriority)}
                hint="优先级为高的问题数量"
              />
            </div>
          </P0Section>

          <P0Section title="问题分组" description="按 AI 搜索问题类型浏览">
            <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="question-pool-tabs">
              <TabsList className="flex w-full flex-wrap gap-1">
                {SEARCH_POOL_QUESTION_TYPES.map(type => (
                  <TabsTrigger
                    key={type.value}
                    value={type.value}
                    data-testid={`question-pool-tab-${type.value}`}
                  >
                    {type.label} ({grouped[type.value].length})
                  </TabsTrigger>
                ))}
              </TabsList>
              {SEARCH_POOL_QUESTION_TYPES.map(type => (
                <TabsContent key={type.value} value={type.value} className="mt-4">
                  <QuestionPoolTable
                    questions={grouped[type.value]}
                    mutating={mutating}
                    onAddToRound={handleAddToRound}
                    onCreateContentTask={handleCreateContentTask}
                    onTogglePriority={handleTogglePriority}
                    onEdit={openEditDrawer}
                  />
                </TabsContent>
              ))}
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
  questions: SearchPoolQuestionRow[];
  mutating: boolean;
  onAddToRound: (question: SearchPoolQuestionRow) => void;
  onCreateContentTask: (question: SearchPoolQuestionRow) => void;
  onTogglePriority: (question: SearchPoolQuestionRow) => void;
  onEdit: (question: SearchPoolQuestionRow) => void;
};

function QuestionPoolTable({
  questions,
  mutating,
  onAddToRound,
  onCreateContentTask,
  onTogglePriority,
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
            <TableHead>类型</TableHead>
            <TableHead>优先级</TableHead>
            <TableHead>最近实测结果</TableHead>
            <TableHead>内容任务</TableHead>
            <TableHead>需要强化的信源</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {questions.map(question => (
            <TableRow key={question.id} data-testid={`question-pool-row-${question.id}`}>
              <TableCell className="max-w-xs whitespace-normal">{question.questionText}</TableCell>
              <TableCell>{resolveSearchPoolTypeLabel(question.searchPoolType)}</TableCell>
              <TableCell>
                {question.priorityLevel === "high" ? (
                  <Badge className="border-rose-200 bg-rose-50 text-rose-800">高</Badge>
                ) : (
                  resolveSearchPoolPriorityLabel(question.priorityLevel)
                )}
              </TableCell>
              <TableCell data-testid={`question-last-test-${question.id}`}>
                {resolveLastTestResultLabel(question.lastTestResult)}
              </TableCell>
              <TableCell>{question.relatedContentTask ? "已关联" : "未关联"}</TableCell>
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
                    data-testid={`question-add-round-${question.id}`}
                    onClick={() => onAddToRound(question)}
                  >
                    加入本轮诊断
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={mutating}
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
