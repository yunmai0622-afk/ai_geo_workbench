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
import {
  checkLocalAgentHealth,
  createPlatformProfile,
  detectLocalAgentAccount,
  openLocalAgentLogin,
} from "@/lib/localAgentClient";
import { aiGlassPanel, aiInput, aiOutlineBtn, aiPrimaryBtn } from "@/lib/aiProductUi";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { LOCAL_AGENT_BASE_URL } from "@shared/localAgent";
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
import { LocalAgentDownloadCard } from "@/components/LocalAgentDownloadCard";
import { Loader2, Monitor } from "lucide-react";
import { useMemo, useState } from "react";
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
  localAgentId: string | null;
  localProfileId: string | null;
  sessionStatus: string | null;
  lastSessionCheckedAt: Date | string | null;
  lastLoginAt: Date | string | null;
  notes: string;
};

type PlatformGroup = {
  platform: BindingPublishPlatform;
  accounts: AccountRow[];
};

type BindFlowStep =
  | "idle"
  | "agent_offline"
  | "creating"
  | "login_opened"
  | "detecting"
  | "confirm";

function sessionTone(status: string | null): "success" | "warning" | "neutral" {
  if (status === "active") return "success";
  if (status === "expired") return "warning";
  return "neutral";
}

function sessionLabel(status: string | null): string {
  if (status === "active") return "登录有效";
  if (status === "expired") return "登录失效";
  return "未检测";
}

function verificationTone(status: string): "success" | "warning" | "neutral" {
  if (status === "verified" || status === "matched") return "success";
  if (status === "failed" || status === "mismatched") return "warning";
  return "neutral";
}

function verificationLabel(status: string): string {
  if (status === "verified" || status === "matched") return "已验证";
  if (status === "failed" || status === "mismatched") return "验证失败";
  return "未验证";
}

function formatTime(value: Date | string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("zh-CN");
}

