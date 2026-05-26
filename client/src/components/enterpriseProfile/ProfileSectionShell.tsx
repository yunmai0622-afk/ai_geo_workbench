import { AiSection, AiStatusBadge } from "@/components/ai/ProductUi";
import { Button } from "@/components/ui/button";
import { aiPrimaryBtn } from "@/lib/aiProductUi";
import type { ReactNode } from "react";
import type { SectionStatusTone } from "./types";

type Props = {
  id: string;
  title: string;
  description: string;
  hint?: string;
  status: SectionStatusTone;
  children: ReactNode;
  saveLabel?: string;
  onSave?: () => void;
  saving?: boolean;
  extraActions?: ReactNode;
};

function statusTone(s: SectionStatusTone): "success" | "warning" | "neutral" {
  if (s === "已完成") return "success";
  if (s === "待完善") return "warning";
  return "neutral";
}

export function ProfileSectionShell({
  id,
  title,
  description,
  hint,
  status,
  children,
  saveLabel,
  onSave,
  saving,
  extraActions,
}: Props) {
  return (
    <div id={id} className="scroll-mt-28" data-enterprise-section={id}>
      <AiSection title={title} description={description}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {hint ? <p className="text-xs leading-relaxed text-slate-500">{hint}</p> : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <AiStatusBadge tone={statusTone(status)} data-section-status={status}>
              {status}
            </AiStatusBadge>
            {extraActions}
          </div>
        </div>
        {children}
        {saveLabel && onSave ? (
          <div className="mt-6 flex justify-end border-t border-gray-200 pt-4">
            <Button className={aiPrimaryBtn} disabled={saving} onClick={onSave}>
              {saving ? "保存中…" : saveLabel}
            </Button>
          </div>
        ) : null}
      </AiSection>
    </div>
  );
}
