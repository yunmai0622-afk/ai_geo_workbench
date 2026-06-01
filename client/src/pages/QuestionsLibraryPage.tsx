import { P0Card, P0MetricTile, P0Section } from "@/components/geo/P0UiPrimitives";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { geoP0Surfaces } from "@/lib/geoP0Visual";
import { trpc } from "@/lib/trpc";
import { resolveQuestionTypeDisplayLabel } from "@shared/retestComparisonDisplay";
import { Library, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type QuestionRow = {
  id: number;
  questionText: string;
  questionType: string;
  enabled: number | boolean | null;
};

const LIBRARY_GROUPS = [
  { key: "品牌认知", dbType: "品牌认知", label: "品牌认知" },
  { key: "行业推荐", dbType: "行业推荐", label: "行业推荐" },
  { key: "竞品对比", dbType: "竞品对比", label: "竞品对比" },
  { key: "场景需求", dbType: "scenario_need", label: "场景需求" },
  { key: "长尾转化", dbType: "long_tail_conversion", label: "长尾转化" },
  { key: "指定问题", dbType: "指定问题", label: "指定问题" },
] as const;

type LibraryGroupKey = (typeof LIBRARY_GROUPS)[number]["key"] | "其他类型";

type QuestionGroup = {
  key: LibraryGroupKey;
  dbType: string;
  label: string;
  items: QuestionRow[];
};

const MANUAL_ADD_TYPES = LIBRARY_GROUPS.map(g => ({ value: g.dbType, label: g.label }));

const GROUP_DB_TYPES = new Set<string>(LIBRARY_GROUPS.map(g => g.dbType));

type LibraryQuestionGroup = {
  key: string;
  dbType: string;
  label: string;
  items: QuestionRow[];
};

function isQuestionEnabled(enabled: QuestionRow["enabled"]) {
  return Number(enabled) !== 0;
}

function buildGenerateMessage(result: {
  count: number;
  newCount?: number;
  filteredCount?: number;
  hadPreviousQuestions?: boolean;
}) {
  const n = result.newCount ?? result.count;
  if ((result.filteredCount ?? 0) > 0) {
    return `已过滤部分重复问题，本次生成 ${n} 个新问题。`;
  }
  if (result.hadPreviousQuestions) {
    return "已生成一组新的目标客户问题。";
  }
  return `已生成并写入 ${result.count} 条目标客户问题。`;
}

type FormState = {
  questionText: string;
  questionType: string;
};

function defaultForm(): FormState {
  return { questionText: "", questionType: "指定问题" };
}

export default function QuestionsLibraryPage() {
  const utils = trpc.useUtils();
  const { selectedProjectId, selectedProject, projectInput, enabled, projectsLoading } = useActiveProjectSelection();
  const [addOpen, setAddOpen] = useState(false);
  const [editQuestion, setEditQuestion] = useState<QuestionRow | null>(null);
  const [form, setForm] = useState<FormState>(() => defaultForm());

  const questionsQuery = trpc.geo.questions.list.useQuery(projectInput, { enabled });
  const assetSummaryQuery = trpc.geo.assetLibrary.summary.useQuery(projectInput, { enabled });
  const hasProfile = Boolean(assetSummaryQuery.data?.profile);

  const toggleMutation = trpc.geo.questions.toggle.useMutation({
    onSuccess: async () => {
      await utils.geo.questions.list.invalidate(projectInput);
    },
    onError: err => toast.error(err.message || "更新状态失败"),
  });
  const deleteMutation = trpc.geo.questions.delete.useMutation({
    onSuccess: async () => {
      await utils.geo.questions.list.invalidate(projectInput);
      toast.success("问题已删除");
    },
    onError: err => toast.error(err.message || "删除失败"),
  });
  const createMutation = trpc.geo.questions.create.useMutation({
    onSuccess: async () => {
      await utils.geo.questions.list.invalidate(projectInput);
      toast.success("问题已添加");
      setAddOpen(false);
      setForm(defaultForm());
    },
    onError: err => toast.error(err.message || "添加失败"),
  });
  const updateMutation = trpc.geo.questions.update.useMutation({
    onSuccess: async () => {
      await utils.geo.questions.list.invalidate(projectInput);
      toast.success("问题已更新");
      setEditQuestion(null);
      setForm(defaultForm());
    },
    onError: err => toast.error(err.message || "更新失败"),
  });
  const generateMutation = trpc.geo.questions.generateTargetQuestions.useMutation({
    onSuccess: async result => {
      await utils.geo.questions.list.invalidate(projectInput);
      toast.success(buildGenerateMessage(result));
    },
    onError: err => toast.error(err.message || "生成问题建议失败"),
  });

  const questions = (questionsQuery.data ?? []) as QuestionRow[];
  const loading = enabled && (questionsQuery.isLoading || assetSummaryQuery.isLoading || projectsLoading);
  const mutating =
    toggleMutation.isPending ||
    deleteMutation.isPending ||
    createMutation.isPending ||
    updateMutation.isPending ||
    generateMutation.isPending;

  const stats = useMemo(() => {
    const total = questions.length;
    const enabledCount = questions.filter(q => isQuestionEnabled(q.enabled)).length;
    const byGroup = LIBRARY_GROUPS.map(group => ({
      ...group,
      count: questions.filter(q => q.questionType === group.dbType).length,
    }));
    const otherCount = questions.filter(q => !GROUP_DB_TYPES.has(q.questionType)).length;
    return { total, enabledCount, byGroup, otherCount };
  }, [questions]);

  const groupedQuestions = useMemo((): QuestionGroup[] => {
    const groups: QuestionGroup[] = LIBRARY_GROUPS.map(group => ({
      ...group,
      items: questions.filter(q => q.questionType === group.dbType),
    }));
    const otherItems = questions.filter(q => !GROUP_DB_TYPES.has(q.questionType));
    if (otherItems.length > 0) {
      groups.push({
        key: "其他类型",
        dbType: "__other__",
        label: "其他类型",
        items: otherItems,
      });
    }
    return groups;
  }, [questions]);

  function openAddDialog() {
    setForm(defaultForm());
    setAddOpen(true);
  }

  function openEditDialog(question: QuestionRow) {
    setEditQuestion(question);
    setForm({
      questionText: question.questionText,
      questionType: GROUP_DB_TYPES.has(question.questionType) ? question.questionType : "指定问题",
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
      enabled: isQuestionEnabled(editQuestion.enabled),
    });
  }

  function handleToggle(question: QuestionRow, nextEnabled: boolean) {
    toggleMutation.mutate({ id: question.id, enabled: nextEnabled });
  }

  function handleDelete(question: QuestionRow) {
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
      toast.error("请先完成企业档案建档，再生成问题建议");
      return;
    }
    generateMutation.mutate({ projectId: selectedProjectId });
  }

  if (!enabled && !projectsLoading) {
    return <ProjectContextEmptyState />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Library className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">问题库</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            管理 AI 实测与内容诊断使用的客户问题，可按类型查看、编辑、启用或停用。
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
            onClick={openAddDialog}
            data-testid="questions-library-add"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            手动添加问题
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
                生成问题建议
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <P0MetricTile label="总问题数" value={String(stats.total)} hint="当前项目全部问题" />
            <P0MetricTile label="已启用" value={String(stats.enabledCount)} hint="参与实测与诊断" />
            <P0MetricTile
              label="已停用"
              value={String(Math.max(stats.total - stats.enabledCount, 0))}
              hint="暂不参与检测"
            />
            <P0MetricTile
              label="指定问题"
              value={String(stats.byGroup.find(g => g.key === "指定问题")?.count ?? 0)}
              hint="AI 检索型目标问题"
            />
          </div>

          {stats.byGroup.some(g => g.count > 0) ? (
            <P0Card>
              <p className="text-sm font-medium text-gray-900">各类型分布</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {stats.byGroup.map(group => (
                  <Badge key={group.key} variant="secondary" className="text-xs">
                    {group.label} {group.count}
                  </Badge>
                ))}
                {stats.otherCount > 0 ? (
                  <Badge variant="secondary" className="text-xs">
                    其他类型 {stats.otherCount}
                  </Badge>
                ) : null}
              </div>
            </P0Card>
          ) : null}

          {questions.length === 0 ? (
            <P0Card className="text-center">
              <p className="text-sm font-medium text-gray-900">还没有问题</p>
              <p className="mt-2 text-sm text-gray-500">
                可基于企业档案生成问题建议，或手动添加「指定问题」与各类诊断问题。
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button type="button" variant="outline" onClick={openAddDialog} disabled={!selectedProjectId}>
                  手动添加问题
                </Button>
                <Button
                  type="button"
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  onClick={handleGenerate}
                  disabled={!selectedProjectId || !hasProfile || generateMutation.isPending}
                >
                  生成问题建议
                </Button>
              </div>
            </P0Card>
          ) : (
            <div className="space-y-8">
              {groupedQuestions.map(group =>
                group.items.length === 0 ? null : (
                  <P0Section
                    key={group.key}
                    title={group.label}
                    description={`共 ${group.items.length} 条${group.key === "指定问题" ? "，用于 AI 实测诊断" : ""}`}
                  >
                    <div className="grid gap-3">
                      {group.items.map(question => (
                        <P0Card key={question.id} className="!p-4" testId={`question-card-${question.id}`}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1 space-y-2">
                              <p className="text-sm leading-relaxed text-gray-900">{question.questionText}</p>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {resolveQuestionTypeDisplayLabel(question.questionType)}
                                </Badge>
                                {!isQuestionEnabled(question.enabled) ? (
                                  <Badge variant="secondary" className="text-xs text-gray-500">
                                    已停用
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`toggle-${question.id}`} className="text-xs text-gray-500">
                                  启用
                                </Label>
                                <Switch
                                  id={`toggle-${question.id}`}
                                  checked={isQuestionEnabled(question.enabled)}
                                  disabled={mutating}
                                  onCheckedChange={checked => handleToggle(question, checked)}
                                  data-testid={`question-toggle-${question.id}`}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-500 hover:text-gray-900"
                                disabled={mutating}
                                onClick={() => openEditDialog(question)}
                                aria-label="编辑问题"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-700"
                                disabled={mutating}
                                onClick={() => handleDelete(question)}
                                aria-label="删除问题"
                                data-testid={`question-delete-${question.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </P0Card>
                      ))}
                    </div>
                  </P0Section>
                ),
              )}
            </div>
          )}
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>手动添加问题</DialogTitle>
            <DialogDescription>填写客户可能向 AI 提问的内容，并选择问题类型。</DialogDescription>
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
            <DialogDescription>修改问题内容或类型，保存后立即生效。</DialogDescription>
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

      {!hasProfile && selectedProjectId ? (
        <p className={geoP0Surfaces.muted}>
          提示：完成企业档案后可使用「生成问题建议」，基于品牌与行业信息自动写入指定问题。
        </p>
      ) : null}
    </div>
  );
}
