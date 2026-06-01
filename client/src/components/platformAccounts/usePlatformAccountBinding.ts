import {
  checkLocalAgentHealth,
  createPlatformProfile,
  detectLocalAgentAccount,
  openLocalAgentLogin,
} from "@/lib/localAgentClient";
import { trpc } from "@/lib/trpc";
import {
  ACCOUNT_GROUP_OPTIONS,
  ACCOUNT_GROUP_TYPES,
  type AccountGroupType,
  type PublishIdentity,
  PUBLISH_IDENTITIES,
} from "@shared/contentStrategy";
import {
  BINDING_PUBLISH_PLATFORMS,
  PUBLISH_PLATFORM_LABELS,
  PLATFORM_PUBLISH_CAPABILITY,
  type BindingPublishPlatform,
} from "@shared/platformAccountVerify";
import { toUserFacingError, toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  IDENTITY_FILTER_OPTIONS,
  SESSION_FILTER_OPTIONS,
  SIDEBAR_GROUPS,
  matchesIdentityFilter,
  matchesSessionFilter,
  matchesSidebarGroup,
  type IdentityFilter,
  type SessionFilter,
  type SidebarGroupKey,
} from "./constants";
import type { AccountRow, AccountWithPlatform, PlatformGroup } from "./types";

export type BindFlowStep = "idle" | "agent_offline" | "creating" | "login_opened" | "detecting" | "confirm";

