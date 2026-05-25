import { AiStatusBadge } from "@/components/ai/ProductUi";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { aiChipActive, aiChipIdle, aiGlassPanel, aiInput, aiOutlineBtn, aiPrimaryBtn } from "@/lib/aiProductUi";
import { cn } from "@/lib/utils";
import { Copy, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ProfileSectionShell } from "./ProfileSectionShell";
import {
  caseCompleteness,
  caseCompletenessScore,
  type CaseDraft,
  type SectionStatusTone,
} from "./types";

const textareaClass = `${aiInput} min-h-[5rem] w-full max-w-none resize-y py-2`;

type Props = {
  embedded?: boolean;
  status: SectionStatusTone;
  saving: boolean;
  casesChoice: "unset" | "has" | "none";
  onCasesChoice: (v: "unset" | "has" | "none") => void;
  caseRows: CaseDraft[];
  onCaseRowsChange: (rows: CaseDraft[]) => void;
  onSaveCase: (row: CaseDraft, idx: number) => Promise<void>;
  onSaveChoiceNone: () => Promise<void>;
  onDeleteCase: (idx: number) => void;
  onAiOrganize?: () => void;
};

const EMPTY_CASE: CaseDraft = {
  caseType: "待补充案例线索",
  customerBackground: "",
  originalProblem: "",
  executionProcess: "",
  resultData: "",
  allowPublic: false,
};

