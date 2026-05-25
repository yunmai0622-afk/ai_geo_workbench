import { LocalAgentDownloadCard } from "@/components/LocalAgentDownloadCard";
import { PlatformAccountBindingSection } from "@/components/PlatformAccountBindingSection";
import { ProfileSectionShell } from "./ProfileSectionShell";

type Props = {
  projectId: number;
  status: "未填写" | "待完善" | "已完成";
};

export function EnterprisePublishEnvironmentSection({ projectId, status }: Props) {
  return (
    <div id="platform-accounts" className="scroll-mt-28">
    <ProfileSectionShell
      id="profile-publish-env"
      title="发布环境与账号绑定"
      description="先完成本地发布客户端安装与平台账号绑定，后续内容才能通过 Local Agent 发布到知乎、搜狐号、头条号、百家号；网易号当前仅支持账号绑定。"
      hint="下载 Mac 客户端 → 启动并检测 → 在平台账号矩阵中按 Tab 绑定各平台账号。"
      status={status}
    >
      <LocalAgentDownloadCard />
      <div className="mt-4">
        <PlatformAccountBindingSection projectId={projectId} embedded showDownloadCard={false} />
      </div>
    </ProfileSectionShell>
    </div>
  );
}
