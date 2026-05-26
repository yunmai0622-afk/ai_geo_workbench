import { ProfileIntakePanel } from "@/components/enterpriseProfile/ProfileIntakePanel";
import type { ProfileApplyPatch } from "@/components/enterpriseProfile/ProfileIntakePanel";
import { FileText, HelpCircle, MessageSquare, Upload, ChevronDown } from "lucide-react";

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
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">资料上传与 AI 辅助解析</h3>
        <p className="mt-1 text-sm text-gray-500">
          如果你已有企业介绍、产品资料、客户案例或销售话术，可以上传后让 AI 自动提取信息。
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {UPLOAD_CARDS.map(({ id, label, icon: Icon }) => (
            <div
              key={id}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700"
              data-testid={`upload-card-${id}`}
            >
              <Icon className="size-5 shrink-0 text-blue-600" />
              <span>{label}</span>
            </div>
          ))}
        </div>

        <details className="mt-4 rounded-lg border border-gray-200 bg-gray-50 text-sm" data-testid="profile-upload-intake-collapsed">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-medium text-gray-800 [&::-webkit-details-marker]:hidden">
            <ChevronDown className="size-4 transition-transform [[open]>&]:rotate-180" />
            上传资料 · AI 解析并填入建档
          </summary>
          <div className="border-t border-gray-200 px-4 pb-4 pt-3">
            <ProfileIntakePanel
              {...props}
              sectionTitle=""
              sectionDescription=""
            />
          </div>
        </details>
      </section>
    </div>
  );
}
