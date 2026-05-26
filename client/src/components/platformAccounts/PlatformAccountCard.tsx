import { AiStatusBadge } from "@/components/ai/ProductUi";
import { Button } from "@/components/ui/button";
import { aiGlassPanel, aiOutlineBtn, aiPrimaryBtn } from "@/lib/aiProductUi";
import { cn } from "@/lib/utils";
import { getAccountGroupLabel, getPublishIdentityLabel } from "@shared/contentStrategy";
import { PUBLISH_PLATFORM_LABELS } from "@shared/platformAccountVerify";
import {
  displayAccountName,
  formatTime,
  lastPublishDisplay,
  sessionLabel,
  sessionTone,
} from "./accountDisplay";
import type { AccountWithPlatform } from "./types";
import type { usePlatformAccountBinding } from "./usePlatformAccountBinding";

type Binding = ReturnType<typeof usePlatformAccountBinding>;

type Props = {
  rows: AccountWithPlatform[];
  bindBusy: boolean;
  onReverify: Binding["handleReverifySession"];
  onRelogin: Binding["handleRelogin"];
  onOpenPublish: Binding["handleOpenPublishPage"];
  onEdit: Binding["openEditPurpose"];
  onDelete: Binding["handleDelete"];
  onTechnical: Binding["openTechnical"];
};

export function PlatformAccountCard({
  rows,
  bindBusy,
  onReverify,
  onRelogin,
  onOpenPublish,
  onEdit,
  onDelete,
  onTechnical,
}: Props) {
  return (
    <div className="grid gap-3 md:hidden" data-testid="platform-account-cards">
      {rows.map(row => (
        <div key={row.id} className={cn(aiGlassPanel, "space-y-3 p-4")} data-testid="platform-account-row">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-white">{displayAccountName(row)}</p>
              <p className="text-xs text-gray-500">{PUBLISH_PLATFORM_LABELS[row.platform]}</p>
            </div>
            <AiStatusBadge tone={sessionTone(row.sessionStatus)}>{sessionLabel(row.sessionStatus)}</AiStatusBadge>
          </div>
          <p className="text-xs text-gray-500">
            {getPublishIdentityLabel(row.accountRole) || "身份未设置"} · {getAccountGroupLabel(row.accountGroup) || "未分组"}
          </p>
          <p className="text-xs text-gray-500">
            最近检测 {formatTime(row.lastSessionCheckedAt ?? row.lastVerifiedAt)} · 最近发布 {lastPublishDisplay(row)}
          </p>
          {row.notes ? <p className="text-xs text-gray-500">备注：{row.notes}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" className={aiOutlineBtn} disabled={bindBusy} onClick={() => void onReverify(row)}>
              检测登录态
            </Button>
            <Button type="button" size="sm" variant="outline" className={aiOutlineBtn} onClick={() => void onRelogin(row)}>
              重新登录
            </Button>
            <Button type="button" size="sm" className={aiPrimaryBtn} onClick={() => onEdit(row)}>
              编辑
            </Button>
            <Button type="button" size="sm" variant="outline" className={aiOutlineBtn} onClick={() => onTechnical(row)}>
              账号详情
            </Button>
            <Button type="button" size="sm" variant="outline" className="border-red-400/30 text-red-200" onClick={() => void onDelete(row.id)}>
              删除
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
