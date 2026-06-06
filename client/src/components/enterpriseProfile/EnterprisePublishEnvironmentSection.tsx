import { LocalAgentDownloadCard } from "@/components/LocalAgentDownloadCard";
import { PlatformAccountBindingSection } from "@/components/PlatformAccountBindingSection";
import { flattenPlatformAccountsForServerHeartbeat } from "@/lib/localAgentServerContext";
import { trpc } from "@/lib/trpc";
import { isPublishReadyPlatformAccount } from "@shared/publishReadiness";
import { useMemo } from "react";
import { ProfileSectionShell } from "./ProfileSectionShell";

type Props = {
  projectId: number;
  status: "未填写" | "待完善" | "已完成";
};

export function EnterprisePublishEnvironmentSection({ projectId, status }: Props) {
  const accountsQuery = trpc.geo.platformAccounts.list.useQuery({ projectId });
  const accountGroups = accountsQuery.data?.accounts ?? [];
  const flattenedPlatformAccounts = useMemo(
    () => flattenPlatformAccountsForServerHeartbeat(accountGroups),
    [accountGroups],
  );
  const boundPublishAccountCount = useMemo(() => {
    let count = 0;
    for (const group of accountGroups) {
      for (const account of group.accounts ?? []) {
        if (
          isPublishReadyPlatformAccount({
            platform: group.platform,
            accountName: account.accountName,
            isEnabled: account.isEnabled,
            localProfileId: account.localProfileId,
            localAgentId: account.localAgentId,
            sessionStatus: account.sessionStatus,
          })
        ) {
          count += 1;
        }
      }
    }
    return count;
  }, [accountGroups]);

  return (
    <div id="platform-accounts" className="scroll-mt-28">
    <ProfileSectionShell
      id="profile-publish-env"
      title="发布环境与账号绑定"
      description="先完成本地发布客户端安装与平台账号绑定，后续内容才能通过 Local Agent 发布到知乎、搜狐号、头条号、百家号、网易号。"
      hint="下载 Mac 客户端 → 启动并检测 → 在平台账号矩阵中按 Tab 绑定各平台账号。"
      status={status}
    >
      <LocalAgentDownloadCard
        platformAccounts={flattenedPlatformAccounts}
        boundPublishAccountCount={boundPublishAccountCount}
      />
      <div className="mt-4">
        <PlatformAccountBindingSection projectId={projectId} embedded showDownloadCard={false} />
      </div>
    </ProfileSectionShell>
    </div>
  );
}
