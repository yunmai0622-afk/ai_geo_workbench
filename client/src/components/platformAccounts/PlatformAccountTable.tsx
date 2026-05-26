import { AiStatusBadge } from "@/components/ai/ProductUi";
import { Button } from "@/components/ui/button";
import { aiOutlineBtn, aiPrimaryBtn } from "@/lib/aiProductUi";
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

export function PlatformAccountTable({
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
    <div className="hidden overflow-x-auto md:block" data-testid="platform-account-table">
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs text-gray-500">
            <th className="px-2 py-2 w-8">
              <input type="checkbox" className="rounded border-gray-200" aria-label="全选" disabled />
            </th>
            <th className="px-2 py-2">账号昵称</th>
            <th className="px-2 py-2">平台</th>
            <th className="px-2 py-2">登录状态</th>
            <th className="px-2 py-2">账号身份</th>
            <th className="px-2 py-2">账号组</th>
            <th className="px-2 py-2">最近检测</th>
            <th className="px-2 py-2">最近发布</th>
            <th className="px-2 py-2">备注</th>
            <th className="px-2 py-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50" data-testid="platform-account-row">
              <td className="px-2 py-3">
                <input type="checkbox" className="rounded border-gray-200" aria-label={`选择 ${row.accountName}`} />
              </td>
              <td className="px-2 py-3 font-medium text-white">{displayAccountName(row)}</td>
              <td className="px-2 py-3 text-gray-500">{PUBLISH_PLATFORM_LABELS[row.platform]}</td>
              <td className="px-2 py-3">
                <AiStatusBadge tone={sessionTone(row.sessionStatus)}>{sessionLabel(row.sessionStatus)}</AiStatusBadge>
              </td>
              <td className="px-2 py-3 text-gray-500">{getPublishIdentityLabel(row.accountRole) || "—"}</td>
              <td className="px-2 py-3 text-gray-500">{getAccountGroupLabel(row.accountGroup) || "未分组"}</td>
              <td className="px-2 py-3 text-xs text-gray-500">{formatTime(row.lastSessionCheckedAt ?? row.lastVerifiedAt)}</td>
              <td className="px-2 py-3 text-xs text-gray-500">{lastPublishDisplay(row)}</td>
              <td className="max-w-[120px] truncate px-2 py-3 text-xs text-gray-500">{row.notes || "—"}</td>
              <td className="px-2 py-3">
                <div className="flex flex-wrap gap-1">
                  <Button type="button" size="sm" variant="outline" className={aiOutlineBtn} disabled={bindBusy} onClick={() => void onReverify(row)}>
                    检测登录态
                  </Button>
                  <Button type="button" size="sm" variant="outline" className={aiOutlineBtn} disabled={bindBusy} onClick={() => void onRelogin(row)}>
                    重新登录
                  </Button>
                  <Button type="button" size="sm" variant="outline" className={aiOutlineBtn} onClick={() => onOpenPublish(row)}>
                    打开发布页
                  </Button>
                  <Button type="button" size="sm" className={aiPrimaryBtn} onClick={() => onEdit(row)}>
                    编辑
                  </Button>
                  <Button type="button" size="sm" variant="outline" className={aiOutlineBtn} data-testid="platform-account-technical" onClick={() => onTechnical(row)}>
                    账号详情
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="border-red-400/30 text-red-200" onClick={() => void onDelete(row.id)}>
                    删除
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