export function PlatformAccountBindingSection({ projectId }: { projectId: number }) {
  const utils = trpc.useUtils();
  const accountsQuery = trpc.geo.platformAccounts.list.useQuery({ projectId });
  const bindLocalMutation = trpc.geo.platformAccounts.bindLocalAgentAccount.useMutation();
  const updateMutation = trpc.geo.platformAccounts.update.useMutation();
  const deleteMutation = trpc.geo.platformAccounts.delete.useMutation();
  const toggleMutation = trpc.geo.platformAccounts.toggleEnabled.useMutation();

  const [bindPlatform, setBindPlatform] = useState<BindingPublishPlatform>("zhihu");
  const [bindStep, setBindStep] = useState<BindFlowStep>("idle");
  const [bindBusy, setBindBusy] = useState(false);
  const [localAgentId, setLocalAgentId] = useState<string | null>(null);
  const [localProfileId, setLocalProfileId] = useState<string | null>(null);
  const [bindStatusText, setBindStatusText] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [formAccountName, setFormAccountName] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formEnabled, setFormEnabled] = useState(true);
  const [formAccountGroup, setFormAccountGroup] = useState("");
  const [formAccountRole, setFormAccountRole] = useState("");

  const platformGroups = (accountsQuery.data?.accounts ?? []) as PlatformGroup[];
  const groupMap = useMemo(() => new Map(platformGroups.map(g => [g.platform, g.accounts])), [platformGroups]);

  const invalidate = async () => {
    await utils.geo.platformAccounts.list.invalidate({ projectId });
  };

  const resetBindFlow = () => {
    setBindStep("idle");
    setBindStatusText(null);
    setLocalProfileId(null);
    setLocalAgentId(null);
    setBindBusy(false);
  };

  const openConfirmDialog = (accountName: string, presetRole?: string, presetGroup?: string) => {
    setFormAccountName(accountName);
    setEditingAccountId(null);
    setFormNotes("");
    setFormEnabled(true);
    setFormAccountRole(presetRole ?? "");
    setFormAccountGroup(presetGroup ?? "");
    setBindStep("confirm");
    setEditOpen(true);
  };

  const openEditPurpose = (row: AccountRow, platform: BindingPublishPlatform) => {
    setBindPlatform(platform);
    setEditingAccountId(row.id);
    setFormAccountName(row.accountName);
    setFormNotes(row.notes ?? "");
    setFormEnabled(row.isEnabled);
    setFormAccountGroup(row.accountGroup ?? "");
    setFormAccountRole(row.accountRole ?? "");
    setBindStep("idle");
    setEditOpen(true);
  };

  const retryAgentHealth = async (): Promise<boolean> => {
    const health = await checkLocalAgentHealth();
    if (!health) {
      setBindStep("agent_offline");
      setBindStatusText("未检测到本地发布客户端。请先启动 GEO 发布客户端后重试。");
      return false;
    }
    setLocalAgentId(health.agentId);
    return true;
  };

  const startBindPublishAccount = async (platform: BindingPublishPlatform) => {
    const label = PUBLISH_PLATFORM_LABELS[platform];
    setBindPlatform(platform);
    setBindBusy(true);
    setBindStatusText("正在检测本地发布客户端…");
    try {
      if (!(await retryAgentHealth())) {
        toast.error("未检测到本地发布客户端");
        return;
      }
      setBindStep("creating");
      setBindStatusText(`正在创建${label}独立账号环境…`);
      const profile = await createPlatformProfile({
        platform,
        projectId,
        accountRole: formAccountRole || null,
        accountGroup: formAccountGroup || null,
      });
      setLocalProfileId(profile.profileId);
      setBindStep("login_opened");
      setBindStatusText(`已打开本地登录窗口，请在窗口中登录${label}账号。`);
      await openLocalAgentLogin(profile.profileId);
      toast.success(`请在本地客户端窗口中完成${label}登录`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "绑定流程失败");
      resetBindFlow();
    } finally {
      setBindBusy(false);
    }
  };

  const handleDetectAfterLogin = async () => {
    if (!localProfileId) {
      toast.error("请先创建账号环境并打开登录窗口");
      return;
    }
    setBindBusy(true);
    setBindStep("detecting");
    setBindStatusText(`正在检测${PUBLISH_PLATFORM_LABELS[bindPlatform]}登录账号…`);
    try {
      const result = await detectLocalAgentAccount(localProfileId);
      if (!result.ok || !result.accountName) {
        const msg =
          result.message ??
          `未检测到${PUBLISH_PLATFORM_LABELS[bindPlatform]}登录账号，请先在打开窗口中登录`;
        setBindStatusText(msg);
        toast.error(msg);
        setBindStep("login_opened");
        return;
      }
      setBindStatusText(`已检测到账号：${result.accountName}`);
      openConfirmDialog(result.accountName, formAccountRole, formAccountGroup);
      toast.success(`已检测到账号「${result.accountName}」`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "检测失败");
      setBindStep("login_opened");
    } finally {
      setBindBusy(false);
    }
  };

  const handleSaveBind = async () => {
    if (!localAgentId || !localProfileId || !formAccountName.trim()) {
      toast.error("本地 Agent 或账号信息不完整");
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

      if (editingAccountId) {
        await updateMutation.mutateAsync({
          projectId,
          accountId: editingAccountId,
          accountGroup,
          accountRole,
          isEnabled: formEnabled,
          notes: formNotes.trim() || null,
          purposeOnly: true,
        });
      } else {
        await bindLocalMutation.mutateAsync({
          projectId,
          platform: bindPlatform,
          accountName: formAccountName.trim(),
          accountGroup,
          accountRole,
          localAgentId,
          localProfileId,
          sessionStatus: "active",
          notes: formNotes.trim() || null,
          isEnabled: formEnabled,
        });
      }
      await invalidate();
      toast.success("发布账号已绑定");
      setEditOpen(false);
      resetBindFlow();
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

  const handleReverifySession = async (row: AccountRow, platform: BindingPublishPlatform) => {
    if (!row.localProfileId) {
      toast.error("该账号未关联本地 profile，请重新绑定");
      return;
    }
    setBindBusy(true);
    try {
      if (!(await retryAgentHealth())) {
        toast.error("本地客户端未启动");
        return;
      }
      const result = await detectLocalAgentAccount(row.localProfileId);
      if (!result.ok || !result.accountName) {
        toast.error(result.message ?? "检测失败");
        return;
      }
      if (result.accountName !== row.accountName) {
        toast.error(`当前登录为「${result.accountName}」，与绑定账号「${row.accountName}」不一致`);
        return;
      }
      const accountGroup =
        row.accountGroup && (ACCOUNT_GROUP_TYPES as readonly string[]).includes(row.accountGroup)
          ? (row.accountGroup as AccountGroupType)
          : null;
      const accountRole =
        row.accountRole && (PUBLISH_IDENTITIES as readonly string[]).includes(row.accountRole)
          ? (row.accountRole as PublishIdentity)
          : null;
      await bindLocalMutation.mutateAsync({
        projectId,
        platform,
        accountName: row.accountName,
        accountGroup,
        accountRole,
        localAgentId: localAgentId ?? row.localAgentId ?? "",
        localProfileId: row.localProfileId,
        sessionStatus: "active",
        isEnabled: row.isEnabled,
        notes: row.notes || null,
      });
      await invalidate();
      toast.success("登录状态已更新");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "重新验证失败");
    } finally {
      setBindBusy(false);
    }
  };

  const isNewBindDialog = editingAccountId == null && bindStep === "confirm";

  return (
    <div id="platform-accounts" className="scroll-mt-24">
      <AiSection
        title="平台账号绑定"
        description="通过本地 GEO 发布客户端为每个账号创建独立登录环境，用于发布前核验。不上传 Cookie，不保存密码。"
      >
        <LocalAgentDownloadCard />

        <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-sm leading-relaxed text-cyan-50">
          <p>
            请先启动本地客户端（{LOCAL_AGENT_BASE_URL}），再点击「绑定发布账号」。登录仅在本地 Agent 窗口完成。
          </p>
        </div>

        {bindStatusText ? (
          <p className="text-xs text-slate-400" data-testid="local-agent-bind-status">
            {bindStatusText}
          </p>
        ) : null}

        {bindStep === "agent_offline" ? (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            <p>未检测到本地发布客户端。请先启动 GEO 发布客户端后重试。</p>
            <p className="mt-1 text-xs text-red-200/80">客户端未安装或未启动</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(aiOutlineBtn, "mt-2")}
              data-testid="retry-local-agent-health"
              onClick={() => void retryAgentHealth().then(ok => ok && toast.success("本地客户端已在线"))}
            >
              重试检测
            </Button>
          </div>
        ) : null}

        {bindStep === "login_opened" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className={aiPrimaryBtn}
              disabled={bindBusy}
              data-testid="detect-after-login"
              onClick={() => void handleDetectAfterLogin()}
            >
              {bindBusy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
              我已完成登录，检测账号
            </Button>
            <Button type="button" size="sm" variant="outline" className={aiOutlineBtn} onClick={resetBindFlow}>
              取消绑定
            </Button>
          </div>
        ) : null}

        <div className="space-y-6">
          {BINDING_PUBLISH_PLATFORMS.map(platform => {
            const accounts = groupMap.get(platform) ?? [];
            const label = PUBLISH_PLATFORM_LABELS[platform];
            return (
              <div key={platform} className={cn(aiGlassPanel, "p-4")}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-white">{label}</h3>
                  <Button
                    type="button"
                    size="sm"
                    className={aiPrimaryBtn}
                    disabled={bindBusy || (bindStep !== "idle" && bindStep !== "agent_offline")}
                    data-testid={`bind-publish-account-${platform}`}
                    onClick={() => void startBindPublishAccount(platform)}
                  >
                    {bindBusy && bindPlatform === platform ? (
                      <Loader2 className="mr-1 size-3.5 animate-spin" />
                    ) : (
                      <Monitor className="mr-1 size-3.5" />
                    )}
                    绑定发布账号
                  </Button>
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  将创建独立浏览器环境并打开{label}登录页，检测到的昵称将写入企业档案（不保存密码、不上传 Cookie）。
                </p>
                {accounts.length === 0 ? (
                  <p className="text-sm text-slate-500" data-testid="platform-account-empty">
                    暂未绑定发布账号。请启动本地客户端后点击「绑定发布账号」。
                  </p>
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
                            {row.localAgentId ? (
                              <p className="mt-1 text-xs text-slate-600">Agent：{row.localAgentId.slice(0, 12)}…</p>
                            ) : null}
                            {row.localProfileId ? (
                              <p className="mt-1 text-xs text-slate-600">profile：{row.localProfileId}</p>
                            ) : (
                              <p className="mt-1 text-xs text-amber-200/90">旧账号 · 需重新绑定本地客户端</p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <AiStatusBadge tone={sessionTone(row.sessionStatus)}>
                              {sessionLabel(row.sessionStatus)}
                            </AiStatusBadge>
                            <AiStatusBadge tone={verificationTone(row.verificationStatus)}>
                              {verificationLabel(row.verificationStatus)}
                            </AiStatusBadge>
                            <AiStatusBadge tone={row.isEnabled ? "success" : "neutral"}>
                              {row.isEnabled ? "已启用" : "已禁用"}
                            </AiStatusBadge>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          最近验证：{formatTime(row.lastVerifiedAt)} · 会话检查：
                          {formatTime(row.lastSessionCheckedAt)}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className={aiPrimaryBtn}
                            onClick={() => openEditPurpose(row, platform)}
                          >
                            编辑用途
                          </Button>
                          {row.localProfileId ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={aiOutlineBtn}
                              disabled={bindBusy}
                              data-testid={`reverify-session-${row.id}`}
                              onClick={() => void handleReverifySession(row, platform)}
                            >
                              重新验证登录
                            </Button>
                          ) : null}
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

        <Dialog
          open={editOpen}
          onOpenChange={open => {
            setEditOpen(open);
            if (!open) resetBindFlow();
          }}
        >
          <DialogContent className="border-white/10 bg-slate-950 text-slate-100 sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {isNewBindDialog
                  ? `绑定${PUBLISH_PLATFORM_LABELS[bindPlatform]}发布账号`
                  : `编辑${PUBLISH_PLATFORM_LABELS[bindPlatform]}账号用途`}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {isNewBindDialog
                  ? `已检测到账号：${formAccountName}。请选择身份与账号组后保存。Cookie 仅存于本机 Agent，不会上传服务器。`
                  : "可修改账号身份、账号组、备注与启用状态。平台显示昵称不可修改。"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs text-slate-500">平台显示昵称</label>
                <Input
                  className={cn(aiInput, "cursor-not-allowed opacity-80")}
                  value={formAccountName}
                  readOnly
                  data-testid="platform-account-name-readonly"
                />
                <p className="mt-1 text-xs text-slate-600">由本地 Agent 从知乎登录页检测，用于发布前核验。</p>
              </div>
              <div>
                <label className="text-xs text-slate-500">账号身份</label>
                <select className={aiInput} value={formAccountRole} onChange={e => setFormAccountRole(e.target.value)}>
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
                <select className={aiInput} value={formAccountGroup} onChange={e => setFormAccountGroup(e.target.value)}>
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
                disabled={bindLocalMutation.isPending || updateMutation.isPending}
                data-testid="save-platform-account-binding"
                onClick={() => void handleSaveBind()}
              >
                {bindLocalMutation.isPending || updateMutation.isPending ? "保存中…" : "保存绑定账号"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AiSection>
    </div>
  );
}
