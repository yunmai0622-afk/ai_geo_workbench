import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { aiOutlineBtn } from "@/lib/aiProductUi";
import { PUBLISH_PLATFORM_LABELS } from "@shared/platformAccountVerify";
import { displayAccountName } from "./accountDisplay";
import type { AccountWithPlatform } from "./types";

function sessionStatusLabel(status: string | null | undefined): string {
  const s = (status ?? "").trim();
  if (!s) return "—";
  if (s === "valid" || s === "active") return "登录有效";
  if (s === "expired") return "登录已过期";
  if (s === "unknown") return "待检测";
  return "待确认";
}

function verificationStatusLabel(status: string | null | undefined): string {
  const s = (status ?? "").trim();
  if (!s) return "—";
  if (s === "verified") return "已验证";
  if (s === "pending") return "待验证";
  if (s === "failed") return "验证失败";
  return "待确认";
}

type Props = {
  open: boolean;
  row: AccountWithPlatform | null;
  onOpenChange: (open: boolean) => void;
};

export function PlatformAccountTechnicalDialog({ open, row, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="border-white/10 bg-slate-950 text-slate-100 sm:max-w-md"
        data-testid="platform-account-technical-dialog"
      >
        <DialogHeader>
          <DialogTitle>账号详情</DialogTitle>
          <DialogDescription className="text-slate-400">
            仅展示发布账号与登录状态，不包含密码或 Cookie。
          </DialogDescription>
        </DialogHeader>
        {row ? (
          <dl className="space-y-2 text-sm text-slate-300">
            <div>
              <dt className="text-slate-500">账号名称</dt>
              <dd>{displayAccountName(row)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">平台</dt>
              <dd>{PUBLISH_PLATFORM_LABELS[row.platform]}</dd>
            </div>
            <div>
              <dt className="text-slate-500">登录状态</dt>
              <dd>{sessionStatusLabel(row.sessionStatus)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">验证状态</dt>
              <dd>{verificationStatusLabel(row.verificationStatus)}</dd>
            </div>
            {row.notes?.trim() ? (
              <div>
                <dt className="text-slate-500">备注</dt>
                <dd>{row.notes.trim()}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" className={aiOutlineBtn} onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
