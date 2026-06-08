import {
  QuestionIntentGroupSection,
  QuestionUnclassifiedGroupSection,
} from "@/components/questions/QuestionIntentGroupSection";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";

import { trpc } from "@/lib/trpc";
import {
  buildQuestionBankOverviewMetrics,
  buildQuestionIntentGroupStats,
  groupQuestionsByIntent,
  QUESTION_INTENT_GROUPS,
  resolveQuestionIntentLabel,
  type QuestionBankRow,
  type TestRoundSummary,
} from "@shared/questionBankIntentMap";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { Library, Plus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const MANUAL_ADD_TYPES = [
  { value: "品牌认知", label: "品牌认知" },
  { value: "scenario_need", label: "场景痛点" },
  { value: "行业推荐", label: "方案寻找" },
  { value: "竞品对比", label: "竞品比较" },
  { value: "long_tail_conversion", label: "购买决策" },
  { value: "指定问题", label: "指定问题" },
] as const;

type FormState = {
  questionText: string;
  questionType: string;
};

function defaultForm(): FormState {
  return { questionText: "", questionType: "指定问题" };
}

function buildGenerateMessage(result: {
  count: number;
  newCount?: number;
  filteredCount?: number;
  hadPreviousQuestions?: boolean;
}) {
  const n = result.newCount ?? result.count;
  if ((result.filteredCount ?? 0) > 0) {
    return `已过滤部分重复问题，本次生成 ${n} 个新问题。请优先启用 5-10 个高价值问题，用于下一轮 AI 实测。`;
  }
  if (result.hadPreviousQuestions) {
    return "已生成一组新的目标客户问题。请优先启用 5-10 个高价值问题，用于下一轮 AI 实测。";
  }
  return `已生成并写入 ${result.count} 条目标客户问题。请优先启用 5-10 个高价值问题，用于下一轮 AI 实测。`;
}

export default function QuestionsLibraryPage() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const { selectedProjectId, selectedProject, projectInput, enabled, projectsLoading } = useActiveProjectSelection();
  const [addOpen, setAddOpen] = useState(false);
  const [editQuestion, setEditQuestion] = useState<QuestionBankRow | null>(null);
  const [form, setForm] = useState<FormState>(() => defaultForm());

  const questionsQuery = trpc.geo.questions.list.useQuery(projectInput, { enabled });
  const assetSummaryQuery = trpc.geo.assetLibrary.summary.useQuery(projectInput, { enabled });
  const testRoundsQuery = trpc.geo.testRounds.list.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const tasksQuery = trpc.geo.tasks.list.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const articlesQuery = trpc.geo.articles.list.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const workspaceSummaryQuery = trpc.geo.workspace.summary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );

  const toggleMutation = trpc.geo.questions.toggle.useMutation({
    onSuccess: async () => {
      await utils.geo.questions.list.invalidate(projectInput);
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "更新状态失败")),
  });
  const deleteMutation = trpc.geo.questions.delete.useMutation({
    onSuccess: async () => {
      await utils.geo.questions.list.invalidate(projectInput);
      toast.success("问题已删除");
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "删除失败")),
  });
  const createMutation = trpc.geo.questions.create.useMutation({
    onSuccess: async () => {
      await utils.geo.questions.list.invalidate(projectInput);
      toast.success("问题已添加");
      setAddOpen(false);
      setForm(defaultForm());
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "添加失败")),
  });
  const updateMutation = trpc.geo.questions.update.useMutation({
    onSuccess: async () => {
      await utils.geo.questions.list.invalidate(projectInput);
      toast.success("问题已更新");
      setEditQuestion(null);
      setForm(defaultForm());
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

  const hasProfile = Boolean(assetSummaryQuery.data?.profile);
  const questions = (questionsQuery.data ?? []) as QuestionBankRow[];
  const articles = articlesQuery.data ?? [];
  const loading =
    enabled &&
    (questionsQuery.isLoading ||
      assetSummaryQuery.isLoading ||
      testRoundsQuery.isLoading ||
      tasksQuery.isLoading ||
      articlesQuery.isLoading ||
      projectsLoading);
  const mutating =
    toggleMutation.isPending ||
    deleteMutation.isPending ||
    createMutation.isPending ||
    updateMutation.isPending ||
    generateMutation.isPending;

  const hasCompletedT0Baseline = Boolean(workspaceSummaryQuery.data?.hasCompletedT0Baseline);
  const testRounds = testRoundsQuery.data ?? [];

  const currentRound = useMemo<TestRoundSummary | null>(() => {
    const round =
      testRounds.find(item => item.status === "running") ??
      testRounds.find(item => item.roundType === "T0_BASELINE" && item.status !== "failed") ??
      null;
    if (!round) return null;
    const linkedQuestions = questions.filter(question => Number(question.enabled) !== 0);
    const intentLabels = Array.from(
      new Set(linkedQuestions.map(question => resolveQuestionIntentLabel(question)).filter(label => label !== "待分类")),
    ).slice(0, 6);
    return {
      id: round.id,
      roundType: round.roundType,
      roundName: round.roundName,
      status: round.status,
      questionsCount: round.questionsCount || linkedQuestions.length,
      intentLabels,
    };
  }, [questions, testRounds]);

  const testedQuestionIds = useMemo(() => {
    const ids = new Set<number>();
    if (!hasCompletedT0Baseline) return ids;
    for (const question of questions) {
      if (Number(question.enabled) !== 0) ids.add(question.id);
    }
    return ids;
  }, [hasCompletedT0Baseline, questions]);

  const overview = useMemo(
    () =>
      buildQuestionBankOverviewMetrics({
        questions,
        currentRoundQuestionCount: currentRound?.questionsCount ?? questions.filter(q => Number(q.enabled) !== 0).length,
        contentTaskCount: tasksQuery.data?.length ?? 0,
        hasCompletedT0Baseline,
      }),
    [questions, currentRound, tasksQuery.data, hasCompletedT0Baseline],
  );

  const intentGroups = useMemo(() => groupQuestionsByIntent(questions), [questions]);
  const intentStats = useMemo(
    () =>
      buildQuestionIntentGroupStats({
        questions,
        testedQuestionIds,
        hasCompletedT0Baseline,
        articles,
      }),
    [questions, testedQuestionIds, hasCompletedT0Baseline, articles],
  );

  function openAddDialog() {
    setForm(defaultForm());
    setAddOpen(true);
  }

  function openEditDialog(question: QuestionBankRow) {
    setEditQuestion(question);
    setForm({
      questionText: question.questionText,
      questionType: MANUAL_ADD_TYPES.some(type => type.value === question.questionType)
        ? question.questionType
        : "指定问题",
    });
  }

  function handleCreate() {
    if (!selectedProjectId) {
      toast.error("请先选择企业项目");
      return;
    }
    const questionText = form.questionText.trim();
    if (!questionText) {
      toast.error("请输入问题内容");
      return;
    }
    createMutation.mutate({
      projectId: selectedProjectId,
      questionText,
      questionType: form.questionType as (typeof MANUAL_ADD_TYPES)[number]["value"],
      source: "manual",
      enabled: true,
    });
  }

  function handleUpdate() {
    if (!selectedProjectId || !editQuestion) return;
    const questionText = form.questionText.trim();
    if (!questionText) {
      toast.error("请输入问题内容");
      return;
    }
    updateMutation.mutate({
      id: editQuestion.id,
      projectId: selectedProjectId,
      questionText,
      questionType: form.questionType as (typeof MANUAL_ADD_TYPES)[number]["value"],
      enabled: Number(editQuestion.enabled) !== 0,
    });
  }

  function handleToggle(question: QuestionBankRow, nextEnabled: boolean) {
    toggleMutation.mutate({ id: question.id, enabled: nextEnabled });
  }

  function handleDelete(question: QuestionBankRow) {
    const ok = window.confirm(`确定删除该问题？\n\n${question.questionText}`);
    if (!ok) return;
    deleteMutation.mutate({ id: question.id });
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

  function goCreateRound() {
    if (!selectedProjectId) return;
    setLocation(buildProjectUrl("/ai-diagnosis", selectedProjectId));
  }

  if (!enabled && !projectsLoading) {
    return <ProjectContextEmptyState />;
  }

  return (
    <div className="space-y-6" data-testid="questions-intent-map-page">

      {/* ═══════════ BLOCK 1: 第一屏 — 覆盖状况 + 本轮重点 + 主按钮 ═══════════ */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">AI 搜索问题池</h1>
            <p className="mt-1 text-sm text-gray-500" data-testid="questions-page-subtitle">
              管理目标客户会向 AI 提问的问题，发现 GEO 缺口并生成内容任务
            </p>
          </div>
          {selectedProject?.enterpriseName ? (
            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">
              {selectedProject.enterpriseName}
            </span>
          ) : null}
        </div>

        {/* 覆盖指标 */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="question-bank-overview">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center">
            <p className="text-[11px] text-gray-500">问题总数</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{overview.total || "--"}</p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-center">
            <p className="text-[11px] text-gray-500">已启用 / 用于诊断</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-blue-600">{overview.enabledCount || "--"}</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-center">
            <p className="text-[11px] text-gray-500">已发现缺口</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700">
              {overview.hasCompletedT0Baseline ? overview.gapCount : "--"}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-center">
            <p className="text-[11px] text-gray-500">已生成内容任务</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">
              {overview.contentTaskCount > 0 ? overview.contentTaskCount : "--"}
            </p>
          </div>
        </div>

        {/* 本轮重点提示 */}
        {currentRound && (
          <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
            <p className="text-xs font-medium text-indigo-800">本轮实测题组</p>
            <p className="mt-1 text-sm text-gray-700">
              已纳入 <span className="font-semibold text-indigo-700">{currentRound.questionsCount}</span> 个问题
              {currentRound.intentLabels.length > 0 && (
                <span className="text-gray-500"> · 覆盖意图：{currentRound.intentLabels.join("、")}</span>
              )}
            </p>
          </div>
        )}

        {/* 主按钮区 */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            className="h-11 bg-blue-600 text-white hover:bg-blue-700"
            disabled={!selectedProjectId || !hasProfile || mutating}
            onClick={handleGenerate}
            data-testid="questions-library-generate"
          >
            {generateMutation.isPending ? (
              <><Spinner className="mr-1.5 h-4 w-4" />生成中…</>
            ) : (
              <><Sparkles className="mr-1.5 h-4 w-4" />生成内容任务</>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 border-gray-300 text-gray-700 hover:bg-gray-50"
            disabled={!selectedProjectId || overview.enabledCount === 0}
            onClick={goCreateRound}
            data-testid="questions-library-create-round-top"
          >
            标记重点
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 border-gray-300 text-gray-700 hover:bg-gray-50"
            disabled={!selectedProjectId || mutating}
            onClick={openAddDialog}
            data-testid="questions-library-add"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            手动添加
          </Button>
        </div>

        {/* 建档未完成提醒 */}
        {!hasProfile && selectedProjectId && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            完成企业档案后可使用「生成内容任务」，基于品牌与行业信息自动写入客户搜索问题。
          </div>
        )}
      </div>

      {/* ═══════════ BLOCK 2: 问题意图分组（主体内容） ═══════════ */}
      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : (
        <>
          {questions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <Library className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-4 text-sm font-medium text-gray-700">还没有问题</p>
              <p className="mt-2 text-sm text-gray-500">
                可基于企业档案生成高质量问题，或手动添加高价值客户问题
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button type="button" variant="outline" onClick={openAddDialog} disabled={!selectedProjectId}>
                  手动添加问题
                </Button>
                <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" onClick={handleGenerate} disabled={!selectedProjectId || !hasProfile || generateMutation.isPending}>
                  生成高质量问题
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">按客户意图分组</h2>
              <p className="mt-1 text-xs text-gray-500">查看问题质量、实测状态与内容进展</p>
              <div className="mt-4 space-y-3">
                {QUESTION_INTENT_GROUPS.map(group => (
                  <QuestionIntentGroupSection
                    key={group.key}
                    groupKey={group.key}
                    label={group.label}
                    defaultOpen={group.defaultOpen}
                    stats={intentStats[group.key]}
                    questions={intentGroups.grouped[group.key]}
                    testedQuestionIds={testedQuestionIds}
                    hasCompletedT0Baseline={hasCompletedT0Baseline}
                    articles={articles}
                    mutating={mutating}
                    projectId={selectedProjectId ?? null}
                    onToggle={handleToggle}
                    onEdit={openEditDialog}
                    onDelete={handleDelete}
                  />
                ))}
                <QuestionUnclassifiedGroupSection
                  questions={intentGroups.unclassified}
                  testedQuestionIds={testedQuestionIds}
                  hasCompletedT0Baseline={hasCompletedT0Baseline}
                  articles={articles}
                  mutating={mutating}
                  projectId={selectedProjectId ?? null}
                  onToggle={handleToggle}
                  onEdit={openEditDialog}
                  onDelete={handleDelete}
                />
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>手动添加问题</DialogTitle>
            <DialogDescription>填写客户可能向 AI 提问的内容，并选择问题意图类型。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-question-text">问题内容</Label>
              <Textarea
                id="add-question-text"
                value={form.questionText}
                onChange={e => setForm(s => ({ ...s, questionText: e.target.value }))}
                placeholder="例如：XX 行业有哪些值得推荐的品牌？"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>问题类型</Label>
              <Select value={form.questionType} onValueChange={v => setForm(s => ({ ...s, questionType: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_ADD_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={createMutation.isPending}
              onClick={handleCreate}
            >
              {createMutation.isPending ? "保存中…" : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editQuestion)} onOpenChange={open => !open && setEditQuestion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑问题</DialogTitle>
            <DialogDescription>修改问题内容或意图类型，保存后立即生效。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-question-text">问题内容</Label>
              <Textarea
                id="edit-question-text"
                value={form.questionText}
                onChange={e => setForm(s => ({ ...s, questionText: e.target.value }))}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>问题类型</Label>
              <Select value={form.questionType} onValueChange={v => setForm(s => ({ ...s, questionType: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_ADD_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditQuestion(null)}>
              取消
            </Button>
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={updateMutation.isPending}
              onClick={handleUpdate}
            >
              {updateMutation.isPending ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}