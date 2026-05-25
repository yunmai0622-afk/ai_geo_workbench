import { AiSection } from "@/components/ai/ProductUi";
import { PlatformAccountMatrix } from "@/components/platformAccounts/PlatformAccountMatrix";

type PlatformAccountBindingProps = {
  projectId: number;
  /** 嵌入企业档案发布环境区：不重复外层 AiSection */
  embedded?: boolean;
  showDownloadCard?: boolean;
};

export function PlatformAccountBindingSection({
  projectId,
  embedded = false,
  showDownloadCard = true,
}: PlatformAccountBindingProps) {
  const matrix = (
    <PlatformAccountMatrix projectId={projectId} showDownloadCard={showDownloadCard} />
  );

  if (embedded) {
    return matrix;
  }

  return (
    <AiSection
      title="发布环境与账号绑定"
      description="先安装本地发布客户端，再绑定各平台发布账号。系统会通过本地客户端托管登录环境，不保存密码，不上传 Cookie。"
    >
      {matrix}
    </AiSection>
  );
}
