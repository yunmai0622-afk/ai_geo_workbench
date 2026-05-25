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

type Props = {
  open: boolean;
  row: AccountWithPlatform | null;
  onOpenChange: (open: boolean) => void;
};

export function PlatformAccountTechnicalDialog({ open, row, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-slate-950 text-slate-100 sm:max-w-md" data-testid="platform-account-technical-dialog">
        <DialogHeader>
          <DialogTitle>技术信息</DialogTitle>
          <DialogDescription className="text-slate-400">
            以上信息仅用于本机发布环境调试，不会上传平台密码或 Cookie。
          </DialogDescription>
        </DialogHeader>
        {row ? (
          <dl className="space-y-2 font-mono text-xs text-slate-300">
            <div>
              <dt className="text-slate-500">账号</dt>
              <dd>{displayAccountName(row)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">平台</dt>
              <dd>{PUBLISH_PLATFORM_LABELS[row.platform]}</dd>
            </div>
            <div>
              <dt className="text-slate-500">profileId</dt>
              <dd className="break-all">{row.localProfileId ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">localAgentId</dt>
              <dd className="break-all">{row.localAgentId ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">sessionStatus</dt>
              <dd>{row.sessionStatus ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">verificationStatus</dt>
              <dd>{row.verificationStatus}</dd>
            </div>
            <div>
              <dt className="text-slate-500">备注</dt>
              <dd>{row.notes?.trim() || "—"}</dd>
            </div>
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
