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
import { LocalAgentDownloadCard } from "@/components/LocalAgentDownloadCard";
import { aiGlassPanel, aiInput, aiOutlineBtn, aiPrimaryBtn } from "@/lib/aiProductUi";
import { cn } from "@/lib/utils";
import { LOCAL_AGENT_BASE_URL } from "@shared/localAgent";
import { PUBLISH_IDENTITY_OPTIONS } from "@shared/contentStrategy";
import {
  PUBLISH_PLATFORM_LABELS,
  PLATFORM_PUBLISH_CAPABILITY,
} from "@shared/platformAccountVerify";
import { Loader2, Monitor } from "lucide-react";
import { AccountGroupSidebar } from "./AccountGroupSidebar";
import { PlatformAccountCard } from "./PlatformAccountCard";
import { PlatformAccountTable } from "./PlatformAccountTable";
import { PlatformAccountTechnicalDialog } from "./PlatformAccountTechnicalDialog";
import { PlatformTabs } from "./PlatformTabs";
import { IDENTITY_FILTER_OPTIONS, SESSION_FILTER_OPTIONS } from "./constants";
import { usePlatformAccountBinding } from "./usePlatformAccountBinding";

type Props = {
  projectId: number;
  showDownloadCard?: boolean;
};

export function PlatformAccountMatrix({ projectId, showDownloadCard = true }: Props) {
  const b = usePlatformAccountBinding(projectId);
  const platformLabel = PUBLISH_PLATFORM_LABELS[b.selectedPlatform];
  const isNetease = b.selectedPlatform === "netease";

  return (
    <div className="space-y-4" data-testid="platform-account-matrix">
      <div>
        <h3 className="text-base font-semibold text-white">平台账号矩阵</h3>
        <p className="mt-1 text-sm text-gray-400">
          先安装本地发布客户端，再绑定各平台发布账号。系统通过本地客户端托管登录环境，不保存密码，不上传 Cookie。
        </p>
      </div>

      {showDownloadCard ? <LocalAgentDownloadCard /> : null}

      <div className="rounded-xl border border-blue-400/25 bg-blue-50 px-4 py-3 text-sm leading-relaxed text-blue-800">
        请先启动本地客户端（{LOCAL_AGENT_BASE_URL}），再点击右上角「绑定{platformLabel}账号」。登录仅在本地 Agent 窗口完成。
      </div>

      {b.bindStatusText ? (
        <p className="text-xs text-gray-400" data-testid="local-agent-bind-status">
          {b.bindStatusText}
        </p>
      ) : null}

      {b.bindStep === "agent_offline" ? (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          <p>未检测到本地发布客户端。请先下载安装并启动 GEO 发布客户端后重试。</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(aiOutlineBtn, "mt-2")}
            data-testid="retry-local-agent-health"
            onClick={() => void b.retryAgentHealth()}
          >
            重试检测
          </Button>
        </div>
      ) : null}

      {b.bindStep === "login_opened" ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className={aiPrimaryBtn}
            disabled={b.bindBusy}
            data-testid="detect-after-login"
            onClick={() => void b.handleDetectAfterLogin()}
          >
            {b.bindBusy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
            我已完成登录，检测账号
          </Button>
          <Button type="button" size="sm" variant="outline" className={aiOutlineBtn} onClick={b.resetBindFlow}>
            取消绑定
          </Button>
        </div>
      ) : null}

      <div className={cn(aiGlassPanel, "flex flex-col gap-4 p-4 lg:flex-row")}>
        <AccountGroupSidebar
          selectedGroup={b.selectedGroup}
          groupCounts={b.groupCounts}
          onSelect={b.setSelectedGroup}
          onAddGroup={b.addCustomGroup}
        />

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <PlatformTabs
              selectedPlatform={b.selectedPlatform}
              platformCounts={b.platformCounts}
              onSelect={b.setSelectedPlatform}
            />
            <Button
              type="button"
              size="sm"
              className={aiPrimaryBtn}
              disabled={b.bindBusy || (b.bindStep !== "idle" && b.bindStep !== "agent_offline")}
              data-testid={`bind-publish-account-${b.selectedPlatform}`}
              onClick={() => void b.startBindPublishAccount()}
            >
              {b.bindBusy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Monitor className="mr-1 size-3.5" />}
              {b.bindLabel}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="platform-account-filters">
            <span className="text-gray-500">登录状态</span>
            {SESSION_FILTER_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs",
                  b.sessionFilter === o.value ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-400",
                )}
                onClick={() => b.setSessionFilter(o.value)}
              >
                {o.label}
              </button>
            ))}
            <span className="ml-2 text-gray-500">账号身份</span>
            {IDENTITY_FILTER_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs",
                  b.identityFilter === o.value ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-400",
                )}
                onClick={() => b.setIdentityFilter(o.value)}
              >
                {o.label}
              </button>
            ))}
            <Input
              value={b.searchQuery}
              onChange={e => b.setSearchQuery(e.target.value)}
              placeholder="搜索账号昵称"
              className={cn(aiInput, "ml-auto max-w-xs flex-1 min-w-[140px]")}
            />
          </div>

          {b.filteredAccounts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center" data-testid="platform-account-empty">
              <p className="text-base font-medium text-white">暂无{platformLabel}账号</p>
              <p className="mt-2 text-sm text-gray-500">绑定后可用于内容发布、状态追踪和复测任务。</p>
              {isNetease ? (
                <p className="mt-2 text-xs text-amber-200/90">网易号账号绑定已开放，自动发布能力待接入。</p>
              ) : null}
              <Button
                type="button"
                className={cn(aiPrimaryBtn, "mt-4")}
                data-testid={`bind-publish-account-${b.selectedPlatform}`}
                onClick={() => void b.startBindPublishAccount()}
              >
                {b.bindLabel}
              </Button>
            </div>
          ) : (
            <>
              <PlatformAccountTable
                rows={b.filteredAccounts}
                bindBusy={b.bindBusy}
                onReverify={b.handleReverifySession}
                onRelogin={b.handleRelogin}
                onOpenPublish={b.handleOpenPublishPage}
                onEdit={b.openEditPurpose}
                onDelete={b.handleDelete}
                onTechnical={b.openTechnical}
              />
              <PlatformAccountCard
                rows={b.filteredAccounts}
                bindBusy={b.bindBusy}
                onReverify={b.handleReverifySession}
                onRelogin={b.handleRelogin}
                onOpenPublish={b.handleOpenPublishPage}
                onEdit={b.openEditPurpose}
                onDelete={b.handleDelete}
                onTechnical={b.openTechnical}
              />
            </>
          )}
        </div>
      </div>

      <Dialog
        open={b.editOpen}
        onOpenChange={open => {
          b.setEditOpen(open);
          if (!open) b.resetBindFlow();
        }}
      >
        <DialogContent className="border-gray-200 bg-white text-gray-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {b.isNewBindDialog ? b.bindLabel : `编辑${platformLabel}账号`}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {b.isNewBindDialog
                ? `已检测到账号：${b.formAccountName}。请选择身份与账号组后保存。Cookie 仅存于本机 Agent，不会上传服务器。`
                : "可修改账号身份、账号组、备注与启用状态。"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-gray-500">平台显示昵称</label>
              <Input className={cn(aiInput, "cursor-not-allowed opacity-80")} value={b.formAccountName} readOnly />
            </div>
            <div>
              <label className="text-xs text-gray-500">账号身份</label>
              <select className={aiInput} value={b.formAccountRole} onChange={e => b.setFormAccountRole(e.target.value)}>
                <option value="">未设置</option>
                {PUBLISH_IDENTITY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">所属账号组</label>
              <select className={aiInput} value={b.formAccountGroup} onChange={e => b.setFormAccountGroup(e.target.value)}>
                <option value="">未设置</option>
                {b.groupOptions.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">备注（可选）</label>
              <Input className={aiInput} value={b.formNotes} onChange={e => b.setFormNotes(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={b.formEnabled} onChange={e => b.setFormEnabled(e.target.checked)} />
              启用该账号用于发布
            </label>
            {PLATFORM_PUBLISH_CAPABILITY[b.selectedPlatform] === "bind_only" ? (
              <p className="text-xs text-amber-200/80">该平台当前仅支持账号绑定，自动发布待接入。</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className={aiOutlineBtn} onClick={() => b.setEditOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              className={aiPrimaryBtn}
              disabled={b.bindLocalMutation.isPending || b.updateMutation.isPending}
              data-testid="save-platform-account-binding"
              onClick={() => void b.handleSaveBind()}
            >
              保存绑定账号
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlatformAccountTechnicalDialog open={b.techOpen} row={b.techRow} onOpenChange={b.setTechOpen} />
    </div>
  );
}
