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
  ACCOUNT_GROUP_OPTIONS,
  ACCOUNT_GROUP_TYPES,
  getAccountGroupLabel,
  getPublishIdentityLabel,
  PUBLISH_IDENTITY_OPTIONS,
  PUBLISH_IDENTITIES,
  type AccountGroupType,
  type PublishIdentity,
} from "@shared/contentStrategy";
import {
  BINDING_PUBLISH_PLATFORMS,
  PUBLISH_PLATFORM_LABELS,
  type BindingPublishPlatform,
} from "@shared/platformAccountVerify";
import { Loader2, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type AccountRow = {
  id: number;
  accountName: string;
  accountIdOrUrl: string;
  accountGroup: string | null;
  accountRole: string | null;
  isEnabled: boolean;
  verificationStatus: string;
  lastVerifiedAt: Date | string | null;
  lastDetectedAccountName: string | null;
  notes: string;
};

type PlatformGroup = {
  platform: BindingPublishPlatform;
  accounts: AccountRow[];
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
  const createMutation = trpc.geo.platformAccounts.create.useMutation();
  const updateMutation = trpc.geo.platformAccounts.update.useMutation();
  const deleteMutation = trpc.geo.platformAccounts.delete.useMutation();
  const toggleMutation = trpc.geo.platformAccounts.toggleEnabled.useMutation();

  const [editOpen, setEditOpen] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<BindingPublishPlatform>("zhihu");
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [formAccountName, setFormAccountName] = useState("");
  const [formAccountIdOrUrl, setFormAccountIdOrUrl] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formEnabled, setFormEnabled] = useState(true);
  const [formAccountGroup, setFormAccountGroup] = useState("");
  const [formAccountRole, setFormAccountRole] = useState("");
  const [authingPlatform, setAuthingPlatform] = useState<BindingPublishPlatform | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const pendingAuthRequestIdRef = useRef<string | null>(null);
  const authTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const platformGroups = (accountsQuery.data?.accounts ?? []) as PlatformGroup[];

  const groupMap = useMemo(() => new Map(platformGroups.map(g => [g.platform, g.accounts])), [platformGroups]);

  const invalidate = async () => {
    await utils.geo.platformAccounts.list.invalidate({ projectId });
  };

  const resetForm = () => {
    setFormAccountName("");
    setFormAccountIdOrUrl("");
    setFormNotes("");
    setFormEnabled(true);
    setFormAccountGroup("");
    setFormAccountRole("");
  };

  const openCreate = (platform: BindingPublishPlatform) => {
    setEditingPlatform(platform);
    setEditingAccountId(null);
    resetForm();
    setEditOpen(true);
  };

  useEffect(() => {
    const handleExtMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "GEO_AUTH_RESULT") return;
      const { platform, requestId, success, accountName, error } = event.data as {
        platform?: string;
        requestId?: string;
        success?: boolean;
        accountName?: string | null;
        error?: string | null;
      };
      if (requestId && pendingAuthRequestIdRef.current && requestId !== pendingAuthRequestIdRef.current) {
        return;
      }
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current);
        authTimeoutRef.current = null;
      }
      pendingAuthRequestIdRef.current = null;
      setAuthingPlatform(null);

      if (success && accountName && platform && BINDING_PUBLISH_PLATFORMS.includes(platform as BindingPublishPlatform)) {
        setAuthError(null);
        setEditingPlatform(platform as BindingPublishPlatform);
        setEditingAccountId(null);
        resetForm();
        setFormAccountName(accountName);
        setFormEnabled(true);
        setEditOpen(true);
        toast.success(`已检测到账号「${accountName}」，请确认身份和账号组后保存`);
      } else {
        const msg = error ?? "检测失败，请手动填写账号昵称";
        setAuthError(msg);
        toast.error(msg);
      }
    };
    window.addEventListener("message", handleExtMessage);
    return () => window.removeEventListener("message", handleExtMessage);
  }, []);

  const handleStartAuth = (platform: BindingPublishPlatform) => {
    const requestId = `${platform}-${Date.now()}`;
    pendingAuthRequestIdRef.current = requestId;
    setAuthingPlatform(platform);
    setAuthError(null);
    window.postMessage(
      {
        type: "GEO_START_AUTH",
        platform,
        requestId,
      },
      window.location.origin,
    );
    if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
    authTimeoutRef.current = setTimeout(() => {
      setAuthingPlatform(prev => {
        if (prev === platform && pendingAuthRequestIdRef.current === requestId) {
          pendingAuthRequestIdRef.current = null;
          toast.error("账号检测超时，请确认插件已启用，或手动添加账号");
          return null;
        }
        return prev;
      });
    }, 60000);
  };

  const openEdit = (platform: BindingPublishPlatform, row: AccountRow) => {
    setEditingPlatform(platform);
    setEditingAccountId(row.id);
    setFormAccountName(row.accountName);
    setFormAccountIdOrUrl(row.accountIdOrUrl ?? "");
    setFormNotes(row.notes ?? "");
    setFormEnabled(row.isEnabled);
    setFormAccountGroup(row.accountGroup ?? "");
    setFormAccountRole(row.accountRole ?? "");
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!formAccountName.trim()) {
      toast.error("请填写账号昵称");
      return;
    }
    try {
      const accountGroup =
        formAccountGroup && (ACCOUNT_GROUP_TYPES as readonly string[]).includes(formAccountGroup)
          ? (formAccountGroup as AccountGroupType)
          : null;
      const accountRole =
        formAccountRole && (PUBLISH_IDENTITIES as readonly string[]).includes(formAccountRole)
          ? (formAccountRole as PublishIdentity)
          : null;
      const payload = {
        projectId,
        accountName: formAccountName.trim(),
        accountIdOrUrl: formAccountIdOrUrl.trim() || null,
        notes: formNotes.trim() || null,
        accountGroup,
        accountRole,
        isEnabled: formEnabled,
      };
      if (editingAccountId) {
        await updateMutation.mutateAsync({ ...payload, accountId: editingAccountId });
      } else {
        await createMutation.mutateAsync({ ...payload, platform: editingPlatform });
      }
      await invalidate();
      toast.success("平台账号已保存");
      setEditOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    }
  };

  const handleDelete = async (accountId: number) => {
    if (!window.confirm("确定删除该账号？删除后不可恢复。")) return;
    try {
      await deleteMutation.mutateAsync({ projectId, accountId });
      await invalidate();
      toast.success("已删除");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  };

  const handleToggle = async (accountId: number, enabled: boolean) => {
    try {
      await toggleMutation.mutateAsync({ projectId, accountId, enabled });
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
        description="同一平台可绑定多个账号。发布时将选择具体账号，系统会核验浏览器登录昵称与所选账号一致。"
      >
        <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-50">
          <p>发布前账号核验需要使用最新版发布插件（v1.2.1 及以上）。请在扩展管理中重新加载插件后再发布。</p>
        </div>

        {authError ? <p className="text-xs text-red-400">{authError}</p> : null}

        <div className="space-y-6">
          {BINDING_PUBLISH_PLATFORMS.map(platform => {
            const accounts = groupMap.get(platform) ?? [];
            const label = PUBLISH_PLATFORM_LABELS[platform];
            return (
              <div key={platform} className={cn(aiGlassPanel, "p-4")}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-white">{label}</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" className={aiOutlineBtn} onClick={() => openCreate(platform)}>
                      手动添加
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className={aiPrimaryBtn}
                      disabled={authingPlatform !== null}
                      title="自动打开平台页面，检测当前登录账号昵称"
                      data-testid={`auth-detect-${platform}`}
                      onClick={() => handleStartAuth(platform)}
                    >
                      {authingPlatform === platform ? (
                        <>
                          <Loader2 className="mr-1 size-3.5 animate-spin" />
                          检测中…
                        </>
                      ) : (
                        <>
                          <Zap className="mr-1 size-3.5" />
                          一键授权
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                {accounts.length === 0 ? (
                  <p className="text-sm text-slate-500">暂无绑定账号，可使用「一键授权」或「手动添加」。</p>
                ) : (
                  <div className="space-y-3">
                    {accounts.map(row => (
                      <div
                        key={row.id}
                        className="rounded-lg border border-white/10 bg-slate-900/40 p-3"
                        data-testid="platform-account-row"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-white">{row.accountName}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              身份：{getPublishIdentityLabel(row.accountRole) || "未设置"} · 账号组：
                              {getAccountGroupLabel(row.accountGroup) || "未设置"}
                            </p>
                          </div>
                          <AiStatusBadge tone={row.isEnabled ? "success" : "neutral"}>
                            {row.isEnabled ? "已启用" : "已禁用"}
                          </AiStatusBadge>
                        </div>
                        {row.accountIdOrUrl ? (
                          <p className="mt-1 break-all text-xs text-slate-500">主页 / ID：{row.accountIdOrUrl}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                          <AiStatusBadge tone={verificationTone(row.verificationStatus)}>
                            {verificationLabel(row.verificationStatus)}
                          </AiStatusBadge>
                          {row.lastDetectedAccountName ? <span>最近检测：{row.lastDetectedAccountName}</span> : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-600">最近核验：{formatTime(row.lastVerifiedAt)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button type="button" size="sm" className={aiPrimaryBtn} onClick={() => openEdit(platform, row)}>
                            编辑
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={aiOutlineBtn}
                            onClick={() => void handleToggle(row.id, !row.isEnabled)}
                          >
                            {row.isEnabled ? "禁用" : "启用"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-red-400/30 text-red-200"
                            onClick={() => void handleDelete(row.id)}
                          >
                            删除
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="border-white/10 bg-slate-950 text-slate-100 sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingAccountId ? "编辑" : "添加"}
                {PUBLISH_PLATFORM_LABELS[editingPlatform]} 账号
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                同一平台下账号昵称不可重复。保存后可在发布时选择具体账号。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs text-slate-500">账号昵称（必填）</label>
                <Input className={aiInput} value={formAccountName} onChange={e => setFormAccountName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-500">账号主页 / ID（可选）</label>
                <Input className={aiInput} value={formAccountIdOrUrl} onChange={e => setFormAccountIdOrUrl(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-500">账号身份</label>
                <select
                  className={aiInput}
                  value={formAccountRole}
                  onChange={e => setFormAccountRole(e.target.value)}
                >
                  <option value="">未设置</option>
                  {PUBLISH_IDENTITY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">所属账号组</label>
                <select
                  className={aiInput}
                  value={formAccountGroup}
                  onChange={e => setFormAccountGroup(e.target.value)}
                >
                  <option value="">未设置</option>
                  {ACCOUNT_GROUP_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">备注（可选）</label>
                <Input className={aiInput} value={formNotes} onChange={e => setFormNotes(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={formEnabled} onChange={e => setFormEnabled(e.target.checked)} />
                启用该账号用于发布
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className={aiOutlineBtn} onClick={() => setEditOpen(false)}>
                取消
              </Button>
              <Button
                type="button"
                className={aiPrimaryBtn}
                disabled={createMutation.isPending || updateMutation.isPending}
                onClick={() => void handleSave()}
              >
                {createMutation.isPending || updateMutation.isPending ? "保存中…" : "保存"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AiSection>
    </div>
  );
}
