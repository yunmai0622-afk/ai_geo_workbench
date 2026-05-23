import { AiSection, AiStatusBadge } from "@/components/ai/ProductUi";
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
import { aiGlassPanel, aiInput, aiOutlineBtn, aiPrimaryBtn } from "@/lib/aiProductUi";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  BINDING_PUBLISH_PLATFORMS,
  PUBLISH_PLATFORM_LABELS,
  type BindingPublishPlatform,
} from "@shared/platformAccountVerify";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type AccountRow = {
  platform: BindingPublishPlatform;
  id: number | null;
  accountName: string;
  accountIdOrUrl: string;
  isEnabled: boolean;
  verificationStatus: string;
  lastVerifiedAt: Date | string | null;
  lastDetectedAccountName: string | null;
  notes: string;
};

function verificationTone(status: string): "success" | "warning" | "neutral" | "info" {
  if (status === "matched") return "success";
  if (status === "mismatched") return "warning";
  if (status === "login_required") return "warning";
  return "neutral";
}

function verificationLabel(status: string): string {
  if (status === "matched") return "最近核验：匹配";
  if (status === "mismatched") return "最近核验：不匹配";
  if (status === "login_required") return "最近核验：需登录";
  return "最近核验：未知";
}

function formatTime(value: Date | string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("zh-CN");
}

export function PlatformAccountBindingSection({ projectId }: { projectId: number }) {
  const utils = trpc.useUtils();
  const accountsQuery = trpc.geo.platformAccounts.list.useQuery({ projectId });
  const upsertMutation = trpc.geo.platformAccounts.upsert.useMutation();
  const disableMutation = trpc.geo.platformAccounts.disable.useMutation();
  const enableMutation = trpc.geo.platformAccounts.enable.useMutation();

  const [editOpen, setEditOpen] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<BindingPublishPlatform>("zhihu");
  const [formAccountName, setFormAccountName] = useState("");
  const [formAccountIdOrUrl, setFormAccountIdOrUrl] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formEnabled, setFormEnabled] = useState(true);

  const accounts = (accountsQuery.data?.accounts ?? []) as AccountRow[];
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.platform, a])), [accounts]);

  const openEdit = (platform: BindingPublishPlatform) => {
    const row = accountMap.get(platform);
    setEditingPlatform(platform);
    setFormAccountName(row?.accountName ?? "");
    setFormAccountIdOrUrl(row?.accountIdOrUrl ?? "");
    setFormNotes(row?.notes ?? "");
    setFormEnabled(row?.isEnabled ?? true);
    setEditOpen(true);
  };

  const invalidate = async () => {
    await utils.geo.platformAccounts.list.invalidate({ projectId });
  };

  const handleSave = async () => {
    if (!formAccountName.trim()) {
      toast.error("请填写账号昵称");
      return;
    }
    try {
      await upsertMutation.mutateAsync({
        projectId,
        platform: editingPlatform,
        accountName: formAccountName.trim(),
        accountIdOrUrl: formAccountIdOrUrl.trim() || null,
        notes: formNotes.trim() || null,
        isEnabled: formEnabled,
      });
      await invalidate();
      toast.success("平台账号已保存");
      setEditOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    }
  };

  const toggleEnabled = async (platform: BindingPublishPlatform, enabled: boolean) => {
    try {
      if (enabled) {
        await enableMutation.mutateAsync({ projectId, platform });
      } else {
        await disableMutation.mutateAsync({ projectId, platform });
      }
      await invalidate();
      toast.success(enabled ? "已启用" : "已禁用");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    }
  };

  return (
    <div id="platform-accounts" className="scroll-mt-24">
    <AiSection
      title="平台账号绑定"
      description="每个企业项目需要绑定自己的发布平台账号。系统会在自动发布前核验当前浏览器登录账号是否与该企业绑定账号一致，避免不同客户内容错发。"
    >
      <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-50">
        <p>
          发布前账号核验需要使用最新版发布插件（v1.2.0 及以上）。若刚更新系统，请在浏览器扩展管理中重新加载插件后再发布。
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {BINDING_PUBLISH_PLATFORMS.map(platform => {
          const row = accountMap.get(platform);
          const label = PUBLISH_PLATFORM_LABELS[platform];
          const hasAccount = Boolean(row?.accountName?.trim());
          return (
            <div key={platform} className={cn(aiGlassPanel, "flex flex-col gap-3 p-4")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-white">{label}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {hasAccount ? row!.accountName : "未绑定账号"}
                  </p>
                </div>
                <AiStatusBadge tone={row?.isEnabled && hasAccount ? "success" : "neutral"}>
                  {row?.isEnabled && hasAccount ? "已启用" : "未启用"}
                </AiStatusBadge>
              </div>
              {row?.accountIdOrUrl ? (
                <p className="break-all text-xs text-slate-500">主页 / ID：{row.accountIdOrUrl}</p>
              ) : null}
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <AiStatusBadge tone={verificationTone(row?.verificationStatus ?? "unknown")}>
                  {verificationLabel(row?.verificationStatus ?? "unknown")}
                </AiStatusBadge>
                {row?.lastDetectedAccountName ? (
                  <span>最近检测：{row.lastDetectedAccountName}</span>
                ) : null}
              </div>
              <p className="text-xs text-slate-600">最近核验：{formatTime(row?.lastVerifiedAt ?? null)}</p>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button type="button" size="sm" className={aiPrimaryBtn} onClick={() => openEdit(platform)}>
                  {hasAccount ? "编辑账号" : "添加账号"}
                </Button>
                {hasAccount ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={aiOutlineBtn}
                    onClick={() => void toggleEnabled(platform, !row?.isEnabled)}
                  >
                    {row?.isEnabled ? "禁用" : "启用"}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="border-white/10 bg-slate-950 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{PUBLISH_PLATFORM_LABELS[editingPlatform]} 账号</DialogTitle>
            <DialogDescription className="text-slate-400">
              请填写该企业在 {PUBLISH_PLATFORM_LABELS[editingPlatform]} 的账号昵称。自动发布前，系统会用该昵称与浏览器当前登录账号进行核验。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-slate-500">平台</label>
              <p className="mt-1 text-sm text-white">{PUBLISH_PLATFORM_LABELS[editingPlatform]}</p>
            </div>
            <div>
              <label className="text-xs text-slate-500">账号昵称（必填）</label>
              <Input className={aiInput} value={formAccountName} onChange={e => setFormAccountName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500">账号主页 / ID（可选）</label>
              <Input className={aiInput} value={formAccountIdOrUrl} onChange={e => setFormAccountIdOrUrl(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500">备注（可选）</label>
              <Input className={aiInput} value={formNotes} onChange={e => setFormNotes(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={formEnabled} onChange={e => setFormEnabled(e.target.checked)} />
              启用该账号用于自动发布
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className={aiOutlineBtn} onClick={() => setEditOpen(false)}>
              取消
            </Button>
            <Button type="button" className={aiPrimaryBtn} disabled={upsertMutation.isPending} onClick={() => void handleSave()}>
              {upsertMutation.isPending ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AiSection>
    </div>
  );
}