export function CustomerCaseLibrarySection({
  embedded = false,
  status,
  saving,
  casesChoice,
  onCasesChoice,
  caseRows,
  onCaseRowsChange,
  onSaveCase,
  onSaveChoiceNone,
  onDeleteCase,
  onAiOrganize,
}: Props) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<CaseDraft>(EMPTY_CASE);

  const openNew = () => {
    setEditIdx(null);
    setDraft({ ...EMPTY_CASE });
    setEditorOpen(true);
  };

  const openEdit = (idx: number) => {
    setEditIdx(idx);
    setDraft({ ...caseRows[idx] });
    setEditorOpen(true);
  };

  const saveEditor = async () => {
    if (!draft.customerBackground.trim()) {
      toast.error("请填写客户是谁");
      return;
    }
    if (editIdx === null) {
      const next = [...caseRows, draft];
      onCaseRowsChange(next);
      await onSaveCase(draft, next.length - 1);
    } else {
      const next = caseRows.map((r, i) => (i === editIdx ? draft : r));
      onCaseRowsChange(next);
      await onSaveCase(draft, editIdx);
    }
    setEditorOpen(false);
  };

  const copyAsMaterial = (row: CaseDraft) => {
    const text = [
      `【客户】${row.customerBackground.trim()}`,
      `【问题】${row.originalProblem.trim()}`,
      `【方案】${row.executionProcess.trim()}`,
      `【结果】${row.resultData.trim()}`,
    ].join("\n");
    void navigator.clipboard.writeText(text).then(() => toast.success("已复制为内容素材"));
  };

  const listStatus = useMemo((): SectionStatusTone => {
    if (casesChoice === "none") return "已完成";
    if (caseRows.length === 0) return "未填写";
    const avg =
      caseRows.reduce((n, r) => n + caseCompletenessScore(r), 0) / Math.max(1, caseRows.length);
    return avg >= 4 ? "已完成" : "待完善";
  }, [casesChoice, caseRows]);

  const body = (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" className={aiPrimaryBtn} onClick={openNew}>
          <Plus className="mr-1 size-3.5" />
          添加客户案例
        </Button>
        {onAiOrganize ? (
          <Button type="button" size="sm" variant="outline" className={aiOutlineBtn} onClick={onAiOrganize}>
            <Sparkles className="mr-1 size-3.5" />
            AI 帮我整理案例
          </Button>
        ) : null}
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => onCasesChoice("has")} className={casesChoice === "has" ? aiChipActive : aiChipIdle}>
          <span className="font-medium">有客户案例 / 能公开</span>
        </button>
        <button type="button" onClick={() => onCasesChoice("none")} className={casesChoice === "none" ? aiChipActive : aiChipIdle}>
          <span className="font-medium">暂时没有，跳过</span>
        </button>
      </div>

      {casesChoice === "none" ? (
        <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-50">
          内容生成时将不引用具体案例。
          <div className="mt-3 flex justify-end">
            <Button variant="outline" className={aiOutlineBtn} disabled={saving} onClick={() => void onSaveChoiceNone()}>
              保存选择
            </Button>
          </div>
        </div>
      ) : null}

      {casesChoice === "has" ? (
        <div className="grid gap-3 md:grid-cols-2" data-testid="customer-case-library">
          {caseRows.length === 0 ? (
            <p className="text-sm text-slate-500 md:col-span-2">暂无案例，点击「添加客户案例」开始录入。</p>
          ) : (
            caseRows.map((row, idx) => {
              const c = caseCompleteness(row);
              const score = caseCompletenessScore(row);
              const title = row.customerBackground.trim().slice(0, 40) || `案例 ${idx + 1}`;
              return (
                <div key={row.id ?? `case-${idx}`} className={cn(aiGlassPanel, "flex flex-col gap-3 p-4")} data-testid="customer-case-card">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{row.originalProblem.trim() || "待补充客户原问题"}</p>
                    </div>
                    <AiStatusBadge tone={score >= 4 ? "success" : "warning"}>
                      {score >= 4 ? "较完整" : "待完善"}
                    </AiStatusBadge>
                  </div>
                  <ul className="grid grid-cols-2 gap-1 text-[11px] text-slate-500">
                    <li className={c.hasCustomer ? "text-emerald-300/90" : ""}>有客户对象</li>
                    <li className={c.hasProblem ? "text-emerald-300/90" : ""}>有问题</li>
                    <li className={c.hasSolution ? "text-emerald-300/90" : ""}>有方案</li>
                    <li className={c.hasResult ? "text-emerald-300/90" : ""}>有结果</li>
                    <li className={cn("col-span-2", c.hasData ? "text-emerald-300/90" : "text-amber-200/80")}>
                      {c.hasData ? "含具体数据" : "建议补充数字结果，例如提升比例、节省时间、成交金额"}
                    </li>
                  </ul>
                  <p className="line-clamp-2 text-xs text-slate-400">{row.executionProcess.trim() || "—"}</p>
                  <p className="text-xs text-cyan-200/90">{row.resultData.trim().slice(0, 80) || "—"}</p>
                  <div className="mt-auto flex flex-wrap gap-2 border-t border-white/8 pt-3">
                    <Button type="button" size="sm" variant="outline" className={aiOutlineBtn} onClick={() => openEdit(idx)}>
                      <Pencil className="mr-1 size-3 h-3" />
                      编辑
                    </Button>
                    <Button type="button" size="sm" variant="outline" className={aiOutlineBtn} onClick={() => copyAsMaterial(row)}>
                      <Copy className="mr-1 size-3 h-3" />
                      复制素材
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-red-400/30 text-red-200"
                      onClick={() => onDeleteCase(idx)}
                    >
                      <Trash2 className="mr-1 size-3 h-3" />
                      删除
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : null}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-slate-950 text-slate-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editIdx === null ? "添加客户案例" : "编辑客户案例"}</DialogTitle>
            <DialogDescription className="text-slate-400">仅保留 6 项核心字段，保存后用于 GEO 内容与 AI 搜索引用。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm" data-testid="customer-case-editor-fields">
            <label className="block space-y-1">
              <span className="font-medium text-slate-100">1. 客户是谁？</span>
              <textarea
                className={textareaClass}
                rows={2}
                placeholder="客户类型、行业、规模等"
                value={draft.customerBackground}
                onChange={e => setDraft({ ...draft, customerBackground: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="font-medium text-slate-100">2. 客户原来遇到什么问题？</span>
              <textarea
                className={textareaClass}
                rows={2}
                placeholder="当时的核心困境"
                value={draft.originalProblem}
                onChange={e => setDraft({ ...draft, originalProblem: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="font-medium text-slate-100">3. 我们提供了什么方案？</span>
              <textarea
                className={textareaClass}
                rows={4}
                placeholder="交付动作与关键步骤"
                value={draft.executionProcess}
                onChange={e => setDraft({ ...draft, executionProcess: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="font-medium text-slate-100">4. 最终产生了什么结果？</span>
              <textarea
                className={textareaClass}
                rows={2}
                placeholder="业务变化、体验改善"
                value={draft.resultData}
                onChange={e => setDraft({ ...draft, resultData: e.target.value })}
              />
            </label>
            <p className="text-xs text-amber-200/80">5–6. 请在「结果」栏写明具体数据；下方勾选是否可公开。</p>
            <div className="flex items-center gap-2">
              <Switch checked={draft.allowPublic} onCheckedChange={c => setDraft({ ...draft, allowPublic: c })} />
              <span>是否允许公开引用</span>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className={aiOutlineBtn} onClick={() => setEditorOpen(false)}>
              取消
            </Button>
            <Button type="button" className={aiPrimaryBtn} disabled={saving} onClick={() => void saveEditor()}>
              保存案例
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (embedded) {
    return <div data-testid="customer-case-library-embedded">{body}</div>;
  }

  return (
    <ProfileSectionShell
      id="profile-cases"
      title="客户案例与成果证据"
      description="案例是 GEO 内容最重要的信任素材。请优先填写真实客户问题、解决方案和结果。"
      hint="使用卡片管理案例，点击编辑在弹窗中填写 6 项核心信息。"
      status={listStatus === "已完成" ? status : listStatus}
    >
      {body}
    </ProfileSectionShell>
  );
}
