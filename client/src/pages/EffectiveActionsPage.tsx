import { P0Card, P0Section } from "@/components/geo/P0UiPrimitives";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import {
  buildDefaultActionName,
  EFFECTIVE_ACTION_EFFECT_LEVEL_OPTIONS,
  EFFECTIVE_ACTION_PLATFORM_OPTIONS,
  EFFECTIVE_ACTION_TYPE_OPTIONS,
  formatEffectiveActionChangeDirection,
  formatEffectiveActionEffectLevel,
  formatEffectiveActionExecutedAt,
  formatEffectiveActionPlatform,
  toDatetimeLocalValue,
} from "@/lib/effectiveActionsDisplay";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import { trpc } from "@/lib/trpc";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { ClipboardList, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type CreateFormState = {
  actionType: string;
  platform: string;
  executedAt: string;
  effectLevel: string;
  note: string;
};

function defaultCreateForm(): CreateFormState {
  return {
    actionType: EFFECTIVE_ACTION_TYPE_OPTIONS[0]?.value ?? "content_publish",
    platform: EFFECTIVE_ACTION_PLATFORM_OPTIONS[0]?.value ?? "zhihu",
    executedAt: toDatetimeLocalValue(new Date()),
    effectLevel: "watching",
    note: "",
  };
}

export default function EffectiveActionsPage() {
  const { selectedProjectId, enabled, projectsLoading } = useActiveProjectSelection();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateFormState>(() => defaultCreateForm());

  const projectsQuery = trpc.geo.projects.list.useQuery(undefined, { enabled });
  const listQuery = trpc.geo.effectiveActions.listByProject.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const createMutation = trpc.geo.effectiveActions.create.useMutation({
    onSuccess: async () => {
      await listQuery.refetch();
      toast.success("有效动作已记录");
      setDialogOpen(false);
      setForm(defaultCreateForm());
    },
    onError: err => {
      toast.error(toUserFacingErrorFromUnknown(err, "保存失败，请稍后重试"));
    },
  });

  const currentProject = useMemo(
    () => projectsQuery.data?.find(p => p.id === selectedProjectId),
    [projectsQuery.data, selectedProjectId],
  );

  const rows = listQuery.data ?? [];
  const loading = enabled && (listQuery.isLoading || projectsQuery.isLoading);

  function openCreateDialog() {
    setForm(defaultCreateForm());
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!selectedProjectId || !currentProject) {
      toast.error("请先选择企业项目");
      return;
    }
    const executedAt = new Date(form.executedAt);
    if (Number.isNaN(executedAt.getTime())) {
      toast.error("请填写有效的执行时间");
      return;
    }

    createMutation.mutate({
      projectId: selectedProjectId,
      industry: currentProject.industry?.trim() || "未分类",
      customerType: (currentProject.targetCustomers ?? "").trim().slice(0, 255) || "未填写",
      questionType: "manual_record",
      actionType: form.actionType as "content_publish" | "profile_update" | "keyword_add" | "competitor_analysis",
      actionName: buildDefaultActionName(form.actionType),
      platform: form.platform,
      executedAt,
      effectLevel: form.effectLevel as "A_obvious" | "B_possible" | "C_no_observed_effect" | "watching",
      note: form.note.trim() || undefined,
    });
  }

  if (!enabled && !projectsLoading) {
    return (
      <div className="pb-12" data-testid="effective-actions-page">
        <ProjectContextEmptyState
          title="有效动作记录"
          description="请先选择一个企业项目，再记录和查看有效动作。"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12" data-testid="effective-actions-page">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-blue-600">
            <ClipboardList className="h-5 w-5" aria-hidden />
            <span className="text-sm font-medium">客户交付</span>
          </div>
          <h1 className={geoP0Surfaces.sectionTitle}>有效动作记录</h1>
          <p className="text-sm text-gray-500">
            记录交付过程中已执行的动作及效果判断，供下一轮优化与经验沉淀参考。
          </p>
        </div>
        <Button type="button" className={geoP0Brand.primary} onClick={openCreateDialog} data-testid="effective-actions-create-btn">
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          新增动作
        </Button>
      </header>

      <P0Section title="动作列表" description="按执行时间倒序展示本项目已记录的有效动作。">
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-gray-500">
            <Spinner className="size-5 text-blue-600" />
            正在加载有效动作…
          </div>
        ) : listQuery.isError ? (
          <P0Card className="text-sm text-amber-700">暂时无法加载，请刷新重试</P0Card>
        ) : rows.length === 0 ? (
          <P0Card className="text-sm text-gray-500" testId="effective-actions-empty">
            暂无有效动作记录。点击「新增动作」开始记录交付过程中的关键动作。
          </P0Card>
        ) : (
          <P0Card className="overflow-x-auto p-0">
            <Table data-testid="effective-actions-table">
              <TableHeader>
                <TableRow>
                  <TableHead>动作名称</TableHead>
                  <TableHead>平台</TableHead>
                  <TableHead>问题类型</TableHead>
                  <TableHead>变化方向</TableHead>
                  <TableHead>效果等级</TableHead>
                  <TableHead>执行时间</TableHead>
                  <TableHead>人工结论</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-gray-900">{row.actionName}</TableCell>
                    <TableCell>{formatEffectiveActionPlatform(row.platform)}</TableCell>
                    <TableCell>{row.questionType === "manual_record" ? "手动记录" : row.questionType}</TableCell>
                    <TableCell>{formatEffectiveActionChangeDirection(row.changeDirection)}</TableCell>
                    <TableCell>{formatEffectiveActionEffectLevel(row.effectLevel)}</TableCell>
                    <TableCell>{formatEffectiveActionExecutedAt(row.executedAt)}</TableCell>
                    <TableCell className="max-w-xs whitespace-pre-wrap text-gray-700">
                      {row.manualConclusion?.trim() || row.note?.trim() || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </P0Card>
        )}
      </P0Section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="effective-actions-create-dialog">
          <DialogHeader>
            <DialogTitle>新增有效动作</DialogTitle>
            <DialogDescription>填写动作类型、平台、执行时间与效果判断，便于后续复盘。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="effective-action-type">动作类型</Label>
              <Select
                value={form.actionType}
                onValueChange={value => setForm(current => ({ ...current, actionType: value }))}
              >
                <SelectTrigger id="effective-action-type" data-testid="effective-action-type">
                  <SelectValue placeholder="选择动作类型" />
                </SelectTrigger>
                <SelectContent>
                  {EFFECTIVE_ACTION_TYPE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="effective-action-platform">平台</Label>
              <Select
                value={form.platform}
                onValueChange={value => setForm(current => ({ ...current, platform: value }))}
              >
                <SelectTrigger id="effective-action-platform" data-testid="effective-action-platform">
                  <SelectValue placeholder="选择平台" />
                </SelectTrigger>
                <SelectContent>
                  {EFFECTIVE_ACTION_PLATFORM_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="effective-action-executed-at">执行时间</Label>
              <Input
                id="effective-action-executed-at"
                type="datetime-local"
                value={form.executedAt}
                onChange={e => setForm(current => ({ ...current, executedAt: e.target.value }))}
                data-testid="effective-action-executed-at"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="effective-action-effect-level">效果等级</Label>
              <Select
                value={form.effectLevel}
                onValueChange={value => setForm(current => ({ ...current, effectLevel: value }))}
              >
                <SelectTrigger id="effective-action-effect-level" data-testid="effective-action-effect-level">
                  <SelectValue placeholder="选择效果等级" />
                </SelectTrigger>
                <SelectContent>
                  {EFFECTIVE_ACTION_EFFECT_LEVEL_OPTIONS.map(value => (
                    <SelectItem key={value} value={value}>
                      {formatEffectiveActionEffectLevel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="effective-action-note">备注</Label>
              <Textarea
                id="effective-action-note"
                rows={3}
                placeholder="补充动作背景、观察结论或适用条件（选填）"
                value={form.note}
                onChange={e => setForm(current => ({ ...current, note: e.target.value }))}
                data-testid="effective-action-note"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              className={geoP0Brand.primary}
              disabled={createMutation.isPending}
              onClick={handleSubmit}
              data-testid="effective-action-submit"
            >
              {createMutation.isPending ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