export function usePlatformAccountBinding(projectId: number) {
  const utils = trpc.useUtils();
  const accountsQuery = trpc.geo.platformAccounts.list.useQuery({ projectId });
  const bindLocalMutation = trpc.geo.platformAccounts.bindLocalAgentAccount.useMutation();
  const updateMutation = trpc.geo.platformAccounts.update.useMutation();
  const deleteMutation = trpc.geo.platformAccounts.delete.useMutation();
  const toggleMutation = trpc.geo.platformAccounts.toggleEnabled.useMutation();

  const [selectedPlatform, setSelectedPlatform] = useState<BindingPublishPlatform>("zhihu");
  const [selectedGroup, setSelectedGroup] = useState<SidebarGroupKey>("all");
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");
  const [identityFilter, setIdentityFilter] = useState<IdentityFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [customGroups, setCustomGroups] = useState<string[]>([]);

  const [bindStep, setBindStep] = useState<BindFlowStep>("idle");
  const [bindBusy, setBindBusy] = useState(false);
  const [localAgentId, setLocalAgentId] = useState<string | null>(null);
  const [localProfileId, setLocalProfileId] = useState<string | null>(null);
  const [bindStatusText, setBindStatusText] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [techOpen, setTechOpen] = useState(false);
  const [techRow, setTechRow] = useState<AccountWithPlatform | null>(null);
  const [formAccountName, setFormAccountName] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formEnabled, setFormEnabled] = useState(true);
  const [formAccountGroup, setFormAccountGroup] = useState("");
  const [formAccountRole, setFormAccountRole] = useState("");

  const platformGroups = (accountsQuery.data?.accounts ?? []) as PlatformGroup[];

  const allAccounts = useMemo((): AccountWithPlatform[] => {
    const out: AccountWithPlatform[] = [];
    for (const g of platformGroups) {
      for (const a of g.accounts) out.push({ ...a, platform: g.platform });
    }
    return out;
  }, [platformGroups]);

  const platformCounts = useMemo(() => {
    const m = new Map<BindingPublishPlatform, number>();
    for (const p of BINDING_PUBLISH_PLATFORMS) {
      m.set(p, platformGroups.find(g => g.platform === p)?.accounts.length ?? 0);
    }
    return m;
  }, [platformGroups]);

  const groupCounts = useMemo(() => {
    const counts = new Map<SidebarGroupKey, number>();
    for (const { key } of SIDEBAR_GROUPS) {
      counts.set(
        key,
        allAccounts.filter(a => matchesSidebarGroup(a.accountGroup, key)).length,
      );
    }
    return counts;
  }, [allAccounts]);

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allAccounts.filter(a => {
      if (a.platform !== selectedPlatform) return false;
      if (!matchesSidebarGroup(a.accountGroup, selectedGroup)) return false;
      if (!matchesSessionFilter(a.sessionStatus, sessionFilter)) return false;
      if (!matchesIdentityFilter(a.accountRole, identityFilter)) return false;
      if (q && !a.accountName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allAccounts, selectedPlatform, selectedGroup, sessionFilter, identityFilter, searchQuery]);

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

  const openEditPurpose = (row: AccountWithPlatform) => {
    setSelectedPlatform(row.platform);
    setEditingAccountId(row.id);
    setFormAccountName(row.accountName);
    setFormNotes(row.notes ?? "");
    setFormEnabled(row.isEnabled);
    setFormAccountGroup(row.accountGroup ?? "");
    setFormAccountRole(row.accountRole ?? "");
    setBindStep("idle");
    setEditOpen(true);
  };

  const openTechnical = (row: AccountWithPlatform) => {
    setTechRow(row);
    setTechOpen(true);
  };

  const retryAgentHealth = async (): Promise<boolean> => {
    const health = await checkLocalAgentHealth();
    if (!health) {
      setBindStep("agent_offline");
      setBindStatusText("未检测到本地发布客户端。请先下载安装并启动 GEO 发布客户端后重试。");
      return false;
    }
    setLocalAgentId(health.agentId);
    return true;
  };

  const startBindPublishAccount = async (platform: BindingPublishPlatform = selectedPlatform) => {
    const label = PUBLISH_PLATFORM_LABELS[platform];
    setSelectedPlatform(platform);
    setBindBusy(true);
    setBindStatusText("正在检测本地发布客户端…");
    try {
      if (!(await retryAgentHealth())) {
        toast.error("请先下载安装并启动本地发布客户端");
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
      toast.error(toUserFacingErrorFromUnknown(e, "绑定流程失败"));
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
    setBindStatusText(`正在检测${PUBLISH_PLATFORM_LABELS[selectedPlatform]}登录账号…`);
    try {
      const result = await detectLocalAgentAccount(localProfileId);
      if (!result.ok || !result.accountName) {
        const msg = toUserFacingError(
          result.message ??
            `未检测到${PUBLISH_PLATFORM_LABELS[selectedPlatform]}登录账号，请先在打开窗口中登录`,
          "未检测到登录账号，请先在打开窗口中登录",
        );
        setBindStatusText(msg);
        toast.error(msg);
        setBindStep("login_opened");
        return;
      }
      setBindStatusText(`已检测到账号：${result.accountName}`);
      openConfirmDialog(result.accountName, formAccountRole, formAccountGroup);
      toast.success(`已检测到账号「${result.accountName}」`);
    } catch (e) {
      toast.error(toUserFacingErrorFromUnknown(e, "检测失败"));
      setBindStep("login_opened");
    } finally {
      setBindBusy(false);
    }
  };

  const handleSaveBind = async () => {
    if (!localAgentId || !localProfileId || !formAccountName.trim()) {
      if (!editingAccountId) {
        toast.error("本地 Agent 或账号信息不完整");
        return;
      }
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
          platform: selectedPlatform,
          accountName: formAccountName.trim(),
          accountGroup,
          accountRole,
          localAgentId: localAgentId!,
          localProfileId: localProfileId!,
          sessionStatus: "active",
          notes: formNotes.trim() || null,
          isEnabled: formEnabled,
        });
      }
      await invalidate();
      toast.success(editingAccountId ? "已保存" : "发布账号已绑定");
      setEditOpen(false);
      resetBindFlow();
    } catch (e) {
      toast.error(toUserFacingErrorFromUnknown(e, "保存失败"));
    }
  };

  const handleDelete = async (accountId: number) => {
    if (!window.confirm("确定删除该账号？删除后不可恢复。")) return;
    try {
      await deleteMutation.mutateAsync({ projectId, accountId });
      await invalidate();
      toast.success("已删除");
    } catch (e) {
      toast.error(toUserFacingErrorFromUnknown(e, "删除失败"));
    }
  };

  const handleToggle = async (accountId: number, enabled: boolean) => {
    try {
      await toggleMutation.mutateAsync({ projectId, accountId, enabled });
      await invalidate();
      toast.success(enabled ? "已启用" : "已禁用");
    } catch (e) {
      toast.error(toUserFacingErrorFromUnknown(e, "操作失败"));
    }
  };

  const handleReverifySession = async (row: AccountWithPlatform) => {
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
        platform: row.platform,
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
      toast.error(toUserFacingErrorFromUnknown(e, "检测失败"));
    } finally {
      setBindBusy(false);
    }
  };

  const handleRelogin = async (row: AccountWithPlatform) => {
    if (!row.localProfileId) {
      void startBindPublishAccount(row.platform);
      return;
    }
    setBindBusy(true);
    try {
      if (!(await retryAgentHealth())) {
        toast.error("请先启动本地发布客户端");
        return;
      }
      await openLocalAgentLogin(row.localProfileId);
      toast.success("已打开登录窗口，请完成登录后点击「检测登录态」");
    } catch (e) {
      toast.error(toUserFacingErrorFromUnknown(e, "无法打开登录窗口"));
    } finally {
      setBindBusy(false);
    }
  };

  const handleOpenPublishPage = (row: AccountWithPlatform) => {
    if (PLATFORM_PUBLISH_CAPABILITY[row.platform] === "bind_only") {
      toast.message("网易号自动发布待接入，当前仅支持账号绑定");
      return;
    }
    if (PLATFORM_PUBLISH_CAPABILITY[row.platform] !== "supported") {
      toast.message(`${PUBLISH_PLATFORM_LABELS[row.platform]}发布待实机验证，请在本机客户端进行发布测试`);
      return;
    }
    toast.message("请在本机 GEO 客户端中进行发布测试");
  };

  const addCustomGroup = () => {
    const name = window.prompt("输入新分组名称（将出现在绑定时的账号组选项）");
    if (!name?.trim()) return;
    if (customGroups.includes(name.trim())) return;
    setCustomGroups(prev => [...prev, name.trim()]);
    toast.success("已添加分组选项（绑定保存时需选择对应账号组字段）");
  };

  const bindLabel = `绑定${PUBLISH_PLATFORM_LABELS[selectedPlatform]}账号`;
  const isNewBindDialog = editingAccountId == null && bindStep === "confirm";
  const groupOptions = [
    ...ACCOUNT_GROUP_OPTIONS,
    ...customGroups.map(g => ({ value: g, label: g })),
  ];

  return {
    accountsQuery,
    selectedPlatform,
    setSelectedPlatform,
    selectedGroup,
    setSelectedGroup,
    sessionFilter,
    setSessionFilter,
    identityFilter,
    setIdentityFilter,
    searchQuery,
    setSearchQuery,
    filteredAccounts,
    platformCounts,
    groupCounts,
    bindStep,
    bindBusy,
    bindStatusText,
    editOpen,
    setEditOpen,
    techOpen,
    setTechOpen,
    techRow,
    formAccountName,
    setFormAccountName,
    formNotes,
    setFormNotes,
    formEnabled,
    setFormEnabled,
    formAccountGroup,
    setFormAccountGroup,
    formAccountRole,
    setFormAccountRole,
    bindLabel,
    isNewBindDialog,
    groupOptions,
    startBindPublishAccount,
    handleDetectAfterLogin,
    handleSaveBind,
    handleDelete,
    handleToggle,
    handleReverifySession,
    handleRelogin,
    handleOpenPublishPage,
    openEditPurpose,
    openTechnical,
    resetBindFlow,
    retryAgentHealth,
    addCustomGroup,
    bindLocalMutation,
    updateMutation,
  };
}
