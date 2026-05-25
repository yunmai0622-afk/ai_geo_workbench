import { AiSection } from "@/components/ai/ProductUi";
import { ProfileIntakePanel } from "@/components/enterpriseProfile/ProfileIntakePanel";
import { aiGlassPanel, aiOutlineBtn } from "@/lib/aiProductUi";
import { cn } from "@/lib/utils";
import type { ProfileApplyPatch } from "@/components/enterpriseProfile/ProfileIntakePanel";
import { FileText, HelpCircle, MessageSquare, Upload } from "lucide-react";

const UPLOAD_CARDS = [
  { id: "intro", label: "上传企业介绍", icon: FileText },
  { id: "product", label: "上传产品资料", icon: Upload },
  { id: "case", label: "上传客户案例", icon: MessageSquare },
  { id: "faq", label: "上传 FAQ / 销售话术", icon: HelpCircle },
] as const;

type Props = {
  projectId: number | undefined;
  enterpriseName: string;
  disabled?: boolean;
  showPendingSaveHint?: boolean;
  current: Parameters<typeof ProfileIntakePanel>[0]["current"];
  onApply: (patch: ProfileApplyPatch) => void;
};

export function ProfileUploadAssistSection(props: Props) {
  return (
    <div data-testid="profile-upload-assist">
    <AiSection
      id="profile-upload"
      title="资料上传与 AI 辅助解析"
      description="如果你已有企业介绍、产品资料、客户案例或销售话术，可以上传后让 AI 自动提取信息。"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {UPLOAD_CARDS.map(({ id, label, icon: Icon }) => (
          <div
            key={id}
            className={cn(aiGlassPanel, "flex items-center gap-3 p-4 text-sm text-slate-300")}
            data-testid={`upload-card-${id}`}
          >
            <Icon className="size-5 shrink-0 text-cyan-300/80" />
            <span>{label}</span>
          </div>
        ))}
      </div>
      <details className={cn(aiGlassPanel, "mt-4 text-sm")} data-testid="profile-upload-intake-collapsed">
        <summary className={cn(aiOutlineBtn, "cursor-pointer list-none px-4 py-3 font-medium text-slate-200 [&::-webkit-details-marker]:hidden")}>
          上传资料 · AI 解析并填入建档
        </summary>
        <div className="border-t border-white/8 px-4 pb-4 pt-3">
          <ProfileIntakePanel
            {...props}
            sectionTitle=""
            sectionDescription=""
          />
        </div>
      </details>
    </AiSection>
    </div>
  );
}
